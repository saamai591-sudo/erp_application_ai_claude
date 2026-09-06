import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { AmountInput } from "../components/AmountInput";
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

type Status = "DRAFT" | "APPROVED" | "CLOSED";

interface PurchaseGroupOption { id: number; code: number; title: string; isActive: boolean }
interface PurchaseExpertOption { id: number; code: number; party: { firstName: string | null; lastName: string | null }; isActive: boolean; groupIds: number[] }
interface PurchaseRouteOption { id: number; code: number; title: string; nature: string; isActive: boolean }
interface PickableRequestLine { id: number; purchaseRequestLineId: number; purchaseRequestId: number; number: number; date: string; goodsItemId: number; goodsItemCode: string; goodsItemTitle: string; unitId: number; unitTitle: string; quantity: number; done: number; remaining: number }

interface ListRow { id: number; number: number; date: string; neededDate: string | null; purchaseGroupId: number; purchaseGroupTitle: string; status: Status; description: string | null; lineCount: number }
interface Stage1RowDetail { id: number; purchaseRequestLineId: number; purchaseRequestNumber: number; goodsItemId: number; goodsItemCode: string; goodsItemTitle: string; unitId: number; unitTitle: string; quantity: number; description: string | null }
interface Stage2RowDetail { id: number; goodsItemId: number; goodsItemCode: string; goodsItemTitle: string; unitId: number; unitTitle: string; quantity: number; estimatedAmount: number; description: string | null }
interface Detail extends ListRow {
  purchaseExpertId: number | null; purchaseExpertTitle: string | null; purchaseRouteId: number | null; purchaseRouteTitle: string | null; allowMultiSupplierPerLine: boolean;
  stage1Rows: Stage1RowDetail[]; stage2Rows: Stage2RowDetail[];
}

const STATUS_FA: Record<Status, string> = { DRAFT: "ثبت", APPROVED: "تایید", CLOSED: "پایان" };
const INFO_TEXT =
  "تجمیع ردیف‌های تایید‌شده‌ی درخواست خرید (که کالای تکراری در آن‌ها ممکن است چند بار آمده باشد) در یک برنامه خرید واحد، و تعیین کارشناس خرید و مسیر تامین آن. " +
  "این فرم سه مرحله دارد: انتخاب ردیف‌های درخواست خرید، مشاهده‌ی تجمیع خودکار به تفکیک کالا، و تعیین کارشناس/مسیر تامین. ذخیره‌سازی صرفا در پایان مرحله سوم انجام می‌شود.";

export default function PurchasePlannings() {
  const location = useLocation();
  const { id } = useParams();
  const isNew = location.pathname.endsWith("/new");
  const isEdit = location.pathname.endsWith("/edit");
  if (isNew) return <PurchasePlanningForm />;
  if (isEdit) return <PurchasePlanningForm editId={Number(id)} />;
  return <PurchasePlanningList />;
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
function CloseFlagIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M6 21V4M6 4h12l-3 4 3 4H6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function PlusIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>;
}

function PurchasePlanningList() {
  const cacheKey = "/purchase-plannings";
  const [items, setItems] = usePersistedState<ListRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function reload() {
    try {
      setItems(await api.get("/purchase-plannings"));
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
      await api.del(`/purchase-plannings/${row.id}`);
      await reload();
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text={INFO_TEXT} title="برنامه ریزی خرید" />
          <NewRecordButton path="/purchase-plannings/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      {error && <div className="alert error">{error}</div>}
      <DataTable
        columns={[
          { header: "شماره", render: (r) => toFaDigits(String(r.number)), width: "70px", filterType: "number", filterValue: (r) => r.number },
          { header: "تاریخ", render: (r) => formatJalaliDate(r.date), filterType: "date", filterValue: (r) => r.date.slice(0, 10) },
          { header: "گروه خرید", render: (r) => r.purchaseGroupTitle, filterType: "string", filterValue: (r) => r.purchaseGroupTitle },
          { header: "تعداد ردیف", render: (r) => toFaDigits(String(r.lineCount)) },
          { header: "وضعیت", render: (r) => <span className="badge">{STATUS_FA[r.status]}</span>, filterType: "string", filterValue: (r) => STATUS_FA[r.status] },
        ]}
        rows={items}
        edit={{ path: (r) => `/purchase-plannings/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

interface Stage1RowState { purchaseRequestLineId: string; goodsItemId: string; goodsItemCode: string; goodsItemTitle: string; unitTitle: string; quantity: string; description: string }
interface Stage2RowState { goodsItemId: string; goodsItemCode: string; goodsItemTitle: string; unitTitle: string; quantity: number; estimatedAmount: string; description: string }

function PurchasePlanningForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}`;
  const [purchaseGroups, setPurchaseGroups] = useState<PurchaseGroupOption[]>([]);
  const [purchaseExperts, setPurchaseExperts] = useState<PurchaseExpertOption[]>([]);
  const [purchaseRoutes, setPurchaseRoutes] = useState<PurchaseRouteOption[]>([]);
  const [pickableLines, setPickableLines] = useState<PickableRequestLine[]>([]);
  const [step, setStep] = usePersistedState(`${cacheKey}:step`, 1);
  const [header, setHeader] = usePersistedState(`${cacheKey}:header`, { date: "", neededDate: "", purchaseGroupId: "", description: "" });
  const [stage1Rows, setStage1Rows] = usePersistedState<Stage1RowState[]>(`${cacheKey}:stage1`, [{ purchaseRequestLineId: "", goodsItemId: "", goodsItemCode: "", goodsItemTitle: "", unitTitle: "", quantity: "", description: "" }]);
  const [stage2Rows, setStage2Rows] = usePersistedState<Stage2RowState[]>(`${cacheKey}:stage2`, []);
  const [stage3, setStage3] = usePersistedState(`${cacheKey}:stage3`, { purchaseExpertId: "", purchaseRouteId: "", allowMultiSupplierPerLine: false });
  const [meta, setMeta] = usePersistedState<{ number: number; status: Status } | null>(`${cacheKey}:meta`, null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [fiscalPeriod, setFiscalPeriod] = useState<FiscalPeriodRange | null>(null);
  const { saved, flash } = useSavedFlash();

  useEffect(() => {
    async function init() {
      const [pg, pe, pr, fp] = await Promise.all([api.get("/purchase-groups"), api.get("/purchase-experts"), api.get("/purchase-routes"), fetchSelectedFiscalPeriod()]);
      setPurchaseGroups(pg);
      setPurchaseExperts(pe);
      setPurchaseRoutes(pr);
      setFiscalPeriod(fp);

      if (hasPersistedState(`${cacheKey}:header`)) {
        setLoaded(true);
        return;
      }
      if (editId) {
        const d: Detail = await api.get(`/purchase-plannings/${editId}`);
        setMeta({ number: d.number, status: d.status });
        setHeader({ date: d.date.slice(0, 10), neededDate: d.neededDate ? d.neededDate.slice(0, 10) : "", purchaseGroupId: String(d.purchaseGroupId), description: d.description || "" });
        setStage1Rows(
          d.stage1Rows.map((r) => ({
            purchaseRequestLineId: String(r.purchaseRequestLineId),
            goodsItemId: String(r.goodsItemId),
            goodsItemCode: r.goodsItemCode,
            goodsItemTitle: r.goodsItemTitle,
            unitTitle: r.unitTitle,
            quantity: String(r.quantity),
            description: r.description || "",
          }))
        );
        setStage2Rows(
          d.stage2Rows.map((r) => ({
            goodsItemId: String(r.goodsItemId),
            goodsItemCode: r.goodsItemCode,
            goodsItemTitle: r.goodsItemTitle,
            unitTitle: r.unitTitle,
            quantity: r.quantity,
            estimatedAmount: String(r.estimatedAmount),
            description: r.description || "",
          }))
        );
        setStage3({ purchaseExpertId: d.purchaseExpertId ? String(d.purchaseExpertId) : "", purchaseRouteId: d.purchaseRouteId ? String(d.purchaseRouteId) : "", allowMultiSupplierPerLine: d.allowMultiSupplierPerLine });
        setStep(1);
      } else {
        setHeader({ date: defaultDocumentDate(fp), neededDate: "", purchaseGroupId: "", description: "" });
        setStage1Rows([{ purchaseRequestLineId: "", goodsItemId: "", goodsItemCode: "", goodsItemTitle: "", unitTitle: "", quantity: "", description: "" }]);
        setStage2Rows([]);
        setStage3({ purchaseExpertId: "", purchaseRouteId: "", allowMultiSupplierPerLine: false });
        setMeta(null);
        setStep(1);
      }
      setLoaded(true);
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  useEffect(() => {
    if (!header.purchaseGroupId) {
      setPickableLines([]);
      return;
    }
    const q = header.date ? `&destDate=${header.date}` : "";
    api.get(`/purchase-requests/pickable-lines?purchaseGroupId=${header.purchaseGroupId}${q}`).then(setPickableLines).catch(() => setPickableLines([]));
  }, [header.purchaseGroupId, header.date]);

  const status: Status = meta?.status || "DRAFT";
  const locked = status !== "DRAFT";

  function updateStage1Row(idx: number, patch: Partial<Stage1RowState>) {
    setStage1Rows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }
  function onSourceLineChange(idx: number, purchaseRequestLineId: string) {
    const src = pickableLines.find((l) => String(l.purchaseRequestLineId) === purchaseRequestLineId);
    updateStage1Row(idx, {
      purchaseRequestLineId,
      goodsItemId: src ? String(src.goodsItemId) : "",
      goodsItemCode: src ? src.goodsItemCode : "",
      goodsItemTitle: src ? src.goodsItemTitle : "",
      unitTitle: src ? src.unitTitle : "",
      quantity: src ? String(src.remaining) : "",
    });
  }
  function addStage1Row() {
    setStage1Rows((prev) => [...prev, { purchaseRequestLineId: "", goodsItemId: "", goodsItemCode: "", goodsItemTitle: "", unitTitle: "", quantity: "", description: "" }]);
  }
  function removeStage1Row(idx: number) {
    setStage1Rows((prev) => prev.filter((_, i) => i !== idx));
  }

  function computeStage2(): Stage2RowState[] {
    const byGoods = new Map<string, Stage2RowState>();
    for (const r of stage1Rows) {
      if (!r.goodsItemId) continue;
      const qty = Number(r.quantity) || 0;
      const existing = byGoods.get(r.goodsItemId);
      if (existing) {
        existing.quantity += qty;
      } else {
        const prevStage2 = stage2Rows.find((s) => s.goodsItemId === r.goodsItemId);
        byGoods.set(r.goodsItemId, {
          goodsItemId: r.goodsItemId,
          goodsItemCode: r.goodsItemCode,
          goodsItemTitle: r.goodsItemTitle,
          unitTitle: r.unitTitle,
          quantity: qty,
          estimatedAmount: prevStage2 ? prevStage2.estimatedAmount : "0",
          description: prevStage2 ? prevStage2.description : "",
        });
      }
    }
    return Array.from(byGoods.values());
  }

  function goToStep2() {
    const nonEmpty = stage1Rows.filter((r) => r.purchaseRequestLineId);
    if (nonEmpty.length === 0) return alert("حداقل یک ردیف درخواست خرید باید انتخاب شود");
    for (const [i, r] of nonEmpty.entries()) {
      if (!(Number(r.quantity) > 0)) return alert(`مقدار ردیف ${i + 1} باید عددی مثبت باشد`);
    }
    setStage2Rows(computeStage2());
    setStep(2);
  }
  function updateStage2Row(goodsItemId: string, patch: Partial<Stage2RowState>) {
    setStage2Rows((prev) => prev.map((r) => (r.goodsItemId === goodsItemId ? { ...r, ...patch } : r)));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!header.date) return setError("تاریخ الزامی است");
    const dateErr = validateDocumentDate(header.date, fiscalPeriod);
    if (dateErr) return setError(dateErr);
    if (!header.purchaseGroupId) return setError("گروه خرید الزامی است");
    if (!stage3.purchaseExpertId) return setError("کارشناس خرید الزامی است");
    if (!stage3.purchaseRouteId) return setError("مسیر تامین الزامی است");
    const stage1 = stage1Rows.filter((r) => r.purchaseRequestLineId).map((r) => ({ purchaseRequestLineId: Number(r.purchaseRequestLineId), quantity: Number(r.quantity) || 0, description: r.description || null }));
    if (stage1.length === 0) return setError("مرحله اول باید حداقل یک ردیف داشته باشد");
    const stage2 = stage2Rows.map((r) => ({ goodsItemId: Number(r.goodsItemId), estimatedAmount: Number(r.estimatedAmount) || 0, description: r.description || null }));

    const body = {
      date: header.date,
      neededDate: header.neededDate || null,
      purchaseGroupId: Number(header.purchaseGroupId),
      description: header.description,
      purchaseExpertId: Number(stage3.purchaseExpertId),
      purchaseRouteId: Number(stage3.purchaseRouteId),
      allowMultiSupplierPerLine: stage3.allowMultiSupplierPerLine,
      stage1Rows: stage1,
      stage2Rows: stage2,
    };
    try {
      if (editId) {
        await api.put(`/purchase-plannings/${editId}`, body);
        flash();
      } else {
        const created = await api.post("/purchase-plannings", body);
        flash();
        navigate(`/purchase-plannings/${created.id}/edit`);
      }
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/purchase-plannings/${editId}`);
      navigate("/purchase-plannings");
    } catch (e) {
      alert((e as ApiError).message);
    }
  }
  async function runAction(path: string, confirmMsg?: string) {
    if (!editId) return;
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    try {
      await api.post(`/purchase-plannings/${editId}/${path}`, {});
      const d: Detail = await api.get(`/purchase-plannings/${editId}`);
      setMeta({ number: d.number, status: d.status });
      flash();
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  if (!loaded) return null;

  const extraActions: { label: string; icon: JSX.Element; onClick: () => void }[] = [];
  if (editId && meta) {
    if (status === "DRAFT") extraActions.push({ label: "تایید", icon: <CheckIcon />, onClick: () => runAction("approve") });
    else if (status === "APPROVED") {
      extraActions.push({ label: "برگشت از تایید", icon: <UndoIcon />, onClick: () => runAction("unapprove") });
      extraActions.push({ label: "پایان برنامه ریزی", icon: <CloseFlagIcon />, onClick: () => runAction("close", "با انجام این عملیات، این برنامه ریزی پایان یافته و امکان استفاده از آن وجود نخواهد داشت.") });
    }
  }

  const activeExperts = purchaseExperts.filter((p) => p.isActive && (!header.purchaseGroupId || p.groupIds.includes(Number(header.purchaseGroupId))));
  const activeRoutes = purchaseRoutes.filter((r) => r.isActive);
  const stage1Total = stage1Rows.reduce((s, r) => s + (Number(r.quantity) || 0), 0);

  return (
    <FormPage
      title={editId ? "ویرایش برنامه ریزی خرید" : "برنامه ریزی خرید جدید"}
      description={locked ? `این فرم در وضعیت «${STATUS_FA[status]}» است و از این فرم قابل ویرایش نیست.` : undefined}
      formId="purchase-planning-form"
      closePath="/purchase-plannings"
      newPath="/purchase-plannings/new"
      onDelete={editId && status === "DRAFT" ? handleDelete : undefined}
      saveDisabled={locked}
      extraActions={extraActions}
      wide
    >
      <form id="purchase-planning-form" onSubmit={onSubmit}>
        {error && <div className="alert error">{error}</div>}
        {saved && <div className="alert warn">تغییرات ذخیره شد</div>}

        <div className="wizard-steps" style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {[1, 2, 3].map((s) => (
            <button
              key={s}
              type="button"
              className={`btn ${step === s ? "primary" : ""}`}
              style={{ padding: "6px 14px", fontSize: 12 }}
              onClick={() => setStep(s)}
              disabled={s === 3 && stage2Rows.length === 0}
            >
              {s === 1 ? "۱. انتخاب ردیف‌ها" : s === 2 ? "۲. تجمیع کالا" : "۳. کارشناس و مسیر تامین"}
            </button>
          ))}
        </div>

        <fieldset disabled={locked} style={{ border: 0, padding: 0, margin: 0 }}>
          {step === 1 && (
            <>
              <div className="je-header-grid" style={{ marginBottom: 16, maxWidth: 900 }}>
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
                  <label>تاریخ مورد نیاز</label>
                  <JalaliDatePicker value={header.neededDate} onChange={(v) => setHeader({ ...header, neededDate: v })} />
                </div>
                <div className="form-field">
                  <label>گروه خرید<RequiredMark /></label>
                  <select value={header.purchaseGroupId} onChange={(e) => setHeader({ ...header, purchaseGroupId: e.target.value })} disabled={!!editId}>
                    <option value="">انتخاب کنید</option>
                    {purchaseGroups.filter((g) => g.isActive).map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
                  </select>
                </div>
                <div className="form-field full">
                  <label>شرح</label>
                  <input value={header.description} onChange={(e) => setHeader({ ...header, description: e.target.value })} />
                </div>
              </div>

              <div className="je-lines-toolbar">
                <span className="je-lines-title">ردیف‌های درخواست خرید</span>
                <button type="button" className="toolbar-icon-btn primary" onClick={addStage1Row} title="ردیف جدید">
                  <PlusIcon />
                </button>
              </div>
              <div className="grid-wrap je-lines-wrap">
                <div className="je-lines-scroll grid-scroll-area" style={{ overflowX: "auto", overflowY: "auto" }}>
                  <table className="je-lines-table">
                    <thead>
                      <tr>
                        <th>ردیف</th>
                        <th>درخواست خرید</th>
                        <th>کالا</th>
                        <th>واحد</th>
                        <th>مقدار</th>
                        <th>شرح</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {stage1Rows.map((row, idx) => {
                        const src = pickableLines.find((l) => String(l.purchaseRequestLineId) === row.purchaseRequestLineId);
                        return (
                          <tr key={idx}>
                            <td style={{ textAlign: "center", color: "var(--ink-soft)", fontWeight: 600 }}>{toFaDigits(String(idx + 1))}</td>
                            <td style={{ minWidth: 90 }}>
                              <RecordPickerField
                                title="انتخاب ردیف درخواست خرید"
                                disabled={!header.purchaseGroupId}
                                displayValue={src ? `${toFaDigits(String(src.number))}` : ""}
                                rows={pickableLines}
                                columns={[
                                  { header: "شماره", render: (l) => toFaDigits(String(l.number)), filterValue: (l) => String(l.number), width: "70px" },
                                  { header: "کالا", render: (l) => l.goodsItemTitle, filterValue: (l) => l.goodsItemTitle },
                                  { header: "مانده", render: (l) => formatAmountFa(l.remaining), filterValue: (l) => String(l.remaining), width: "90px" },
                                ]}
                                onSelect={(l) => onSourceLineChange(idx, String(l.purchaseRequestLineId))}
                              />
                            </td>
                            <td style={{ minWidth: 300 }}>{row.goodsItemTitle ? `${toFaDigits(row.goodsItemCode)} — ${row.goodsItemTitle}` : "—"}</td>
                            <td style={{ minWidth: 90, color: "var(--ink-soft)" }}>{row.unitTitle || "—"}</td>
                            <td style={{ minWidth: 120 }}>
                              <AmountInput value={row.quantity} onChange={(v) => updateStage1Row(idx, { quantity: v })} allowDecimal />
                            </td>
                            <td style={{ minWidth: 140 }}>
                              <input value={row.description} onChange={(e) => updateStage1Row(idx, { description: e.target.value })} />
                            </td>
                            <td>
                              <button type="button" className="btn danger" style={{ padding: "5px 8px", fontSize: 11 }} onClick={() => removeStage1Row(idx)}>
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
                  <span className="grid-footer-info">{stage1Rows.length === 0 ? "بدون ردیف" : `${toFaDigits(String(stage1Rows.length))} ردیف`}</span>
                  <span className="je-lines-totals">جمع مقدار: {formatAmountFa(stage1Total)}</span>
                </div>
              </div>
              <div style={{ marginTop: 12 }}>
                <button type="button" className="btn primary" onClick={goToStep2}>بعدی</button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="je-lines-toolbar">
                <span className="je-lines-title">تجمیع کالا (مرحله دوم)</span>
              </div>
              <div className="grid-wrap je-lines-wrap">
                <div className="je-lines-scroll grid-scroll-area" style={{ overflowX: "auto", overflowY: "auto" }}>
                  <table className="je-lines-table">
                    <thead>
                      <tr>
                        <th>ردیف</th>
                        <th>کالا</th>
                        <th>واحد</th>
                        <th>مقدار</th>
                        <th>مبلغ برآوردی</th>
                        <th>شرح</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stage2Rows.map((row, idx) => (
                        <tr key={row.goodsItemId}>
                          <td style={{ textAlign: "center", color: "var(--ink-soft)", fontWeight: 600 }}>{toFaDigits(String(idx + 1))}</td>
                          <td style={{ minWidth: 180 }}>{toFaDigits(row.goodsItemCode)} — {row.goodsItemTitle}</td>
                          <td style={{ minWidth: 90, color: "var(--ink-soft)" }}>{row.unitTitle}</td>
                          <td style={{ minWidth: 100, color: "var(--ink-soft)" }}>{formatAmountFa(row.quantity)}</td>
                          <td style={{ minWidth: 130 }}>
                            <AmountInput value={row.estimatedAmount} onChange={(v) => updateStage2Row(row.goodsItemId, { estimatedAmount: v })} allowDecimal />
                          </td>
                          <td style={{ minWidth: 140 }}>
                            <input value={row.description} onChange={(e) => updateStage2Row(row.goodsItemId, { description: e.target.value })} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="grid-footer je-lines-footer">
                  <span className="grid-footer-info">{toFaDigits(String(stage2Rows.length))} کالای متمایز</span>
                </div>
              </div>
              <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                <button type="button" className="btn" onClick={() => setStep(1)}>قبلی</button>
                <button type="button" className="btn primary" onClick={() => setStep(3)}>بعدی</button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="form-grid">
                <div className="form-field">
                  <label>کارشناس خرید<RequiredMark /></label>
                  <RecordPickerField
                    title="انتخاب کارشناس خرید"
                    displayValue={(() => {
                      const ex = activeExperts.find((x) => String(x.id) === stage3.purchaseExpertId);
                      return ex ? `${ex.party.firstName || ""} ${ex.party.lastName || ""}`.trim() : "";
                    })()}
                    rows={activeExperts}
                    columns={[
                      { header: "کد", render: (x) => toFaDigits(String(x.code)), filterValue: (x) => String(x.code), width: "80px" },
                      { header: "عنوان", render: (x) => `${x.party.firstName || ""} ${x.party.lastName || ""}`.trim(), filterValue: (x) => `${x.party.firstName || ""} ${x.party.lastName || ""}`.trim() },
                    ]}
                    onSelect={(x) => setStage3({ ...stage3, purchaseExpertId: String(x.id) })}
                  />
                </div>
                <div className="form-field">
                  <label>مسیر تامین<RequiredMark /></label>
                  <RecordPickerField
                    title="انتخاب مسیر تامین"
                    displayValue={(() => {
                      const r = activeRoutes.find((x) => String(x.id) === stage3.purchaseRouteId);
                      return r ? `${toFaDigits(String(r.code))} — ${r.title}` : "";
                    })()}
                    rows={activeRoutes}
                    columns={[
                      { header: "کد", render: (x) => toFaDigits(String(x.code)), filterValue: (x) => String(x.code), width: "80px" },
                      { header: "عنوان", render: (x) => x.title, filterValue: (x) => x.title },
                    ]}
                    onSelect={(x) => setStage3({ ...stage3, purchaseRouteId: String(x.id) })}
                  />
                </div>
                <div className="form-field">
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={stage3.allowMultiSupplierPerLine}
                      onChange={(e) => setStage3({ ...stage3, allowMultiSupplierPerLine: e.target.checked })}
                    />
                    مجاز به خرید هر ردیف از تامین کننده‌های متفاوت
                  </label>
                </div>
              </div>
              <div style={{ marginTop: 12 }}>
                <button type="button" className="btn" onClick={() => setStep(2)}>قبلی</button>
              </div>
            </>
          )}
        </fieldset>
      </form>
    </FormPage>
  );
}
