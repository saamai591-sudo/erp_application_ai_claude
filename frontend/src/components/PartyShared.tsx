import { FormEvent, useEffect, useState } from "react";
import { ErrorToast } from "./ErrorToast";
import { showError } from "../lib/toast";
import { useLocation, useNavigate } from "react-router-dom";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "./NewRecordButton";
import { ExcelImportButton } from "../components/ExcelImport";
import { api, ApiError } from "../lib/api";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { InfoHint } from "./InfoHint";
import { RecordPickerField } from "./RecordPicker";
import { toFaDigits } from "../lib/formatAmount";

export interface Party {
  id: number;
  detailCode: string;
  category: "INDIVIDUAL" | "LEGAL";
  nationality: "LOCAL" | "FOREIGN";
  firstName: string | null;
  lastName: string | null;
  name: string | null;
  legalType: "LEGAL" | "SPECIAL_PARTNERSHIP" | "BANK" | null;
  nationalId: string | null;
  economicCode: string | null;
  hasTransactions: boolean;
  isActive: boolean;
}

interface PartyAddress {
  id: number;
  type: string;
  cityId: number;
  address: string | null;
  postalCode: string | null;
  isPrimary: boolean;
  city?: { title: string };
}
interface PartyPhone {
  id: number;
  type: string;
  number: string;
  isPrimary: boolean;
}
interface PartyBankAccount {
  id: number;
  bankPartyId: number | null;
  accountNumber: string | null;
  iban: string | null;
  cardNumber: string | null;
}
interface PartyFull extends Party {
  addresses: PartyAddress[];
  phones: PartyPhone[];
  bankAccounts: PartyBankAccount[];
}

const LEGAL_TYPE_FA: Record<string, string> = { LEGAL: "حقوقی", SPECIAL_PARTNERSHIP: "مشارکت خاص", BANK: "بانک/موسسه مالی" };
const ADDRESS_TYPE_FA: Record<string, string> = { HEAD_OFFICE: "دفتر مرکزی", FACTORY: "کارخانه", WAREHOUSE: "انبار", HOME: "منزل" };
const PHONE_TYPE_FA: Record<string, string> = { MOBILE: "موبایل", HEAD_OFFICE: "دفتر مرکزی", FACTORY: "کارخانه", WAREHOUSE: "انبار", HOME: "منزل" };

export function PartyList({ category, title, description }: { category: "INDIVIDUAL" | "LEGAL"; title: string; description: string }) {
  const cacheKey = `/parties?category=${category}`;
  const [items, setItems] = usePersistedState<Party[]>(cacheKey, []);
  const [loading, setLoading] = useState(!hasPersistedState(cacheKey));
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const basePath = category === "INDIVIDUAL" ? "/parties/individual" : "/parties/legal";

  async function reload() {
    setLoading(true);
    try {
      setItems(await api.get(`/parties?category=${category}`));
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  async function onDelete(row: Party) {
    try {
      await api.del(`/parties/${row.id}`);
      await reload();
    } catch (e: any) {
      showError(e.message);
    }
  }

  const LEGAL_TYPE_FA_REVERSE: Record<string, string> = Object.fromEntries(Object.entries(LEGAL_TYPE_FA).map(([k, v]) => [v, k]));

  const importColumns =
    category === "INDIVIDUAL"
      ? [
          { key: "firstName", label: "نام", required: true },
          { key: "lastName", label: "نام خانوادگی", required: true },
          { key: "nationality", label: "تابعیت", hint: "محلی / خارجی" },
          { key: "nationalId", label: "کد ملی" },
          { key: "detailCode", label: "کد تفصیل", hint: "اختیاری — اگر خالی بگذارید خودکار صادر می‌شود" },
        ]
      : [
          { key: "name", label: "نام", required: true },
          { key: "legalType", label: "نوع", required: true, hint: Object.values(LEGAL_TYPE_FA).join(" / ") },
          { key: "nationality", label: "تابعیت", hint: "محلی / خارجی" },
          { key: "nationalId", label: "شناسه ملی" },
          { key: "economicCode", label: "کد اقتصادی" },
          { key: "detailCode", label: "کد تفصیل", hint: "اختیاری — اگر خالی بگذارید خودکار صادر می‌شود" },
        ];

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}><InfoHint text={description} title={title} /><NewRecordButton path={`${basePath}/new`} />
          <ExcelImportButton
            entityLabel={title}
            templateFilename={`قالب-${title}`}
            columns={importColumns}
            backendEntityType="party"
            extraFields={{ category }}
            allowDuplicateOption
            onDone={reload}
          />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      {!loading && (
        <DataTable
          columns={[
            { header: "کد", render: (r) => r.detailCode, width: "100px", filterType: "string", filterValue: (r) => r.detailCode },
            ...(category === "LEGAL"
              ? [{ header: "نوع", render: (r: Party) => LEGAL_TYPE_FA[r.legalType || "LEGAL"], filterType: "string" as const, filterValue: (r: Party) => LEGAL_TYPE_FA[r.legalType || "LEGAL"] }]
              : []),
            { header: "نام", render: (r) => (category === "INDIVIDUAL" ? `${r.firstName} ${r.lastName}` : r.name), filterType: "string", filterValue: (r) => (category === "INDIVIDUAL" ? `${r.firstName} ${r.lastName}` : r.name) },
            { header: "تابعیت", render: (r) => (r.nationality === "LOCAL" ? "محلی" : "خارجی"), filterType: "string", filterValue: (r) => (r.nationality === "LOCAL" ? "محلی" : "خارجی") },
            { header: "کد ملی / اقتصادی", render: (r) => r.nationalId || r.economicCode || "—", filterType: "string", filterValue: (r) => r.nationalId || r.economicCode || "" },
          ]}
          rows={items}
          edit={{ path: (r) => `${basePath}/${r.id}/edit` }}
          onDelete={onDelete}
        />
      )}
    </div>
  );
}

type TabKey = "main" | "address" | "phone" | "bank";

export function PartyForm({
  category,
  title,
  backPath,
  editId,
}: {
  category: "INDIVIDUAL" | "LEGAL";
  title: string;
  backPath: string;
  editId?: number;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}`;
  const [currentId, setCurrentId] = useState<number | undefined>(editId);
  const [tab, setTab] = useState<TabKey>("main");
  const [form, setForm] = usePersistedState<any>(`${cacheKey}:form`, { nationality: "LOCAL", legalType: "LEGAL", isActive: true });
  const [detail, setDetail] = usePersistedState<PartyFull | null>(`${cacheKey}:detail`, null);
  const [formError, setFormError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const { flash } = useSavedFlash();
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(`${cacheKey}:form`));

  async function reloadDetail(id: number) {
    const p: PartyFull = await api.get(`/parties/${id}`);
    setDetail(p);
    setForm({
      nationality: p.nationality,
      legalType: p.legalType || "LEGAL",
      firstName: p.firstName,
      lastName: p.lastName,
      name: p.name,
      nationalId: p.nationalId,
      economicCode: p.economicCode,
      isActive: p.isActive ?? true,
    });
  }

  useEffect(() => {
    if (!editId || hasPersistedState(`${cacheKey}:form`)) return;
    reloadDetail(editId).then(() => setLoaded(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  async function submit(confirmDuplicate = false) {
    setFormError(null);
    try {
      if (currentId) {
        await api.put(`/parties/${currentId}`, { ...form, category });
        flash();
      } else {
        const created = await api.post("/parties", { ...form, category, confirmDuplicate });
        setCurrentId(created.id);
        await reloadDetail(created.id);
        // به‌جای بازگشت به فهرست، در همین فرم می‌مانیم تا کاربر بتواند نشانی/تلفن/حساب بانکی اضافه کند
        navigate(`${backPath}/${created.id}/edit`);
      }
    } catch (e) {
      const err = e as ApiError;
      if (err.warning) setWarning(err.message);
      else setFormError(err.message);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await submit(false);
  }

  async function handleDelete() {
    if (!currentId) return;
    try {
      await api.del(`/parties/${currentId}`);
      navigate(backPath);
    } catch (err) {
      showError((err as ApiError).message);
    }
  }

  if (!loaded) return null;

  return (
    <FormPage
      title={title}
      formId="party-main-form"
      closePath={backPath}
      newPath={`${backPath}/new`}
      onDelete={currentId ? handleDelete : undefined}
    >
      <div className="party-tabs">
        <button type="button" className={`party-tab ${tab === "main" ? "active" : ""}`} onClick={() => setTab("main")}>
          اطلاعات اصلی
        </button>
        <button
          type="button"
          className={`party-tab ${tab === "address" ? "active" : ""}`}
          disabled={!currentId}
          title={!currentId ? "ابتدا اطلاعات اصلی را ذخیره کنید" : ""}
          onClick={() => setTab("address")}
        >
          نشانی
        </button>
        <button
          type="button"
          className={`party-tab ${tab === "phone" ? "active" : ""}`}
          disabled={!currentId}
          title={!currentId ? "ابتدا اطلاعات اصلی را ذخیره کنید" : ""}
          onClick={() => setTab("phone")}
        >
          تلفن
        </button>
        <button
          type="button"
          className={`party-tab ${tab === "bank" ? "active" : ""}`}
          disabled={!currentId}
          title={!currentId ? "ابتدا اطلاعات اصلی را ذخیره کنید" : ""}
          onClick={() => setTab("bank")}
        >
          حساب بانکی
        </button>
      </div>

      {tab === "main" && (
        <form id="party-main-form" onSubmit={onSubmit}>
          <ErrorToast message={formError} />
          {warning && (
            <div className="alert warn">
              {warning}
              <div style={{ marginTop: 8 }}>
                <button type="button" className="btn" style={{ padding: "5px 12px", fontSize: 12 }} onClick={() => submit(true)}>
                  بله، ادامه بده
                </button>
              </div>
            </div>
          )}

          <div className="form-grid" style={{ marginBottom: 14 }}>
            <div className="form-field">
              <label>تابعیت</label>
              <select value={form.nationality} onChange={(e) => setForm({ ...form, nationality: e.target.value })}>
                <option value="LOCAL">محلی</option>
                <option value="FOREIGN">خارجی</option>
              </select>
            </div>
            {category === "LEGAL" && (
              <div className="form-field">
                <label>نوع</label>
                <select value={form.legalType} onChange={(e) => setForm({ ...form, legalType: e.target.value })}>
                  <option value="LEGAL">حقوقی</option>
                  <option value="SPECIAL_PARTNERSHIP">مشارکت خاص</option>
                  <option value="BANK">بانک/موسسه مالی</option>
                </select>
              </div>
            )}
            <div className="form-field">
              <label className="checkbox-row">
                <input type="checkbox" checked={form.isActive ?? true} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
                فعال
              </label>
            </div>
          </div>

          {category === "INDIVIDUAL" ? (
            <div className="form-grid">
              <div className="form-field">
                <label>نام</label>
                <input value={form.firstName || ""} onChange={(e) => setForm({ ...form, firstName: e.target.value })} autoFocus />
              </div>
              <div className="form-field">
                <label>نام خانوادگی</label>
                <input value={form.lastName || ""} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
              </div>
              {form.nationality === "LOCAL" ? (
                <div className="form-field">
                  <label>کد ملی</label>
                  <input dir="ltr" value={form.nationalId || ""} onChange={(e) => setForm({ ...form, nationalId: e.target.value })} />
                </div>
              ) : (
                <div className="form-field">
                  <label>کد فراگیر اتباع خارجی</label>
                  <input dir="ltr" value={form.foreignId || ""} onChange={(e) => setForm({ ...form, foreignId: e.target.value })} />
                </div>
              )}
              <div className="form-field">
                <label>کد اقتصادی</label>
                <input dir="ltr" value={form.economicCode || ""} onChange={(e) => setForm({ ...form, economicCode: e.target.value })} />
              </div>
            </div>
          ) : (
            <div className="form-grid">
              <div className="form-field">
                <label>نام</label>
                <input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
              </div>
              <div className={`form-field ${form.nationality === "LOCAL" ? "" : "form-field-hidden"}`}>
                <label>شناسه ملی</label>
                <input dir="ltr" value={form.nationalId || ""} onChange={(e) => setForm({ ...form, nationalId: e.target.value })} />
              </div>
              <div className="form-field">
                <label>کد اقتصادی</label>
                <input dir="ltr" value={form.economicCode || ""} onChange={(e) => setForm({ ...form, economicCode: e.target.value })} />
              </div>
            </div>
          )}

          {!currentId && (
            <p style={{ fontSize: 11.5, color: "var(--ink-soft)", marginTop: 10 }}>
              پس از ذخیره‌ی این اطلاعات، تب‌های نشانی، تلفن و حساب بانکی فعال می‌شوند.
            </p>
          )}
        </form>
      )}

      {tab === "address" && currentId && detail && (
        <AddressTab partyId={currentId} addresses={detail.addresses} onChanged={() => reloadDetail(currentId)} />
      )}
      {tab === "phone" && currentId && detail && (
        <PhoneTab partyId={currentId} phones={detail.phones} onChanged={() => reloadDetail(currentId)} />
      )}
      {tab === "bank" && currentId && detail && (
        <BankTab partyId={currentId} bankAccounts={detail.bankAccounts} onChanged={() => reloadDetail(currentId)} />
      )}
    </FormPage>
  );
}

function AddressTab({ partyId, addresses, onChanged }: { partyId: number; addresses: PartyAddress[]; onChanged: () => void }) {
  const [cities, setCities] = useState<{ id: number; title: string }[]>([]);
  const emptyForm = { type: "HEAD_OFFICE", cityId: "", address: "", postalCode: "", isPrimary: false };
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get("/geo-regions").then((all: any[]) => setCities(all.filter((r) => r.level === "CITY")));
  }, []);

  function startEdit(a: PartyAddress) {
    setEditingId(a.id);
    setForm({ type: a.type, cityId: String(a.cityId), address: a.address || "", postalCode: a.postalCode || "", isPrimary: a.isPrimary });
  }
  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
  }

  async function onDelete(id: number) {
    if (!window.confirm("این نشانی حذف شود؟")) return;
    try {
      await api.del(`/parties/${partyId}/addresses/${id}`);
      onChanged();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.cityId) {
      setError("انتخاب شهر الزامی است");
      return;
    }
    try {
      if (editingId) {
        await api.put(`/parties/${partyId}/addresses/${editingId}`, { ...form, cityId: Number(form.cityId) });
      } else {
        await api.post(`/parties/${partyId}/addresses`, { ...form, cityId: Number(form.cityId) });
      }
      cancelEdit();
      onChanged();
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  return (
    <div>
      {addresses.length > 0 && (
        <div className="sub-list">
          {addresses.map((a) => (
            <div key={a.id} className="sub-list-item">
              <span className="badge">{ADDRESS_TYPE_FA[a.type]}</span>
              <span>{a.city?.title}</span>
              <span style={{ color: "var(--ink-soft)" }}>{a.address}</span>
              {a.isPrimary && <span className="badge">اصلی</span>}
              <span style={{ flex: 1 }} />
              <button type="button" className="btn secondary" style={{ padding: "4px 10px", fontSize: 11.5 }} onClick={() => startEdit(a)}>ویرایش</button>
              <button type="button" className="btn danger" style={{ padding: "4px 10px", fontSize: 11.5 }} onClick={() => onDelete(a.id)}>حذف</button>
            </div>
          ))}
        </div>
      )}
      <form onSubmit={submit} className="sub-form">
        <ErrorToast message={error} />
        <div className="form-grid">
          <div className="form-field">
            <label>نوع نشانی</label>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {Object.entries(ADDRESS_TYPE_FA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label>شهر</label>
            <select value={form.cityId} onChange={(e) => setForm({ ...form, cityId: e.target.value })}>
              <option value="">انتخاب کنید</option>
              {cities.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </div>
          <div className="form-field full">
            <label>نشانی</label>
            <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div className="form-field">
            <label>کد پستی</label>
            <input dir="ltr" value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} />
          </div>
          <div className="form-field">
            <label className="checkbox-row">
              <input type="checkbox" checked={form.isPrimary} onChange={(e) => setForm({ ...form, isPrimary: e.target.checked })} />
              نشانی اصلی
            </label>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button className="btn" type="submit">{editingId ? "ذخیره تغییرات" : "افزودن نشانی"}</button>
          {editingId && <button className="btn secondary" type="button" onClick={cancelEdit}>انصراف از ویرایش</button>}
        </div>
      </form>
    </div>
  );
}

function PhoneTab({ partyId, phones, onChanged }: { partyId: number; phones: PartyPhone[]; onChanged: () => void }) {
  const emptyForm = { type: "MOBILE", number: "", isPrimary: false };
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  function startEdit(p: PartyPhone) {
    setEditingId(p.id);
    setForm({ type: p.type, number: p.number, isPrimary: p.isPrimary });
  }
  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
  }

  async function onDelete(id: number) {
    if (!window.confirm("این تلفن حذف شود؟")) return;
    try {
      await api.del(`/parties/${partyId}/phones/${id}`);
      onChanged();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.number) {
      setError("شماره تلفن الزامی است");
      return;
    }
    try {
      if (editingId) {
        await api.put(`/parties/${partyId}/phones/${editingId}`, form);
      } else {
        await api.post(`/parties/${partyId}/phones`, form);
      }
      cancelEdit();
      onChanged();
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  return (
    <div>
      {phones.length > 0 && (
        <div className="sub-list">
          {phones.map((p) => (
            <div key={p.id} className="sub-list-item">
              <span className="badge">{PHONE_TYPE_FA[p.type]}</span>
              <span dir="ltr">{p.number}</span>
              {p.isPrimary && <span className="badge">اصلی</span>}
              <span style={{ flex: 1 }} />
              <button type="button" className="btn secondary" style={{ padding: "4px 10px", fontSize: 11.5 }} onClick={() => startEdit(p)}>ویرایش</button>
              <button type="button" className="btn danger" style={{ padding: "4px 10px", fontSize: 11.5 }} onClick={() => onDelete(p.id)}>حذف</button>
            </div>
          ))}
        </div>
      )}
      <form onSubmit={submit} className="sub-form">
        <ErrorToast message={error} />
        <div className="form-grid">
          <div className="form-field">
            <label>نوع تلفن</label>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {Object.entries(PHONE_TYPE_FA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label>شماره تلفن</label>
            <input dir="ltr" value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} />
          </div>
          <div className="form-field">
            <label className="checkbox-row">
              <input type="checkbox" checked={form.isPrimary} onChange={(e) => setForm({ ...form, isPrimary: e.target.checked })} />
              تلفن اصلی
            </label>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button className="btn" type="submit">{editingId ? "ذخیره تغییرات" : "افزودن تلفن"}</button>
          {editingId && <button className="btn secondary" type="button" onClick={cancelEdit}>انصراف از ویرایش</button>}
        </div>
      </form>
    </div>
  );
}

function BankTab({ partyId, bankAccounts, onChanged }: { partyId: number; bankAccounts: PartyBankAccount[]; onChanged: () => void }) {
  const [banks, setBanks] = useState<{ id: number; detailCode: string; name: string }[]>([]);
  const emptyForm = { bankPartyId: "", accountNumber: "", iban: "", cardNumber: "" };
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get("/parties?category=LEGAL").then((p: any[]) => setBanks(p.filter((x) => x.legalType === "BANK")));
  }, []);

  function startEdit(b: PartyBankAccount) {
    setEditingId(b.id);
    setForm({
      bankPartyId: b.bankPartyId ? String(b.bankPartyId) : "",
      accountNumber: b.accountNumber || "",
      iban: b.iban || "",
      cardNumber: b.cardNumber || "",
    });
  }
  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
  }

  async function onDelete(id: number) {
    if (!window.confirm("این حساب بانکی حذف شود؟")) return;
    try {
      await api.del(`/parties/${partyId}/bank-accounts/${id}`);
      onChanged();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const body = { ...form, bankPartyId: form.bankPartyId ? Number(form.bankPartyId) : undefined };
      if (editingId) {
        await api.put(`/parties/${partyId}/bank-accounts/${editingId}`, body);
      } else {
        await api.post(`/parties/${partyId}/bank-accounts`, body);
      }
      cancelEdit();
      onChanged();
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  return (
    <div>
      {bankAccounts.length > 0 && (
        <div className="sub-list">
          {bankAccounts.map((b) => (
            <div key={b.id} className="sub-list-item">
              <span>{banks.find((x) => x.id === b.bankPartyId)?.name || "—"}</span>
              <span dir="ltr">{b.accountNumber}</span>
              {b.iban && <span dir="ltr" style={{ color: "var(--ink-soft)" }}>IBAN: {b.iban}</span>}
              <span style={{ flex: 1 }} />
              <button type="button" className="btn secondary" style={{ padding: "4px 10px", fontSize: 11.5 }} onClick={() => startEdit(b)}>ویرایش</button>
              <button type="button" className="btn danger" style={{ padding: "4px 10px", fontSize: 11.5 }} onClick={() => onDelete(b.id)}>حذف</button>
            </div>
          ))}
        </div>
      )}
      <form onSubmit={submit} className="sub-form">
        <ErrorToast message={error} />
        <div className="form-grid">
          <div className="form-field">
            <label>بانک</label>
            <RecordPickerField
              title="انتخاب بانک"
              displayValue={(() => {
                const b = banks.find((x) => String(x.id) === form.bankPartyId);
                return b ? `${toFaDigits(b.detailCode)} — ${b.name}` : "";
              })()}
              rows={banks}
              columns={[
                { header: "کد", render: (b) => toFaDigits(b.detailCode), filterValue: (b) => b.detailCode, width: "90px" },
                { header: "نام", render: (b) => b.name, filterValue: (b) => b.name },
              ]}
              onSelect={(b) => setForm({ ...form, bankPartyId: String(b.id) })}
              onClear={() => setForm({ ...form, bankPartyId: "" })}
            />
          </div>
          <div className="form-field">
            <label>شماره حساب</label>
            <input dir="ltr" value={form.accountNumber} onChange={(e) => setForm({ ...form, accountNumber: e.target.value })} />
          </div>
          <div className="form-field">
            <label>شبا (IBAN)</label>
            <input dir="ltr" value={form.iban} onChange={(e) => setForm({ ...form, iban: e.target.value })} />
          </div>
          <div className="form-field">
            <label>شماره کارت</label>
            <input dir="ltr" value={form.cardNumber} onChange={(e) => setForm({ ...form, cardNumber: e.target.value })} />
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button className="btn" type="submit">{editingId ? "ذخیره تغییرات" : "افزودن حساب بانکی"}</button>
          {editingId && <button className="btn secondary" type="button" onClick={cancelEdit}>انصراف از ویرایش</button>}
        </div>
      </form>
    </div>
  );
}
