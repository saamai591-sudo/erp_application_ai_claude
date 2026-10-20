import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ErrorToast } from "../components/ErrorToast";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { InfoHint } from "../components/InfoHint";
import { FieldHint } from "../components/FieldHint";
import { RequiredMark } from "../components/RequiredMark";
import { RecordPickerField } from "../components/RecordPicker";
import { WorkMonthField, workMonthLabel } from "../components/WorkMonthField";
import { toFaDigits } from "../lib/formatAmount";
import { api, ApiError } from "../lib/api";
import { showError } from "../lib/toast";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";

// حقوق و دستمزد › حسابداری حقوق › الگوی سند حقوق: هر ردیف یک رکورد مستقل (از ماه، گروه حساب، عامل، حساب معین، ماهیت، شرح، نوع طرف حساب).
// برای ماه M و هر (گروه، عامل): بزرگ‌ترین «از ماه» ≤ M و همه‌ی رکوردهای فعالِ همان «از ماه» در سند می‌آیند؛ اگر همه غیرفعال شوند عامل «فاقد الگو» است.

const NATURE_FA: Record<string, string> = { DEBIT: "بدهکار", CREDIT: "بستانکار" };
const PARTY_KIND_FA: Record<string, string> = { EMPLOYEE: "پرسنل", FACTOR_ORG: "سازمان مرتبط با عامل", SECONDING_ORG: "سازمان مامورکننده" };

interface TplRow {
  id: number;
  fromYear: number;
  fromMonth: number;
  groupId: number;
  groupTitle: string;
  payrollComponentId: number | null;
  decreeComponentId: number | null;
  netCalcTypeId: number | null;
  loanTypeId: number | null;
  refType: string;
  refTitle: string;
  accountId: number;
  accountCode: string;
  accountTitle: string;
  nature: string;
  description: string | null;
  partyKind: string | null;
  isActive: boolean;
}
interface Options {
  groups: { id: number; code: number; title: string; hasSecondment: boolean; usesProject: boolean }[];
  refs: { key: string; field: string; id: number; type: string; title: string; extra: string; hasOrg: boolean }[];
  accounts: { id: number; code: string; title: string; hasPartySlot: boolean }[];
}

export default function PayrollJournalTemplates() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <TplForm />;
  if (location.pathname.endsWith("/edit")) return <TplForm editId={Number(id)} />;
  return <TplList />;
}

function TplList() {
  const cacheKey = "/payroll-journal-templates";
  const [items, setItems] = usePersistedState<TplRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  async function reload() {
    api.get("/payroll-journal-templates").then(setItems).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function onDelete(row: TplRow) {
    try {
      await api.del(`/payroll-journal-templates/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  const s = (f: (r: TplRow) => string, extra: object = {}) => ({ render: (r: TplRow) => f(r), filterType: "string" as const, filterValue: (r: TplRow) => f(r), ...extra });
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint
            text="هر ردیف یک رکورد مستقل است. برای هر ماه و هر عامل در یک گروه حساب، «آخرین ماه ≤ ماه سند» و همه‌ی ردیف‌های فعالِ همان ماه اجرا می‌شود (برای تغییر الگو از یک ماه به بعد، ردیف‌های تازه با «از ماه» جدید ثبت کنید). همه‌ی مزایا، کسور، وام‌ها و خالص پرداختی باید ردیف داشته باشند و برای هزینه کارفرما هم ردیف بدهکار و هم بستانکار لازم است."
            title="الگوی سند حقوق"
          />
          <NewRecordButton path="/payroll-journal-templates/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "از ماه", ...s((r) => workMonthLabel(r.fromYear, r.fromMonth)), width: "120px" },
          { header: "گروه حساب", ...s((r) => r.groupTitle) },
          { header: "نوع عامل", ...s((r) => r.refType), width: "110px" },
          { header: "عامل", ...s((r) => r.refTitle) },
          { header: "حساب", ...s((r) => `${r.accountCode} - ${r.accountTitle}`) },
          { header: "ماهیت", ...s((r) => NATURE_FA[r.nature] ?? r.nature), width: "90px" },
          { header: "نوع طرف حساب", ...s((r) => (r.partyKind ? PARTY_KIND_FA[r.partyKind] : "")), width: "170px" },
          { header: "شرح", ...s((r) => r.description ?? "") },
          { header: "فعال", ...s((r) => (r.isActive ? "بله" : "خیر")), width: "70px" },
        ]}
        rows={items}
        edit={{ path: (r: TplRow) => `/payroll-journal-templates/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

const EMPTY = { fromYear: 0, fromMonth: 0, groupId: "", refKey: "", accountId: "", nature: "", description: "", partyKind: "", isActive: true };

function TplForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const [form, setForm] = usePersistedState(cacheKey, EMPTY);
  const [opts, setOpts] = useState<Options>({ groups: [], refs: [], accounts: [] });
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const { flash } = useSavedFlash();

  useEffect(() => {
    api.get("/payroll-journal-templates/options").then(setOpts).catch(() => {});
    if (!editId) return;
    api.get(`/payroll-journal-templates/${editId}`).then((t: TplRow) => {
      const refKey = t.payrollComponentId ? `P:${t.payrollComponentId}` : t.decreeComponentId ? `D:${t.decreeComponentId}` : t.netCalcTypeId ? `N:${t.netCalcTypeId}` : `L:${t.loanTypeId}`;
      if (!hasPersistedState(cacheKey)) {
        setForm({ fromYear: t.fromYear, fromMonth: t.fromMonth, groupId: String(t.groupId), refKey, accountId: String(t.accountId), nature: t.nature, description: t.description ?? "", partyKind: t.partyKind ?? "", isActive: t.isActive });
      }
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  const group = opts.groups.find((g) => String(g.id) === form.groupId);
  const ref = opts.refs.find((r) => r.key === form.refKey);
  const account = opts.accounts.find((a) => String(a.id) === form.accountId);
  const partyOptions = [
    ["EMPLOYEE", PARTY_KIND_FA.EMPLOYEE],
    ...(ref?.hasOrg ? [["FACTOR_ORG", PARTY_KIND_FA.FACTOR_ORG]] : []),
    ...(group?.hasSecondment ? [["SECONDING_ORG", PARTY_KIND_FA.SECONDING_ORG]] : []),
  ];

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.fromYear || !form.fromMonth) return setError("«از ماه» را انتخاب کنید");
    if (!form.groupId) return setError("گروه حساب حقوق را انتخاب کنید");
    if (!ref) return setError("عامل را انتخاب کنید");
    if (!form.accountId) return setError("حساب معین را انتخاب کنید");
    if (!form.nature) return setError("ماهیت را انتخاب کنید");
    if (account?.hasPartySlot && !form.partyKind) return setError("نوع طرف حساب را انتخاب کنید");
    const body = {
      fromYear: form.fromYear,
      fromMonth: form.fromMonth,
      groupId: Number(form.groupId),
      [ref.field]: ref.id,
      accountId: Number(form.accountId),
      nature: form.nature,
      description: form.description,
      partyKind: account?.hasPartySlot ? form.partyKind : null,
      isActive: form.isActive,
    };
    try {
      if (editId) {
        await api.put(`/payroll-journal-templates/${editId}`, body);
        flash();
      } else {
        const created = await api.post("/payroll-journal-templates", body);
        flash();
        navigate(`/payroll-journal-templates/${created.id}/edit`);
      }
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/payroll-journal-templates/${editId}`);
      navigate("/payroll-journal-templates");
    } catch (err) {
      showError((err as ApiError).message);
    }
  }

  if (!loaded) return null;

  return (
    <FormPage
      title={editId ? "ویرایش رکورد الگوی سند حقوق" : "رکورد الگوی سند حقوق جدید"}
      formId="payroll-tpl-form"
      closePath="/payroll-journal-templates"
      newPath="/payroll-journal-templates/new"
      onDelete={editId ? handleDelete : undefined}
    >
      <form id="payroll-tpl-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        <div className="form-grid">
          <div className="form-field">
            <label>از ماه<RequiredMark /></label>
            <WorkMonthField year={form.fromYear} month={form.fromMonth} title="انتخاب ماه" onChange={(y, m) => setForm({ ...form, fromYear: y, fromMonth: m })} />
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
              onSelect={(x) => setForm({ ...form, groupId: String(x.id), partyKind: "" })}
            />
          </div>
          <div className="form-field">
            <label>عامل<RequiredMark /> <FieldHint label="عامل" text="عامل حقوق (پرداختی، کسر، هزینه کارفرما، اطلاعاتی)، عامل حکم، «خالص پرداختی» هر نوع محاسبه، یا «وام» هر نوع وام" /></label>
            <RecordPickerField<Options["refs"][number]>
              title="انتخاب عامل"
              displayValue={ref ? `${ref.type}: ${ref.title}` : ""}
              rows={opts.refs}
              columns={[
                { header: "نوع", render: (x) => x.type, filterValue: (x) => x.type, width: "120px" },
                { header: "عنوان", render: (x) => x.title, filterValue: (x) => x.title },
                { header: "طبقه", render: (x) => x.extra, filterValue: (x) => x.extra, width: "120px" },
              ]}
              onSelect={(x) => setForm({ ...form, refKey: x.key, partyKind: "" })}
            />
          </div>
          <div className="form-field">
            <label>حساب معین<RequiredMark /></label>
            <RecordPickerField<Options["accounts"][number]>
              title="انتخاب حساب معین"
              displayValue={account ? `${account.code} - ${account.title}` : ""}
              rows={opts.accounts}
              columns={[
                { header: "کد", render: (x) => x.code, filterValue: (x) => x.code, width: "140px" },
                { header: "عنوان", render: (x) => x.title, filterValue: (x) => x.title },
              ]}
              onSelect={(x) => setForm({ ...form, accountId: String(x.id), partyKind: "" })}
            />
          </div>
          <div className="form-field">
            <label>ماهیت<RequiredMark /></label>
            <select value={form.nature} onChange={(e) => setForm({ ...form, nature: e.target.value })}>
              <option value="">انتخاب کنید</option>
              {Object.entries(NATURE_FA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          {account?.hasPartySlot && (
            <div className="form-field">
              <label>نوع طرف حساب<RequiredMark /> <FieldHint label="نوع طرف حساب" text="حساب انتخاب‌شده در یکی از سطوح تفصیل خود طرف حساب دارد: از بین پرسنل، سازمان مرتبط با عامل (شعبه‌ی کارمند در سازمان ذینفعِ عامل) و سازمان مامورکننده (فقط گروه‌های دارای «مامور به خدمت») یکی را انتخاب کنید." /></label>
              <select value={form.partyKind} onChange={(e) => setForm({ ...form, partyKind: e.target.value })}>
                <option value="">انتخاب کنید</option>
                {partyOptions.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          )}
          <div className="form-field" style={{ gridColumn: "1 / -1" }}>
            <label>شرح</label>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="form-field">
            <label className="checkbox-row">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
              فعال
            </label>
          </div>
        </div>
      </form>
    </FormPage>
  );
}
