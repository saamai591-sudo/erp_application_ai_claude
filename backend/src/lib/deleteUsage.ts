import { Prisma, PrismaClient } from "@prisma/client";
import { USAGE_META } from "./usageLabels";
import { displayDate } from "../utils/dateDisplay";

// «موارد استفاده» هنگام شکست حذف (base؛ برای همه‌ی مدل‌های فعلی و آینده، بدون تغییر در routeها):
// وقتی prisma.<model>.delete/deleteMany به‌خاطر ارجاع جدول دیگری (کلید خارجی، P2003) شکست بخورد، هوک روی کلاینت مشترک (lib/prisma.ts)
// رکوردهای ارجاع‌دهنده را از خودِ ساختار Prisma (DMMF) پیدا می‌کند و خطا را به DeleteBlockedError با پیام دقیق
// («این کارمند در این موارد استفاده شده: حکم کارگزینی شماره ۱۲ (اعمال …)، وام شماره ۳ …») تبدیل می‌کند. چون routeها `e.message` را برمی‌گردانند، پیام خودکار به کاربر می‌رسد.
//  • ارجاع Cascade حذف می‌شود و مانع نیست، ولی فرزندانش بررسی می‌شوند (مثلاً حکمی که به سابقه‌ی وضعیتِ همان کارمند اشاره دارد)؛ SetNull مانع نیست.
//  • ردیف‌های سند (…Line که با Cascade به سند مادر وصل‌اند) در پیام به‌صورت خودِ سند مادر می‌آیند.
//  • مدل تازه بدون هیچ تغییری پوشش داده می‌شود؛ برای پیام فارسی خوانا یک خط در lib/usageLabels.ts کافی است.
//  • خطا همه‌ی ارجاع‌ها را در `usages` هم دارد (برای دیالوگ «موارد استفاده» با لینک «باز کردن»؛ مرحله‌ی بعد).

export interface UsageRef {
  model: string;
  label: string;
  id: number;
  title: string;
  /** نشانی فرم رکورد در فرانت‌اند (اگر برچسب مدل base دارد) */
  path: string | null;
}

export class DeleteBlockedError extends Error {
  code = "DELETE_BLOCKED";
  constructor(message: string, public usages: UsageRef[]) {
    super(message);
  }
}

const PER_GROUP = 5;
const MAX_GROUPS = 8;
const FETCH = 200;
const MAX_DEPTH = 3;

type Mode = "Cascade" | "SetNull" | "Block";
interface Inbound {
  /** مدلی که به هدف ارجاع می‌دهد */
  model: string;
  /** ستون کلید خارجی آن مدل */
  col: string;
  mode: Mode;
}

const MODELS = new Map(Prisma.dmmf.datamodel.models.map((m) => [m.name, m]));
const INBOUND = new Map<string, Inbound[]>();
/** ردیفِ فرزندِ یک سند: مدلی که با Cascade به مادرش وصل است و نامش با نام مادر شروع و به Line/Row/Item ختم می‌شود (SalesInvoiceLine → SalesInvoice) */
const PARENT = new Map<string, { model: string; col: string }>();

for (const m of MODELS.values()) {
  for (const f of m.fields) {
    if (f.kind !== "object" || !f.relationFromFields?.length) continue;
    if (f.relationFromFields.length !== 1 || f.relationToFields?.length !== 1 || f.relationToFields[0] !== "id") continue;
    const od = (f as any).relationOnDelete as string | undefined;
    const mode: Mode = od === "Cascade" ? "Cascade" : od === "SetNull" ? "SetNull" : od ? "Block" : f.isRequired ? "Block" : "SetNull";
    const list = INBOUND.get(f.type) ?? [];
    list.push({ model: m.name, col: f.relationFromFields[0], mode });
    INBOUND.set(f.type, list);
    if (mode === "Cascade" && m.name !== f.type && m.name.startsWith(f.type) && /(Line|Row|Item)$/.test(m.name) && !PARENT.has(m.name)) PARENT.set(m.name, { model: f.type, col: f.relationFromFields[0] });
  }
}

/** مدلی که ستون id دارد (مدل‌های با کلید اصلیِ دیگر، مثل EmployeePhoto، نه شمارش می‌شوند نه فرزندِ قابل‌پیمایش‌اند) */
const hasId = (model: string) => !!MODELS.get(model)?.fields.some((f) => f.name === "id" && f.isId);
const delegate = (raw: PrismaClient, model: string) => (raw as any)[model.charAt(0).toLowerCase() + model.slice(1)];

function defaultTitle(row: any): string {
  if (row.number !== undefined && row.number !== null) return `شماره ${row.number}${row.date instanceof Date ? ` (${displayDate(row.date)})` : ""}`;
  for (const k of ["title", "name", "code", "detailCode"]) if (typeof row[k] === "string" && row[k]) return row[k];
  return `#${row.id}`;
}

function refOf(model: string, row: any): UsageRef {
  const meta = USAGE_META[model];
  let title: string | null = null;
  try {
    title = meta?.title ? meta.title(row) : null;
  } catch {
    title = null;
  }
  return { model, label: meta?.label ?? `رکورد ${model}`, id: row.id, title: title || defaultTitle(row), path: meta?.base ? `${meta.base}/${row.id}/edit` : null };
}

interface Group {
  label: string;
  refs: Map<number, UsageRef>;
  total: number;
}

async function addRows(raw: PrismaClient, model: string, where: object, groups: Map<string, Group>) {
  if (!hasId(model)) return;
  const parent = PARENT.get(model);
  const d = delegate(raw, model);
  if (parent) {
    // ردیفِ سند → خودِ سند مادر (مثلاً ردیف فاکتور → فاکتور)
    const lines = await d.findMany({ where, select: { [parent.col]: true }, take: FETCH });
    const parentIds = [...new Set<number>(lines.map((l: any) => l[parent.col]))];
    if (parentIds.length === 0) return;
    const meta = USAGE_META[parent.model];
    const rows = await delegate(raw, parent.model).findMany({ where: { id: { in: parentIds.slice(0, 50) } }, orderBy: { id: "asc" }, ...(meta?.include ? { include: meta.include } : {}) });
    const g = groups.get(parent.model) ?? { label: meta?.label ?? `رکورد ${parent.model}`, refs: new Map(), total: 0 };
    for (const r of rows) g.refs.set(r.id, refOf(parent.model, r));
    g.total = Math.max(g.total, parentIds.length);
    groups.set(parent.model, g);
    return;
  }
  const meta = USAGE_META[model];
  const [total, rows] = await Promise.all([
    d.count({ where }),
    d.findMany({ where, orderBy: { id: "asc" }, take: PER_GROUP, ...(meta?.include ? { include: meta.include } : {}) }),
  ]);
  if (!total) return;
  const g = groups.get(model) ?? { label: meta?.label ?? `رکورد ${model}`, refs: new Map(), total: 0 };
  for (const r of rows) g.refs.set(r.id, refOf(model, r));
  g.total = Math.max(g.total, total);
  groups.set(model, g);
}

async function collect(raw: PrismaClient, model: string, ids: number[], depth: number, groups: Map<string, Group>) {
  for (const rel of INBOUND.get(model) ?? []) {
    if (rel.mode === "SetNull") continue;
    const where = { [rel.col]: { in: ids } };
    if (rel.mode === "Cascade") {
      // فرزندی که همراه این رکورد پاک می‌شود، ولی خودش ممکن است مانعی داشته باشد (حکم ← سابقه‌ی وضعیت ← کارمند)
      if (depth >= MAX_DEPTH || !hasId(rel.model)) continue;
      const kids = await delegate(raw, rel.model).findMany({ where, select: { id: true }, take: FETCH });
      if (kids.length) await collect(raw, rel.model, kids.map((k: any) => k.id), depth + 1, groups);
      continue;
    }
    await addRows(raw, rel.model, where, groups);
  }
}

function buildMessage(targetLabel: string, targetTitle: string | null, groups: Group[]): string {
  const parts = groups.slice(0, MAX_GROUPS).map((g) => {
    const shown = [...g.refs.values()].slice(0, PER_GROUP);
    const more = g.total - shown.length;
    return `${g.label}: ${shown.map((r) => r.title).join("، ")}${more > 0 ? ` و ${more} مورد دیگر` : ""}`;
  });
  const extra = groups.length > MAX_GROUPS ? ` (و ${groups.length - MAX_GROUPS} نوع مورد دیگر)` : "";
  return `${targetLabel}${targetTitle ? ` «${targetTitle}»` : ""} قابل حذف نیست؛ در این موارد استفاده شده است — ${parts.join(" — ")}${extra}`;
}

/**
 * خطای شکست‌خورده‌ی delete/deleteMany را بررسی می‌کند: اگر P2003 بود و ارجاع‌دهنده‌ها پیدا شدند، DeleteBlockedError (با پیام دقیق)
 * برمی‌گرداند؛ وگرنه همان خطای اصلی. هیچ‌وقت خودش خطا نمی‌اندازد.
 */
export async function explainDeleteFailure(raw: PrismaClient, model: string, where: object | undefined, error: any): Promise<any> {
  if (error?.code !== "P2003") return error;
  try {
    const d = delegate(raw, model);
    if (!d || !MODELS.get(model)?.fields.some((f) => f.name === "id" && f.isId)) return error;
    const targets: any[] = await d.findMany({ where: where ?? {}, take: 100, ...(USAGE_META[model]?.include ? { include: USAGE_META[model].include } : {}) });
    if (targets.length === 0) return error;
    const groups = new Map<string, Group>();
    await collect(raw, model, targets.map((t) => t.id), 0, groups);
    if (groups.size === 0) return error;
    const meta = USAGE_META[model];
    const title = targets.length === 1 ? (() => { try { return meta?.title ? meta.title(targets[0]) : defaultTitle(targets[0]); } catch { return null; } })() : null;
    const label = targets.length === 1 ? (meta?.label ?? `رکورد ${model}`) : `${targets.length} ${meta?.label ?? "رکورد"}`;
    const list = [...groups.values()];
    const usages = list.flatMap((g) => [...g.refs.values()]);
    return new DeleteBlockedError(buildMessage(label, title, list), usages);
  } catch (e) {
    if (process.env.DEBUG_USAGE) console.error("[deleteUsage]", e);
    return error;
  }
}
