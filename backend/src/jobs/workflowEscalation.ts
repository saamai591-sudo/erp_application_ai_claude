import { processDeadlines } from "../services/workflowEngineService";
import { defineJob } from "./types";

// «یادآوری و تشدید کارتابل»: کارهای بازِ دارای یادآوریِ سررسیدشده یا مهلتِ گذشته را اطلاعیه می‌دهد (یادآوری به مسئول‌ها، عقب‌افتادگی به مسئول‌ها و کاربر/نقشِ تشدید).
// منطق همان processDeadlines است که خواندنِ شمارنده‌ی کارتابل هم (حداکثر دقیقه‌ای یک‌بار) اجرا می‌کند؛ این کار فقط تضمین می‌کند حتی بدون ورود کاربر اجرا شود.
// هر اطلاعیه فقط یک‌بار ساخته می‌شود، پس اجرای مکرر بی‌ضرر است.
export default defineJob({
  key: "workflow-escalation",
  title: "یادآوری و تشدید کارهای کارتابل",
  description: "اطلاعیه‌ی یادآوری مهلت و تشدید کارهای عقب‌افتاده‌ی کارتابل را می‌سازد. در حالت آزمایشی فقط می‌شمارد و چیزی نمی‌سازد.",
  supportsLive: true,
  defaultSchedule: { type: "INTERVAL", intervalMinutes: 15 },
  params: [],
  async run(ctx) {
    const r = await processDeadlines(false, ctx.dryRun);
    for (const i of r.items) {
      ctx.item({ ref: `کار ${i.taskId}`, label: `${i.title} — ${i.rootTitle}`, result: ctx.dryRun ? "WOULD_DO" : "DONE", message: `${i.kind === "REMINDER" ? "یادآوری" : "عقب‌افتادگی/تشدید"} برای ${i.users} کاربر` });
    }
    ctx.summary(`${r.reminders} یادآوری، ${r.escalations} عقب‌افتادگی`);
  },
});
