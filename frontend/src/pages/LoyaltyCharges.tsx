import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ErrorToast } from "../components/ErrorToast";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { Modal } from "../components/Modal";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { InfoHint } from "../components/InfoHint";
import { FieldHint } from "../components/FieldHint";
import { RequiredMark } from "../components/RequiredMark";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { RecordPickerField } from "../components/RecordPicker";
import { MultiRecordPickerField } from "../components/MultiRecordPicker";
import { DescriptionField } from "../components/DescriptionField";
import { formatAmountFa, toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate, localTodayIso } from "../lib/formatDate";
import { api, ApiError } from "../lib/api";
import { showError } from "../lib/toast";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePermissions } from "../lib/usePermissions";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { formatChargeValue } from "./LoyaltyChargeTypes";

// باشگاه مشتریان › عملیات › «شارژ کارت وفاداری»: شارژ یک کارت با یکی از نوع‌های شارژ (تاریخ شارژ + انقضا). عملیات گروهی همین فهرست:
// «شارژ گروهی کارت‌ها» و «حذف شارژهای استفاده‌نشده». مانده/وضعیت از دریافت‌های فروش فروشگاهی مشتق می‌شود. قواعد در سرور (services/loyaltyService.ts).

interface ChargeRow {
  id: number;
  number: number;
  cardId: number;
  cardNumber: string;
  partyTitle: string;
  typeId: number;
  typeTitle: string;
  kind: "AMOUNT" | "PERCENT";
  kindTitle: string;
  value: number;
  singleUse: boolean;
  date: string;
  expiryDate: string | null;
  description: string;
  usedAmount: number;
  useCount: number;
  remaining: number | null;
  status: "ACTIVE" | "USED" | "EXPIRED";
  statusTitle: string;
}
interface CardOpt {
  id: number;
  cardNumber: string;
  partyTitle: string;
  isActive: boolean;
  expired: boolean;
}
interface TypeOpt {
  id: number;
  code: number;
  title: string;
  kind: "AMOUNT" | "PERCENT";
  kindTitle: string;
  value: number;
  isActive: boolean;
}

const cardCols = [
  { header: "شماره‌ی کارت", render: (c: CardOpt) => c.cardNumber, filterValue: (c: CardOpt) => c.cardNumber, width: "160px" },
  { header: "طرف‌حساب", render: (c: CardOpt) => c.partyTitle, filterValue: (c: CardOpt) => c.partyTitle },
];
const typeCols = [
  { header: "کد", render: (t: TypeOpt) => toFaDigits(String(t.code)), filterValue: (t: TypeOpt) => String(t.code), width: "70px" },
  { header: "عنوان", render: (t: TypeOpt) => t.title, filterValue: (t: TypeOpt) => t.title },
  { header: "نوع", render: (t: TypeOpt) => t.kindTitle, filterValue: (t: TypeOpt) => t.kindTitle, width: "80px" },
  { header: "مقدار", render: (t: TypeOpt) => formatChargeValue(t.kind, t.value), filterValue: (t: TypeOpt) => String(t.value), width: "120px" },
];
const typeLabel = (t: TypeOpt) => `${t.title} — ${formatChargeValue(t.kind, t.value)}`;

export default function LoyaltyCharges() {
  const location = useLocation();
  if (location.pathname.endsWith("/new")) return <ChargeForm />;
  return <ChargeList />;
}

function ChargeList() {
  const { hasPermission } = usePermissions();
  const canBulk = hasPermission("customer-club.operations.loyalty-charges.bulkCharge");
  const canDelete = hasPermission("customer-club.operations.loyalty-charges.delete");
  const cacheKey = "/loyalty-charges";
  const [items, setItems] = usePersistedState<ChargeRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  async function reload() {
    api.get("/loyalty-charges").then((r) => { setItems(r); setError(null); }).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // حذف شارژهای استفاده‌نشده: همه‌یا‌هیچ؛ سرور هم دوباره کنترل می‌کند
  async function doDelete(rs: ChargeRow[]) {
    const used = rs.filter((r) => r.useCount > 0);
    if (used.length) return showError(`شارژی که در فروش مصرف شده حذف نمی‌شود؛ ${toFaDigits(String(used.length))} شارژ انتخابی مصرف شده است`);
    if (!window.confirm(`${toFaDigits(String(rs.length))} شارژ حذف شود؟ این کار قابل بازگشت نیست.`)) return;
    try {
      await api.post("/loyalty-charges/delete", { ids: rs.map((r) => r.id) });
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  const s = (f: (r: ChargeRow) => string, extra: object = {}) => ({ render: (r: ChargeRow) => f(r), filterType: "string" as const, filterValue: (r: ChargeRow) => f(r), ...extra });
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint title="شارژ کارت وفاداری" text="هر ردیف یک شارژ روی یک کارت است. مانده و وضعیت (قابل استفاده / مصرف‌شده / منقضی) از مصرف در فروش فروشگاهی محاسبه می‌شود. شارژ گروهی و حذف شارژهای استفاده‌نشده در منوی «عملیات» بالای جدول است." />
          <NewRecordButton path="/loyalty-charges/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "شماره", ...s((r) => toFaDigits(String(r.number))), width: "80px" },
          { header: "شماره‌ی کارت", ...s((r) => r.cardNumber), width: "150px" },
          { header: "طرف‌حساب", ...s((r) => r.partyTitle) },
          { header: "نوع شارژ", ...s((r) => r.typeTitle) },
          { header: "نوع", ...s((r) => r.kindTitle), width: "80px" },
          { header: "مقدار", ...s((r) => formatChargeValue(r.kind, r.value)), width: "120px" },
          { header: "تاریخ شارژ", render: (r) => formatJalaliDate(r.date), filterType: "date", filterValue: (r) => r.date, width: "110px" },
          { header: "تاریخ انقضا", render: (r) => (r.expiryDate ? formatJalaliDate(r.expiryDate) : "—"), filterType: "date", filterValue: (r) => r.expiryDate ?? "", width: "110px" },
          { header: "مصرف‌شده", render: (r) => formatAmountFa(r.usedAmount), filterType: "number", filterValue: (r) => r.usedAmount, decimal: true, width: "110px" },
          { header: "مانده", render: (r) => (r.remaining === null ? "—" : formatAmountFa(r.remaining)), filterType: "number", filterValue: (r) => r.remaining ?? 0, decimal: true, width: "110px" },
          { header: "وضعیت", ...s((r) => r.statusTitle), width: "100px" },
        ]}
        rows={items}
        bulkActions={[
          ...(canBulk ? [{ label: () => "شارژ گروهی کارت‌ها", noSelection: true, onClick: () => setBulkOpen(true) }] : []),
          ...(canDelete ? [{ label: (n: number) => `حذف شارژهای استفاده‌نشده (${toFaDigits(String(n))})`, danger: true, onClick: doDelete }] : []),
        ]}
      />
      {bulkOpen && <BulkChargeDialog onClose={() => setBulkOpen(false)} onDone={async () => { setBulkOpen(false); await reload(); }} />}
    </div>
  );
}

function BulkChargeDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [cards, setCards] = useState<CardOpt[]>([]);
  const [types, setTypes] = useState<TypeOpt[]>([]);
  const [selected, setSelected] = useState<CardOpt[]>([]);
  const [all, setAll] = useState(false);
  const [typeId, setTypeId] = useState("");
  const [date, setDate] = useState(localTodayIso());
  const [expiry, setExpiry] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get("/loyalty-cards").then((r: CardOpt[]) => setCards(r.filter((c) => c.isActive && !c.expired))).catch(() => {});
    api.get("/loyalty-charge-types").then((r: TypeOpt[]) => setTypes(r.filter((t) => t.isActive))).catch(() => {});
  }, []);

  async function submit() {
    setError(null);
    if (!typeId) return setError("نوع شارژ را انتخاب کنید");
    if (!all && selected.length === 0) return setError("کارت‌ها را انتخاب کنید یا «همه‌ی کارت‌های فعال» را بزنید");
    if (busy) return;
    const count = all ? cards.length : selected.length;
    if (!window.confirm(`${toFaDigits(String(count))} کارت شارژ شود؟`)) return;
    setBusy(true);
    try {
      await api.post("/loyalty-charges/bulk", { typeId: Number(typeId), allActive: all, cardIds: all ? [] : selected.map((c) => c.id), date, expiryDate: expiry || null, description });
      onDone();
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }
  const type = types.find((t) => String(t.id) === typeId);
  return (
    <Modal title="شارژ گروهی کارت‌ها" onClose={onClose}>
      {error && <div className="alert warn" style={{ marginBottom: 8 }}>{error}</div>}
      <div className="form-grid">
        <div className="form-field">
          <label>نوع شارژ<RequiredMark /></label>
          <RecordPickerField<TypeOpt> title="انتخاب نوع شارژ" displayValue={type ? typeLabel(type) : ""} rows={types} columns={typeCols} onSelect={(t) => setTypeId(String(t.id))} />
        </div>
        <div className="form-field">
          <label className="checkbox-row"><input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> همه‌ی کارت‌های فعال ({toFaDigits(String(cards.length))})</label>
        </div>
        {!all && (
          <div className="form-field full">
            <label>کارت‌ها<RequiredMark /></label>
            <MultiRecordPickerField<CardOpt> title="انتخاب کارت‌ها" rows={cards} columns={cardCols} selected={selected} onChange={setSelected} getLabel={(c) => c.cardNumber} />
          </div>
        )}
        <div className="form-field">
          <label>تاریخ شارژ<RequiredMark /></label>
          <JalaliDatePicker value={date} onChange={setDate} />
        </div>
        <div className="form-field">
          <label>تاریخ انقضا <FieldHint label="تاریخ انقضا" text="اختیاری؛ خالی = بدون انقضا." /></label>
          <JalaliDatePicker value={expiry} onChange={setExpiry} />
        </div>
        <DescriptionField value={description} onChange={setDescription} />
      </div>
      <div className="actions" style={{ marginTop: 12 }}>
        <button type="button" className="btn" onClick={submit} disabled={busy}>شارژ</button>
        <button type="button" className="btn secondary" onClick={onClose}>انصراف</button>
      </div>
    </Modal>
  );
}

function ChargeForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = usePersistedState(`form:${location.pathname}:form`, { cardId: "", cardDisplay: "", typeId: "", date: localTodayIso(), expiryDate: "", description: "" });
  const [cards, setCards] = useState<CardOpt[]>([]);
  const [types, setTypes] = useState<TypeOpt[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { flash } = useSavedFlash();

  useEffect(() => {
    api.get("/loyalty-cards").then((r: CardOpt[]) => setCards(r.filter((c) => c.isActive && !c.expired))).catch(() => {});
    api.get("/loyalty-charge-types").then((r: TypeOpt[]) => setTypes(r.filter((t) => t.isActive))).catch(() => {});
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.cardId) return setError("کارت وفاداری را انتخاب کنید");
    if (!form.typeId) return setError("نوع شارژ را انتخاب کنید");
    if (busy) return;
    setBusy(true);
    try {
      await api.post("/loyalty-charges", { cardId: Number(form.cardId), typeId: Number(form.typeId), date: form.date, expiryDate: form.expiryDate || null, description: form.description });
      flash();
      navigate("/loyalty-charges");
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  const type = types.find((t) => String(t.id) === form.typeId);
  return (
    <FormPage title="شارژ کارت وفاداری" formId="loyalty-charge-form" closePath="/loyalty-charges" newPath="/loyalty-charges/new" saveDisabled={busy}>
      <form id="loyalty-charge-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        <div className="form-grid">
          <div className="form-field">
            <label>کارت وفاداری<RequiredMark /></label>
            <RecordPickerField<CardOpt> title="انتخاب کارت" displayValue={form.cardDisplay} rows={cards} columns={cardCols} onSelect={(c) => setForm({ ...form, cardId: String(c.id), cardDisplay: `${c.cardNumber} — ${c.partyTitle}` })} />
          </div>
          <div className="form-field">
            <label>نوع شارژ<RequiredMark /></label>
            <RecordPickerField<TypeOpt> title="انتخاب نوع شارژ" displayValue={type ? typeLabel(type) : ""} rows={types} columns={typeCols} onSelect={(t) => setForm({ ...form, typeId: String(t.id) })} />
          </div>
          <div className="form-field">
            <label>تاریخ شارژ<RequiredMark /></label>
            <JalaliDatePicker value={form.date} onChange={(v) => setForm({ ...form, date: v })} />
          </div>
          <div className="form-field">
            <label>تاریخ انقضا <FieldHint label="تاریخ انقضا" text="اختیاری؛ خالی = بدون انقضا." /></label>
            <JalaliDatePicker value={form.expiryDate} onChange={(v) => setForm({ ...form, expiryDate: v })} />
          </div>
          <DescriptionField value={form.description} onChange={(v) => setForm({ ...form, description: v })} />
        </div>
      </form>
    </FormPage>
  );
}
