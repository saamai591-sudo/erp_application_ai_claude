import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ErrorToast } from "../components/ErrorToast";
import { FormPage } from "../components/FormPage";
import { InfoHint } from "../components/InfoHint";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { LeafAccountField } from "../components/LeafAccountField";
import { RequiredMark } from "../components/RequiredMark";
import { api, ApiError } from "../lib/api";
import { toFaDigits } from "../lib/formatAmount";
import { showToast } from "../lib/toast";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState } from "../lib/usePersistedState";

// دارایی ثابت › تنظیمات › حسابهای دارایی ثابت › «درج گروهی»: برای یک گروه و یک تاریخ اجرا، همه‌ی انواع حسابی که در آن تاریخ حساب مؤثر ندارند
// در یک گرید می‌آیند؛ کاربر حساب هر ردیف را انتخاب می‌کند و با یک ذخیره برای هر ردیف یک رکورد در همان تاریخ درج می‌شود (همه‌یا‌هیچ).
// برای هزینه و پیش‌پرداخت بیمه، نوع بیمه را کاربر خودش انتخاب می‌کند (و می‌تواند ردیف دیگری برای نوع بیمه‌ی دیگر بیفزاید).

interface Candidate {
  rowKey: string;
  accountType: string;
  title: string;
  perInsuranceType: boolean;
  prefillAccountId: number | null;
  prefillAccountLabel: string | null;
  blockedReason: string | null;
}
interface Row extends Candidate {
  accountId: string;
  insuranceTypeId: string;
  error?: string;
}
interface Named { id: number; title: string; isActive: boolean }

const EMPTY = { groupId: "", date: "", includeExisting: false, rows: [] as Row[] };

export default function AssetAccountSettingsBulk() {
  const navigate = useNavigate();
  const [form, setForm] = usePersistedState("form:/asset-account-settings/bulk", EMPTY);
  const [groups, setGroups] = useState<Named[]>([]);
  const [insTypes, setInsTypes] = useState<Named[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { flash } = useSavedFlash();

  useEffect(() => {
    api.get("/asset-groups?activeOnly=true").then(setGroups).catch(() => {});
    api.get("/asset-insurance-types").then(setInsTypes).catch(() => {});
    setForm((f) => (f.date ? f : { ...f, date: new Date().toISOString().slice(0, 10) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setError(null);
    if (!form.groupId) return setError("گروه دارایی را انتخاب کنید");
    if (!form.date) return setError("تاریخ اجرا را انتخاب کنید");
    setLoading(true);
    try {
      const cands: Candidate[] = await api.get(`/asset-account-settings/bulk/candidates?groupId=${form.groupId}&date=${form.date}&includeExisting=${form.includeExisting}`);
      const rows: Row[] = cands.map((c) => ({ ...c, accountId: c.prefillAccountId ? String(c.prefillAccountId) : "", insuranceTypeId: "" }));
      setForm({ ...form, rows });
      if (rows.length === 0) showToast("همه‌ی انواع حساب برای این تاریخ حساب مؤثر دارند");
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setLoading(false);
    }
  }

  function patchRow(key: string, patch: Partial<Row>) {
    setForm({ ...form, rows: form.rows.map((r) => (r.rowKey === key ? { ...r, ...patch, error: undefined } : r)) });
  }

  function addInsuranceRow(base: Row) {
    const n = form.rows.filter((r) => r.accountType === base.accountType).length;
    const copy: Row = { ...base, rowKey: `${base.accountType}|${n}`, accountId: "", insuranceTypeId: "", error: undefined };
    const idx = form.rows.map((r) => r.accountType).lastIndexOf(base.accountType);
    const rows = [...form.rows];
    rows.splice(idx + 1, 0, copy);
    setForm({ ...form, rows });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const filled = form.rows.filter((r) => r.accountId);
    if (filled.length === 0) return setError("برای هیچ ردیفی حساب معین انتخاب نشده است");
    const missing = filled.find((r) => r.perInsuranceType && !r.insuranceTypeId);
    if (missing) return setError(`نوع بیمه‌ی ردیف «${missing.title}» را انتخاب کنید`);
    try {
      const res = await api.post("/asset-account-settings/bulk", {
        groupId: Number(form.groupId),
        date: form.date,
        rows: form.rows.map((r) => ({ rowKey: r.rowKey, accountType: r.accountType, insuranceTypeId: r.perInsuranceType && r.insuranceTypeId ? Number(r.insuranceTypeId) : null, accountId: r.accountId ? Number(r.accountId) : null })),
      });
      flash();
      showToast(`${toFaDigits(String(res.created))} رکورد ثبت شد${res.skipped ? ` (${toFaDigits(String(res.skipped))} ردیف بدون حساب رد شد)` : ""}`);
      navigate("/asset-account-settings");
    } catch (err) {
      const ae = err as ApiError;
      setError(ae.message);
      const byKey = new Map((ae.details ?? []).map((d) => [String(d.rowKey), String(d.message)]));
      if (byKey.size > 0) setForm({ ...form, rows: form.rows.map((r) => ({ ...r, error: byKey.get(r.rowKey) })) });
    }
  }

  const filledCount = form.rows.filter((r) => r.accountId).length;

  return (
    <FormPage title="درج گروهی حسابهای دارایی ثابت" formId="asset-acct-bulk-form" closePath="/asset-account-settings" saveDisabled={form.rows.length === 0}>
      <form id="asset-acct-bulk-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        <div className="form-grid">
          <div className="form-field">
            <label>گروه دارایی<RequiredMark /></label>
            <select value={form.groupId} onChange={(e) => setForm({ ...form, groupId: e.target.value, rows: [] })}>
              <option value="">—</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label>تاریخ اجرا<RequiredMark /></label>
            <JalaliDatePicker value={form.date} onChange={(v) => setForm({ ...form, date: v, rows: [] })} />
          </div>
          <div className="form-field">
            <label className="checkbox-row">
              <input type="checkbox" checked={form.includeExisting} onChange={(e) => setForm({ ...form, includeExisting: e.target.checked, rows: [] })} />
              نمایش انواعی که در این تاریخ حساب دارند
              <InfoHint title="انواع دارای حساب" text="به‌طور پیش‌فرض فقط انواعی می‌آیند که در تاریخ اجرا حساب مؤثر ندارند. با این گزینه انواع دارای حساب هم می‌آیند و حساب فعلی پیش‌پر می‌شود؛ ثبت، رکورد تازه‌ای در این تاریخ است (تاریخ باید بعد از آخرین رکورد همان نوع باشد)." />
            </label>
          </div>
          <div className="form-field" style={{ alignSelf: "end" }}>
            <button type="button" className="btn" onClick={load} disabled={loading}>{loading ? "در حال بارگذاری…" : "بارگذاری"}</button>
          </div>
        </div>

        {form.rows.length > 0 && (
          <>
            <p style={{ margin: "8px 0", fontSize: 12.5 }}>
              {toFaDigits(String(form.rows.length))} ردیف — حساب انتخاب‌شده برای {toFaDigits(String(filledCount))} ردیف. ردیف بدون حساب درج نمی‌شود. برای هزینه و پیش‌پرداخت بیمه، نوع بیمه را خودتان انتخاب کنید.
            </p>
            <div className="grid-scroll-area" style={{ maxHeight: "60vh" }}>
              <table className="je-lines-table">
                <thead>
                  <tr>
                    <th>نوع حساب</th>
                    <th style={{ width: 200 }}>نوع بیمه</th>
                    <th style={{ width: 320 }}>حساب معین</th>
                    <th style={{ width: 90 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {form.rows.map((r) => (
                    <tr key={r.rowKey} style={r.error ? { background: "var(--danger-bg, #fdecec)" } : undefined}>
                      <td>
                        {r.title}
                        {r.prefillAccountLabel && <div style={{ fontSize: 11, opacity: 0.7 }}>حساب فعلی: {r.prefillAccountLabel}</div>}
                        {r.blockedReason && <div style={{ fontSize: 11.5, color: "var(--danger, #c0392b)" }}>{r.blockedReason}</div>}
                        {r.error && <div style={{ fontSize: 11.5, color: "var(--danger, #c0392b)" }}>{r.error}</div>}
                      </td>
                      <td>
                        {r.perInsuranceType && (
                          <select value={r.insuranceTypeId} onChange={(e) => patchRow(r.rowKey, { insuranceTypeId: e.target.value })}>
                            <option value="">انتخاب کنید</option>
                            {insTypes.filter((x) => x.isActive).map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}
                          </select>
                        )}
                      </td>
                      <td>
                        <LeafAccountField value={r.accountId} onChange={(v) => patchRow(r.rowKey, { accountId: v })} />
                      </td>
                      <td>
                        {r.perInsuranceType && <button type="button" className="btn-link" onClick={() => addInsuranceRow(r)}>+ ردیف</button>}{" "}
                        <button type="button" className="btn-link" onClick={() => setForm({ ...form, rows: form.rows.filter((x) => x.rowKey !== r.rowKey) })}>حذف</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </form>
    </FormPage>
  );
}
