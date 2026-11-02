import { prisma } from "../lib/prisma";
import { getRequestContext } from "../lib/requestContext";
import { nextSerialNumber } from "../utils/coding";
import { StoreSaleError } from "./storeSaleService";
import { OrderPayload, buildStoreOrderData, getPrintDocType, hydrateSharedHtml, renderWithDefaultTemplate } from "./printService";

// فروش فروشگاهی › چاپ — تنها محل قواعد:
// • «گروه چاپ» (کالاها و/یا گروه‌های کالا) + چاپگرهای ایستگاه (نوع «فاکتور» = همه‌ی کالاها؛ نوع «سفارش» = همه‌ی کالاها یا یک گروه چاپ).
// • «چاپ فاکتور» به همه‌ی چاپگرهای فاکتورِ ایستگاه، «چاپ سفارش» به چاپگرهای سفارش می‌رود. سفارش افزایشی است: فقط اقلام تازه/کم‌شده از آخرین ارسال
//   (StoreSaleOrderSent به‌ازای فروش+کالا؛ سطرهای فروش با هر ویرایش بازسازی می‌شوند پس کلید کالاست)، با برگه‌ی «لغو» برای اقلام کم‌شده.
// • سرور به چاپگر دسترسی ندارد؛ هر چاپگر یک PrintJob با HTML ثابت‌شده می‌گیرد و همراه نام چاپگر ویندوز به «برنامه‌ی صندوق» (کلاینت، داخل شبکه‌ی محل)
//   برمی‌گردد؛ آن برنامه روی درایور ویندوز چاپ می‌کند و نتیجه را با POST /print-jobs/:id/result گزارش می‌دهد (به صف چاپ ویندوز رفت / خطا).
//   کارِ تحویل‌شده بدون نتیجه تا ۲ دقیقه = ناموفق با پیام «وضعیت نامعلوم».

export class PrintError extends StoreSaleError {}

const RESULT_TIMEOUT_MS = 120_000;

// ───────────────────────── گروه چاپ ─────────────────────────

const GROUP_INCLUDE = {
  items: { include: { goodsItem: { select: { id: true, fullCode: true, title: true } } }, orderBy: { id: "asc" } },
  goodsGroups: { include: { goodsGroup: { select: { id: true, code: true, title: true } } }, orderBy: { id: "asc" } },
  printers: { select: { station: { select: { id: true, title: true } } } },
} as const;

export function printGroupShape(g: any) {
  const stations = new Map<number, string>();
  for (const p of g.printers ?? []) stations.set(p.station.id, p.station.title);
  return {
    id: g.id,
    code: g.code,
    title: g.title,
    isActive: g.isActive,
    itemCount: g.items.length,
    goodsGroupCount: g.goodsGroups.length,
    items: g.items.map((x: any) => ({ goodsItemId: x.goodsItemId, code: x.goodsItem.fullCode, title: x.goodsItem.title })),
    goodsGroups: g.goodsGroups.map((x: any) => ({ goodsGroupId: x.goodsGroupId, code: x.goodsGroup.code, title: x.goodsGroup.title })),
    stations: [...stations].map(([id, title]) => ({ id, title })),
    updatedAt: g.updatedAt,
  };
}

export async function listPrintGroups() {
  const rows = await prisma.printGroup.findMany({ include: GROUP_INCLUDE, orderBy: { code: "asc" } });
  return rows.map(printGroupShape);
}

export async function loadPrintGroup(id: number) {
  const g = await prisma.printGroup.findUnique({ where: { id }, include: GROUP_INCLUDE });
  return g ? printGroupShape(g) : null;
}

function cleanGroup(b: any) {
  const title = typeof b?.title === "string" ? b.title.trim().replace(/\s+/g, " ") : "";
  if (!title) throw new PrintError("عنوان گروه چاپ الزامی است");
  if (title.length > 100) throw new PrintError("عنوان گروه چاپ حداکثر ۱۰۰ نویسه است");
  const ids = (raw: unknown, label: string) => {
    if (raw === undefined) return undefined;
    if (!Array.isArray(raw)) throw new PrintError(`${label} نامعتبر است`);
    const out = [...new Set(raw.map((x) => Number(x)).filter((n) => Number.isInteger(n) && n > 0))];
    return out;
  };
  return { title, isActive: b?.isActive !== false, items: ids(b?.items, "فهرست کالاها"), goodsGroups: ids(b?.goodsGroups, "فهرست گروه‌های کالا") };
}

async function syncGroupMembers(tx: any, id: number, items?: number[], goodsGroups?: number[]) {
  if (items) {
    const found = await tx.goodsItem.count({ where: { id: { in: items } } });
    if (found !== items.length) throw new PrintError("برخی کالاها یافت نشد");
    await tx.printGroupItem.deleteMany({ where: { printGroupId: id } });
    if (items.length) await tx.printGroupItem.createMany({ data: items.map((goodsItemId) => ({ printGroupId: id, goodsItemId })) });
  }
  if (goodsGroups) {
    const found = await tx.goodsGroup.count({ where: { id: { in: goodsGroups } } });
    if (found !== goodsGroups.length) throw new PrintError("برخی گروه‌های کالا یافت نشد");
    await tx.printGroupGoodsGroup.deleteMany({ where: { printGroupId: id } });
    if (goodsGroups.length) await tx.printGroupGoodsGroup.createMany({ data: goodsGroups.map((goodsGroupId) => ({ printGroupId: id, goodsGroupId })) });
  }
}

export async function createPrintGroup(body: any) {
  const d = cleanGroup(body);
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const code = await nextSerialNumber(tx.printGroup as any, "code");
        const g = await tx.printGroup.create({ data: { code, title: d.title, isActive: d.isActive } });
        await syncGroupMembers(tx, g.id, d.items ?? [], d.goodsGroups ?? []);
        return g;
      });
    } catch (e: any) {
      if (e?.code === "P2002" && String(e?.meta?.target ?? "").includes("code") && attempt < 3) continue;
      throw e;
    }
  }
}

export async function updatePrintGroup(id: number, body: any) {
  const d = cleanGroup(body);
  await prisma.$transaction(async (tx) => {
    await tx.printGroup.update({ where: { id }, data: { title: d.title, isActive: d.isActive } });
    await syncGroupMembers(tx, id, d.items, d.goodsGroups);
  });
}

// ───────────────────────── چاپگرهای ایستگاه ─────────────────────────

export interface CleanedPrinters {
  printers: { printerName: string; printType: "INVOICE" | "ORDER"; paper: "ROLL_80" | "A4" | "A5"; printGroupId: number | null; isActive: boolean }[] | undefined;
}

/** اعتبارسنجی بخش «چاپگرها»ی فرم ایستگاه؛ printers = مجموعه‌ی کامل (undefined = دست‌نخورده) */
export async function cleanStationPrinters(b: any): Promise<CleanedPrinters> {
  if (b?.printers === undefined) return { printers: undefined };
  if (!Array.isArray(b.printers)) throw new PrintError("فهرست چاپگرها نامعتبر است");
  const printers = b.printers.map((p: any, i: number) => {
    const printerName = typeof p?.printerName === "string" ? p.printerName.trim() : "";
    if (!printerName) throw new PrintError(`چاپگر ردیف ${i + 1}: نام چاپگر الزامی است`);
    if (printerName.length > 200) throw new PrintError(`چاپگر ردیف ${i + 1}: نام چاپگر حداکثر ۲۰۰ نویسه است`);
    const printType = p?.printType === "INVOICE" || p?.printType === "ORDER" ? (p.printType as "INVOICE" | "ORDER") : null;
    if (!printType) throw new PrintError(`چاپگر ردیف ${i + 1}: نوع چاپ را انتخاب کنید`);
    const paper = p?.paper === "A4" || p?.paper === "A5" ? (p.paper as "A4" | "A5") : "ROLL_80";
    const printGroupId = p?.printGroupId ? Number(p.printGroupId) : null;
    if (printType === "INVOICE" && printGroupId) throw new PrintError(`چاپگر ردیف ${i + 1}: چاپگر نوع «فاکتور» همه‌ی کالاها را چاپ می‌کند و گروه چاپ نمی‌گیرد`);
    return { printerName, printType, paper, printGroupId, isActive: p?.isActive !== false };
  });
  const groupIds = [...new Set(printers.map((p: any) => p.printGroupId).filter((x: number | null): x is number => !!x))] as number[];
  if (groupIds.length) {
    const found = await prisma.printGroup.count({ where: { id: { in: groupIds } } });
    if (found !== groupIds.length) throw new PrintError("گروه چاپ انتخاب‌شده یافت نشد");
  }
  return { printers };
}

export async function syncStationPrinters(tx: any, stationId: number, printers: NonNullable<CleanedPrinters["printers"]>) {
  await tx.salesStationPrinter.deleteMany({ where: { stationId } });
  if (printers.length) await tx.salesStationPrinter.createMany({ data: printers.map((p, i) => ({ stationId, rowOrder: i, ...p })) });
}

// ───────────────────────── کار چاپ ─────────────────────────

export function jobShape(j: any) {
  return { id: j.id, printerName: j.printerName, kind: j.kind as "INVOICE" | "ORDER", status: j.status as "QUEUED" | "CLAIMED" | "PRINTED" | "FAILED", errorMessage: j.errorMessage ?? "", title: j.title, createdAt: j.createdAt, doneAt: j.doneAt ?? null };
}

/** آنچه برنامه‌ی صندوق برای چاپ لازم دارد: نام چاپگر ویندوز + HTML کامل (فونت/لوگو پر شده) */
async function jobPayload(j: any) {
  return { ...jobShape(j), printer: j.printerName as string, html: await hydrateSharedHtml(j.html), widthMm: 80, paper: (j.paper ?? "ROLL_80") as string };
}
const SENT = () => ({ status: "CLAIMED" as const, claimedAt: new Date() });

async function loadSaleForPrint(saleId: number, type: "INVOICE" | "ORDER") {
  const sale = await prisma.storeSale.findUnique({
    where: { id: saleId },
    include: {
      station: { select: { id: true, title: true, printers: { where: { isActive: true, printType: type }, include: { printGroup: { select: { id: true, title: true, isActive: true } } }, orderBy: { rowOrder: "asc" } } } },
      lines: { include: { goodsItem: { select: { id: true, rawTitle: true, goodsGroupId: true, mainUnit: { select: { title: true } } } }, unit: { select: { title: true } } }, orderBy: { rowOrder: "asc" } },
    },
  });
  if (!sale) throw new PrintError("فروش یافت نشد");
  return sale;
}

const userId = () => getRequestContext()?.userId ?? null;

/** چاپ فاکتور (رسید) روی همه‌ی چاپگرهای نوع «فاکتور» ایستگاه */
export async function printSaleInvoice(saleId: number) {
  const sale = await loadSaleForPrint(saleId, "INVOICE");
  const printers = sale.station.printers;
  if (!printers.length) throw new PrintError("برای این ایستگاه چاپگر نوع «فاکتور» تعریف نشده است");
  const data = await getPrintDocType("STORE_SALE").load(saleId);
  const { html, title } = await renderWithDefaultTemplate("STORE_SALE", data, { forShare: true });
  const jobs = [];
  for (const p of printers) {
    // eslint-disable-next-line no-await-in-loop
    jobs.push(await prisma.printJob.create({ data: { printerName: p.printerName, paper: p.paper, kind: "INVOICE", saleId, title, html, createdById: userId(), ...SENT() } }));
  }
  return { jobs: await Promise.all(jobs.map(jobPayload)), unrouted: [] as string[] };
}

type OrderItem = OrderPayload["items"][number];

/** آیا کالا عضو گروه چاپ است؟ (کالای مستقیم، یا هر گروه کالا در زنجیره‌ی بالادستِ گروه کالا) */
function buildMembership(groups: { id: number; items: { goodsItemId: number }[]; goodsGroups: { goodsGroupId: number }[] }[], parentOf: Map<number, number | null>) {
  const itemSet = new Map<number, Set<number>>();
  const ggSet = new Map<number, Set<number>>();
  for (const g of groups) {
    itemSet.set(g.id, new Set(g.items.map((x) => x.goodsItemId)));
    ggSet.set(g.id, new Set(g.goodsGroups.map((x) => x.goodsGroupId)));
  }
  return (groupId: number, goodsItemId: number, goodsGroupId: number | undefined) => {
    if (itemSet.get(groupId)?.has(goodsItemId)) return true;
    const gg = ggSet.get(groupId);
    if (!gg || !gg.size) return false;
    let cur: number | null | undefined = goodsGroupId;
    for (let i = 0; cur && i < 50; i++) {
      if (gg.has(cur)) return true;
      cur = parentOf.get(cur) ?? null;
    }
    return false;
  };
}

/**
 * چاپ سفارش روی چاپگرهای نوع «سفارش»: mode NEW = فقط اقلام جدید/کم‌شده از آخرین ارسال؛ ALL = چاپ مجدد کل سفارش (بدون تغییر در «ارسال‌شده‌ها»).
 * همه‌چیز (نوبت، کارهای چاپ و به‌روزکردن ارسال‌شده‌ها) در یک تراکنش زیر قفل فروش؛ اگر هیچ چاپگری اقلام را نگیرد، چیزی ثبت نمی‌شود.
 */
export async function printSaleOrder(saleId: number, mode: "NEW" | "ALL") {
  const sale = await loadSaleForPrint(saleId, "ORDER");
  const printers = sale.station.printers.filter((p) => !p.printGroupId || p.printGroup?.isActive !== false);
  if (!printers.length) throw new PrintError("برای این ایستگاه چاپگر نوع «سفارش» تعریف نشده است");

  const groupIds = [...new Set(printers.map((p) => p.printGroupId).filter((x): x is number => !!x))];
  const groups = groupIds.length ? await prisma.printGroup.findMany({ where: { id: { in: groupIds } }, include: { items: true, goodsGroups: true } }) : [];
  const gg = await prisma.goodsGroup.findMany({ select: { id: true, parentId: true } });
  const member = buildMembership(groups, new Map(gg.map((x) => [x.id, x.parentId])));

  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(7100052, ${saleId})`);
    // مقدار فعلیِ هر کالا
    const current = new Map<number, OrderItem & { goodsGroupId: number }>();
    for (const l of sale.lines) {
      const prev = current.get(l.goodsItemId);
      const desc = (l.description ?? "").trim();
      if (prev) {
        prev.quantity += Number(l.quantity);
        if (desc && !prev.description.split(" / ").includes(desc)) prev.description = prev.description ? `${prev.description} / ${desc}` : desc;
      } else {
        current.set(l.goodsItemId, { goodsItemId: l.goodsItemId, title: l.goodsItem.rawTitle, unit: l.unit.title, quantity: Number(l.quantity), description: desc, goodsGroupId: l.goodsItem.goodsGroupId });
      }
    }
    const sentRows = await tx.storeSaleOrderSent.findMany({ where: { saleId } });
    const sent = new Map(sentRows.map((r) => [r.goodsItemId, r]));

    let items: (OrderItem & { goodsGroupId?: number })[] = [];
    let cancelled: (OrderItem & { goodsGroupId?: number })[] = [];
    if (mode === "ALL") {
      items = [...current.values()];
    } else {
      for (const c of current.values()) {
        const delta = c.quantity - Number(sent.get(c.goodsItemId)?.quantity ?? 0);
        if (delta > 1e-9) items.push({ ...c, quantity: delta });
        else if (delta < -1e-9) cancelled.push({ ...c, quantity: -delta });
      }
      for (const s of sentRows) {
        if (current.has(s.goodsItemId)) continue;
        cancelled.push({ goodsItemId: s.goodsItemId, title: s.title, unit: s.unitTitle, quantity: Number(s.quantity), description: "" });
      }
      // گروه کالای اقلامِ حذف‌شده از فروش (برای مسیریابی)
      const missing = cancelled.filter((x) => x.goodsGroupId === undefined).map((x) => x.goodsItemId);
      if (missing.length) {
        const gi = await tx.goodsItem.findMany({ where: { id: { in: missing } }, select: { id: true, goodsGroupId: true } });
        const m = new Map(gi.map((x) => [x.id, x.goodsGroupId]));
        for (const x of cancelled) if (x.goodsGroupId === undefined) x.goodsGroupId = m.get(x.goodsItemId);
      }
    }
    if (!items.length && !cancelled.length) throw new PrintError(mode === "ALL" ? "این فروش قلمی ندارد" : "مورد جدیدی برای ارسال نیست؛ برای چاپ دوباره‌ی کل سفارش از «چاپ مجدد کل سفارش» استفاده کنید");

    const last = await tx.storeSaleOrderBatch.findFirst({ where: { saleId }, orderBy: { seq: "desc" }, select: { seq: true } });
    const seq = (last?.seq ?? 0) + 1;
    const strip = (x: OrderItem & { goodsGroupId?: number }): OrderItem => ({ goodsItemId: x.goodsItemId, title: x.title, unit: x.unit, quantity: x.quantity, description: x.description });
    const batch = await tx.storeSaleOrderBatch.create({ data: { saleId, seq, mode, payload: { items: items.map(strip), cancelled: cancelled.map(strip) } as any, createdById: userId() } });

    const routed = new Set<number>();
    const jobs = [];
    for (const p of printers) {
      const pick = (arr: (OrderItem & { goodsGroupId?: number })[]) => (p.printGroupId ? arr.filter((x) => member(p.printGroupId!, x.goodsItemId, x.goodsGroupId)) : arr);
      const mine = pick(items);
      const myCancelled = pick(cancelled);
      if (!mine.length && !myCancelled.length) continue;
      for (const x of [...mine, ...myCancelled]) routed.add(x.goodsItemId);
      // eslint-disable-next-line no-await-in-loop
      const data = await buildStoreOrderData({ saleId, seq, mode, at: batch.createdAt, items: mine.map(strip), cancelled: myCancelled.map(strip), groupTitle: p.printGroup?.title ?? "" });
      // eslint-disable-next-line no-await-in-loop
      const { html, title } = await renderWithDefaultTemplate("STORE_SALE_ORDER", data, { forShare: true });
      // eslint-disable-next-line no-await-in-loop
      jobs.push(await tx.printJob.create({ data: { printerName: p.printerName, paper: p.paper, kind: "ORDER", saleId, batchId: batch.id, title, html, createdById: userId(), ...SENT() } }));
    }
    if (!jobs.length) throw new PrintError("هیچ‌کدام از چاپگرهای سفارشِ این ایستگاه این اقلام را نمی‌گیرند؛ گروه چاپ کالاها را بررسی کنید");

    if (mode === "NEW") {
      await tx.storeSaleOrderSent.deleteMany({ where: { saleId } });
      if (current.size) await tx.storeSaleOrderSent.createMany({ data: [...current.values()].map((c) => ({ saleId, goodsItemId: c.goodsItemId, title: c.title, unitTitle: c.unit, quantity: c.quantity })) });
    }
    const unrouted = [...items, ...cancelled].filter((x) => !routed.has(x.goodsItemId)).map((x) => x.title);
    return { seq, jobs, unrouted: [...new Set(unrouted)] };
  }).then(async (r) => ({ ...r, jobs: await Promise.all(r.jobs.map(jobPayload)) }));
}

// ───────────────────────── چرخه‌ی کار چاپ با برنامه‌ی صندوق ─────────────────────────

/** مهلت (تنبل): تحویل‌شده به کلاینت بدون نتیجه ⇒ وضعیت نامعلوم */
export async function expirePrintJobs() {
  await prisma.printJob.updateMany({ where: { status: { in: ["QUEUED", "CLAIMED"] }, createdAt: { lt: new Date(Date.now() - RESULT_TIMEOUT_MS) } }, data: { status: "FAILED", doneAt: new Date(), errorMessage: "نتیجه‌ی چاپ نرسید؛ وضعیت نامعلوم است (چاپگر را بررسی کنید)" } });
}

export async function listJobsForSale(saleId: number) {
  await expirePrintJobs();
  const rows = await prisma.printJob.findMany({ where: { saleId }, orderBy: { id: "desc" }, take: 100, select: { id: true, printerName: true, kind: true, status: true, errorMessage: true, title: true, createdAt: true, doneAt: true } });
  return rows.map(jobShape);
}

/** تکرار کار ناموفق: نسخه‌ی تازه‌ای می‌سازد و همراه HTML به کلاینت برمی‌گرداند تا دوباره چاپ کند */
export async function retryJob(id: number) {
  const j = await prisma.printJob.findUnique({ where: { id } });
  if (!j) throw new PrintError("کار چاپ یافت نشد");
  if (j.status !== "FAILED") throw new PrintError("فقط کار چاپِ ناموفق قابل تکرار است");
  const copy = await prisma.printJob.create({ data: { printerName: j.printerName, paper: j.paper, kind: j.kind, saleId: j.saleId, batchId: j.batchId, title: j.title, html: j.html, createdById: userId(), ...SENT() } });
  return jobPayload(copy);
}

/** گزارش نتیجه‌ی چاپ از برنامه‌ی صندوق */
export async function reportJobResult(jobId: number, body: { ok?: unknown; error?: unknown }) {
  const j = await prisma.printJob.findUnique({ where: { id: jobId }, select: { status: true } });
  if (!j) throw new PrintError("کار چاپ یافت نشد");
  if (j.status === "PRINTED") return { ok: true, duplicate: true };
  const ok = body.ok === true;
  // نتیجه‌ی دیرهنگامِ کاری که مهلتش گذشته (FAILED) هم پذیرفته می‌شود تا وضعیت واقعی دیده شود
  await prisma.printJob.update({ where: { id: jobId }, data: { status: ok ? "PRINTED" : "FAILED", doneAt: new Date(), errorMessage: ok ? null : String(body.error ?? "خطای نامشخص چاپ").slice(0, 300) } });
  return { ok: true };
}
