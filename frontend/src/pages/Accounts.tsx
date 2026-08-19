import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { TreeView, TreeNode } from "../components/TreeView";
import { FormPage } from "../components/FormPage";
import { api, ApiError } from "../lib/api";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState, clearPersistedStateByPrefix } from "../lib/usePersistedState";
import { RefreshButton } from "../components/RefreshButton";
import { ExcelImportButton } from "../components/ExcelImport";
import { InfoHint } from "../components/InfoHint";

interface Level { id: number; order: number; title: string; codeLength: number }
interface DetailType { id: number; title: string }
interface AccountRow {
  id: number;
  parentId: number | null;
  levelId: number;
  code: string;
  title: string;
  level: Level;
  natureGroup: string | null;
  natureDetail: string | null;
  balanceNature: string | null;
  isCurrency: boolean;
  isRevaluable: boolean;
  detailType1Id: number | null;
  detailType2Id: number | null;
  detailType3Id: number | null;
}

const NATURE_GROUP_FA: Record<string, string> = { BALANCE_SHEET: "ترازنامه‌ای", PROFIT_LOSS: "سود و زیانی", MEMORANDUM: "انتظامی" };
const NATURE_DETAIL_FA: Record<string, string> = { ASSET: "دارایی", LIABILITY: "بدهی", REVENUE: "درآمد", EXPENSE: "هزینه", MEMORANDUM: "انتظامی" };
const BALANCE_NATURE_FA: Record<string, string> = { DEBIT: "بدهکار", CREDIT: "بستانکار" };

export default function Accounts() {
  const location = useLocation();
  const { id } = useParams();
  const isNew = location.pathname.endsWith("/new");
  const isEdit = location.pathname.endsWith("/edit");
  const parentId = new URLSearchParams(location.search).get("parentId");
  if (isNew) return <AccountForm parentId={parentId ? Number(parentId) : undefined} />;
  if (isEdit) return <AccountForm editId={Number(id)} />;
  return <AccountsTree />;
}

function AccountsTree() {
  const cacheKey = "/accounts";
  const [accounts, setAccounts] = usePersistedState<AccountRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function reload() {
    api.get("/accounts").then(setAccounts).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onDelete(node: TreeNode) {
    try {
      await api.del(`/accounts/${node.id}`);
      await reload();
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  function treeFullCode(a: AccountRow): string {
    let code = a.code;
    let cur = a;
    while (cur.parentId) {
      const parent = accounts.find((x) => x.id === cur.parentId);
      if (!parent) break;
      code = parent.code + code;
      cur = parent;
    }
    return code;
  }
  const nodes: TreeNode[] = accounts.map((a) => ({ id: a.id, parentId: a.parentId, code: treeFullCode(a), title: a.title, level: a.level.title }));

  const NATURE_GROUP_FA_REVERSE: Record<string, string> = Object.fromEntries(Object.entries(NATURE_GROUP_FA).map(([k, v]) => [v, k]));
  const NATURE_DETAIL_FA_REVERSE: Record<string, string> = Object.fromEntries(Object.entries(NATURE_DETAIL_FA).map(([k, v]) => [v, k]));
  const BALANCE_NATURE_FA_REVERSE: Record<string, string> = Object.fromEntries(Object.entries(BALANCE_NATURE_FA).map(([k, v]) => [v, k]));

  function fullCodeOf(a: { id: number; code: string; parentId: number | null }, pool: { id: number; code: string; parentId: number | null }[]): string {
    let code = a.code;
    let cur = a;
    while (cur.parentId) {
      const parent = pool.find((x) => x.id === cur.parentId);
      if (!parent) break;
      code = parent.code + code;
      cur = parent;
    }
    return code;
  }

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}><InfoHint text={`درخت سرفصل حسابها بر اساس سطوح گزارشگری تعریف‌شده`} title="تعریف حسابها" />
          <ExcelImportButton
            entityLabel="حسابها"
            templateFilename="قالب-تعریف-حسابها"
            backendEntityType="account"
            columns={[
              { key: "parentFullCode", label: "کد کامل والد", hint: "برای سرفصل سطح گروه خالی بگذارید" },
              { key: "code", label: "کد", required: true, hint: "فقط بخش مربوط به همین سطح، نه کد کامل" },
              { key: "title", label: "عنوان", required: true },
              { key: "natureGroup", label: "ماهیت گروه", hint: Object.values(NATURE_GROUP_FA).join(" / ") },
              { key: "natureDetail", label: "ماهیت تفصیلی", hint: Object.values(NATURE_DETAIL_FA).join(" / ") },
              { key: "balanceNature", label: "ماهیت مانده", hint: Object.values(BALANCE_NATURE_FA).join(" / ") },
              { key: "isCurrency", label: "ارزی", hint: "بله / خیر" },
              { key: "isRevaluable", label: "تجدید ارزیابی", hint: "بله / خیر" },
              { key: "detailType1", label: "نوع تفصیل سطح ۱", hint: "کد دقیق یک «نوع تفصیل» موجود؛ اختیاری" },
              { key: "detailType2", label: "نوع تفصیل سطح ۲", hint: "اختیاری" },
              { key: "detailType3", label: "نوع تفصیل سطح ۳", hint: "اختیاری" },
            ]}
            onDone={reload}
          />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      {error && <div className="alert error">{error}</div>}
      <TreeView
        nodes={nodes}
        onAddRoot={() => { clearPersistedStateByPrefix("form:/accounts/new"); navigate("/accounts/new"); }}
        onAddChild={(n) => {
          clearPersistedStateByPrefix(`form:/accounts/new?parentId=${n.id}`);
          navigate(`/accounts/new?parentId=${n.id}`);
        }}
        onEdit={(n) => navigate(`/accounts/${n.id}/edit`)}
        onDelete={onDelete}
        levelLabel={(n) => n.level || ""}
      />
    </div>
  );
}

function AccountForm({ editId, parentId }: { editId?: number; parentId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}${location.search}`;
  const [levels, setLevels] = useState<Level[]>([]);
  const [detailTypes, setDetailTypes] = useState<DetailType[]>([]);
  const [parentAccount, setParentAccount] = usePersistedState<AccountRow | null>(`${cacheKey}:parentAccount`, null);
  const [currentLevel, setCurrentLevel] = usePersistedState<Level | null>(`${cacheKey}:currentLevel`, null);
  const [form, setForm] = usePersistedState<any>(`${cacheKey}:form`, {
    code: "",
    title: "",
    natureGroup: "BALANCE_SHEET",
    natureDetail: "ASSET",
    balanceNature: "DEBIT",
    isCurrency: false,
    isRevaluable: false,
    detailType1Id: "",
    detailType2Id: "",
    detailType3Id: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(hasPersistedState(`${cacheKey}:form`));
  const { saved, flash } = useSavedFlash();

  useEffect(() => {
    async function init() {
      const [lvls, dts, accs]: [Level[], DetailType[], AccountRow[]] = await Promise.all([
        api.get("/reporting-levels"),
        api.get("/detail-types"),
        api.get("/accounts"),
      ]);
      setLevels(lvls);
      setDetailTypes(dts);

      // اگر ورودی‌های فرم قبلاً (از سوییچ تب) بازیابی شده‌اند، دیگر بازنویسی‌شان نکن
      if (hasPersistedState(`${cacheKey}:form`)) {
        setLoaded(true);
        return;
      }

      if (editId) {
        const found = accs.find((a) => a.id === editId);
        if (found) {
          setCurrentLevel(found.level);
          setForm({
            code: found.code,
            title: found.title,
            natureGroup: found.natureGroup || "BALANCE_SHEET",
            natureDetail: found.natureDetail || "ASSET",
            balanceNature: found.balanceNature || "DEBIT",
            isCurrency: found.isCurrency,
            isRevaluable: found.isRevaluable,
            detailType1Id: found.detailType1Id ? String(found.detailType1Id) : "",
            detailType2Id: found.detailType2Id ? String(found.detailType2Id) : "",
            detailType3Id: found.detailType3Id ? String(found.detailType3Id) : "",
          });
        }
      } else if (parentId) {
        const parent = accs.find((a) => a.id === parentId);
        if (parent) {
          setParentAccount(parent);
          const nextLevel = lvls.find((l) => l.order === parent.level.order + 1);
          setCurrentLevel(nextLevel || null);
        }
      } else {
        const rootLevel = lvls.find((l) => l.order === 1);
        setCurrentLevel(rootLevel || null);
      }
      setLoaded(true);
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId, parentId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const body = {
      ...form,
      detailType1Id: form.detailType1Id ? Number(form.detailType1Id) : null,
      detailType2Id: form.detailType2Id ? Number(form.detailType2Id) : null,
      detailType3Id: form.detailType3Id ? Number(form.detailType3Id) : null,
    };
    try {
      if (editId) {
        await api.put(`/accounts/${editId}`, body);
        flash();
      } else {
        const created = await api.post("/accounts", { ...body, parentId: parentId ?? null });
        flash();
        navigate(`/accounts/${created.id}/edit`);
      }
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/accounts/${editId}`);
      navigate("/accounts");
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  if (!loaded) return null;

  if (!currentLevel) {
    return (
      <FormPage title="سرفصل جدید" closePath="/accounts">
        <div className="alert error">
          سطح گزارشگری بعدی تعریف نشده است. ابتدا از فرم «سطح گزارشگری» یک سطح جدید اضافه کنید.
        </div>
      </FormPage>
    );
  }

  return (
    <FormPage
      title={editId ? `ویرایش حساب (${currentLevel.title})` : `سرفصل جدید — سطح ${currentLevel.title}${parentAccount ? ` (زیرمجموعه‌ی «${parentAccount.title}»)` : ""}`}
      formId="account-form"
      closePath="/accounts"
      onDelete={editId ? handleDelete : undefined}
    >
      <form id="account-form" onSubmit={onSubmit}>
        {error && <div className="alert error">{error}</div>}
        {saved && <div className="alert warn">تغییرات ذخیره شد</div>}
        <div className="form-grid">
          <div className="form-field">
            <label>کد (طول {currentLevel.codeLength} رقم)</label>
            <input dir="ltr" maxLength={currentLevel.codeLength} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          </div>
          <div className="form-field">
            <label>عنوان</label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus />
          </div>

          {currentLevel.order === 1 && (
            <div className="form-field">
              <label>ماهیت حساب</label>
              <select value={form.natureGroup} onChange={(e) => setForm({ ...form, natureGroup: e.target.value })}>
                {Object.entries(NATURE_GROUP_FA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          )}

          {currentLevel.order === 2 && (
            <div className="form-field">
              <label>ماهیت حساب</label>
              <select value={form.natureDetail} onChange={(e) => setForm({ ...form, natureDetail: e.target.value })}>
                {Object.entries(NATURE_DETAIL_FA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          )}

          {currentLevel.order >= 3 && (
            <>
              <div className="form-field">
                <label>ماهیت مانده</label>
                <select value={form.balanceNature} onChange={(e) => setForm({ ...form, balanceNature: e.target.value })}>
                  {Object.entries(BALANCE_NATURE_FA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="form-field">
                <label className="checkbox-row">
                  <input type="checkbox" checked={form.isCurrency} onChange={(e) => setForm({ ...form, isCurrency: e.target.checked })} />
                  ارزی
                </label>
              </div>
              <div className="form-field">
                <label className="checkbox-row">
                  <input type="checkbox" checked={form.isRevaluable} onChange={(e) => setForm({ ...form, isRevaluable: e.target.checked })} />
                  تسعیرپذیر
                </label>
              </div>
              <div className="form-field full">
                <label>تفصیل سطح ۱ (اختیاری)</label>
                <select value={form.detailType1Id} onChange={(e) => setForm({ ...form, detailType1Id: e.target.value })}>
                  <option value="">ندارد</option>
                  {detailTypes.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
                </select>
              </div>
              <div className="form-field full">
                <label>تفصیل سطح ۲ (اختیاری)</label>
                <select value={form.detailType2Id} onChange={(e) => setForm({ ...form, detailType2Id: e.target.value })}>
                  <option value="">ندارد</option>
                  {detailTypes.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
                </select>
              </div>
              <div className="form-field full">
                <label>تفصیل سطح ۳ (اختیاری)</label>
                <select value={form.detailType3Id} onChange={(e) => setForm({ ...form, detailType3Id: e.target.value })}>
                  <option value="">ندارد</option>
                  {detailTypes.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
                </select>
              </div>
            </>
          )}
        </div>
      </form>
    </FormPage>
  );
}
