import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ErrorToast } from "../components/ErrorToast";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { InfoHint } from "../components/InfoHint";
import { FieldHint } from "../components/FieldHint";
import { RequiredMark } from "../components/RequiredMark";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { RecordPickerField } from "../components/RecordPicker";
import { toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate, localTodayIso } from "../lib/formatDate";
import { api, ApiError } from "../lib/api";
import { showError } from "../lib/toast";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { partyDisplayName } from "../lib/partyDisplay";


// باشگاه مشتریان › عملیات › «کارت وفاداری»: طرف‌حساب + شماره‌ی کارت + کلمه‌ی عبور + تاریخ صدور/انقضا. کلمه‌ی عبور فقط به‌صورت هش نگهداری می‌شود
// و هنگام تسویه‌ی فروش فروشگاهی با کارت باید دوباره وارد شود. قواعد در سرور (services/loyaltyService.ts).

interface CardRow {
  id: number;
  partyId: number;
  partyTitle: string;
  cardNumber: string;
  issueDate: string;
  expiryDate: string | null;
  expired: boolean;
  isActive: boolean;
  chargeCount: number;
  updatedAt?: string;
}
interface PartyOpt {
  id: number;
  detailCode: string;
  category: "INDIVIDUAL" | "LEGAL";
  isActive: boolean;
  detailTitle?: string | null;
  firstName: string | null;
  lastName: string | null;
  name: string | null;
}

export default function LoyaltyCards() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <CardForm />;
  if (location.pathname.endsWith("/edit")) return <CardForm editId={Number(id)} />;
  return <CardList />;
}

function CardList() {
  const cacheKey = "/loyalty-cards";
  const [items, setItems] = usePersistedState<CardRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  async function reload() {
    api.get("/loyalty-cards").then((r) => { setItems(r); setError(null); }).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function onDelete(row: CardRow) {
    try {
      await api.del(`/loyalty-cards/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  const s = (f: (r: CardRow) => string, extra: object = {}) => ({ render: (r: CardRow) => f(r), filterType: "string" as const, filterValue: (r: CardRow) => f(r), ...extra });
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint title="کارت وفاداری" text="هر کارت به یک طرف‌حساب تعلق دارد و با شماره‌ی کارت + کلمه‌ی عبور در فروش فروشگاهی استفاده می‌شود. کارت را در «شارژ کارت وفاداری» شارژ کنید." />
          <NewRecordButton path="/loyalty-cards/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "شماره‌ی کارت", ...s((r) => r.cardNumber), width: "160px" },
          { header: "طرف‌حساب", ...s((r) => r.partyTitle) },
          { header: "تاریخ صدور", render: (r) => formatJalaliDate(r.issueDate), filterType: "date", filterValue: (r) => r.issueDate, width: "110px" },
          { header: "تاریخ انقضا", render: (r) => (r.expiryDate ? formatJalaliDate(r.expiryDate) : "—"), filterType: "date", filterValue: (r) => r.expiryDate ?? "", width: "110px" },
          { header: "وضعیت", ...s((r) => (!r.isActive ? "غیرفعال" : r.expired ? "منقضی" : "فعال")), width: "90px" },
          { header: "تعداد شارژ", ...s((r) => toFaDigits(String(r.chargeCount))), width: "100px" },
        ]}
        rows={items}
        edit={{ path: (r: CardRow) => `/loyalty-cards/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

const EMPTY = { partyId: "", partyDisplay: "", cardNumber: "", password: "", issueDate: localTodayIso(), expiryDate: "", isActive: true };

function CardForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const [form, setForm] = usePersistedState(cacheKey, EMPTY);
  const [parties, setParties] = useState<PartyOpt[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | undefined>();
  const [chargeCount, setChargeCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const { flash } = useSavedFlash();

  useEffect(() => {
    api.get("/parties").then((r: PartyOpt[]) => setParties(r)).catch(() => {});
  }, []);
  useEffect(() => {
    if (!editId) return;
    api.get(`/loyalty-cards/${editId}`).then((r: CardRow) => {
      setUpdatedAt(r.updatedAt);
      setChargeCount(r.chargeCount);
      if (!hasPersistedState(cacheKey)) setForm({ partyId: String(r.partyId), partyDisplay: r.partyTitle, cardNumber: r.cardNumber, password: "", issueDate: r.issueDate, expiryDate: r.expiryDate ?? "", isActive: r.isActive });
      setLoaded(true);
    }).catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.partyId) return setError("طرف‌حساب را انتخاب کنید");
    if (!form.cardNumber.trim()) return setError("شماره‌ی کارت الزامی است");
    if (!editId && !form.password) return setError("کلمه‌ی عبور الزامی است");
    const body = { partyId: Number(form.partyId), cardNumber: form.cardNumber, password: form.password, issueDate: form.issueDate, expiryDate: form.expiryDate || null, isActive: form.isActive, updatedAt };
    try {
      if (editId) {
        await api.put(`/loyalty-cards/${editId}`, body);
        flash();
        const r: CardRow = await api.get(`/loyalty-cards/${editId}`);
        setUpdatedAt(r.updatedAt);
        setForm({ ...form, password: "" });
      } else {
        const created = await api.post("/loyalty-cards", body);
        flash();
        navigate(`/loyalty-cards/${created.id}/edit`);
      }
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/loyalty-cards/${editId}`);
      navigate("/loyalty-cards");
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  if (!loaded) return null;
  return (
    <FormPage title={editId ? "ویرایش کارت وفاداری" : "کارت وفاداری جدید"} formId="loyalty-card-form" closePath="/loyalty-cards" newPath="/loyalty-cards/new" onDelete={editId ? handleDelete : undefined}>
      <form id="loyalty-card-form" onSubmit={onSubmit} autoComplete="off">
        <ErrorToast message={error} />
        <div className="form-grid">
          <div className="form-field">
            <label>طرف‌حساب<RequiredMark /></label>
            <RecordPickerField<PartyOpt>
              title="انتخاب طرف‌حساب"
              displayValue={form.partyDisplay}
              rows={parties.filter((p) => p.isActive || String(p.id) === form.partyId)}
              columns={[
                { header: "کد", render: (p) => toFaDigits(p.detailCode), filterValue: (p) => p.detailCode, width: "100px" },
                { header: "نام", render: (p) => partyDisplayName(p as any), filterValue: (p) => partyDisplayName(p as any) },
              ]}
              onSelect={(p) => setForm({ ...form, partyId: String(p.id), partyDisplay: partyDisplayName(p as any) })}
            />
          </div>
          <div className="form-field">
            <label>شماره‌ی کارت وفاداری<RequiredMark /> <FieldHint label="شماره‌ی کارت" text="یکتا در کل سیستم؛ هر مقداری می‌تواند باشد (بارکد/شماره‌ی چاپ‌شده روی کارت)." /></label>
            <input dir="ltr" value={form.cardNumber} onChange={(e) => setForm({ ...form, cardNumber: e.target.value })} maxLength={50} autoFocus />
          </div>
          <div className="form-field">
            <label>کلمه‌ی عبور{!editId && <RequiredMark />} <FieldHint label="کلمه‌ی عبور" text={editId ? "خالی = بدون تغییر. حداقل ۴ نویسه؛ فقط به‌صورت هش ذخیره می‌شود و بعداً قابل مشاهده نیست." : "حداقل ۴ نویسه؛ فقط به‌صورت هش ذخیره می‌شود و بعداً قابل مشاهده نیست."} /></label>
            <input type="text" className="pw-nosave" name="loyalty-pin" data-lpignore="true" data-1p-ignore autoComplete="off" spellCheck={false} dir="ltr" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder={editId ? "بدون تغییر" : ""} />
          </div>
          <div className="form-field">
            <label>تاریخ صدور<RequiredMark /></label>
            <JalaliDatePicker value={form.issueDate} onChange={(v) => setForm({ ...form, issueDate: v })} />
          </div>
          <div className="form-field">
            <label>تاریخ انقضا <FieldHint label="تاریخ انقضا" text="اختیاری؛ خالی = بدون انقضا. کارت منقضی‌شده شارژ نمی‌شود و در فروش پذیرفته نمی‌شود." /></label>
            <JalaliDatePicker value={form.expiryDate} onChange={(v) => setForm({ ...form, expiryDate: v })} />
          </div>
          <div className="form-field">
            <label className="checkbox-row"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> فعال</label>
          </div>
        </div>
        {editId && chargeCount > 0 && <p style={{ fontSize: 12, opacity: 0.7, marginTop: 10 }}>این کارت {toFaDigits(String(chargeCount))} شارژ دارد؛ تا وقتی شارژی دارد حذف نمی‌شود.</p>}
      </form>
    </FormPage>
  );
}
