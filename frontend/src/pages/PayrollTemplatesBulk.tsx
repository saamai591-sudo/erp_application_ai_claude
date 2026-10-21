import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ErrorToast } from "../components/ErrorToast";
import { FormPage } from "../components/FormPage";
import { InfoHint } from "../components/InfoHint";
import { RequiredMark } from "../components/RequiredMark";
import { RecordPickerField } from "../components/RecordPicker";
import { WorkMonthField } from "../components/WorkMonthField";
import { api, ApiError } from "../lib/api";
import { toFaDigits } from "../lib/formatAmount";
import { showToast } from "../lib/toast";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState } from "../lib/usePersistedState";

// حقوق و دستمزد › حسابداری حقوق › الگوی سند حقوق › «تعریف گروهی»: برای یک گروه حساب، یک ماه و یک نوع محاسبه، حساب همه‌ی آیتم‌های بدون الگو را
// یکجا در گرید انتخاب می‌کنیم و با یک ذخیره برای هر آیتم یک رکورد الگو درج می‌شود (همه‌یا‌هیچ؛ قواعد در سرویس payrollAccountingService).

const NATURE_FA: Record<string, string> = { DEBIT: "بدهکار", CREDIT: "بستانکار" };
const SECTION_FA: Record<string, string> = { EARNING: "مزایا", DEDUCTION: "کسور", EMPLOYER_COST: "هزینه کارفرما", LOAN: "وام", NET: "خالص پرداختی" };
const PARTY_KIND_FA: Record<string, string> = { EMPLOYEE: "پرسنل", FACTOR_ORG: "سازمان مرتبط با عامل", SECONDING_ORG: "سازمان مامورکننده" };

interface Options {
  groups: { id: number; code: number; title: string; hasSecondment: boolean; usesProject: boolean }[];
  accounts: { id: number; code: string; title: string; hasPartySlot: boolean }[];
}
interface Candidate {
  rowKey: string;
  field: string;
  refId: number;
  section: string;
  title: string;
  nature: string;
  description: string;
  hasOrg: boolean;
  prefill: { accountId: number; partyKind: string | null; description: string | null; fromYear: number; fromMonth: number } | null;
}
interface Row extends Candidate {
  accountId: string;
  partyKind: string;
  descriptionValue: string;
  error?: string;
}

const EMPTY = { year: 0, month: 0, groupId: "", calcTypeId: "", includeOlder: false, rows: [] as Row[], loadedKey: "" };

export default function PayrollTemplatesBulk() {
  const navigate = useNavigate();
  const [form, setForm] = usePersistedState("form:/payroll-journal-templates/bulk", EMPTY);
  const [opts, setOpts] = useState<Options>({ groups: [], accounts: [] });
  const [calcTypes, setCalcTypes] = useState<{ id: number; title: string; isBase: boolean }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { flash } = useSavedFlash();

  useEffect(() => {
    api.get("/payroll-journal-templates/options").then(setOpts).catch(() => {});
    api.get("/payroll-calc-types").then((rows: { id: number; title: string; isBase: boolean }[]) => {
      setCalcTypes(rows);
      setForm((f) => (f.calcTypeId ? f : { ...f, calcTypeId: String(rows.find((r) => r.isBase)?.id ?? rows[0]?.id ?? "") }));
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const group = opts.groups.find((g) => String(g.id) === form.groupId);
  const accountOf = (id: string) => opts.accounts.find((a) => String(a.id) === id);
  // نوع طرف حساب پیش‌فرض: سازمان مرتبط با عامل برای ردیف بستانکارِ عاملِ دارای سازمان ذینفع، وگرنه پرسنل
  const defaultPartyKind = (r: Pick<Row, "hasOrg" | "nature">) => (r.hasOrg && r.nature === "CREDIT" ? "FACTOR_ORG" : "EMPLOYEE");

  async function load() {
    setError(null);
    if (!form.year || !form.month) return setError("ماه را انتخاب کنید");
    if (!form.groupId) return setError("گروه حساب حقوق را انتخاب کنید");
    if (!form.calcTypeId) return setError("نوع محاسبه را انتخاب کنید");
    setLoading(true);
    try {
      const q = `year=${form.year}&month=${form.month}&groupId=${form.groupId}&calcTypeId=${form.calcTypeId}&includeOlder=${form.includeOlder}`;
      const cands: Candidate[] = await api.get(`/payroll-journal-templates/bulk/candidates?${q}`);
      const rows: Row[] = cands.map((c) => {
        const acc = c.prefill ? accountOf(String(c.prefill.accountId)) : undefined;
        return {
          ...c,
          accountId: c.prefill ? String(c.prefill.accountId) : "",
          partyKind: acc?.hasPartySlot ? c.prefill?.partyKind ?? defaultPartyKind(c) : "",
          descriptionValue: c.prefill?.description || c.description,
        };
      });
      setForm({ ...form, rows, loadedKey: q });
      if (rows.length === 0) showToast("همه‌ی آیتم‌ها برای این ماه الگوی مؤثر دارند");
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setLoading(false);
    }
  }

  function patchRow(key: string, patch: Partial<Row>) {
    setForm({ ...form, rows: form.rows.map((r) => (r.rowKey === key ? { ...r, ...patch, error: undefined } : r)) });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const filled = form.rows.filter((r) => r.accountId);
    if (filled.length === 0) return setError("برای هیچ ردیفی حساب معین انتخاب نشده است");
    const missing = filled.find((r) => accountOf(r.accountId)?.hasPartySlot && !r.partyKind);
    if (missing) return setError(`نوع طرف حساب «${missing.title}» را انتخاب کنید`);
    try {
      const body = {
        year: form.year,
        month: form.month,
        groupId: Number(form.groupId),
        rows: form.rows.map((r) => ({
          rowKey: r.rowKey,
          field: r.field,
          refId: r.refId,
          nature: r.nature,
          accountId: r.accountId ? Number(r.accountId) : null,
          partyKind: accountOf(r.accountId)?.hasPartySlot ? r.partyKind : null,
          description: r.descriptionValue,
        })),
      };
      const res = await api.post("/payroll-journal-templates/bulk", body);
      flash();
      showToast(`${toFaDigits(String(res.created))} رکورد الگو ثبت شد${res.skipped ? ` (${toFaDigits(String(res.skipped))} ردیف بدون حساب رد شد)` : ""}`);
      navigate("/payroll-journal-templates");
    } catch (err) {
      const ae = err as ApiError;
      setError(ae.message);
      const byKey = new Map((ae.details ?? []).map((d) => [String(d.rowKey), String(d.message)]));
      if (byKey.size > 0) setForm({ ...form, rows: form.rows.map((r) => ({ ...r, error: byKey.get(r.rowKey) })) });
    }
  }

  const sectionStart = (i: number) => i === 0 || form.rows[i - 1].section !== form.rows[i].section;
  const filledCount = form.rows.filter((r) => r.accountId).length;

  return (
    <FormPage title="تعریف گروهی الگوی سند حقوق" formId="payroll-tpl-bulk-form" closePath="/payroll-journal-templates" saveDisabled={form.rows.length === 0}>
      <form id="payroll-tpl-bulk-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        <div className="form-grid">
          <div className="form-field">
            <label>ماه<RequiredMark /></label>
            <WorkMonthField year={form.year} month={form.month} title="انتخاب ماه" onChange={(y, m) => setForm({ ...form, year: y, month: m, rows: [], loadedKey: "" })} />
          </div>
          <div className="form-field">
            <label>گروه حساب حقوق<RequiredMark /></label>
            <RecordPickerField<Options["groups"][number]>
              title="انتخاب گروه حساب حقوق"
              displayValue={group ? group.title : ""}
              rows={opts.groups}
              columns={[
                { header: "کد", render: (x) => toFaDigits(String(x.code)), filterValue: (x) => String(x.code), width: "80px" },
                { header: "عنوان", render: (x) => x.title, filterValue: (x) => x.title },
              ]}
              onSelect={(x) => setForm({ ...form, groupId: String(x.id), rows: [], loadedKey: "" })}
            />
          </div>
          <div className="form-field">
            <label>نوع محاسبه<RequiredMark /></label>
            <select value={form.calcTypeId} onChange={(e) => setForm({ ...form, calcTypeId: e.target.value, rows: [], loadedKey: "" })}>
              {calcTypes.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label className="checkbox-row">
              <input type="checkbox" checked={form.includeOlder} onChange={(e) => setForm({ ...form, includeOlder: e.target.checked, rows: [], loadedKey: "" })} />
              نمایش آیتم‌های دارای الگوی ماه‌های قبل
              <InfoHint title="آیتم‌های دارای الگوی قبلی" text="به‌طور پیش‌فرض فقط آیتم‌هایی می‌آیند که برای این ماه هیچ الگوی مؤثری ندارند. با این گزینه آیتم‌هایی که از ماه‌های قبل الگو دارند هم می‌آیند و حساب، ماهیت و نوع طرف حسابِ قبلی پیش‌پر می‌شود؛ ثبت، یک رکورد تازه از این ماه است که جای الگوی قبلیِ همان آیتم را می‌گیرد." />
            </label>
          </div>
          <div className="form-field" style={{ alignSelf: "end" }}>
            <button type="button" className="btn" onClick={load} disabled={loading}>{loading ? "در حال بارگذاری…" : "بارگذاری آیتم‌ها"}</button>
          </div>
        </div>

        {form.rows.length > 0 && (
          <>
            <p style={{ margin: "8px 0", fontSize: 12.5 }}>
              {toFaDigits(String(form.rows.length))} ردیف — حساب انتخاب‌شده برای {toFaDigits(String(filledCount))} ردیف. ردیفِ بدون حساب درج نمی‌شود و ردیف‌هایی که نمی‌خواهید را با «حذف» کنار بگذارید. هزینه کارفرما فقط با هر دو ردیف (بدهکار و بستانکار) درج می‌شود.
            </p>
            <div className="grid-scroll-area" style={{ maxHeight: "60vh" }}>
              <table className="je-lines-table">
                <thead>
                  <tr>
                    <th style={{ width: 110 }}>بخش</th>
                    <th>عامل</th>
                    <th style={{ width: 80 }}>ماهیت</th>
                    <th style={{ width: 280 }}>حساب معین</th>
                    <th style={{ width: 170 }}>نوع طرف حساب</th>
                    <th>شرح</th>
                    <th style={{ width: 60 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {form.rows.map((r, i) => {
                    const acc = accountOf(r.accountId);
                    return (
                      <tr key={r.rowKey} style={r.error ? { background: "var(--danger-bg, #fdecec)" } : undefined}>
                        <td>{sectionStart(i) ? SECTION_FA[r.section] : ""}</td>
                        <td>
                          {r.title}
                          {r.prefill && <div style={{ fontSize: 11, opacity: 0.7 }}>الگوی قبلی از {toFaDigits(`${r.prefill.fromYear}/${r.prefill.fromMonth}`)}</div>}
                          {r.error && <div style={{ fontSize: 11.5, color: "var(--danger, #c0392b)" }}>{r.error}</div>}
                        </td>
                        <td>{NATURE_FA[r.nature]}</td>
                        <td>
                          <RecordPickerField<Options["accounts"][number]>
                            title="انتخاب حساب معین"
                            displayValue={acc ? `${acc.code} - ${acc.title}` : ""}
                            rows={opts.accounts}
                            columns={[
                              { header: "کد", render: (x) => x.code, filterValue: (x) => x.code, width: "140px" },
                              { header: "عنوان", render: (x) => x.title, filterValue: (x) => x.title },
                            ]}
                            onSelect={(x) => patchRow(r.rowKey, { accountId: String(x.id), partyKind: x.hasPartySlot ? defaultPartyKind(r) : "" })}
                          />
                        </td>
                        <td>
                          {acc?.hasPartySlot ? (
                            <select value={r.partyKind} onChange={(e) => patchRow(r.rowKey, { partyKind: e.target.value })}>
                              <option value="">انتخاب کنید</option>
                              <option value="EMPLOYEE">{PARTY_KIND_FA.EMPLOYEE}</option>
                              {r.hasOrg && <option value="FACTOR_ORG">{PARTY_KIND_FA.FACTOR_ORG}</option>}
                              {group?.hasSecondment && <option value="SECONDING_ORG">{PARTY_KIND_FA.SECONDING_ORG}</option>}
                            </select>
                          ) : null}
                        </td>
                        <td><input value={r.descriptionValue} onChange={(e) => patchRow(r.rowKey, { descriptionValue: e.target.value })} /></td>
                        <td>
                          <button type="button" className="btn-link" onClick={() => setForm({ ...form, rows: form.rows.filter((x) => x.rowKey !== r.rowKey) })}>حذف</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </form>
    </FormPage>
  );
}
