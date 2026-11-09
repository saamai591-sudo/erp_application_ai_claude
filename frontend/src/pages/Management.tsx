import { useCallback, useEffect, useRef, useState } from "react";
import { formatJalaliDate } from "../lib/formatDate";
import { Branding, DEFAULT_TITLE, fetchBranding } from "../lib/branding";
import { ManagementBackup } from "../components/ManagementBackup";
import { ManagementUpdate } from "../components/ManagementUpdate";

// «مدیریت» (/management) — صفحه‌ی مستقل از ورود ERP برای فعال‌سازی و دیدن وضعیت لایسنس، با کلمه‌ی عبور خودش (در لایسنس است، نه کاربران ERP).
//   ۱) لایسنس معتبری ثبت نشده: «دانلود فایل اطلاعات سرور» + «بارگذاری فایل لایسنس». فیلد کلمه‌ی عبور بعد از انتخاب فایل باز می‌شود و همان
//      لحظه‌ی بارگذاری با هش داخل فایل سنجیده می‌شود.
//   ۲) لایسنس معتبر ثبت شده: فقط کلمه‌ی عبور؛ گزینه‌ی «لایسنس تازه دارم / کلمه‌ی عبور را فراموش کرده‌ام» همان بخش بارگذاری را باز می‌کند.
//   ۳) بعد از ورود: وضعیت لایسنس و بارگذاری لایسنس بعدی.
// این صفحه عمداً از `api` و توکن ERP استفاده نمی‌کند (نشست مدیریت جدا در sessionStorage).

import { API_URL } from "../lib/apiUrl";
const TOKEN_KEY = "management-token";

type State = "UNCONFIGURED" | "NO_LICENSE" | "INVALID" | "MISMATCH" | "NOT_STARTED" | "ACTIVE" | "SUPPORT_EXPIRED" | "EXPIRED";

interface PublicState { activated: boolean; state: State; message: string; publicKeyConfigured: boolean; enforced: boolean; allowed: boolean }
interface MatchRow { key: string; label: string; licensed: string; current: string; ok: boolean }
interface Status {
  state: State;
  message: string;
  installId: string;
  license: { licenseNumber: string; serial?: string | null; sequence: number; customer: string; model: "PERPETUAL" | "SUBSCRIPTION"; issuedAt: string; startsAt: string; supportUntil: string | null; validUntil: string | null; maxUsers: number | null; modules: string[] | null; features: string[] | null } | null;
  match: { ok: boolean; rows: MatchRow[]; reasons: string[] } | null;
}

const STATE_FA: Record<State, string> = {
  UNCONFIGURED: "بدون کلید لایسنس (ساخت آزمایشی)",
  NO_LICENSE: "لایسنس ثبت نشده",
  INVALID: "لایسنس نامعتبر",
  MISMATCH: "لایسنس با این سرور نمی‌خواند",
  NOT_STARTED: "هنوز شروع نشده",
  ACTIVE: "فعال",
  SUPPORT_EXPIRED: "فعال — پشتیبانی منقضی",
  EXPIRED: "منقضی",
};
const STATE_BADGE: Record<State, string> = {
  UNCONFIGURED: "",
  NO_LICENSE: "warning",
  INVALID: "danger",
  MISMATCH: "danger",
  NOT_STARTED: "warning",
  ACTIVE: "success",
  SUPPORT_EXPIRED: "warning",
  EXPIRED: "danger",
};
const MODEL_FA = { PERPETUAL: "فروش دائمی (با پشتیبانی سالانه)", SUBSCRIPTION: "اشتراک سالانه" } as const;

// ماژول‌های پایه همیشه روشن‌اند و در لایسنس نمی‌آیند
const MODULE_FA: Record<string, string> = {
  "goods-services": "کالا و خدمت",
  inventory: "مدیریت موجودی و انبار",
  "supply-chain": "زنجیره تامین",
  sales: "فروش",
  treasury: "مدیریت خزانه",
  "tax-affairs": "امور مالیاتی",
};
const FEATURE_FA: Record<string, string> = { FX: "زیرسیستم ارزی" };

/** مقدار واردشده را به قالب نمایشی XXXX-XXXX-XXXX درمی‌آورد (حروف بزرگ، فقط حرف/عدد، حداکثر ۱۲ نویسه) */
function formatInput(v: string): string {
  const clean = v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
  return clean.replace(/(.{4})(?=.)/g, "$1-");
}

async function call(path: string, options: { method?: string; body?: unknown; token?: string | null } = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    method: options.method ?? "GET",
    headers: { "Content-Type": "application/json", ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}) },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  return res;
}

async function jsonOrThrow(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any).error || "خطا در ارتباط با سرور");
  return data;
}

function dateFa(iso: string | null) {
  return iso ? formatJalaliDate(iso) : "—";
}

export default function Management() {
  const [pub, setPub] = useState<PublicState | null>(null);
  const [token, setToken] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  });
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  // منوی سمت راست پس از ورود: «لایسنس» | «تنظیمات پشتیبان‌گیری»؛ انتخاب در نشست مرورگر می‌ماند
  const [section, setSectionState] = useState<"license" | "backup" | "update">(() => {
    try {
      const v = sessionStorage.getItem("management-section");
      return v === "backup" || v === "update" ? v : "license";
    } catch {
      return "license";
    }
  });
  const setSection = (s: "license" | "backup" | "update") => {
    setSectionState(s);
    try {
      sessionStorage.setItem("management-section", s);
    } catch {
      /* فقط در حافظه */
    }
  };
  const [password, setPassword] = useState("");
  const [fileText, setFileText] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const saveToken = useCallback((t: string | null) => {
    setToken(t);
    try {
      if (t) sessionStorage.setItem(TOKEN_KEY, t);
      else sessionStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ذخیره‌ی نشست ممکن نیست؛ فقط در حافظه */
    }
  }, []);

  const loadPublic = useCallback(async () => {
    try {
      setPub(await jsonOrThrow(await call("/management/state")));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  const loadStatus = useCallback(
    async (t: string) => {
      const res = await call("/management/license", { token: t });
      if (res.status === 401) {
        saveToken(null);
        setStatus(null);
        return;
      }
      setStatus(await jsonOrThrow(res));
    },
    [saveToken]
  );

  const [brand, setBrand] = useState<Branding | null>(null);
  useEffect(() => {
    fetchBranding().then(setBrand);
  }, []);

  useEffect(() => {
    loadPublic();
  }, [loadPublic]);

  useEffect(() => {
    if (token && pub?.activated) loadStatus(token).catch((e) => setError((e as Error).message));
  }, [token, pub?.activated, loadStatus]);

  function resetUploadForm() {
    setPassword("");
    setFileText(null);
    setFileName("");
    if (fileRef.current) fileRef.current.value = "";
  }

  async function downloadRequest() {
    setError(null);
    try {
      const res = await call("/management/request", { token });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as any).error || "دانلود ناموفق بود");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = (/filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") || "") || [])[1] || "server-info.xml";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setInfo("فایل دانلود شد؛ آن را برای فروشنده بفرستید و لایسنس و کلمه‌ی عبور را از او بگیرید.");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    setError(null);
    setInfo(null);
    if (!f) {
      setFileText(null);
      setFileName("");
      return;
    }
    if (f.size > 100_000) {
      setError("حجم فایل لایسنس بیش از حد مجاز است");
      setFileText(null);
      setFileName("");
      return;
    }
    setFileText(await f.text());
    setFileName(f.name);
  }

  async function activate() {
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      const data = await jsonOrThrow(await call("/management/activate", { method: "POST", body: { text: fileText, password } }));
      saveToken(data.token);
      setStatus(data.status);
      await loadPublic();
      resetUploadForm();
      setShowUpload(false);
      setInfo("لایسنس با موفقیت ثبت شد.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function login() {
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      const data = await jsonOrThrow(await call("/management/login", { method: "POST", body: { password } }));
      saveToken(data.token);
      setPassword("");
      await loadStatus(data.token);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function logout() {
    saveToken(null);
    setStatus(null);
    setShowUpload(false);
    resetUploadForm();
    setInfo(null);
  }

  const activated = !!pub?.activated;
  const loggedIn = activated && !!token && !!status;
  const keyMissing = pub && !pub.publicKeyConfigured;
  const uploadSection = !activated || showUpload;
  const passwordOk = password.replace(/-/g, "").length === 12;

  const companyName = brand?.name || "";
  const initial = (companyName || DEFAULT_TITLE).trim().charAt(0);
  const SECTIONS: { key: "license" | "backup" | "update"; label: string }[] = [
    { key: "license", label: "لایسنس" },
    { key: "backup", label: "تنظیمات پشتیبان‌گیری" },
    { key: "update", label: "به‌روزرسانی" },
  ];

  const passwordInput = (disabled: boolean, placeholder: string, onEnter: () => void) => (
    <input
      dir="ltr"
      className="mg-mono"
      autoComplete="off"
      disabled={disabled}
      value={password}
      placeholder={placeholder}
      onChange={(e) => setPassword(formatInput(e.target.value))}
      onKeyDown={(e) => {
        if (e.key === "Enter") onEnter();
      }}
    />
  );

  function renderUploadFields() {
    return (
      <>
        <label className="mg-field">
          فایل لایسنس
          <input ref={fileRef} type="file" accept=".lic,.json,application/json,text/plain" onChange={onPickFile} />
        </label>
        <label className="mg-field" style={{ opacity: fileText ? 1 : 0.55 }}>
          کلمه‌ی عبور (همراه لایسنس از فروشنده دریافت کنید)
          {passwordInput(!fileText, fileText ? "XXXX-XXXX-XXXX" : "ابتدا فایل لایسنس را انتخاب کنید", () => { if (fileText && passwordOk && !busy) activate(); })}
        </label>
        <div className="mg-actions">
          <button type="button" className="btn" disabled={!fileText || !passwordOk || busy} onClick={activate}>
            {activated ? "ثبت لایسنس" : "فعال‌سازی"}
          </button>
          {fileName && <span className="mg-muted">{fileName}</span>}
        </div>
      </>
    );
  }

  return (
    <div className="mg-page" dir="rtl">
      <div className={`mg-shell${loggedIn ? " wide" : ""}`}>
        <header className="mg-head">
          <div className="mg-brand">
            <div className="mg-logo">{brand?.logoUrl ? <img src={brand.logoUrl} alt={companyName} /> : <span>{initial}</span>}</div>
            <div>
              <h1 className="mg-title">{loggedIn ? "مدیریت" : "مدیریت لایسنس"}</h1>
              <p className="mg-subtitle">{companyName || DEFAULT_TITLE}</p>
            </div>
          </div>
          {loggedIn && <button type="button" className="btn secondary" onClick={logout}>خروج</button>}
        </header>

        <div className="mg-body">
          {error && <div className="alert error" style={{ margin: 0 }}>{error}</div>}
          {info && <div className="alert warn" style={{ margin: 0 }}>{info}</div>}
          {keyMissing && <div className="alert warn" style={{ margin: 0 }}>این ساخت کلید لایسنس ندارد؛ فایل لایسنس تایید نمی‌شود (نسخه‌ی توسعه/آزمایشی).</div>}
          {pub && pub.enforced && !pub.allowed && (
            <div className="alert error" style={{ margin: 0 }}>ورود به نرم‌افزار تا فعال‌سازی لایسنس معتبر بسته است. {pub.message}</div>
          )}
          {pub && pub.allowed && pub.activated && (
            <div>
              <a className="mg-link" href="/login">← ورود به نرم‌افزار</a>
            </div>
          )}

          {!pub && !error && <div className="mg-muted">در حال بارگذاری…</div>}

          {/* ── بعد از ورود: منو + بخش انتخاب‌شده ───────────────────────── */}
          {loggedIn && status && (
            <div className="mg-layout">
              {/* منوی سمت راست (راست‌به‌چپ: اولین فرزند در سمت راست است) */}
              <nav className="mg-nav" aria-label="منوی مدیریت">
                {SECTIONS.map((s) => (
                  <button key={s.key} type="button" className={section === s.key ? "active" : ""} onClick={() => setSection(s.key)}>
                    {s.label}
                  </button>
                ))}
              </nav>
              <div className="mg-main">
                {section === "license" && (
                  <>
                    <h3 className="mg-h">
                      وضعیت لایسنس
                      <span className={`badge ${STATE_BADGE[status.state]}`}>{STATE_FA[status.state]}</span>
                    </h3>
                    <div className="mg-muted">{status.message}</div>
                    {status.license && (
                      <table className="mg-kv">
                        <tbody>
                          <tr><th>سریال لایسنس</th><td dir="ltr"><b>{status.license.serial || "ندارد (لایسنس قدیمی)"}</b></td></tr>
                          <tr><th>شماره لایسنس</th><td dir="ltr">{status.license.licenseNumber} (ترتیب {status.license.sequence})</td></tr>
                          <tr><th>مشتری</th><td>{status.license.customer}</td></tr>
                          <tr><th>نوع</th><td>{MODEL_FA[status.license.model]}</td></tr>
                          <tr><th>تاریخ صدور</th><td>{dateFa(status.license.issuedAt)}</td></tr>
                          <tr><th>شروع</th><td>{dateFa(status.license.startsAt)}</td></tr>
                          {status.license.model === "PERPETUAL" ? (
                            <tr><th>پشتیبانی و به‌روزرسانی تا</th><td>{dateFa(status.license.supportUntil)}</td></tr>
                          ) : (
                            <tr><th>اعتبار اشتراک تا</th><td>{dateFa(status.license.validUntil)}</td></tr>
                          )}
                          <tr><th>سقف کاربر</th><td>{status.license.maxUsers ?? "نامحدود"}</td></tr>
                          <tr><th>ماژول‌ها (علاوه بر پایه: تنظیمات، اطلاعات پایه، حسابداری)</th><td>{status.license.modules ? (status.license.modules.map((m) => MODULE_FA[m] ?? m).join("، ") || "هیچ‌کدام") : "همه"}</td></tr>
                          <tr><th>قابلیت‌ها</th><td>{status.license.features ? (status.license.features.map((f) => FEATURE_FA[f] ?? f).join("، ") || "هیچ‌کدام") : "همه"}</td></tr>
                          <tr><th>شناسه‌ی نصب</th><td><code dir="ltr">{status.installId}</code></td></tr>
                        </tbody>
                      </table>
                    )}
                    <div className="mg-actions">
                      <button type="button" className="btn secondary" onClick={downloadRequest}>دانلود فایل اطلاعات سرور</button>
                      <button type="button" className="btn secondary" onClick={() => { setShowUpload((v) => !v); setError(null); }}>
                        بارگذاری لایسنس تازه
                      </button>
                    </div>
                    {pub && uploadSection && (
                      <div className="mg-section">
                        <h4>بارگذاری لایسنس تازه</h4>
                        {renderUploadFields()}
                      </div>
                    )}
                  </>
                )}
                {section === "backup" && token && <ManagementBackup token={token} onUnauthorized={() => saveToken(null)} />}
                {section === "update" && token && <ManagementUpdate token={token} onUnauthorized={() => saveToken(null)} />}
              </div>
            </div>
          )}

          {/* ── لایسنس معتبر ثبت شده ولی هنوز وارد نشده: ورود با کلمه‌ی عبور ───── */}
          {activated && !loggedIn && pub && (
            <>
              <div className="mg-muted">لایسنس این سرور ثبت شده است. برای ورود، کلمه‌ی عبور مدیریت را وارد کنید.</div>
              <label className="mg-field">
                کلمه‌ی عبور
                {passwordInput(false, "XXXX-XXXX-XXXX", () => { if (passwordOk && !busy) login(); })}
              </label>
              <div className="mg-actions">
                <button type="button" className="btn" disabled={!passwordOk || busy} onClick={login}>ورود</button>
                <button type="button" className="btn secondary" onClick={() => { setShowUpload((v) => !v); setError(null); setPassword(""); }}>
                  لایسنس تازه دارم / کلمه‌ی عبور را فراموش کرده‌ام
                </button>
              </div>
            </>
          )}

          {/* ── فعال‌سازی (هنوز لایسنسی ثبت نشده) یا لایسنس تازه قبل از ورود ── */}
          {pub && uploadSection && !loggedIn && (
            <div className="mg-section">
              {!activated ? (
                <>
                  <h4>۱) فایل اطلاعات سرور</h4>
                  <div className="mg-muted">
                    این فایل فقط شامل نام دیتابیس، شناسه‌ی دیتابیس، شناسه‌ی نصب و نسخه‌ی برنامه است. آن را برای فروشنده بفرستید تا لایسنس صادر کند.
                  </div>
                  <div><button type="button" className="btn secondary" onClick={downloadRequest}>دانلود فایل اطلاعات سرور</button></div>
                  <h4>۲) فعال‌سازی</h4>
                </>
              ) : (
                <h4>بارگذاری لایسنس تازه</h4>
              )}
              {!activated && pub.state !== "NO_LICENSE" && pub.state !== "UNCONFIGURED" && (
                <div className="alert warn" style={{ margin: 0 }}>{pub.message} — لایسنس تازه لازم است.</div>
              )}
              {renderUploadFields()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
