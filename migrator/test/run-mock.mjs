import { runMigration } from "../src/engine.mjs";
import { makeMockSam } from "./mockSam.mjs";

// تست موتور با سام جعلی روی یک ERP آزمایشی (ERP_URL، ERP_MOBILE، ERP_PASSWORD از محیط)
const config = {
  sam: { server: "mock", database: "mock", user: "x" },
  erp: { url: process.env.ERP_URL ?? "http://127.0.0.1:4010", mobile: process.env.ERP_MOBILE ?? "0999999999" },
  batchSize: 2,
};
const dryRun = process.argv.includes("--dry-run");
const cutover = process.argv.find((a) => a.startsWith("--cutover="))?.split("=")[1] ?? null;
const report = await runMigration({
  config,
  secrets: { samPassword: "", erpPassword: process.env.ERP_PASSWORD ?? "Admin@123" },
  dryRun,
  cutover,
  samClient: makeMockSam(),
  log: (l, m) => console.log(`[${l}] ${m}`),
  reportDir: `reports/mock${dryRun ? "-dry" : ""}`,
});
console.log(JSON.stringify(report.stats), report.rows.errors.length, "errors", report.rows.warnings.length, "warnings");
