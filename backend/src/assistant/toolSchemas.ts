import { ActionDef, SlotDef } from "./types";

// تعریف کارها به‌صورت «ابزار» برای مدل زبانی (قالب JSON-Schema، سازگار با tool-calling). فعلاً مصرف‌کننده ندارد؛ اتصال هوش مصنوعی بعداً یک Interpreter
// است که از همین ساختار استفاده می‌کند و خروجی مدل را به Interpretation (همان قرارداد تفسیرگر قاعده‌محور) تبدیل می‌کند.

function slotSchema(s: SlotDef): Record<string, unknown> {
  switch (s.type) {
    case "number":
      return { type: "number", description: s.title };
    case "lines":
      return { type: "array", description: s.title, items: { type: "object", properties: { text: { type: "string", description: "نام/کد کالا" }, quantity: { type: "number" } }, required: ["text", "quantity"] } };
    default:
      return { type: "string", description: `${s.title}${["customer", "goodsItem", "salesType", "salesCenter"].includes(s.type) ? " (نام یا کد؛ سیستم خودش پیدا می‌کند)" : ""}` };
  }
}

export function toolSchemas(actions: ActionDef[]) {
  return actions.map((a) => ({
    name: a.key.replace(/-/g, "_"),
    description: `${a.title}: ${a.description}`,
    input_schema: {
      type: "object",
      properties: Object.fromEntries(a.slots.map((s) => [s.name, slotSchema(s)])),
      required: a.slots.filter((s) => s.required && !s.defaultValue).map((s) => s.name),
    },
  }));
}
