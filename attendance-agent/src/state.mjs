import fs from "node:fs";
import path from "node:path";

// وضعیت عامل (agent.state.json): فقط «آخرین ردیف ارسال‌شده» (cursor) و آمار. cursor تنها پس از پذیرش موفق سرور جلو می‌رود؛ پس اگر اینترنت قطع یا سرور خطا بدهد،
// دور بعد دقیقاً از همان‌جا دوباره می‌فرستد (داده‌ها در دیتابیس کارت‌ساعت می‌مانند) و ارسال دوباره بی‌اثر است.

export function loadState(dir) {
  const file = path.join(dir, "agent.state.json");
  try {
    return { file, ...JSON.parse(fs.readFileSync(file, "utf8")) };
  } catch {
    return { file, cursor: null, sent: 0, lastOkAt: null, lastError: null };
  }
}

export function saveState(state) {
  const { file, ...rest } = state;
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(rest, null, 2));
  fs.renameSync(tmp, file);
}
