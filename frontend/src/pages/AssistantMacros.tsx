import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ErrorToast } from "../components/ErrorToast";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { InfoHint } from "../components/InfoHint";
import { RequiredMark } from "../components/RequiredMark";
import { api, ApiError } from "../lib/api";
import { showError } from "../lib/toast";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { takeFormPrefill } from "../lib/formPrefill";
import { fetchSalesLineItems } from "../lib/salesLineItems";
import { RecordPickerField } from "../components/RecordPicker";
import { AmountInput } from "../components/AmountInput";
import { toFaDigits } from "../lib/formatAmount";

// کارتابل › تنظیمات › دستورهای میانبر دستیار: عبارتی که کاربر در «دستیار» می‌نویسد ← یک کار (فعلاً پیش‌فاکتور) با نوع/مرکز فروشِ از پیش‌تعیین‌شده.
// برای کل شرکت یکی است؛ هر دستور را می‌شود به نقش‌هایی محدود کرد (خالی = همه‌ی کاربرانِ دارای دسترسی خودِ کار).

interface Macro {
  id: number;
  phrase: string;
  actionKey: string;
  actionTitle: string;
  salesTypeId: number | null;
  salesTypeTitle: string | null;
  salesCenterId: number | null;
  salesCenterTitle: string | null;
  isActive: boolean;
  roleIds: number[];
  roleTitles: string[];
  description: string;
  discountPercent: number | null;
  lines: { goodsItemId: number; title: string; quantity: number | null; askQuantity: boolean }[];
  askFields: string[];
  receiptPreset: ReceiptPresetDto | null;
  paymentPreset: PaymentPresetDto | null;
}
interface ReceiptPresetDto {
  instruments: { type: PType; cashBoxId: number | null; bankAccountId: number | null; cardReaderId: number | null }[];
  subjects: { receiptTypeId: number; instrument: number }[];
  customerId?: number | null;
}
interface PaymentPresetDto {
  instruments: { type: PType; cashBoxId: number | null; bankAccountId: number | null }[];
  subjects: { paymentTypeId: number; instrument: number }[];
  /** طرف حسابِ ثابت (Party.id) */
  partyId?: number | null;
}
type PType = "CASH" | "BANK_TRANSFER" | "CHEQUE" | "POS" | "CHEQUE_TRANSFER";
const PTYPE_FA: Record<PType, string> = { CASH: "نقد", BANK_TRANSFER: "حواله/انتقال بانکی", CHEQUE: "چک", POS: "پوز/درگاه", CHEQUE_TRANSFER: "چک انتقالی" };
/** ابزارهای قابل‌پیش‌تعیین هر کار: رسید دریافت پوز دارد، اعلامیه پرداخت چک انتقالی (خرج‌کردن چک دریافتی) */
const KIND_PTYPES: Record<"receipt" | "payment", PType[]> = { receipt: ["CASH", "BANK_TRANSFER", "CHEQUE", "POS"], payment: ["CASH", "BANK_TRANSFER", "CHEQUE", "CHEQUE_TRANSFER"] };
interface PInstrument {
  type: PType;
  cashBoxId: string;
  bankAccountId: string;
  cardReaderId: string;
}
interface PSubject {
  /** نوع دریافت (رسید) یا نوع پرداخت (اعلامیه پرداخت) */
  typeId: string;
  instrument: string;
}
interface FormLine {
  goodsItemId: string;
  quantity: string;
  /** مقدار این قلم هر بار از کاربر پرسیده شود */
  ask: boolean;
}
/** حالت هر فیلد: ثابت (مقدار همین است)، بپرس (دستیار حتماً می‌پرسد)، پیش‌فرض (رفتار عادی دستیار) */
type Mode = "FIXED" | "ASK" | "DEFAULT";
const MODE_FIELDS: { key: "salesType" | "salesCenter" | "description" | "discountPercent"; title: string }[] = [
  { key: "salesType", title: "نوع فروش" },
  { key: "salesCenter", title: "مرکز فروش" },
  { key: "description", title: "شرح" },
  { key: "discountPercent", title: "تخفیف (درصد)" },
];
interface GoodsOpt {
  id: number;
  fullCode: string;
  title: string;
  isActive: boolean;
}
/** پیش‌پر شدن فرم دستور از روی یک پیش‌فاکتور (دکمه‌ی «ساخت دستور دستیار» در فرم پیش‌فاکتور) */
export interface MacroFromQuotePrefill {
  salesTypeId: number;
  salesCenterId: number;
  description: string;
  lines: { goodsItemId: number; quantity: number }[];
}
/** پیش‌پر شدن فرم دستور از روی یک رسید دریافت (دکمه‌ی «ساخت دستور دستیار» در فرم رسید دریافت) */
export interface MacroFromReceiptPrefill extends Partial<ReceiptPresetDto> {
  actionKey: "receipt";
  description: string;
}
/** پیش‌پر شدن فرم دستور از روی یک اعلامیه پرداخت (دکمه‌ی «ساخت دستور دستیار» در فرم اعلامیه پرداخت) */
export interface MacroFromPaymentPrefill extends Partial<PaymentPresetDto> {
  actionKey: "payment";
  description: string;
}
interface Opt {
  id: number;
  title: string;
}
interface Options {
  roles: Opt[];
  salesTypes: Opt[];
  salesCenters: Opt[];
}

export default function AssistantMacros() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <MacroForm />;
  if (location.pathname.endsWith("/edit")) return <MacroForm editId={Number(id)} />;
  return <MacroList />;
}

function MacroList() {
  const cacheKey = "/assistant-macros";
  const [items, setItems] = usePersistedState<Macro[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  async function reload() {
    api.get("/assistant-macros").then(setItems).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function onDelete(row: Macro) {
    try {
      await api.del(`/assistant-macros/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  const s = (f: (r: Macro) => string, extra: object = {}) => ({ render: (r: Macro) => f(r), filterType: "string" as const, filterValue: (r: Macro) => f(r), ...extra });
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint
            text="عبارتی که کاربر در «دستیار» می‌نویسد (مثلاً «پیش‌فاکتور شمال») را به یک کار با نوع/مرکز فروشِ از پیش‌تعیین‌شده وصل می‌کند. برای کل شرکت یکی است و می‌توان آن را به چند نقش محدود کرد؛ دستور هیچ دسترسی اضافه‌ای نمی‌دهد."
            title="دستورهای میانبر دستیار"
          />
          <NewRecordButton path="/assistant-macros/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "عبارت", ...s((r) => r.phrase) },
          { header: "کار", ...s((r) => r.actionTitle), width: "130px" },
          { header: "نوع فروش", ...s((r) => r.salesTypeTitle ?? "—"), width: "130px" },
          { header: "مرکز فروش", ...s((r) => r.salesCenterTitle ?? "—"), width: "130px" },
          { header: "اقلام ثابت", ...s((r) => (r.lines.length ? toFaDigits(String(r.lines.length)) : "—")), width: "90px" },
          { header: "نقش‌ها", ...s((r) => (r.roleTitles.length ? r.roleTitles.join("، ") : "همه")) },
          { header: "فعال", ...s((r) => (r.isActive ? "بله" : "خیر")), width: "70px" },
        ]}
        rows={items}
        edit={{ path: (r: Macro) => `/assistant-macros/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

function modesOf(m: Macro): Record<string, Mode> {
  const value = { salesType: m.salesTypeId, salesCenter: m.salesCenterId, description: m.description, discountPercent: m.discountPercent };
  return Object.fromEntries(MODE_FIELDS.map((f) => [f.key, m.askFields.includes(f.key) ? "ASK" : value[f.key] ? "FIXED" : "DEFAULT"])) as Record<string, Mode>;
}

const DEFAULT_FORM = {
  phrase: "",
  actionKey: "sales-quote",
  salesTypeId: "",
  salesCenterId: "",
  description: "",
  discountPercent: "",
  modes: { salesType: "DEFAULT", salesCenter: "DEFAULT", description: "DEFAULT", discountPercent: "DEFAULT" } as Record<string, Mode>,
  lines: [] as FormLine[],
  /** ابزارها و موضوعات رسید دریافت / اعلامیه پرداخت (فقط کارهای ثبت رسید و پرداخت) */
  instruments: [] as PInstrument[],
  subjects: [] as PSubject[],
  /** مشتریِ ثابتِ رسید (Customer.id) یا طرف حسابِ ثابتِ پرداخت (Party.id)؛ خالی = از کاربر پرسیده شود */
  customerMode: "ASK" as "ASK" | "FIXED",
  customerId: "",
  roleIds: [] as number[],
  isActive: true,
};

const toPInstruments = (p?: { type: PType; cashBoxId: number | null; bankAccountId: number | null; cardReaderId?: number | null }[]): PInstrument[] => (p ?? []).map((r) => ({ type: r.type, cashBoxId: r.cashBoxId ? String(r.cashBoxId) : "", bankAccountId: r.bankAccountId ? String(r.bankAccountId) : "", cardReaderId: r.cardReaderId ? String(r.cardReaderId) : "" }));
const toPSubjects = (p?: { receiptTypeId?: number; paymentTypeId?: number; instrument: number }[]): PSubject[] => (p ?? []).map((r) => ({ typeId: String(r.receiptTypeId ?? r.paymentTypeId ?? ""), instrument: String(r.instrument) }));

function MacroForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const [form, setForm] = usePersistedState(cacheKey, DEFAULT_FORM);
  const [opts, setOpts] = useState<Options>({ roles: [], salesTypes: [], salesCenters: [] });
  const [goods, setGoods] = useState<GoodsOpt[]>([]);
  const [actions, setActions] = useState<{ key: string; title: string; presets: string[] }[]>([]);
  const [cashBoxes, setCashBoxes] = useState<Opt[]>([]);
  const [bankAccounts, setBankAccounts] = useState<{ id: number; detailTitle: string; accountType?: { hasChequeBook: boolean } }[]>([]);
  const [cardReaders, setCardReaders] = useState<Opt[]>([]);
  const [receiptTypes, setReceiptTypes] = useState<(Opt & { isActive: boolean })[]>([]);
  const [customers, setCustomers] = useState<{ id: number; code: number; party: { detailTitle: string } }[]>([]);
  const [paymentTypes, setPaymentTypes] = useState<(Opt & { isActive: boolean })[]>([]);
  const [parties, setParties] = useState<{ id: number; detailCode: string; detailTitle: string; isActive: boolean }[]>([]);
  const instruments = form.instruments ?? [];
  const subjects = form.subjects ?? [];
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const { flash } = useSavedFlash();
  // فیلدهای قابل‌پیش‌تعیینِ کارِ انتخاب‌شده (پیش‌فاکتور همه، رسید دریافت فقط «شرح»)؛ تا بارگذاری فهرست کارها همه نمایش داده می‌شود
  const presets = actions.find((a) => a.key === form.actionKey)?.presets;
  const supports = (f: string) => !presets || presets.includes(f);
  /** رسید دریافت یا اعلامیه پرداخت (فقط وقتی فهرست کارها بارگذاری شده و کار انتخابی یکی از این دو است) */
  const kind: "receipt" | "payment" | null = presets?.includes("receiptPreset") ? "receipt" : presets?.includes("paymentPreset") ? "payment" : null;

  useEffect(() => {
    api.get("/assistant-macros/options").then(setOpts).catch((e) => setError(e.message));
    api.get("/assistant-macros/actions").then(setActions).catch(() => {});
    fetchSalesLineItems<GoodsOpt>().then(setGoods).catch(() => {});
    api.get("/cash-boxes").then(setCashBoxes).catch(() => {});
    api.get("/banking/accounts").then(setBankAccounts).catch(() => {});
    api.get("/card-readers").then(setCardReaders).catch(() => {});
    api.get("/receipt-types").then(setReceiptTypes).catch(() => {});
    api.get("/customers").then(setCustomers).catch(() => {});
    api.get("/payment-types").then(setPaymentTypes).catch(() => {});
    api.get("/parties").then(setParties).catch(() => {});
  }, []);

  // ساخت از روی پیش‌فاکتور: داده‌ی پیش‌پر را یک‌بار برمی‌دارد (فقط فرم «جدید»)
  useEffect(() => {
    if (editId || hasPersistedState(cacheKey)) return;
    const p = takeFormPrefill<MacroFromQuotePrefill | MacroFromReceiptPrefill | MacroFromPaymentPrefill>("/assistant-macros/new");
    if (!p) return;
    if ("actionKey" in p) {
      setForm({ ...DEFAULT_FORM, actionKey: p.actionKey, description: p.description, modes: { ...DEFAULT_FORM.modes, description: p.description ? "FIXED" : "DEFAULT" }, instruments: toPInstruments(p.instruments), subjects: toPSubjects(p.subjects as any) });
      return;
    }
    setForm({
      ...DEFAULT_FORM,
      salesTypeId: String(p.salesTypeId),
      salesCenterId: String(p.salesCenterId),
      description: p.description,
      modes: { salesType: "FIXED", salesCenter: "FIXED", description: p.description ? "FIXED" : "DEFAULT", discountPercent: "DEFAULT" },
      lines: p.lines.map((l) => ({ goodsItemId: String(l.goodsItemId), quantity: String(l.quantity), ask: false })),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!editId) return;
    api
      .get(`/assistant-macros/${editId}`)
      .then((m: Macro) => {
        if (!hasPersistedState(cacheKey))
          setForm({ phrase: m.phrase, actionKey: m.actionKey, salesTypeId: m.salesTypeId ? String(m.salesTypeId) : "", salesCenterId: m.salesCenterId ? String(m.salesCenterId) : "", description: m.description, discountPercent: m.discountPercent ? String(m.discountPercent) : "", modes: modesOf(m), lines: m.lines.map((l) => ({ goodsItemId: String(l.goodsItemId), quantity: l.quantity === null ? "" : String(l.quantity), ask: l.askQuantity })), instruments: toPInstruments((m.receiptPreset ?? m.paymentPreset)?.instruments), subjects: toPSubjects((m.receiptPreset ?? m.paymentPreset)?.subjects as any), customerMode: (m.receiptPreset?.customerId ?? m.paymentPreset?.partyId) ? "FIXED" : "ASK", customerId: String(m.receiptPreset?.customerId ?? m.paymentPreset?.partyId ?? ""), roleIds: m.roleIds, isActive: m.isActive });
        setLoaded(true);
      })
      .catch((e) => {
        setError(e.message);
        setLoaded(true);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  function toggleRole(id: number) {
    setForm({ ...form, roleIds: form.roleIds.includes(id) ? form.roleIds.filter((r) => r !== id) : [...form.roleIds, id] });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.phrase.trim()) return setError("عبارت دستور الزامی است");
    const lines = supports("lines") ? form.lines.filter((l) => l.goodsItemId) : [];
    if (lines.some((l) => !l.ask && !(Number(l.quantity) > 0))) return setError("مقدار هر قلم ثابت را وارد کنید (یا «مقدار را بپرس» را بزنید)");
    const fixed = (k: string) => supports(k) && form.modes[k] === "FIXED";
    const modeFields = MODE_FIELDS.filter((f) => supports(f.key));
    for (const f of modeFields) {
      const v = f.key === "salesType" ? form.salesTypeId : f.key === "salesCenter" ? form.salesCenterId : f.key === "description" ? form.description.trim() : form.discountPercent;
      if (fixed(f.key) && !v) return setError(`برای «${f.title}» حالت «ثابت» انتخاب شده ولی مقداری وارد نشده است`);
    }
    const askFields = modeFields.filter((f) => form.modes[f.key] === "ASK").map((f) => f.key);
    const fixedCustomer = kind !== null && (form.customerMode ?? "ASK") === "FIXED";
    if (fixedCustomer && !form.customerId) return setError(kind === "payment" ? "برای «طرف حساب» حالت «ثابت» انتخاب شده ولی طرف حسابی انتخاب نشده است" : "برای «مشتری» حالت «ثابت» انتخاب شده ولی مشتری انتخاب نشده است");
    const usePreset = kind !== null && (instruments.length > 0 || fixedCustomer);
    if (kind !== null) {
      if (subjects.length && !instruments.length) return setError("برای موضوعات، دست‌کم یک ابزار تعریف کنید");
      if (subjects.some((x) => !x.typeId)) return setError(kind === "payment" ? "نوع پرداخت هر موضوع را انتخاب کنید" : "نوع دریافت هر موضوع را انتخاب کنید");
    }
    if (!modeFields.some((f) => form.modes[f.key] !== "DEFAULT") && !lines.length && !usePreset) return setError(supports("lines") ? "دست‌کم یک فیلد را «ثابت» یا «بپرس» کنید یا اقلام ثابت بگذارید" : "شرح را «ثابت» یا «بپرس» کنید یا ابزار/موضوعات را تعریف کنید");
    const body = {
      phrase: form.phrase,
      actionKey: form.actionKey,
      roleIds: form.roleIds,
      isActive: form.isActive,
      salesTypeId: fixed("salesType") ? Number(form.salesTypeId) : null,
      salesCenterId: fixed("salesCenter") ? Number(form.salesCenterId) : null,
      description: fixed("description") ? form.description : "",
      discountPercent: fixed("discountPercent") ? Number(form.discountPercent) : null,
      askFields,
      receiptPreset:
        usePreset && kind === "receipt"
          ? {
              instruments: instruments.map((r) => ({ type: r.type, cashBoxId: r.cashBoxId ? Number(r.cashBoxId) : null, bankAccountId: r.bankAccountId ? Number(r.bankAccountId) : null, cardReaderId: r.cardReaderId ? Number(r.cardReaderId) : null })),
              subjects: subjects.map((x) => ({ receiptTypeId: Number(x.typeId), instrument: Number(x.instrument) || 0 })),
              customerId: fixedCustomer ? Number(form.customerId) : null,
            }
          : null,
      paymentPreset:
        usePreset && kind === "payment"
          ? {
              instruments: instruments.map((r) => ({ type: r.type, cashBoxId: r.cashBoxId ? Number(r.cashBoxId) : null, bankAccountId: r.bankAccountId ? Number(r.bankAccountId) : null })),
              subjects: subjects.map((x) => ({ paymentTypeId: Number(x.typeId), instrument: Number(x.instrument) || 0 })),
              partyId: fixedCustomer ? Number(form.customerId) : null,
            }
          : null,
      lines: lines.map((l) => ({ goodsItemId: Number(l.goodsItemId), quantity: l.ask ? null : Number(l.quantity), askQuantity: l.ask })),
    };
    try {
      if (editId) {
        await api.put(`/assistant-macros/${editId}`, body);
        flash();
      } else {
        const created = await api.post("/assistant-macros", body);
        flash();
        navigate(`/assistant-macros/${created.id}/edit`);
      }
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/assistant-macros/${editId}`);
      navigate("/assistant-macros");
    } catch (err) {
      showError((err as ApiError).message);
    }
  }

  if (!loaded) return null;

  return (
    <FormPage
      title={editId ? "ویرایش دستور میانبر" : "دستور میانبر جدید"}
      formId="assistant-macro-form"
      closePath="/assistant-macros"
      newPath="/assistant-macros/new"
      onDelete={editId ? handleDelete : undefined}
    >
      <form id="assistant-macro-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        <div className="form-grid">
          <div className="form-field">
            <label>عبارت دستور<RequiredMark /></label>
            <input value={form.phrase} onChange={(e) => setForm({ ...form, phrase: e.target.value })} placeholder="مثلاً: پیش‌فاکتور شمال" autoFocus />
          </div>
          <div className="form-field">
            <label>کار<RequiredMark /></label>
            <select value={form.actionKey} onChange={(e) => setForm({ ...form, actionKey: e.target.value, instruments: [], subjects: [], customerMode: "ASK", customerId: "" })}>
              {actions.map((a) => (
                <option key={a.key} value={a.key}>{a.title}</option>
              ))}
            </select>
          </div>
          {supports("salesType") && (
          <div className="form-field">
            <label>نوع فروش</label>
            <select value={form.modes.salesType} onChange={(e) => setForm({ ...form, modes: { ...form.modes, salesType: e.target.value as Mode } })} style={{ marginBottom: 4 }}>
              <option value="DEFAULT">پیش‌فرض دستیار</option>
              <option value="FIXED">ثابت</option>
              <option value="ASK">حتماً بپرس</option>
            </select>
            {form.modes.salesType === "FIXED" && (
              <select value={form.salesTypeId} onChange={(e) => setForm({ ...form, salesTypeId: e.target.value })}>
                <option value="">— انتخاب —</option>
                {opts.salesTypes.map((x) => (
                  <option key={x.id} value={x.id}>{x.title}</option>
                ))}
              </select>
            )}
          </div>
          )}
          {supports("salesCenter") && (
          <div className="form-field">
            <label>مرکز فروش</label>
            <select value={form.modes.salesCenter} onChange={(e) => setForm({ ...form, modes: { ...form.modes, salesCenter: e.target.value as Mode } })} style={{ marginBottom: 4 }}>
              <option value="DEFAULT">پیش‌فرض دستیار</option>
              <option value="FIXED">ثابت</option>
              <option value="ASK">حتماً بپرس</option>
            </select>
            {form.modes.salesCenter === "FIXED" && (
              <select value={form.salesCenterId} onChange={(e) => setForm({ ...form, salesCenterId: e.target.value })}>
                <option value="">— انتخاب —</option>
                {opts.salesCenters.map((c) => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
            )}
          </div>
          )}
          <div className="form-field">
            <label>شرح</label>
            <select value={form.modes.description} onChange={(e) => setForm({ ...form, modes: { ...form.modes, description: e.target.value as Mode } })} style={{ marginBottom: 4 }}>
              <option value="DEFAULT">پیش‌فرض دستیار</option>
              <option value="FIXED">ثابت</option>
              <option value="ASK">حتماً بپرس</option>
            </select>
            {form.modes.description === "FIXED" && <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />}
          </div>
          {supports("discountPercent") && (
          <div className="form-field">
            <label>تخفیف (درصد)</label>
            <select value={form.modes.discountPercent} onChange={(e) => setForm({ ...form, modes: { ...form.modes, discountPercent: e.target.value as Mode } })} style={{ marginBottom: 4 }}>
              <option value="DEFAULT">پیش‌فرض دستیار</option>
              <option value="FIXED">ثابت</option>
              <option value="ASK">حتماً بپرس</option>
            </select>
            {form.modes.discountPercent === "FIXED" && <input type="number" min={0} max={100} step="any" value={form.discountPercent} onChange={(e) => setForm({ ...form, discountPercent: e.target.value })} />}
          </div>
          )}
          <div className="form-field">
            <label className="checkbox-row">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
              فعال
            </label>
          </div>
        </div>
        {supports("lines") && (
        <div className="form-field" style={{ marginTop: 12 }}>
          <label>
            اقلام ثابت
            <InfoHint text="اگر قلمی اینجا بگذارید، با هر بار استفاده از این دستور همان کالا در پیش‌فاکتور می‌آید؛ مقدارش یا ثابت است یا (با «مقدار را بپرس») دستیار برای هر قلم جدا می‌پرسد «… چند عدد؟». مشتری را همیشه کاربر می‌گوید و اقلامی که کاربر خودش بگوید به این‌ها اضافه می‌شود. بدون اقلام ثابت، اقلام از کاربر پرسیده می‌شود." title="اقلام ثابت" />
          </label>
          <table className="je-lines-table">
            <thead>
              <tr>
                <th>کالا</th>
                <th style={{ width: 200 }}>مقدار</th>
                <th style={{ width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {form.lines.map((l, idx) => {
                const g = goods.find((x) => x.id === Number(l.goodsItemId));
                return (
                  <tr key={idx}>
                    <td>
                      <RecordPickerField
                        title="انتخاب کالا"
                        displayValue={g ? `${toFaDigits(g.fullCode)} — ${g.title}` : ""}
                        rows={goods.filter((x) => x.isActive)}
                        columns={[
                          { header: "کد", render: (x: GoodsOpt) => toFaDigits(x.fullCode), filterValue: (x: GoodsOpt) => x.fullCode, width: "110px" },
                          { header: "عنوان", render: (x: GoodsOpt) => x.title, filterValue: (x: GoodsOpt) => x.title },
                        ]}
                        onSelect={(x: GoodsOpt) => setForm({ ...form, lines: form.lines.map((r, i) => (i === idx ? { ...r, goodsItemId: String(x.id) } : r)) })}
                      />
                    </td>
                    <td>
                      {!l.ask && <AmountInput value={l.quantity} onChange={(v) => setForm({ ...form, lines: form.lines.map((r, i) => (i === idx ? { ...r, quantity: v } : r)) })} allowDecimal />}
                      <label className="checkbox-row" style={{ marginTop: 2 }}>
                        <input type="checkbox" checked={l.ask} onChange={(e) => setForm({ ...form, lines: form.lines.map((r, i) => (i === idx ? { ...r, ask: e.target.checked } : r)) })} />
                        مقدار را بپرس
                      </label>
                    </td>
                    <td>
                      <button type="button" className="icon-btn" title="حذف ردیف" onClick={() => setForm({ ...form, lines: form.lines.filter((_, i) => i !== idx) })}>✕</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <button type="button" className="btn-secondary" style={{ marginTop: 6 }} onClick={() => setForm({ ...form, lines: [...form.lines, { goodsItemId: "", quantity: "1", ask: false }] })}>
            + قلم ثابت
          </button>
        </div>
        )}
        {kind !== null && (
          <div className="form-field" style={{ marginTop: 12, maxWidth: 420 }}>
            <label>
              {kind === "payment" ? "طرف حساب" : "مشتری"}
              <InfoHint text={kind === "payment" ? "«ثابت»: همیشه همین طرف حساب (مثلاً یک تأمین‌کننده‌ی ثابت) و از کاربر پرسیده نمی‌شود. «از کاربر»: دستیار طرف حساب را می‌پرسد. مبلغ: وقتی ابزار/موضوع از پیش تعیین شده باشد، چون بعداً در فرم قابل ویرایش نیست، دستیار همیشه مبلغ را می‌پرسد." : "«ثابت»: همیشه همین مشتری (مثلاً «متفرقه» برای دریافت از کارتخوان) و از کاربر پرسیده نمی‌شود. «از کاربر»: دستیار مشتری را می‌پرسد. مبلغ: وقتی ابزار/موضوع از پیش تعیین شده باشد، چون بعداً در فرم قابل ویرایش نیست، دستیار همیشه مبلغ را می‌پرسد."} title={kind === "payment" ? "طرف حساب و مبلغ" : "مشتری و مبلغ"} />
            </label>
            <select value={form.customerMode ?? "ASK"} onChange={(e) => setForm({ ...form, customerMode: e.target.value as "ASK" | "FIXED" })} style={{ marginBottom: 4 }}>
              <option value="ASK">از کاربر پرسیده شود</option>
              <option value="FIXED">ثابت</option>
            </select>
            {(form.customerMode ?? "ASK") === "FIXED" && kind === "receipt" && (
              <select value={form.customerId ?? ""} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
                <option value="">— انتخاب —</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.party.detailTitle}</option>
                ))}
              </select>
            )}
            {(form.customerMode ?? "ASK") === "FIXED" && kind === "payment" && (
              <RecordPickerField
                title="انتخاب طرف حساب"
                displayValue={parties.find((p) => String(p.id) === form.customerId)?.detailTitle ?? ""}
                rows={parties.filter((p) => p.isActive)}
                columns={[
                  { header: "کد", render: (p: { detailCode: string }) => toFaDigits(p.detailCode), filterValue: (p: { detailCode: string }) => p.detailCode, width: "100px" },
                  { header: "عنوان", render: (p: { detailTitle: string }) => p.detailTitle, filterValue: (p: { detailTitle: string }) => p.detailTitle },
                ]}
                onSelect={(p: { id: number }) => setForm({ ...form, customerId: String(p.id) })}
              />
            )}
          </div>
        )}
        {kind !== null && (
          <div className="form-field" style={{ marginTop: 12 }}>
            <label>
              {kind === "payment" ? "ابزارهای پرداخت" : "ابزارهای دریافت"}
              <InfoHint text={kind === "payment" ? "ابزار (نقد، حواله، چک، چک انتقالی) و صندوق/حساب بانکیِ هر ردیف از پیش تعیین می‌شود. مبلغ و جزئیات چک (نوع چک، دسته چک و …) را کاربر در فرم می‌نویسد؛ اگر کاربر مبلغ را در دستور بگوید، به ردیف اول ابزار (و اولین موضوعش) می‌رسد." : "ابزار (نقد، حواله، چک، پوز) و صندوق/حساب/کارتخوانِ هر ردیف از پیش تعیین می‌شود. مبلغ و جزئیات چک را کاربر در فرم می‌نویسد؛ اگر کاربر مبلغ را در دستور بگوید، به ردیف اول ابزار (و اولین موضوعش) می‌رسد."} title={kind === "payment" ? "ابزارهای پرداخت" : "ابزارهای دریافت"} />
            </label>
            <table className="je-lines-table">
              <thead>
                <tr>
                  <th style={{ width: 170 }}>ابزار</th>
                  <th>صندوق / حساب بانکی / کارتخوان</th>
                  <th style={{ width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {instruments.map((r, idx) => {
                  const upd = (patch: Partial<PInstrument>) => setForm({ ...form, instruments: instruments.map((x, i) => (i === idx ? { ...x, ...patch } : x)) });
                  return (
                    <tr key={idx}>
                      <td>
                        <select value={r.type} onChange={(e) => upd({ type: e.target.value as PType, cashBoxId: "", bankAccountId: "", cardReaderId: "" })}>
                          {KIND_PTYPES[kind ?? "receipt"].map((t) => (
                            <option key={t} value={t}>{PTYPE_FA[t]}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        {r.type === "CHEQUE_TRANSFER" && <span style={{ color: "var(--ink-soft)" }}>چکِ دریافتیِ قابل خرج‌کردن را کاربر در فرم انتخاب می‌کند</span>}
                        {kind === "payment" && r.type === "CHEQUE" && (
                          <select value={r.bankAccountId} onChange={(e) => upd({ bankAccountId: e.target.value })}>
                            <option value="">— حساب صادرکننده در فرم انتخاب شود —</option>
                            {bankAccounts.filter((b) => b.accountType?.hasChequeBook).map((b) => (
                              <option key={b.id} value={b.id}>{b.detailTitle}</option>
                            ))}
                          </select>
                        )}
                        {r.type === "CASH" && (
                          <select value={r.cashBoxId} onChange={(e) => upd({ cashBoxId: e.target.value })}>
                            <option value="">— در فرم انتخاب شود —</option>
                            {cashBoxes.map((c) => (
                              <option key={c.id} value={c.id}>{c.title}</option>
                            ))}
                          </select>
                        )}
                        {r.type === "BANK_TRANSFER" && (
                          <select value={r.bankAccountId} onChange={(e) => upd({ bankAccountId: e.target.value })}>
                            <option value="">— در فرم انتخاب شود —</option>
                            {bankAccounts.map((b) => (
                              <option key={b.id} value={b.id}>{b.detailTitle}</option>
                            ))}
                          </select>
                        )}
                        {r.type === "POS" && (
                          <select value={r.cardReaderId} onChange={(e) => upd({ cardReaderId: e.target.value })}>
                            <option value="">— در فرم انتخاب شود —</option>
                            {cardReaders.map((c) => (
                              <option key={c.id} value={c.id}>{c.title}</option>
                            ))}
                          </select>
                        )}
                        {kind === "receipt" && r.type === "CHEQUE" && <span style={{ color: "var(--ink-soft)" }}>شماره، سررسید و بانک چک را کاربر در فرم می‌نویسد</span>}
                        {kind === "payment" && r.type === "CHEQUE" && <span style={{ color: "var(--ink-soft)", display: "block", marginTop: 2 }}>نوع چک، دسته چک و سررسید را کاربر در فرم می‌نویسد</span>}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="icon-btn"
                          title="حذف ردیف"
                          onClick={() =>
                            setForm({
                              ...form,
                              instruments: instruments.filter((_, i) => i !== idx),
                              // موضوعاتِ این ابزار حذف می‌شوند و شماره‌ی ابزارِ بعدی‌ها یکی کم می‌شود
                              subjects: subjects.filter((x) => Number(x.instrument) !== idx).map((x) => (Number(x.instrument) > idx ? { ...x, instrument: String(Number(x.instrument) - 1) } : x)),
                            })
                          }
                        >✕</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <button type="button" className="btn-secondary" style={{ marginTop: 6 }} onClick={() => setForm({ ...form, instruments: [...instruments, { type: "CASH", cashBoxId: "", bankAccountId: "", cardReaderId: "" }] })}>
              + ابزار
            </button>
          </div>
        )}
        {kind !== null && instruments.length > 0 && (
          <div className="form-field" style={{ marginTop: 12 }}>
            <label>
              {kind === "payment" ? "موضوعات پرداخت" : "موضوعات دریافت"}
              <InfoHint text={kind === "payment" ? "نوع پرداخت هر موضوع (و ابزاری که با آن پرداخت می‌شود) از پیش تعیین می‌شود؛ طرف حساب همان طرف حساب دستور است. مبنا (فاکتور/سفارش) و مبلغ را کاربر در فرم کامل می‌کند." : "نوع دریافت هر موضوع (و ابزاری که از آن تسویه می‌شود) از پیش تعیین می‌شود؛ طرف حساب همان مشتری دستور است. مبنا (فاکتور/سفارش) و مبلغ را کاربر در فرم کامل می‌کند."} title={kind === "payment" ? "موضوعات پرداخت" : "موضوعات دریافت"} />
            </label>
            <table className="je-lines-table">
              <thead>
                <tr>
                  <th>نوع دریافت</th>
                  <th style={{ width: 220 }}>ابزار</th>
                  <th style={{ width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {subjects.map((x, idx) => {
                  const upd = (patch: Partial<PSubject>) => setForm({ ...form, subjects: subjects.map((r, i) => (i === idx ? { ...r, ...patch } : r)) });
                  return (
                    <tr key={idx}>
                      <td>
                        <select value={x.typeId} onChange={(e) => upd({ typeId: e.target.value })}>
                          <option value="">— انتخاب —</option>
                          {(kind === "payment" ? paymentTypes : receiptTypes).filter((t) => t.isActive || String(t.id) === x.typeId).map((t) => (
                            <option key={t.id} value={t.id}>{t.title}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select value={x.instrument} onChange={(e) => upd({ instrument: e.target.value })}>
                          {instruments.map((r, i) => (
                            <option key={i} value={i}>{`ردیف ${toFaDigits(String(i + 1))} - ${PTYPE_FA[r.type]}`}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <button type="button" className="icon-btn" title="حذف ردیف" onClick={() => setForm({ ...form, subjects: subjects.filter((_, i) => i !== idx) })}>✕</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <button type="button" className="btn-secondary" style={{ marginTop: 6 }} onClick={() => setForm({ ...form, subjects: [...subjects, { typeId: "", instrument: "0" }] })}>
              + موضوع
            </button>
          </div>
        )}
        <div className="form-field" style={{ marginTop: 12 }}>
          <label>
            نقش‌های مجاز
            <InfoHint text="هیچ نقشی انتخاب نشود یعنی همه‌ی کاربرانی که دسترسی خودِ کار (مثلاً ثبت پیش‌فاکتور) را دارند. با انتخاب نقش، فقط کاربران دارای آن نقش می‌توانند از این دستور استفاده کنند. مدیر سیستم همیشه مجاز است." title="نقش‌های مجاز" />
          </label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 18px" }}>
            {opts.roles.map((r) => (
              <label key={r.id} className="checkbox-row">
                <input type="checkbox" checked={form.roleIds.includes(r.id)} onChange={() => toggleRole(r.id)} />
                {r.title}
              </label>
            ))}
          </div>
        </div>
      </form>
    </FormPage>
  );
}
