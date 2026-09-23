import { FormEvent, useState } from "react";
import { ErrorToast } from "../components/ErrorToast";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { digitsOnly } from "../lib/digits";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={onSubmit}>
        <h1>نرم‌افزار حسابداری</h1>
        <p>برای ورود، شماره همراه و رمز عبور خود را وارد کنید</p>
        <ErrorToast message={error} />
        <div className="form-field" style={{ marginBottom: 12 }}>
          <label>شماره همراه</label>
          <input value={mobile} onChange={(e) => setMobile(digitsOnly(e.target.value))} placeholder="09999999999" dir="ltr" />
        </div>
        <div className="form-field" style={{ marginBottom: 18 }}>
          <label>رمز عبور</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" />
        </div>
        <button className="btn" style={{ width: "100%" }} disabled={busy}>
          {busy ? "در حال ورود..." : "ورود"}
        </button>
      </form>
    </div>
  );
}
