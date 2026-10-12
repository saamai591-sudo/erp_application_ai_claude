import { FormEvent, useEffect, useState } from "react";
import { ErrorToast } from "../components/ErrorToast";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/AuthContext";
import { digitsOnly } from "../lib/digits";
import { Branding, DEFAULT_TITLE, fetchBranding } from "../lib/branding";

// صفحه‌ی ورود: دو بخش — «برند» (لوگو و نام شرکت از «مشخصات شرکت»، بدون نیاز به ورود) و فرم ورود. بدون لوگو، حرف اول نام شرکت نشان داده می‌شود.

function UserIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.8" />
      <path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function LockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="5" y="10" width="14" height="10" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 10V8a4 4 0 018 0v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
      {off && <path d="M4 4l16 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />}
    </svg>
  );
}

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [brand, setBrand] = useState<Branding | null>(null);
  // قفل لایسنس: نرم‌افزار فعال نشده است ⇒ پیام و پیوند به /management
  const [locked, setLocked] = useState<string | null>(null);

  useEffect(() => {
    fetchBranding().then(setBrand);
    api
      .get("/management/state")
      .then((s: { enforced: boolean; allowed: boolean; message: string }) => {
        if (s.enforced && !s.allowed) setLocked(s.message || "لایسنس معتبر ثبت نشده است");
      })
      .catch(() => {});
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(mobile, password);
      navigate("/");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const companyName = brand?.name || "";
  const initial = (companyName || DEFAULT_TITLE).trim().charAt(0);

  return (
    <div className="lg-page">
      <div className="lg-shell">
        <aside className="lg-brand">
          <div className="lg-brand-glow" aria-hidden="true" />
          <div className="lg-logo">
            {brand?.logoUrl ? <img src={brand.logoUrl} alt={companyName} /> : <span className="lg-logo-initial">{initial}</span>}
          </div>
          <div className="lg-brand-text">
            <h2 className="lg-company">{companyName || DEFAULT_TITLE}</h2>
            {companyName && <p className="lg-product">{DEFAULT_TITLE}</p>}
          </div>
        </aside>

        <form className="lg-form" onSubmit={onSubmit}>
          <h1>ورود به سیستم</h1>
          <p className="lg-sub">برای ورود، شماره همراه و رمز عبور خود را وارد کنید</p>
          <ErrorToast message={error} />
          {locked && (
            <div className="alert error" style={{ marginBottom: 14 }}>
              نرم‌افزار فعال نشده است: {locked}.<br />
              <Link to="/management">برای فعال‌سازی به صفحه‌ی مدیریت بروید</Link>
            </div>
          )}

          <label className="lg-field">
            <span>شماره همراه</span>
            <div className="lg-input">
              <UserIcon />
              <input
                value={mobile}
                onChange={(e) => setMobile(digitsOnly(e.target.value))}
                placeholder="09999999999"
                dir="ltr"
                inputMode="numeric"
                autoComplete="username"
                autoFocus
              />
            </div>
          </label>

          <label className="lg-field">
            <span>رمز عبور</span>
            <div className="lg-input">
              <LockIcon />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                dir="ltr"
                autoComplete="current-password"
              />
              <button type="button" className="lg-eye" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "پنهان کردن رمز" : "نمایش رمز"} tabIndex={-1}>
                <EyeIcon off={showPassword} />
              </button>
            </div>
          </label>

          <button className="lg-submit" disabled={busy}>
            {busy ? "در حال ورود..." : "ورود به سیستم"}
          </button>
        </form>
      </div>

      <footer className="lg-footer">
        <img src="/favicon-64.png" alt="" width={22} height={22} />
        <span>وب افزار سام، تمامی حقوق محفوظ است</span>
      </footer>
    </div>
  );
}
