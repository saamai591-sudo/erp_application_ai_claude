import crypto from "crypto";
import { prisma } from "../lib/prisma";
import { toEnglishDigits } from "../utils/digits";
import { displayDate } from "../utils/dateDisplay";
import { getPeriods, periodContains } from "./employmentStatusService";
import { AttendanceError, calculatedRanges, dateLocked, minuteText } from "./attendancePunchService";

// مدیریت تردد › دریافت خودکار از سیستم‌های کارت‌ساعت. تنها جای قواعد: اتصال/توکن، نگاشت شناسه‌ی دستگاه ← کارمند، پذیرش دسته‌ای ثبت‌ها و پردازش «صندوق دریافت».
//  • «عامل تردد» (برنامه‌ی ویندوزی کنار دیتابیس کارت‌ساعت) فقط شناسه‌ی خام کاربرِ دستگاه + تاریخ + ساعت را می‌فرستد؛ نگاشت به کارمند همین‌جا و در ERP انجام می‌شود.
//  • هر ثبت یک بار در AttendanceDeviceInbox نگه‌داری می‌شود (یکتا: اتصال + شناسه + روز + دقیقه) پس ارسال دوباره‌ی همان داده بی‌اثر است.
//  • پردازش: شناسه ← کارمند (نگاشت دستی؛ اگر نبود، برابری با کد پرسنلی)، روز داخل دوره‌ی همکاری، ماه قفل‌شده با «محاسبه تردد» نباشد؛ بعد AttendancePunch با منبع DEVICE ساخته می‌شود.
//    نگاشت‌نشده ⇒ PENDING_MAPPING (گم نمی‌شود)، ردشده ⇒ REJECTED با دلیل؛ هر دو با «پردازش مجدد» (یا خودکار پس از ثبت نگاشت) دوباره امتحان می‌شوند.
//  • ترددی که کاربر دستی حذف کند با ارسال دوباره ساخته نمی‌شود (ثبت صندوق «پذیرفته‌شده» می‌ماند).

const MAX_ITEMS_PER_CALL = 5000;
const MAX_REPROCESS = 20000;

export const hashToken = (t: string) => crypto.createHash("sha256").update(t).digest("hex");
const newToken = () => `atd_${crypto.randomBytes(32).toString("base64url")}`;

const INBOX_STATUS_FA: Record<string, string> = { ACCEPTED: "پذیرفته‌شده", PENDING_MAPPING: "در انتظار نگاشت", REJECTED: "ردشده" };

// ── اتصال‌ها ──

const connShape = (c: any, extra: object = {}) => ({
  id: c.id,
  name: c.name,
  isActive: c.isActive,
  description: c.description ?? "",
  tokenHint: c.tokenHint,
  lastReceivedAt: c.lastReceivedAt,
  updatedAt: c.updatedAt,
  ...extra,
});

export async function listConnections() {
  const [rows, pending, rejected, mapped] = await Promise.all([
    prisma.attendanceDeviceConnection.findMany({ orderBy: { name: "asc" } }),
    prisma.attendanceDeviceInbox.groupBy({ by: ["connectionId"], where: { status: "PENDING_MAPPING" }, _count: { _all: true } }),
    prisma.attendanceDeviceInbox.groupBy({ by: ["connectionId"], where: { status: "REJECTED" }, _count: { _all: true } }),
    prisma.attendanceDeviceMapping.groupBy({ by: ["connectionId"], _count: { _all: true } }),
  ]);
  const cnt = (arr: { connectionId: number; _count: { _all: number } }[], id: number) => arr.find((x) => x.connectionId === id)?._count._all ?? 0;
  return rows.map((c) => connShape(c, { pendingCount: cnt(pending, c.id), rejectedCount: cnt(rejected, c.id), mappingCount: cnt(mapped, c.id) }));
}

export async function getConnection(id: number) {
  const c = await prisma.attendanceDeviceConnection.findUnique({ where: { id } });
  if (!c) throw new AttendanceError("اتصال یافت نشد");
  return connShape(c);
}

function cleanConnection(body: any) {
  const name = String(body?.name ?? "").trim();
  if (!name) throw new AttendanceError("نام اتصال الزامی است");
  if (name.length > 100) throw new AttendanceError("نام اتصال حداکثر ۱۰۰ نویسه است");
  const description = typeof body?.description === "string" && body.description.trim() ? body.description.trim().slice(0, 500) : null;
  return { name, description, isActive: body?.isActive !== false };
}

/** ساخت اتصال؛ متن توکن فقط همین یک بار برگردانده می‌شود */
export async function createConnection(body: any, userId: number | null) {
  const d = cleanConnection(body);
  if (await prisma.attendanceDeviceConnection.findUnique({ where: { name: d.name } })) throw new AttendanceError(`اتصالی با نام «${d.name}» قبلاً تعریف شده است`);
  const token = newToken();
  const c = await prisma.attendanceDeviceConnection.create({ data: { ...d, tokenHash: hashToken(token), tokenHint: token.slice(-4), createdById: userId } });
  return { connection: connShape(c), token };
}

export async function updateConnection(id: number, body: any) {
  const d = cleanConnection(body);
  const dup = await prisma.attendanceDeviceConnection.findFirst({ where: { name: d.name, NOT: { id } }, select: { id: true } });
  if (dup) throw new AttendanceError(`اتصالی با نام «${d.name}» قبلاً تعریف شده است`);
  await prisma.attendanceDeviceConnection.update({ where: { id }, data: d });
}

/** توکن قبلی بی‌اعتبار می‌شود؛ عامل باید با توکن تازه تنظیم شود */
export async function regenerateToken(id: number) {
  const token = newToken();
  await prisma.attendanceDeviceConnection.update({ where: { id }, data: { tokenHash: hashToken(token), tokenHint: token.slice(-4) } });
  return token;
}

export async function deleteConnection(id: number) {
  const accepted = await prisma.attendanceDeviceInbox.count({ where: { connectionId: id, status: "ACCEPTED" } });
  if (accepted > 0) throw new AttendanceError(`از این اتصال ${accepted} تردد دریافت و ثبت شده است؛ به‌جای حذف، آن را غیرفعال کنید`);
  await prisma.attendanceDeviceConnection.delete({ where: { id } });
}

export async function findConnectionByToken(token: string) {
  if (!token) return null;
  return prisma.attendanceDeviceConnection.findUnique({ where: { tokenHash: hashToken(token) } });
}

// ── نگاشت شناسه ← کارمند ──

const cleanDeviceUserId = (v: unknown): string => toEnglishDigits(String(v ?? "").trim()).slice(0, 100);

const empText = (e: { personnelCode: string; party: { firstName: string | null; lastName: string | null; name: string | null } }) =>
  `${e.personnelCode} — ${[e.party.firstName, e.party.lastName].filter(Boolean).join(" ") || e.party.name || ""}`;

export async function listMappings(connectionId?: number) {
  const rows = await prisma.attendanceDeviceMapping.findMany({
    where: connectionId ? { connectionId } : {},
    include: { connection: { select: { name: true } }, employee: { select: { personnelCode: true, party: { select: { firstName: true, lastName: true, name: true } } } } },
    orderBy: [{ connectionId: "asc" }, { deviceUserId: "asc" }],
  });
  return rows.map(mappingShape);
}

const mappingShape = (m: any) => ({
  id: m.id,
  connectionId: m.connectionId,
  connectionName: m.connection.name,
  deviceUserId: m.deviceUserId,
  employeeId: m.employeeId,
  personnelCode: m.employee.personnelCode,
  employeeName: [m.employee.party.firstName, m.employee.party.lastName].filter(Boolean).join(" ") || m.employee.party.name || "",
  updatedAt: m.updatedAt,
});

export async function getMapping(id: number) {
  const m = await prisma.attendanceDeviceMapping.findUnique({
    where: { id },
    include: { connection: { select: { name: true } }, employee: { select: { personnelCode: true, party: { select: { firstName: true, lastName: true, name: true } } } } },
  });
  if (!m) throw new AttendanceError("نگاشت یافت نشد");
  return mappingShape(m);
}

async function checkMapping(connectionId: number, deviceUserIdRaw: unknown, employeeId: unknown, excludeId?: number) {
  const deviceUserId = cleanDeviceUserId(deviceUserIdRaw);
  if (!deviceUserId) throw new AttendanceError("شناسه‌ی کاربر در دستگاه الزامی است");
  const conn = await prisma.attendanceDeviceConnection.findUnique({ where: { id: connectionId }, select: { id: true } });
  if (!conn) throw new AttendanceError("اتصال یافت نشد");
  const emp = await prisma.employee.findUnique({ where: { id: Number(employeeId) }, select: { id: true } });
  if (!emp) throw new AttendanceError("کارمند یافت نشد");
  const dup = await prisma.attendanceDeviceMapping.findFirst({
    where: { connectionId, deviceUserId, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
    include: { employee: { select: { personnelCode: true, party: { select: { firstName: true, lastName: true, name: true } } } } },
  });
  if (dup) throw new AttendanceError(`شناسه‌ی «${deviceUserId}» در این اتصال قبلاً به ${empText(dup.employee)} نگاشت شده است`);
  return { deviceUserId, employeeId: emp.id };
}

/** ثبت نگاشت + پردازش خودکار ثبت‌های در انتظارِ همان شناسه */
export async function createMapping(connectionId: number, deviceUserId: unknown, employeeId: unknown, userId: number | null) {
  const d = await checkMapping(connectionId, deviceUserId, employeeId);
  const m = await prisma.attendanceDeviceMapping.create({ data: { connectionId, ...d, createdById: userId } });
  const processed = await reprocess({ connectionId, deviceUserId: d.deviceUserId });
  return { id: m.id, processed };
}

export async function updateMapping(id: number, body: any) {
  const cur = await prisma.attendanceDeviceMapping.findUnique({ where: { id } });
  if (!cur) throw new AttendanceError("نگاشت یافت نشد");
  const connectionId = Number(body?.connectionId ?? cur.connectionId);
  const d = await checkMapping(connectionId, body?.deviceUserId ?? cur.deviceUserId, body?.employeeId ?? cur.employeeId, id);
  await prisma.attendanceDeviceMapping.update({ where: { id }, data: { connectionId, ...d } });
  return { processed: await reprocess({ connectionId, deviceUserId: d.deviceUserId }) };
}

export async function deleteMapping(id: number) {
  await prisma.attendanceDeviceMapping.delete({ where: { id } });
}

// ── پذیرش و پردازش ──

export interface RawPunch {
  deviceUserId?: unknown;
  date?: unknown;
  time?: unknown;
  minute?: unknown;
  deviceName?: unknown;
}
interface CleanPunch {
  deviceUserId: string;
  date: Date;
  minute: number;
  deviceName: string | null;
}

/** ساعتِ «HH:mm» (یا «HH:mm:ss») یا دقیقه‌ی عددی → دقیقه‌ی روز */
function parseMinuteValue(time: unknown, minute: unknown): number | null {
  if (minute !== undefined && minute !== null && minute !== "") {
    const n = Number(minute);
    return Number.isInteger(n) && n >= 0 && n <= 1439 ? n : null;
  }
  const m = toEnglishDigits(String(time ?? "").trim()).match(/^(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/);
  if (!m) return null;
  const h = Number(m[1]), mm = Number(m[2]);
  return h <= 23 && mm <= 59 ? h * 60 + mm : null;
}

function cleanPunchItem(raw: RawPunch): CleanPunch | string {
  const deviceUserId = cleanDeviceUserId(raw?.deviceUserId);
  if (!deviceUserId) return "شناسه‌ی کاربر خالی است";
  const dateText = toEnglishDigits(String(raw?.date ?? "").trim()).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) return "تاریخ باید به شکل YYYY-MM-DD (میلادی) باشد";
  const date = new Date(`${dateText}T00:00:00.000Z`);
  if (isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== dateText) return "تاریخ نامعتبر است";
  const minute = parseMinuteValue(raw?.time, raw?.minute);
  if (minute === null) return "ساعت باید به شکل HH:mm باشد";
  const deviceName = typeof raw?.deviceName === "string" && raw.deviceName.trim() ? raw.deviceName.trim().slice(0, 100) : null;
  return { deviceUserId, date, minute, deviceName };
}

const keyOf = (deviceUserId: string, date: Date, minute: number) => `${deviceUserId}|${date.toISOString().slice(0, 10)}|${minute}`;

export interface IngestResult {
  received: number;
  newRows: number;
  duplicates: number;
  accepted: number;
  pending: number;
  rejected: number;
  invalid: { index: number; error: string }[];
}

/** پذیرش دسته‌ی ثبت‌ها از عامل: ثبت در صندوق دریافت (فقط ثبت‌های تازه) و پردازش همان‌ها */
export async function ingest(connection: { id: number; name: string }, rawItems: unknown): Promise<IngestResult> {
  if (!Array.isArray(rawItems)) throw new AttendanceError("فهرست ثبت‌ها (punches) الزامی است");
  if (rawItems.length > MAX_ITEMS_PER_CALL) throw new AttendanceError(`در هر ارسال حداکثر ${MAX_ITEMS_PER_CALL} ثبت پذیرفته می‌شود`);
  const result: IngestResult = { received: rawItems.length, newRows: 0, duplicates: 0, accepted: 0, pending: 0, rejected: 0, invalid: [] };

  const clean = new Map<string, CleanPunch>();
  rawItems.forEach((raw, index) => {
    const c = cleanPunchItem(raw as RawPunch);
    if (typeof c === "string") {
      if (result.invalid.length < 100) result.invalid.push({ index, error: c });
      return;
    }
    const k = keyOf(c.deviceUserId, c.date, c.minute);
    if (clean.has(k)) result.duplicates++;
    else clean.set(k, c);
  });
  const items = [...clean.values()];

  if (items.length > 0) {
    const ids = [...new Set(items.map((i) => i.deviceUserId))];
    const dates = items.map((i) => i.date.getTime());
    const existing = await prisma.attendanceDeviceInbox.findMany({
      where: { connectionId: connection.id, deviceUserId: { in: ids }, date: { gte: new Date(Math.min(...dates)), lte: new Date(Math.max(...dates)) } },
      select: { deviceUserId: true, date: true, minute: true },
    });
    const have = new Set(existing.map((e) => keyOf(e.deviceUserId, e.date, e.minute)));
    const fresh = items.filter((i) => !have.has(keyOf(i.deviceUserId, i.date, i.minute)));
    result.duplicates += items.length - fresh.length;
    result.newRows = fresh.length;

    if (fresh.length > 0) {
      await prisma.attendanceDeviceInbox.createMany({
        data: fresh.map((i) => ({ connectionId: connection.id, deviceUserId: i.deviceUserId, date: i.date, minute: i.minute, deviceName: i.deviceName })),
        skipDuplicates: true,
      });
      const freshKeys = new Set(fresh.map((i) => keyOf(i.deviceUserId, i.date, i.minute)));
      const rows = (
        await prisma.attendanceDeviceInbox.findMany({
          where: { connectionId: connection.id, deviceUserId: { in: ids }, date: { gte: new Date(Math.min(...dates)), lte: new Date(Math.max(...dates)) }, status: "PENDING_MAPPING", processedAt: null },
        })
      ).filter((r) => freshKeys.has(keyOf(r.deviceUserId, r.date, r.minute)));
      const counts = await processRows(rows, connection.name);
      result.accepted = counts.accepted;
      result.pending = counts.pending;
      result.rejected = counts.rejected;
    }
  }
  await prisma.attendanceDeviceConnection.update({ where: { id: connection.id }, data: { lastReceivedAt: new Date() } });
  return result;
}

interface InboxRow {
  id: number;
  connectionId: number;
  deviceUserId: string;
  date: Date;
  minute: number;
  deviceName: string | null;
}
export interface ProcessCounts {
  accepted: number;
  pending: number;
  rejected: number;
}

/** نگاشت (دستی ← برابری با کد پرسنلی) برای چند اتصال */
async function employeeResolver(connectionIds: number[]) {
  const [maps, emps] = await Promise.all([
    prisma.attendanceDeviceMapping.findMany({ where: { connectionId: { in: connectionIds } }, select: { connectionId: true, deviceUserId: true, employeeId: true } }),
    prisma.employee.findMany({ select: { id: true, personnelCode: true } }),
  ]);
  const manual = new Map(maps.map((m) => [`${m.connectionId}|${m.deviceUserId}`, m.employeeId]));
  const byCode = new Map<string, number>();
  const byNumber = new Map<number, number | null>(); // برابری عددی (صفرهای ابتدای شناسه) فقط وقتی یکتا باشد
  for (const e of emps) {
    const code = toEnglishDigits(e.personnelCode.trim());
    byCode.set(code, e.id);
    if (/^\d+$/.test(code)) byNumber.set(Number(code), byNumber.has(Number(code)) ? null : e.id);
  }
  return (connectionId: number, deviceUserId: string): number | null => {
    const hit = manual.get(`${connectionId}|${deviceUserId}`);
    if (hit) return hit;
    const direct = byCode.get(deviceUserId);
    if (direct) return direct;
    if (/^\d+$/.test(deviceUserId)) return byNumber.get(Number(deviceUserId)) ?? null;
    return null;
  };
}

/** ثبت‌های صندوق را به تردد تبدیل می‌کند و وضعیت هر ردیف را می‌نویسد */
async function processRows(rows: InboxRow[], connectionName?: string): Promise<ProcessCounts> {
  const counts: ProcessCounts = { accepted: 0, pending: 0, rejected: 0 };
  if (rows.length === 0) return counts;
  const connIds = [...new Set(rows.map((r) => r.connectionId))];
  const resolve = await employeeResolver(connIds);
  const names = new Map<number, string>();
  if (connectionName && connIds.length === 1) names.set(connIds[0], connectionName);
  else for (const c of await prisma.attendanceDeviceConnection.findMany({ where: { id: { in: connIds } }, select: { id: true, name: true } })) names.set(c.id, c.name);

  const employeeIds = new Set<number>();
  const resolved = rows.map((r) => {
    const employeeId = resolve(r.connectionId, r.deviceUserId);
    if (employeeId) employeeIds.add(employeeId);
    return { r, employeeId };
  });
  const periods = new Map<number, Awaited<ReturnType<typeof getPeriods>>>();
  for (const id of employeeIds) periods.set(id, await getPeriods(id));
  const locks = await calculatedRanges([...employeeIds]);

  const done = new Date();
  for (const { r, employeeId } of resolved) {
    let data: { status: "ACCEPTED" | "PENDING_MAPPING" | "REJECTED"; reason: string | null; employeeId: number | null; punchId: number | null };
    if (!employeeId) {
      data = { status: "PENDING_MAPPING", reason: "شناسه‌ی دستگاه به کارمندی نگاشت نشده است", employeeId: null, punchId: null };
    } else if (!periodContains(periods.get(employeeId) ?? [], r.date)) {
      data = { status: "REJECTED", reason: `کارمند در تاریخ ${displayDate(r.date)} در دوره‌ی همکاری نیست`, employeeId, punchId: null };
    } else if (dateLocked(locks.get(employeeId), r.date)) {
      data = { status: "REJECTED", reason: `محاسبات تردد ماهِ ${displayDate(r.date)} برای این کارمند انجام شده و قفل است`, employeeId, punchId: null };
    } else {
      const description = `دستگاه: ${names.get(r.connectionId) ?? ""}${r.deviceName ? ` / ${r.deviceName}` : ""}`;
      let punchId: number | null = null;
      let reason: string | null = null;
      try {
        punchId = (await prisma.attendancePunch.create({ data: { employeeId, date: r.date, minute: r.minute, source: "DEVICE", description } })).id;
      } catch (e: any) {
        if (e?.code !== "P2002") throw e;
        const same = await prisma.attendancePunch.findUnique({ where: { employeeId_date_minute: { employeeId, date: r.date, minute: r.minute } }, select: { id: true } });
        punchId = same?.id ?? null;
        reason = `ترددی در ساعت ${minuteText(r.minute)} از قبل ثبت شده بود`;
      }
      data = { status: "ACCEPTED", reason, employeeId, punchId };
    }
    await prisma.attendanceDeviceInbox.update({ where: { id: r.id }, data: { ...data, processedAt: done } });
    if (data.status === "ACCEPTED") counts.accepted++;
    else if (data.status === "PENDING_MAPPING") counts.pending++;
    else counts.rejected++;
  }
  return counts;
}

export interface ReprocessFilter {
  connectionId?: number;
  deviceUserId?: string;
  ids?: number[];
}

/** ثبت‌های «در انتظار نگاشت» و «ردشده» را دوباره پردازش می‌کند (پس از ثبت نگاشت/رفع علت رد) */
export async function reprocess(f: ReprocessFilter): Promise<ProcessCounts> {
  const rows = await prisma.attendanceDeviceInbox.findMany({
    where: {
      status: { in: ["PENDING_MAPPING", "REJECTED"] },
      ...(f.connectionId ? { connectionId: f.connectionId } : {}),
      ...(f.deviceUserId ? { deviceUserId: f.deviceUserId } : {}),
      ...(f.ids ? { id: { in: f.ids } } : {}),
    },
    orderBy: [{ date: "asc" }, { minute: "asc" }],
    take: MAX_REPROCESS,
    select: { id: true, connectionId: true, deviceUserId: true, date: true, minute: true, deviceName: true },
  });
  return processRows(rows);
}

// ── گزارش صندوق ──

export async function inboxPage(q: { connectionId?: number; status?: string; from?: Date; to?: Date; deviceUserId?: string; page: number; pageSize: number }) {
  const where: any = {
    ...(q.connectionId ? { connectionId: q.connectionId } : {}),
    ...(q.status && ["ACCEPTED", "PENDING_MAPPING", "REJECTED"].includes(q.status) ? { status: q.status } : {}),
    ...(q.deviceUserId ? { deviceUserId: q.deviceUserId } : {}),
    ...(q.from || q.to ? { date: { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lte: q.to } : {}) } } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.attendanceDeviceInbox.count({ where }),
    prisma.attendanceDeviceInbox.findMany({
      where,
      include: { connection: { select: { name: true } }, employee: { select: { personnelCode: true, party: { select: { firstName: true, lastName: true, name: true } } } } },
      orderBy: [{ date: "desc" }, { minute: "desc" }, { id: "desc" }],
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
  ]);
  return {
    total,
    rows: rows.map((r) => ({
      id: r.id,
      connectionId: r.connectionId,
      connectionName: r.connection.name,
      deviceUserId: r.deviceUserId,
      deviceName: r.deviceName ?? "",
      date: r.date.toISOString().slice(0, 10),
      time: minuteText(r.minute),
      status: r.status,
      statusTitle: INBOX_STATUS_FA[r.status] ?? r.status,
      reason: r.reason ?? "",
      employeeId: r.employeeId,
      personnelCode: r.employee?.personnelCode ?? "",
      employeeName: r.employee ? [r.employee.party.firstName, r.employee.party.lastName].filter(Boolean).join(" ") || r.employee.party.name || "" : "",
      punchId: r.punchId,
      receivedAt: r.receivedAt,
    })),
  };
}

/** شناسه‌هایی که ثبت در انتظار نگاشت دارند (برای تکمیل نگاشت از همان‌جا) */
export async function unmappedIds(connectionId?: number) {
  const g = await prisma.attendanceDeviceInbox.groupBy({
    by: ["connectionId", "deviceUserId"],
    where: { status: "PENDING_MAPPING", ...(connectionId ? { connectionId } : {}) },
    _count: { _all: true },
    _min: { date: true },
    _max: { date: true },
  });
  const names = new Map((await prisma.attendanceDeviceConnection.findMany({ select: { id: true, name: true } })).map((c) => [c.id, c.name]));
  const deviceNames = await prisma.attendanceDeviceInbox.findMany({
    where: { status: "PENDING_MAPPING", deviceName: { not: null }, ...(connectionId ? { connectionId } : {}) },
    distinct: ["connectionId", "deviceUserId"],
    select: { connectionId: true, deviceUserId: true, deviceName: true },
  });
  const dn = new Map(deviceNames.map((d) => [`${d.connectionId}|${d.deviceUserId}`, d.deviceName ?? ""]));
  return g
    .map((x) => ({
      connectionId: x.connectionId,
      connectionName: names.get(x.connectionId) ?? "",
      deviceUserId: x.deviceUserId,
      deviceName: dn.get(`${x.connectionId}|${x.deviceUserId}`) ?? "",
      count: x._count._all,
      firstDate: x._min.date?.toISOString().slice(0, 10) ?? null,
      lastDate: x._max.date?.toISOString().slice(0, 10) ?? null,
    }))
    .sort((a, b) => b.count - a.count);
}

/** حذف ثبت‌های ردشده/در انتظار (پذیرفته‌شده‌ها حذف نمی‌شوند) */
export async function deleteInboxRows(ids: number[]) {
  const r = await prisma.attendanceDeviceInbox.deleteMany({ where: { id: { in: ids }, status: { in: ["PENDING_MAPPING", "REJECTED"] } } });
  return r.count;
}
