// درایور کارتخوان «پارسیان» (PEC / Intek PcPos) — ارتباط مستقیم TCP روی شبکه‌ی محلی (پورت پیش‌فرض 1362)، بدون DLL و .NET.
//
// ⚠️ وضعیت راستی‌آزمایی: قالب «درخواست خرید» با خروجی ابزار آزمون رسمی یکی است (آزمون واحد: test-parsian.mjs). قالب «پاسخ» مستند عمومی ندارد
// و از رفتار قبلی سرویس سام (موفق = وجود برچسب RN؛ کد خطا = RS) و برچسب‌های شناخته‌شده (RN مرجع، TR پیگیری، TM پایانه، PN کارت) برداشته شده است
// و هنوز روی دستگاه واقعی آزموده نشده است. برای همین هر ابهامی در پاسخ ⇒ «نامشخص» (نه موفق) تا پولی بی‌ثبت نماند و کاربر تعیین تکلیف کند.
//
// قالب پیام: [طول کل ۴رقمی][RQ][طول بدنه ۳رقمی] و سپس برچسب‌ها: [برچسب ۲حرفی][طول ۳رقمی][مقدار]؛ رمزگذاری Windows-1256.
//   خرید: PR=000000 (کد پردازش)، AM=مبلغ ریال، CU=364 (ریال)، PD=1.
//
// تنظیم دستگاه: آی‌پی (و در صورت نیاز پورت) در فرم کارتخوان ERP وارد می‌شود (این دستگاه پخش شناسایی ندارد).
import net from "node:net";

const CONNECT_TIMEOUT = 5000;
const RESPONSE_TIMEOUT = 180000; // کاربر کارت را می‌زند
const IDLE_AFTER_DATA = 1500; // پس از آخرین بسته‌ی دریافتی، این‌قدر سکوت = پایان پاسخ

const enc = new TextDecoder("windows-1256");

const tag = (name, value) => `${name}${String(value.length).padStart(3, "0")}${value}`;

/** درخواست خرید: برای مبلغ 1000 ⇒ 0039RQ034PR006000000AM0041000CU003364PD0011 (نمونه‌ی ابزار رسمی) */
export function buildPurchaseFrame(amountRial) {
  const body = tag("PR", "000000") + tag("AM", String(amountRial)) + tag("CU", "364") + tag("PD", "1");
  const msg = `RQ${String(body.length).padStart(3, "0")}${body}`;
  return `${String(msg.length).padStart(4, "0")}${msg}`;
}

/** برچسب‌های پاسخ را به‌صورت {برچسب: مقدار} برمی‌گرداند؛ تجزیه‌ی ترتیبی، و در صورت نشدن جستجوی ساده‌ی هر برچسب */
export function parseResponse(raw) {
  const out = {};
  const wanted = ["RN", "TR", "TM", "PN", "AM", "RS", "RC"];
  // ۱) ترتیبی: [طول۴][نوع۲][طول۳] سپس برچسب‌ها
  const m = /^(\d{4})([A-Z]{2})(\d{3})/.exec(raw);
  if (m) {
    let i = 4 + 2 + 3;
    const end = Math.min(raw.length, 4 + Number(m[1]));
    while (i + 5 <= end) {
      const name = raw.slice(i, i + 2);
      const len = Number(raw.slice(i + 2, i + 5));
      if (!/^[A-Z]{2}$/.test(name) || !Number.isInteger(len) || i + 5 + len > raw.length) break;
      out[name] = raw.slice(i + 5, i + 5 + len);
      i += 5 + len;
    }
  }
  // ۲) جایگزین: همان روش آزمون مرجع (اولین رخداد برچسب + طول سه‌رقمی)
  for (const t of wanted) {
    if (out[t] !== undefined) continue;
    const idx = raw.indexOf(t);
    if (idx <= 0) continue;
    const len = Number(raw.slice(idx + 2, idx + 5));
    if (!Number.isInteger(len) || idx + 5 + len > raw.length) continue;
    out[t] = raw.slice(idx + 5, idx + 5 + len);
  }
  return out;
}

export function maskCard(pan) {
  const d = String(pan || "").replace(/\s+/g, "");
  if (!d) return undefined;
  if (d.includes("*")) return d;
  if (d.length < 10) return "*".repeat(d.length);
  return `${d.slice(0, 6)}${"*".repeat(d.length - 10)}${d.slice(-4)}`;
}

/** نتیجه‌ی تجزیه‌شده را به وضعیت نهایی تبدیل می‌کند؛ هر ابهام ⇒ UNKNOWN */
export function decide(tags) {
  const rn = (tags.RN || "").trim();
  const rs = (tags.RS ?? tags.RC ?? "").trim();
  const ok = rs === "" || /^0+$/.test(rs);
  if (rn && ok) return { status: "SUCCESS", referenceNumber: rn, maskedCard: maskCard(tags.PN) };
  if (rn && !ok) return { status: "UNKNOWN", errorCode: `PEC_${rs}`, errorMessage: `پاسخ دستگاه پارسیان ناسازگار است (شماره مرجع ${rn} با کد ${rs}) — نتیجه را روی دستگاه بررسی کنید` };
  if (rs) return { status: "FAILED", errorCode: `PEC_${rs}`, errorMessage: `تراکنش ناموفق بود (کد ${rs})` };
  return { status: "UNKNOWN", errorCode: "PEC_NO_RESULT", errorMessage: "پاسخ دستگاه پارسیان قابل تشخیص نبود — نتیجه را روی دستگاه بررسی کنید" };
}

export const parsian = {
  /** send({ requestUid, amount, reader, config }) ⇒ نتیجه‌ی نهایی (SUCCESS | FAILED | UNKNOWN) */
  async send({ amount, config }) {
    const rial = Math.round(Number(amount));
    if (!Number.isFinite(rial) || rial < 1 || String(rial).length > 12) return { status: "FAILED", errorCode: "BAD_AMOUNT", errorMessage: "مبلغ نامعتبر است" };
    if (!config?.ip) return { status: "FAILED", errorCode: "NO_ADDRESS", errorMessage: "آی‌پی کارتخوان پارسیان را در فرم کارتخوان (ERP) وارد کنید" };
    const port = Number(config.port) || 1362;

    let sock;
    try {
      sock = await new Promise((resolve, reject) => {
        const s = net.createConnection({ host: config.ip, port });
        const t = setTimeout(() => {
          s.destroy();
          reject(new Error("CONNECT_TIMEOUT"));
        }, CONNECT_TIMEOUT);
        s.once("connect", () => {
          clearTimeout(t);
          s.setNoDelay(true);
          resolve(s);
        });
        s.once("error", (e) => {
          clearTimeout(t);
          reject(e);
        });
      });
    } catch (e) {
      return { status: "FAILED", errorCode: "NO_CONNECTION", errorMessage: `ارتباط با دستگاه برقرار نشد (${e.code || e.message})` };
    }

    // از لحظه‌ی نوشتن درخواست، نتیجه ممکن است در دستگاه شکل گرفته باشد
    return new Promise((resolve) => {
      let buf = Buffer.alloc(0);
      let idle = null;
      let done = false;
      const finish = (r) => {
        if (done) return;
        done = true;
        clearTimeout(idle);
        clearTimeout(deadline);
        try {
          sock.destroy();
        } catch {
          /* بسته شده */
        }
        resolve(r);
      };
      const fromBuffer = () => finish(decide(parseResponse(enc.decode(buf))));
      const deadline = setTimeout(() => finish({ status: "UNKNOWN", errorCode: "RESPONSE_TIMEOUT", errorMessage: "پاسخ دستگاه در زمان مقرر نرسید — نتیجه را روی دستگاه بررسی کنید" }), RESPONSE_TIMEOUT + 10000);
      sock.on("data", (c) => {
        buf = Buffer.concat([buf, c]);
        clearTimeout(idle);
        idle = setTimeout(fromBuffer, IDLE_AFTER_DATA);
      });
      sock.on("close", () => {
        if (done) return;
        if (buf.length) fromBuffer();
        else finish({ status: "UNKNOWN", errorCode: "CONNECTION_LOST", errorMessage: "ارتباط با دستگاه حین تراکنش قطع شد — نتیجه را روی دستگاه بررسی کنید" });
      });
      sock.on("error", () => {
        /* close بعد از آن می‌آید */
      });
      try {
        sock.write(Buffer.from(buildPurchaseFrame(rial), "latin1"));
      } catch (e) {
        finish({ status: "UNKNOWN", errorCode: "SEND_ERROR", errorMessage: `خطا حین ارسال به دستگاه: ${e.message}` });
      }
    });
  },
};

