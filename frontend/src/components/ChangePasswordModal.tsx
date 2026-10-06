import { FormEvent, useState } from "react";
import { Modal } from "./Modal";
import { api } from "../lib/api";
import { showToast, showError } from "../lib/toast";

/** تغییر کلمه عبور توسط خودِ کاربر وارد‌شده (POST /me/change-password). */
export function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!current) return showError("رمز عبور فعلی را وارد کنید");
    if (next.length < 6) return showError("رمز عبور جدید باید حداقل ۶ کاراکتر باشد");
    if (next !== confirm) return showError("رمز عبور جدید و تکرار آن یکسان نیستند");
    setBusy(true);
    try {
      await api.post("/me/change-password", { currentPassword: current, newPassword: next });
      showToast("رمز عبور با موفقیت تغییر کرد");
      onClose();
    } catch (err: any) {
      showError(err?.message || "خطا در تغییر رمز عبور");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="تغییر کلمه عبور" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="form-grid">
          <div className="form-field full">
            <label>رمز عبور فعلی</label>
            <input type="password" autoComplete="current-password" autoFocus value={current} onChange={(e) => setCurrent(e.target.value)} />
          </div>
          <div className="form-field full">
            <label>رمز عبور جدید</label>
            <input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
          </div>
          <div className="form-field full">
            <label>تکرار رمز عبور جدید</label>
            <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
        </div>
        <div className="actions">
          <button type="submit" className="btn" disabled={busy}>تغییر رمز عبور</button>
          <button type="button" className="btn secondary" onClick={onClose}>انصراف</button>
        </div>
      </form>
    </Modal>
  );
}
