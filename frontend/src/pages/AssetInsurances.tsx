import { FormEvent, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { AmountInput } from "../components/AmountInput";
import { BulkErrorDialog } from "../components/BulkErrorDialog";
import { DataTable } from "../components/DataTable";
import { ErrorToast } from "../components/ErrorToast";
import { FormPage } from "../components/FormPage";
import { InfoHint } from "../components/InfoHint";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { NewRecordButton } from "../components/NewRecordButton";
import { PickerColumn, RecordPickerField } from "../components/RecordPicker";
import { RefreshButton } from "../components/RefreshButton";
import { RequiredMark } from "../components/RequiredMark";
import { api, ApiError } from "../lib/api";
import { formatAmountFa, toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";
import { showError } from "../lib/toast";
import { useSavedFlash } from "../lib/useSavedFlash";
import { hasPersistedState, usePersistedState } from "../lib/usePersistedState";

// «بیمه دارایی‌ها» (دارایی ثابت › عملیات): هر بیمه‌نامه = یک قلم فاکتور خرید خدمات تاییدشده + بازه‌ی بیمه + پلاک‌های تحت پوشش با «مبلغ برآوردی».
// ارزش دفتری هر پلاک در تاریخ شروع بیمه‌نامه نمایش داده و پیش‌فرض «مبلغ برآوردی» می‌شود (قابل تغییر)؛ مبلغ واقعی هر پلاک از خالص قلم فاکتور به نسبت برآوردها تسهیم می‌شود. هزینه‌ی بیمه در «محاسبه هزینه بیمه» به‌نسبت روز پخش می‌شود.

interface PolicyRow { id: number; number: number; insuranceTypeTitle: string | null; startDate: string; endDate: string; invoiceNumber: number | null; partyTitle: string; serviceTitle: string; itemCount: number; totalAmount: string; description: string | null }
interface LineOption { id: number; invoiceNumber: number; invoiceDate: string; partyTitle: string; serviceTitle: string; description: string | null; netAmount: string }
interface AssetOption { id: number; detailCode: string; title: string; assetGroupTitle: string; confirmed: boolean; status: string }
interface Item { assetId: number; detailCode: string; title: string; estimatedAmount: string; bookValue: string | null; shareAmount: string | null; edited: boolean }

const DEFAULT_FORM = { number: "", insuranceTypeId: "", costLineId: "", lineTitle: "", netAmount: "", startDate: "", endDate: "", description: "", locked: false, items: [] as Item[] };

export default function AssetInsurances() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <PolicyForm />;
  if (location.pathname.endsWith("/edit")) return <PolicyForm editId={Number(id)} />;
  return <PolicyList />;
}

function PolicyList() {
  const cacheKey = "/asset-insurances";
  const [items, setItems] = usePersistedState<PolicyRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  const reload = () => api.get("/asset-insurances").then(setItems).catch((e) => setError(e.message));
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function onDelete(row: PolicyRow) {
    try {
      await api.del(`/asset-insurances/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text="بیمه‌نامه‌ی دارایی‌ها: قلم فاکتور خرید خدمات، بازه‌ی بیمه و پلاک‌های تحت پوشش با مبلغ برآوردی. هزینه‌ی بیمه در «محاسبه هزینه بیمه» به‌نسبت روز پخش می‌شود." title="بیمه دارایی‌ها" />
          <NewRecordButton path="/asset-insurances/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "شماره", render: (r) => toFaDigits(String(r.number)), width: "90px", filterType: "number", filterValue: (r) => r.number },
          { header: "نوع بیمه", render: (r) => r.insuranceTypeTitle ?? "—", width: "130px", filterType: "string", filterValue: (r) => r.insuranceTypeTitle ?? "" },
          { header: "شروع", render: (r) => formatJalaliDate(r.startDate), width: "110px", filterType: "string", filterValue: (r) => formatJalaliDate(r.startDate) },
          { header: "پایان", render: (r) => formatJalaliDate(r.endDate), width: "110px", filterType: "string", filterValue: (r) => formatJalaliDate(r.endDate) },
          { header: "فاکتور", render: (r) => (r.invoiceNumber !== null ? toFaDigits(String(r.invoiceNumber)) : ""), width: "90px", filterType: "number", filterValue: (r) => r.invoiceNumber ?? 0 },
          { header: "بیمه‌گر", render: (r) => r.partyTitle, filterType: "string", filterValue: (r) => r.partyTitle },
          { header: "خدمت", render: (r) => r.serviceTitle, filterType: "string", filterValue: (r) => r.serviceTitle },
          { header: "تعداد پلاک", render: (r) => toFaDigits(String(r.itemCount)), width: "100px", filterType: "number", filterValue: (r) => r.itemCount },
          { header: "مبلغ بیمه‌نامه", render: (r) => formatAmountFa(r.totalAmount), width: "140px", filterType: "number", filterValue: (r) => Number(r.totalAmount) },
        ]}
        rows={items}
        edit={{ path: (r) => `/asset-insurances/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

function PolicyForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const [form, setForm] = usePersistedState(cacheKey, DEFAULT_FORM);
  const [error, setError] = useState<string | null>(null);
  const [bulkError, setBulkError] = useState<ApiError | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const [lines, setLines] = useState<LineOption[]>([]);
  const [assets, setAssets] = useState<AssetOption[]>([]);
  const { flash } = useSavedFlash();
  const locked = form.locked;

  const mapPolicy = (r: any): typeof DEFAULT_FORM => ({
    number: String(r.number),
    insuranceTypeId: r.insuranceTypeId ? String(r.insuranceTypeId) : "",
    costLineId: String(r.costLineId),
    lineTitle: `فاکتور ${r.invoiceNumber} — ${r.partyTitle} — ${r.serviceTitle}`,
    netAmount: r.netAmount,
    startDate: String(r.startDate).slice(0, 10),
    endDate: String(r.endDate).slice(0, 10),
    description: r.description ?? "",
    locked: !!r.locked,
    items: r.items.map((i: any): Item => ({ assetId: i.assetId, detailCode: i.detailCode, title: i.title, estimatedAmount: i.estimatedAmount, bookValue: null, shareAmount: i.shareAmount, edited: true })),
  });

  useEffect(() => {
    api.get(`/asset-insurances/pickable-invoice-lines${editId ? "" : ""}`).then(setLines).catch(() => setLines([]));
    api.get("/fixed-assets").then((r: AssetOption[]) => setAssets(r.filter((a) => a.confirmed && a.status === "ACTIVE"))).catch(() => setAssets([]));
  }, []);

  useEffect(() => {
    if (!editId) {
      if (!hasPersistedState(cacheKey)) setForm({ ...DEFAULT_FORM, startDate: new Date().toISOString().slice(0, 10) });
      setLoaded(true);
      return;
    }
    if (hasPersistedState(cacheKey)) return;
    api.get(`/asset-insurances/${editId}`).then((r: any) => {
      setForm(mapPolicy(r));
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  const used = useMemo(() => new Set(form.items.map((i) => i.assetId)), [form.items]);
  const lineColumns: PickerColumn<LineOption>[] = [
    { header: "فاکتور", render: (r) => toFaDigits(String(r.invoiceNumber)), filterValue: (r) => String(r.invoiceNumber), width: "90px" },
    { header: "تاریخ", render: (r) => formatJalaliDate(r.invoiceDate), filterValue: (r) => formatJalaliDate(r.invoiceDate), width: "110px" },
    { header: "بیمه‌گر", render: (r) => r.partyTitle, filterValue: (r) => r.partyTitle },
    { header: "خدمت", render: (r) => r.serviceTitle, filterValue: (r) => r.serviceTitle },
    { header: "خالص قلم", render: (r) => formatAmountFa(r.netAmount), filterValue: (r) => r.netAmount, width: "130px" },
  ];
  const assetColumns: PickerColumn<AssetOption>[] = [
    { header: "پلاک", render: (r) => r.detailCode, filterValue: (r) => r.detailCode, width: "120px" },
    { header: "عنوان", render: (r) => r.title, filterValue: (r) => r.title },
    { header: "گروه", render: (r) => r.assetGroupTitle, filterValue: (r) => r.assetGroupTitle },
  ];
  // ارزش دفتری هر پلاک در تاریخ شروع بیمه‌نامه؛ مبلغ برآوردیِ دست‌نخورده با آن هم‌مقدار می‌شود (کاربر می‌تواند تغییر دهد)
  const [insTypes, setInsTypes] = useState<{ id: number; title: string; isActive: boolean }[]>([]);
  useEffect(() => {
    api.get("/asset-insurance-types").then(setInsTypes).catch(() => setInsTypes([]));
  }, []);
  const idsKey = form.items.map((i) => i.assetId).join(",");
  useEffect(() => {
    if (!loaded || !form.startDate || !idsKey) return;
    api.get(`/asset-insurances/book-values?assetIds=${idsKey}&date=${form.startDate}`).then((r: { assetId: number; bookValue: string | null }[]) => {
      const m = new Map(r.map((x) => [x.assetId, x.bookValue]));
      setForm((f) => ({ ...f, items: f.items.map((i) => { const bv = m.get(i.assetId) ?? null; return { ...i, bookValue: bv, estimatedAmount: !i.edited && bv !== null ? bv : i.estimatedAmount, shareAmount: !i.edited && bv !== null ? null : i.shareAmount }; }) }));
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, form.startDate, loaded]);
  const totalBook = form.items.reduce((s, i) => s + (Number(i.bookValue) || 0), 0);
  const totalEst = form.items.reduce((s, i) => s + (Number(i.estimatedAmount) || 0), 0);

  function addAssets(rows: AssetOption[]) {
    const added = rows.filter((r) => !used.has(r.id)).map((r): Item => ({ assetId: r.id, detailCode: r.detailCode, title: r.title, estimatedAmount: "", bookValue: null, shareAmount: null, edited: false }));
    setForm({ ...form, items: [...form.items, ...added] });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.insuranceTypeId) return setError("نوع بیمه الزامی است");
    if (!form.costLineId) return setError("قلم فاکتور خرید خدمات الزامی است");
    if (!form.startDate || !form.endDate) return setError("تاریخ شروع و پایان بیمه‌نامه الزامی است");
    if (!form.items.length) return setError("حداقل یک دارایی لازم است");
    if (form.items.some((i) => !(Number(i.estimatedAmount) > 0))) return setError("مبلغ برآوردی همه‌ی دارایی‌ها الزامی است");
    const body = { insuranceTypeId: Number(form.insuranceTypeId), costLineId: Number(form.costLineId), startDate: form.startDate, endDate: form.endDate, description: form.description.trim() || null, items: form.items.map((i) => ({ assetId: i.assetId, estimatedAmount: i.estimatedAmount })) };
    try {
      if (editId) {
        await api.put(`/asset-insurances/${editId}`, body);
        setForm(mapPolicy(await api.get(`/asset-insurances/${editId}`)));
        flash();
      } else {
        const created = await api.post("/asset-insurances", body);
        flash();
        navigate(`/asset-insurances/${created.id}/edit`);
      }
    } catch (e) {
      const err = e as ApiError;
      if (err.details?.length) setBulkError(err);
      else setError(err.message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/asset-insurances/${editId}`);
      navigate("/asset-insurances");
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  if (!loaded) return null;
  return (
    <FormPage title={editId ? `بیمه‌نامه ${toFaDigits(form.number)}` : "بیمه‌نامه‌ی جدید"} formId="asset-insurance-form" closePath="/asset-insurances" newPath="/asset-insurances/new" onDelete={editId && !locked ? handleDelete : undefined} saveDisabled={locked}>
      <form id="asset-insurance-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        {locked && <div className="card" style={{ padding: 8, marginBottom: 8 }}>برای این بیمه‌نامه هزینه‌ی بیمه محاسبه شده؛ ویرایش و حذف ممکن نیست.</div>}
        <fieldset disabled={locked} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          <div className="form-grid">
            <div className="form-field">
              <label>شماره</label>
              <input disabled value={form.number ? toFaDigits(form.number) : ""} placeholder="پس از ذخیره صادر می‌شود" />
            </div>
            <div className="form-field" style={{ gridColumn: "span 2" }}>
              <label>قلم فاکتور خرید خدمات<RequiredMark /></label>
              <RecordPickerField<LineOption>
                title="انتخاب قلم فاکتور خرید خدمات"
                displayValue={form.lineTitle}
                placeholder="انتخاب…"
                rows={lines}
                columns={lineColumns}
                onSelect={(r) => setForm({ ...form, costLineId: String(r.id), lineTitle: `فاکتور ${r.invoiceNumber} — ${r.partyTitle} — ${r.serviceTitle}`, netAmount: r.netAmount })}
              />
            </div>
            <div className="form-field">
              <label>نوع بیمه<RequiredMark /></label>
              <select value={form.insuranceTypeId} onChange={(e) => setForm({ ...form, insuranceTypeId: e.target.value })}>
                <option value="">—</option>
                {insTypes.filter((x) => x.isActive || String(x.id) === form.insuranceTypeId).map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label>خالص قلم فاکتور</label>
              <input disabled value={form.netAmount ? formatAmountFa(form.netAmount) : ""} />
            </div>
            <div className="form-field">
              <label>تاریخ شروع بیمه‌نامه<RequiredMark /></label>
              <JalaliDatePicker value={form.startDate} onChange={(v) => setForm({ ...form, startDate: v })} />
            </div>
            <div className="form-field">
              <label>تاریخ پایان بیمه‌نامه<RequiredMark /></label>
              <JalaliDatePicker value={form.endDate} onChange={(v) => setForm({ ...form, endDate: v })} />
            </div>
            <div className="form-field" style={{ gridColumn: "1 / -1" }}>
              <label>شرح</label>
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>

          <div className="je-lines-wrap" style={{ marginTop: 14 }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "center" }}>
              <strong>دارایی‌های تحت پوشش</strong>
              {!locked && (
                <RecordPickerField<AssetOption> title="انتخاب پلاک" displayValue="" placeholder="افزودن پلاک…" rows={assets.filter((a) => !used.has(a.id))} columns={assetColumns} multiSelect onSelectMultiple={addAssets} />
              )}
            </div>
            <div className="je-lines-scroll">
              <table className="je-lines-table">
                <thead>
                  <tr>
                    <th style={{ width: 36 }}>#</th>
                    <th style={{ width: 120 }}>پلاک</th>
                    <th>عنوان</th>
                    <th style={{ width: 170 }}>ارزش دفتری</th>
                    <th style={{ width: 190 }}>مبلغ برآوردی بابت بیمه<RequiredMark /></th>
                    <th style={{ width: 170 }}>سهم از خالص قلم</th>
                    <th style={{ width: 40 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {form.items.map((i, n) => (
                    <tr key={i.assetId}>
                      <td>{toFaDigits(String(n + 1))}</td>
                      <td>{i.detailCode}</td>
                      <td>{i.title}</td>
                      <td>{i.bookValue !== null ? formatAmountFa(i.bookValue) : "—"}</td>
                      <td>
                        <AmountInput value={i.estimatedAmount} allowDecimal onChange={(v) => setForm({ ...form, items: form.items.map((x) => (x.assetId === i.assetId ? { ...x, estimatedAmount: v, shareAmount: null, edited: true } : x)) })} />
                      </td>
                      <td>{i.shareAmount !== null ? formatAmountFa(i.shareAmount) : "—"}</td>
                      <td>
                        <button type="button" className="icon-btn" title="حذف ردیف" onClick={() => setForm({ ...form, items: form.items.filter((x) => x.assetId !== i.assetId) })}>×</button>
                      </td>
                    </tr>
                  ))}
                  {!form.items.length && <tr><td colSpan={7} style={{ textAlign: "center", opacity: 0.6 }}>پلاکی انتخاب نشده است</td></tr>}
                </tbody>
                {!!form.items.length && (
                  <tfoot>
                    <tr>
                      <td colSpan={3}><strong>جمع</strong></td>
                      <td><strong>{formatAmountFa(String(totalBook))}</strong></td>
                      <td><strong>{formatAmountFa(String(totalEst))}</strong></td>
                      <td><strong>{form.netAmount ? formatAmountFa(form.netAmount) : ""}</strong></td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </fieldset>
      </form>
      {bulkError && (
        <BulkErrorDialog
          error={bulkError}
          gridName="خطاهای بیمه‌نامه"
          detailColumns={[
            { header: "پلاک", render: (r: Record<string, string>) => r["پلاک"] ?? "" },
            { header: "عنوان", render: (r: Record<string, string>) => r["عنوان"] ?? "" },
            { header: "علت", render: (r: Record<string, string>) => r["علت"] },
          ]}
          onClose={() => setBulkError(null)}
        />
      )}
    </FormPage>
  );
}
