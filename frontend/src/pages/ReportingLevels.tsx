import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { api, ApiError } from "../lib/api";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { InfoHint } from "../components/InfoHint";
import { FieldHint } from "../components/FieldHint";

interface Level { id: number; order: number; title: string; codeLength: number; hasAccounts: boolean }

export default function ReportingLevels() {
  const location = useLocation();
  const { id } = useParams();
  const isNew = location.pathname.endsWith("/new");
  const isEdit = location.pathname.endsWith("/edit");
  if (isNew) return <LevelForm />;
  if (isEdit) return <LevelForm editId={Number(id)} />;
  return <LevelList />;
}

function LevelList() {
  const cacheKey = "/reporting-levels";
  const [items, setItems] = usePersistedState<Level[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  const [bulkSlot, setBulkSlot] = useState<HTMLDivElement | null>(null);
  const navigate = useNavigate();

  async function reload() {
    api.get("/reporting-levels").then(setItems).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onDelete(row: Level) {
    try {
      await api.del(`/reporting-levels/${row.id}`);
      await reload();
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}><InfoHint text={`تعریف سطوح درختی سرفصل حسابها (گروه، کل، معین، جزء) با ترتیب اجباری و طول کد هر سطح`} title="سطح گزارشگری" /><NewRecordButton path="/reporting-levels/new" /><RefreshButton onClick={reload} /><div ref={setBulkSlot} className="bulk-slot" style={{ display: "flex" }} /></div>
      </div>
      {error && <div className="alert error">{error}</div>}
      <DataTable
        bulkActionsContainer={bulkSlot}
        columns={[
          { header: "ترتیب", render: (r) => r.order, width: "70px", filterType: "number", filterValue: (r) => r.order },
          { header: "عنوان", render: (r) => r.title, filterType: "string", filterValue: (r) => r.title },
          { header: "طول کد", render: (r) => r.codeLength, width: "90px", filterType: "number", filterValue: (r) => r.codeLength },
        ]}
        rows={items}
        onEdit={(r) => navigate(`/reporting-levels/${r.id}/edit`)}
        onDelete={onDelete}
      />
    </div>
  );
}

function LevelForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  // codeLength به‌صورت رشته نگه‌داری می‌شود (نه number) — چون input عدد مرورگر یک نکته‌ی شناخته‌شده دارد:
  // وقتی مقدار تایپ‌شده به یک رشته‌ی دیگرِ هم‌ارزِ عددی (مثلاً «۰۲» و «۲») نگاشت می‌شود، مرورگر متن
  // نمایش‌داده‌شده را دوباره از روی prop جدید بازنویسی نمی‌کند (چون valueAsNumber هر دو یکی است)، پس با
  // وجود این‌که state واقعی درست است، فیلد همچنان «۰۲» را نشان می‌دهد. با کنترل کامل رشته (پاک‌سازی
  // کاراکتر به کاراکتر در onChange) از این رفتار مرورگر عبور می‌کنیم.
  const [form, setForm] = usePersistedState(cacheKey, { title: "", codeLength: "1" });
  // آیا این سطح از قبل حساب تعریف‌شده دارد؟ اگر بله، طول کد دیگر قابل ویرایش نیست (کدهای همان
  // حساب‌ها بر اساس طول فعلی ساخته شده‌اند و تغییرش کدهای موجود را نامعتبر می‌کند) — بک‌اند هم همین
  // قاعده را در PUT کنترل می‌کند؛ این فقط برای غیرفعال‌کردن فیلد در فرانت‌اند است.
  const [hasAccounts, setHasAccounts] = usePersistedState(`${cacheKey}:hasAccounts`, false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const { saved, flash } = useSavedFlash();

  useEffect(() => {
    if (!editId || hasPersistedState(cacheKey)) return;
    api.get("/reporting-levels").then((items: Level[]) => {
      const found = items.find((i) => i.id === editId);
      if (found) {
        setForm({ title: found.title, codeLength: String(found.codeLength) });
        setHasAccounts(found.hasAccounts);
      }
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const codeLength = Number(form.codeLength);
    if (!Number.isInteger(codeLength) || codeLength <= 0) {
      setError("طول کد باید عدد صحیح مثبت باشد");
      return;
    }
    try {
      if (editId) {
        await api.put(`/reporting-levels/${editId}`, { title: form.title, codeLength });
        flash();
      } else {
        const created = await api.post("/reporting-levels", { title: form.title, codeLength });
        flash();
        navigate(`/reporting-levels/${created.id}/edit`);
      }
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/reporting-levels/${editId}`);
      navigate("/reporting-levels");
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  if (!loaded) return null;

  return (
    <FormPage
      title={editId ? "ویرایش سطح گزارشگری" : "سطح گزارشگری جدید"}
      description="سطح جدید همیشه به‌عنوان آخرین (پایین‌ترین) سطح درخت اضافه می‌شود"
      formId="level-form"
      closePath="/reporting-levels"
      newPath="/reporting-levels/new"
      onDelete={editId ? handleDelete : undefined}
    >
      <form id="level-form" onSubmit={onSubmit}>
        {error && <div className="alert error">{error}</div>}
        {saved && <div className="alert warn">تغییرات ذخیره شد</div>}
        <div className="form-grid">
          <div className="form-field">
            <label>عنوان</label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus />
          </div>
          <div className="form-field">
            <label>
              طول کد
              {hasAccounts && <FieldHint text="این سطح حساب تعریف‌شده دارد؛ چون کد آن حساب‌ها بر اساس همین طول ساخته شده، طول کد دیگر قابل تغییر نیست." />}
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={form.codeLength}
              disabled={hasAccounts}
              onChange={(e) => {
                const digitsOnly = e.target.value.replace(/[^\d]/g, "");
                const normalized = digitsOnly.replace(/^0+(?=\d)/, "");
                setForm({ ...form, codeLength: normalized });
              }}
            />
          </div>
        </div>
      </form>
    </FormPage>
  );
}
