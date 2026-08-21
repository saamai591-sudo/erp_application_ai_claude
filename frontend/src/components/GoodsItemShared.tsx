import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTabs } from "../lib/TabsContext";
import { DataTable } from "./DataTable";
import { FormPage } from "./FormPage";
import { RefreshButton } from "./RefreshButton";
import { NewRecordButton } from "./NewRecordButton";
import { InfoHint } from "./InfoHint";
import { FieldHint } from "./FieldHint";
import { RecordPickerField } from "./RecordPicker";
import { ExcelImportButton } from "./ExcelImport";
import { api, ApiError } from "../lib/api";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { toFaDigits, formatAmountFa } from "../lib/formatAmount";
import { digitsOnly } from "../lib/digits";

export type ItemKind = "GOODS" | "SERVICE";

const KIND_FA: Record<ItemKind, string> = { GOODS: "کالا", SERVICE: "خدمت" };
const GROUP_LABEL: Record<ItemKind, string> = { GOODS: "گروه کالا", SERVICE: "گروه خدمت" };

interface GoodsGroupLevelRow {
  id: number;
  order: number;
  affectsGoodsCode: boolean;
}

interface GroupAttrLink {
  attributeId: number;
  order: number;
  affectsCode: boolean;
  titleEffect: "NONE" | "VALUE" | "VALUE_AND_TITLE";
  attribute: { id: number; title: string };
}

interface GroupRow {
  id: number;
  parentId: number | null;
  levelId: number;
  level: GoodsGroupLevelRow;
  code: string;
  title: string;
  isLastBranch: boolean;
  affectsGoodsTitle: boolean;
  childCodeLength: number | null;
  isActive: boolean;
  attributes: GroupAttrLink[];
}

interface AttributeItemRow {
  id: number;
  attributeId: number;
  code: string;
  title: string;
}

interface AttributeRow {
  id: number;
  code: number;
  title: string;
  itemCodeLength: number;
  items: AttributeItemRow[];
}

interface UnitRow {
  id: number;
  code: number;
  title: string;
  isWeight: boolean;
}

interface AccountingGroupRow {
  id: number;
  code: number;
  title: string;
  isActive: boolean;
}

interface ItemRow {
  id: number;
  kind: ItemKind;
  goodsGroupId: number;
  code: string;
  fullCode: string;
  rawTitle: string;
  title: string;
  mainUnitId: number;
  weightUnitId: number | null;
  weightRatio: string | null;
  technicalSpec: string | null;
  barcode: string | null;
  reorderControl: boolean;
  reorderPoint: string | null;
  hasSerialNumber: boolean;
  hasExpiryDate: boolean;
  isSerialTracked: boolean;
  isExpiryTracked: boolean;
  isBatchTracked: boolean;
  isLocationTracked: boolean;
  accountingGroupId: number;
  isSpecial: boolean;
  taxRate: string | null;
  isActive: boolean;
  hasTransactions: boolean;
  goodsGroup: GroupRow;
  mainUnit: UnitRow;
  weightUnit: UnitRow | null;
  accountingGroup: AccountingGroupRow;
  attributeValues: { attributeId: number; itemId: number; attribute: { title: string }; item: { id: number; code: string; title: string } }[];
}

function groupChain(group: GroupRow, all: GroupRow[]): GroupRow[] {
  const chain: GroupRow[] = [];
  let cur: GroupRow | undefined = group;
  while (cur) {
    chain.unshift(cur);
    cur = cur.parentId ? all.find((x) => x.id === cur!.parentId) : undefined;
  }
  return chain;
}

function fullGroupCode(group: GroupRow, all: GroupRow[]): string {
  return groupChain(group, all)
    .map((g) => g.code)
    .join("");
}

function groupBreadcrumb(group: GroupRow, all: GroupRow[]): string {
  return groupChain(group, all)
    .map((g) => g.title)
    .join(" › ");
}

interface AttrRowState {
  attributeId: number;
  order: number;
  affectsCode: boolean;
  titleEffect: "NONE" | "VALUE" | "VALUE_AND_TITLE";
  attributeTitle: string;
  items: AttributeItemRow[];
  selectedItemId: string;
}

function buildAttrRows(group: GroupRow | undefined, attrItemsMap: Map<number, AttributeItemRow[]>, existing?: { attributeId: number; itemId: number }[]): AttrRowState[] {
  if (!group) return [];
  return [...group.attributes]
    .sort((a, b) => a.order - b.order)
    .map((ga) => {
      const found = existing?.find((e) => e.attributeId === ga.attributeId);
      return {
        attributeId: ga.attributeId,
        order: ga.order,
        affectsCode: ga.affectsCode,
        titleEffect: ga.titleEffect,
        attributeTitle: ga.attribute.title,
        items: attrItemsMap.get(ga.attributeId) ?? [],
        selectedItemId: found ? String(found.itemId) : "",
      };
    });
}

function computePreview(
  group: GroupRow | undefined,
  allGroups: GroupRow[],
  attrRows: AttrRowState[],
  serialInput: string,
  rawTitle: string
) {
  if (!group) return { codePreview: "", titlePreview: rawTitle };
  const chain = groupChain(group, allGroups);
  const codeParts: string[] = [];
  const titleParts: string[] = [];
  for (const g of chain) {
    if (g.level.affectsGoodsCode) codeParts.push(g.code);
    if (g.affectsGoodsTitle) titleParts.push(g.title);
  }
  for (const row of attrRows) {
    const item = row.items.find((i) => String(i.id) === row.selectedItemId);
    if (!item) continue;
    if (row.affectsCode) codeParts.push(item.code);
    if (row.titleEffect === "VALUE") titleParts.push(item.title);
    else if (row.titleEffect === "VALUE_AND_TITLE") titleParts.push(`${row.attributeTitle}: ${item.title}`);
  }
  const codePrefix = codeParts.join("");
  const len = group.childCodeLength ?? 0;
  const serial = serialInput ? digitsOnly(serialInput).padStart(len, "0") : "○".repeat(len);
  const titlePrefix = titleParts.join("، ");
  return {
    codePreview: codePrefix + serial,
    titlePreview: titlePrefix ? `${titlePrefix}${rawTitle ? "، " + rawTitle : ""}` : rawTitle,
  };
}

// =========================================================================
// فهرست
// =========================================================================

export function GoodsItemList({ kind }: { kind: ItemKind }) {
  const label = KIND_FA[kind];
  const basePath = kind === "GOODS" ? "/goods" : "/services";
  const cacheKey = `/goods-items?kind=${kind}`;
  const [items, setItems] = usePersistedState<ItemRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  const [bulkSlot, setBulkSlot] = useState<HTMLDivElement | null>(null);
  const { openTab } = useTabs();

  function reload() {
    api
      .get(`/goods-items?kind=${kind}`)
      .then(setItems)
      .catch((e) => setError(e.message));
  }

  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onDelete(row: ItemRow) {
    try {
      await api.del(`/goods-items/${row.id}`);
      reload();
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text={`تعریف ${label}‌های سیستم — کد و بخشی از عنوان بر اساس گروه و ویژگی‌های انتخاب‌شده خودکار ساخته می‌شود`} title={label} />
          <ExcelImportButton
            entityLabel={label}
            templateFilename={`قالب-تعریف-${label}`}
            backendEntityType="goods-item"
            extraFields={{ kind }}
            columns={[
              { key: "groupFullCode", label: `کد کامل ${GROUP_LABEL[kind]}`, required: true, hint: "کد کامل شاخه‌ی آخر، همان‌طور که در انتخابگر گروه فرم نمایش داده می‌شود" },
              { key: "code", label: "کد", hint: "اختیاری — خالی بگذارید تا خودکار ساخته شود" },
              { key: "title", label: "عنوان", required: true },
              { key: "mainUnitCode", label: "کد واحد اصلی", required: true },
              { key: "accountingGroupCode", label: "کد گروه حساب", required: true },
              { key: "attributes", label: "ویژگی‌ها", hint: 'اختیاری — به فرم «عنوان ویژگی=عنوان مقدار» جدا شده با «،»، مثلاً «رنگ=قرمز،سایز=بزرگ»' },
              ...(kind === "GOODS"
                ? ([
                    { key: "weightUnitCode", label: "کد واحد وزنی", hint: "اختیاری — فقط اگر واحد اصلی خودش وزنی نباشد" },
                    { key: "weightRatio", label: "نسبت وزنی", hint: "اگر واحد وزنی پر شده باشد الزامی است" },
                    { key: "technicalSpec", label: "مشخصه فنی" },
                    { key: "barcode", label: "بارکد" },
                    { key: "reorderControl", label: "کنترل نقطه سفارش", hint: "بله / خیر" },
                    { key: "reorderPoint", label: "مقدار نقطه سفارش", hint: "اگر کنترل نقطه سفارش «بله» باشد الزامی است" },
                    { key: "hasSerialNumber", label: "شماره سریال دارد", hint: "بله / خیر" },
                    { key: "hasExpiryDate", label: "تاریخ انقضا دارد", hint: "بله / خیر" },
                    { key: "isSerialTracked", label: "سریال‌پذیر", hint: "بله / خیر" },
                    { key: "isExpiryTracked", label: "تاریخ‌انقضاپذیر", hint: "بله / خیر" },
                    { key: "isBatchTracked", label: "بچ‌پذیر", hint: "بله / خیر" },
                    { key: "isLocationTracked", label: "محل‌پذیر", hint: "بله / خیر" },
                  ] as const)
                : []),
              { key: "isSpecial", label: `${label} خاص`, hint: "بله / خیر" },
              { key: "taxRate", label: "نرخ مالیات", hint: `اگر «${label} خاص» «بله» باشد الزامی است` },
              { key: "isActive", label: "فعال", hint: "بله / خیر — پیش‌فرض بله" },
            ]}
            onDone={reload}
          />
          <NewRecordButton path={`${basePath}/new`} />
          <RefreshButton onClick={reload} />
          <div ref={setBulkSlot} className="bulk-slot" style={{ display: "flex" }} />
        </div>
      </div>
      {error && <div className="alert error">{error}</div>}
      <DataTable
        bulkActionsContainer={bulkSlot}
        columns={[
          { header: "کد", render: (r) => toFaDigits(r.fullCode), width: "140px", filterType: "string", filterValue: (r) => r.fullCode },
          { header: "عنوان", render: (r) => r.title, filterType: "string", filterValue: (r) => r.title },
          { header: "گروه", render: (r) => r.goodsGroup?.title, filterType: "string", filterValue: (r) => r.goodsGroup?.title ?? "" },
          { header: "واحد اصلی", render: (r) => r.mainUnit?.title, filterType: "string", filterValue: (r) => r.mainUnit?.title ?? "" },
          { header: "فعال", render: (r) => (r.isActive ? "بله" : "خیر"), width: "70px" },
        ]}
        rows={items}
        onEdit={(r) => openTab(`${basePath}/${r.id}/edit`)}
        onDelete={onDelete}
      />
    </div>
  );
}

// =========================================================================
// فرم
// =========================================================================

const DEFAULT_FORM = {
  goodsGroupId: "",
  code: "",
  title: "",
  mainUnitId: "",
  weightUnitId: "",
  weightRatio: "",
  technicalSpec: "",
  barcode: "",
  reorderControl: false,
  reorderPoint: "",
  hasSerialNumber: false,
  hasExpiryDate: false,
  isSerialTracked: false,
  isExpiryTracked: false,
  isBatchTracked: false,
  isLocationTracked: false,
  accountingGroupId: "",
  isSpecial: false,
  taxRate: "",
  isActive: true,
};

type FormState = typeof DEFAULT_FORM;

export function GoodsItemForm({ kind, editId }: { kind: ItemKind; editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const label = KIND_FA[kind];
  const groupLabel = GROUP_LABEL[kind];
  const basePath = kind === "GOODS" ? "/goods" : "/services";
  const cacheKey = `form:${location.pathname}:form`;
  const attrCacheKey = `form:${location.pathname}:attrs`;

  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [attributes, setAttributes] = useState<AttributeRow[]>([]);
  const [units, setUnits] = useState<UnitRow[]>([]);
  const [accountingGroups, setAccountingGroups] = useState<AccountingGroupRow[]>([]);
  const [form, setForm] = usePersistedState<FormState>(cacheKey, DEFAULT_FORM);
  const [attrRows, setAttrRows] = usePersistedState<AttrRowState[]>(attrCacheKey, []);
  const [tab, setTab] = useState<"main" | "attrs" | "inventory" | "accounting" | "tracking">("main");
  const [error, setError] = useState<string | null>(null);
  const [existingHasTransactions, setExistingHasTransactions] = useState(false);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const { saved, flash } = useSavedFlash();

  useEffect(() => {
    Promise.all([
      api.get("/goods-groups"),
      api.get("/goods-attributes"),
      api.get("/units-of-measure"),
      api.get("/accounting-groups"),
    ]).then(([g, a, u, ag]) => {
      setGroups(g);
      setAttributes(a);
      setUnits(u);
      setAccountingGroups(ag);
    });
  }, []);

  useEffect(() => {
    if (!editId) {
      if (!hasPersistedState(cacheKey)) {
        setForm(DEFAULT_FORM);
        setAttrRows([]);
      }
      setExistingHasTransactions(false);
      return;
    }
    if (hasPersistedState(cacheKey)) return;
    api.get(`/goods-items/${editId}`).then((item: ItemRow) => {
      setForm({
        goodsGroupId: String(item.goodsGroupId),
        code: item.code,
        title: item.rawTitle,
        mainUnitId: String(item.mainUnitId),
        weightUnitId: item.weightUnitId ? String(item.weightUnitId) : "",
        weightRatio: item.weightRatio ?? "",
        technicalSpec: item.technicalSpec ?? "",
        barcode: item.barcode ?? "",
        reorderControl: item.reorderControl,
        reorderPoint: item.reorderPoint ?? "",
        hasSerialNumber: item.hasSerialNumber,
        hasExpiryDate: item.hasExpiryDate,
        isSerialTracked: item.isSerialTracked,
        isExpiryTracked: item.isExpiryTracked,
        isBatchTracked: item.isBatchTracked,
        isLocationTracked: item.isLocationTracked,
        accountingGroupId: String(item.accountingGroupId),
        isSpecial: item.isSpecial,
        taxRate: item.taxRate ?? "",
        isActive: item.isActive,
      });
      setExistingHasTransactions(item.hasTransactions);
      // ردیف‌های ویژگی بعد از لود شدن groups/attributes در افکت جدا هیدرات می‌شوند (چون به آن دو نیاز دارد)
      (window as any).__pendingAttrHydrate = item.attributeValues.map((av) => ({ attributeId: av.attributeId, itemId: av.itemId }));
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  const attrItemsMap = new Map<number, AttributeItemRow[]>();
  for (const a of attributes) attrItemsMap.set(a.id, a.items);

  // وقتی گروه انتخاب‌شده و اطلاعات ویژگی‌ها آماده شد، ردیف‌های ویژگی را بر اساس گروه بساز/به‌روز کن
  useEffect(() => {
    if (!form.goodsGroupId || groups.length === 0 || attributes.length === 0) return;
    const group = groups.find((g) => String(g.id) === form.goodsGroupId);
    if (!group) return;
    const pending = (window as any).__pendingAttrHydrate as { attributeId: number; itemId: number }[] | undefined;
    if (pending) (window as any).__pendingAttrHydrate = undefined;
    setAttrRows((prev) => buildAttrRows(group, attrItemsMap, pending ?? prev.map((r) => ({ attributeId: r.attributeId, itemId: Number(r.selectedItemId) }))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.goodsGroupId, groups.length, attributes.length]);

  const selectedGroup = groups.find((g) => String(g.id) === form.goodsGroupId);
  const selectedUnit = units.find((u) => String(u.id) === form.mainUnitId);
  const selectedWeightUnit = units.find((u) => String(u.id) === form.weightUnitId);
  const selectedAccountingGroup = accountingGroups.find((a) => String(a.id) === form.accountingGroupId);
  const leafGroups = groups.filter((g) => g.isLastBranch && g.isActive);
  const showWeightFields = kind === "GOODS" && selectedUnit && !selectedUnit.isWeight;
  const { codePreview, titlePreview } = computePreview(selectedGroup, groups, attrRows, form.code, form.title);

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/goods-items/${editId}`);
      navigate(basePath);
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.goodsGroupId) return setError(`${groupLabel} الزامی است`);
    if (!form.title.trim()) return setError("عنوان الزامی است");
    if (!form.mainUnitId) return setError("واحد اصلی الزامی است");
    if (!form.accountingGroupId) return setError("گروه حساب الزامی است");
    for (const row of attrRows) {
      if (!row.selectedItemId) return setError(`مقدار ویژگی «${row.attributeTitle}» الزامی است`);
    }
    if (showWeightFields && form.weightUnitId && !form.weightRatio) return setError("نسبت وزنی الزامی است");
    if (form.isSpecial && !form.taxRate) return setError("نرخ مالیات الزامی است");
    if (kind === "GOODS" && form.reorderControl && !form.reorderPoint) return setError("مقدار نقطه سفارش الزامی است");

    const body: any = {
      kind,
      goodsGroupId: Number(form.goodsGroupId),
      code: form.code || undefined,
      title: form.title.trim(),
      mainUnitId: Number(form.mainUnitId),
      weightUnitId: showWeightFields && form.weightUnitId ? Number(form.weightUnitId) : null,
      weightRatio: showWeightFields && form.weightUnitId ? Number(form.weightRatio) : null,
      technicalSpec: form.technicalSpec || undefined,
      barcode: form.barcode || undefined,
      accountingGroupId: Number(form.accountingGroupId),
      isSpecial: form.isSpecial,
      taxRate: form.isSpecial ? Number(form.taxRate) : null,
      isActive: form.isActive,
      attributes: attrRows.map((r) => ({ attributeId: r.attributeId, itemId: Number(r.selectedItemId) })),
    };
    if (kind === "GOODS") {
      body.reorderControl = form.reorderControl;
      body.reorderPoint = form.reorderControl ? Number(form.reorderPoint) : null;
      body.hasSerialNumber = form.hasSerialNumber;
      body.hasExpiryDate = form.hasExpiryDate;
      body.isSerialTracked = form.isSerialTracked;
      body.isExpiryTracked = form.isExpiryTracked;
      body.isBatchTracked = form.isBatchTracked;
      body.isLocationTracked = form.isLocationTracked;
    }

    try {
      if (editId) {
        await api.put(`/goods-items/${editId}`, body);
        flash();
      } else {
        const created = await api.post("/goods-items", body);
        flash();
        navigate(`${basePath}/${created.id}/edit`);
      }
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  if (!loaded) return null;

  const tabs: { key: typeof tab; label: string; show: boolean }[] = [
    { key: "main", label: `${groupLabel} و عنوان`, show: true },
    { key: "attrs", label: "ویژگی", show: attrRows.length > 0 },
    { key: "inventory", label: "مدیریت موجودی", show: kind === "GOODS" },
    { key: "accounting", label: `حسابداری ${label}`, show: true },
    { key: "tracking", label: "ردیابی", show: kind === "GOODS" },
  ];

  return (
    <FormPage
      title={editId ? `ویرایش ${label}` : `${label} جدید`}
      formId="goods-item-form"
      closePath={basePath}
      newPath={`${basePath}/new`}
      onDelete={editId ? handleDelete : undefined}
    >
      <div className="party-tabs">
        {tabs
          .filter((t) => t.show)
          .map((t) => (
            <button key={t.key} type="button" className={`party-tab ${tab === t.key ? "active" : ""}`} onClick={() => setTab(t.key)}>
              {t.label}
            </button>
          ))}
      </div>
      <form id="goods-item-form" onSubmit={onSubmit}>
        {error && <div className="alert error">{error}</div>}
        {saved && <div className="alert warn">تغییرات ذخیره شد</div>}

        {tab === "main" && (
          <div className="form-grid">
            <div className="form-field full">
              <label>{groupLabel}</label>
              <RecordPickerField
                title={`انتخاب ${groupLabel}`}
                disabled={!!editId}
                displayValue={selectedGroup ? `${toFaDigits(fullGroupCode(selectedGroup, groups))} — ${groupBreadcrumb(selectedGroup, groups)}` : ""}
                rows={leafGroups}
                columns={[
                  { header: "کد", render: (g) => toFaDigits(fullGroupCode(g, groups)), filterValue: (g) => fullGroupCode(g, groups), width: "110px" },
                  { header: "مسیر", render: (g) => groupBreadcrumb(g, groups), filterValue: (g) => groupBreadcrumb(g, groups) },
                ]}
                onSelect={(g) => setForm({ ...form, goodsGroupId: String(g.id) })}
              />
            </div>
            <div className="form-field">
              <label>کد <FieldHint label="کد" text="اختیاری — در صورت خالی بودن، سیستم آخرین کد گروه انتخاب‌شده را به‌اضافه‌ی یک درج می‌کند. طول کد نباید از «طول کد کالاهای زیرمجموعه» گروه بیشتر باشد" /></label>
              <input dir="ltr" disabled={!!editId} value={form.code} onChange={(e) => setForm({ ...form, code: digitsOnly(e.target.value) })} />
            </div>
            <div className="form-field">
              <label>عنوان</label>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus />
            </div>
            {selectedGroup && (
              <div className="form-field full" style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>
                پیش‌نمایش: کد «{toFaDigits(codePreview)}» — عنوان «{titlePreview || "—"}»
              </div>
            )}
            <div className="form-field">
              <label>واحد اصلی</label>
              <RecordPickerField
                title="انتخاب واحد اصلی"
                displayValue={selectedUnit ? `${toFaDigits(String(selectedUnit.code))} — ${selectedUnit.title}` : ""}
                rows={units}
                columns={[
                  { header: "کد", render: (u) => toFaDigits(String(u.code)), filterValue: (u) => String(u.code), width: "90px" },
                  { header: "عنوان", render: (u) => u.title, filterValue: (u) => u.title },
                ]}
                onSelect={(u) => setForm({ ...form, mainUnitId: String(u.id), weightUnitId: "", weightRatio: "" })}
              />
            </div>
            {kind === "GOODS" && (
              <>
                <div className={`form-field ${showWeightFields ? "" : "form-field-hidden"}`}>
                  <label>واحد وزنی <FieldHint label="واحد وزنی" text="اختیاری — فقط در صورتی که واحد اصلی خودش واحد وزنی نباشد" /></label>
                  <RecordPickerField
                    title="انتخاب واحد وزنی"
                    placeholder="ندارد"
                    displayValue={selectedWeightUnit ? `${toFaDigits(String(selectedWeightUnit.code))} — ${selectedWeightUnit.title}` : ""}
                    rows={units.filter((u) => u.isWeight)}
                    columns={[
                      { header: "کد", render: (u) => toFaDigits(String(u.code)), filterValue: (u) => String(u.code), width: "90px" },
                      { header: "عنوان", render: (u) => u.title, filterValue: (u) => u.title },
                    ]}
                    onSelect={(u) => setForm({ ...form, weightUnitId: String(u.id) })}
                    onClear={() => setForm({ ...form, weightUnitId: "", weightRatio: "" })}
                  />
                </div>
                <div className={`form-field ${showWeightFields && form.weightUnitId ? "" : "form-field-hidden"}`}>
                  <label>نسبت وزنی</label>
                  <input type="number" step="any" value={form.weightRatio} onChange={(e) => setForm({ ...form, weightRatio: e.target.value })} />
                </div>
                <div className="form-field">
                  <label>مشخصه فنی</label>
                  <input value={form.technicalSpec} onChange={(e) => setForm({ ...form, technicalSpec: e.target.value })} />
                </div>
                <div className="form-field">
                  <label>بارکد</label>
                  <input dir="ltr" value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} />
                </div>
              </>
            )}
          </div>
        )}

        {tab === "attrs" && (
          <div className="je-lines-scroll" style={{ overflowX: "auto" }}>
            <table className="je-lines-table">
              <thead>
                <tr>
                  <th>عنوان ویژگی</th>
                  <th>کد</th>
                  <th>عنوان</th>
                </tr>
              </thead>
              <tbody>
                {attrRows.map((row, idx) => {
                  const selectedItem = row.items.find((i) => String(i.id) === row.selectedItemId);
                  return (
                    <tr key={row.attributeId}>
                      <td>{row.attributeTitle}</td>
                      <td>
                        <select
                          value={row.selectedItemId}
                          onChange={(e) => setAttrRows((prev) => prev.map((r, i) => (i === idx ? { ...r, selectedItemId: e.target.value } : r)))}
                        >
                          <option value="">انتخاب کنید</option>
                          {row.items.map((it) => (
                            <option key={it.id} value={it.id}>
                              {toFaDigits(it.code)} — {it.title}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>{selectedItem?.title ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {tab === "inventory" && kind === "GOODS" && (
          <div className="form-grid">
            <div className="form-field">
              <label className="checkbox-row">
                <input type="checkbox" checked={form.reorderControl} onChange={(e) => setForm({ ...form, reorderControl: e.target.checked, reorderPoint: e.target.checked ? form.reorderPoint : "" })} />
                کنترل نقطه سفارش
              </label>
            </div>
            <div className={`form-field ${form.reorderControl ? "" : "form-field-hidden"}`}>
              <label>مقدار نقطه سفارش</label>
              <input type="number" step="any" value={form.reorderPoint} onChange={(e) => setForm({ ...form, reorderPoint: e.target.value })} />
            </div>
          </div>
        )}

        {tab === "accounting" && (
          <div className="form-grid">
            <div className="form-field full">
              <label>گروه حساب</label>
              <RecordPickerField
                title="انتخاب گروه حساب"
                disabled={existingHasTransactions}
                displayValue={selectedAccountingGroup ? `${toFaDigits(String(selectedAccountingGroup.code))} — ${selectedAccountingGroup.title}` : ""}
                rows={accountingGroups.filter((a) => a.isActive)}
                columns={[
                  { header: "کد", render: (a) => toFaDigits(String(a.code)), filterValue: (a) => String(a.code), width: "90px" },
                  { header: "عنوان", render: (a) => a.title, filterValue: (a) => a.title },
                ]}
                onSelect={(a) => setForm({ ...form, accountingGroupId: String(a.id) })}
              />
            </div>
            <div className="form-field">
              <label className="checkbox-row">
                <input type="checkbox" checked={form.isSpecial} onChange={(e) => setForm({ ...form, isSpecial: e.target.checked, taxRate: e.target.checked ? form.taxRate : "" })} />
                {label} خاص هست
              </label>
            </div>
            <div className={`form-field ${form.isSpecial ? "" : "form-field-hidden"}`}>
              <label>نرخ مالیات</label>
              <input type="number" step="any" value={form.taxRate} onChange={(e) => setForm({ ...form, taxRate: e.target.value })} />
            </div>
            <div className="form-field">
              <label className="checkbox-row">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
                فعال
              </label>
            </div>
          </div>
        )}

        {tab === "tracking" && kind === "GOODS" && (
          <div className="form-grid">
            <div className="form-field">
              <label className="checkbox-row">
                <input type="checkbox" checked={form.isSerialTracked} onChange={(e) => setForm({ ...form, isSerialTracked: e.target.checked })} />
                سریال پذیر
              </label>
            </div>
            <div className="form-field">
              <label className="checkbox-row">
                <input type="checkbox" checked={form.isBatchTracked} onChange={(e) => setForm({ ...form, isBatchTracked: e.target.checked })} />
                بچ (Batch)
              </label>
            </div>
            <div className="form-field">
              <label className="checkbox-row">
                <input type="checkbox" checked={form.isLocationTracked} onChange={(e) => setForm({ ...form, isLocationTracked: e.target.checked })} />
                محل فیزیکی
              </label>
            </div>
          </div>
        )}
      </form>
    </FormPage>
  );
}
