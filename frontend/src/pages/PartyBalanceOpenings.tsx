import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { DataTable } from "../components/DataTable";
import { ErrorToast } from "../components/ErrorToast";
import { FormPage } from "../components/FormPage";
import { InfoHint } from "../components/InfoHint";
import { NewRecordButton } from "../components/NewRecordButton";
import { RefreshButton } from "../components/RefreshButton";
import { RecordPickerField } from "../components/RecordPicker";
import { RequiredMark } from "../components/RequiredMark";
import { AmountInput } from "../components/AmountInput";
import { ExcelImportButton } from "../components/ExcelImport";
import { api, ApiError } from "../lib/api";
import { showError } from "../lib/toast";
import { toFaDigits, formatAmountFa } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { usePermissions } from "../lib/usePermissions";
import { useSavedFlash } from "../lib/useSavedFlash";

// «مانده اول دوره مشتریان» (فروش › تنظیمات) و «مانده اول دوره تامین‌کنندگان» (زنجیره تامین › تنظیمات) = فرم داده‌ای: هر مانده یک رکورد
// (طرف‌حساب × ارز × مبلغ × نوع مانده) در سال مالی انتخاب‌شده‌ی کاربر، به ارز خودش (بدون معادل ارز پایه)، با «ورود از اکسل» در فهرست.
// ثبت دستی فقط برای استقرار اولیه است؛ بعد از آن «بستن سال» (فرم جدا در عملیات دوره‌ای) مانده‌ی پایان سال را خودکار به سال بعد می‌برد.
// منطق و قواعد: backend/src/services/partyBalanceService.ts و partyBalanceOpeningService.ts.

type Role = "CUSTOMER" | "SUPPLIER";
interface Row { id: number; partyId: number; partyCode: number | null; partyTitle: string; currencyId: number; currencyTitle: string; amount: number; nature: "DEBIT" | "CREDIT"; description: string | null; isSystemGenerated: boolean }
interface PartyOption { id: number; code: number; title: string; isActive: boolean }
interface CurrencyOption { id: number; code: string; title: string; isBase: boolean }
interface Status { roleTitle: string; current: { id: number; title: string; fromDate: string; toDate: string }; readOnly: boolean; readOnlyReason: string | null; closedAt: string | null }

const CONFIG: Record<Role, { slug: string; form: string; noun: string; path: string; debitHint: string; creditHint: string; title: string }> = {
  CUSTOMER: { slug: "customers", form: "sales.config.customer-balance-openings", noun: "مشتری", path: "/customer-balance-openings", title: "مانده اول دوره مشتریان", debitHint: "مشتری به ما بدهکار است", creditHint: "ما به مشتری بدهکاریم (مثلاً پیش‌دریافت)" },
  SUPPLIER: { slug: "suppliers", form: "supply-chain.config.supplier-balance-openings", noun: "تامین‌کننده", path: "/supplier-balance-openings", title: "مانده اول دوره تامین‌کنندگان", debitHint: "تامین‌کننده به ما بدهکار است (مثلاً پیش‌پرداخت)", creditHint: "ما به تامین‌کننده بدهکاریم" },
};
const NATURE_FA = { DEBIT: "بدهکار", CREDIT: "بستانکار" } as const;

export default function PartyBalanceOpenings({ role }: { role: Role }) {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <OpeningForm role={role} />;
  if (location.pathname.endsWith("/edit")) return <OpeningForm role={role} editId={Number(id)} />;
  return <OpeningList role={role} />;
}

function OpeningList({ role }: { role: Role }) {
  const cfg = CONFIG[role];
  const base = `/party-balance-openings/${cfg.slug}`;
  const { hasPermission } = usePermissions();
  const [items, setItems] = usePersistedState<Row[]>(cfg.path, []);
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    try {
      const [rows, st] = await Promise.all([api.get(base), api.get(`${base}/status`)]);
      setItems(rows);
      setStatus(st);
      setError(null);
    } catch (e) {
      setError((e as ApiError).message);
    }
  }
  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onDelete(row: Row) {
    try {
      await api.del(`${base}/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  const canCreate = hasPermission(`${cfg.form}.create`);
  const locked = !!status?.readOnly;
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint
            title={cfg.title}
            text={`مانده‌ی هر ${cfg.noun} در شروع سال مالی انتخاب‌شده، به ارز خودش (بدون معادل ارز پایه). «بدهکار»: ${cfg.debitHint}؛ «بستانکار»: ${cfg.creditHint}. ثبت دستی فقط برای استقرار اولیه است (فقط برای یک سال)؛ بعد از آن «بستن سال» (عملیات دوره‌ای) مانده‌ی پایان سال را خودکار به سال بعد می‌برد و ردیف‌های ساخته‌شده فقط‌خواندنی‌اند. با بستن سال، اسنادی که روی مانده اثر دارند در همان سال قفل می‌شوند.`}
          />
          {canCreate && !locked && <NewRecordButton path={`${cfg.path}/new`} />}
          <RefreshButton onClick={reload} />
          {canCreate && !locked && (
            <ExcelImportButton
              entityLabel={cfg.title}
              templateFilename={`قالب-${cfg.title.replace(/\s+/g, "-")}`}
              backendEntityType={role === "CUSTOMER" ? "party-balance-opening-customer" : "party-balance-opening-supplier"}
              columns={[
                { key: "partyCode", label: `کد ${cfg.noun}`, required: true, hint: `کد ${cfg.noun} (ستون «کد» در فهرست ${cfg.noun}‌ها)` },
                { key: "currencyCode", label: "کد ارز", hint: "کد ارز (مثل IRR)؛ خالی = ارز پایه" },
                { key: "amount", label: "مبلغ", required: true, hint: "عدد مثبت؛ جهت مانده با ستون «نوع مانده» مشخص می‌شود" },
                { key: "nature", label: "نوع مانده", required: true, hint: `«بدهکار» (${cfg.debitHint}) یا «بستانکار» (${cfg.creditHint})` },
                { key: "description", label: "شرح" },
              ]}
              onDone={reload}
            />
          )}
        </div>
      </div>
      <ErrorToast message={error} />
      {status && (
        <div className="card" style={{ padding: "8px 16px", marginBottom: 8, fontSize: 13.5, display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div><b>سال مالی:</b> {toFaDigits(status.current.title)} ({formatJalaliDate(status.current.fromDate)} تا {formatJalaliDate(status.current.toDate)})</div>
          {status.closedAt && <div><span className="badge">بسته شد — {formatJalaliDate(status.closedAt)}</span></div>}
          {status.readOnlyReason && <div style={{ color: "var(--muted, #888)" }}>{status.readOnlyReason}</div>}
        </div>
      )}
      <DataTable<Row>
        columns={[
          { header: "کد", render: (r) => (r.partyCode === null ? "" : toFaDigits(String(r.partyCode))), width: "90px", filterType: "string", filterValue: (r) => String(r.partyCode ?? "") },
          { header: cfg.noun, render: (r) => r.partyTitle, filterType: "string", filterValue: (r) => r.partyTitle },
          { header: "ارز", fxOnly: true, render: (r) => r.currencyTitle, width: "110px", filterType: "string", filterValue: (r) => r.currencyTitle },
          { header: "مبلغ", render: (r) => formatAmountFa(r.amount), width: "160px", filterType: "number", filterValue: (r) => r.amount },
          { header: "نوع مانده", render: (r) => NATURE_FA[r.nature], width: "100px", filterType: "string", filterValue: (r) => NATURE_FA[r.nature] },
          { header: "شرح", render: (r) => r.description || "", filterType: "string", filterValue: (r) => r.description || "" },
          { header: "منبع", render: (r) => (r.isSystemGenerated ? "بستن سال" : "دستی"), width: "90px", filterType: "string", filterValue: (r) => (r.isSystemGenerated ? "بستن سال" : "دستی") },
        ]}
        rows={items}
        edit={{ path: (r) => `${cfg.path}/${r.id}/edit` }}
        onDelete={locked || !hasPermission(`${cfg.form}.delete`) ? undefined : onDelete}
        emptyText="مانده‌ی اول دوره‌ای برای این سال ثبت نشده است"
      />
    </div>
  );
}

const DEFAULT_FORM = { partyId: "", currencyId: "", amount: "", nature: "DEBIT", description: "" };

function OpeningForm({ role, editId }: { role: Role; editId?: number }) {
  const cfg = CONFIG[role];
  const base = `/party-balance-openings/${cfg.slug}`;
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const { flash } = useSavedFlash();
  const [parties, setParties] = useState<PartyOption[]>([]);
  const [currencies, setCurrencies] = useState<CurrencyOption[]>([]);
  const [status, setStatus] = useState<Status | null>(null);
  const [form, setForm] = usePersistedState(cacheKey, DEFAULT_FORM);
  const [system, setSystem] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));

  useEffect(() => {
    api.get(`${base}/parties`).then(setParties).catch(() => {});
    api.get(`${base}/status`).then(setStatus).catch((e) => setError(e.message));
    api.get("/currencies").then((cs: CurrencyOption[]) => {
      setCurrencies(cs);
      // ارز پیش‌فرض یک رکورد جدید = ارز پایه (فقط وقتی کاربر هنوز چیزی انتخاب نکرده)
      if (!editId) setForm((f) => (f.currencyId ? f : { ...f, currencyId: String(cs.find((c) => c.isBase)?.id ?? "") }));
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!editId) {
      if (!hasPersistedState(cacheKey)) setForm(DEFAULT_FORM);
      return;
    }
    if (hasPersistedState(cacheKey)) return;
    api
      .get(`${base}/${editId}`)
      .then((r: Row) => {
        setSystem(r.isSystemGenerated);
        setForm({ partyId: String(r.partyId), currencyId: String(r.currencyId), amount: String(r.amount), nature: r.nature, description: r.description || "" });
        setLoaded(true);
      })
      .catch((e) => {
        setError(e.message);
        setLoaded(true);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  const readOnly = !!status?.readOnly || system;
  const selectedParty = parties.find((p) => String(p.id) === form.partyId);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.partyId) return setError(`${cfg.noun} الزامی است`);
    if (!form.currencyId) return setError("ارز الزامی است");
    if (!form.amount) return setError("مبلغ الزامی است");
    const body = { partyId: Number(form.partyId), currencyId: Number(form.currencyId), amount: form.amount, nature: form.nature, description: form.description };
    try {
      if (editId) {
        await api.put(`${base}/${editId}`, body);
        flash();
      } else {
        const created: { id: number } = await api.post(base, body);
        flash();
        navigate(`${cfg.path}/${created.id}/edit`);
      }
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`${base}/${editId}`);
      navigate(cfg.path);
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  if (!loaded) return null;

  return (
    <FormPage
      title={editId ? `ویرایش ${cfg.title}` : `${cfg.title} — رکورد جدید`}
      formId="party-balance-opening-form"
      closePath={cfg.path}
      newPath={`${cfg.path}/new`}
      onDelete={editId && !readOnly ? handleDelete : undefined}
      saveDisabled={readOnly}
    >
      <form id="party-balance-opening-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        {status?.readOnlyReason && <div className="form-note" style={{ marginBottom: 12 }}>{status.readOnlyReason}</div>}
        {system && <div className="form-note" style={{ marginBottom: 12 }}>این رکورد را «بستن سال» ساخته و فقط‌خواندنی است.</div>}
        <fieldset disabled={readOnly} style={{ border: 0, padding: 0, margin: 0 }}>
          <div className="form-grid">
            <div className="form-field">
              <label>سال مالی</label>
              <input disabled value={status ? toFaDigits(status.current.title) : ""} />
            </div>
            <div className="form-field">
              <label>{cfg.noun}<RequiredMark /></label>
              <RecordPickerField
                title={`انتخاب ${cfg.noun}`}
                disabled={readOnly}
                displayValue={selectedParty ? `${toFaDigits(String(selectedParty.code))} — ${selectedParty.title}` : ""}
                rows={parties.filter((p) => p.isActive || String(p.id) === form.partyId)}
                columns={[
                  { header: "کد", render: (p) => toFaDigits(String(p.code)), filterValue: (p) => String(p.code), width: "90px" },
                  { header: "عنوان", render: (p) => p.title, filterValue: (p) => p.title },
                ]}
                onSelect={(p) => setForm({ ...form, partyId: String(p.id) })}
              />
            </div>
            <div className="form-field fx-only">
              <label>ارز<RequiredMark /></label>
              <select value={form.currencyId} onChange={(e) => setForm({ ...form, currencyId: e.target.value })}>
                <option value="">انتخاب کنید</option>
                {currencies.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label>مبلغ<RequiredMark /></label>
              <AmountInput value={form.amount} allowDecimal onChange={(v) => setForm({ ...form, amount: v })} />
            </div>
            <div className="form-field">
              <label>نوع مانده<RequiredMark /></label>
              <select value={form.nature} onChange={(e) => setForm({ ...form, nature: e.target.value })}>
                <option value="DEBIT">بدهکار — {cfg.debitHint}</option>
                <option value="CREDIT">بستانکار — {cfg.creditHint}</option>
              </select>
            </div>
            <div className="form-field">
              <label>شرح</label>
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>
        </fieldset>
      </form>
    </FormPage>
  );
}
