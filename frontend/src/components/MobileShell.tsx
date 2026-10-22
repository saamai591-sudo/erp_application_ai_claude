import { useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { ChangePasswordModal } from "./ChangePasswordModal";
import Layout from "./Layout";

// «کاربر سبک» (فقط کارتابل): به‌جای چیدمان کامل ERP (منو، تب‌ها، دوره مالی) فقط یک نوار بالای ساده + صفحه‌ی «کارهای من» دارد؛ هر مسیر دیگر به همان برمی‌گردد.
// دسترسی واقعی را سرور می‌بندد (lightUserGuard + مجوزهای نقش)؛ این فقط ظاهر موبایل‌محور است.
export default function LayoutSwitch() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return user.isLight ? <MobileShell /> : <Layout />;
}

function MobileShell() {
  const { user, logout } = useAuth();
  const loc = useLocation();
  const [pwd, setPwd] = useState(false);
  if (!loc.pathname.startsWith("/my-tasks")) return <Navigate to="/my-tasks" replace />;
  return (
    <div className="mobile-shell" style={{ minHeight: "100vh", background: "var(--bg, #f6f7fb)" }}>
      <div className="mobile-shell-bar" style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderBottom: "1px solid var(--line, #ddd)", background: "var(--card, #fff)", position: "sticky", top: 0, zIndex: 5 }}>
        <b style={{ flex: 1 }}>کارتابل — {user?.firstName} {user?.lastName}</b>
        <button type="button" className="btn secondary" onClick={() => setPwd(true)}>رمز</button>
        <button type="button" className="btn secondary" onClick={() => logout()}>خروج</button>
      </div>
      <div style={{ padding: 14, maxWidth: 900, margin: "0 auto" }}>
        <Outlet />
      </div>
      {pwd && <ChangePasswordModal onClose={() => setPwd(false)} />}
    </div>
  );
}
