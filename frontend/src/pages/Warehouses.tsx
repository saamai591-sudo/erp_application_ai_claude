import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { api, ApiError } from "../lib/api";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { ExcelImportButton } from "../components/ExcelImport";
import { InfoHint } from "../components/InfoHint";
import { FieldHint } from "../components/FieldHint";
import { RecordPickerField } from "../components/RecordPicker";
import { RequiredMark } from "../components/RequiredMark";
import { toFaDigits } from "../lib/formatAmount";
import { WarehouseGroup } from "./WarehouseGroups";

interface PartyOption {
  id: number;
  detailCode: string;
  category: "INDIVIDUAL" | "LEGAL";
  isActive: boolean;
  firstName: string | null;
  lastName: string | null;
}

function partyDisplayName(p: PartyOption): string {
  return `${p.firstName || ""} ${p.lastName || ""}`.trim();
}

interface Warehouse {
  id: number;
  code: number;
  title: string;
  warehouseGroupId: number;
  warehouseGroup: WarehouseGroup;
  address: string | null;
  phone: string | null;
  managerId: number | null;
  manager: { firstName: string | null; lastName: string | null } | null;
  stockControl: boolean;
  isActive: boolean;
  hasTransactions: boolean;
  implementationDate: string | null;
}

export default function Warehouses() {
  const location = useLocation();
  const { id } = useParams();
  const isNew = location.pathname.endsWith("/new");
  const isEdit = location.pathname.endsWith("/edit");
  if (isNew) return <WarehouseForm />;
  if (isEdit) return <WarehouseForm editId={Number(id)} />;
  return <WarehouseList />;
}

function WarehouseList() {
  const cacheKey = "/warehouses";
  const [items, setItems] = usePersistedState<Warehouse[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function reload() {
    api.get("/warehouses").then(setItems).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onDelete(row: Warehouse) {
    try {
      await api.del(`/warehouses/${row.id}`);
      await reload();
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text={`تعریف انبارهای مختلف در سیستم`} title="انبار" />
          <NewRecordButton path="/warehouses/new" />
          <ExcelImportButton
            entityLabel="انبارها"
            templateFilename="قالب-انبار"
            backendEntityType="warehouse"
            columns={[
              { key: "title", label: "عنوان", required: true },
              { key: "warehouseGroupTitle", label: "عنوان گروه انبار", required: true },
              { key: "managerDetailCode", label: "کد تفصیل مسئول انبار", hint: "اختیاری — باید طرف‌حساب حقیقی فعال باشد" },
              { key: "address", label: "آدرس" },
              { key: "phone", label: "تلفن" },
              { key: "stockControl", label: "کنترل موجودی", hint: "بله / خیر — پیش‌فرض بله" },
              { key: "code", label: "کد", hint: "اختیاری — اگر خالی بگذارید خودکار صادر می‌شود" },
              { key: "isActive", label: "فعال", hint: "بله / خیر — پیش‌فرض بله" },
            ]}
            onDone={reload}
          />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      {error && <div className="alert error">{error}</div>}
      <DataTable
        columns={[
          { header: "کد", render: (r) => toFaDigits(String(r.code)), width: "80px", filterType: "number", filterValue: (r) => r.code },
          { header: "عنوان", render: (r) => r.title, filterType: "string", filterValue: (r) => r.title },
          { header: "گروه انبار", render: (r) => r.warehouseGroup?.title, filterType: "string", filterValue: (r) => r.warehouseGroup?.title },
          { header: "مسئول انبار", render: (r) => (r.manager ? `${r.manager.firstName || ""} ${r.manager.lastName || ""}`.trim() : "—") },
          { header: "کنترل موجودی", render: (r) => (r.stockControl ? "بله" : "خیر"), width: "100px" },
          { header: "فعال", render: (r) => (r.isActive ? "بله" : "خیر"), width: "80px" },
        ]}
        rows={items}
        edit={{ path: (r) => `/warehouses/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

const DEFAULT_WAREHOUSE_FORM = {
  code: "",
  title: "",
  warehouseGroupId: "",
  address: "",
  phone: "",
  managerId: "",
  stockControl: true,
  isActive: true,
  implementationDate: "",
};

function WarehouseForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const [parties, setParties] = useState<PartyOption[]>([]);
  const [allGroups, setAllGroups] = useState<WarehouseGroup[]>([]);
  const [hasTransactions, setHasTransactions] = useState(false);
  const [form, setForm] = usePersistedState(cacheKey, DEFAULT_WAREHOUSE_FORM);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const { flash } = useSavedFlash();

  useEffect(() => {
    api.get("/warehouse-groups").then(setAllGroups);
    api.get("/parties?category=INDIVIDUAL").then((p: PartyOption[]) => setParties(p.filter((x) => x.isActive)));
  }, []);

  // فعال + گروه انبار فعلی (حتی اگر بعدا غیرفعال شده باشد) تا مقدار انتخاب‌شده از دراپ‌داون گم نشود
  const groups = allGroups.filter((g) => g.isActive || String(g.id) === form.warehouseGroupId);
  const selectedManager = parties.find((p) => String(p.id) === form.managerId);

  useEffect(() => {
    // این کامپوننت وقتی از حالت ویرایش با دکمه‌ی «جدید» به فرم خالی می‌رود، remount نمی‌شود
    // (هر دو مسیر به همین WarehouseForm می‌رسند)؛ پس باید فرم را صریحاً به مقدار پیش‌فرض برگردانیم
    if (!editId) {
      if (!hasPersistedState(cacheKey)) {
        setForm(DEFAULT_WAREHOUSE_FORM);
        setHasTransactions(false);
      }
      return;
    }
    if (hasPersistedState(cacheKey)) return;
    api.get("/warehouses").then((items: Warehouse[]) => {
      const found = items.find((i) => i.id === editId);
      if (found) {
        setHasTransactions(found.hasTransactions);
        setForm({
          code: String(found.code),
          title: found.title,
          warehouseGroupId: String(found.warehouseGroupId),
          address: found.address || "",
          phone: found.phone || "",
          managerId: found.managerId ? String(found.managerId) : "",
          stockControl: found.stockControl,
          isActive: found.isActive,
          implementationDate: found.implementationDate ? found.implementationDate.slice(0, 10) : "",
        });
      }
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const body = {
      code: form.code ? Number(form.code) : undefined,
      title: form.title,
      warehouseGroupId: Number(form.warehouseGroupId),
      address: form.address || null,
      phone: form.phone || null,
      managerId: form.managerId ? Number(form.managerId) : null,
      stockControl: form.stockControl,
      isActive: form.isActive,
      implementationDate: form.implementationDate || null,
    };
    try {
      if (editId) {
        await api.put(`/warehouses/${editId}`, body);
        flash();
      } else {
        const created = await api.post("/warehouses", body);
        flash();
        navigate(`/warehouses/${created.id}/edit`);
      }
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/warehouses/${editId}`);
      navigate("/warehouses");
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  if (!loaded) return null;

  return (
    <FormPage
      title={editId ? "ویرایش انبار" : "انبار جدید"}
      formId="warehouse-form"
      closePath="/warehouses"
      newPath="/warehouses/new"
      onDelete={editId ? handleDelete : undefined}
    >
      <form id="warehouse-form" onSubmit={onSubmit}>
        {error && <div className="alert error">{error}</div>}
        <div className="form-grid">
          <div className="form-field">
            <label>کد <FieldHint label="کد" text="اختیاری — در صورت خالی بودن، سیستم تعیین می‌کند" /></label>
            <input dir="ltr" disabled={!!editId} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          </div>
          <div className="form-field">
            <label>عنوان<RequiredMark /></label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus />
          </div>
          <div className="form-field">
            <label>
              گروه انبار<RequiredMark />
              {hasTransactions && <FieldHint label="گروه انبار" text="این انبار گردش دارد و گروه آن قابل تغییر نیست" />}
            </label>
            <select
              value={form.warehouseGroupId}
              onChange={(e) => setForm({ ...form, warehouseGroupId: e.target.value })}
              disabled={hasTransactions}
            >
              <option value="">انتخاب کنید</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label>مسئول انبار <FieldHint label="مسئول انبار" text="اختیاری" /></label>
            <RecordPickerField
              title="انتخاب مسئول انبار"
              placeholder="ندارد"
              displayValue={selectedManager ? `${toFaDigits(selectedManager.detailCode)} — ${partyDisplayName(selectedManager)}` : ""}
              rows={parties}
              columns={[
                { header: "کد", render: (p) => toFaDigits(p.detailCode), filterValue: (p) => p.detailCode, width: "90px" },
                { header: "نام", render: (p) => partyDisplayName(p), filterValue: (p) => partyDisplayName(p) },
              ]}
              onSelect={(p) => setForm({ ...form, managerId: String(p.id) })}
              onClear={() => setForm({ ...form, managerId: "" })}
            />
          </div>
          <div className="form-field">
            <label>آدرس (اختیاری)</label>
            <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div className="form-field">
            <label>تلفن (اختیاری)</label>
            <input dir="ltr" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="form-field">
            <label>
              تاریخ راه‌اندازی
              {hasTransactions ? (
                <FieldHint label="تاریخ راه‌اندازی" text="این انبار گردش دارد و تاریخ راه‌اندازی آن قابل تغییر نیست" />
              ) : (
                <FieldHint
                  label="تاریخ راه‌اندازی"
                  text="اختیاری — تا وقتی این انبار هیچ‌وقت تایید نشده، یک روز قبل از این تاریخ به‌جای «آخرین تاریخ تایید» در «تایید انبار» در نظر گرفته می‌شود"
                />
              )}
            </label>
            <JalaliDatePicker
              value={form.implementationDate}
              onChange={(v) => setForm({ ...form, implementationDate: v })}
              placeholder="انتخاب تاریخ"
              disabled={hasTransactions}
            />
          </div>
          <div className="form-field">
            <label className="checkbox-row">
              <input type="checkbox" checked={form.stockControl} onChange={(e) => setForm({ ...form, stockControl: e.target.checked })} />
              کنترل موجودی
            </label>
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
