// هسته‌ی عامل محلی: پل ارتباطی بین سرور ERP و کارتخوان‌های شبکه‌ی محل.
// هر چند ثانیه از سرور دستورهای کارتخوان را می‌گیرد (اتصال خروجی؛ هیچ پورتی باز نمی‌شود) و نتیجه را برمی‌گرداند.
// تصمیم‌گیری، قفل‌ها و ساخت دریافت فقط در سرور است. چاپ دیگر کار عامل نیست: برنامه‌ی صندوق (pos-app) مستقیم روی چاپگر ویندوز چاپ می‌کند.
// این هسته دو جا استفاده می‌شود: agent.mjs (اجرای مستقل با Node برای توسعه) و pos-app (Electron).

import fs from "node:fs";
import path from "node:path";
import { DRIVERS } from "./drivers/index.mjs";

export function createAgent({ serverUrl, token, pollMs = 2000, readers = {}, dataDir, version = "1.3.0", onStatus }) {
  const SERVER = String(serverUrl || "").replace(/\/+$/, "");
  const TOKEN = String(token || "");
  const POLL_MS = Math.max(1000, Number(pollMs) || 2000);
  const PENDING_FILE = path.join(dataDir, "pending-results.json");
  const LOG_FILE = path.join(dataDir, "agent.log");
  fs.mkdirSync(dataDir, { recursive: true });

  function log(msg) {
    const line = `${new Date().toISOString()} ${msg}`;
    console.log(line);
    try {
      if (fs.existsSync(LOG_FILE) && fs.statSync(LOG_FILE).size > 2_000_000) fs.renameSync(LOG_FILE, LOG_FILE + ".old");
      fs.appendFileSync(LOG_FILE, line + "\n");
    } catch {
      /* لاگ فایلی اختیاری است */
    }
  }

  let state = { online: false, error: "" };
  function setState(online, error = "") {
    if (state.online === online && state.error === error) return;
    state = { online, error };
    try {
      onStatus?.(state);
    } catch {
      /* ادامه */
    }
  }

  async function call(pathname, body) {
    const res = await fetch(`${SERVER}/api${pathname}`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify(body ?? {}),
      signal: AbortSignal.timeout(15000),
    });
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      /* پاسخ غیر JSON */
    }
    if (!res.ok) {
      const err = new Error(json?.error || `HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return json;
  }

  // نتایج ارسال‌نشده (قطع شبکه / خاموشی ناگهانی) روی دیسک می‌ماند تا بعداً ارسال شود. هر مورد: { path, body }
  let pending = [];
  try {
    pending = JSON.parse(fs.readFileSync(PENDING_FILE, "utf8"));
    pending = pending.filter((p) => p.path && !String(p.path).startsWith("/agent/print-jobs/")); // مسیر قدیمی چاپ با عامل
  } catch {
    pending = [];
  }
  const savePending = () => {
    try {
      fs.writeFileSync(PENDING_FILE, JSON.stringify(pending));
    } catch {
      /* ادامه */
    }
  };

  async function flushPending() {
    for (const p of [...pending]) {
      try {
        await call(p.path, p.body);
        pending = pending.filter((x) => x !== p);
        savePending();
        log(`نتیجه‌ی ${p.path} به سرور رسید`);
      } catch (e) {
        // خطای قطعی سرور را تکرار نکن؛ خطای شبکه را بعداً دوباره
        if (e.status && e.status >= 400 && e.status < 500 && e.status !== 408 && e.status !== 429) {
          log(`نتیجه‌ی ${p.path} توسط سرور رد شد (${e.message}) و کنار گذاشته شد`);
          pending = pending.filter((x) => x !== p);
          savePending();
        } else {
          return;
        }
      }
    }
  }

  function queueResult(pathname, body) {
    pending.push({ path: pathname, body });
    savePending();
    return flushPending();
  }

  // ─── دستور کارتخوان ───
  async function handleCommand(cmd) {
    const key = String(cmd.reader?.id);
    let body;
    try {
      const driver = DRIVERS[cmd.driver];
      if (!driver) {
        body = { status: "FAILED", errorCode: "NO_DRIVER", errorMessage: `درایور «${cmd.driver}» روی این عامل پشتیبانی نمی‌شود` };
      } else {
        log(`دستور ${cmd.commandId}: ارسال ${cmd.amount} به «${cmd.reader?.title}» (${cmd.driver})`);
        const devCfg = (readers && readers[key]) || {};
        body = await driver.send({ requestUid: cmd.requestUid, amount: cmd.amount, reader: cmd.reader, config: devCfg });
      }
    } catch (e) {
      // خطا بعد از رسیدن دستور به درایور: ممکن است دستگاه اجرا کرده باشد ⇒ نامشخص (نه ناموفق)
      body = { status: "UNKNOWN", errorCode: "AGENT_DRIVER_ERROR", errorMessage: String(e?.message || e).slice(0, 300) };
    }
    log(`دستور ${cmd.commandId}: نتیجه ${body.status}${body.referenceNumber ? " " + body.referenceNumber : ""}`);
    await queueResult(`/agent/commands/${cmd.commandId}/result`, body);
  }

  let stopping = false;
  let running = null;
  async function loop() {
    log(`عامل محلی ${version} شروع شد؛ سرور: ${SERVER}`);
    let lastErr = "";
    while (!stopping) {
      try {
        await flushPending();
        const r = await call("/agent/poll", { version });
        lastErr = "";
        setState(true);
        for (const cmd of r?.commands ?? []) {
          if (cmd.kind !== "SEND") continue;
          handleCommand(cmd).catch((e) => log(`خطای پردازش دستور ${cmd.commandId}: ${e.message}`));
        }
      } catch (e) {
        const msg = e.status === 401 ? "توکن نامعتبر است" : e.message;
        if (msg !== lastErr) log(`ارتباط با سرور ناموفق: ${e.message}`);
        lastErr = msg;
        setState(false, msg);
        if (e.status === 401) log("توکن نامعتبر است؛ در ERP توکن را تعویض و در تنظیمات برنامه به‌روز کنید");
      }
      await new Promise((r) => setTimeout(r, POLL_MS));
    }
    log("عامل متوقف شد");
  }

  return {
    start() {
      if (!SERVER || !TOKEN) throw new Error("serverUrl و token الزامی است");
      stopping = false;
      running = loop();
      return running;
    },
    async stop() {
      stopping = true;
      await running;
    },
    log,
  };
}
