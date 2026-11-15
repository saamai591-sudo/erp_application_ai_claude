import { FormEvent, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ErrorToast } from "../components/ErrorToast";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { Modal } from "../components/Modal";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { AmountInput } from "../components/AmountInput";
import { RecordPickerField } from "../components/RecordPicker";
import { GoodsItemPicker, useGoodsOptions } from "../components/GoodsItemPicker";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { InfoHint } from "../components/InfoHint";
import { BomSelect, defaultBomId, useEligibleBoms } from "../components/BomSelect";
import { RequiredMark } from "../components/RequiredMark";
import { formatAmountFa, toFaDigits } from "../lib/formatAmount";
import { DescriptionField } from "../components/DescriptionField";
import { DocLinesGrid } from "../components/DocLinesGrid";
import { CostCenterPickerField } from "../components/TypePickerFields";
import { formatJalaliDate } from "../lib/formatDate";
import { showError, showToast } from "../lib/toast";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { api, ApiError } from "../lib/api";
import { usePermissions } from "../lib/usePermissions";
import { useTabs } from "../lib/TabsContext";

// تولید › عملیات › «دستور تولید»: هدف تولید یک کالای نیمه‌ساخته/محصول + اجزای لازم (از فرمول ساخت یا دستی). دستور مرتبط با ردیف سفارش فروش/پیش‌فاکتور = سفارشی،
// وگرنه انباری. «آمار تولید» و اسناد مصرف/برگشت مصرف می‌توانند (اختیاری) به دستور «صادرشده» وصل شوند؛ بهای تمام‌شده در سطح مرکز هزینه محاسبه می‌شود و با همین اتصال به دستور منتسب می‌گردد. قواعد: backend/src/services/productionOrderService.ts

const INFO_TEXT =
  "دستور تولید: کالای خروجی و مقدار برنامه‌ای + اجزای لازم (محاسبه از فرمول ساخت فعال در تاریخ دستور یا ورود دستی). پس از «صدور دستور» می‌توان ردیف‌های «آمار تولید» (و اختیاری اسناد مصرف) را به آن وصل کرد؛ مقدار تولیدشده‌ی دستور از آمار تولید و بهای آن در «گزارش بهای تمام‌شده به تفکیک دستور» می‌آید. دستور مرتبط با ردیف سفارش فروش یا پیش‌فاکتور «سفارشی» و بقیه «انباری» است.";

export const ORDER_STATUS_FA: Record<string, string> = { DRAFT: "پیش‌نویس", RELEASED: "صادرشده", CLOSED: "بسته‌شده" };
const KIND_FA: Record<string, string> = { CUSTOM: "سفارشی", STOCK: "انباری" };
const todayIso = () => new Date().toISOString().slice(0, 10);

interface OrderRow { id: number; number: number; date: string; outputItemCode: string; outputItemTitle: string; quantity: number; producedQuantity: number; status: string; kind: string; sourceLabel: string; unit: string }
interface LineRow { componentItemId: string; quantity: string; consumed: number; note: string }
interface OrderChild { id: number; number: number; quantity: number; status: string; itemCode: string; itemTitle: string }
interface ExplosionRow { level: number; itemId: number; code: string; title: string; unit: string; required: number; available: number; covered: number; shortage: number; action: "COVERED" | "MAKE" | "BUY"; note: string | null; usedBy: string[] }
interface SalesLine { id: string; key: string; kind: "ORDER" | "QUOTE"; lineId: number; docNumber: number; docDate: string; customer: string; goodsItemId: number; itemCode: string; itemTitle: string; quantity: number }
interface FormState {
  date: string; outputItemId: string; quantity: string; bomId: string; salesOrderLineId: string; salesQuoteLineId: string; sourceLabel: string;
  plannedStart: string; plannedEnd: string; description: string; lines: LineRow[];
}
const EMPTY: FormState = { date: "", outputItemId: "", quantity: "", bomId: "", salesOrderLineId: "", salesQuoteLineId: "", sourceLabel: "", plannedStart: "", plannedEnd: "", description: "", lines: [] };

export default function ProductionOrders() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <OrderForm />;
  if (location.pathname.endsWith("/edit")) return <OrderForm editId={Number(id)} />;
  return <OrderList />;
}

function OrderList() {
  const cacheKey = "/production-orders";
  const [items, setItems] = usePersistedState<OrderRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  const reload = () => api.get("/production-orders").then(setItems).catch((e) => setError(e.message));
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function onDelete(row: OrderRow) {
    try {
      await api.del(`/production-orders/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text={INFO_TEXT} title="دستور تولید" />
          <NewRecordButton path="/production-orders/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "شماره", render: (r: OrderRow) => toFaDigits(String(r.number)), width: "80px", filterType: "number", filterValue: (r: OrderRow) => r.number },
          { header: "تاریخ", render: (r: OrderRow) => formatJalaliDate(r.date), width: "110px", filterType: "string", filterValue: (r: OrderRow) => formatJalaliDate(r.date) },
          { header: "کد کالا", render: (r: OrderRow) => toFaDigits(r.outputItemCode), width: "110px", filterType: "string", filterValue: (r: OrderRow) => r.outputItemCode },
          { header: "کالای خروجی", render: (r: OrderRow) => r.outputItemTitle, filterType: "string", filterValue: (r: OrderRow) => r.outputItemTitle },
          { header: "مقدار دستور", render: (r: OrderRow) => toFaDigits(String(r.quantity)), width: "110px", filterType: "number", filterValue: (r: OrderRow) => r.quantity },
          { header: "تولیدشده", render: (r: OrderRow) => toFaDigits(String(r.producedQuantity)), width: "100px", filterType: "number", filterValue: (r: OrderRow) => r.producedQuantity },
          { header: "نوع", render: (r: OrderRow) => KIND_FA[r.kind] ?? r.kind, width: "80px", filterType: "string", filterValue: (r: OrderRow) => KIND_FA[r.kind] ?? r.kind },
          { header: "مبنا", render: (r: OrderRow) => r.sourceLabel, filterType: "string", filterValue: (r: OrderRow) => r.sourceLabel },
          { header: "وضعیت", render: (r: OrderRow) => ORDER_STATUS_FA[r.status] ?? r.status, width: "100px", filterType: "string", filterValue: (r: OrderRow) => ORDER_STATUS_FA[r.status] ?? r.status },
        ]}
        rows={items}
        edit={{ path: (r: OrderRow) => `/production-orders/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

function OrderForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const [form, setForm] = usePersistedState<FormState>(cacheKey, { ...EMPTY, date: todayIso() });
  // کالاهای ردیف‌ها (واحد، نوع ردیابی/کالا) از روی شناسه و دسته‌ای از سرور خوانده می‌شوند؛ فهرست کامل کالا دیگر گرفته نمی‌شود
  const goods = useGoodsOptions([form.outputItemId, ...form.lines.map((l) => l.componentItemId)]);
  const [meta, setMeta] = useState<{ number: number | null; bomNumber: number | null; status: string; updatedAt: string | null; documentCount: number; producedQuantity: number; parentOrderId: number | null; parentOrderNumber: number | null; children: OrderChild[]; batches: { id: number; batchNumber: string; productionDate: string | null; itemTitle: string }[] }>({ number: null, bomNumber: null, status: "DRAFT", updatedAt: null, documentCount: 0, producedQuantity: 0, parentOrderId: null, parentOrderNumber: null, children: [], batches: [] });
  const { hasPermission } = usePermissions();
  const { openTab } = useTabs();
  const [childrenOpen, setChildrenOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const [salesLines, setSalesLines] = useState<SalesLine[]>([]);
  const [consumeOpen, setConsumeOpen] = useState(false);
  const { flash } = useSavedFlash();
  // فرمول‌های فعال و معتبر کالای خروجی در تاریخ دستور؛ برای دستور جدید جدیدترین‌شان پیش‌فرض می‌شود (کاربر می‌تواند عوض کند)
  const eligible = useEligibleBoms(form.outputItemId ? [Number(form.outputItemId)] : [], form.date);
  useEffect(() => {
    if (editId || form.bomId || !form.outputItemId) return;
    const d = defaultBomId(eligible[Number(form.outputItemId)]);
    if (d) setForm((f) => (f.bomId || !f.outputItemId ? f : { ...f, bomId: d }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eligible, form.outputItemId]);
  // هشدار نبودن فرمول ساخت: کالا و تاریخ مشخص است، جزئی نیست و در آن تاریخ فرمول ساخت فعالی وجود ندارد
  const [bomWarning, setBomWarning] = useState<string | null>(null);

  async function load(id: number, applyForm: boolean) {
    const o = await api.get(`/production-orders/${id}`);
    setMeta({ number: o.number, bomNumber: o.bomNumber ?? null, status: o.status, updatedAt: o.updatedAt, documentCount: o.documentCount, producedQuantity: o.producedQuantity, parentOrderId: o.parentOrderId ?? null, parentOrderNumber: o.parentOrderNumber ?? null, children: o.children ?? [], batches: o.batches ?? [] });
    if (applyForm) {
      setForm({
        date: o.date, outputItemId: String(o.outputItemId), quantity: String(o.quantity), bomId: o.bomId ? String(o.bomId) : "",
        salesOrderLineId: o.salesOrderLineId ? String(o.salesOrderLineId) : "", salesQuoteLineId: o.salesQuoteLineId ? String(o.salesQuoteLineId) : "", sourceLabel: o.sourceLabel,
        plannedStart: o.plannedStart ?? "", plannedEnd: o.plannedEnd ?? "", description: o.description,
        lines: o.lines.map((l: any) => ({ componentItemId: String(l.componentItemId), quantity: String(l.quantity), consumed: l.consumedQuantity, note: l.note })),
      });
    }
  }

  useEffect(() => {
    if (editId) load(editId, !hasPersistedState(cacheKey)).then(() => setLoaded(true));
    api.get("/production-orders/sales-lines").then((r: any[]) => setSalesLines(r.map((x) => ({ ...x, id: x.key })))).catch(() => setSalesLines([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  useEffect(() => {
    setBomWarning(null);
    if (!form.outputItemId || !form.date || form.lines.length > 0 || form.bomId || meta.status === "CLOSED") return;
    let cancelled = false;
    const t = setTimeout(() => {
      api
        .get(`/boms/active?itemId=${form.outputItemId}&date=${form.date}`)
        .then(() => {})
        .catch((e) => {
          if (!cancelled) setBomWarning((e as ApiError).message);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [form.outputItemId, form.date, form.lines.length, form.bomId, meta.status]);

  // وضعیت تامین اجزا (فقط نمایشی): همان تعریف «آنالیز موجودی» — موجودی، در راه، در حال تولید، تعهدشده و در دسترس هر جزء
  const [avail, setAvail] = useState<Record<number, { stock: number; inTransit: number; inProduction: number; available: number }>>({});
  const componentIdsKey = useMemo(() => [...new Set(form.lines.map((l) => Number(l.componentItemId)).filter((n) => n > 0))].sort((a, b) => a - b).join(","), [form.lines]);
  useEffect(() => {
    if (!componentIdsKey || meta.status === "CLOSED") {
      setAvail({});
      return;
    }
    let cancelled = false;
    const t = setTimeout(() => {
      api
        .get(`/production-orders/availability?itemIds=${componentIdsKey}`)
        .then((rows: any[]) => {
          if (!cancelled) setAvail(Object.fromEntries(rows.map((r) => [r.id, r])));
        })
        .catch(() => {
          if (!cancelled) setAvail({});
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [componentIdsKey, meta.status]);
  const showAvail = meta.status !== "CLOSED";

  // پیش‌نمایش انفجار چندسطحی (فقط نمایشی): نیاز باقی‌مانده‌ی ردیف‌های فرم، سطح‌به‌سطح با موجودی/در راه/در حال تولید خالص می‌شود
  const [explosion, setExplosion] = useState<ExplosionRow[] | null>(null);
  const [exploding, setExploding] = useState(false);
  async function previewExplosion() {
    setError(null);
    if (!form.date) return setError("تاریخ دستور را وارد کنید");
    const lines = form.lines
      .map((l) => ({ componentItemId: Number(l.componentItemId), quantity: (Number(l.quantity) || 0) - l.consumed }))
      .filter((l) => l.componentItemId > 0 && l.quantity > 0);
    if (!lines.length) return setError("ردیفی با نیاز باقی‌مانده برای پیش‌نمایش وجود ندارد");
    setExploding(true);
    try {
      setExplosion(await api.post("/production-orders/explosion", { date: form.date, lines }, { silent: true }));
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setExploding(false);
    }
  }
  // کسری = نیازِ باقی‌مانده (لازم − مصرف‌شده) منهای موجودیِ در دسترس (منفی صفر حساب می‌شود)
  const shortageOf = (l: LineRow) => {
    const a = avail[Number(l.componentItemId)];
    if (!a) return null;
    return Math.max(0, (Number(l.quantity) || 0) - l.consumed - Math.max(0, a.available));
  };

  const locked = meta.status === "CLOSED";
  const itemLocked = meta.status !== "DRAFT" && !!editId;
  // بعد از «صدور»: فرمول و اجزا قفل‌اند (فقط مقدار دستور — با تغییر متناسب اجزا — و تاریخ‌های برنامه‌ای/توضیح قابل ویرایش‌اند)
  const structureLocked = meta.status === "RELEASED" && !!editId;
  const unitOf = (id: string) => goods.find((g) => g.id === Number(id))?.unit ?? "";
  const salesOptions = useMemo(() => salesLines.filter((s) => !form.outputItemId || s.goodsItemId === Number(form.outputItemId)), [salesLines, form.outputItemId]);
  const setLine = (i: number, patch: Partial<LineRow>) => setForm((f) => ({ ...f, lines: f.lines.map((l, k) => (k === i ? { ...l, ...patch } : l)) }));

  async function fillFromBom(bomId?: string) {
    setError(null);
    if (!form.outputItemId || !form.date || !(Number(form.quantity) > 0)) return setError("کالای خروجی، تاریخ و مقدار دستور را وارد کنید");
    try {
      const pick = bomId || form.bomId;
      const b = pick ? await api.get(`/boms/${pick}`) : await api.get(`/boms/active?itemId=${form.outputItemId}&date=${form.date}`);
      const out = Number(b.outputQuantity) || 1;
      const qty = Number(form.quantity);
      setForm((f) => ({
        ...f,
        bomId: String(b.id),
        lines: b.lines.map((l: any) => ({
          componentItemId: String(l.componentItemId),
          quantity: String(Math.round(((qty * l.quantity) / out / (1 - l.scrapPercent / 100)) * 1e6) / 1e6),
          consumed: 0,
          note: l.note ?? "",
        })),
      }));
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  // تغییر فرمول: اگر اجزا از قبل هست، با تأیید از فرمول تازه دوباره ساخته می‌شوند
  async function changeBom(id: string) {
    if (!id) return setForm((f) => ({ ...f, bomId: "" }));
    if (form.lines.length > 0 && !window.confirm("اجزای فعلی با اجزای فرمول انتخاب‌شده جایگزین می‌شود. ادامه می‌دهید؟")) return;
    if (Number(form.quantity) > 0) await fillFromBom(id);
    else setForm((f) => ({ ...f, bomId: id }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const payload: any = {
      date: form.date, outputItemId: Number(form.outputItemId), quantity: form.quantity,
      bomId: form.bomId ? Number(form.bomId) : undefined,
      salesOrderLineId: form.salesOrderLineId ? Number(form.salesOrderLineId) : null,
      salesQuoteLineId: form.salesQuoteLineId ? Number(form.salesQuoteLineId) : null,
      plannedStart: form.plannedStart || null, plannedEnd: form.plannedEnd || null, description: form.description,
      updatedAt: meta.updatedAt,
    };
    // دستور بدون هیچ جزء (فرمول ساخت فعال نیست و جزئی هم وارد نشده): پیش از ثبت از کاربر تایید می‌گیریم
    if (!form.lines.length && bomWarning && !window.confirm(`${bomWarning}.\nدستور بدون هیچ جزء ثبت می‌شود و مانده‌ی مصرف نخواهد داشت. ادامه می‌دهید؟`)) return;
    if (form.lines.length || editId) payload.lines = form.lines.map((l) => ({ componentItemId: Number(l.componentItemId), quantity: l.quantity, note: l.note }));
    try {
      if (editId) {
        await api.put(`/production-orders/${editId}`, payload);
        await load(editId, meta.status !== "DRAFT");
        flash();
      } else {
        const created = await api.post("/production-orders", payload);
        flash();
        navigate(`/production-orders/${created.id}/edit`);
      }
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function action(path: string, okMsg: string) {
    if (!editId) return;
    try {
      await api.post(`/production-orders/${editId}/${path}`, {});
      await load(editId, false);
      showToast(okMsg);
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/production-orders/${editId}`);
      navigate("/production-orders");
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  if (!loaded) return null;

  const extraActions: { label: string; onClick: () => void | Promise<void> }[] = [];
  if (editId && meta.status === "DRAFT") extraActions.push({ label: "صدور دستور", onClick: () => action("release", "دستور صادر شد") });
  if (editId && meta.status === "RELEASED") {
    if (meta.documentCount === 0) extraActions.push({ label: "برگشت به پیش‌نویس (برای اصلاح فرمول/اجزا)", onClick: () => { if (window.confirm("دستور به پیش‌نویس برمی‌گردد و تا صدور دوباره، آمار تولید و سند مصرفی نمی‌تواند به آن وصل شود. ادامه می‌دهید؟")) action("unrelease", "دستور به پیش‌نویس برگشت"); } });
    extraActions.push({ label: "ایجاد سند مصرف از مانده‌ی اجزا", onClick: () => setConsumeOpen(true) });
    extraActions.push({ label: "بستن دستور", onClick: () => action("close", "دستور بسته شد") });
  }
  if (editId && meta.status !== "CLOSED" && hasPermission("production.operations.production-orders.createChildren")) extraActions.push({ label: "ساخت دستورهای سطح پایین برای کسری", onClick: () => setChildrenOpen(true) });
  if (editId && meta.status === "CLOSED") extraActions.push({ label: "بازکردن دستور", onClick: () => action("reopen", "دستور دوباره صادر شد") });

  return (
    <FormPage
      title={editId ? `دستور تولید ${meta.number ? toFaDigits(String(meta.number)) : ""} — ${ORDER_STATUS_FA[meta.status] ?? ""}` : "دستور تولید جدید"}
      formId="order-form" closePath="/production-orders" newPath="/production-orders/new"
      onDelete={editId && meta.status === "DRAFT" && meta.documentCount === 0 ? handleDelete : undefined}
      extraActions={extraActions}
    >
      <form id="order-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        {(meta.parentOrderId || meta.children.length > 0 || meta.batches.length > 0) && (
          <div className="card" style={{ padding: "6px 10px", marginBottom: 8, fontSize: 13, display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
            {meta.parentOrderId && (
              <span>
                دستور مادر:{" "}
                <a href="#" onClick={(e) => { e.preventDefault(); openTab(`/production-orders/${meta.parentOrderId}/edit`); }}>{toFaDigits(String(meta.parentOrderNumber))}</a>
              </span>
            )}
            {meta.batches.length > 0 && (
              <span>
                بچ تولیدی:{" "}
                {meta.batches.map((b, i) => (
                  <span key={b.id}>
                    {i > 0 && "، "}
                    <a href="#" title={`${b.itemTitle}${b.productionDate ? ` — تاریخ تولید ${formatJalaliDate(b.productionDate)}` : ""}`} onClick={(e) => { e.preventDefault(); openTab(`/batches/${b.id}/edit`); }}>{b.batchNumber}</a>
                  </span>
                ))}
              </span>
            )}
            {meta.children.length > 0 && (
              <span>
                دستورهای سطح پایین:{" "}
                {meta.children.map((c, i) => (
                  <span key={c.id}>
                    {i > 0 && "، "}
                    <a href="#" title={`${c.itemCode} — ${c.itemTitle} (${formatAmountFa(c.quantity)}) — ${ORDER_STATUS_FA[c.status] ?? ""}`} onClick={(e) => { e.preventDefault(); openTab(`/production-orders/${c.id}/edit`); }}>{toFaDigits(String(c.number))}</a>
                  </span>
                ))}
              </span>
            )}
          </div>
        )}
        {locked && <div className="card" style={{ padding: 8, marginBottom: 8 }}>دستور بسته شده است؛ برای ویرایش ابتدا آن را باز کنید.</div>}
        <fieldset disabled={locked} style={{ border: "none", padding: 0 }}>
          <div className="je-header-grid" style={{ marginBottom: 6, maxWidth: 900 }}>
            <div className="form-field">
              <label>تاریخ دستور<RequiredMark /></label>
              <JalaliDatePicker value={form.date} fiscalYear onChange={(v) => setForm({ ...form, date: v })} />
            </div>
            <div className="form-field">
              <label>کالای خروجی<RequiredMark /></label>
              <GoodsItemPicker value={form.outputItemId} produced disabled={itemLocked} onChange={(g) => setForm({ ...form, outputItemId: String(g.id), bomId: "", salesOrderLineId: "", salesQuoteLineId: "", sourceLabel: "" })} />
            </div>
            <div className="form-field">
              <label>فرمول ساخت</label>
              <BomSelect options={eligible[Number(form.outputItemId)]} value={form.bomId} currentNumber={meta.bomNumber} disabled={!form.outputItemId || structureLocked} onChange={changeBom} />
            </div>
            <div className="form-field">
              <label>مقدار دستور {unitOf(form.outputItemId) && `(${unitOf(form.outputItemId)})`}<RequiredMark /></label>
              <AmountInput value={form.quantity} onChange={(v) => setForm({ ...form, quantity: v })} allowDecimal />
            </div>
            <div className="form-field">
              <label>شروع برنامه‌ای</label>
              <JalaliDatePicker value={form.plannedStart} onChange={(v) => setForm({ ...form, plannedStart: v })} />
            </div>
            <div className="form-field">
              <label>پایان برنامه‌ای</label>
              <JalaliDatePicker value={form.plannedEnd} onChange={(v) => setForm({ ...form, plannedEnd: v })} />
            </div>
            <div className="form-field full">
              <label>اتصال به سفارش فروش / پیش‌فاکتور (دستور سفارشی)</label>
              <RecordPickerField<SalesLine>
                title="ردیف سفارش فروش / پیش‌فاکتور"
                displayValue={form.sourceLabel}
                rows={salesOptions}
                onClear={form.sourceLabel ? () => setForm({ ...form, salesOrderLineId: "", salesQuoteLineId: "", sourceLabel: "" }) : undefined}
                columns={[
                  { header: "نوع", render: (s) => (s.kind === "ORDER" ? "سفارش فروش" : "پیش‌فاکتور"), filterValue: (s) => (s.kind === "ORDER" ? "سفارش فروش" : "پیش‌فاکتور"), width: "110px" },
                  { header: "شماره", render: (s) => toFaDigits(String(s.docNumber)), filterValue: (s) => String(s.docNumber), width: "80px" },
                  { header: "تاریخ", render: (s) => formatJalaliDate(s.docDate), filterValue: (s) => formatJalaliDate(s.docDate), width: "110px" },
                  { header: "مشتری", render: (s) => s.customer, filterValue: (s) => s.customer },
                  { header: "کالا", render: (s) => s.itemTitle, filterValue: (s) => s.itemTitle },
                  { header: "مقدار", render: (s) => toFaDigits(String(s.quantity)), filterValue: (s) => String(s.quantity), width: "90px" },
                ]}
                onSelect={(s) =>
                  setForm({
                    ...form,
                    outputItemId: String(s.goodsItemId),
                    bomId: String(s.goodsItemId) === form.outputItemId ? form.bomId : "",
                    salesOrderLineId: s.kind === "ORDER" ? String(s.lineId) : "",
                    salesQuoteLineId: s.kind === "QUOTE" ? String(s.lineId) : "",
                    sourceLabel: `${s.kind === "ORDER" ? "سفارش فروش" : "پیش‌فاکتور"} ${s.docNumber} — ${s.customer}`,
                    quantity: form.quantity || String(s.quantity),
                  })
                }
              />
            </div>
            <div className="form-field full">
              <DescriptionField value={form.description} onChange={(v) => setForm({ ...form, description: v })} />
            </div>
          </div>

          {structureLocked && (
            <div className="card" style={{ padding: "6px 10px", marginBottom: 8, fontSize: 13 }}>
              دستور صادر شده است؛ کالای خروجی، فرمول و اجزا قفل‌اند. با تغییر «مقدار دستور» (نه کمتر از تولیدشده) اجزا به همان نسبت عوض می‌شوند. برای تغییر فرمول یا اجزا، دستور را به پیش‌نویس برگردانید (فقط وقتی سند و آمار ندارد).
            </div>
          )}
          {bomWarning && form.lines.length === 0 && (
            <div className="card" role="alert" style={{ padding: "8px 12px", marginBottom: 8, borderInlineStart: "4px solid var(--warning, #e0a100)" }}>
              ⚠ {bomWarning}. اگر دستور را همین‌طور ثبت کنید هیچ جزئی نخواهد داشت؛ تاریخ را اصلاح کنید، فرمول ساخت تعریف کنید، یا اجزا را دستی وارد کنید.
            </div>
          )}
          <fieldset disabled={structureLocked} style={{ border: "none", padding: 0, margin: 0, minWidth: 0 }}>
          <DocLinesGrid
            title="اجزای لازم"
            count={form.lines.length}
            totals={<>جمع مقدار لازم: {formatAmountFa(form.lines.reduce((t, l) => t + (Number(l.quantity) || 0), 0))}</>}
            onAdd={() => setForm((f) => ({ ...f, lines: [...f.lines, { componentItemId: "", quantity: "", consumed: 0, note: "" }] }))}
            addTitle="جزء جدید"
            toolbarExtra={
              <>
                <button type="button" className="btn secondary" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => fillFromBom()}>محاسبه از فرمول ساخت</button>
                {showAvail && <button type="button" className="btn secondary" style={{ padding: "4px 10px", fontSize: 12 }} onClick={previewExplosion} disabled={exploding} title="اجزای ساخته‌شدنی تا آخرین سطح باز می‌شود و موجودی/در راه/در حال تولید از نیاز کم می‌گردد؛ سندی ایجاد نمی‌شود">{exploding ? "در حال محاسبه…" : "پیش‌نمایش چندسطحی"}</button>}
                {form.bomId && <span style={{ fontSize: 12, opacity: 0.75 }}>بر پایه‌ی فرمول ساخت</span>}
              </>
            }
          >
            <thead><tr><th style={{ width: 50 }}>#</th><th>کالا</th><th style={{ width: 80 }}>واحد</th><th style={{ width: 160 }}>مقدار لازم</th>{editId && <th style={{ width: 120 }}>مصرف‌شده</th>}{showAvail && <><th style={{ width: 100 }}>موجودی</th><th style={{ width: 100 }}>در راه</th><th style={{ width: 110 }}>در حال تولید</th><th style={{ width: 100 }}>کسری</th></>}<th>توضیح</th><th style={{ width: 70 }} /></tr></thead>
            <tbody>
              {form.lines.map((l, i) => (
                <tr key={i}>
                  <td>{toFaDigits(String(i + 1))}</td>
                  <td><GoodsItemPicker value={l.componentItemId} onChange={(g) => setLine(i, { componentItemId: String(g.id) })} /></td>
                  <td>{unitOf(l.componentItemId)}</td>
                  <td><AmountInput value={l.quantity} onChange={(v) => setLine(i, { quantity: v })} allowDecimal /></td>
                  {editId && <td>{toFaDigits(String(l.consumed))}</td>}
                  {showAvail && (
                    <>
                      <td>{avail[Number(l.componentItemId)] ? formatAmountFa(avail[Number(l.componentItemId)].stock) : "—"}</td>
                      <td>{avail[Number(l.componentItemId)] ? formatAmountFa(avail[Number(l.componentItemId)].inTransit) : "—"}</td>
                      <td>{avail[Number(l.componentItemId)] ? formatAmountFa(avail[Number(l.componentItemId)].inProduction) : "—"}</td>
                      <td style={shortageOf(l) ? { color: "#c0392b", fontWeight: 600 } : undefined}>{shortageOf(l) === null ? "—" : formatAmountFa(shortageOf(l)!)}</td>
                    </>
                  )}
                  <td><input value={l.note} onChange={(e) => setLine(i, { note: e.target.value })} /></td>
                  <td><button type="button" className="btn danger" style={{ padding: "4px 8px", fontSize: 11 }} onClick={() => setForm((f) => ({ ...f, lines: f.lines.filter((_, k) => k !== i) }))}>حذف</button></td>
                </tr>
              ))}
            </tbody>
          </DocLinesGrid>
          </fieldset>
        </fieldset>
      </form>
      {childrenOpen && editId && <ChildrenDialog orderId={editId} onClose={() => setChildrenOpen(false)} onDone={() => { setChildrenOpen(false); load(editId, false); }} />}
      {explosion && (
        <Modal title="پیش‌نمایش نیاز چندسطحی (فقط نمایشی)" onClose={() => setExplosion(null)}>
          <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 8 }}>
            نیاز باقی‌مانده‌ی اجزا با «موجودی در دسترس» (موجودی + در راه + در حال تولید − تعهدشده) خالص شده است؛ کسریِ جزء ساخته‌شدنی به اجزای فرمول خودش باز می‌شود. موجودی اطمینان و زمان تامین فقط در MRP دیده می‌شود.
          </div>
          <div style={{ maxHeight: "60vh", overflow: "auto" }}>
            <table className="data-table" style={{ width: "100%" }}>
              <thead>
                <tr><th>سطح</th><th>کالا</th><th>واحد</th><th>نیاز</th><th>در دسترس</th><th>پوشش‌داده‌شده</th><th>کسری</th><th>اقدام</th><th>مصرف‌کننده</th></tr>
              </thead>
              <tbody>
                {explosion.map((r) => (
                  <tr key={r.itemId}>
                    <td>{toFaDigits(String(r.level))}</td>
                    <td style={{ paddingInlineStart: (r.level - 1) * 14 + 6 }}>{r.code} — {r.title}</td>
                    <td>{r.unit}</td>
                    <td>{formatAmountFa(r.required)}</td>
                    <td>{formatAmountFa(r.available)}</td>
                    <td>{formatAmountFa(r.covered)}</td>
                    <td style={r.shortage > 0 ? { color: "#c0392b", fontWeight: 600 } : undefined}>{formatAmountFa(r.shortage)}</td>
                    <td title={r.note ?? undefined}>{r.action === "COVERED" ? "تامین‌شده" : r.action === "MAKE" ? "باید ساخته شود" : "خرید"}{r.note ? " ⓘ" : ""}</td>
                    <td>{r.usedBy.join("، ") || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Modal>
      )}
      {consumeOpen && editId &&<ConsumptionDialog orderId={editId} onClose={() => setConsumeOpen(false)} onDone={() => { setConsumeOpen(false); load(editId, false); }} />}
    </FormPage>
  );
}

function ConsumptionDialog({ orderId, onClose, onDone }: { orderId: number; onClose: () => void; onDone: () => void }) {
  const navigate = useNavigate();
  const [warehouses, setWarehouses] = useState<{ id: number; title: string }[]>([]);
  const [centers, setCenters] = useState<{ id: number; detailCode: string; title: string }[]>([]);
  const [v, setV] = useState({ warehouseId: "", costCenterId: "", date: todayIso() });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    api.get("/warehouses").then(setWarehouses).catch(() => setWarehouses([]));
    api.get("/cost-centers").then(setCenters).catch(() => setCenters([]));
  }, []);
  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      const r = await api.post(`/production-orders/${orderId}/create-consumption`, { warehouseId: Number(v.warehouseId), costCenterId: Number(v.costCenterId), date: v.date });
      showToast(`سند مصرف تولید شماره ${toFaDigits(String(r.number))} ایجاد شد`);
      onDone();
      navigate(`/production-consumptions/${r.id}/edit`);
    } catch (e) {
      setErr((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="ایجاد سند مصرف از مانده‌ی اجزا" onClose={onClose}>
      <ErrorToast message={err} />
      <div className="form-grid">
        <div className="form-field">
          <label>انبار<RequiredMark /></label>
          <select value={v.warehouseId} onChange={(e) => setV({ ...v, warehouseId: e.target.value })}>
            <option value="">انتخاب کنید</option>
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.title}</option>)}
          </select>
        </div>
        <div className="form-field">
          <label>مرکز هزینه<RequiredMark /></label>
          <CostCenterPickerField costCenters={centers} value={v.costCenterId} onChange={(id) => setV({ ...v, costCenterId: id })} />
        </div>
        <div className="form-field">
          <label>تاریخ سند<RequiredMark /></label>
          <JalaliDatePicker value={v.date} fiscalYear onChange={(d) => setV({ ...v, date: d })} />
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button type="button" className="btn" disabled={busy || !v.warehouseId || !v.costCenterId} onClick={submit}>ایجاد سند</button>
        <button type="button" className="btn secondary" onClick={onClose}>انصراف</button>
      </div>
    </Modal>
  );
}

// ساخت دستورهای سطح پایین برای کسری اجزا: طرح بر پایه‌ی ردیف‌های ذخیره‌شده‌ی دستور از سرور خوانده می‌شود، با تایید کاربر پیش‌نویس ساخته می‌شود
function ChildrenDialog({ orderId, onClose, onDone }: { orderId: number; onClose: () => void; onDone: () => void }) {
  const [scope, setScope] = useState<"ONE" | "ALL">("ONE");
  const [plan, setPlan] = useState<{ blockedReason: string | null; rows: ExplosionRow[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setPlan(null);
    setErr(null);
    api.get(`/production-orders/${orderId}/children-plan?scope=${scope}`).then(setPlan).catch((e) => setErr((e as ApiError).message));
  }, [orderId, scope]);
  async function create() {
    setBusy(true);
    setErr(null);
    try {
      const made: { number: number }[] = await api.post(`/production-orders/${orderId}/create-children`, { scope });
      showToast(`${toFaDigits(String(made.length))} دستور پیش‌نویس ساخته شد`);
      onDone();
    } catch (e) {
      setErr((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="ساخت دستورهای سطح پایین برای کسری" onClose={onClose}>
      <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 8 }}>
        بر پایه‌ی ردیف‌های ذخیره‌شده‌ی دستور (ابتدا تغییرات فرم را ذخیره کنید). برای هر جزء ساخته‌شدنیِ دارای کسری یک دستور «پیش‌نویس» با پیوند «دستور مادر» ساخته می‌شود؛ اجزای آن‌ها از فرمول ساخت فعال می‌آید و دستورها خودکار صادر نمی‌شوند.
      </div>
      <div style={{ display: "flex", gap: 16, marginBottom: 8 }}>
        <label><input type="radio" checked={scope === "ONE"} onChange={() => setScope("ONE")} /> فقط اجزای مستقیم (یک سطح)</label>
        <label><input type="radio" checked={scope === "ALL"} onChange={() => setScope("ALL")} /> همه‌ی سطح‌ها</label>
      </div>
      {err && <div className="card" role="alert" style={{ padding: 8, marginBottom: 8, color: "#c0392b" }}>{err}</div>}
      {plan?.blockedReason && <div className="card" role="alert" style={{ padding: 8, marginBottom: 8 }}>{plan.blockedReason}</div>}
      {plan && !plan.blockedReason && plan.rows.length === 0 && <div style={{ padding: 8 }}>کسریِ ساخته‌شدنی وجود ندارد.</div>}
      {plan && plan.rows.length > 0 && (
        <table className="data-table" style={{ width: "100%" }}>
          <thead><tr><th>سطح</th><th>کالا</th><th>مقدار دستور (کسری)</th><th>مصرف‌کننده</th></tr></thead>
          <tbody>
            {plan.rows.map((r) => (
              <tr key={r.itemId}>
                <td>{toFaDigits(String(r.level))}</td>
                <td>{r.code} — {r.title}</td>
                <td>{formatAmountFa(r.shortage)} {r.unit}</td>
                <td>{r.usedBy.join("، ") || "دستور اصلی"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 12, justifyContent: "flex-end" }}>
        <button type="button" className="btn secondary" onClick={onClose}>انصراف</button>
        <button type="button" className="btn" onClick={create} disabled={busy || !plan || !!plan.blockedReason || plan.rows.length === 0}>{busy ? "در حال ساخت…" : "ساخت دستورهای پیش‌نویس"}</button>
      </div>
    </Modal>
  );
}
