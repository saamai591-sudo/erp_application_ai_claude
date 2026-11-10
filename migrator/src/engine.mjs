import fs from "node:fs";
import path from "node:path";
import { connectSam } from "./samClient.mjs";
import { ErpClient } from "./erpClient.mjs";
import { csvEscape } from "./util.mjs";
import { accounting } from "./modules/accounting.mjs";

/** ماژول‌های حوزه‌ها؛ حوزه‌ی تازه = یک فایل در modules/ + یک خط اینجا */
export const MODULES = { accounting };

/** گردآوری هشدار/خطا/آمار یک اجرا و نوشتن گزارش‌ها در پوشه‌ی reports/<زمان>/ */
export class Reporter {
  constructor(dir) {
    this.dir = dir;
    this.rows = { warnings: [], errors: [], reconcile: [] };
    this.stats = {};
  }
  add(kind, row) {
    this.rows[kind].push(row);
  }
  stat(key, value) {
    this.stats[key] = value;
  }
  write() {
    if (!this.dir) return;
    fs.mkdirSync(this.dir, { recursive: true });
    for (const [kind, rows] of Object.entries(this.rows)) {
      if (!rows.length) continue;
      const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
      const body = [cols.join(","), ...rows.map((r) => cols.map((c) => csvEscape(r[c])).join(","))].join("\r\n");
      fs.writeFileSync(path.join(this.dir, `${kind}.csv`), "﻿" + body);
    }
    fs.writeFileSync(path.join(this.dir, "summary.json"), JSON.stringify({ stats: this.stats, counts: Object.fromEntries(Object.entries(this.rows).map(([k, v]) => [k, v.length])) }, null, 2));
  }
}

export async function connectBoth({ config, secrets, log, samClient, dryRun = false }) {
  log("step", "اتصال به سام…");
  const sam = samClient ?? (await connectSam({ ...config.sam, password: secrets.samPassword }));
  log("info", `سام متصل شد (${config.sam.server} / ${config.sam.database})`);
  log("step", "ورود به ERP…");
  const erp = new ErpClient(config.erp.url);
  try {
    await erp.login(config.erp.mobile, secrets.erpPassword);
    log("info", `ERP متصل شد (${config.erp.url})`);
  } catch (e) {
    // در حالت آزمایشی ERP لازم نیست (فقط سام خوانده و نگاشت‌ها بررسی می‌شود)
    if (!dryRun) throw e;
    erp.offline = true;
    log("warn", `ورود به ERP ممکن نشد (${e.message}) — حالت آزمایشی بدون ERP ادامه می‌یابد`);
  }
  return { sam, erp };
}

/**
 * اجرای مهاجرت. log(level, message): level یکی از step | info | warn | error | progress
 * dryRun: فقط خواندن از سام و بررسی نگاشت‌ها؛ هیچ‌چیزی به ERP نوشته نمی‌شود.
 */
export async function runMigration({ config, secrets, dryRun = false, cutover = null, modules, log = () => {}, reportDir = null, samClient = null }) {
  const names = modules?.length ? modules : config.modules ?? ["accounting"];
  for (const n of names) if (!MODULES[n]) throw new Error(`ماژول «${n}» وجود ندارد (${Object.keys(MODULES).join("، ")})`);
  const { sam, erp } = await connectBoth({ config, secrets, log, samClient, dryRun });
  const report = new Reporter(reportDir);
  const ctx = { sam, erp, config, dryRun, cutover, log, report, batchSize: config.batchSize ?? 200 };
  const started = Date.now();
  try {
    for (const n of names) {
      log("step", `══ ماژول ${MODULES[n].title}${dryRun ? " (آزمایشی)" : ""} ══`);
      await MODULES[n].run(ctx);
    }
  } finally {
    report.stat("durationSec", Math.round((Date.now() - started) / 1000));
    report.stat("dryRun", dryRun);
    report.stat("cutover", cutover);
    report.write();
    await sam.close().catch(() => {});
  }
  if (reportDir) log("info", `گزارش‌ها: ${reportDir}`);
  return report;
}

/** فقط اتصال و بررسی سازگاری (بدون هیچ نوشتنی) */
export async function checkConnections({ config, secrets, log = () => {} }) {
  const { sam, erp } = await connectBoth({ config, secrets, log });
  try {
    const state = await erp.state();
    const [v] = await sam.query("SELECT COUNT(*) AS n FROM ACC.Voucher");
    return { erp: state, samVouchers: v.n };
  } finally {
    await sam.close().catch(() => {});
  }
}
