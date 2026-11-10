#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { checkConnections, runMigration, MODULES } from "./engine.mjs";
import { ask, askSecret, parseCutover } from "./util.mjs";

// استفاده:
//   node src/cli.mjs check                         اتصال به سام و ERP + نمایش وضعیت (بدون نوشتن)
//   node src/cli.mjs run --dry-run                 خواندن از سام و بررسی نگاشت‌ها (بدون نوشتن در ERP)
//   node src/cli.mjs run [--cutover 1405/08/19] [--module accounting]
//   گزینه‌ها: --config فایل (پیش‌فرض migrator.config.json)، --yes (بدون پرسش تأیید)
// رمزها هر بار در ترمینال پرسیده می‌شوند (برای تست خودکار: SAM_PASSWORD و ERP_PASSWORD در محیط).

const args = process.argv.slice(2);
const cmd = args[0] && !args[0].startsWith("--") ? args[0] : "help";
const flag = (n) => args.includes(`--${n}`);
const opt = (n) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const colors = { step: "\x1b[36m", warn: "\x1b[33m", error: "\x1b[31m", info: "", progress: "\x1b[90m" };
const log = (level, msg) => {
  if (level === "progress" && process.stdout.isTTY) process.stdout.write(`\r\x1b[K${colors.progress}${msg}\x1b[0m`);
  else console.log(`${colors[level] ?? ""}${msg}${level === "info" ? "" : "\x1b[0m"}`);
  if (level !== "progress" && process.stdout.isTTY) process.stdout.write("");
};

function loadConfig() {
  const file = path.resolve(opt("config") ?? "migrator.config.json");
  if (!fs.existsSync(file)) {
    console.error(`فایل پیکربندی پیدا نشد: ${file}\nنمونه: migrator.config.example.json را کپی و ویرایش کنید.`);
    process.exit(2);
  }
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^﻿/, ""));
}

async function secrets(config) {
  return {
    samPassword: process.env.SAM_PASSWORD ?? (await askSecret(`رمز کاربر ${config.sam.user} سام: `)),
    erpPassword: process.env.ERP_PASSWORD ?? (await askSecret(`رمز کاربر ERP (${config.erp.mobile}): `)),
  };
}

async function main() {
  if (cmd === "help") {
    console.log("دستورها: check | run [--dry-run] [--cutover تاریخ] [--module نام] [--config فایل] [--yes]\nماژول‌ها: " + Object.keys(MODULES).join("، "));
    return;
  }
  const config = loadConfig();
  if (cmd === "check") {
    const r = await checkConnections({ config, secrets: await secrets(config), log });
    console.log(`سام: ${r.samVouchers} سند | ERP: طرح ${r.erp.schemaVersion}، ${r.erp.counts.accounts} حساب، ${r.erp.counts.journalEntries} سند، ${r.erp.fiscalPeriods.length} دوره مالی`);
    return;
  }
  if (cmd !== "run") throw new Error(`دستور ناشناخته: ${cmd}`);

  const dryRun = flag("dry-run");
  // رمزها اول پرسیده می‌شوند (ترتیب ثابت: سام، ERP، بعد تاریخ قطع) تا رمز اشتباهی در جای تاریخ تایپ نشود
  const pass = await secrets(config);
  let cutoverInput = opt("cutover");
  if (cutoverInput === undefined && !flag("yes")) cutoverInput = await ask("تاریخ قطع سام (آخرین روزی که سند سام منتقل شود؛ جلالی 1405/08/19 یا میلادی؛ خالی = همه‌ی اسناد): ");
  const cutover = parseCutover(cutoverInput ?? "");
  const modules = opt("module") ? [opt("module")] : undefined;

  if (!dryRun && !flag("yes")) {
    const a = await ask(`اسناد سام${cutover ? ` تا ${cutover}` : ""} به ERP «${config.erp.url}» منتقل می‌شود. ادامه می‌دهید؟ (yes/no): `);
    if (a.toLowerCase() !== "yes") {
      console.log("لغو شد.");
      return;
    }
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const reportDir = path.resolve("reports", `${stamp}${dryRun ? "-dry" : ""}`);
  const report = await runMigration({ config, secrets: pass, dryRun, cutover, modules, log, reportDir });
  console.log("");
  const c = Object.fromEntries(Object.entries(report.rows).map(([k, v]) => [k, v.length]));
  console.log(`پایان — خطا: ${c.errors}، هشدار: ${c.warnings}`);
  process.exitCode = c.errors ? 1 : 0;
}

main().catch((e) => {
  console.error("\n\x1b[31mخطا: " + (e?.message ?? e) + "\x1b[0m");
  process.exitCode = 1;
  setTimeout(() => process.exit(1), 300).unref();
});
