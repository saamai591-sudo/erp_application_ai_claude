import { FormEvent, useEffect, useState } from "react";
import { ErrorToast } from "../components/ErrorToast";
import { showError } from "../lib/toast";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { RecordPickerField } from "../components/RecordPicker";
import { api, ApiError } from "../lib/api";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { InfoHint } from "../components/InfoHint";
import { FieldHint } from "../components/FieldHint";
import { RequiredMark } from "../components/RequiredMark";
import { toFaDigits } from "../lib/formatAmount";
import { partyDisplayName } from "./Users";

// «تنخواه‌دار» (مدیریت خزانه › تنظیمات). کد تفصیلی را سرور با سرویس عمومی «ایجاد کد تفصیلی» صادر می‌کند؛ کاربر آن را وارد نمی‌کند.

interface PettyCashOption { id: number; detailCode: string; title: string; isActive: boolean; currency: { title: string } }
interface PartyOption {
  id: number;
  detailCode: string;
  category: "INDIVIDUAL" | "LEGAL";
  firstName: string | null;
  lastName: string | null;
  name: string | null;
  isActive: boolean;
}
interface Custodian {
  id: number;
  detailCode: string;
  pettyCashId: number;
  partyId: number;
  pettyCash: PettyCashOption;
  party: PartyOption;
  isActive: boolean;
  controlNegativeBalance: boolean;
  hasTransactions: boolean;
}

export default function PettyCashCustodians() {
  const location = useLocation();
  const { id } = useParams();
  const isNew = location.pathname.endsWith("/new");
  const isEdit = location.pathname.endsWith("/edit");
  if (isNew) return <CustodianForm />;
  if (isEdit) return <CustodianForm editId={Number(id)} />;
  return <CustodianList />;
}

function CustodianList() {
  const cacheKey = "/petty-cash-custodians";
  const [items, setItems] = usePersistedState<Custodian[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    api.get("/petty-cash-custodians").then(setItems).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onDelete(row: Custodian) {
    try {
      await api.del(`/petty-cash-custodians/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  const yesNo = (v: boolean) => (v ? "بله" : "خیر");
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text="تعریف تنخواه‌دارها (طرف‌حساب مسئول هر تنخواه) — کد تفصیلی به‌صورت خودکار بر اساس «نوع تفصیل» صادر می‌شود" title="تنخواه‌دار" />
          <NewRecordButton path="/petty-cash-custodians/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "کد تفصیلی", render: (r) => toFaDigits(r.detailCode), width: "110px", filterType: "string", filterValue: (r) => r.detailCode },
          { header: "تنخواه", render: (r) => r.pettyCash?.title || "—", filterType: "string", filterValue: (r) => r.pettyCash?.title || "" },
          { header: "طرف‌حساب", render: (r) => partyDisplayName(r.party), filterType: "string", filterValue: (r) => partyDisplayName(r.party) },
          { header: "فعال", render: (r) => yesNo(r.isActive), width: "80px", filterType: "string", filterValue: (r) => yesNo(r.isActive) },
          {
            header: "کنترل مانده منفی",
            render: (r) => yesNo(r.controlNegativeBalance),
            width: "130px",
            filterType: "string",
            filterValue: (r) => yesNo(r.controlNegativeBalance),
          },
        ]}
        rows={items}
        edit={{ path: (r) => `/petty-cash-custodians/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

const DEFAULT_FORM = { detailCode: "", pettyCashId: "", partyId: "", isActive: true, controlNegativeBalance: true };

function CustodianForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const [pettyCashes, setPettyCashes] = useState<PettyCashOption[]>([]);
  const [parties, setParties] = useState<PartyOption[]>([]);
  const [hasTransactions, setHasTransactions] = useState(false);
  const [form, setForm] = usePersistedState(cacheKey, DEFAULT_FORM);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const { flash } = useSavedFlash();

  useEffect(() => {
    api.get("/petty-cashes").then(setPettyCashes).catch(() => {});
    api.get("/parties").then(setParties).catch(() => {});
  }, []);

  useEffect(() => {
    if (!editId) {
      if (!hasPersistedState(cacheKey)) {
        setForm(DEFAULT_FORM);
        setHasTransactions(false);
      }
      return;
    }
    if (hasPersistedState(cacheKey)) return;
    api.get("/petty-cash-custodians").then((items: Custodian[]) => {
      const found = items.find((i) => i.id === editId);
      if (found) {
        setHasTransactions(found.hasTransactions);
        setForm({
          detailCode: found.detailCode,
          pettyCashId: String(found.pettyCashId),
          partyId: String(found.partyId),
          isActive: found.isActive,
          controlNegativeBalance: found.controlNegativeBalance,
        });
      }
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  const selectedPettyCash = pettyCashes.find((p) => String(p.id) === form.pettyCashId);
  const selectedParty = parties.find((p) => String(p.id) === form.partyId);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.pettyCashId) return setError("تنخواه الزامی است");
    if (!form.partyId) return setError("طرف‌حساب الزامی است");
    // کد تفصیلی عمداً ارسال نمی‌شود: فقط سرور آن را (با سرویس عمومی) صادر می‌کند
    const body = {
      pettyCashId: Number(form.pettyCashId),
      partyId: Number(form.partyId),
      isActive: form.isActive,
      controlNegativeBalance: form.controlNegativeBalance,
    };
    try {
      if (editId) {
        await api.put(`/petty-cash-custodians/${editId}`, body);
        flash();
      } else {
        const created = await api.post("/petty-cash-custodians", body);
        flash();
        navigate(`/petty-cash-custodians/${created.id}/edit`);
      }
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/petty-cash-custodians/${editId}`);
      navigate("/petty-cash-custodians");
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  if (!loaded) return null;

  return (
    <FormPage
      title={editId ? "ویرایش تنخواه‌دار" : "تنخواه‌دار جدید"}
      formId="petty-cash-custodian-form"
      closePath="/petty-cash-custodians"
      newPath="/petty-cash-custodians/new"
      onDelete={editId ? handleDelete : undefined}
    >
      <form id="petty-cash-custodian-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        <div className="form-grid">
          <div className="form-field">
            <label>کد تفصیلی <FieldHint label="کد تفصیلی" text="به‌صورت خودکار توسط سیستم صادر می‌شود و قابل ویرایش نیست" /></label>
            <input dir="ltr" disabled value={form.detailCode ? toFaDigits(form.detailCode) : ""} placeholder="پس از ذخیره صادر می‌شود" />
          </div>
          <div className="form-field">
            <label>
              تنخواه
              <RequiredMark />
              {hasTransactions && <FieldHint label="تنخواه" text="این تنخواه‌دار گردش دارد و تنخواه/طرف‌حساب آن قابل تغییر نیست" />}
            </label>
            <RecordPickerField
              title="انتخاب تنخواه"
              disabled={hasTransactions}
              displayValue={selectedPettyCash ? `${toFaDigits(selectedPettyCash.detailCode)} — ${selectedPettyCash.title}` : ""}
              rows={pettyCashes.filter((p) => p.isActive || String(p.id) === form.pettyCashId)}
              columns={[
                { header: "کد", render: (p) => toFaDigits(p.detailCode), filterValue: (p) => p.detailCode, width: "90px" },
                { header: "عنوان", render: (p) => p.title, filterValue: (p) => p.title },
                { header: "ارز", render: (p) => p.currency?.title, filterValue: (p) => p.currency?.title || "", width: "110px" },
              ]}
              onSelect={(p) => setForm({ ...form, pettyCashId: String(p.id) })}
            />
          </div>
          <div className="form-field">
            <label>طرف‌حساب<RequiredMark /></label>
            <RecordPickerField
              title="انتخاب طرف‌حساب"
              disabled={hasTransactions}
              displayValue={selectedParty ? `${toFaDigits(selectedParty.detailCode)} — ${partyDisplayName(selectedParty)}` : ""}
              rows={parties.filter((p) => p.isActive || String(p.id) === form.partyId)}
              columns={[
                { header: "کد", render: (p) => toFaDigits(p.detailCode), filterValue: (p) => p.detailCode, width: "90px" },
                { header: "نام", render: (p) => partyDisplayName(p), filterValue: (p) => partyDisplayName(p) },
              ]}
              onSelect={(p) => setForm({ ...form, partyId: String(p.id) })}
            />
          </div>
          <div className="form-field">
            <label className="checkbox-row">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
              فعال
              <FieldHint label="فعال" text="تنخواه‌دار فعال در اسناد قابل استفاده است" />
            </label>
          </div>
          <div className="form-field">
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={form.controlNegativeBalance}
                onChange={(e) => setForm({ ...form, controlNegativeBalance: e.target.checked })}
              />
              کنترل مانده منفی
              <FieldHint label="کنترل مانده منفی" text="اگر فعال باشد، سیستم مانع منفی‌شدن مانده‌ی تنخواه می‌شود" />
            </label>
          </div>
        </div>
      </form>
    </FormPage>
  );
}
