import { createHash, randomBytes } from "crypto";
import { prisma } from "../lib/prisma";
import { StoreSaleError } from "./storeSaleService";
import { AGENT_ONLINE_MS, DriverResult, applyResult, expireStale } from "./cardTerminalService";

// «عامل محلی کارتخوان» (agent) — مدیریت (CRUD + توکن) و پروتکل agent ⇄ سرور. تنها محل قواعد.
// • agent برنامه‌ای روی کامپیوتر محل است که فقط اتصال خروجی به سرور دارد: هر چند ثانیه poll می‌کند (ضربان قلب = lastSeenAt)، دستورهای QUEUED خودش را برمی‌دارد (CLAIMED)،
//   به دستگاه می‌فرستد و نتیجه‌ی نهایی را گزارش می‌دهد. تصمیم‌گیری و ساخت دریافت فقط در سرور است (cardTerminalService).
// • توکن ۳۲ بایت تصادفی است و فقط SHA-256 آن ذخیره می‌شود؛ مقدار اصلی فقط هنگام ساخت/تعویض یک‌بار نمایش داده می‌شود.

const hash = (t: string) => createHash("sha256").update(t).digest("hex");
const newToken = () => randomBytes(32).toString("base64url");

export function agentShape(a: any) {
  const online = !!a.lastSeenAt && Date.now() - new Date(a.lastSeenAt).getTime() <= AGENT_ONLINE_MS;
  return {
    id: a.id,
    name: a.name,
    isActive: a.isActive,
    online: a.isActive && online,
    lastSeenAt: a.lastSeenAt ?? null,
    readerCount: a._count?.readers ?? 0,
    updatedAt: a.updatedAt,
  };
}

export async function listAgents() {
  const rows = await prisma.cardTerminalAgent.findMany({ orderBy: { id: "asc" }, include: { _count: { select: { readers: true } } } });
  return rows.map(agentShape);
}

function cleanName(raw: unknown) {
  const name = typeof raw === "string" ? raw.trim().replace(/\s+/g, " ") : "";
  if (!name) throw new StoreSaleError("نام عامل الزامی است");
  if (name.length > 100) throw new StoreSaleError("نام عامل حداکثر ۱۰۰ نویسه است");
  return name;
}

/** ساخت عامل جدید؛ توکن فقط همین یک‌بار برمی‌گردد */
export async function createAgent(body: { name?: unknown }) {
  const name = cleanName(body.name);
  if (await prisma.cardTerminalAgent.findUnique({ where: { name }, select: { id: true } })) throw new StoreSaleError("نام عامل تکراری است");
  const token = newToken();
  const a = await prisma.cardTerminalAgent.create({ data: { name, tokenHash: hash(token) }, include: { _count: { select: { readers: true } } } });
  return { ...agentShape(a), token };
}

export async function updateAgent(id: number, body: { name?: unknown; isActive?: unknown }) {
  const ex = await prisma.cardTerminalAgent.findUnique({ where: { id } });
  if (!ex) throw new StoreSaleError("عامل یافت نشد");
  const name = body.name === undefined ? ex.name : cleanName(body.name);
  if (name !== ex.name && (await prisma.cardTerminalAgent.findUnique({ where: { name }, select: { id: true } }))) throw new StoreSaleError("نام عامل تکراری است");
  const isActive = body.isActive === undefined ? ex.isActive : !!body.isActive;
  const a = await prisma.cardTerminalAgent.update({ where: { id }, data: { name, isActive }, include: { _count: { select: { readers: true } } } });
  return agentShape(a);
}

/** تعویض توکن (اگر لو رفت/گم شد)؛ توکن قبلی فوراً از کار می‌افتد */
export async function regenerateToken(id: number) {
  if (!(await prisma.cardTerminalAgent.findUnique({ where: { id }, select: { id: true } }))) throw new StoreSaleError("عامل یافت نشد");
  const token = newToken();
  await prisma.cardTerminalAgent.update({ where: { id }, data: { tokenHash: hash(token) } });
  return { token };
}

export async function deleteAgent(id: number) {
  const used = await prisma.cardReader.count({ where: { agentId: id } });
  if (used) throw new StoreSaleError(`این عامل به ${used} کارتخوان وصل است؛ ابتدا از فرم کارتخوان‌ها آن را بردارید`);
  // تراکنش‌های کارتخوان سابقه‌ی مالی‌اند؛ عاملی که تراکنش داشته حذف نمی‌شود (غیرفعال کنید)
  const txs = await prisma.cardReaderTransaction.count({ where: { agentId: id } });
  if (txs) throw new StoreSaleError(`از طریق این عامل ${txs} تراکنش کارتخوان ثبت شده و سابقه‌ی مالی است؛ به‌جای حذف، عامل را غیرفعال کنید`);
  // کارهای چاپ و دستورهای ارسال فقط سابقه‌ی عملیاتی‌اند (حتی اگر فروششان حذف شده)؛ همراه عامل پاک می‌شوند
  await prisma.$transaction([
    prisma.printJob.deleteMany({ where: { agentId: id } }),
    prisma.cardTerminalCommand.deleteMany({ where: { agentId: id } }),
    prisma.cardTerminalAgent.delete({ where: { id } }),
  ]);
}

/** احراز agent با توکن Bearer */
export async function authenticateAgent(token: string | undefined) {
  if (!token) return null;
  const a = await prisma.cardTerminalAgent.findUnique({ where: { tokenHash: hash(token) } });
  return a && a.isActive ? a : null;
}

/** poll: ضربان قلب + برداشتن اتمیک دستورهای QUEUED این agent */
export async function agentPoll(agentId: number) {
  await prisma.cardTerminalAgent.update({ where: { id: agentId }, data: { lastSeenAt: new Date() } });
  await expireStale();
  const queued = await prisma.cardTerminalCommand.findMany({
    where: { agentId, status: "QUEUED" },
    orderBy: { id: "asc" },
    take: 20,
    include: { transaction: { include: { cardReader: { select: { id: true, title: true, terminalNumber: true, merchantNumber: true } } } } },
  });
  const out: any[] = [];
  for (const c of queued) {
    const claim = await prisma.cardTerminalCommand.updateMany({ where: { id: c.id, status: "QUEUED" }, data: { status: "CLAIMED", claimedAt: new Date() } });
    if (claim.count !== 1) continue; // هم‌زمان منقضی/برداشته شد
    out.push({
      commandId: c.id,
      kind: c.kind,
      requestUid: c.transaction.requestUid,
      amount: Number(c.transaction.amount),
      driver: c.transaction.driver,
      reader: c.transaction.cardReader,
    });
  }
  return { commands: out, serverTime: new Date().toISOString() };
}

/** گزارش نتیجه‌ی یک دستور از agent. نتیجه‌ی دیرهنگام یک دستور منقضی‌شده‌ی برداشته‌شده هم پذیرفته می‌شود (تراکنش UNKNOWN است) */
export async function agentReport(agentId: number, commandId: number, body: any) {
  const c = await prisma.cardTerminalCommand.findUnique({ where: { id: commandId } });
  if (!c || c.agentId !== agentId) throw new StoreSaleError("دستور یافت نشد");
  if (c.status === "DONE") return { ok: true, duplicate: true };
  if (c.status === "QUEUED" || (c.status === "EXPIRED" && !c.claimedAt)) throw new StoreSaleError("این دستور هنوز برداشته نشده یا منقضی شده است");
  const status = String(body?.status ?? "");
  if (!["SUCCESS", "FAILED", "UNKNOWN", "CANCELLED"].includes(status)) throw new StoreSaleError("وضعیت نتیجه نامعتبر است");
  const result: DriverResult = {
    status: status as DriverResult["status"],
    referenceNumber: body?.referenceNumber ?? null,
    maskedCard: body?.maskedCard ?? null,
    errorCode: body?.errorCode ?? null,
    errorMessage: body?.errorMessage ?? null,
  };
  if (result.status === "SUCCESS" && !String(result.referenceNumber ?? "").trim()) throw new StoreSaleError("برای نتیجه‌ی موفق شماره پیگیری الزامی است");
  const done = await prisma.cardTerminalCommand.updateMany({ where: { id: commandId, status: { in: ["CLAIMED", "EXPIRED"] } }, data: { status: "DONE", doneAt: new Date() } });
  if (done.count !== 1) return { ok: true, duplicate: true };
  await applyResult(c.transactionId, result);
  return { ok: true };
}
