import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { TreeView, TreeNode } from "../components/TreeView";
import { FormPage } from "../components/FormPage";
import { api, ApiError } from "../lib/api";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { RefreshButton } from "../components/RefreshButton";
import { InfoHint } from "../components/InfoHint";
import { toFaDigits } from "../lib/formatAmount";
import { RequiredMark } from "../components/RequiredMark";
import { useTabs } from "../lib/TabsContext";
import { GoodsGroupLevel } from "./GoodsGroupLevels";
import { GoodsAttribute } from "./GoodsAttributes";

const TITLE_EFFECT_FA: Record<string, string> = {
  NONE: "فاقد تاثیر",
  VALUE: "مقدار ویژگی",
  VALUE_AND_TITLE: "مقدار و عنوان ویژگی",
};

interface GroupAttributeLink {
  attributeId: number;
  order: number;
  affectsCode: boolean;
  titleEffect: string;
  attribute: GoodsAttribute;
}

export interface GoodsGroup {
  id: number;
  parentId: number | null;
  levelId: number;
  level: GoodsGroupLevel;
  code: string;
  title: string;
  isLastBranch: boolean;
  affectsGoodsTitle: boolean;
  childCodeLength: number | null;
  isActive: boolean;
  hasTransactions: boolean;
  attributes: GroupAttributeLink[];
}

export default function GoodsGroups() {
  const location = useLocation();
  const { id } = useParams();
  const isNew = location.pathname.endsWith("/new");
  const isEdit = location.pathname.endsWith("/edit");
  const params = new URLSearchParams(location.search);
  const parentId = params.get("parentId");
  if (isNew) return <GroupForm parentId={parentId ? Number(parentId) : undefined} />;
  if (isEdit) return <GroupForm editId={Number(id)} />;
  return <GroupsTree />;
}

function GroupsTree() {
  const cacheKey = "/goods-groups";
  const [groups, setGroups] = usePersistedState<GoodsGroup[]>(cacheKey, []);
  // سطوح تعریف‌شده‌ی گروه کالا (از فرم «سطح گروه کالا») جدا از خودِ گروه‌های ساخته‌شده واکشی می‌شود؛
  // چون امکان درج زیرشاخه باید بر اساس تعداد سطوح *تعریف‌شده* سنجیده شود، نه سطوحی که تا الان
  // حداقل یک گروه در آن‌ها ساخته شده — وگرنه با وجود سطح ۲ تعریف‌شده ولی هنوز بدون هیچ گروهی در آن،
  // درج زیرشاخه برای گروه‌های سطح ۱ به‌اشتباه غیرفعال می‌ماند.
  const [levels, setLevels] = usePersistedState<GoodsGroupLevel[]>(`${cacheKey}:levels`, []);
  const [error, setError] = useState<string | null>(null);
  const { openTab } = useTabs();

  async function reload() {
    Promise.all([api.get("/goods-groups"), api.get("/goods-group-levels")])
      .then(([g, l]) => { setGroups(g); setLevels(l); })
      .catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey) || !hasPersistedState(`${cacheKey}:levels`)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onDelete(node: TreeNode) {
    try {
      await api.del(`/goods-groups/${node.id}`);
      await reload();
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  const maxLevelOrder = levels.length ? Math.max(...levels.map((l) => l.order)) : 0;
  const nodes: TreeNode[] = groups.map((g) => ({ id: g.id, parentId: g.parentId, code: g.code, title: g.title, level: g.level.title }));

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text={`درخت گروه‌بندی کالا بر اساس سطوح گروه کالای تعریف‌شده`} title="گروه کالا" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      {error && <div className="alert error">{error}</div>}
      <TreeView
        nodes={nodes}
        persistKey={cacheKey}
        // چون فرم گروه کالا نسبتاً پیچیده است (شامل تب ویژگیها)، افزودن شاخه‌ی جدید در یک تب مستقل باز می‌شود
        // تا درخت (یا فرم گروهی که کاربر همین الان در حال مرور/ویرایش آن است) دست‌نخورده در تب خودش باقی بماند
        onAddRoot={() => openTab("/goods-groups/new")}
        onAddChild={(n) => openTab(`/goods-groups/new?parentId=${n.id}`)}
        canAddChild={(n) => {
          const g = groups.find((x) => x.id === n.id);
          return !!g && g.level.order < maxLevelOrder;
        }}
        // مثل onAddRoot/onAddChild، ویرایش هم در تب مستقل باز می‌شود؛ وگرنه با navigate() ساده
        // خودِ درخت (که ممکن است کاربر در حال مرور شاخه‌های بازشده‌اش باشد) در همان تب overwrite می‌شد
        onEdit={(n) => openTab(`/goods-groups/${n.id}/edit`)}
        onDelete={onDelete}
        levelLabel={(n) => n.level || ""}
      />
    </div>
  );
}

function GroupForm({ editId, parentId }: { editId?: number; parentId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}${location.search}`;
  const [levels, setLevels] = useState<GoodsGroupLevel[]>([]);
  const [allAttributes, setAllAttributes] = useState<GoodsAttribute[]>([]);
  const [currentLevel, setCurrentLevel] = usePersistedState<GoodsGroupLevel | null>(`${cacheKey}:currentLevel`, null);
  const [effectiveParentId, setEffectiveParentId] = usePersistedState<number | null>(`${cacheKey}:effectiveParentId`, null);
  const [parentGroup, setParentGroup] = usePersistedState<GoodsGroup | null>(`${cacheKey}:parentGroup`, null);
  const [hasTransactions, setHasTransactions] = useState(false);
  const [tab, setTab] = useState<"main" | "attributes">("main");
  const [form, setForm] = usePersistedState(`${cacheKey}:form`, {
    code: "",
    title: "",
    isLastBranch: false,
    affectsGoodsTitle: false,
    childCodeLength: "",
    isActive: true,
  });
  const [attrRows, setAttrRows] = usePersistedState<
    { attributeId: number; title: string; selected: boolean; affectsCode: boolean; titleEffect: string }[]
  >(`${cacheKey}:attrRows`, []);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const { saved, flash } = useSavedFlash();

  useEffect(() => {
    async function init() {
      const [lvls, attrs]: [GoodsGroupLevel[], GoodsAttribute[]] = await Promise.all([
        api.get("/goods-group-levels"),
        api.get("/goods-attributes"),
      ]);
      setLevels(lvls);
      setAllAttributes(attrs);

      if (hasPersistedState(`${cacheKey}:form`)) {
        setLoaded(true);
        return;
      }

      const maxOrder = lvls.length ? Math.max(...lvls.map((l) => l.order)) : 0;

      function buildAttrRows(existing: GroupAttributeLink[]) {
        const existingSorted = [...existing].sort((a, b) => a.order - b.order);
        const usedIds = new Set(existingSorted.map((e) => e.attributeId));
        const rest = attrs.filter((a) => !usedIds.has(a.id));
        return [
          ...existingSorted.map((e) => ({
            attributeId: e.attributeId,
            title: e.attribute?.title || attrs.find((a) => a.id === e.attributeId)?.title || "",
            selected: true,
            affectsCode: e.affectsCode,
            titleEffect: e.titleEffect,
          })),
          ...rest.map((a) => ({ attributeId: a.id, title: a.title, selected: false, affectsCode: true, titleEffect: "NONE" })),
        ];
      }

      if (editId) {
        const found: GoodsGroup | undefined = await api.get(`/goods-groups`).then((all: GoodsGroup[]) => all.find((g) => g.id === editId));
        if (found) {
          setCurrentLevel(found.level);
          setHasTransactions(found.hasTransactions);
          setForm({
            code: found.code,
            title: found.title,
            isLastBranch: found.isLastBranch,
            affectsGoodsTitle: found.affectsGoodsTitle,
            childCodeLength: found.childCodeLength ? String(found.childCodeLength) : "",
            isActive: found.isActive,
          });
          setAttrRows(buildAttrRows(found.attributes || []));
          if (found.parentId) {
            const parent = await api.get(`/goods-groups`).then((all: GoodsGroup[]) => all.find((g: GoodsGroup) => g.id === found.parentId));
            setParentGroup(parent || null);
            setEffectiveParentId(found.parentId);
          }
        }
      } else if (parentId) {
        const groups: GoodsGroup[] = await api.get("/goods-groups");
        const parent = groups.find((g) => g.id === parentId);
        if (parent) {
          setParentGroup(parent);
          setEffectiveParentId(parent.id);
          const nextLevel = lvls.find((l) => l.order === parent.level.order + 1);
          setCurrentLevel(nextLevel || null);
        }
        setAttrRows(buildAttrRows([]));
      } else {
        const rootLevel = lvls.find((l) => l.order === 1);
        setCurrentLevel(rootLevel || null);
        setEffectiveParentId(null);
        setAttrRows(buildAttrRows([]));
      }

      // در صورتی که سطح انتخاب‌شده، بزرگترین ترتیب باشد، «آخرین شاخه هست» به‌صورت اتوماتیک و غیرقابل‌ویرایش «بله» است
      setLoaded(true);
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId, parentId]);

  const maxLevelOrder = levels.length ? Math.max(...levels.map((l) => l.order)) : 0;
  const forcedLastBranch = !!(currentLevel && currentLevel.order === maxLevelOrder);
  const isLastBranch = forcedLastBranch ? true : form.isLastBranch;
  const anySelected = attrRows.some((r) => r.selected);

  function moveAttrRow(idx: number, dir: "up" | "down") {
    setAttrRows((prev) => {
      const next = [...prev];
      const target = dir === "up" ? idx - 1 : idx + 1;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!currentLevel) return;

    const selectedAttrs = attrRows
      .filter((r) => r.selected)
      .map((r, idx) => ({ attributeId: r.attributeId, order: idx, affectsCode: r.affectsCode, titleEffect: r.titleEffect }));

    const body = {
      parentId: effectiveParentId,
      code: form.code,
      title: form.title,
      isLastBranch,
      affectsGoodsTitle: form.affectsGoodsTitle,
      childCodeLength: isLastBranch ? Number(form.childCodeLength) : null,
      isActive: form.isActive,
      attributes: isLastBranch ? selectedAttrs : [],
    };

    try {
      if (editId) {
        await api.put(`/goods-groups/${editId}`, body);
        flash();
      } else {
        const created = await api.post("/goods-groups", body);
        flash();
        navigate(`/goods-groups/${created.id}/edit`);
      }
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/goods-groups/${editId}`);
      navigate("/goods-groups");
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  if (!loaded) return null;

  if (!currentLevel) {
    return (
      <FormPage title="گروه کالای جدید" closePath="/goods-groups">
        <div className="alert error">سطح گروه کالای بعدی تعریف نشده است. ابتدا از فرم «سطح گروه کالا» یک سطح جدید اضافه کنید.</div>
      </FormPage>
    );
  }

  return (
    <FormPage
      title={editId ? `ویرایش گروه کالا (${currentLevel.title})` : `گروه کالای جدید — سطح ${currentLevel.title}${parentGroup ? ` (زیرمجموعه‌ی «${parentGroup.title}»)` : ""}`}
      formId="goods-group-form"
      closePath="/goods-groups"
      onDelete={editId ? handleDelete : undefined}
    >
      <div className="party-tabs">
        <button type="button" className={`party-tab ${tab === "main" ? "active" : ""}`} onClick={() => setTab("main")}>
          اطلاعات اصلی
        </button>
        {isLastBranch && (
          <button type="button" className={`party-tab ${tab === "attributes" ? "active" : ""}`} onClick={() => setTab("attributes")}>
            ویژگی
          </button>
        )}
      </div>

      <form id="goods-group-form" onSubmit={onSubmit}>
        {error && <div className="alert error">{error}</div>}
        {saved && <div className="alert warn">تغییرات ذخیره شد</div>}

        {tab === "main" && (
          <div className="form-grid">
            <div className="form-field">
              <label>سطح</label>
              <input disabled value={currentLevel.title} title="سطح بر اساس جایگاه این گروه در درخت به‌صورت خودکار تعیین می‌شود و قابل تغییر نیست" />
            </div>
            <div className="form-field">
              <label>کد (حداکثر {toFaDigits(String(currentLevel.codeLength))} کاراکتر)<RequiredMark /></label>
              <input dir="ltr" maxLength={currentLevel.codeLength} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            </div>
            <div className="form-field">
              <label>عنوان<RequiredMark /></label>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus />
            </div>
            <div className="form-field">
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={isLastBranch}
                  disabled={forcedLastBranch || anySelected}
                  title={forcedLastBranch ? "این سطح، آخرین سطح گروه کالا است" : anySelected ? "چون ویژگی انتخاب شده، ابتدا انتخاب ویژگیها را بردارید" : ""}
                  onChange={(e) => setForm({ ...form, isLastBranch: e.target.checked })}
                />
                آخرین شاخه هست
              </label>
            </div>
            <div className="form-field">
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={form.affectsGoodsTitle}
                  onChange={(e) => setForm({ ...form, affectsGoodsTitle: e.target.checked })}
                />
                در عنوان کالا موثر هست
              </label>
            </div>
            <div className={`form-field ${isLastBranch ? "" : "form-field-hidden"}`}>
              <label>طول کد کالاهای زیرمجموعه (بین ۱ تا ۱۵)<RequiredMark /></label>
              <input
                type="number"
                min={1}
                max={15}
                value={form.childCodeLength}
                onChange={(e) => setForm({ ...form, childCodeLength: e.target.value })}
              />
            </div>
            <div className="form-field">
              <label className="checkbox-row">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
                فعال
              </label>
            </div>
          </div>
        )}

        {tab === "attributes" && isLastBranch && (
          <div className="je-lines-scroll" style={{ overflowX: "auto", overflowY: "auto", maxHeight: 420 }}>
            <table className="je-lines-table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}></th>
                  <th>ویژگی</th>
                  <th style={{ width: 110 }}>تاثیر در کد کالا</th>
                  <th style={{ width: 180 }}>تاثیر در عنوان کالا</th>
                  <th style={{ width: 90 }}>اولویت</th>
                </tr>
              </thead>
              <tbody>
                {attrRows.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", padding: 14, color: "var(--ink-soft)" }}>
                      ابتدا از فرم «ویژگی کالا خدمت» ویژگی تعریف کنید
                    </td>
                  </tr>
                )}
                {attrRows.map((row, idx) => (
                  <tr key={row.attributeId}>
                    <td style={{ textAlign: "center" }}>
                      <input
                        type="checkbox"
                        checked={row.selected}
                        onChange={(e) =>
                          setAttrRows((prev) => prev.map((r, i) => (i === idx ? { ...r, selected: e.target.checked } : r)))
                        }
                      />
                    </td>
                    <td>{row.title}</td>
                    <td style={{ textAlign: "center" }}>
                      <input
                        type="checkbox"
                        disabled={!row.selected}
                        checked={row.affectsCode}
                        onChange={(e) =>
                          setAttrRows((prev) => prev.map((r, i) => (i === idx ? { ...r, affectsCode: e.target.checked } : r)))
                        }
                      />
                    </td>
                    <td>
                      <select
                        disabled={!row.selected}
                        value={row.titleEffect}
                        onChange={(e) => setAttrRows((prev) => prev.map((r, i) => (i === idx ? { ...r, titleEffect: e.target.value } : r)))}
                      >
                        {Object.entries(TITLE_EFFECT_FA).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                        <button type="button" className="btn secondary" style={{ padding: "3px 8px", fontSize: 11 }} disabled={idx === 0} onClick={() => moveAttrRow(idx, "up")}>
                          ▲
                        </button>
                        <button
                          type="button"
                          className="btn secondary"
                          style={{ padding: "3px 8px", fontSize: 11 }}
                          disabled={idx === attrRows.length - 1}
                          onClick={() => moveAttrRow(idx, "down")}
                        >
                          ▼
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </form>
    </FormPage>
  );
}
