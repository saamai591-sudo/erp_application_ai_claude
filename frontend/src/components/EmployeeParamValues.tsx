import { useCallback, useEffect, useState } from "react";
import { ErrorToast } from "./ErrorToast";
import { Modal } from "./Modal";
import { RequiredMark } from "./RequiredMark";
import { WorkMonthField, workMonthLabel } from "./WorkMonthField";
import { api, ApiError } from "../lib/api";
import { toFaDigits } from "../lib/formatAmount";
import { showError } from "../lib/toast";

// بخش «مقادیر ثابت» فرم کارمند: مقدار ثابت پرسنلیِ نوع «منابع انسانی» برای همین کارمند، تاریخ‌دار (از یک ماه اجرا به بعد).
// ثبت‌نشده = صفر. فقط پارامترهای این نوع اینجا دیده و ثبت می‌شوند (سرور هم فیلتر می‌کند)؛ نوع «حقوقی» در فرم «مقادیر ثابت پرسنل» است.

interface Param {
  id: number;
  title: string;
  type: string;
}
interface Row {
  id: number;
  parameterId: number;
  parameterTitle: string;
  type: string;
  execYear: number;
  execMonth: number;
  value: string;
  createdBy: string | null;
  createdAt: string;
  locked: boolean;
  lockedReason: string | null;
}

export const fmtParamValue = (type: string, v: string) =>
  toFaDigits(Number(v).toLocaleString("en-US", { maximumFractionDigits: 4 }));

export function EmployeeParamValues({ employeeId, canEdit }: { employeeId: number; canEdit: boolean }) {
  const [params, setParams] = useState<Param[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [dlg, setDlg] = useState<{ parameterId: string; year: number; month: number; value: string; fixed: boolean } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const d: { parameters: Param[]; values: Row[] } = await api.get(`/employees/${employeeId}/hr-params`);
      setParams(d.parameters);
      setRows(d.values);
    } catch (e) {
      showError((e as ApiError).message);
    }
  }, [employeeId]);
  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    if (!dlg) return;
    setErr(null);
    if (!dlg.parameterId) return setErr("پارامتر را انتخاب کنید");
    if (!dlg.year || !dlg.month) return setErr("ماه اجرا را انتخاب کنید");
    if (dlg.value.trim() === "") return setErr("مقدار را وارد کنید");
    try {
      await api.post(`/employees/${employeeId}/hr-params`, { parameterId: Number(dlg.parameterId), year: dlg.year, month: dlg.month, value: dlg.value });
      setDlg(null);
      await load();
    } catch (e) {
      setErr((e as ApiError).message);
    }
  }
  async function remove(r: Row) {
    if (!window.confirm(`مقدار «${r.parameterTitle}» از ${workMonthLabel(r.execYear, r.execMonth)} حذف شود؟`)) return;
    try {
      await api.del(`/employees/hr-params/${r.id}`);
      await load();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  const selected = params.find((p) => String(p.id) === dlg?.parameterId);

  return (
    <>
      <h3 className="hr-section" style={{ display: "flex", alignItems: "center", gap: 8 }}>
        مقادیر ثابت
        {canEdit && (
          <button
            type="button"
            className="btn secondary"
            disabled={params.length === 0}
            title={params.length === 0 ? "پارامتری از نوع «مقدار ثابت پرسنلی - منابع انسانی» تعریف نشده است" : undefined}
            onClick={() => setDlg({ parameterId: params.length === 1 ? String(params[0].id) : "", year: 0, month: 0, value: "", fixed: false })}
          >
            افزودن مقدار
          </button>
        )}
      </h3>
      <table className="hr-table">
        <thead>
          <tr><th>پارامتر</th><th>از ماه</th><th>مقدار</th><th>ثبت‌کننده</th><th>زمان ثبت</th><th style={{ width: 130 }} /></tr>
        </thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={6} style={{ textAlign: "center", opacity: 0.7 }}>مقداری ثبت نشده است (مقدار همه‌ی پارامترها صفر در نظر گرفته می‌شود)</td></tr>}
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.parameterTitle}</td>
              <td>{workMonthLabel(r.execYear, r.execMonth)}</td>
              <td>{fmtParamValue(r.type, r.value)}</td>
              <td>{r.createdBy ?? "—"}</td>
              <td>{new Date(r.createdAt).toLocaleString("fa-IR")}</td>
              <td>
                {r.locked && <span title={r.lockedReason ?? ""} style={{ opacity: 0.75, fontSize: 12 }}>🔒 قفل</span>}
                {canEdit && !r.locked && (
                  <>
                    <button type="button" className="link-btn" onClick={() => setDlg({ parameterId: String(r.parameterId), year: r.execYear, month: r.execMonth, value: String(Number(r.value)), fixed: true })}>ویرایش</button>{" "}
                    <button type="button" className="link-btn" onClick={() => remove(r)}>حذف</button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {dlg && (
        <Modal title={dlg.fixed ? "ویرایش مقدار" : "مقدار جدید"} onClose={() => setDlg(null)}>
          <ErrorToast message={err} />
          <div className="form-grid">
            <div className="form-field">
              <label>پارامتر<RequiredMark /></label>
              <select disabled={dlg.fixed} value={dlg.parameterId} onChange={(e) => setDlg({ ...dlg, parameterId: e.target.value })}>
                <option value="">انتخاب…</option>
                {params.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label>از ماه<RequiredMark /></label>
              <WorkMonthField year={dlg.year} month={dlg.month} disabled={dlg.fixed} onChange={(y, m) => setDlg({ ...dlg, year: y, month: m })} />
            </div>
            <div className="form-field">
              <label>مقدار{selected ? ` (${selected.type === "AMOUNT" ? "مبلغ" : "عدد"})` : ""}<RequiredMark /></label>
              <input dir="ltr" inputMode="decimal" value={dlg.value} onChange={(e) => setDlg({ ...dlg, value: e.target.value.replace(/[^0-9.]/g, "") })} />
            </div>
          </div>
          <p style={{ opacity: 0.75, fontSize: 12 }}>مقدار از ماه انتخاب‌شده تا مقدار بعدی معتبر است. ماه باید بعد از آخرین ماه محاسبه‌شده‌ی حقوق این کارمند باشد.</p>
          <div className="actions">
            <button type="button" className="btn" onClick={save}>ثبت</button>
            <button type="button" className="btn secondary" onClick={() => setDlg(null)}>انصراف</button>
          </div>
        </Modal>
      )}
    </>
  );
}
