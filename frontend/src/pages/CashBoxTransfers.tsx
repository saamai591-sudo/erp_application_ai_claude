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
import { DescriptionField } from "../components/DescriptionField";

// ماژول «مدیریت خزانه» > پرداخت > انتقال به صندوق: انتقال چک‌های دریافتیِ «در دست» از صندوق مبدا به صندوق مقصد.
// ذخیره = ثبتِ نهایی (مرحله‌ی تایید جدا ندارد)؛ فعلاً سند حسابداری ندارد. نگاه کنید به backend/src/routes/cashBoxTransfers.ts.

interface PickableCheque { id: number; number: string; dueDate: string; amount: number; currencyTitle: string; partyDisplay: string }
interface CashBoxRow { id: number; detailCode: string; title: string }

interface ListRow {
  id: number;
  number: number;
  date: string;
  fiscalPeriodTitle: string;
  fromCashBoxTitle: string;
  toCashBoxTitle: string;
  description: string | null;
  lineCount: number;
}
interface DetailLine extends PickableCheque { chequeItemId: number }
interface Detail {
  id: number;
  updatedAt?: string;
  number: number;
  date: string;
  fiscalPeriodTitle: string;
  fromCashBoxId: number;
  toCashBoxId: number;
  description: string | null;
  locked: boolean;
  lockedReason: string | null;
  lines: DetailLine[];
}

const INFO = "چک‌های دریافتیِ «در دست» که نزد صندوق مبدا هستند را به صندوق مقصد منتقل می‌کند. ذخیره‌ی سند، انتقال را نهایی می‌کند؛ ویرایش یا حذف فقط تا وقتی ممکن است که برای چک‌ها اتفاق دیگری (واگذاری، پرداخت، …) ثبت نشده باشد. این فرم فعلاً سند حسابداری ندارد.";

export default function CashBoxTransfers() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <CashBoxTransferForm />;
  if (location.pathname.endsWith("/edit")) return <CashBoxTransferForm editId={Number(id)} />;
  return <CashBoxTransferList />;
}

function CashBoxTransferList() {
  const cacheKey = "/cash-box-transfers";
  const [items, setItems] = usePersistedState<ListRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    try {
      setItems(await api.get("/cash-box-transfers"));
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
      await api.del(`/cash-box-transfers/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text={INFO} title="انتقال به صندوق" />
          <NewRecordButton path="/cash-box-transfers/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "شماره", render: (r) => toFaDigits(String(r.number)), width: "70px", filterType: "number", filterValue: (r) => r.number },
          { header: "تاریخ", render: (r) => formatJalaliDate(r.date), filterType: "date", filterValue: (r) => r.date.slice(0, 10) },
          { header: "صندوق مبدا", render: (r) => r.fromCashBoxTitle, filterType: "string", filterValue: (r) => r.fromCashBoxTitle },
          { header: "صندوق مقصد", render: (r) => r.toCashBoxTitle, filterType: "string", filterValue: (r) => r.toCashBoxTitle },
          { header: "تعداد چک", render: (r) => toFaDigits(String(r.lineCount)) },
          { header: "شرح", render: (r) => r.description || "—", filterType: "string", filterValue: (r) => r.description || "" },
        ]}
        rows={items}
        edit={{ path: (r) => `/cash-box-transfers/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

function CashBoxTransferForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}`;
  const [cashBoxes, setCashBoxes] = useState<CashBoxRow[]>([]);
  const [pickable, setPickable] = useState<PickableCheque[]>([]);
  const [docUpdatedAt, setDocUpdatedAt] = usePersistedState<string>(`${cacheKey}:updatedAt`, "");
  const [header, setHeader] = usePersistedState(`${cacheKey}:header`, { date: "", fromCashBoxId: 0, toCashBoxId: 0, description: "" });
  const [lines, setLines] = usePersistedState<DetailLine[]>(`${cacheKey}:lines`, []);
  const [meta, setMeta] = usePersistedState<{ number: number; fiscalPeriodTitle: string; locked: boolean; lockedReason: string | null } | null>(`${cacheKey}:meta`, null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [fiscalPeriod, setFiscalPeriod] = useState<FiscalPeriodRange | null>(null);
  const { flash } = useSavedFlash();

  function applyDetail(d: Detail) {
    setDocUpdatedAt(d.updatedAt ?? "");
    setMeta({ number: d.number, fiscalPeriodTitle: d.fiscalPeriodTitle, locked: d.locked, lockedReason: d.lockedReason });
    setHeader({ date: d.date.slice(0, 10), fromCashBoxId: d.fromCashBoxId, toCashBoxId: d.toCashBoxId, description: d.description || "" });
    setLines(d.lines);
  }

  useEffect(() => {
    async function init() {
      const [boxes, fp]: [CashBoxRow[], FiscalPeriodRange | null] = await Promise.all([api.get("/cash-boxes"), fetchSelectedFiscalPeriod()]);
      setCashBoxes(boxes);
      setFiscalPeriod(fp);
      if (hasPersistedState(`${cacheKey}:header`)) {
        setLoaded(true);
        if (editId) {
          try {
            const d: Detail = await api.get(`/cash-box-transfers/${editId}`);
            setMeta((prev) => (prev ? { ...prev, locked: d.locked, lockedReason: d.lockedReason } : prev));
          } catch {
            // به مقادیر کش‌شده بسنده می‌شود؛ سرور هنگام ذخیره دوباره اعتبارسنجی می‌کند
          }
        }
        return;
      }
      if (editId) applyDetail(await api.get(`/cash-box-transfers/${editId}`));
      else {
        setHeader({ date: defaultDocumentDate(fp), fromCashBoxId: 0, toCashBoxId: 0, description: "" });
        setLines([]);
        setMeta(null);
      }
      setLoaded(true);
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  // چک‌های قابل انتخاب: «در دست» نزد صندوق مبدا با تاریخ سند مبنای ≤ تاریخ سند؛ با تغییر مبدا یا تاریخ دوباره بارگذاری می‌شود
  useEffect(() => {
    if (!header.fromCashBoxId) {
      setPickable([]);
      return;
    }
    api
      .get(`/cash-box-transfers/pickable-cheques?fromCashBoxId=${header.fromCashBoxId}${header.date ? `&date=${header.date}` : ""}${editId ? `&excludeId=${editId}` : ""}`)
      .then((c: PickableCheque[]) => setPickable(c))
      .catch(() => setPickable([]));
  }, [header.fromCashBoxId, header.date, editId]);

  const locked = !!meta?.locked;
  const totalAmount = lines.reduce((s, l) => s + l.amount, 0);
  const boxTitle = (id: number) => cashBoxes.find((b) => b.id === id)?.title ?? "";

  function changeFrom(box: CashBoxRow) {
    if (box.id === header.fromCashBoxId) return;
    // چک‌های انتخاب‌شده متعلق به صندوق مبدای قبلی‌اند
    if (lines.length > 0 && !window.confirm("با تغییر صندوق مبدا، چک‌های انتخاب‌شده حذف می‌شوند. ادامه می‌دهید؟")) return;
    setLines([]);
    setHeader({ ...header, fromCashBoxId: box.id, toCashBoxId: header.toCashBoxId === box.id ? 0 : header.toCashBoxId });
  }

  function addCheques(rows: PickableCheque[]) {
    setLines((prev) => {
      const have = new Set(prev.map((l) => l.chequeItemId));
      return [...prev, ...rows.filter((c) => !have.has(c.id)).map((c) => ({ ...c, chequeItemId: c.id }))];
    });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!header.date) return setError("تاریخ الزامی است");
    const dateErr = validateDocumentDate(header.date, fiscalPeriod);
    if (dateErr) return setError(dateErr);
    if (!header.fromCashBoxId) return setError("صندوق مبدا الزامی است");
    if (!header.toCashBoxId) return setError("صندوق مقصد الزامی است");
    if (header.fromCashBoxId === header.toCashBoxId) return setError("صندوق مبدا و مقصد نمی‌توانند یکی باشند");
    if (lines.length === 0) return setError("حداقل یک چک باید انتخاب شود");
    const body = { ...header, chequeItemIds: lines.map((l) => l.chequeItemId), updatedAt: docUpdatedAt };
    try {
      if (editId) {
        await api.put(`/cash-box-transfers/${editId}`, body);
        applyDetail(await api.get(`/cash-box-transfers/${editId}`));
        flash();
      } else {
        const created = await api.post("/cash-box-transfers", body);
        flash();
        navigate(`/cash-box-transfers/${created.id}/edit`);
      }
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/cash-box-transfers/${editId}`);
      navigate("/cash-box-transfers");
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  if (!loaded) return null;

  const available = pickable.filter((c) => !lines.some((l) => l.chequeItemId === c.id));

  return (
    <FormPage
      title={editId ? "ویرایش انتقال به صندوق" : "انتقال به صندوق جدید"}
      description={locked ? meta?.lockedReason ?? undefined : undefined}
      formId="cash-box-transfer-form"
      closePath="/cash-box-transfers"
      newPath="/cash-box-transfers/new"
      onDelete={editId && !locked ? handleDelete : undefined}
      saveDisabled={locked}
      wide
    >
      <form id="cash-box-transfer-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />

        <fieldset disabled={locked} style={{ border: 0, padding: 0, margin: 0 }}>
          <div className="je-header-grid cols-3" style={{ marginBottom: 6, maxWidth: 900 }}>
            <div className="form-field">
              <label>شماره</label>
              <input dir="ltr" value={meta ? toFaDigits(String(meta.number)) : "خودکار پس از ذخیره"} disabled />
            </div>
            <div className="form-field">
              <label>دوره مالی</label>
              <input value={meta?.fiscalPeriodTitle ?? "بر اساس تاریخ سند"} disabled />
            </div>
            <div className="form-field">
              <label>تاریخ سند<RequiredMark /></label>
              <JalaliDatePicker fiscalYear value={header.date} onChange={(v) => setHeader({ ...header, date: v })} />
            </div>
            <div className="form-field">
              <label>صندوق مبدا<RequiredMark /></label>
              <RecordPickerField
                title="صندوق مبدا"
                displayValue={boxTitle(header.fromCashBoxId)}
                placeholder="انتخاب صندوق مبدا"
                rows={cashBoxes}
                columns={[
                  { header: "کد", render: (b: CashBoxRow) => b.detailCode, filterValue: (b: CashBoxRow) => b.detailCode, width: "100px" },
                  { header: "عنوان", render: (b: CashBoxRow) => b.title, filterValue: (b: CashBoxRow) => b.title },
                ]}
                onSelect={(b) => changeFrom(b as CashBoxRow)}
              />
            </div>
            <div className="form-field">
              <label>صندوق مقصد<RequiredMark /></label>
              <RecordPickerField
                title="صندوق مقصد"
                displayValue={boxTitle(header.toCashBoxId)}
                placeholder="انتخاب صندوق مقصد"
                rows={cashBoxes.filter((b) => b.id !== header.fromCashBoxId)}
                columns={[
                  { header: "کد", render: (b: CashBoxRow) => b.detailCode, filterValue: (b: CashBoxRow) => b.detailCode, width: "100px" },
                  { header: "عنوان", render: (b: CashBoxRow) => b.title, filterValue: (b: CashBoxRow) => b.title },
                ]}
                onSelect={(b) => setHeader({ ...header, toCashBoxId: (b as CashBoxRow).id })}
              />
            </div>
            <div className="form-field full">
              <DescriptionField value={header.description} onChange={(v) => setHeader({ ...header, description: v })} disabled={locked} />
            </div>
          </div>
        </fieldset>

        <div className="je-lines-toolbar">
          <span className="je-lines-title">چک‌ها</span>
          <RecordPickerField
            title="افزودن چک"
            disabled={locked || !header.fromCashBoxId}
            displayValue=""
            placeholder={header.fromCashBoxId ? "افزودن چک" : "ابتدا صندوق مبدا را انتخاب کنید"}
            rows={available}
            multiSelect
            columns={[
              { header: "شماره", render: (c: PickableCheque) => c.number, filterValue: (c: PickableCheque) => c.number, width: "100px" },
              { header: "طرف حساب", render: (c: PickableCheque) => c.partyDisplay, filterValue: (c: PickableCheque) => c.partyDisplay },
              { header: "سررسید", render: (c: PickableCheque) => formatJalaliDate(c.dueDate), filterValue: (c: PickableCheque) => c.dueDate?.slice(0, 10) ?? "", width: "100px" },
              { header: "مبلغ", render: (c: PickableCheque) => formatAmountFa(c.amount), filterValue: (c: PickableCheque) => String(c.amount), width: "100px" },
            ]}
            onSelectMultiple={(rows) => addCheques(rows as PickableCheque[])}
          />
        </div>

        <div className="grid-wrap je-lines-wrap">
          <div className="je-lines-scroll grid-scroll-area" style={{ overflowX: "auto", overflowY: "auto" }}>
            <table className="je-lines-table">
              <thead>
                <tr>
                  <th>ردیف</th>
                  <th>شماره چک</th>
                  <th>سررسید</th>
                  <th>طرف حساب</th>
                  <th>مبلغ</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, idx) => (
                  <tr key={l.chequeItemId}>
                    <td style={{ textAlign: "center", color: "var(--ink-soft)", fontWeight: 600 }}>{toFaDigits(String(idx + 1))}</td>
                    <td>{l.number}</td>
                    <td>{formatJalaliDate(l.dueDate)}</td>
                    <td>{l.partyDisplay}</td>
                    <td>{formatAmountFa(l.amount)} <span className="fx-only">{l.currencyTitle}</span></td>
                    <td>
                      <button type="button" className="btn danger" disabled={locked} style={{ padding: "5px 8px", fontSize: 11 }} onClick={() => setLines((prev) => prev.filter((x) => x.chequeItemId !== l.chequeItemId))}>
                        حذف
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid-footer je-lines-footer">
            <span className="grid-footer-info">{lines.length === 0 ? "بدون چک" : `${toFaDigits(String(lines.length))} چک`}</span>
            <span className="je-lines-totals">جمع مبلغ: {formatAmountFa(totalAmount)}</span>
          </div>
        </div>
      </form>
    </FormPage>
  );
}
