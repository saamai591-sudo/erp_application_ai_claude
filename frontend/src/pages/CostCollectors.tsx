import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ErrorToast } from "../components/ErrorToast";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { LeafAccountField } from "../components/LeafAccountField";
import { RecordPickerField } from "../components/RecordPicker";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { InfoHint } from "../components/InfoHint";
import { RequiredMark } from "../components/RequiredMark";
import { toFaDigits } from "../lib/formatAmount";
import { api, ApiError } from "../lib/api";
import { showError } from "../lib/toast";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";

// تولید › تنظیمات › «عامل جمع‌آوری هزینه‌ها»: قاعده‌ی تاریخ‌دار هر معین (آخرین سطح) = از «دوره‌ی گزارشگری شروع» به بعد این معین به کدام برگ دستمزد/سربار
// می‌رود، با رفتار (ثابت/متغیر؛ فعلاً فقط گزارشی) و مبنای تسهیم. «بدون تأثیر» یعنی از آن دوره به بعد جزو هزینه‌یابی نیست.
// معینی که قاعده ندارد اصلاً وارد هزینه‌یابی نمی‌شود. قواعد: backend/src/services/costStructureService.ts

export const BASIS_FA: Record<string, string> = { QUANTITY: "تعداد تولید", MATERIAL_COST: "بهای مواد اولیه‌ی مصرفی", TIME_DRIVER: "مبنای زمانی" };
const BEHAVIOR_FA: Record<string, string> = { FIXED: "ثابت", VARIABLE: "متغیر" };

const INFO_TEXT =
  "هر رکورد: یک معین + دوره‌ی گزارشگری شروع (از دوره‌های سال مالی جاری) + عامل جمع‌آوری (آخرین شاخه‌ی دستمزد یا سربار) + مبنای تسهیم. رکورد بعدیِ همان معین باید دوره‌ی بعدی داشته باشد؛ برای جابه‌جایی معین به عامل دیگر، رکورد جدید با دوره‌ی جدید ثبت کنید. ردیف‌های سند آن معین که تفصیل مرکز هزینه دارند مستقیم به همان مرکز می‌روند و بقیه با مبنای انتخابی بین مراکز تسهیم می‌شوند؛ همان مبنا بین کالاهای هر مرکز هم به کار می‌رود. مبنای زمانی (مثل زمان بافت) از «زمان‌بندی تولید» هر مرکز و کالا خوانده می‌شود. رفتار ثابت/متغیر فعلاً فقط گزارشی است. تا وقتی برای دوره‌ی شروع (یا بعد از آن) بهای تمام‌شده محاسبه شده، رکورد قفل است.";

interface Rule {
  id: number;
  accountId: number;
  accountCode: string;
  accountTitle: string;
  fromReportingPeriodId: number;
  fromPeriodTitle: string;
  nodeId: number | null;
  noEffect: boolean;
  nodePath: string;
  behavior: string;
  basis: string;
  driverId: number | null;
  driverTitle: string;
  locked: boolean;
}
interface Leaf { id: number; path: string; rootTitle: string }
interface Driver { id: number; title: string }
interface Period { id: number; code: string; title: string; fromDate: string; toDate: string }

interface FormState { accountId: string; fromReportingPeriodId: string; noEffect: boolean; nodeId: string; behavior: string; basis: string; driverId: string }
const EMPTY: FormState = { accountId: "", fromReportingPeriodId: "", noEffect: false, nodeId: "", behavior: "VARIABLE", basis: "QUANTITY", driverId: "" };
const basisText = (r: { basis: string; driverTitle: string }) => (r.basis === "TIME_DRIVER" ? `زمان: ${r.driverTitle}` : BASIS_FA[r.basis] ?? r.basis);

export default function CostCollectors() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <RuleForm />;
  if (location.pathname.endsWith("/edit")) return <RuleForm editId={Number(id)} />;
  return <RuleList />;
}

function RuleList() {
  const cacheKey = "/cost-collectors";
  const [items, setItems] = usePersistedState<Rule[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  async function reload() {
    api.get("/cost-collectors").then(setItems).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function onDelete(row: Rule) {
    try {
      await api.del(`/cost-collectors/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  const s = (f: (r: Rule) => string, extra: object = {}) => ({ render: (r: Rule) => f(r), filterType: "string" as const, filterValue: (r: Rule) => f(r), ...extra });
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text={INFO_TEXT} title="عامل جمع‌آوری هزینه‌ها" />
          <NewRecordButton path="/cost-collectors/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "کد معین", ...s((r) => toFaDigits(r.accountCode)), width: "110px" },
          { header: "معین", ...s((r) => r.accountTitle) },
          { header: "از دوره", ...s((r) => r.fromPeriodTitle), width: "150px" },
          { header: "عامل جمع‌آوری", ...s((r) => r.nodePath) },
          { header: "رفتار", ...s((r) => BEHAVIOR_FA[r.behavior] ?? r.behavior), width: "80px" },
          { header: "مبنای تسهیم", ...s((r) => basisText(r)), width: "200px" },
          { header: "وضعیت", ...s((r) => (r.locked ? "قفل" : "")), width: "70px" },
        ]}
        rows={items}
        edit={{ path: (r: Rule) => `/cost-collectors/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

function RuleForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const [form, setForm] = usePersistedState<FormState>(cacheKey, EMPTY);
  const [meta, setMeta] = useState<{ locked: boolean }>({ locked: false });
  const [leaves, setLeaves] = useState<Leaf[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const { flash } = useSavedFlash();

  useEffect(() => {
    api.get("/cost-collectors/leaves").then(setLeaves).catch(() => setLeaves([]));
    api.get("/reporting-periods").then(setPeriods).catch(() => setPeriods([]));
    api.get("/cost-collectors/drivers").then(setDrivers).catch(() => setDrivers([]));
  }, []);

  useEffect(() => {
    if (!editId) return;
    api.get(`/cost-collectors/${editId}`).then((r: Rule) => {
      setMeta({ locked: r.locked });
      if (!hasPersistedState(cacheKey)) {
        setForm({ accountId: String(r.accountId), fromReportingPeriodId: String(r.fromReportingPeriodId), noEffect: r.noEffect, nodeId: r.nodeId ? String(r.nodeId) : "", behavior: r.behavior, basis: r.basis, driverId: r.driverId ? String(r.driverId) : "" });
      }
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const payload = {
      accountId: Number(form.accountId),
      fromReportingPeriodId: Number(form.fromReportingPeriodId),
      noEffect: form.noEffect,
      nodeId: form.noEffect ? null : Number(form.nodeId),
      behavior: form.behavior,
      basis: form.basis,
      driverId: form.basis === "TIME_DRIVER" ? Number(form.driverId) : null,
    };
    try {
      if (editId) {
        await api.put(`/cost-collectors/${editId}`, payload);
        flash();
      } else {
        const created = await api.post("/cost-collectors", payload);
        flash();
        navigate(`/cost-collectors/${created.id}/edit`);
      }
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/cost-collectors/${editId}`);
      navigate("/cost-collectors");
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  if (!loaded) return null;
  const locked = meta.locked;
  const period = periods.find((p) => p.id === Number(form.fromReportingPeriodId));
  const leaf = leaves.find((l) => l.id === Number(form.nodeId));

  return (
    <FormPage title={editId ? "ویرایش قاعده‌ی معین" : "قاعده‌ی جدید معین"} formId="cost-collector-form" closePath="/cost-collectors" newPath="/cost-collectors/new" onDelete={editId && !locked ? handleDelete : undefined}>
      <form id="cost-collector-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        {locked && <div className="card" style={{ padding: 8, marginBottom: 8 }}>برای این دوره (یا بعد از آن) بهای تمام‌شده محاسبه شده و این قاعده قفل است؛ ابتدا محاسبه‌ها را حذف کنید.</div>}
        <div className="form-grid">
          <div className="form-field">
            <label>معین<RequiredMark /></label>
            <LeafAccountField value={form.accountId} requireDetailTypeCode={2} disabled={locked || !!editId} onChange={(id) => setForm({ ...form, accountId: id })} />
          </div>
          <div className="form-field">
            <label>دوره‌ی شروع<RequiredMark /></label>
            <RecordPickerField<Period>
              title="انتخاب دوره‌ی گزارشگری"
              disabled={locked}
              displayValue={period ? period.title : ""}
              rows={periods}
              columns={[
                { header: "کد", render: (p) => toFaDigits(p.code), filterValue: (p) => p.code, width: "80px" },
                { header: "عنوان", render: (p) => p.title, filterValue: (p) => p.title },
              ]}
              onSelect={(p) => setForm({ ...form, fromReportingPeriodId: String(p.id) })}
            />
          </div>
          <div className="form-field">
            <label className="checkbox-row">
              <input type="checkbox" checked={form.noEffect} disabled={locked} onChange={(e) => setForm({ ...form, noEffect: e.target.checked, nodeId: e.target.checked ? "" : form.nodeId })} /> بدون تأثیر (از این دوره به بعد جزو هزینه‌یابی نیست)
            </label>
          </div>
          {!form.noEffect && (
            <div className="form-field">
              <label>عامل جمع‌آوری<RequiredMark /></label>
              <RecordPickerField<Leaf>
                title="انتخاب عامل جمع‌آوری (برگ دستمزد/سربار)"
                disabled={locked}
                displayValue={leaf ? leaf.path : ""}
                rows={leaves}
                columns={[
                  { header: "نوع", render: (l) => l.rootTitle, filterValue: (l) => l.rootTitle, width: "100px" },
                  { header: "شاخه", render: (l) => l.path, filterValue: (l) => l.path },
                ]}
                onSelect={(l) => setForm({ ...form, nodeId: String(l.id) })}
              />
            </div>
          )}
          <div className="form-field">
            <label>رفتار هزینه</label>
            <select value={form.behavior} disabled={locked} onChange={(e) => setForm({ ...form, behavior: e.target.value })}>
              {Object.entries(BEHAVIOR_FA).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label>مبنای تسهیم بین مراکز<RequiredMark /></label>
            <select
              value={form.basis === "TIME_DRIVER" ? `D:${form.driverId}` : form.basis}
              disabled={locked}
              onChange={(e) => {
                const v = e.target.value;
                if (v.startsWith("D:")) setForm({ ...form, basis: "TIME_DRIVER", driverId: v.slice(2) });
                else setForm({ ...form, basis: v, driverId: "" });
              }}
            >
              <option value="QUANTITY">{BASIS_FA.QUANTITY}</option>
              <option value="MATERIAL_COST">{BASIS_FA.MATERIAL_COST}</option>
              {drivers.map((d) => <option key={d.id} value={`D:${d.id}`}>زمان: {d.title}</option>)}
              {form.basis === "TIME_DRIVER" && form.driverId && !drivers.some((d) => String(d.id) === form.driverId) && <option value={`D:${form.driverId}`}>زمان: (غیرفعال)</option>}
            </select>
          </div>
        </div>
      </form>
    </FormPage>
  );
}
