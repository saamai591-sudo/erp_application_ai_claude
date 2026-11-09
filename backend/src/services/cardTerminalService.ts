import { randomUUID } from "crypto";
import { prisma } from "../lib/prisma";
import { getRequestContext } from "../lib/requestContext";
import { StoreSaleError, assertAfterLastDelivery, saleTotals } from "./storeSaleService";
import { assertWithinPayable, checked } from "./storeReceiptService";

// فروش فروشگاهی › «تراکنش کارتخوان» — تنها محل قواعد (ارسال مبلغ به کارتخوان، استعلام، لغو، تعیین دستی و ساخت دریافت).
// • هر درخواست یک رکورد CardReaderTransaction با شناسه‌ی یکتا (requestUid) است؛ دریافت فروش (StoreReceipt) فقط با موفقیت تراکنش و در همان تراکنش دیتابیس ساخته می‌شود.
// • مبلغ تراکنش‌های PENDING/UNKNOWN از باقی‌مانده‌ی فروش «رزرو» می‌شود تا دو درخواست هم‌زمان از سقف رد نشوند (زیر قفل فروش 7100022).
// • UNKNOWN (نتیجه‌ی نامشخص، مثلاً قطع ارتباط) نه دوباره فرستاده می‌شود نه نادیده گرفته می‌شود؛ فقط با استعلام یا تعیین دستی (موفق/ناموفق) بسته می‌شود.
// • اتصال به مدل دستگاه فقط با «درایور» انجام می‌شود (رابط CardTerminalDriver)؛ برای افزودن دستگاه تازه یک درایور بنویسید و در DRIVERS ثبت کنید.
// • شماره‌ی کامل کارت هرگز ذخیره نمی‌شود، فقط شماره‌ی ماسک‌شده.
// • درایور با runsOn="CLIENT" (مثل سداد): سرور فقط تراکنش را آماده می‌کند؛ «برنامه‌ی صندوق» روی کامپیوتر خود صندوق با دستگاه حرف می‌زند و نتیجه را با ورود کاربر گزارش می‌دهد (reportClientResult).
//   تا ۵ دقیقه بدون گزارش ⇒ «نامشخص» (expireStale).
// • هر کارتخوان هم‌زمان فقط یک تراکنش باز (در انتظار/نامشخص) دارد؛ درخواست دوم رد می‌شود (قفل 7100051 به شناسه‌ی کارتخوان).

type TxStatus = "PENDING" | "SUCCESS" | "FAILED" | "CANCELLED" | "UNKNOWN";

export interface DriverResult {
  status: TxStatus;
  referenceNumber?: string | null;
  maskedCard?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
}

interface DriverTx {
  requestUid: string;
  amount: number;
  createdAt: Date;
  reader: { terminalNumber: string; merchantNumber: string };
}

export interface CardTerminalDriver {
  title: string;
  /** این درایور خودش نتیجه را اعلام می‌کند (استعلام معنا دارد)؛ false = کاربر نتیجه را دستی ثبت می‌کند */
  automatic: boolean;
  /** CLIENT = دستگاه را برنامه‌ی صندوق (Electron) روی کامپیوتر خود صندوق اجرا می‌کند و نتیجه را با ورود کاربر گزارش می‌دهد؛ سرور فقط تراکنش را آماده و ثبت می‌کند (مثل چاپ) */
  runsOn?: "CLIENT";
  send(tx: DriverTx): Promise<DriverResult>;
  inquire(tx: DriverTx): Promise<DriverResult>;
  cancel(tx: DriverTx): Promise<DriverResult>;
}

/** بدون اتصال: مبلغ فقط ثبت می‌شود و کاربر نتیجه (شماره پیگیری) را از روی دستگاه دستی وارد می‌کند */
const manualDriver: CardTerminalDriver = {
  title: "دستی (بدون اتصال به دستگاه)",
  automatic: false,
  send: async () => ({ status: "PENDING" }),
  inquire: async () => ({ status: "PENDING" }),
  cancel: async () => ({ status: "CANCELLED" }),
};

/** تراکنش برنامه‌ی صندوق: ۱۸۰ ثانیه انتظار کارت + دست‌دهی و استعلام ⇒ بعد از ۵ دقیقه بدون گزارش، نتیجه «نامشخص» است */
export const CLIENT_RESULT_TIMEOUT_MS = 300_000;

/** سداد (PcPos): دستگاه فقط در شبکه‌ی محل در دسترس است؛ درایور واقعی در برنامه‌ی صندوق اجرا می‌شود (pos-app/drivers/sadad.mjs) و نتیجه با POST /card-transactions/:id/client-result می‌آید. سرور هیچ‌چیز را خودش اجرا نمی‌کند. */
const sadadDriver: CardTerminalDriver = {
  title: "سداد (PcPos) — از برنامه‌ی صندوق",
  automatic: true,
  runsOn: "CLIENT",
  send: async () => ({ status: "PENDING" }),
  inquire: async () => ({ status: "PENDING" }),
  cancel: async () => ({ status: "CANCELLED" }),
};

/** پارسیان (PEC): مانند سداد، درایور واقعی در برنامه‌ی صندوق است (pos-app/drivers/parsian.mjs). آی‌پی دستگاه الزامی است (پخش شناسایی ندارد). */
const parsianDriver: CardTerminalDriver = {
  title: "پارسیان (PEC) — از برنامه‌ی صندوق",
  automatic: true,
  runsOn: "CLIENT",
  send: async () => ({ status: "PENDING" }),
  inquire: async () => ({ status: "PENDING" }),
  cancel: async () => ({ status: "CANCELLED" }),
};

export const DRIVERS: Record<string, CardTerminalDriver> = { MANUAL: manualDriver, SADAD: sadadDriver, PARSIAN: parsianDriver };
export const driverOptions = () => Object.entries(DRIVERS).map(([key, d]) => ({ key, title: d.title, automatic: d.automatic }));

/** تراکنشی که برنامه‌ی صندوق اجرا می‌کند (نه خودِ سرور) */
const isClientRun = (t: { driver: string }) => DRIVERS[t.driver]?.runsOn === "CLIENT";

const EPS = 1e-6;
const dayStr = (d: Date) => d.toISOString().slice(0, 10);

const INCLUDE = { cardReader: { select: { title: true, terminalNumber: true, merchantNumber: true, deviceIp: true, devicePort: true } }, receipt: { select: { number: true } } } as const;

export function txShape(t: any) {
  return {
    id: t.id,
    saleId: t.saleId,
    cardReaderId: t.cardReaderId,
    cardReaderTitle: t.cardReader?.title ?? "",
    driver: t.driver,
    automatic: !!DRIVERS[t.driver]?.automatic,
    clientRun: isClientRun(t),
    requestUid: t.requestUid,
    terminalNumber: t.cardReader?.terminalNumber ?? "",
    deviceIp: t.cardReader?.deviceIp ?? "",
    devicePort: t.cardReader?.devicePort ?? null,
    date: dayStr(t.date),
    amount: Number(t.amount),
    status: t.status as TxStatus,
    referenceNumber: t.referenceNumber ?? "",
    maskedCard: t.maskedCard ?? "",
    errorCode: t.errorCode ?? "",
    errorMessage: t.errorMessage ?? "",
    receiptId: t.receiptId ?? null,
    receiptNumber: t.receipt?.number ?? null,
    createdAt: t.createdAt,
    completedAt: t.completedAt ?? null,
  };
}

export async function listTransactions(saleId: number) {
  await expireStale();
  const rows = await prisma.cardReaderTransaction.findMany({ where: { saleId }, include: INCLUDE, orderBy: { id: "desc" }, take: 200 });
  return rows.map(txShape);
}

async function loadTx(id: number) {
  const t = await prisma.cardReaderTransaction.findUnique({ where: { id }, include: INCLUDE });
  if (!t) throw new StoreSaleError("تراکنش کارتخوان یافت نشد");
  return t;
}

const toDriverTx = (t: any): DriverTx => ({ requestUid: t.requestUid, amount: Number(t.amount), createdAt: t.createdAt, reader: { terminalNumber: t.cardReader.terminalNumber, merchantNumber: t.cardReader.merchantNumber } });
const cut = (v: unknown, n: number) => (v == null ? null : String(v).trim().slice(0, n) || null);

/** ارسال مبلغ به کارتخوان: رزرو مبلغ زیر قفل فروش، سپس فراخوانی درایور (خارج از قفل) */
export async function startTransaction(body: { saleId?: unknown; cardReaderId?: unknown; amount?: unknown; date?: unknown; clientApp?: unknown }) {
  const saleId = Number(body.saleId);
  const cardReaderId = Number(body.cardReaderId);
  if (!saleId) throw new StoreSaleError("فروش را انتخاب کنید");
  if (!cardReaderId) throw new StoreSaleError("کارتخوان را انتخاب کنید");
  const { date, amount } = await checked({ date: body.date as string, amount: body.amount as any });
  await expireStale();
  const created = await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(7100051, ${cardReaderId})`);
    await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(7100022, ${saleId})`);
    const sale = await tx.storeSale.findUnique({ where: { id: saleId }, include: { lines: { select: { amount: true, vatAmount: true } } } });
    if (!sale) throw new StoreSaleError("فروش یافت نشد");
    if (date.getTime() < sale.date.getTime()) throw new StoreSaleError("تاریخ دریافت نمی‌تواند قبل از تاریخ فروش باشد");
    await assertAfterLastDelivery(sale.stationId, date);
    const link = await tx.salesStationCardReader.findFirst({ where: { stationId: sale.stationId, cardReaderId }, select: { id: true } });
    if (!link) throw new StoreSaleError("این کارتخوان به ایستگاه این فروش اختصاص داده نشده است");
    const reader = await tx.cardReader.findUnique({ where: { id: cardReaderId }, select: { driver: true, title: true } });
    if (isClientRun({ driver: reader!.driver }) && body.clientApp !== true) throw new StoreSaleError(`کارتخوان «${reader!.title}» فقط از «برنامه‌ی صندوق» کار می‌کند؛ سامانه را در آن برنامه باز کنید`);
    const busy = await tx.cardReaderTransaction.findFirst({ where: { cardReaderId, status: { in: ["PENDING", "UNKNOWN"] } }, select: { id: true, status: true } });
    if (busy) throw new StoreSaleError(`کارتخوان «${reader!.title}» در حال انجام تراکنش دیگری است${busy.status === "UNKNOWN" ? " (نتیجه‌ی آن نامشخص است؛ ابتدا همان را در فروش مربوطه تعیین تکلیف کنید)" : "؛ پس از پایان آن دوباره تلاش کنید"}`);
    const payable = saleTotals(sale.lines).payable;
    const paid = Number((await tx.storeReceipt.aggregate({ where: { saleId }, _sum: { amount: true } }))._sum.amount ?? 0);
    const reserved = Number((await tx.cardReaderTransaction.aggregate({ where: { saleId, status: { in: ["PENDING", "UNKNOWN"] } }, _sum: { amount: true } }))._sum.amount ?? 0);
    const free = payable - paid - reserved;
    if (amount > free + EPS) throw new StoreSaleError(`مبلغ از باقی‌مانده‌ی قابل دریافت (${Math.max(0, free)}) بیشتر است${reserved > 0 ? "؛ بخشی از آن در تراکنش‌های در انتظار کارتخوان رزرو شده است" : ""}`);
    const row = await tx.cardReaderTransaction.create({
      data: { requestUid: randomUUID(), saleId, cardReaderId, driver: reader!.driver, date, amount, status: "PENDING", createdById: getRequestContext()?.userId ?? null },
      include: INCLUDE,
    });
    return row;
  });
  let result: DriverResult;
  try {
    result = await DRIVERS[created.driver].send(toDriverTx(created));
  } catch (e: any) {
    // نتیجه‌ی ارسال معلوم نیست (ممکن است دستگاه درخواست را گرفته باشد) ⇒ UNKNOWN، نه FAILED
    result = { status: "UNKNOWN", errorCode: "SEND_ERROR", errorMessage: cut(e?.message, 300) ?? "خطا در ارتباط با کارتخوان" };
  }
  return applyResult(created.id, result);
}

/** اعمال نتیجه‌ی درایور/کاربر روی تراکنش؛ موفقیت = ساخت دریافت در همان تراکنش دیتابیس */
export async function applyResult(id: number, r: DriverResult) {
  const t = await loadTx(id);
  if (!["PENDING", "UNKNOWN"].includes(t.status)) return txShape(t);
  if (r.status === "PENDING") return txShape(t);
  if (r.status === "SUCCESS") {
    await finalizeSuccess(id, r);
    return txShape(await loadTx(id));
  }
  await prisma.cardReaderTransaction.updateMany({
    where: { id, status: { in: ["PENDING", "UNKNOWN"] } },
    data: {
      status: r.status,
      errorCode: cut(r.errorCode, 50),
      errorMessage: cut(r.errorMessage, 300),
      ...(r.status === "UNKNOWN" ? {} : { completedAt: new Date() }),
    },
  });
  return txShape(await loadTx(id));
}

async function finalizeSuccess(id: number, r: DriverResult) {
  const t = await loadTx(id);
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(7100022, ${t.saleId})`);
    const claim = await tx.cardReaderTransaction.updateMany({
      where: { id, status: { in: ["PENDING", "UNKNOWN"] } },
      data: { status: "SUCCESS", referenceNumber: cut(r.referenceNumber, 100), maskedCard: cut(r.maskedCard, 30), errorCode: null, errorMessage: null, completedAt: new Date() },
    });
    if (claim.count !== 1) return; // هم‌زمان توسط درخواست دیگری بسته شد
    const amount = Number(t.amount);
    const sale = await assertWithinPayable(tx, t.saleId, amount);
    await assertAfterLastDelivery(sale.stationId, t.date);
    const fp = await tx.fiscalPeriod.findFirst({ where: { fromDate: { lte: t.date }, toDate: { gte: t.date } } });
    if (!fp) throw new StoreSaleError("این تاریخ در هیچ دوره مالی تعریف نشده است");
    await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(7100023, ${fp.id})`);
    const last = await tx.storeReceipt.findFirst({ where: { fiscalPeriodId: fp.id }, orderBy: { number: "desc" }, select: { number: true } });
    const receipt = await tx.storeReceipt.create({
      data: {
        fiscalPeriodId: fp.id,
        number: (last?.number ?? 0) + 1,
        date: t.date,
        saleId: t.saleId,
        stationId: sale.stationId,
        cardReaderId: t.cardReaderId,
        referenceNumber: cut(r.referenceNumber, 100),
        amount,
        description: null,
        createdById: t.createdById ?? getRequestContext()?.userId ?? null,
      },
    });
    await tx.cardReaderTransaction.update({ where: { id }, data: { receiptId: receipt.id } });
  });
}

/** استعلام نتیجه از درایور (برای PENDING/UNKNOWN) */
export async function refreshTransaction(id: number) {
  await expireStale();
  const t = await loadTx(id);
  if (isClientRun(t)) return txShape(t); // نتیجه را برنامه‌ی صندوق می‌آورد
  if (!["PENDING", "UNKNOWN"].includes(t.status)) return txShape(t);
  const drv = DRIVERS[t.driver];
  if (!drv.automatic) return txShape(t); // درایور دستی: نتیجه فقط با تعیین دستی
  let r: DriverResult;
  try {
    r = await drv.inquire(toDriverTx(t));
  } catch (e: any) {
    // خطای استعلام وضعیت را عوض نمی‌کند (نتیجه همچنان معلوم نیست)
    return txShape({ ...t, errorCode: "INQUIRY_ERROR", errorMessage: cut(e?.message, 300) ?? "خطا در استعلام" });
  }
  return applyResult(id, r);
}

/** لغو تراکنش در انتظار؛ UNKNOWN فقط با تعیین دستی بسته می‌شود (ممکن است پول برداشت شده باشد) */
export async function cancelTransaction(id: number) {
  const t = await loadTx(id);
  if (t.status === "UNKNOWN") throw new StoreSaleError("نتیجه‌ی این تراکنش نامشخص است؛ ابتدا استعلام کنید یا نتیجه را دستی (موفق/ناموفق) ثبت کنید");
  if (t.status !== "PENDING") throw new StoreSaleError("فقط تراکنش در انتظار قابل لغو است");
  // لغو از سرور ممکن نیست: دستگاه ممکن است همین حالا کارت را بخواند و بعداً موفق شود؛ لغو باید روی خود دستگاه انجام شود و نتیجه‌ی آن به سرور می‌آید
  if (isClientRun(t)) throw new StoreSaleError("این تراکنش را باید روی خود کارتخوان لغو کنید؛ نتیجه (لغو) خودکار ثبت می‌شود");
  let r: DriverResult;
  try {
    r = await DRIVERS[t.driver].cancel(toDriverTx(t));
  } catch (e: any) {
    throw new StoreSaleError(cut(e?.message, 300) ?? "لغو در دستگاه انجام نشد");
  }
  return applyResult(id, r.status === "PENDING" ? { status: "CANCELLED" } : r);
}

/**
 * نتیجه‌ی تراکنشی که برنامه‌ی صندوق روی دستگاه اجرا کرده است (مثل نتیجه‌ی کار چاپ). فقط خودِ کاربر شروع‌کننده می‌تواند گزارش دهد؛
 * گزارش تکراری بی‌اثر است (applyResult روی تراکنش بسته چیزی تغییر نمی‌دهد). یک تراکنش «نامشخص» هم با گزارش دیرهنگام بسته می‌شود.
 */
export async function reportClientResult(id: number, body: { status?: unknown; referenceNumber?: unknown; maskedCard?: unknown; errorCode?: unknown; errorMessage?: unknown }) {
  const t = await loadTx(id);
  if (!isClientRun(t)) throw new StoreSaleError("نتیجه‌ی این تراکنش از برنامه‌ی صندوق گزارش نمی‌شود");
  const uid = getRequestContext()?.userId;
  if (t.createdById && uid && t.createdById !== uid) throw new StoreSaleError("فقط کاربری که تراکنش را شروع کرده می‌تواند نتیجه‌ی آن را ثبت کند");
  const status = String(body.status);
  if (status !== "SUCCESS" && status !== "FAILED" && status !== "UNKNOWN") throw new StoreSaleError("وضعیت گزارش‌شده نامعتبر است");
  if (status === "SUCCESS" && !cut(body.referenceNumber, 100)) throw new StoreSaleError("شماره پیگیری دستگاه در نتیجه نیست");
  return applyResult(id, { status, referenceNumber: cut(body.referenceNumber, 100), maskedCard: cut(body.maskedCard, 30), errorCode: cut(body.errorCode, 50), errorMessage: cut(body.errorMessage, 300) });
}

/** تعیین دستیِ نتیجه (درایور دستی یا تراکنش UNKNOWN): موفق نیازمند شماره پیگیری است */
export async function resolveTransaction(id: number, body: { outcome?: unknown; referenceNumber?: unknown; note?: unknown }) {
  const t = await loadTx(id);
  if (!["PENDING", "UNKNOWN"].includes(t.status)) throw new StoreSaleError("این تراکنش قبلاً بسته شده است");
  if (body.outcome === "SUCCESS") {
    const ref = cut(body.referenceNumber, 100);
    if (!ref) throw new StoreSaleError("شماره پیگیری دستگاه را وارد کنید");
    return applyResult(id, { status: "SUCCESS", referenceNumber: ref });
  }
  if (body.outcome === "FAILED") return applyResult(id, { status: "FAILED", errorCode: "MANUAL", errorMessage: cut(body.note, 300) ?? "ناموفق (ثبت دستی)" });
  throw new StoreSaleError("نتیجه باید «موفق» یا «ناموفق» باشد");
}

/**
 * مهلت‌ها (تنبل، هر بار که فهرست/استعلام انجام شود): تراکنش برنامه‌ی صندوق که تا ۵ دقیقه گزارشی نیاورد ⇒ ممکن است دستگاه اجرا کرده باشد ⇒ «نامشخص»
 * (گزارش دیرهنگام هنوز پذیرفته می‌شود).
 */
export async function expireStale() {
  const clientKeys = Object.entries(DRIVERS).filter(([, d]) => d.runsOn === "CLIENT").map(([k]) => k);
  if (!clientKeys.length) return;
  const stale = await prisma.cardReaderTransaction.findMany({ where: { status: "PENDING", driver: { in: clientKeys as any }, createdAt: { lt: new Date(Date.now() - CLIENT_RESULT_TIMEOUT_MS) } }, select: { id: true } });
  for (const c of stale) await applyResult(c.id, { status: "UNKNOWN", errorCode: "CLIENT_TIMEOUT", errorMessage: "نتیجه‌ای از برنامه‌ی صندوق نرسید؛ وضعیت را روی دستگاه بررسی کنید" });
}
