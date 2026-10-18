import { FormEvent, useEffect, useState } from "react";
import { PartySections, PartySectionCard, PartySectionNav, PartyChildren, EMPTY_CHILDREN, PARTY_SECTION_IDS, childrenFromDetail, childrenPayload, validateChildren } from "./PartySections";
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
import { JalaliDatePicker } from "./JalaliDatePicker";

export interface Party {
  id: number;
  detailCode: string;
  /** عنوان تفصیل (یکتا، قابل ویرایش) */
  detailTitle?: string;
  category: "INDIVIDUAL" | "LEGAL";
  nationality: "LOCAL" | "FOREIGN";
  firstName: string | null;
  lastName: string | null;
  name: string | null;
  legalType: "LEGAL" | "SPECIAL_PARTNERSHIP" | "BANK" | null;
  nationalId: string | null;
  economicCode: string | null;
  registrationNumber?: string | null;
  birthDate?: string | null;
  gender?: "MALE" | "FEMALE" | null;
  hasTransactions: boolean;
  isActive: boolean;
}

interface PartyFull extends Party {
  addresses: any[];
  phones: any[];
  contacts?: any[];
  bankAccounts: any[];
}

const LEGAL_TYPE_FA: Record<string, string> = { LEGAL: "حقوقی", SPECIAL_PARTNERSHIP: "مشارکت خاص", BANK: "بانک/موسسه مالی" };

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
            { header: "عنوان تفصیل", render: (r) => r.detailTitle || "—", filterType: "string", filterValue: (r) => r.detailTitle || "" },
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
  const [form, setForm] = usePersistedState<any>(`${cacheKey}:form`, { nationality: "LOCAL", legalType: "LEGAL", isActive: true });
  // نشانی‌ها/تلفن‌ها/حساب‌های بانکی: بخش‌های زیر هم که همراه شخص با یک «ذخیره» ثبت می‌شوند
  const [children, setChildren] = usePersistedState<PartyChildren>(`${cacheKey}:children`, EMPTY_CHILDREN);
  const [formError, setFormError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  // عنوان تفصیل تا وقتی کاربر دستی ویرایشش نکرده (و شخص قبلاً ذخیره نشده) از نام پیشنهاد می‌شود
  const [titleTouched, setTitleTouched] = useState(!!editId);
  const { flash } = useSavedFlash();
  function setNames(patch: Record<string, string>) {
    setForm((f: any) => {
      const next = { ...f, ...patch };
      if (!titleTouched) next.detailTitle = (category === "INDIVIDUAL" ? `${next.firstName || ""} ${next.lastName || ""}` : next.name || "").replace(/\s+/g, " ").trim();
      return next;
    });
  }
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(`${cacheKey}:form`));

  async function reloadDetail(id: number) {
    const p: PartyFull = await api.get(`/parties/${id}`);
    setChildren(childrenFromDetail(p));
    setForm({
      nationality: p.nationality,
      legalType: p.legalType || "LEGAL",
      firstName: p.firstName,
      lastName: p.lastName,
      name: p.name,
      detailTitle: p.detailTitle || "",
      nationalId: p.nationalId,
      foreignId: (p as any).foreignId || "",
      economicCode: p.economicCode,
      registrationNumber: p.registrationNumber,
      birthDate: p.birthDate ? p.birthDate.slice(0, 10) : "",
      gender: p.gender || "",
      isActive: p.isActive ?? true,
    });
  }

  useEffect(() => {
    if (!editId || hasPersistedState(`${cacheKey}:form`)) return;
    reloadDetail(editId).then(() => setLoaded(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  // ذخیره‌ی در جریان: دکمه‌ی ذخیره غیرفعال می‌شود و ذخیره‌ی دوم تا پایان اولی نادیده گرفته می‌شود
  const [saving, setSaving] = useState(false);
  async function submit(confirmDuplicate = false) {
    if (saving) return;
    setFormError(null);
    const childError = validateChildren(children);
    if (childError) return setFormError(childError);
    setSaving(true);
    try {
      const body = { ...form, category, ...childrenPayload(children) };
      if (currentId) {
        await api.put(`/parties/${currentId}`, { ...body, confirmDuplicate });
        await reloadDetail(currentId);
        flash();
      } else {
        const created = await api.post("/parties", { ...body, confirmDuplicate });
        setCurrentId(created.id);
        await reloadDetail(created.id);
        navigate(`${backPath}/${created.id}/edit`);
      }
    } catch (e) {
      const err = e as ApiError;
      if (err.warning) setWarning(err.message);
      else setFormError(err.message);
    } finally {
      setSaving(false);
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
      saveDisabled={saving}
    >
      <PartySectionNav counts={{ address: children.addresses.length, phone: children.phones.length, contact: (children.contacts ?? []).length, bank: children.bankAccounts.length }} />

      <form id="party-main-form" onSubmit={onSubmit}>
        <PartySectionCard id={PARTY_SECTION_IDS.main} title="اطلاعات اصلی">
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
                <input value={form.firstName || ""} onChange={(e) => setNames({ firstName: e.target.value })} autoFocus />
              </div>
              <div className="form-field">
                <label>نام خانوادگی</label>
                <input value={form.lastName || ""} onChange={(e) => setNames({ lastName: e.target.value })} />
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
              <div className="form-field">
                <label>تاریخ تولد</label>
                <JalaliDatePicker value={form.birthDate || ""} onChange={(v) => setForm({ ...form, birthDate: v })} />
              </div>
              <div className="form-field">
                <label>جنسیت</label>
                <select value={form.gender || ""} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                  <option value="">—</option>
                  <option value="MALE">مرد</option>
                  <option value="FEMALE">زن</option>
                </select>
              </div>
            </div>
          ) : (
            <div className="form-grid">
              <div className="form-field">
                <label>نام</label>
                <input value={form.name || ""} onChange={(e) => setNames({ name: e.target.value })} autoFocus />
              </div>
              <div className={`form-field ${form.nationality === "LOCAL" ? "" : "form-field-hidden"}`}>
                <label>شناسه ملی</label>
                <input dir="ltr" value={form.nationalId || ""} onChange={(e) => setForm({ ...form, nationalId: e.target.value })} />
              </div>
              <div className="form-field">
                <label>کد اقتصادی</label>
                <input dir="ltr" value={form.economicCode || ""} onChange={(e) => setForm({ ...form, economicCode: e.target.value })} />
              </div>
              <div className="form-field">
                <label>شماره ثبت</label>
                <input dir="ltr" value={form.registrationNumber || ""} onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })} />
              </div>
            </div>
          )}

          <div className="form-grid" style={{ marginTop: 14 }}>
            <div className="form-field full">
              <label>عنوان تفصیل</label>
              <input
                value={form.detailTitle || ""}
                onChange={(e) => {
                  setTitleTouched(true);
                  setForm({ ...form, detailTitle: e.target.value });
                }}
              />
            </div>
          </div>
          <p style={{ fontSize: 11.5, color: "var(--ink-soft)", marginTop: 6 }}>
            عنوان تفصیل یکتاست و در سند حسابداری و گزارش‌ها نمایش داده می‌شود. دو شخص هم‌نام مجازند ولی عنوان تفصیلشان باید تفکیک شود. کد ملی / شناسه ملی هم تکراری نمی‌تواند باشد.
          </p>

        </PartySectionCard>

        <PartySections value={children} onChange={setChildren} />
      </form>
    </FormPage>
  );
}
