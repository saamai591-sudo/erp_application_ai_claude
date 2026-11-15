import { useCallback, useEffect, useRef, useState } from "react";
import { DataTable } from "../components/DataTable";
import { ErrorToast } from "../components/ErrorToast";
import { InfoHint } from "../components/InfoHint";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { RefreshButton } from "../components/RefreshButton";
import { toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";
import { api, ApiError } from "../lib/api";
import { showError, showToast } from "../lib/toast";
import { usePersistedState } from "../lib/usePersistedState";
import { usePermissions } from "../lib/usePermissions";
import { EmployeePickerField, useEmployeeOptions } from "./AttendancePunches";

// مدیریت تردد › عملیات › «ثبت‌های دریافتی از دستگاه»: صندوق دریافت از «عامل تردد». هر ثبت پذیرفته‌شده (تردد ساخته شد)، در انتظار نگاشت (شناسه‌ی دستگاه به کارمندی وصل نیست)
// یا ردشده (خارج از دوره‌ی همکاری، ماه قفل‌شده با «محاسبه تردد») است. پس از رفع علت، «پردازش مجدد» دوباره امتحان می‌کند. قواعد در سرور (services/attendanceDeviceService.ts).

interface InboxRow {
  id: number;
  connectionId: number;
  connectionName: string;
  deviceUserId: string;
  deviceName: string;
  date: string;
  time: string;
  status: string;
  statusTitle: string;
  reason: string;
  personnelCode: string;
  employeeName: string;
}
interface Unmapped {
  id: string;
  connectionId: number;
  connectionName: string;
  deviceUserId: string;
  deviceName: string;
  count: number;
  firstDate: string | null;
  lastDate: string | null;
}
interface Filters {
  connectionId: string;
  status: string;
  deviceUserId: string;
  from: string;
  to: string;
}
const EMPTY: Filters = { connectionId: "", status: "", deviceUserId: "", from: "", to: "" };
const PERM = "attendance.operations.attendance-device-inbox";

export default function AttendanceDeviceInbox() {
  const { hasPermission } = usePermissions();
  const employees = useEmployeeOptions();
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"rows" | "unmapped">("rows");
  const [draft, setDraft] = usePersistedState<Filters>("/attendance-device-inbox:draft", EMPTY);
  const [applied, setApplied] = usePersistedState<Filters>("/attendance-device-inbox:applied", EMPTY);
  const [connections, setConnections] = useState<{ id: number; name: string }[]>([]);
  const [rows, setRows] = useState<InboxRow[]>([]);
  const [unmapped, setUnmapped] = useState<Unmapped[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    api.get("/attendance-device-connections").then((r: any[]) => setConnections(r.map((c) => ({ id: c.id, name: c.name })))).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    const my = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      if (tab === "rows") {
        const p = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
        for (const [k, v] of Object.entries(applied)) if (v) p.set(k, v);
        const r: { rows: InboxRow[]; total: number } = await api.get(`/attendance-device-inbox?${p.toString()}`);
        if (my !== seq.current) return;
        setRows(r.rows);
        setTotal(r.total);
      } else {
        const r: Omit<Unmapped, "id">[] = await api.get(`/attendance-device-inbox/unmapped${applied.connectionId ? `?connectionId=${applied.connectionId}` : ""}`);
        if (my !== seq.current) return;
        setUnmapped(r.map((x) => ({ ...x, id: `${x.connectionId}|${x.deviceUserId}` })));
      }
    } catch (e) {
      if (my === seq.current) setError((e as ApiError).message);
    } finally {
      if (my === seq.current) setLoading(false);
    }
  }, [applied, page, pageSize, tab]);
  useEffect(() => {
    load();
  }, [load]);

  const set = (p: Partial<Filters>) => setDraft({ ...draft, ...p });
  function apply() {
    if (draft.from && draft.to && draft.from > draft.to) return setError("«از تاریخ» نمی‌تواند بعد از «تا تاریخ» باشد");
    setPage(1);
    setApplied(draft);
  }
  function clear() {
    setDraft(EMPTY);
    setPage(1);
    setApplied(EMPTY);
  }

  async function reprocess(ids?: number[]) {
    try {
      const r: { accepted: number; pending: number; rejected: number } = await api.post("/attendance-device-inbox/reprocess", { ids, connectionId: applied.connectionId ? Number(applied.connectionId) : undefined });
      showToast(`پردازش مجدد: ${toFaDigits(String(r.accepted))} پذیرفته، ${toFaDigits(String(r.pending))} در انتظار نگاشت، ${toFaDigits(String(r.rejected))} ردشده`);
      await load();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  async function remove(sel: InboxRow[]) {
    const ids = sel.filter((r) => r.status !== "ACCEPTED").map((r) => r.id);
    if (ids.length === 0) return showError("فقط ثبت‌های «در انتظار نگاشت» و «ردشده» قابل حذف‌اند");
    if (!window.confirm(`${toFaDigits(String(ids.length))} ثبت حذف شود؟`)) return;
    try {
      const r: { deleted: number } = await api.post("/attendance-device-inbox/delete", { ids });
      showToast(`${toFaDigits(String(r.deleted))} ثبت حذف شد`);
      await load();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  // ذخیره‌ی نگاشت ردیف‌های انتخاب‌شده (هر ردیف مستقل؛ ثبت‌های در انتظار همان شناسه در سرور خودکار پردازش می‌شوند)
  async function saveMappings(list: Unmapped[]) {
    const todo = list.filter((r) => picked[r.id]);
    if (todo.length === 0) return showError("برای ردیف‌های انتخاب‌شده کارمند انتخاب کنید");
    setSaving(true);
    let ok = 0;
    let accepted = 0;
    const failed: string[] = [];
    const done: string[] = [];
    for (const r of todo) {
      try {
        const res: { processed?: { accepted: number } } = await api.post("/attendance-device-mappings", { connectionId: r.connectionId, deviceUserId: r.deviceUserId, employeeId: Number(picked[r.id]) }, { silent: true });
        ok++;
        accepted += res.processed?.accepted ?? 0;
        done.push(r.id);
      } catch (e) {
        failed.push(`${r.deviceUserId}: ${(e as ApiError).message}`);
      }
    }
    setPicked((p) => {
      const n = { ...p };
      for (const id of done) delete n[id];
      return n;
    });
    setSaving(false);
    if (ok) showToast(`${toFaDigits(String(ok))} نگاشت ثبت شد؛ ${toFaDigits(String(accepted))} ثبت به تردد تبدیل شد`);
    if (failed.length) showError(failed.slice(0, 3).join("\n") + (failed.length > 3 ? `\n… و ${toFaDigits(String(failed.length - 3))} مورد دیگر` : ""));
    await load();
  }

  const s = <T,>(f: (r: T) => string, extra: object = {}) => ({ render: (r: T) => f(r), filterType: "string" as const, filterValue: (r: T) => f(r), ...extra });
  const canReprocess = hasPermission(`${PERM}.reprocess`);
  const canDelete = hasPermission(`${PERM}.delete`);
  const canMap = hasPermission("attendance.settings.attendance-device-mappings.create");

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint
            title="ثبت‌های دریافتی از دستگاه"
            text="هر ثبتی که «عامل تردد» می‌فرستد اینجا می‌ماند: «پذیرفته‌شده» = تردد ساخته شد، «در انتظار نگاشت» = شناسه‌ی دستگاه به کارمندی وصل نیست (در تب «شناسه‌های نگاشت‌نشده» کارمند را انتخاب و ذخیره کنید؛ ثبت‌ها خودکار پردازش می‌شوند)، «ردشده» = خارج از دوره‌ی همکاری یا ماه قفل‌شده با «محاسبه تردد». پس از رفع علت، «پردازش مجدد» را بزنید."
          />
          {canReprocess && <button type="button" className="btn secondary" onClick={() => reprocess()}>پردازش مجدد همه</button>}
          <RefreshButton onClick={load} />
        </div>
      </div>
      <ErrorToast message={error} />
      <div className="card ar-filters" style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end", marginBottom: 8 }}>
        <label className="form-field">
          <span>اتصال</span>
          <select value={draft.connectionId} onChange={(e) => set({ connectionId: e.target.value })}>
            <option value="">همه</option>
            {connections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        {tab === "rows" && (
          <>
            <label className="form-field">
              <span>وضعیت</span>
              <select value={draft.status} onChange={(e) => set({ status: e.target.value })}>
                <option value="">همه</option>
                <option value="ACCEPTED">پذیرفته‌شده</option>
                <option value="PENDING_MAPPING">در انتظار نگاشت</option>
                <option value="REJECTED">ردشده</option>
              </select>
            </label>
            <label className="form-field">
              <span>از تاریخ</span>
              <JalaliDatePicker value={draft.from} onChange={(v) => set({ from: v })} />
            </label>
            <label className="form-field">
              <span>تا تاریخ</span>
              <JalaliDatePicker value={draft.to} onChange={(v) => set({ to: v })} />
            </label>
            <label className="form-field">
              <span>شناسه‌ی دستگاه</span>
              <input dir="ltr" value={draft.deviceUserId} onChange={(e) => set({ deviceUserId: e.target.value })} onKeyDown={(e) => e.key === "Enter" && apply()} style={{ width: 120 }} />
            </label>
          </>
        )}
        <button type="button" className="btn" onClick={apply}>اعمال فیلتر</button>
        <button type="button" className="btn secondary" onClick={clear}>حذف فیلترها</button>
      </div>

      <div className="tabs" style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        <button type="button" className={`btn ${tab === "rows" ? "" : "secondary"}`} onClick={() => setTab("rows")}>ثبت‌های دریافتی</button>
        <button type="button" className={`btn ${tab === "unmapped" ? "" : "secondary"}`} onClick={() => setTab("unmapped")}>شناسه‌های نگاشت‌نشده</button>
      </div>

      {tab === "rows" ? (
        <DataTable
          columns={[
            { header: "اتصال", ...s<InboxRow>((r) => r.connectionName) },
            { header: "شناسه‌ی دستگاه", ...s<InboxRow>((r) => r.deviceUserId), width: "130px" },
            { header: "تاریخ", ...s<InboxRow>((r) => formatJalaliDate(r.date)), width: "110px" },
            { header: "ساعت", ...s<InboxRow>((r) => toFaDigits(r.time)), width: "80px" },
            { header: "دستگاه", ...s<InboxRow>((r) => r.deviceName) },
            { header: "وضعیت", ...s<InboxRow>((r) => r.statusTitle), width: "130px" },
            { header: "کارمند", ...s<InboxRow>((r) => (r.personnelCode ? `${toFaDigits(r.personnelCode)} — ${r.employeeName}` : "—")) },
            { header: "توضیح", ...s<InboxRow>((r) => r.reason) },
          ]}
          rows={rows}
          bulkActions={[
            ...(canReprocess ? [{ label: (n: number) => `پردازش مجدد (${toFaDigits(String(n))})`, onClick: (sel: InboxRow[]) => reprocess(sel.map((r) => r.id)) }] : []),
            ...(canDelete ? [{ label: (n: number) => `حذف (${toFaDigits(String(n))})`, onClick: remove }] : []),
          ]}
          serverPaging={{ page, pageSize, total, loading, onPageChange: setPage, onPageSizeChange: (n: number) => { setPageSize(n); setPage(1); } }}
        />
      ) : (
        <DataTable
          columns={[
            { header: "اتصال", ...s<Unmapped>((r) => r.connectionName) },
            { header: "شناسه‌ی دستگاه", ...s<Unmapped>((r) => r.deviceUserId), width: "130px" },
            { header: "نام دستگاه", ...s<Unmapped>((r) => r.deviceName) },
            { header: "تعداد ثبت", ...s<Unmapped>((r) => toFaDigits(String(r.count))), width: "100px" },
            { header: "اولین", ...s<Unmapped>((r) => (r.firstDate ? formatJalaliDate(r.firstDate) : "—")), width: "110px" },
            { header: "آخرین", ...s<Unmapped>((r) => (r.lastDate ? formatJalaliDate(r.lastDate) : "—")), width: "110px" },
            ...(canMap
              ? [
                  {
                    header: "کارمند",
                    width: "260px",
                    render: (r: Unmapped) => (
                      <EmployeePickerField employees={employees} value={picked[r.id] ?? ""} onSelect={(emp) => setPicked((p) => ({ ...p, [r.id]: String(emp.id) }))} disabled={saving} />
                    ),
                  },
                  {
                    header: "",
                    width: "90px",
                    render: (r: Unmapped) => (
                      <button type="button" className="btn" disabled={saving || !picked[r.id]} onClick={() => saveMappings([r])}>ذخیره</button>
                    ),
                  },
                ]
              : []),
          ]}
          rows={unmapped}
          bulkActions={canMap ? [{ label: (n: number) => `ذخیره‌ی نگاشت‌های انتخاب‌شده (${toFaDigits(String(n))})`, onClick: (sel: Unmapped[]) => saveMappings(sel) }] : []}
        />
      )}
    </div>
  );
}
