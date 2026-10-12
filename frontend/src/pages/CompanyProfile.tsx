import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { ErrorToast } from "../components/ErrorToast";
import { FormPage } from "../components/FormPage";
import { FieldHint } from "../components/FieldHint";
import { RequiredMark } from "../components/RequiredMark";
import { api, ApiError } from "../lib/api";
import { refreshBranding } from "../lib/branding";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState } from "../lib/usePersistedState";

// «مشخصات شرکت» — یک رکورد در هر نصب. در قالب‌های چاپ به‌عنوان «فروشنده» (company.*) می‌آید: نام و شناسه‌ها، تلفن و نشانی، لوگو، مهر و امضا،
// و حساب‌های بانکیِ قابل‌چاپ (جدا از حساب‌های بانکی سیستم؛ فقط برای نمایش روی اسناد). تصویرها در دیتابیس ذخیره می‌شوند (حداکثر ۳ مگابایت).

interface BankRow { bankName: string; branch: string; accountNumber: string; iban: string }
interface TextForm {
  name: string;
  economicCode: string;
  registrationNumber: string;
  nationalId: string;
  phone: string;
  postalCode: string;
  website: string;
  address: string;
  bankAccounts: BankRow[];
}
interface Image { dataUri: string | null; changed: boolean; name: string }

const EMPTY: TextForm = { name: "", economicCode: "", registrationNumber: "", nationalId: "", phone: "", postalCode: "", website: "", address: "", bankAccounts: [] };
const MAX_BANKS = 6;
const MAX_BYTES = 3 * 1024 * 1024;

function toPayload(img: Image): { name: string; mimeType: string; dataBase64: string } | null | undefined {
  if (!img.changed) return undefined;
  if (!img.dataUri) return null;
  const m = /^data:([^;]+);base64,(.*)$/.exec(img.dataUri);
  if (!m) return null;
  return { name: img.name, mimeType: m[1], dataBase64: m[2] };
}

function ImageField({ label, hint, value, onChange }: { label: string; hint: string; value: Image; onChange: (v: Image) => void }) {
  const [error, setError] = useState<string | null>(null);
  function pick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) return setError("فقط تصویر png، jpeg، webp یا gif");
    if (file.size > MAX_BYTES) return setError("حجم تصویر بیش از ۳ مگابایت است");
    const reader = new FileReader();
    reader.onload = () => onChange({ dataUri: String(reader.result), changed: true, name: file.name });
    reader.readAsDataURL(file);
  }
  return (
    <div className="form-field">
      <label>{label} <FieldHint label={label} text={hint} /></label>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ border: "1px dashed var(--border, #bbb)", borderRadius: 6, minHeight: 90, display: "flex", alignItems: "center", justifyContent: "center", background: "#fff", padding: 6 }}>
          {value.dataUri ? <img src={value.dataUri} alt={label} style={{ maxWidth: "100%", maxHeight: 110 }} /> : <span style={{ color: "#888", fontSize: 12 }}>تصویری انتخاب نشده</span>}
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={pick} />
          {value.dataUri && (
            <button type="button" className="btn secondary" onClick={() => onChange({ dataUri: null, changed: true, name: "" })}>حذف</button>
          )}
        </div>
        {error && <span style={{ color: "var(--danger)", fontSize: 12 }}>{error}</span>}
      </div>
    </div>
  );
}

export default function CompanyProfile() {
  const cacheKey = "form:/company-profile:form";
  const [form, setForm] = usePersistedState<TextForm>(cacheKey, EMPTY);
  // تصویرها عمداً در state معمولی‌اند (base64 درشت است و نباید در ذخیره‌ی موقت فرم‌ها بنشیند)
  const [logo, setLogo] = useState<Image>({ dataUri: null, changed: false, name: "" });
  const [stamp, setStamp] = useState<Image>({ dataUri: null, changed: false, name: "" });
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const { flash } = useSavedFlash();

  async function load() {
    const c = await api.get("/company-profile");
    setForm({
      name: c.name,
      economicCode: c.economicCode,
      registrationNumber: c.registrationNumber,
      nationalId: c.nationalId,
      phone: c.phone,
      postalCode: c.postalCode,
      website: c.website,
      address: c.address,
      bankAccounts: c.bankAccounts,
    });
    setLogo({ dataUri: c.logo, changed: false, name: "" });
    setStamp({ dataUri: c.stamp, changed: false, name: "" });
  }

  useEffect(() => {
    load()
      .catch((e) => setError((e as ApiError).message))
      .finally(() => setLoaded(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setBank(i: number, patch: Partial<BankRow>) {
    setForm({ ...form, bankAccounts: form.bankAccounts.map((b, idx) => (idx === i ? { ...b, ...patch } : b)) });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) return setError("نام شرکت الزامی است");
    try {
      await api.put("/company-profile", { ...form, logo: toPayload(logo), stamp: toPayload(stamp) });
      flash();
      // عنوان/آیکن تب با نام و لوگوی تازه هماهنگ شود
      void refreshBranding();
      await load();
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  if (!loaded) return null;

  return (
    <FormPage title="مشخصات شرکت" formId="company-profile-form" closePath="/" description="مشخصات فروشنده در قالب‌های چاپ اسناد (پیش‌فاکتور و …)">
      <form id="company-profile-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        <div className="form-grid">
          <div className="form-field full">
            <label>نام شرکت<RequiredMark /></label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
          </div>
          <div className="form-field">
            <label>شماره اقتصادی</label>
            <input dir="ltr" value={form.economicCode} onChange={(e) => setForm({ ...form, economicCode: e.target.value })} />
          </div>
          <div className="form-field">
            <label>شماره ثبت</label>
            <input dir="ltr" value={form.registrationNumber} onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })} />
          </div>
          <div className="form-field">
            <label>کد ملی / شناسه ملی</label>
            <input dir="ltr" value={form.nationalId} onChange={(e) => setForm({ ...form, nationalId: e.target.value })} />
          </div>
          <div className="form-field">
            <label>تلفن</label>
            <input dir="ltr" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="form-field">
            <label>کد پستی</label>
            <input dir="ltr" value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} />
          </div>
          <div className="form-field">
            <label>وب‌سایت</label>
            <input dir="ltr" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
          </div>
          <div className="form-field full">
            <label>نشانی</label>
            <textarea rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <ImageField label="لوگو" hint="در سربرگ قالب‌های چاپ؛ تصویر با پس‌زمینه‌ی شفاف (png) بهتر است" value={logo} onChange={setLogo} />
          <ImageField label="مهر و امضا" hint="در کادر «مهر و امضاء فروشنده» اسناد چاپی؛ تصویر شفاف (png) بهتر است. تصویر کوچک‌تر، چاپ سبک‌تر و سریع‌تر" value={stamp} onChange={setStamp} />
          <div className="form-field full">
            <label>
              حساب‌های بانکی قابل چاپ
              <FieldHint label="حساب‌های بانکی" text="فقط برای نمایش روی اسناد چاپی (مثلاً پیش‌فاکتور)؛ با حساب‌های بانکیِ بخش اطلاعات پایه ارتباطی ندارند. حداکثر ۶ حساب" />
            </label>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%" }}>
              {form.bankAccounts.map((b, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.2fr 2fr auto", gap: 6, alignItems: "center" }}>
                  <input placeholder="بانک" value={b.bankName} onChange={(e) => setBank(i, { bankName: e.target.value })} />
                  <input placeholder="شعبه" value={b.branch} onChange={(e) => setBank(i, { branch: e.target.value })} />
                  <input dir="ltr" placeholder="شماره حساب" value={b.accountNumber} onChange={(e) => setBank(i, { accountNumber: e.target.value })} />
                  <input dir="ltr" placeholder="شماره شبا (IR…)" value={b.iban} onChange={(e) => setBank(i, { iban: e.target.value })} />
                  <button type="button" className="btn secondary" onClick={() => setForm({ ...form, bankAccounts: form.bankAccounts.filter((_, idx) => idx !== i) })}>حذف</button>
                </div>
              ))}
              <div>
                <button
                  type="button"
                  className="btn secondary"
                  disabled={form.bankAccounts.length >= MAX_BANKS}
                  onClick={() => setForm({ ...form, bankAccounts: [...form.bankAccounts, { bankName: "", branch: "", accountNumber: "", iban: "" }] })}
                >
                  افزودن حساب بانکی
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </FormPage>
  );
}
