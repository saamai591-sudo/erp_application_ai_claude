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
import { formatAmountFa, toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { api, ApiError } from "../lib/api";
import { FiscalPeriodRange, fetchSelectedFiscalPeriod, defaultDocumentDate, validateDocumentDate } from "../lib/fiscalYearDefaultDate";

type Status = "DRAFT" | "APPROVED";

interface PlanningOption { id: number; number: number; date: string; purchaseGroupTitle: string; allowMultiSupplierPerLine: boolean }

interface QuoteRow { priceInquiryId: number; priceInquiryNumber: number; supplierTitle: string; amount: number; otherCosts: number }
interface ItemLine { priceInquiryItemLineId: number; priceInquiryId: number; supplierTitle: string; goodsItemCode: string; goodsItemTitle: string; quantity: number; amount: number; approved: boolean; description?: string | null }

interface ListRow { id: number; number: number; date: string; purchasePlanningId: number; purchasePlanningNumber: number; description: string | null; status: Status; lineCount: number; approvedCount: number }
interface Detail extends ListRow { quoteRows: QuoteRow[]; itemLines: (ItemLine & { id: number })[] }

const STATUS_FA: Record<Status, string> = { DRAFT: "ثبت", APPROVED: "تایید" };
const INFO_TEXT = "ارزیابی استعلام‌های قیمت تایید‌شده‌ی یک برنامه ریزی خرید با مسیر «استعلام»، جهت تعیین تامین‌کننده‌ی برنده هر ردیف.";

export default function InquiryEvaluations() {
  const location = useLocation();
  const { id } = useParams();
  const isNew = location.pathname.endsWith("/new");
  const isEdit = location.pathname.endsWith("/edit");
  if (isNew) return <InquiryEvaluationForm />;
  if (isEdit) return <InquiryEvaluationForm editId={Number(id)} />;
  return <InquiryEvaluationList />;
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
function LoadIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 4v11m0 0 4-4m-4 4-4-4M5 19h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function InquiryEvaluationList() {
  const cacheKey = "/inquiry-evaluations";
  const [items, setItems] = usePersistedState<ListRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function reload() {
    try {
      setItems(await api.get("/inquiry-evaluations"));
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
      await api.del(`/inquiry-evaluations/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text={INFO_TEXT} title="ارزیابی استعلام" />
          <NewRecordButton path="/inquiry-evaluations/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "شماره", render: (r) => toFaDigits(String(r.number)), width: "70px", filterType: "number", filterValue: (r) => r.number },
          { header: "تاریخ", render: (r) => formatJalaliDate(r.date), filterType: "date", filterValue: (r) => r.date.slice(0, 10) },
          { header: "برنامه ریزی خرید", render: (r) => toFaDigits(String(r.purchasePlanningNumber)), filterType: "string", filterValue: (r) => String(r.purchasePlanningNumber) },
          { header: "ردیف‌های تایید‌شده", render: (r) => `${toFaDigits(String(r.approvedCount))} از ${toFaDigits(String(r.lineCount))}` },
          { header: "وضعیت", render: (r) => <span className="badge">{STATUS_FA[r.status]}</span>, filterType: "string", filterValue: (r) => STATUS_FA[r.status] },
        ]}
        rows={items}
        edit={{ path: (r) => `/inquiry-evaluations/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

function InquiryEvaluationForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}`;
  const [plannings, setPlannings] = useState<PlanningOption[]>([]);
  const [header, setHeader] = usePersistedState(`${cacheKey}:header`, { date: "", purchasePlanningId: "", description: "" });
  const [quoteRows, setQuoteRows] = usePersistedState<QuoteRow[]>(`${cacheKey}:quotes`, []);
  const [itemLines, setItemLines] = usePersistedState<ItemLine[]>(`${cacheKey}:items`, []);
  const [meta, setMeta] = usePersistedState<{ number: number; status: Status } | null>(`${cacheKey}:meta`, null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [fiscalPeriod, setFiscalPeriod] = useState<FiscalPeriodRange | null>(null);
  const { flash } = useSavedFlash();

  useEffect(() => {
    async function init() {
      const [pl, fp] = await Promise.all([api.get("/purchase-plannings/pickable?purpose=inquiry-evaluation"), fetchSelectedFiscalPeriod()]);
      setPlannings(pl);
      setFiscalPeriod(fp);

      if (hasPersistedState(`${cacheKey}:header`)) {
        setLoaded(true);
        return;
      }
      if (editId) {
        const d: Detail = await api.get(`/inquiry-evaluations/${editId}`);
        setMeta({ number: d.number, status: d.status });
        setHeader({ date: d.date.slice(0, 10), purchasePlanningId: String(d.purchasePlanningId), description: d.description || "" });
        setQuoteRows(d.quoteRows);
        setItemLines(d.itemLines);
      } else {
        setHeader({ date: defaultDocumentDate(fp), purchasePlanningId: "", description: "" });
        setQuoteRows([]);
        setItemLines([]);
        setMeta(null);
      }
      setLoaded(true);
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  const status: Status = meta?.status || "DRAFT";
  const locked = status !== "DRAFT";
  const isDataLoaded = itemLines.length > 0;
  const selectedPlanning = plannings.find((p) => String(p.id) === header.purchasePlanningId);
  const allowMulti = selectedPlanning?.allowMultiSupplierPerLine ?? true;

  async function loadData() {
    if (!header.purchasePlanningId) return showError("ابتدا برنامه ریزی خرید را انتخاب کنید");
    try {
      const preview: { quoteRows: QuoteRow[]; itemLines: Omit<ItemLine, "approved">[] } = await api.get(`/inquiry-evaluations/preview?purchasePlanningId=${header.purchasePlanningId}`);
      if (preview.itemLines.length === 0) return showError("هیچ استعلام قیمت تایید‌شده‌ای برای این برنامه ریزی خرید یافت نشد");
      setQuoteRows(preview.quoteRows);
      setItemLines(preview.itemLines.map((l) => ({ ...l, approved: false })));
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  function approveQuote(priceInquiryId: number) {
    setItemLines((prev) =>
      prev.map((l) => {
        if (!allowMulti && l.priceInquiryId !== priceInquiryId) return { ...l, approved: false };
        if (l.priceInquiryId === priceInquiryId) return { ...l, approved: true };
        return l;
      })
    );
  }
  function toggleLine(idx: number) {
    if (!allowMulti) return; // طبق مستند: اگر مجاز نباشد، تیک تکی غیرفعال است — فقط از دکمه «تایید استعلام قیمت» استفاده می‌شود
    setItemLines((prev) => prev.map((l, i) => (i === idx ? { ...l, approved: !l.approved } : l)));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!header.date || !header.purchasePlanningId) return setError("تاریخ و برنامه ریزی خرید الزامی است");
    const dateErr = validateDocumentDate(header.date, fiscalPeriod);
    if (dateErr) return setError(dateErr);
    if (itemLines.length === 0) return setError("ابتدا دکمه «لود اطلاعات» را بزنید");
    const itemApprovals: Record<string, { approved: boolean; description?: string | null }> = {};
    for (const l of itemLines) itemApprovals[String(l.priceInquiryItemLineId)] = { approved: l.approved, description: l.description || null };
    const body = { date: header.date, purchasePlanningId: Number(header.purchasePlanningId), description: header.description, itemApprovals };
    try {
      if (editId) {
        await api.put(`/inquiry-evaluations/${editId}`, body);
        flash();
      } else {
        const created = await api.post("/inquiry-evaluations", body);
        flash();
        navigate(`/inquiry-evaluations/${created.id}/edit`);
      }
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/inquiry-evaluations/${editId}`);
      navigate("/inquiry-evaluations");
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  async function runAction(path: string) {
    if (!editId) return;
    try {
      await api.post(`/inquiry-evaluations/${editId}/${path}`, {});
      const d: Detail = await api.get(`/inquiry-evaluations/${editId}`);
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
    else extraActions.push({ label: "برگشت از تایید", icon: <UndoIcon />, onClick: () => runAction("unapprove") });
  }

  return (
    <FormPage
      title={editId ? "ویرایش ارزیابی استعلام" : "ارزیابی استعلام جدید"}
      formId="inquiry-evaluation-form"
      closePath="/inquiry-evaluations"
      newPath="/inquiry-evaluations/new"
      onDelete={editId && status === "DRAFT" ? handleDelete : undefined}
      saveDisabled={locked}
      extraActions={extraActions}
      wide
    >
      <form id="inquiry-evaluation-form" onSubmit={onSubmit}>
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
                disabled={isDataLoaded}
                displayValue={selectedPlanning ? `${toFaDigits(String(selectedPlanning.number))} — ${selectedPlanning.purchaseGroupTitle}` : ""}
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
          {!isDataLoaded && (
            <button type="button" className="btn" onClick={loadData} style={{ marginTop: 8, marginBottom: 12 }}>
              <LoadIcon /> لود اطلاعات
            </button>
          )}
        </fieldset>

        {isDataLoaded && (
          <>
            <div className="je-lines-toolbar">
              <span className="je-lines-title">تب استعلام قیمت</span>
            </div>
            <div className="grid-wrap je-lines-wrap">
              <div className="je-lines-scroll grid-scroll-area" style={{ overflowX: "auto", overflowY: "auto" }}>
                <table className="je-lines-table">
                  <thead>
                    <tr>
                      <th>ردیف</th>
                      <th>استعلام قیمت</th>
                      <th>تامین کننده</th>
                      <th>مبلغ</th>
                      <th>هزینه‌های جانبی</th>
                      <th>مبلغ کل</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {quoteRows.map((q, idx) => (
                      <tr key={q.priceInquiryId}>
                        <td style={{ textAlign: "center", color: "var(--ink-soft)", fontWeight: 600 }}>{toFaDigits(String(idx + 1))}</td>
                        <td>{toFaDigits(String(q.priceInquiryNumber))}</td>
                        <td>{q.supplierTitle}</td>
                        <td>{formatAmountFa(q.amount)}</td>
                        <td>{formatAmountFa(q.otherCosts)}</td>
                        <td style={{ fontWeight: 600 }}>{formatAmountFa(q.amount + q.otherCosts)}</td>
                        <td>
                          <button type="button" className="btn" style={{ padding: "5px 8px", fontSize: 11 }} disabled={locked} onClick={() => approveQuote(q.priceInquiryId)}>
                            تایید استعلام قیمت
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="je-lines-toolbar" style={{ marginTop: 16 }}>
              <span className="je-lines-title">تب اقلام</span>
            </div>
            <div className="grid-wrap je-lines-wrap">
              <div className="je-lines-scroll grid-scroll-area" style={{ overflowX: "auto", overflowY: "auto" }}>
                <table className="je-lines-table">
                  <thead>
                    <tr>
                      <th>ردیف</th>
                      <th>شماره استعلام قیمت</th>
                      <th>تامین کننده</th>
                      <th>کالا</th>
                      <th>مقدار</th>
                      <th>مبلغ</th>
                      <th>تایید</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itemLines.map((l, idx) => (
                      <tr key={l.priceInquiryItemLineId} style={{ background: l.approved ? "rgba(34,197,94,0.08)" : undefined }}>
                        <td style={{ textAlign: "center", color: "var(--ink-soft)", fontWeight: 600 }}>{toFaDigits(String(idx + 1))}</td>
                        <td>{toFaDigits(String(l.priceInquiryId))}</td>
                        <td>{l.supplierTitle}</td>
                        <td>{toFaDigits(l.goodsItemCode)} — {l.goodsItemTitle}</td>
                        <td>{formatAmountFa(l.quantity)}</td>
                        <td>{formatAmountFa(l.amount)}</td>
                        <td style={{ textAlign: "center" }}>
                          <input type="checkbox" checked={l.approved} disabled={locked || !allowMulti} onChange={() => toggleLine(idx)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="grid-footer je-lines-footer">
                <span className="grid-footer-info">{toFaDigits(String(itemLines.filter((l) => l.approved).length))} از {toFaDigits(String(itemLines.length))} ردیف تایید‌شده</span>
              </div>
            </div>
          </>
        )}
      </form>
    </FormPage>
  );
}
