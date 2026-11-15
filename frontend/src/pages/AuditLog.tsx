import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DataTable } from "../components/DataTable";
import { ErrorToast } from "../components/ErrorToast";
import { InfoHint } from "../components/InfoHint";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { Modal } from "../components/Modal";
import { RefreshButton } from "../components/RefreshButton";
import { AuditChangesTable } from "../components/AuditChangesTable";
import { api, ApiError } from "../lib/api";
import { auditActionTitle, auditChangesShort, auditOpenPath, AuditEventView } from "../lib/auditLabels";
import { formatJalaliDate, localTodayIso } from "../lib/formatDate";
import { RequiredMark } from "../components/RequiredMark";
import { usePersistedState } from "../lib/usePersistedState";
import { useTabs } from "../lib/TabsContext";

// تنظیمات › گزارش › «مرور لاگ تغییرات» (فقط خواندن؛ تنظیم لاگ در /management است). فهرست از سرور صفحه‌بندی می‌شود و با فیلترهای هدر محدود می‌شود.

interface Options {
  users: { id: number; name: string }[];
  models: { model: string; title: string }[];
  actions: string[];
}
interface Filters {
  from: string;
  to: string;
  userId: string;
  model: string;
  action: string;
  kind: string;
  recordId: string;
  q: string;
}
const EMPTY: Filters = { from: "", to: "", userId: "", model: "", action: "", kind: "", recordId: "", q: "" };

/** «از/تا تاریخ» همیشه مقدار دارد: پیش‌فرض امروز (حالت ذخیره‌شده‌ی قدیمی تب هم که خالی داشت اصلاح می‌شود) */
const withDates = (f: Filters): Filters => {
  const today = localTodayIso();
  return { ...f, from: f.from || today, to: f.to || today };
};

function timeFa(iso: string) {
  return `${formatJalaliDate(iso)} ${new Date(iso).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Tehran" })}`;
}

export default function AuditLog() {
  const { openTab } = useTabs();
  const [draftRaw, setDraft] = usePersistedState<Filters>("/audit-log:draft", withDates(EMPTY));
  const [appliedRaw, setApplied] = usePersistedState<Filters>("/audit-log:applied", withDates(EMPTY));
  const draft = useMemo(() => withDates(draftRaw), [draftRaw]);
  const applied = useMemo(() => withDates(appliedRaw), [appliedRaw]);
  const [options, setOptions] = useState<Options>({ users: [], models: [], actions: [] });
  const [rows, setRows] = useState<AuditEventView[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<AuditEventView | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    api.get("/audit-log/options").then(setOptions).catch((e: ApiError) => setError(e.message));
  }, []);

  const load = useCallback(async () => {
    const my = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const p = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      for (const [k, v] of Object.entries(applied)) if (v) p.set(k, v);
      const r: { rows: AuditEventView[]; total: number } = await api.get(`/audit-log?${p.toString()}`);
      if (my !== seq.current) return;
      setRows(r.rows);
      setTotal(r.total);
    } catch (e) {
      if (my === seq.current) setError((e as ApiError).message);
    } finally {
      if (my === seq.current) setLoading(false);
    }
  }, [applied, page, pageSize]);

  useEffect(() => {
    load();
  }, [load]);

  function apply() {
    if (draft.from > draft.to) {
      setError("«از تاریخ» نمی‌تواند بعد از «تا تاریخ» باشد");
      return;
    }
    setPage(1);
    setApplied(draft);
  }
  function clear() {
    const fresh = withDates(EMPTY);
    setDraft(fresh);
    setPage(1);
    setApplied(fresh);
  }
  // تاریخ‌ها خالی‌شدنی نیستند: پاک‌کردن انتخابگر مقدار قبلی را نگه می‌دارد
  const set = (p: Partial<Filters>) => {
    const next = { ...p };
    if ("from" in next && !next.from) delete next.from;
    if ("to" in next && !next.to) delete next.to;
    setDraft({ ...draft, ...next });
  };

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint
            title="مرور لاگ تغییرات"
            text="چه کسی، کی، کدام رکورد را ایجاد، ویرایش یا حذف کرد. در سطح «کامل» مقدار قبل و بعد هر فیلد هم هست. روشن/خاموش و مدت نگهداری لاگ در صفحه‌ی مدیریت (/management) تنظیم می‌شود."
          />
          <RefreshButton onClick={load} />
        </div>
      </div>
      <ErrorToast message={error} />
      <div className="card ar-filters" style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end", marginBottom: 8 }}>
        <label className="form-field">
          <span>از تاریخ<RequiredMark /></span>
          <JalaliDatePicker value={draft.from} onChange={(v) => set({ from: v })} />
        </label>
        <label className="form-field">
          <span>تا تاریخ<RequiredMark /></span>
          <JalaliDatePicker value={draft.to} onChange={(v) => set({ to: v })} />
        </label>
        <label className="form-field">
          <span>کاربر</span>
          <select value={draft.userId} onChange={(e) => set({ userId: e.target.value })}>
            <option value="">همه</option>
            {options.users.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </label>
        <label className="form-field">
          <span>نوع رکورد</span>
          <select value={draft.model} onChange={(e) => set({ model: e.target.value })}>
            <option value="">همه</option>
            {options.models.map((m) => (
              <option key={m.model} value={m.model}>{m.title}</option>
            ))}
          </select>
        </label>
        <label className="form-field">
          <span>عمل</span>
          <select value={draft.action} onChange={(e) => set({ action: e.target.value })}>
            <option value="">همه</option>
            {options.actions.map((a) => (
              <option key={a} value={a}>{auditActionTitle(a)}</option>
            ))}
          </select>
        </label>
        <label className="form-field">
          <span>دسته</span>
          <select value={draft.kind} onChange={(e) => set({ kind: e.target.value })}>
            <option value="">همه</option>
            <option value="CHANGE">تغییر رکورد</option>
            <option value="EVENT">رویداد عملیاتی</option>
            <option value="AUTH">ورود</option>
          </select>
        </label>
        <label className="form-field">
          <span>شناسه‌ی رکورد</span>
          <input dir="ltr" value={draft.recordId} onChange={(e) => set({ recordId: e.target.value })} onKeyDown={(e) => e.key === "Enter" && apply()} style={{ width: 110 }} />
        </label>
        <label className="form-field">
          <span>جستجو (توضیح/کاربر)</span>
          <input value={draft.q} onChange={(e) => set({ q: e.target.value })} onKeyDown={(e) => e.key === "Enter" && apply()} />
        </label>
        <button type="button" className="btn" onClick={apply}>اعمال فیلتر</button>
        <button type="button" className="btn secondary" onClick={clear}>حذف فیلترها</button>
      </div>
      <DataTable
        columns={[
          { header: "زمان", render: (r: AuditEventView) => timeFa(r.at), width: "160px" },
          { header: "کاربر", render: (r: AuditEventView) => r.userName || "—", width: "130px" },
          { header: "عمل", render: (r: AuditEventView) => auditActionTitle(r.action), width: "150px" },
          {
            header: "رکورد",
            render: (r: AuditEventView) => {
              if (!r.modelTitle) return "—";
              const path = r.action === "DELETE" ? null : auditOpenPath(r.model, r.recordId);
              const label = `${r.modelTitle}${r.recordId ? ` #${r.recordId}` : ""}`;
              return path ? (
                <button type="button" className="link-btn" onClick={() => openTab(path)} title="باز کردن رکورد">{label}</button>
              ) : (
                label
              );
            },
            width: "190px",
          },
          { header: "توضیح", render: (r: AuditEventView) => r.summary || "" },
          {
            header: "تغییر فیلدها",
            width: "280px",
            render: (r: AuditEventView) =>
              r.changes ? (
                <button type="button" className="link-btn" onClick={() => setDetail(r)} title="نمایش کامل">
                  {auditChangesShort(r.changes)}
                </button>
              ) : (
                ""
              ),
          },
          { header: "IP", render: (r: AuditEventView) => r.ip || "", width: "130px" },
        ]}
        rows={rows}
        serverPaging={{ page, pageSize, total, loading, onPageChange: setPage, onPageSizeChange: (n: number) => { setPageSize(n); setPage(1); } }}
      />
      {detail && (
        <Modal title={`${auditActionTitle(detail.action)} — ${detail.modelTitle ?? ""}${detail.recordId ? ` #${detail.recordId}` : ""}`} onClose={() => setDetail(null)} wide>
          <div className="mg-muted" style={{ marginBottom: 8 }}>{detail.userName || "سیستم"} — {timeFa(detail.at)}</div>
          <AuditChangesTable event={detail} />
        </Modal>
      )}
    </div>
  );
}
