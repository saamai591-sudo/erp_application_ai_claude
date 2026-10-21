import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ErrorToast } from "../components/ErrorToast";
import { FormPage } from "../components/FormPage";
import { RequiredMark } from "../components/RequiredMark";
import { RecordPickerField } from "../components/RecordPicker";
import { WorkMonthField } from "../components/WorkMonthField";
import { api, ApiError } from "../lib/api";
import { toFaDigits } from "../lib/formatAmount";
import { showToast } from "../lib/toast";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState } from "../lib/usePersistedState";

// حقوق و دستمزد › حسابداری حقوق › تنظیمات صدور سند › «تعریف گروهی»: برای یک گروه حساب و یک ماه، کارمندانِ بدونِ تنظیماتِ مؤثر در گرید می‌آیند و
// با یک ذخیره برای همه‌ی ردیف‌ها یک رکورد تنظیمات درج می‌شود (همه‌یا‌هیچ؛ قواعد در سرویس payrollAccountingService).

interface GroupOpt { id: number; code: number; title: string; hasSecondment: boolean; usesProject: boolean }
interface PartyOpt { id: number; detailCode: string; detailTitle: string }
interface ProjectOpt { id: number; detailCode: string; title: string; isActive: boolean }
interface Row {
  id: number;
  personnelCode: string;
  fullName: string;
  secondingPartyId: string;
  projectId: string;
  error?: string;
}

const EMPTY = { year: 0, month: 0, groupId: "", rows: [] as Row[], hasSecondment: false, usesProject: false, blocked: 0 };

export default function PayrollIssueSettingsBulk() {
  const navigate = useNavigate();
  const [form, setForm] = usePersistedState("form:/payroll-issue-settings/bulk", EMPTY);
  const [groups, setGroups] = useState<GroupOpt[]>([]);
  const [parties, setParties] = useState<PartyOpt[]>([]);
  const [projects, setProjects] = useState<ProjectOpt[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { flash } = useSavedFlash();

  useEffect(() => {
    api.get("/payroll-account-groups").then(setGroups).catch(() => {});
    api.get("/beneficiary-branches/parties").then(setParties).catch(() => {});
    api.get("/projects").then(setProjects).catch(() => {});
  }, []);

  const group = groups.find((g) => String(g.id) === form.groupId);
  const partyLabel = (p?: PartyOpt) => (p ? `${toFaDigits(p.detailCode)} — ${p.detailTitle}` : "");
  const partyColumns = [
    { header: "کد تفصیلی", render: (x: PartyOpt) => toFaDigits(x.detailCode), filterValue: (x: PartyOpt) => x.detailCode, width: "120px" },
    { header: "عنوان", render: (x: PartyOpt) => x.detailTitle, filterValue: (x: PartyOpt) => x.detailTitle },
  ];
  const projectColumns = [
    { header: "کد", render: (x: ProjectOpt) => toFaDigits(x.detailCode), filterValue: (x: ProjectOpt) => x.detailCode, width: "100px" },
    { header: "عنوان", render: (x: ProjectOpt) => x.title, filterValue: (x: ProjectOpt) => x.title },
  ];
  const activeProjects = projects.filter((p) => p.isActive);

  async function load() {
    setError(null);
    if (!form.year || !form.month) return setError("ماه را انتخاب کنید");
    if (!form.groupId) return setError("گروه حساب حقوق را انتخاب کنید");
    setLoading(true);
    try {
      const r = await api.get(`/payroll-issue-settings/bulk/candidates?year=${form.year}&month=${form.month}&groupId=${form.groupId}`);
      const rows: Row[] = r.employees.map((e: { id: number; personnelCode: string; fullName: string }) => ({ id: e.id, personnelCode: e.personnelCode, fullName: e.fullName, secondingPartyId: "", projectId: "" }));
      setForm({ ...form, rows, hasSecondment: r.hasSecondment, usesProject: r.usesProject, blocked: r.blocked });
      if (rows.length === 0) showToast("همه‌ی کارمندان این ماه تنظیمات صدور دارند");
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setLoading(false);
    }
  }

  function patchRow(id: number, patch: Partial<Row>) {
    setForm({ ...form, rows: form.rows.map((r) => (r.id === id ? { ...r, ...patch, error: undefined } : r)) });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (form.rows.length === 0) return setError("ردیفی برای ثبت وجود ندارد");
    if (form.hasSecondment) {
      const m = form.rows.find((r) => !r.secondingPartyId);
      if (m) return setError(`سازمان مامورکننده «${m.fullName}» را انتخاب کنید`);
    }
    if (form.usesProject) {
      const m = form.rows.find((r) => !r.projectId);
      if (m) return setError(`پروژه «${m.fullName}» را انتخاب کنید`);
    }
    try {
      const res = await api.post("/payroll-issue-settings/bulk", {
        year: form.year,
        month: form.month,
        groupId: Number(form.groupId),
        rows: form.rows.map((r) => ({ employeeId: r.id, secondingPartyId: form.hasSecondment ? Number(r.secondingPartyId) : null, projectId: form.usesProject ? Number(r.projectId) : null })),
      });
      flash();
      showToast(`${toFaDigits(String(res.created))} رکورد تنظیمات صدور سند ثبت شد`);
      navigate("/payroll-issue-settings");
    } catch (err) {
      const ae = err as ApiError;
      setError(ae.message);
      const byKey = new Map((ae.details ?? []).map((d) => [String(d.rowKey), String(d.message)]));
      if (byKey.size > 0) setForm({ ...form, rows: form.rows.map((r) => ({ ...r, error: byKey.get(String(r.id)) })) });
    }
  }

  return (
    <FormPage title="تعریف گروهی تنظیمات صدور سند" formId="payroll-set-bulk-form" closePath="/payroll-issue-settings" saveDisabled={form.rows.length === 0}>
      <form id="payroll-set-bulk-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        <div className="form-grid">
          <div className="form-field">
            <label>گروه حساب<RequiredMark /></label>
            <RecordPickerField<GroupOpt>
              title="انتخاب گروه حساب حقوق"
              displayValue={group ? group.title : ""}
              rows={groups}
              columns={[
                { header: "کد", render: (x) => toFaDigits(String(x.code)), filterValue: (x) => String(x.code), width: "80px" },
                { header: "عنوان", render: (x) => x.title, filterValue: (x) => x.title },
              ]}
              onSelect={(x) => setForm({ ...form, groupId: String(x.id), rows: [] })}
            />
          </div>
          <div className="form-field">
            <label>ماه<RequiredMark /></label>
            <WorkMonthField year={form.year} month={form.month} title="انتخاب ماه" onChange={(y, m) => setForm({ ...form, year: y, month: m, rows: [] })} />
          </div>
          <div className="form-field" style={{ alignSelf: "end" }}>
            <button type="button" className="btn" onClick={load} disabled={loading}>{loading ? "در حال بارگذاری…" : "لود اطلاعات"}</button>
          </div>
        </div>

        {form.rows.length > 0 && (
          <>
            <p style={{ margin: "8px 0", fontSize: 12.5 }}>
              {toFaDigits(String(form.rows.length))} کارمند بدون تنظیمات صدور در این ماه. برای همه‌ی ردیف‌ها یک رکورد درج می‌شود؛ کارمندی را که نمی‌خواهید با «حذف» کنار بگذارید.
              {form.blocked > 0 && ` (${toFaDigits(String(form.blocked))} کارمند به‌دلیل داشتن سند حقوق در این ماه یا بعد از آن نمایش داده نشدند.)`}
            </p>
            {(form.hasSecondment || form.usesProject) && (
              <div className="form-grid" style={{ marginBottom: 8 }}>
                {form.hasSecondment && (
                  <div className="form-field">
                    <label>سازمان مامورکننده برای همه‌ی ردیف‌ها</label>
                    <RecordPickerField<PartyOpt>
                      title="انتخاب سازمان مامورکننده"
                      displayValue=""
                      rows={parties}
                      columns={partyColumns}
                      onSelect={(x) => setForm({ ...form, rows: form.rows.map((r) => ({ ...r, secondingPartyId: String(x.id), error: undefined })) })}
                    />
                  </div>
                )}
                {form.usesProject && (
                  <div className="form-field">
                    <label>پروژه برای همه‌ی ردیف‌ها</label>
                    <RecordPickerField<ProjectOpt>
                      title="انتخاب پروژه"
                      displayValue=""
                      rows={activeProjects}
                      columns={projectColumns}
                      onSelect={(x) => setForm({ ...form, rows: form.rows.map((r) => ({ ...r, projectId: String(x.id), error: undefined })) })}
                    />
                  </div>
                )}
              </div>
            )}
            <div className="grid-scroll-area" style={{ maxHeight: "60vh" }}>
              <table className="je-lines-table">
                <thead>
                  <tr>
                    <th style={{ width: 110 }}>کد پرسنلی</th>
                    <th>کارمند</th>
                    {form.hasSecondment && <th style={{ width: 300 }}>سازمان مامورکننده</th>}
                    {form.usesProject && <th style={{ width: 260 }}>پروژه</th>}
                    <th style={{ width: 60 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {form.rows.map((r) => (
                    <tr key={r.id} style={r.error ? { background: "var(--danger-bg, #fdecec)" } : undefined}>
                      <td>{toFaDigits(r.personnelCode)}</td>
                      <td>
                        {r.fullName}
                        {r.error && <div style={{ fontSize: 11.5, color: "var(--danger, #c0392b)" }}>{r.error}</div>}
                      </td>
                      {form.hasSecondment && (
                        <td>
                          <RecordPickerField<PartyOpt>
                            title="انتخاب سازمان مامورکننده"
                            displayValue={partyLabel(parties.find((p) => String(p.id) === r.secondingPartyId))}
                            rows={parties}
                            columns={partyColumns}
                            onSelect={(x) => patchRow(r.id, { secondingPartyId: String(x.id) })}
                          />
                        </td>
                      )}
                      {form.usesProject && (
                        <td>
                          <RecordPickerField<ProjectOpt>
                            title="انتخاب پروژه"
                            displayValue={(() => { const p = projects.find((x) => String(x.id) === r.projectId); return p ? `${toFaDigits(p.detailCode)} — ${p.title}` : ""; })()}
                            rows={activeProjects}
                            columns={projectColumns}
                            onSelect={(x) => patchRow(r.id, { projectId: String(x.id) })}
                          />
                        </td>
                      )}
                      <td>
                        <button type="button" className="btn-link" onClick={() => setForm({ ...form, rows: form.rows.filter((x) => x.id !== r.id) })}>حذف</button>
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
