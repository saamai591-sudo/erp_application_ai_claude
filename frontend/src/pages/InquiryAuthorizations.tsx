import { FormEvent, useEffect, useState } from "react";
import { ErrorToast } from "../components/ErrorToast";
import { showError } from "../lib/toast";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { RecordPickerField } from "../components/RecordPicker";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { InfoHint } from "../components/InfoHint";
import { RequiredMark } from "../components/RequiredMark";
import { toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { api, ApiError } from "../lib/api";
import { FiscalPeriodRange, fetchSelectedFiscalPeriod, defaultDocumentDate, validateDocumentDate } from "../lib/fiscalYearDefaultDate";

type Status = "DRAFT" | "APPROVED";

interface PlanningOption { id: number; number: number; date: string; purchaseGroupTitle: string; routeNature: string | null }
interface SupplierOption { id: number; code: number; party: { category: "INDIVIDUAL" | "LEGAL"; firstName: string | null; lastName: string | null; name: string | null } }

function supplierTitle(s: SupplierOption): string {
  return s.party.category === "LEGAL" ? s.party.name || "" : `${s.party.firstName || ""} ${s.party.lastName || ""}`.trim();
}

interface ListRow { id: number; number: number; date: string; purchasePlanningId: number; purchasePlanningNumber: number; description: string | null; status: Status; lineCount: number }
interface Detail extends ListRow {
  lines: { id: number; supplierId: number; supplierCode: number; supplierTitle: string; description: string | null }[];
}

const STATUS_FA: Record<Status, string> = { DRAFT: "ثبت", APPROVED: "تایید" };
const INFO_TEXT = "تعیین اینکه برای یک برنامه ریزی خرید با مسیر تامین «استعلام»، از چه تامین‌کننده‌هایی استعلام قیمت گرفته شود.";

export default function InquiryAuthorizations() {
  const location = useLocation();
  const { id } = useParams();
  const isNew = location.pathname.endsWith("/new");
  const isEdit = location.pathname.endsWith("/edit");
  if (isNew) return <InquiryAuthorizationForm />;
  if (isEdit) return <InquiryAuthorizationForm editId={Number(id)} />;
  return <InquiryAuthorizationList />;
}

function CheckIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4.5 4.5L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function UndoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M7 8H4V5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.5 8A8 8 0 1 1 4 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function PlusIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>;
}

function InquiryAuthorizationList() {
  const cacheKey = "/inquiry-authorizations";
  const [items, setItems] = usePersistedState<ListRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function reload() {
    try {
      setItems(await api.get("/inquiry-authorizations"));
      setError(null);
    } catch (e) {
      setError((e as ApiError).message);
    }
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onDelete(row: ListRow) {
    try {
      await api.del(`/inquiry-authorizations/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text={INFO_TEXT} title="مجوز استعلام" />
          <NewRecordButton path="/inquiry-authorizations/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "شماره", render: (r) => toFaDigits(String(r.number)), width: "70px", filterType: "number", filterValue: (r) => r.number },
          { header: "تاریخ", render: (r) => formatJalaliDate(r.date), filterType: "date", filterValue: (r) => r.date.slice(0, 10) },
          { header: "برنامه ریزی خرید", render: (r) => toFaDigits(String(r.purchasePlanningNumber)), filterType: "string", filterValue: (r) => String(r.purchasePlanningNumber) },
          { header: "تعداد تامین‌کننده", render: (r) => toFaDigits(String(r.lineCount)) },
          { header: "وضعیت", render: (r) => <span className="badge">{STATUS_FA[r.status]}</span>, filterType: "string", filterValue: (r) => STATUS_FA[r.status] },
        ]}
        rows={items}
        edit={{ path: (r) => `/inquiry-authorizations/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

interface RowState { supplierId: string; description: string }

function InquiryAuthorizationForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}`;
  const [plannings, setPlannings] = useState<PlanningOption[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [header, setHeader] = usePersistedState(`${cacheKey}:header`, { date: "", purchasePlanningId: "", description: "" });
  const [rows, setRows] = usePersistedState<RowState[]>(`${cacheKey}:rows`, [{ supplierId: "", description: "" }]);
  const [meta, setMeta] = usePersistedState<{ number: number; status: Status } | null>(`${cacheKey}:meta`, null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [fiscalPeriod, setFiscalPeriod] = useState<FiscalPeriodRange | null>(null);
  const { flash } = useSavedFlash();

  useEffect(() => {
    async function init() {
      const [p, s, fp] = await Promise.all([api.get("/purchase-plannings/pickable?purpose=inquiry-authorization"), api.get("/suppliers"), fetchSelectedFiscalPeriod()]);
      setPlannings(p);
      setSuppliers((s as any[]).filter((x) => x.isActive));
      setFiscalPeriod(fp);

      if (hasPersistedState(`${cacheKey}:header`)) {
        setLoaded(true);
        return;
      }
      if (editId) {
        const d: Detail = await api.get(`/inquiry-authorizations/${editId}`);
        setMeta({ number: d.number, status: d.status });
        setHeader({ date: d.date.slice(0, 10), purchasePlanningId: String(d.purchasePlanningId), description: d.description || "" });
        setRows(d.lines.map((l) => ({ supplierId: String(l.supplierId), description: l.description || "" })));
      } else {
        setHeader({ date: defaultDocumentDate(fp), purchasePlanningId: "", description: "" });
        setRows([{ supplierId: "", description: "" }]);
        setMeta(null);
      }
      setLoaded(true);
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  const status: Status = meta?.status || "DRAFT";
  const locked = status !== "DRAFT";

  function updateRow(idx: number, patch: Partial<RowState>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }
  function addRow() {
    setRows((prev) => [...prev, { supplierId: "", description: "" }]);
  }
  function removeRow(idx: number) {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!header.date) return setError("تاریخ الزامی است");
    const dateErr = validateDocumentDate(header.date, fiscalPeriod);
    if (dateErr) return setError(dateErr);
    if (!header.purchasePlanningId) return setError("برنامه ریزی خرید الزامی است");
    const lines = rows.filter((r) => r.supplierId).map((r) => ({ supplierId: Number(r.supplierId), description: r.description || null }));
    if (lines.length === 0) return setError("حداقل یک تامین کننده باید انتخاب شود");
    const body = { date: header.date, purchasePlanningId: Number(header.purchasePlanningId), description: header.description, lines };
    try {
      if (editId) {
        await api.put(`/inquiry-authorizations/${editId}`, body);
        flash();
      } else {
        const created = await api.post("/inquiry-authorizations", body);
        flash();
        navigate(`/inquiry-authorizations/${created.id}/edit`);
      }
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/inquiry-authorizations/${editId}`);
      navigate("/inquiry-authorizations");
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  async function runAction(path: string, confirmMsg?: string) {
    if (!editId) return;
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    try {
      await api.post(`/inquiry-authorizations/${editId}/${path}`, {});
      const d: Detail = await api.get(`/inquiry-authorizations/${editId}`);
      setMeta({ number: d.number, status: d.status });
      flash();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  if (!loaded) return null;

  const extraActions: { label: string; icon: JSX.Element; onClick: () => void }[] = [];
  if (editId && meta) {
    if (status === "DRAFT") extraActions.push({ label: "تایید", icon: <CheckIcon />, onClick: () => runAction("approve") });
    else if (status === "APPROVED") extraActions.push({ label: "برگشت از تایید", icon: <UndoIcon />, onClick: () => runAction("unapprove") });
  }

  return (
    <FormPage
      title={editId ? "ویرایش مجوز استعلام" : "مجوز استعلام جدید"}
      formId="inquiry-authorization-form"
      closePath="/inquiry-authorizations"
      newPath="/inquiry-authorizations/new"
      onDelete={editId && status === "DRAFT" ? handleDelete : undefined}
      saveDisabled={locked}
      extraActions={extraActions}
    >
      <form id="inquiry-authorization-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        <fieldset disabled={locked} style={{ border: 0, padding: 0, margin: 0 }}>
          <div className="form-grid">
            <div className="form-field">
              <label>شماره</label>
              <input dir="ltr" value={meta ? toFaDigits(String(meta.number)) : "خودکار پس از ذخیره"} disabled />
            </div>
            <div className="form-field">
              <label>وضعیت</label>
              <div><span className="badge">{STATUS_FA[status]}</span></div>
            </div>
            <div className="form-field">
              <label>تاریخ<RequiredMark /></label>
              <JalaliDatePicker value={header.date} onChange={(v) => setHeader({ ...header, date: v })} />
            </div>
            <div className="form-field">
              <label>برنامه ریزی خرید<RequiredMark /></label>
              <RecordPickerField
                title="انتخاب برنامه ریزی خرید"
                disabled={locked || !!editId}
                displayValue={(() => {
                  const p = plannings.find((x) => String(x.id) === header.purchasePlanningId);
                  return p ? `${toFaDigits(String(p.number))} — ${p.purchaseGroupTitle}` : header.purchasePlanningId ? toFaDigits(header.purchasePlanningId) : "";
                })()}
                rows={plannings}
                columns={[
                  { header: "شماره", render: (p) => toFaDigits(String(p.number)), filterValue: (p) => String(p.number), width: "80px" },
                  { header: "گروه خرید", render: (p) => p.purchaseGroupTitle, filterValue: (p) => p.purchaseGroupTitle },
                ]}
                onSelect={(p) => setHeader({ ...header, purchasePlanningId: String(p.id) })}
              />
            </div>
            <div className="form-field full">
              <label>شرح</label>
              <input value={header.description} onChange={(e) => setHeader({ ...header, description: e.target.value })} />
            </div>
          </div>

          <div className="je-lines-toolbar" style={{ marginTop: 16 }}>
            <span className="je-lines-title">تامین‌کنندگان</span>
            <button type="button" className="toolbar-icon-btn primary" onClick={addRow} title="ردیف جدید">
              <PlusIcon />
            </button>
          </div>
        </fieldset>
        <div className="grid-wrap je-lines-wrap">
          <div className="je-lines-scroll grid-scroll-area" style={{ overflowX: "auto", overflowY: "auto" }}>
            <table className="je-lines-table">
              <thead>
                <tr>
                  <th>ردیف</th>
                  <th>تامین کننده</th>
                  <th>شرح</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => {
                  const s = suppliers.find((x) => String(x.id) === row.supplierId);
                  return (
                    <tr key={idx}>
                      <td style={{ textAlign: "center", color: "var(--ink-soft)", fontWeight: 600 }}>{toFaDigits(String(idx + 1))}</td>
                      <td style={{ minWidth: 220 }}>
                        <RecordPickerField
                          title="انتخاب تامین کننده"
                          disabled={locked}
                          displayValue={s ? `${toFaDigits(String(s.code))} — ${supplierTitle(s)}` : ""}
                          rows={suppliers}
                          columns={[
                            { header: "کد", render: (x) => toFaDigits(String(x.code)), filterValue: (x) => String(x.code), width: "80px" },
                            { header: "عنوان", render: (x) => supplierTitle(x), filterValue: (x) => supplierTitle(x) },
                          ]}
                          onSelect={(x) => updateRow(idx, { supplierId: String(x.id) })}
                        />
                      </td>
                      <td style={{ minWidth: 160 }}>
                        <input value={row.description} onChange={(e) => updateRow(idx, { description: e.target.value })} disabled={locked} />
                      </td>
                      <td>
                        <button type="button" className="btn danger" style={{ padding: "5px 8px", fontSize: 11 }} onClick={() => removeRow(idx)} disabled={locked}>
                          حذف
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="grid-footer je-lines-footer">
            <span className="grid-footer-info">{rows.length === 0 ? "بدون ردیف" : `${toFaDigits(String(rows.length))} ردیف`}</span>
          </div>
        </div>
      </form>
    </FormPage>
  );
}
