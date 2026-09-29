import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ErrorToast } from "../components/ErrorToast";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { RefreshButton } from "../components/RefreshButton";
import { InfoHint } from "../components/InfoHint";
import { RequiredMark } from "../components/RequiredMark";
import { api, ApiError } from "../lib/api";
import { showError } from "../lib/toast";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { formatJalaliDate } from "../lib/formatDate";
import { fieldTitleForKey, formTitleForKey } from "../lib/frequentDescriptionForms";

// «شرح‌های پرکاربرد» — فرم مدیریت (مشاهده/ویرایش/حذف). رکوردها از خودِ فرم‌ها و با آیکن ذخیره کنار فیلد شرح
// ساخته می‌شوند (components/DescriptionField.tsx)، پس این فرم «جدید» ندارد. برای همه‌ی کاربران مشترک است.

interface FrequentDescription {
  id: number;
  formKey: string;
  fieldKey: string;
  text: string;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function FrequentDescriptions() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/edit")) return <FrequentDescriptionForm editId={Number(id)} />;
  return <FrequentDescriptionList />;
}

function FrequentDescriptionList() {
  const cacheKey = "/frequent-descriptions";
  const [items, setItems] = usePersistedState<FrequentDescription[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    api.get("/frequent-descriptions/manage").then(setItems).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onDelete(row: FrequentDescription) {
    try {
      await api.del(`/frequent-descriptions/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint
            text="شرح‌هایی که کاربران با آیکن ذخیره کنار فیلد شرح یک فرم ذخیره کرده‌اند؛ هنگام تایپ در همان فیلد همان فرم پیشنهاد می‌شوند و بین همه‌ی کاربران مشترک‌اند. اینجا می‌توانید آن‌ها را ویرایش یا حذف کنید."
            title="شرح‌های پرکاربرد"
          />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "فرم", render: (r) => formTitleForKey(r.formKey), filterType: "string", filterValue: (r) => formTitleForKey(r.formKey) },
          { header: "فیلد", render: (r) => fieldTitleForKey(r.fieldKey), width: "90px", filterType: "string", filterValue: (r) => fieldTitleForKey(r.fieldKey) },
          { header: "شرح", render: (r) => r.text, filterType: "string", filterValue: (r) => r.text },
          { header: "ایجادکننده", render: (r) => r.createdByName || "—", filterType: "string", filterValue: (r) => r.createdByName || "" },
          { header: "تاریخ ایجاد", render: (r) => formatJalaliDate(r.createdAt), width: "110px", filterType: "string", filterValue: (r) => formatJalaliDate(r.createdAt) },
        ]}
        rows={items}
        edit={{ path: (r) => `/frequent-descriptions/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

function FrequentDescriptionForm({ editId }: { editId: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const [record, setRecord] = useState<FrequentDescription | null>(null);
  const [text, setText] = usePersistedState(cacheKey, "");
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(hasPersistedState(cacheKey));
  const { flash } = useSavedFlash();

  useEffect(() => {
    api.get("/frequent-descriptions/manage").then((items: FrequentDescription[]) => {
      const found = items.find((i) => i.id === editId) || null;
      setRecord(found);
      if (found && !hasPersistedState(cacheKey)) setText(found.text);
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!text.trim()) return setError("شرح الزامی است");
    try {
      await api.put(`/frequent-descriptions/${editId}`, { text });
      flash();
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  async function handleDelete() {
    try {
      await api.del(`/frequent-descriptions/${editId}`);
      navigate("/frequent-descriptions");
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  if (!loaded) return null;
  if (!record) return <div className="empty-state">شرح یافت نشد</div>;

  return (
    <FormPage title="ویرایش شرح پرکاربرد" formId="frequent-description-form" closePath="/frequent-descriptions" onDelete={handleDelete}>
      <form id="frequent-description-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        <div className="form-grid">
          <div className="form-field">
            <label>فرم</label>
            <input value={formTitleForKey(record.formKey)} disabled />
          </div>
          <div className="form-field">
            <label>فیلد</label>
            <input value={fieldTitleForKey(record.fieldKey)} disabled />
          </div>
          <div className="form-field full">
            <label>شرح<RequiredMark /></label>
            <input value={text} onChange={(e) => setText(e.target.value)} autoFocus />
          </div>
        </div>
      </form>
    </FormPage>
  );
}
