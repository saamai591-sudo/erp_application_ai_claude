import { FormEvent, useEffect, useState } from "react";
import { ErrorToast } from "../components/ErrorToast";
import { showError } from "../lib/toast";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { RecordPickerField } from "../components/RecordPicker";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { InfoHint } from "../components/InfoHint";
import { FieldHint } from "../components/FieldHint";
import { RequiredMark } from "../components/RequiredMark";
import { toFaDigits } from "../lib/formatAmount";
import { api, ApiError } from "../lib/api";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { partyDisplayName } from "./Users";
import { PartyQuickDialog, QuickParty, EMPTY_QUICK_PARTY } from "../components/PartyQuickDialog";
import { childrenFromDetail, childrenPayload } from "../components/PartySections";

// «مشتری» — طبق تصمیم صریح کاربر، طرف‌حساب ساده، دقیقاً مثل «تامین‌کننده» ولی عمداً بدون
// گروه/کارشناس فروش (بدون تنظیمات اضافه). رجوع کنید به Suppliers.tsx برای الگوی مرجع.

interface PartyOption {
  id: number;
  detailCode: string;
  category: "INDIVIDUAL" | "LEGAL";
  isActive: boolean;
  firstName: string | null;
  lastName: string | null;
  name: string | null;
  detailTitle?: string | null;
  nationality?: "LOCAL" | "FOREIGN";
  nationalId?: string | null;
  foreignId?: string | null;
  economicCode?: string | null;
  registrationNumber?: string | null;
  legalType?: "LEGAL" | "SPECIAL_PARTNERSHIP" | "BANK" | null;
  updatedAt?: string;
}

/** فیلدهای شخص برای ارسال به سرور (سرویس مشترک طرف‌حساب) */
function quickToPayload(p: QuickParty) {
  return {
    category: p.category,
    nationality: p.nationality,
    firstName: p.firstName,
    lastName: p.lastName,
    name: p.name,
    legalType: p.legalType,
    nationalId: p.nationalId,
    foreignId: p.foreignId,
    economicCode: p.economicCode,
    registrationNumber: p.registrationNumber,
    detailTitle: p.detailTitle,
    ...childrenPayload(p.children),
  };
}
function partyToQuick(p: PartyOption & { addresses?: any[]; phones?: any[]; bankAccounts?: any[] }): QuickParty {
  return {
    ...EMPTY_QUICK_PARTY,
    category: p.category,
    nationality: p.nationality || "LOCAL",
    firstName: p.firstName || "",
    lastName: p.lastName || "",
    name: p.name || "",
    legalType: p.legalType || "LEGAL",
    nationalId: p.nationalId || "",
    foreignId: p.foreignId || "",
    economicCode: p.economicCode || "",
    registrationNumber: p.registrationNumber || "",
    detailTitle: p.detailTitle || "",
    children: childrenFromDetail(p),
  };
}

interface CustomerRow {
  id: number;
  code: number;
  partyId: number;
  party: PartyOption;
  isActive: boolean;
  hasTransactions: boolean;
}

export default function Customers() {
  const location = useLocation();
  const { id } = useParams();
  const isNew = location.pathname.endsWith("/new");
  const isEdit = location.pathname.endsWith("/edit");
  if (isNew) return <CustomerForm />;
  if (isEdit) return <CustomerForm editId={Number(id)} />;
  return <CustomerList />;
}

function CustomerList() {
  const cacheKey = "/customers";
  const [items, setItems] = usePersistedState<CustomerRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function reload() {
    api.get("/customers").then(setItems).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onDelete(row: CustomerRow) {
    try {
      await api.del(`/customers/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text="تعریف مشتریان مختلف سیستم فروش" title="مشتری" />
          <NewRecordButton path="/customers/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "کد", render: (r) => toFaDigits(String(r.code)), width: "80px", filterType: "number", filterValue: (r) => r.code },
          { header: "طرف حساب", render: (r) => partyDisplayName(r.party), filterType: "string", filterValue: (r) => partyDisplayName(r.party) },
          { header: "فعال", render: (r) => (r.isActive ? "بله" : "خیر"), width: "80px" },
        ]}
        rows={items}
        edit={{ path: (r) => `/customers/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

const DEFAULT_FORM = { code: "", partyId: "", isActive: true };

function CustomerForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const [parties, setParties] = useState<PartyOption[]>([]);
  const [hasTransactions, setHasTransactions] = useState(false);
  const [form, setForm] = usePersistedState(cacheKey, DEFAULT_FORM);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const [dialog, setDialog] = useState<"create" | "edit" | null>(null);
  // جزئیات کامل شخص (با نشانی/تلفن/حساب بانکی و updatedAt) برای دیالوگ ویرایش
  const [editParty, setEditParty] = useState<any>(null);
  const { flash } = useSavedFlash();

  function loadParties() {
    return api.get("/parties").then((p: PartyOption[]) => setParties(p.filter((x) => x.isActive))).catch(() => {});
  }
  // فهرست اشخاص با تغییر رکورد هم تازه می‌شود: بعد از «تعریف شخص جدید» همین کامپوننت (بدون mount دوباره) از /customers/new به /customers/<id>/edit می‌رود
  // و فهرست قدیمی شخصِ تازه را نداشت؛ پس عنوان در انتخابگر طرف حساب خالی می‌ماند
  useEffect(() => {
    loadParties();
  }, [editId]);

  useEffect(() => {
    if (!editId) {
      if (!hasPersistedState(cacheKey)) {
        setForm(DEFAULT_FORM);
        setHasTransactions(false);
      }
      return;
    }
    if (hasPersistedState(cacheKey)) return;
    api.get("/customers").then((items: CustomerRow[]) => {
      const found = items.find((i) => i.id === editId);
      if (found) {
        setHasTransactions(found.hasTransactions);
        setForm({ code: String(found.code), partyId: String(found.partyId), isActive: found.isActive });
      }
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  const selectedParty = parties.find((p) => String(p.id) === form.partyId);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.partyId) return setError("طرف حساب الزامی است");
    const body = { code: form.code ? Number(form.code) : undefined, partyId: Number(form.partyId), isActive: form.isActive };
    try {
      if (editId) {
        await api.put(`/customers/${editId}`, body);
        flash();
      } else {
        const created = await api.post("/customers", body);
        flash();
        navigate(`/customers/${created.id}/edit`);
      }
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  // تعریف سریع: شخص و مشتری با هم در یک درخواست ساخته می‌شوند (سرویس مشترک طرف‌حساب؛ کد/شناسه ملی و عنوان تفصیل تکراری رد می‌شود)
  async function createQuick(p: QuickParty, confirmDuplicate: boolean) {
    const created = await api.post("/customers", { code: form.code ? Number(form.code) : undefined, isActive: form.isActive, party: quickToPayload(p), confirmDuplicate });
    flash();
    setDialog(null);
    navigate(`/customers/${created.id}/edit`);
  }
  // ویرایش آزادِ هویتِ شخصِ همین مشتری (برای شخصِ دارای چند نقش روی همه‌ی نقش‌ها اثر می‌گذارد)
  async function editQuick(p: QuickParty, confirmDuplicate: boolean) {
    await api.put(`/customers/${editId}`, { party: { ...quickToPayload(p), updatedAt: editParty?.updatedAt }, confirmDuplicate });
    flash();
    setDialog(null);
    await loadParties();
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/customers/${editId}`);
      navigate("/customers");
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  if (!loaded) return null;

  return (
    <FormPage
      title={editId ? "ویرایش مشتری" : "مشتری جدید"}
      formId="customer-form"
      closePath="/customers"
      newPath="/customers/new"
      onDelete={editId ? handleDelete : undefined}
    >
      <form id="customer-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        <div className="form-grid">
          <div className="form-field">
            <label>کد <FieldHint label="کد" text="اختیاری — در صورت خالی بودن، سیستم تعیین می‌کند" /></label>
            <input dir="ltr" disabled={!!editId} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          </div>
          <div className="form-field">
            <label>
              طرف حساب
              <RequiredMark />
              {hasTransactions && <FieldHint label="طرف حساب" text="این مشتری گردش دارد و طرف حساب آن قابل تغییر نیست" />}
            </label>
            <RecordPickerField
              title="انتخاب طرف حساب"
              disabled={hasTransactions}
              displayValue={selectedParty ? `${toFaDigits(selectedParty.detailCode)} — ${partyDisplayName(selectedParty)}` : ""}
              rows={parties}
              columns={[
                { header: "کد", render: (p) => toFaDigits(p.detailCode), filterValue: (p) => p.detailCode, width: "90px" },
                { header: "نام", render: (p) => partyDisplayName(p), filterValue: (p) => partyDisplayName(p) },
                { header: "نوع", render: (p) => (p.category === "LEGAL" ? "حقوقی" : "حقیقی"), filterValue: (p) => (p.category === "LEGAL" ? "حقوقی" : "حقیقی"), width: "80px" },
              ]}
              onSelect={(p) => setForm({ ...form, partyId: String(p.id) })}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              {!editId && (
                <button type="button" className="link-btn" onClick={() => setDialog("create")}>
                  + تعریف شخص جدید
                </button>
              )}
              {editId && selectedParty && (
                <button
                  type="button"
                  className="link-btn"
                  onClick={async () => {
                    try {
                      setEditParty(await api.get(`/parties/${selectedParty.id}`));
                      setDialog("edit");
                    } catch (e) {
                      showError((e as Error).message);
                    }
                  }}
                >
                  ویرایش مشخصات شخص
                </button>
              )}
            </div>
          </div>
          <div className="form-field">
            <label className="checkbox-row">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
              فعال
            </label>
          </div>
        </div>
      </form>
      {dialog === "create" && (
        <PartyQuickDialog
          mode="create"
          onSubmit={createQuick}
          onPickExisting={(id) => {
            setForm({ ...form, partyId: String(id) });
            setDialog(null);
          }}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "edit" && editParty && <PartyQuickDialog mode="edit" initial={partyToQuick(editParty)} onSubmit={editQuick} onClose={() => setDialog(null)} />}
    </FormPage>
  );
}
