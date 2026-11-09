// درایور کارتخوان «سداد» (PcPos) — ارتباط مستقیم TCP با دستگاه در شبکه‌ی محلی (پورت ثابت 8888).
// پیاده‌سازی بر پایه‌ی سند «PcPos Protocol» (نسخه‌ی 1.6) شرکت پرداخت الکترونیک سداد؛ هیچ DLL یا .NET لازم نیست.
//
// جریان خرید: اتصال → INM ⇒ ACK → Request (مبلغ + شناسه‌ی درخواست) ⇒ ACK → (کاربر کارت را می‌زند، تا ۱۸۰ ثانیه) → Response → ACK → قطع.
// قاعده‌ی قطعیت (هماهنگ با سرور): تا قبل از ارسال Request، هر خطا ⇒ FAILED (چیزی به دستگاه نرفته)؛
//   بعد از ارسال Request و بدون پاسخ قطعی ⇒ UNKNOWN، و قبل از برگرداندن، یک استعلام با شناسه‌ی درخواست انجام می‌شود (در صورت یافتن، نتیجه‌ی قطعی).
// امنیت: شماره‌ی کارت فقط به‌صورت پوشانده (۶ رقم اول و ۴ رقم آخر) برگردانده می‌شود و هیچ‌جا لاگ نمی‌شود.
//
// تنظیم دستگاه (config.json عامل، بخش readers[<شناسه‌ی کارتخوان در ERP>]): { "ip": "172.16.32.67", "port": 8888 }
//   اگر ip نیامده باشد، دستگاه با «شماره‌ی پایانه‌ی» ثبت‌شده در ERP از روی پخش UDP خودش (پورت 100 و 8010) پیدا می‌شود؛
//   پس تغییر آی‌پی دستگاه (DHCP) مشکلی ایجاد نمی‌کند.
import net from "node:net";
import dgram from "node:dgram";

const STX = 0x02;
const ETX = 0x03;
const T_EOT = 0x04;
const T_ACK = 0x06;
const T_NACK = 0x15;
const T_REQUEST = 0x19;
const T_RESPONSE = 0x1a;
const T_INM = 0xf1;

const CONNECT_TIMEOUT = 5000;
const ACK_TIMEOUT = 5000;
const RESPONSE_TIMEOUT = 180000;
const RETRIES = 3;
const API_VERSION_TEXT = "5.3.185.1336"; // مشخصه‌ی ۸ (نسخه‌ی رابط) — مقدار نمونه‌ی خود سند

const ascii = (s) => Buffer.from(s, "latin1");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** LRC: XOR همه‌ی بایت‌ها از «طول پیام» تا پایان داده، سپس XOR با ETX */
export function lrc(buf) {
  let x = 0;
  for (const b of buf) x ^= b;
  return (x ^ ETX) & 0xff;
}

/** ساخت فریم: STX + طول(3 رقم) + نسخه(3 رقم) + نوع + داده + ETX + LRC */
export function buildFrame(version, type, data = Buffer.alloc(0)) {
  const len = String(3 + 1 + data.length + 1 + 1).padStart(3, "0");
  const body = Buffer.concat([ascii(len), ascii(version), Buffer.from([type]), data]);
  return Buffer.concat([Buffer.from([STX]), body, Buffer.from([ETX, lrc(body)])]);
}

/** داده‌ی Request خرید (نسخه‌ی SADAD = 000). orderId = شناسه‌ی درخواست (مشخصه‌ی ۵) برای پیگیری/استعلام */
export function buildSaleData(amountRial, orderId) {
  const amount = Buffer.alloc(13); // مبلغ، راست‌پر با NUL
  amount.write(String(amountRial), "latin1");
  const opts = [];
  let bitmap = 0;
  if (orderId) {
    bitmap |= 1 << 4; // مشخصه‌ی ۵
    opts.push(ascii(String(orderId.length).padStart(3, "0") + orderId));
  }
  bitmap |= 1 << 7; // مشخصه‌ی ۸: نسخه‌ی رابط
  opts.push(ascii(String(API_VERSION_TEXT.length).padStart(3, "0") + API_VERSION_TEXT));
  return Buffer.concat([
    amount,
    ascii(" ".repeat(10)), // شماره‌ی فاکتور (بی‌کاربرد)
    ascii(" ".repeat(4)), // کد عملیاتی (بی‌کاربرد)
    ascii("0200"), // نوع پیام
    ascii("000000"), // کد پردازش خرید
    Buffer.from([bitmap]),
    ...opts,
  ]);
}

/** شناسه‌ی درخواست عددی و پایدار از requestUid (همان مقدار هنگام استعلام دوباره ساخته می‌شود) */
export function orderIdOf(requestUid) {
  const hex = String(requestUid).replace(/[^0-9a-f]/gi, "");
  if (!hex) return "";
  return (BigInt("0x" + hex) % 1_000_000_000_000_000n).toString().padStart(15, "0");
}

const U = (buf, off, chars) => buf.toString("utf16le", off, off + chars * 2).replace(/\0+/g, "").trim();

/** تجزیه‌ی داده‌ی Response خرید (همه‌ی مشخصه‌ها Unicode LE؛ طول‌ها به «کاراکتر») */
export function parseSaleResponse(data) {
  const need = 137 * 2;
  const d = data.length >= need ? data : Buffer.concat([data, Buffer.alloc(need - data.length)]);
  let o = 0;
  const take = (n) => {
    const s = U(d, o, n);
    o += n * 2;
    return s;
  };
  const posResponse = take(4);
  const amount = take(13);
  const cardNo = take(17);
  const processingCode = take(7);
  const transactionNo = take(7);
  take(6); // تاریخ تراکنش (خالی؛ تاریخ در فیلد زمان است)
  o += 16; // زمان تراکنش (آرایه‌ی ۸ short)؛ برای ERP لازم نیست
  const rrn = take(13);
  const approvalCode = take(7);
  const terminalId = take(9);
  const merchantId = take(16);
  const optionalField = take(30);
  return { posResponse, amount, cardNo, processingCode, transactionNo, rrn, approvalCode, terminalId, merchantId, optionalField };
}

export function maskCard(pan) {
  const digits = String(pan || "").replace(/\s+/g, "");
  if (!digits) return undefined;
  if (digits.includes("*")) return digits; // دستگاه خودش پوشانده است
  if (digits.length < 10) return "*".repeat(digits.length);
  return `${digits.slice(0, 6)}${"*".repeat(digits.length - 10)}${digits.slice(-4)}`;
}

/** خواننده‌ی فریم روی یک سوکت: فریم کامل بعدی را برمی‌گرداند یا null در صورت پایان زمان */
class FrameReader {
  constructor(sock) {
    this.buf = Buffer.alloc(0);
    this.waiters = [];
    this.closed = false;
    sock.on("data", (c) => {
      this.buf = Buffer.concat([this.buf, c]);
      this.pump();
    });
    const done = () => {
      this.closed = true;
      this.pump();
    };
    sock.on("close", done);
    sock.on("error", done);
  }
  tryExtract() {
    for (;;) {
      const s = this.buf.indexOf(STX);
      if (s < 0) {
        this.buf = Buffer.alloc(0);
        return null;
      }
      if (s > 0) this.buf = this.buf.subarray(s);
      if (this.buf.length < 4) return null;
      const len = Number(this.buf.subarray(1, 4).toString("latin1"));
      if (!Number.isInteger(len) || len < 6) {
        this.buf = this.buf.subarray(1); // STX کاذب
        continue;
      }
      const total = 4 + len;
      if (this.buf.length < total) return null;
      const frame = this.buf.subarray(0, total);
      this.buf = this.buf.subarray(total);
      const body = frame.subarray(1, total - 2);
      const okLrc = frame[total - 2] === ETX && frame[total - 1] === lrc(body);
      return { version: frame.subarray(4, 7).toString("latin1"), type: frame[7], data: frame.subarray(8, total - 2), okLrc };
    }
  }
  pump() {
    while (this.waiters.length) {
      const f = this.tryExtract();
      if (f) {
        this.waiters.shift().resolve(f);
        continue;
      }
      if (this.closed) this.waiters.shift().resolve(null);
      break;
    }
  }
  next(timeoutMs) {
    return new Promise((resolve) => {
      const w = { resolve: (v) => (clearTimeout(w.t), resolve(v)) };
      w.t = setTimeout(() => {
        this.waiters = this.waiters.filter((x) => x !== w);
        resolve(undefined); // undefined = پایان زمان؛ null = قطع ارتباط
      }, timeoutMs);
      this.waiters.push(w);
      this.pump();
    });
  }
}

function connect(ip, port) {
  return new Promise((resolve, reject) => {
    const sock = net.createConnection({ host: ip, port });
    const t = setTimeout(() => {
      sock.destroy();
      reject(new Error("CONNECT_TIMEOUT"));
    }, CONNECT_TIMEOUT);
    sock.once("connect", () => {
      clearTimeout(t);
      sock.setNoDelay(true);
      resolve(sock);
    });
    sock.once("error", (e) => {
      clearTimeout(t);
      reject(e);
    });
  });
}

/** اتصال + دست‌دهی INM؛ اگر موفق نشود هیچ چیزی به دستگاه نرفته است */
async function openSession(ip, port) {
  let lastErr = "";
  for (let i = 0; i < RETRIES; i++) {
    let sock;
    try {
      sock = await connect(ip, port);
    } catch (e) {
      lastErr = e.code || e.message;
      await sleep(500);
      continue;
    }
    const reader = new FrameReader(sock);
    sock.write(buildFrame("000", T_INM));
    const f = await reader.next(ACK_TIMEOUT);
    if (f && f.okLrc && f.type === T_ACK) return { sock, reader };
    lastErr = f === undefined ? "INM_NO_ACK" : f === null ? "CLOSED" : f.type === T_NACK ? "INM_NACK" : "INM_BAD";
    sock.destroy();
    await sleep(500);
  }
  const err = new Error(lastErr || "NO_CONNECTION");
  err.code = "NO_CONNECTION";
  throw err;
}

/** پیدا کردن آی‌پی دستگاه با شماره‌ی پایانه از روی پخش UDP دستگاه */
export function discover(terminalNumber, timeoutMs = 4000) {
  const want = String(terminalNumber || "").replace(/^0+/, "");
  return new Promise((resolve) => {
    const socks = [];
    const finish = (v) => {
      clearTimeout(timer);
      for (const s of socks) {
        try {
          s.close();
        } catch {
          /* بسته شده */
        }
      }
      resolve(v);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    for (const p of [100, 8010]) {
      const s = dgram.createSocket({ type: "udp4", reuseAddr: true });
      s.on("error", () => {});
      s.on("message", (m, rinfo) => {
        const parts = m.toString("utf8").split(":");
        if (parts[0] !== "SADAD PCPOS" || parts.length < 7) return;
        const [ip, port, terminalId, merchantId, model] = parts.slice(-5);
        if (!want || terminalId.replace(/^0+/, "") === want) finish({ ip: ip || rinfo.address, port: Number(port) || 8888, terminalId, merchantId, model, name: parts.slice(1, -5).join(":") });
      });
      try {
        s.bind(p);
      } catch {
        /* پورت در دسترس نیست */
      }
      socks.push(s);
    }
  });
}

/** همه‌ی دستگاه‌های سداد که در این مدت روی شبکه پخش می‌کنند (برای انتخاب در فرم کارتخوان): [{ ip, port, terminalId, merchantId, model, name }] */
export function discoverAll(timeoutMs = 4000) {
  return new Promise((resolve) => {
    const found = new Map();
    const socks = [];
    const timer = setTimeout(() => {
      for (const s of socks) {
        try {
          s.close();
        } catch {
          /* بسته شده */
        }
      }
      resolve([...found.values()].sort((a, b) => a.ip.localeCompare(b.ip, undefined, { numeric: true })));
    }, timeoutMs);
    timer.unref?.();
    for (const p of [100, 8010]) {
      const s = dgram.createSocket({ type: "udp4", reuseAddr: true });
      s.on("error", () => {});
      s.on("message", (m, rinfo) => {
        const parts = m.toString("utf8").split(":");
        if (parts[0] !== "SADAD PCPOS" || parts.length < 7) return;
        const [ip, port, terminalId, merchantId, model] = parts.slice(-5);
        // آی‌پی پخش‌شده گاهی با صفر پیشرو است (172.016.032.067)؛ عادی‌سازی می‌شود
        const cleanIp = (ip || rinfo.address).split(".").map((x) => String(Number(x))).join(".");
        found.set(`${cleanIp}|${terminalId}`, { ip: cleanIp, port: Number(port) || 8888, terminalId, merchantId, model, name: parts.slice(1, -5).join(":") });
      });
      try {
        s.bind(p);
      } catch {
        /* پورت در دسترس نیست */
      }
      socks.push(s);
    }
  });
}

async function resolveAddress(reader, config) {
  const port = Number(config?.port) || 8888;
  if (config?.ip) return { ip: String(config.ip), port };
  const found = await discover(reader?.terminalNumber);
  if (!found) {
    const err = new Error(`دستگاه با شماره‌ی پایانه‌ی «${reader?.terminalNumber ?? ""}» در شبکه پیدا نشد (آی‌پی را در config.json عامل بنویسید)`);
    err.code = "NOT_FOUND";
    throw err;
  }
  return { ip: found.ip, port: found.port || port };
}

/** استعلام نتیجه با شناسه‌ی درخواست (FunctionCode 0017 ⇒ پاسخ 0018). فقط خواندنی است. */
export async function inquireByOrderId(ip, port, orderId) {
  let session;
  try {
    session = await openSession(ip, port);
    const data = Buffer.concat([ascii("0017"), ascii(String(orderId.length + 2).padStart(3, "0")), ascii(String(orderId.length).padStart(2, "0") + orderId)]);
    session.sock.write(buildFrame("002", T_REQUEST, data));
    const ack = await session.reader.next(ACK_TIMEOUT);
    if (!ack || ack.type !== T_ACK) return null;
    const resp = await session.reader.next(15000);
    if (!resp || resp.type !== T_RESPONSE) return null;
    session.sock.write(buildFrame("000", T_ACK));
    const text = resp.data.toString("latin1");
    // 0018 + طول(3) + [نوع n2][مبلغ n12][شماره n6][تاریخ n8][زمان n6][کارت n12][RRN n12][کد پاسخ n2][شناسه n..99]
    if (!text.startsWith("0018")) return { raw: text };
    const body = text.slice(7);
    if (body.length < 58) return { found: false, raw: text };
    return { found: true, type: body.slice(0, 2), amount: body.slice(2, 14), rrn: body.slice(46, 58).replace(/^0+(?=\d)/, ""), responseCode: body.slice(58, 60), raw: text };
  } catch {
    return null;
  } finally {
    try {
      session?.sock.destroy();
    } catch {
      /* بسته شده */
    }
  }
}

/** اطلاعات دستگاه (FunctionCode 0005) — بدون هیچ تراکنش مالی؛ برای آزمایش اتصال */
export async function deviceInfo(ip, port = 8888) {
  const session = await openSession(ip, port);
  try {
    session.sock.write(buildFrame("002", T_REQUEST, ascii("0005000")));
    const ack = await session.reader.next(ACK_TIMEOUT);
    if (!ack || ack.type !== T_ACK) throw new Error("NO_ACK");
    const resp = await session.reader.next(10000);
    if (!resp || resp.type !== T_RESPONSE) throw new Error("NO_RESPONSE");
    session.sock.write(buildFrame("000", T_ACK));
    const text = resp.data.toString("utf8");
    return text.replace(/^0006\d{3}/, "");
  } finally {
    session.sock.destroy();
  }
}

export const sadad = {
  /** send({ requestUid, amount, reader, config }) ⇒ نتیجه‌ی نهایی (SUCCESS | FAILED | UNKNOWN) */
  async send({ requestUid, amount, reader, config }) {
    const rial = Math.round(Number(amount));
    if (!Number.isFinite(rial) || rial < 1 || String(rial).length > 12) return { status: "FAILED", errorCode: "BAD_AMOUNT", errorMessage: "مبلغ نامعتبر است" };
    let addr;
    try {
      addr = await resolveAddress(reader, config);
    } catch (e) {
      return { status: "FAILED", errorCode: e.code || "NO_ADDRESS", errorMessage: e.message };
    }
    const orderId = orderIdOf(requestUid);

    let session;
    try {
      session = await openSession(addr.ip, addr.port);
    } catch (e) {
      return { status: "FAILED", errorCode: "NO_CONNECTION", errorMessage: `ارتباط با دستگاه برقرار نشد (${e.message})` };
    }

    let sent = false; // از لحظه‌ی نوشتن Request به بعد، نتیجه ممکن است در دستگاه شکل گرفته باشد
    const unknown = async (code, message) => {
      let r = null;
      try {
        session.sock.destroy();
      } catch {
        /* بسته شده */
      }
      await sleep(1500);
      if (orderId) r = await inquireByOrderId(addr.ip, addr.port, orderId);
      if (r?.found && r.rrn) {
        if (r.responseCode === "00") return { status: "SUCCESS", referenceNumber: r.rrn };
        return { status: "FAILED", errorCode: `POS_${r.responseCode}`, errorMessage: `تراکنش در دستگاه ناموفق ثبت شده است (کد ${r.responseCode})` };
      }
      return { status: "UNKNOWN", errorCode: code, errorMessage: message };
    };

    try {
      session.sock.write(buildFrame("000", T_REQUEST, buildSaleData(rial, orderId)));
      sent = true;
      const ack = await session.reader.next(ACK_TIMEOUT);
      if (ack && ack.type === T_NACK) {
        session.sock.destroy();
        return { status: "FAILED", errorCode: "REQUEST_NACK", errorMessage: "دستگاه درخواست را نپذیرفت (ممکن است در حال انجام تراکنش دیگری باشد)" };
      }
      if (!ack || ack.type !== T_ACK) return unknown("NO_REQUEST_ACK", "تأییدیه‌ی دریافت درخواست از دستگاه نرسید");

      // انتظار برای پاسخ نهایی (کاربر کارت را می‌زند)
      const deadline = Date.now() + RESPONSE_TIMEOUT + 10000;
      for (;;) {
        const left = deadline - Date.now();
        if (left <= 0) return unknown("RESPONSE_TIMEOUT", "پاسخ دستگاه در زمان مقرر نرسید");
        const f = await session.reader.next(left);
        if (f === undefined) return unknown("RESPONSE_TIMEOUT", "پاسخ دستگاه در زمان مقرر نرسید");
        if (f === null) return unknown("CONNECTION_LOST", "ارتباط با دستگاه حین تراکنش قطع شد");
        if (!f.okLrc) {
          session.sock.write(buildFrame("000", T_NACK));
          continue;
        }
        if (f.type === T_EOT) {
          session.sock.destroy();
          return { status: "FAILED", errorCode: "CANCELLED_AT_POS", errorMessage: "تراکنش در دستگاه لغو شد" };
        }
        if (f.type !== T_RESPONSE) continue; // ACK تأخیری و مانند آن
        session.sock.write(buildFrame("000", T_ACK));
        const r = parseSaleResponse(f.data);
        session.sock.end();
        if (r.posResponse === "00" && r.rrn) return { status: "SUCCESS", referenceNumber: r.rrn, maskedCard: maskCard(r.cardNo) };
        return { status: "FAILED", errorCode: `POS_${r.posResponse || "ERR"}`, errorMessage: r.optionalField || `تراکنش ناموفق بود (کد پاسخ ${r.posResponse || "نامشخص"})` };
      }
    } catch (e) {
      if (!sent) {
        try {
          session.sock.destroy();
        } catch {
          /* بسته شده */
        }
        return { status: "FAILED", errorCode: "SEND_ERROR", errorMessage: `ارسال به دستگاه ناموفق بود (${e.message})` };
      }
      return unknown("DRIVER_ERROR", `خطا بعد از ارسال به دستگاه: ${e.message}`);
    }
  },
};

