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
import { api, ApiError } from "../lib/api";
import { showError } from "../lib/toast";
import { toFaDigits } from "../lib/formatAmount";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";

// «نوع تضمین» (مدیریت خزانه › تنظیمات): نوع (دریافت/پرداخت) + کد (خودکار: آخرین + ۱، فقط‌خواندنی) + عنوان (یکتا). قواعد در سرور (routes/guaranteeTypes.ts).

type Direction = "RECEIPT" | "PAYMENT";
const DIRECTION_FA: Record<Direction, string> = { RECEIPT: "دریافت", PAYMENT: "پرداخت" };
interface Row {
  id: number;
  code: number;
  direction: Direction;
  title: string;
  updatedAt?: string;
}

export default function GuaranteeTypes() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <GuaranteeTypeForm />;
  if (location.pathname.endsWith("/edit")) return <GuaranteeTypeForm editId={Number(id)} />;
  return <GuaranteeTypeList />;
}

function GuaranteeTypeList() {
  const cacheKey = "/guarantee-types";
  const [items, setItems] = usePersistedState<Row[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  async function reload() {
    api.get("/guarantee-types").then((r) => { setItems(r); setError(null); }).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function onDelete(row: Row) {
    try {
      await api.del(`/guarantee-types/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint title="نوع تضمین" text="تعریف انواع تضمین برای دریافت یا پرداخت. کد را سیستم خودکار می‌دهد (آخرین کد + ۱) و عنوان تکراری مجاز نیست." />
          <NewRecordButton path="/guarantee-types/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "کد", render: (r: Row) => toFaDigits(String(r.code)), filterType: "number" as const, filterValue: (r: Row) => r.code, width: "80px" },
          { header: "نوع", render: (r: Row) => DIRECTION_FA[r.direction], filterType: "string" as const, filterValue: (r: Row) => DIRECTION_FA[r.direction], width: "120px" },
          { header: "عنوان", render: (r: Row) => r.title, filterType: "string" as const, filterValue: (r: Row) => r.title },
        ]}
        rows={items}
        edit={{ path: (r: Row) => `/guarantee-types/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

function GuaranteeTypeForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const [form, setForm] = usePersistedState(cacheKey, { code: "", direction: "RECEIPT" as Direction, title: "" });
  const [updatedAt, setUpdatedAt] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const { flash } = useSavedFlash();

  async function load() {
    if (!editId) return;
    const r: Row = await api.get(`/guarantee-types/${editId}`);
    setUpdatedAt(r.updatedAt);
    if (!hasPersistedState(cacheKey)) setForm({ code: String(r.code), direction: r.direction, title: r.title });
  }
  useEffect(() => {
    load().then(() => setLoaded(true)).catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.title.trim()) return setError("عنوان الزامی است");
    // کد عمداً ارسال نمی‌شود: فقط سرور آن را می‌دهد
    const body = { direction: form.direction, title: form.title };
    try {
      if (editId) {
        await api.put(`/guarantee-types/${editId}`, { ...body, updatedAt });
        flash();
        await load();
      } else {
        const created = await api.post("/guarantee-types", body);
        flash();
        navigate(`/guarantee-types/${created.id}/edit`);
      }
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/guarantee-types/${editId}`);
      navigate("/guarantee-types");
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  if (!loaded) return null;
  return (
    <FormPage title={editId ? "ویرایش نوع تضمین" : "نوع تضمین جدید"} formId="guarantee-type-form" closePath="/guarantee-types" newPath="/guarantee-types/new" onDelete={editId ? handleDelete : undefined}>
      <form id="guarantee-type-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        <div className="form-grid">
          <div className="form-field">
            <label>نوع<RequiredMark /></label>
            <div style={{ display: "flex", gap: 16 }}>
              {(["RECEIPT", "PAYMENT"] as Direction[]).map((d) => (
                <label key={d} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input type="radio" name="direction" checked={form.direction === d} onChange={() => setForm({ ...form, direction: d })} />
                  {DIRECTION_FA[d]}
                </label>
              ))}
            </div>
          </div>
          <div className="form-field">
            <label>کد <FieldHint label="کد" text="به‌صورت خودکار توسط سیستم (آخرین کد + ۱) صادر می‌شود و قابل ویرایش نیست." /></label>
            <input dir="ltr" disabled value={form.code ? toFaDigits(form.code) : ""} placeholder="پس از ذخیره صادر می‌شود" />
          </div>
          <div className="form-field">
            <label>عنوان<RequiredMark /></label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus />
          </div>
        </div>
      </form>
    </FormPage>
  );
}
