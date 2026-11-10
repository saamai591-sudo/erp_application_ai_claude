import { Prisma } from "@prisma/client";
import { rawPrisma } from "../lib/rawPrisma";
import { getRequestContext } from "../lib/requestContext";

// «لاگ تغییرات» (Audit). تنها جای قواعد: پیکربندی مؤثر (لایسنس × تنظیم مشتری)، نوشتن، partition ماهانه، پاک‌سازی و سقف حجم.
// • رویدادها در schema جدای `audit` (جدول partition ماهانه، فقط با SQL خام) هستند و عمداً از pg_dump اصلی کنار گذاشته می‌شوند (backupService/updater: --exclude-schema=audit).
// • لایسنس تعیین می‌کند مجاز هست یا نه + سطح و سقف‌ها (مدت نگهداری، حجم)؛ تنظیم مشتری (فقط از /management) داخل همین سقف‌هاست.
// • نوشتن از lib/prisma.ts (نقطه‌ی مرکزی همه‌ی نوشتن‌ها) صدا زده می‌شود. داخل درخواست HTTP ردیف‌ها در یک بافر می‌مانند و فقط وقتی پاسخ موفق (< 400) بود نوشته می‌شوند
//   (Prisma دسته‌ی تراکنش را به extension نمی‌دهد؛ این‌طوری تغییرِ برگشت‌خورده در درخواستِ شکست‌خورده لاگ نمی‌شود). بیرون از درخواست (کار زمان‌بندی‌شده/اسکریپت) فوری نوشته می‌شود.
// • خطای نوشتن لاگ هرگز عملیات اصلی را خراب نمی‌کند (فقط در لاگ سرور می‌آید).

export const AUDIT_SCHEMA_SQL = [
  `CREATE SCHEMA IF NOT EXISTS audit`,
  `CREATE SEQUENCE IF NOT EXISTS audit.event_id_seq`,
  `CREATE TABLE IF NOT EXISTS audit.event (
    id BIGINT NOT NULL DEFAULT nextval('audit.event_id_seq'),
    at TIMESTAMPTZ NOT NULL DEFAULT now(),
    "userId" INTEGER,
    "userName" TEXT,
    kind TEXT NOT NULL,
    action TEXT NOT NULL,
    model TEXT,
    "recordId" TEXT,
    summary TEXT,
    changes JSONB,
    ip TEXT,
    PRIMARY KEY (id, at)
  ) PARTITION BY RANGE (at)`,
  `CREATE TABLE IF NOT EXISTS audit.event_default PARTITION OF audit.event DEFAULT`,
  `CREATE INDEX IF NOT EXISTS event_record_idx ON audit.event (model, "recordId", at)`,
  `CREATE INDEX IF NOT EXISTS event_at_idx ON audit.event (at)`,
  `CREATE INDEX IF NOT EXISTS event_user_idx ON audit.event ("userId", at)`,
];

/** مدل‌هایی که لاگ می‌شوند ← برچسب فارسی. ردیف‌های فرزند (Line/Item) جدا لاگ نمی‌شوند؛ ویرایش سند مادر همان را پوشش می‌دهد. */
export const AUDITED_MODELS: Record<string, string> = {
  // اسناد فروش/خرید
  SalesQuote: "پیش‌فاکتور",
  SalesOrder: "سفارش فروش",
  SalesDelivery: "حواله فروش",
  SalesInvoice: "فاکتور فروش",
  SalesReturnInvoice: "فاکتور برگشت از فروش",
  PurchaseOrder: "سفارش خرید",
  PurchaseInvoice: "فاکتور خرید",
  ServicePurchaseInvoice: "فاکتور خرید خدمات",
  PurchaseReturn: "برگشت خرید",
  // خزانه
  Receipt: "رسید دریافت",
  Payment: "اعلامیه پرداخت",
  PartySettlement: "اعلامیه بدهکار بستانکار",
  PettyCashPayment: "پرداخت تنخواه",
  PettyCashSummary: "خلاصه تنخواه",
  ChequeDeposit: "واگذاری چک به بانک",
  ChequeDepositReturn: "برگشت از واگذاری چک",
  ChequeClearingReceivable: "وصول چک دریافتنی",
  ChequeClearingPayable: "وصول چک پرداختنی",
  CashBoxTransfer: "انتقال به صندوق",
  TreasuryOpening: "افتتاحیه خزانه",
  GuaranteeDocument: "سند تضمین",
  // انبار و دارایی
  InventoryDocument: "سند انبار",
  FixedAsset: "دارایی ثابت",
  // حسابداری
  JournalEntry: "سند حسابداری",
  Account: "حساب",
  ReportingPeriod: "دوره گزارش",
  FiscalPeriod: "دوره مالی",
  // اطلاعات پایه
  Party: "طرف حساب",
  Customer: "مشتری",
  Supplier: "تامین‌کننده",
  GoodsItem: "کالا/خدمت",
  BankAccount: "حساب بانکی",
  CashBox: "صندوق",
  Currency: "ارز",
  ExchangeRate: "نرخ ارز",
  NumberingPattern: "الگوی شماره‌گذاری",
  // منابع انسانی
  Employee: "کارمند",
  EmploymentDecree: "حکم کارگزینی",
  // کاربران و دسترسی
  User: "کاربر",
  Role: "نقش کاربری",
  UserRole: "نقش کاربر",
  RoleAction: "دسترسی نقش",
  UserAction: "دسترسی کاربر",
  // تنظیمات حسابداری
  GoodsServiceAccountingSetting: "تنظیم حسابداری کالا و خدمت",
  TreasuryAccountSetting: "تعیین حساب معین خزانه",
  AccountingVatRate: "نرخ ارزش افزوده",
  TaxMemory: "حافظه مالیاتی",
};

const knownModels = new Set(Prisma.dmmf.datamodel.models.map((m) => m.name));
for (const m of Object.keys(AUDITED_MODELS)) {
  if (!knownModels.has(m)) console.warn(`[audit] مدل «${m}» در schema نیست و لاگ نمی‌شود`);
}

/** به‌روزرسانی‌هایی که فقط این کلیدها را عوض می‌کنند نویز سیستمی‌اند و لاگ نمی‌شوند */
const NOISE_ONLY_KEYS = new Set(["updatedAt", "hasTransactions", "preferences"]);

// ─── پیکربندی مؤثر ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface AuditConfig {
  /** لایسنس مجاز کرده و مشتری روشن کرده است */
  active: boolean;
  licensed: boolean;
  /** سطح مؤثر = کمینه‌ی سطح لایسنس و سطح تنظیم */
  level: "BASIC" | "FULL";
  licenseLevel: "BASIC" | "FULL";
  enabled: boolean;
  settingLevel: "BASIC" | "FULL";
  settingRetentionDays: number;
  /** مدت نگهداری مؤثر = کمینه‌ی تنظیم و سقف لایسنس */
  retentionDays: number;
  maxRetentionDays: number | null;
  maxStorageMB: number | null;
}

let configCache: { at: number; cfg: AuditConfig } | null = null;
export function invalidateAuditConfig() {
  configCache = null;
}

// licenseService خودش از lib/prisma می‌خواند و lib/prisma از این فایل؛ برای پرهیز از import حلقوی در زمان بارگذاری، فقط هنگام استفاده بارگذاری می‌شود
const entitlement = async () => (await import("../license/licenseService")).getAuditEntitlement();

export async function getAuditSetting() {
  const s = await rawPrisma.auditSetting.findUnique({ where: { id: 1 } });
  return s ?? { id: 1, enabled: false, level: "BASIC" as const, retentionDays: 365, lastMaintenanceAt: null, lastMaintenanceMessage: null, updatedAt: new Date(0) };
}

export async function getAuditConfig(): Promise<AuditConfig> {
  if (configCache && Date.now() - configCache.at < 15_000) return configCache.cfg;
  const [ent, s] = await Promise.all([entitlement(), getAuditSetting()]);
  const level: "BASIC" | "FULL" = ent.level === "BASIC" || s.level === "BASIC" ? "BASIC" : "FULL";
  const cfg: AuditConfig = {
    active: ent.licensed && s.enabled,
    licensed: ent.licensed,
    level,
    licenseLevel: ent.level,
    enabled: s.enabled,
    settingLevel: s.level,
    settingRetentionDays: s.retentionDays,
    retentionDays: ent.maxRetentionDays ? Math.min(s.retentionDays, ent.maxRetentionDays) : s.retentionDays,
    maxRetentionDays: ent.maxRetentionDays,
    maxStorageMB: ent.maxStorageMB,
  };
  configCache = { at: Date.now(), cfg };
  return cfg;
}

// ─── نوشتن ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface AuditRow {
  at: Date;
  userId: number | null;
  kind: "CHANGE" | "EVENT" | "AUTH";
  action: string;
  model: string | null;
  recordId: string | null;
  summary: string | null;
  changes?: unknown;
  ip: string | null;
}

const userNameCache = new Map<number, { at: number; name: string }>();
async function userNameOf(userId: number | null): Promise<string | null> {
  if (!userId) return null;
  const hit = userNameCache.get(userId);
  if (hit && Date.now() - hit.at < 10 * 60_000) return hit.name;
  const u = await rawPrisma.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true, mobile: true } });
  const name = u ? `${u.firstName} ${u.lastName}`.trim() || u.mobile : `کاربر ${userId}`;
  userNameCache.set(userId, { at: Date.now(), name });
  return name;
}

/** ردیف‌ها را می‌نویسد؛ هرگز پرتاب نمی‌کند */
export async function writeAuditRows(rows: AuditRow[]): Promise<void> {
  if (!rows.length) return;
  try {
    const names = new Map<number, string | null>();
    for (const r of rows) if (r.userId && !names.has(r.userId)) names.set(r.userId, await userNameOf(r.userId));
    const values = rows.map(
      (r) =>
        Prisma.sql`(${r.at}, ${r.userId}, ${r.userId ? names.get(r.userId) ?? null : null}, ${r.kind}, ${r.action}, ${r.model}, ${r.recordId}, ${r.summary}, ${r.changes === undefined || r.changes === null ? null : JSON.stringify(r.changes)}::jsonb, ${r.ip})`
    );
    await rawPrisma.$executeRaw`INSERT INTO audit.event (at, "userId", "userName", kind, action, model, "recordId", summary, changes, ip) VALUES ${Prisma.join(values)}`;
  } catch (e) {
    console.error("[audit] نوشتن لاگ ناموفق بود", (e as Error).message);
  }
}

const ACTION_BY_OP: Record<string, string> = {
  create: "CREATE",
  createMany: "CREATE_MANY",
  update: "UPDATE",
  updateMany: "UPDATE_MANY",
  upsert: "UPSERT",
  delete: "DELETE",
  deleteMany: "DELETE_MANY",
};

// ─── سطح FULL: مقدار قبل و بعد فیلدها ───────────────────────────────────────────────────────────────────────────────────────────

/** نام فیلدهایی که مقدارشان هرگز ثبت نمی‌شود (فقط «تغییر کرد») */
const SENSITIVE_FIELD_RE = /(password|hash|token|secret|private|signature|apikey)/i;
/** فیلدهایی که خودکار عوض می‌شوند و از تفاوت و نمایش اولیه کنار می‌مانند */
const SKIP_DIFF_FIELDS = new Set(["updatedAt"]);
const SKIP_SNAPSHOT_FIELDS = new Set(["id", "createdAt", "updatedAt"]);
const MAX_VALUE_CHARS = 300;
const MAX_CHANGES_JSON_CHARS = 8000;

interface ModelMeta {
  /** فیلدهای اسکالر/enum غیر باینری (قابل‌خواندن و مقایسه) */
  scalars: string[];
  select: Record<string, true>;
  relations: Set<string>;
}
const metaCache = new Map<string, ModelMeta>();
function metaOf(model: string): ModelMeta {
  let m = metaCache.get(model);
  if (m) return m;
  const def = Prisma.dmmf.datamodel.models.find((x) => x.name === model);
  const scalars = (def?.fields ?? []).filter((f) => (f.kind === "scalar" || f.kind === "enum") && f.type !== "Bytes").map((f) => f.name);
  m = { scalars, select: Object.fromEntries(scalars.map((n) => [n, true as const])), relations: new Set((def?.fields ?? []).filter((f) => f.kind === "object").map((f) => f.name)) };
  metaCache.set(model, m);
  return m;
}

/** مقدار را برای ذخیره در JSON یکدست می‌کند (Decimal/تاریخ/BigInt/Json) و بلند را کوتاه می‌کند */
function normValue(v: unknown): unknown {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "bigint") return v.toString();
  if (typeof v === "string") return v.length > MAX_VALUE_CHARS ? v.slice(0, MAX_VALUE_CHARS) + "…" : v;
  if (typeof v === "number" || typeof v === "boolean") return v;
  if (typeof v === "object") {
    // Decimal (Prisma.Decimal) خودش toString معنادار دارد؛ Json آزاد به رشته‌ی کوتاه تبدیل می‌شود
    const ctor = (v as any).constructor?.name;
    if (ctor === "Decimal") return String(v);
    try {
      const t = JSON.stringify(v);
      return t.length > MAX_VALUE_CHARS ? t.slice(0, MAX_VALUE_CHARS) + "…" : t;
    } catch {
      return "[نامشخص]";
    }
  }
  return String(v);
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function capChanges(changes: Record<string, [unknown, unknown]>): Record<string, unknown> {
  const entries = Object.entries(changes);
  let out: Record<string, unknown> = Object.fromEntries(entries);
  if (JSON.stringify(out).length <= MAX_CHANGES_JSON_CHARS) return out;
  out = {};
  let size = 0;
  let kept = 0;
  for (const [k, v] of entries) {
    size += JSON.stringify([k, v]).length;
    if (size > MAX_CHANGES_JSON_CHARS) break;
    out[k] = v;
    kept++;
  }
  out["…"] = [null, `${entries.length - kept} فیلد دیگر`];
  return out;
}

/** تفاوت دو اسنپ‌شات (before/after می‌توانند null باشند: ایجاد/حذف). null ⇒ تغییری نیست */
function diffSnapshots(model: string, before: any, after: any): Record<string, unknown> | null {
  const { scalars } = metaOf(model);
  const changes: Record<string, [unknown, unknown]> = {};
  for (const f of scalars) {
    if (before && after) {
      if (SKIP_DIFF_FIELDS.has(f) || !(f in after) || !(f in before)) continue;
    } else if (SKIP_SNAPSHOT_FIELDS.has(f) || !(f in (before ?? after ?? {}))) continue;
    let a = before ? normValue(before[f]) : null;
    let b = after ? normValue(after[f]) : null;
    if (!before || !after) {
      // ایجاد/حذف: فقط فیلدهای دارای مقدار
      if ((before ? a : b) === null) continue;
    } else if (same(a, b)) continue;
    if (SENSITIVE_FIELD_RE.test(f)) {
      a = a === null ? null : "•••";
      b = b === null ? null : "•••";
    }
    changes[f] = [a, b];
  }
  return Object.keys(changes).length ? capChanges(changes) : null;
}

/** نام ارتباط‌های (ردیف‌ها و ...) که در data این نوشتن دست خورده‌اند؛ مقدارشان ثبت نمی‌شود */
function touchedRelations(model: string, data: any): string[] {
  if (!data || typeof data !== "object") return [];
  const rel = metaOf(model).relations;
  return Object.keys(data).filter((k) => rel.has(k));
}

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

export interface AuditPre {
  before: any | null;
}

/** پیش از اجرای update/delete/upsert (فقط سطح FULL) وضعیت فعلی رکورد را می‌خواند؛ برای بقیه null (بدون هزینه) */
export async function auditPre(model: string, operation: string, args: any): Promise<AuditPre | null> {
  if (!AUDITED_MODELS[model]) return null;
  if (operation !== "update" && operation !== "delete" && operation !== "upsert") return null;
  try {
    if (operation === "update" && args?.data) {
      const keys = Object.keys(args.data);
      if (keys.length && keys.every((k) => NOISE_ONLY_KEYS.has(k))) return null;
    }
    const cfg = await getAuditConfig();
    if (!cfg.active || cfg.level !== "FULL") return null;
    const before = await (rawPrisma as any)[lowerFirst(model)].findUnique({ where: args.where, select: metaOf(model).select });
    return { before };
  } catch (e) {
    console.error("[audit] خواندن وضعیت قبلی ناموفق بود", (e as Error).message);
    return null;
  }
}

/** صدا زده‌شده از lib/prisma.ts بعد از هر نوشتنِ موفقِ یک مدل. اگر مدل لاگ‌شدنی نباشد یا لاگ فعال نباشد تقریباً بدون هزینه برمی‌گردد. */
export async function auditChange(model: string, operation: string, args: any, result: any, pre?: AuditPre | null): Promise<void> {
  if (!AUDITED_MODELS[model]) return;
  try {
    if ((operation === "update" || operation === "updateMany") && args?.data) {
      const keys = Object.keys(args.data);
      if (keys.length && keys.every((k) => NOISE_ONLY_KEYS.has(k))) return;
    }
    // عملیات گروهی بدون هیچ رکوردِ اثرگذار (مثلاً همگام‌سازی دسترسی‌ها در بوت) نویز است
    if (operation.endsWith("Many") && typeof result?.count === "number" && result.count === 0) return;
    const cfg = await getAuditConfig();
    if (!cfg.active) return;
    const ctx = getRequestContext();
    const many = operation.endsWith("Many");
    let action = ACTION_BY_OP[operation] ?? operation.toUpperCase();
    let changes: Record<string, unknown> | null | undefined;
    const notes: string[] = [];
    if (cfg.level === "FULL") {
      if (!many) {
        const full = (r: any) => !args?.select && r && typeof r === "object";
        if (operation === "create") changes = diffSnapshots(model, null, full(result) ? result : null);
        else if (operation === "delete") changes = pre ? diffSnapshots(model, pre.before, null) : undefined;
        else if (pre) {
          // update/upsert: «بعد» همان نتیجه است مگر select سفارشی داده شده باشد که دوباره خوانده می‌شود
          let after = full(result) ? result : null;
          if (!after && result?.id !== undefined) after = await (rawPrisma as any)[lowerFirst(model)].findUnique({ where: { id: result.id }, select: metaOf(model).select }).catch(() => null);
          if (operation === "upsert" && !pre.before) {
            action = "CREATE";
            changes = diffSnapshots(model, null, after);
          } else if (pre.before) changes = diffSnapshots(model, pre.before, after);
          if (operation === "upsert" && pre.before) action = "UPDATE";
        }
      } else if (operation === "updateMany" && args?.data) {
        notes.push(`فیلدها: ${Object.keys(args.data).filter((k) => !SKIP_DIFF_FIELDS.has(k)).join("، ")}`);
      }
    }
    if (operation === "update" || operation === "create" || operation === "upsert") {
      const rels = touchedRelations(model, operation === "upsert" ? args?.update ?? args?.create : args?.data);
      if (rels.length) notes.push(`شامل تغییر در: ${rels.join("، ")}`);
    }
    if (changes && operation === "update") notes.unshift(Object.keys(changes).join("، "));
    // FULL: ذخیره‌ای که هیچ فیلدی را عوض نکرده نویز است
    if (cfg.level === "FULL" && operation === "update" && pre?.before && changes === null && !notes.length) return;
    const baseSummary = many ? `${typeof result?.count === "number" ? result.count : "؟"} رکورد` : null;
    const row: AuditRow = {
      at: new Date(),
      userId: ctx?.userId ?? null,
      kind: "CHANGE",
      action,
      model,
      recordId: !many && result && result.id !== undefined && result.id !== null ? String(result.id) : null,
      summary: [baseSummary, ...notes].filter(Boolean).join(" — ").slice(0, 300) || null,
      changes: changes ?? undefined,
      ip: ctx?.ip ?? null,
    };
    const buf = ctx?.shared?.auditBuffer;
    if (buf) buf.push(row);
    else await writeAuditRows([row]);
  } catch (e) {
    console.error("[audit] ثبت تغییر ناموفق بود", (e as Error).message);
  }
}

/** رویداد صریح (ورود، تایید، بستن سال، …). فوری نوشته می‌شود (نه بافر) چون خودش نتیجه‌ی یک عملِ انجام‌شده است. */
export async function recordAuditEvent(e: { kind?: "EVENT" | "AUTH"; action: string; summary?: string | null; userId?: number | null; model?: string | null; recordId?: string | number | null; ip?: string | null }): Promise<void> {
  try {
    const cfg = await getAuditConfig();
    if (!cfg.active) return;
    const ctx = getRequestContext();
    await writeAuditRows([
      {
        at: new Date(),
        userId: e.userId !== undefined ? e.userId : ctx?.userId ?? null,
        kind: e.kind ?? "EVENT",
        action: e.action,
        model: e.model ?? null,
        recordId: e.recordId === undefined || e.recordId === null ? null : String(e.recordId),
        summary: e.summary ?? null,
        ip: e.ip !== undefined ? e.ip : ctx?.ip ?? null,
      },
    ]);
  } catch (err) {
    console.error("[audit] ثبت رویداد ناموفق بود", (err as Error).message);
  }
}

/** رویداد صریح داخل درخواست: در بافر می‌ماند و فقط با پاسخ موفق (< 400) نوشته می‌شود (بیرون از درخواست فوری). برای عملیات حالت‌دار مثل بستن سال/تایید/صدور */
export async function queueAuditEvent(e: { action: string; summary?: string | null; model?: string | null; recordId?: string | number | null }): Promise<void> {
  try {
    const cfg = await getAuditConfig();
    if (!cfg.active) return;
    const ctx = getRequestContext();
    const row: AuditRow = {
      at: new Date(),
      userId: ctx?.userId ?? null,
      kind: "EVENT",
      action: e.action,
      model: e.model ?? null,
      recordId: e.recordId === undefined || e.recordId === null ? null : String(e.recordId),
      summary: e.summary ?? null,
      ip: ctx?.ip ?? null,
    };
    const buf = ctx?.shared?.auditBuffer;
    if (buf) buf.push(row);
    else await writeAuditRows([row]);
  } catch (err) {
    console.error("[audit] ثبت رویداد ناموفق بود", (err as Error).message);
  }
}

/** بافر یک درخواست را می‌نویسد (فقط وقتی پاسخ موفق بود از middleware صدا زده می‌شود) */
export async function flushAuditBuffer(buffer: AuditRow[]) {
  if (!buffer.length) return;
  const rows = buffer.splice(0, buffer.length);
  await writeAuditRows(rows);
}

// ─── schema، partition و نگهداری ───────────────────────────────────────────────────────────────────────────────────────────────

export async function ensureAuditSchema() {
  for (const sql of AUDIT_SCHEMA_SQL) await rawPrisma.$executeRawUnsafe(sql);
}

const pad2 = (n: number) => String(n).padStart(2, "0");
const monthKey = (y: number, m0: number) => `${y}${pad2(m0 + 1)}`;
const monthStartUtc = (y: number, m0: number) => new Date(Date.UTC(y, m0, 1));

/** partition ماه جاری و چند ماه بعد را می‌سازد (partition پیش‌فرض بقیه را می‌گیرد؛ ساخت partition وقتی ردیفی از همان بازه در default مانده باشد خطا می‌دهد و فقط لاگ می‌شود) */
export async function ensureAuditPartitions(monthsAhead = 2) {
  const now = new Date();
  for (let i = 0; i <= monthsAhead; i++) {
    const y = now.getUTCFullYear() + Math.floor((now.getUTCMonth() + i) / 12);
    const m0 = (now.getUTCMonth() + i) % 12;
    const from = monthStartUtc(y, m0);
    const to = monthStartUtc(m0 === 11 ? y + 1 : y, (m0 + 1) % 12);
    const name = `audit.event_${monthKey(y, m0)}`;
    try {
      await rawPrisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS ${name} PARTITION OF audit.event FOR VALUES FROM ('${from.toISOString()}') TO ('${to.toISOString()}')`);
    } catch (e) {
      console.error(`[audit] ساخت partition ${name} ناموفق بود`, (e as Error).message);
    }
  }
}

interface PartitionInfo {
  name: string;
  sizeBytes: number;
  /** null = partition پیش‌فرض */
  upper: Date | null;
}

async function listPartitions(): Promise<PartitionInfo[]> {
  const rows = await rawPrisma.$queryRaw<{ name: string; size: bigint }[]>`
    SELECT c.relname AS name, pg_total_relation_size(c.oid) AS size
    FROM pg_inherits i JOIN pg_class c ON c.oid = i.inhrelid JOIN pg_class p ON p.oid = i.inhparent JOIN pg_namespace n ON n.oid = p.relnamespace
    WHERE n.nspname = 'audit' AND p.relname = 'event'`;
  return rows
    .map((r) => {
      const m = /^event_(\d{4})(\d{2})$/.exec(r.name);
      return { name: r.name, sizeBytes: Number(r.size), upper: m ? monthStartUtc(Number(m[2]) === 12 ? Number(m[1]) + 1 : Number(m[1]), Number(m[2]) % 12) : null };
    })
    .sort((a, b) => (a.upper?.getTime() ?? Infinity) - (b.upper?.getTime() ?? Infinity));
}

export interface AuditUsage {
  sizeBytes: number;
  rows: number;
  oldestAt: string | null;
  newestAt: string | null;
  partitions: number;
}

export async function getAuditUsage(): Promise<AuditUsage> {
  const parts = await listPartitions();
  const size = parts.reduce((s, p) => s + p.sizeBytes, 0);
  const r = await rawPrisma.$queryRaw<{ n: bigint; mn: Date | null; mx: Date | null }[]>`SELECT count(*)::bigint AS n, min(at) AS mn, max(at) AS mx FROM audit.event`;
  return { sizeBytes: size, rows: Number(r[0]?.n ?? 0), oldestAt: r[0]?.mn ? r[0].mn.toISOString() : null, newestAt: r[0]?.mx ? r[0].mx.toISOString() : null, partitions: parts.length };
}

let maintaining = false;
/**
 * نگهداری روزانه: partitionهای آینده؛ حذف partitionهای قدیمی‌تر از مدت نگهداری مؤثر؛ و اگر حجم از سقف لایسنس گذشت، حذف قدیمی‌ترین partition (هرگز ماه جاری را کامل نمی‌پاشد؛
 * اگر فقط ماه جاری مانده و هنوز بالاتر از سقف است، قدیمی‌ترین ۲۵٪ ردیف‌های آن حذف می‌شود). خلاصه‌ی کار در AuditSetting ذخیره و در /management نشان داده می‌شود.
 */
export async function maintainAudit(override?: { retentionDays?: number; maxStorageMB?: number }): Promise<string> {
  if (maintaining) return "نگهداری لاگ در حال اجراست";
  maintaining = true;
  try {
    await ensureAuditSchema();
    await ensureAuditPartitions();
    const cfg = { ...(await getAuditConfig()) };
    if (override?.retentionDays) cfg.retentionDays = override.retentionDays;
    if (override?.maxStorageMB) cfg.maxStorageMB = override.maxStorageMB;
    const notes: string[] = [];
    if (cfg.licensed) {
      const cutoff = new Date(Date.now() - cfg.retentionDays * 86_400_000);
      let parts = await listPartitions();
      for (const p of parts) {
        if (p.upper && p.upper.getTime() <= cutoff.getTime()) {
          await rawPrisma.$executeRawUnsafe(`DROP TABLE IF EXISTS audit.${p.name}`);
          notes.push(`partition ${p.name} (قدیمی‌تر از ${cfg.retentionDays} روز) حذف شد`);
        }
      }
      await rawPrisma.$executeRaw`DELETE FROM audit.event_default WHERE at < ${cutoff}`;
      if (cfg.maxStorageMB) {
        const capBytes = cfg.maxStorageMB * 1024 * 1024;
        parts = await listPartitions();
        let total = parts.reduce((s, p) => s + p.sizeBytes, 0);
        const monthly = parts.filter((p) => p.upper);
        const nowD = new Date();
        const currentUpper = monthStartUtc(nowD.getUTCMonth() === 11 ? nowD.getUTCFullYear() + 1 : nowD.getUTCFullYear(), (nowD.getUTCMonth() + 1) % 12).getTime();
        while (total > capBytes && monthly.length) {
          const oldest = monthly[0];
          if (oldest.upper!.getTime() >= currentUpper) {
            // فقط ماه جاری (و آینده) مانده
            await rawPrisma.$executeRawUnsafe(
              `DELETE FROM audit.${oldest.name} WHERE id IN (SELECT id FROM audit.${oldest.name} ORDER BY at ASC LIMIT (SELECT GREATEST(count(*) / 4, 1) FROM audit.${oldest.name}))`
            );
            notes.push(`سقف حجم (${cfg.maxStorageMB} مگابایت) پر شد؛ قدیمی‌ترین ردیف‌های ${oldest.name} حذف شد`);
            break;
          }
          monthly.shift();
          await rawPrisma.$executeRawUnsafe(`DROP TABLE IF EXISTS audit.${oldest.name}`);
          total -= oldest.sizeBytes;
          notes.push(`سقف حجم (${cfg.maxStorageMB} مگابایت) پر شد؛ partition ${oldest.name} حذف شد`);
        }
      }
    } else {
      notes.push("لایسنس لاگ تغییرات ندارد؛ فقط ساختار نگهداری می‌شود");
    }
    const msg = notes.length ? notes.join(" — ") : "نگهداری انجام شد؛ چیزی برای حذف نبود";
    await rawPrisma.auditSetting.upsert({
      where: { id: 1 },
      update: { lastMaintenanceAt: new Date(), lastMaintenanceMessage: msg },
      create: { id: 1, lastMaintenanceAt: new Date(), lastMaintenanceMessage: msg },
    });
    return msg;
  } finally {
    maintaining = false;
  }
}

export interface AuditSettingInput {
  enabled: boolean;
  level: "BASIC" | "FULL";
  retentionDays: number;
}

export class AuditError extends Error {}

/** تنظیم مشتری را ذخیره می‌کند؛ بیرون از سقف لایسنس رد می‌شود */
export async function saveAuditSetting(input: AuditSettingInput, userNote?: string) {
  const ent = await entitlement();
  if (!ent.licensed) throw new AuditError("لایسنس این نصب «لاگ تغییرات» ندارد");
  if (input.level !== "BASIC" && input.level !== "FULL") throw new AuditError("سطح لاگ نامعتبر است");
  if (input.level === "FULL" && ent.level === "BASIC") throw new AuditError("لایسنس شما فقط سطح «سبک» را مجاز می‌کند");
  if (!(Number.isInteger(input.retentionDays) && input.retentionDays >= 1)) throw new AuditError("مدت نگهداری باید عدد صحیح مثبت (روز) باشد");
  if (ent.maxRetentionDays && input.retentionDays > ent.maxRetentionDays) throw new AuditError(`مدت نگهداری حداکثر ${ent.maxRetentionDays} روز مجاز است (سقف لایسنس)`);
  await rawPrisma.auditSetting.upsert({
    where: { id: 1 },
    update: { enabled: !!input.enabled, level: input.level, retentionDays: input.retentionDays },
    create: { id: 1, enabled: !!input.enabled, level: input.level, retentionDays: input.retentionDays },
  });
  invalidateAuditConfig();
  // تغییر خودِ تنظیم همیشه ثبت می‌شود (اگر لاگ روشن شده باشد)
  await ensureAuditSchema();
  const cfg = await getAuditConfig();
  if (cfg.active) {
    await writeAuditRows([{ at: new Date(), userId: null, kind: "EVENT", action: "AUDIT_SETTING_CHANGED", model: null, recordId: null, summary: `روشن=${input.enabled} سطح=${input.level} نگهداری=${input.retentionDays} روز${userNote ? ` — ${userNote}` : ""}`, ip: null }]);
  }
}

export async function latestAuditEvents(limit = 100) {
  const n = Math.min(Math.max(Math.floor(limit) || 100, 1), 500);
  const rows = await rawPrisma.$queryRaw<
    { id: bigint; at: Date; userId: number | null; userName: string | null; kind: string; action: string; model: string | null; recordId: string | null; summary: string | null; changes: Record<string, [unknown, unknown]> | null; ip: string | null }[]
  >`SELECT id, at, "userId", "userName", kind, action, model, "recordId", summary, changes, ip FROM audit.event ORDER BY at DESC, id DESC LIMIT ${n}`;
  return rows.map((r) => ({ ...r, id: Number(r.id), at: r.at.toISOString(), modelTitle: r.model ? AUDITED_MODELS[r.model] ?? r.model : null }));
}

// ─── زمان‌سنج نگهداری ──────────────────────────────────────────────────────────────────────────────────────────────────────────

export async function startAuditScheduler() {
  try {
    await ensureAuditSchema();
    await ensureAuditPartitions();
  } catch (e) {
    console.error("[audit] آماده‌سازی schema لاگ ناموفق بود", (e as Error).message);
  }
  const tick = () => maintainAudit().catch((e) => console.error("[audit] نگهداری ناموفق بود", (e as Error).message));
  setTimeout(tick, 60_000).unref();
  setInterval(tick, 6 * 60 * 60_000).unref();
}
