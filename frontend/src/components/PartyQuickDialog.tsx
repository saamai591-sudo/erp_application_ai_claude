import { useEffect, useRef, useState } from "react";
import { Modal } from "./Modal";
import { ErrorToast } from "./ErrorToast";
import { RequiredMark } from "./RequiredMark";
import { api, ApiError } from "../lib/api";
import { toFaDigits } from "../lib/formatAmount";

// «تعریف سریع / ویرایش شخص» از فرم‌های نقش (فعلاً مشتری؛ بعداً تامین‌کننده/کارمند/...): همان فیلدهای تب «اطلاعات اصلی» فرم شخص حقیقی/حقوقی،
// بدون نشانی/تلفن/حساب بانکی (آن‌ها را بعداً می‌شود در فرم اطلاعات پایه افزود). ذخیره از طریق همان سرویس مشترک بک‌اند انجام می‌شود (SSOT).
// کد ملی/شناسه ملی و عنوان تفصیل تکراری بازدارنده است؛ با تایپ کد ملی، اگر شخص قبلاً (با هر نقشی) ثبت شده باشد پیشنهاد استفاده از همان شخص می‌آید.

export interface QuickParty {
  category: "INDIVIDUAL" | "LEGAL";
  nationality: "LOCAL" | "FOREIGN";
  firstName: string;
  lastName: string;
  name: string;
  legalType: "LEGAL" | "SPECIAL_PARTNERSHIP" | "BANK";
  nationalId: string;
  foreignId: string;
  economicCode: string;
  registrationNumber: string;
  detailTitle: string;
}

export const EMPTY_QUICK_PARTY: QuickParty = {
  category: "INDIVIDUAL",
  nationality: "LOCAL",
  firstName: "",
  lastName: "",
  name: "",
  legalType: "LEGAL",
  nationalId: "",
  foreignId: "",
  economicCode: "",
  registrationNumber: "",
  detailTitle: "",
};

interface Found {
  id: number;
  detailCode: string;
  detailTitle: string;
  category: string;
  roles: { customer: boolean; supplier: boolean; employee: boolean };
}

const ROLE_FA: Record<string, string> = { customer: "مشتری", supplier: "تامین‌کننده", employee: "کارمند" };

/** عنوان تفصیل پیش‌فرض از نام (تا وقتی کاربر دستی ویرایشش نکرده) */
export function suggestDetailTitle(p: Pick<QuickParty, "category" | "firstName" | "lastName" | "name">): string {
  return (p.category === "INDIVIDUAL" ? `${p.firstName} ${p.lastName}` : p.name).replace(/\s+/g, " ").trim();
}

export function PartyQuickDialog({
  mode,
  initial,
  onSubmit,
  onPickExisting,
  onClose,
}: {
  mode: "create" | "edit";
  initial?: Partial<QuickParty>;
  /** ذخیره؛ خطا throw شود (ApiError با warning ⇒ دکمه‌ی «بله، ادامه بده») */
  onSubmit: (party: QuickParty, confirmDuplicate: boolean) => Promise<void>;
  /** فقط در حالت create: کاربر «همین شخصِ موجود» را برگزید */
  onPickExisting?: (partyId: number) => void;
  onClose: () => void;
}) {
  const [p, setP] = useState<QuickParty>({ ...EMPTY_QUICK_PARTY, ...initial });
  const [titleTouched, setTitleTouched] = useState(mode === "edit");
  const [found, setFound] = useState<Found | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lookedUp = useRef("");

  function change(patch: Partial<QuickParty>) {
    setP((cur) => {
      const next = { ...cur, ...patch };
      if (!titleTouched) next.detailTitle = suggestDetailTitle(next);
      return next;
    });
  }

  // با خروج از فیلد کد ملی/شناسه ملی: آیا این شخص قبلاً ثبت شده؟
  async function lookup() {
    const id = p.nationalId.trim();
    if (mode !== "create" || p.nationality !== "LOCAL" || !id || lookedUp.current === id) return;
    lookedUp.current = id;
    try {
      setFound(await api.get(`/parties/lookup/by-national-id?nationalId=${encodeURIComponent(id)}`));
    } catch {
      setFound(null);
    }
  }
  useEffect(() => {
    if (!p.nationalId.trim()) setFound(null);
  }, [p.nationalId]);

  async function save(confirmDuplicate: boolean) {
    setError(null);
    if (p.category === "INDIVIDUAL" && (!p.firstName.trim() || !p.lastName.trim())) return setError("نام و نام خانوادگی الزامی است");
    if (p.category === "LEGAL" && !p.name.trim()) return setError("نام الزامی است");
    if (!p.detailTitle.trim()) return setError("عنوان تفصیل الزامی است");
    setBusy(true);
    try {
      await onSubmit(p, confirmDuplicate);
    } catch (e) {
      const err = e as ApiError;
      if (err.warning) setWarning(err.message);
      else setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const idLabel = p.category === "LEGAL" ? "شناسه ملی" : "کد ملی";

  return (
    <Modal title={mode === "create" ? "تعریف شخص جدید" : "ویرایش مشخصات شخص"} onClose={onClose} wide>
      <ErrorToast message={error} />
      {warning && (
        <div className="alert warn">
          {warning}
          <div style={{ marginTop: 8 }}>
            <button type="button" className="btn" style={{ padding: "5px 12px", fontSize: 12 }} onClick={() => { setWarning(null); void save(true); }}>
              بله، ادامه بده
            </button>
          </div>
        </div>
      )}
      {found && (
        <div className="alert warn">
          این {p.category === "LEGAL" ? "شناسه ملی" : "کد ملی"} قبلاً برای «{found.detailTitle}» (کد تفصیل {toFaDigits(found.detailCode)}) ثبت شده
          {Object.entries(found.roles).some(([, v]) => v) && <> — نقش‌های فعلی: {Object.entries(found.roles).filter(([, v]) => v).map(([k]) => ROLE_FA[k]).join("، ")}</>}.
          {onPickExisting && (
            <div style={{ marginTop: 8 }}>
              <button type="button" className="btn" style={{ padding: "5px 12px", fontSize: 12 }} onClick={() => onPickExisting(found.id)}>
                همین شخص را انتخاب کن
              </button>
            </div>
          )}
        </div>
      )}
      <div className="form-grid">
        <div className="form-field">
          <label>نوع شخص</label>
          <select value={p.category} disabled={mode === "edit"} onChange={(e) => change({ category: e.target.value as QuickParty["category"] })}>
            <option value="INDIVIDUAL">حقیقی</option>
            <option value="LEGAL">حقوقی</option>
          </select>
        </div>
        <div className="form-field">
          <label>تابعیت</label>
          <select value={p.nationality} onChange={(e) => change({ nationality: e.target.value as QuickParty["nationality"] })}>
            <option value="LOCAL">محلی</option>
            <option value="FOREIGN">خارجی</option>
          </select>
        </div>
        {p.category === "INDIVIDUAL" ? (
          <>
            <div className="form-field">
              <label>نام<RequiredMark /></label>
              <input value={p.firstName} onChange={(e) => change({ firstName: e.target.value })} autoFocus />
            </div>
            <div className="form-field">
              <label>نام خانوادگی<RequiredMark /></label>
              <input value={p.lastName} onChange={(e) => change({ lastName: e.target.value })} />
            </div>
          </>
        ) : (
          <>
            <div className="form-field">
              <label>نام<RequiredMark /></label>
              <input value={p.name} onChange={(e) => change({ name: e.target.value })} autoFocus />
            </div>
            <div className="form-field">
              <label>نوع</label>
              <select value={p.legalType} onChange={(e) => change({ legalType: e.target.value as QuickParty["legalType"] })}>
                <option value="LEGAL">حقوقی</option>
                <option value="SPECIAL_PARTNERSHIP">مشارکت خاص</option>
                <option value="BANK">بانک/موسسه مالی</option>
              </select>
            </div>
          </>
        )}
        {p.nationality === "LOCAL" ? (
          <div className="form-field">
            <label>{idLabel}</label>
            <input dir="ltr" value={p.nationalId} onChange={(e) => change({ nationalId: e.target.value })} onBlur={lookup} />
          </div>
        ) : (
          <div className="form-field">
            <label>کد فراگیر اتباع خارجی</label>
            <input dir="ltr" value={p.foreignId} onChange={(e) => change({ foreignId: e.target.value })} />
          </div>
        )}
        <div className="form-field">
          <label>کد اقتصادی</label>
          <input dir="ltr" value={p.economicCode} onChange={(e) => change({ economicCode: e.target.value })} />
        </div>
        {p.category === "LEGAL" && (
          <div className="form-field">
            <label>شماره ثبت</label>
            <input dir="ltr" value={p.registrationNumber} onChange={(e) => change({ registrationNumber: e.target.value })} />
          </div>
        )}
        <div className="form-field full">
          <label>عنوان تفصیل<RequiredMark /></label>
          <input
            value={p.detailTitle}
            onChange={(e) => {
              setTitleTouched(true);
              setP({ ...p, detailTitle: e.target.value });
            }}
          />
        </div>
        <p className="full" style={{ fontSize: 11.5, opacity: 0.75, gridColumn: "1 / -1", margin: 0 }}>
          عنوان تفصیل یکتاست و در سند حسابداری و گزارش‌ها نمایش داده می‌شود؛ دو شخص هم‌نام باید عنوان متفاوت داشته باشند. نشانی، تلفن و حساب بانکی را بعداً در «اطلاعات پایه ← اشخاص» اضافه کنید.
        </p>
      </div>
      <div className="actions">
        <button type="button" className="btn" disabled={busy} onClick={() => save(false)}>{mode === "create" ? "ثبت شخص" : "ذخیره"}</button>
        <button type="button" className="btn secondary" onClick={onClose}>انصراف</button>
      </div>
    </Modal>
  );
}
