import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useCrud } from "../lib/useCrud";
import { DataTable } from "../components/DataTable";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { ExcelImportButton } from "../components/ExcelImport";
import { FormPage } from "../components/FormPage";
import { api, ApiError } from "../lib/api";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { InfoHint } from "../components/InfoHint";
import { toFaDigits } from "../lib/formatAmount";

interface CashBox { id: number; detailCode: string; title: string; hasTransactions: boolean }

export default function CashBoxes() {
  const location = useLocation();
  const { id } = useParams();
  const isNew = location.pathname.endsWith("/new");
  const isEdit = location.pathname.endsWith("/edit");
  if (isNew) return <CashBoxForm />;
  if (isEdit) return <CashBoxForm editId={Number(id)} />;
  return <CashBoxList />;
}

function CashBoxList() {
  const { items, loading, error, remove, reload, create } = useCrud<CashBox>("/cash-boxes");
  const [bulkSlot, setBulkSlot] = useState<HTMLDivElement | null>(null);
  const navigate = useNavigate();
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}><InfoHint text={`تعریف صندوق‌های نقدی سازمان — کد به صورت خودکار بر اساس «نوع تفصیل» صادر می‌شود`} title="صندوق" /><NewRecordButton path="/cash-boxes/new" />
          <ExcelImportButton
            entityLabel="صندوق‌ها"
            templateFilename="قالب-صندوق"
            backendEntityType="cash-box"
            columns={[
              { key: "title", label: "عنوان", required: true },
              { key: "detailCode", label: "کد تفصیل", hint: "اختیاری — اگر خالی بگذارید خودکار صادر می‌شود" },
            ]}
            onDone={reload}
          />
          <RefreshButton onClick={reload} /><div ref={setBulkSlot} className="bulk-slot" style={{ display: "flex" }} />
        </div>
      </div>
      {error && <div className="alert error">{error}</div>}
      {!loading && (
        <DataTable
        bulkActionsContainer={bulkSlot}
          columns={[
            { header: "کد", render: (r) => toFaDigits(r.detailCode), width: "120px", filterType: "string", filterValue: (r) => r.detailCode },
            { header: "عنوان", render: (r) => r.title, filterType: "string", filterValue: (r) => r.title },
          ]}
          rows={items}
          onEdit={(r) => navigate(`/cash-boxes/${r.id}/edit`)}
          onDelete={async (r) => {
            const res = await remove(r.id);
            if (!res.ok) alert(res.error);
          }}
        />
      )}
    </div>
  );
}

function CashBoxForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:title`;
  const { create } = useCrud<CashBox>("/cash-boxes");
  const [title, setTitle] = usePersistedState(cacheKey, "");
  const [formError, setFormError] = useState<string | null>(null);
  const { saved, flash } = useSavedFlash();
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));

  useEffect(() => {
    if (!editId || hasPersistedState(cacheKey)) return;
    api.get("/cash-boxes").then((items: CashBox[]) => {
      const found = items.find((i) => i.id === editId);
      if (found) setTitle(found.title);
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (editId) {
      try {
        await api.put(`/cash-boxes/${editId}`, { title });
        flash();
      } catch (err) {
        setFormError((err as ApiError).message);
      }
    } else {
      const res = await create({ title });
      if (res.ok && res.data) {
        flash();
        navigate(`/cash-boxes/${res.data.id}/edit`);
      } else setFormError(res.error || "خطا");
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/cash-boxes/${editId}`);
      navigate("/cash-boxes");
    } catch (err) {
      alert((err as ApiError).message);
    }
  }

  if (!loaded) return null;

  return (
    <FormPage
      title={editId ? "ویرایش صندوق" : "صندوق جدید"}
      formId="cashbox-form"
      closePath="/cash-boxes"
      newPath="/cash-boxes/new"
      onDelete={editId ? handleDelete : undefined}
    >
      <form id="cashbox-form" onSubmit={onSubmit}>
        {formError && <div className="alert error">{formError}</div>}
        {saved && <div className="alert warn">تغییرات ذخیره شد</div>}
        <div className="form-field full">
          <label>عنوان</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        </div>
      </form>
    </FormPage>
  );
}
