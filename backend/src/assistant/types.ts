// «دستیار» (گفتگوی دستوری): زیرساخت عمومی — هر کار یک ActionDef در registry است (کلید، شرح، مثال‌ها، دسترسی، اسلات‌ها و run).
// «تفسیرگر» متن را به {action, slots} تبدیل می‌کند و فعلاً فقط تفسیرگر قاعده‌محور داریم؛ اتصال هوش مصنوعی بعداً یک Interpreter دیگر با همین قرارداد است
// (و toolSchemas() اکشن‌ها را به‌صورت ابزارِ قابل‌فراخوانی برای مدل می‌دهد). موتور (engine.ts) مستقل از نوع تفسیرگر است.
// وضعیت گفتگو (ChatState) سمت کلاینت نگه‌داشته و با هر پیام برگردانده می‌شود؛ سرور بدون حافظه است و هر اجرا دسترسی کاربر را دوباره می‌سنجد.

export type SlotType = "customer" | "party" | "goodsItem" | "salesType" | "salesCenter" | "lines" | "number" | "text" | "choice";

export interface SlotDef {
  name: string;
  title: string;
  type: SlotType;
  required?: boolean;
  /** سؤالی که اگر مقدار نبود پرسیده می‌شود */
  prompt?: string;
  /** مقدار پیش‌فرض وقتی کاربر نگفته (مثلاً آخرین انتخاب خودش)؛ null = پیش‌فرضی نیست و (اگر required) پرسیده می‌شود */
  defaultValue?: (ctx: AssistantContext) => Promise<EntityRef | null>;
  /** گزینه‌های ثابت (type = choice) */
  options?: EntityRef[];
  /** گزینه‌های پویا (type = choice): از دیتابیس و بر اساس اسلات‌های قبلی (مثلاً مبناهای بازِ مشتری) ساخته می‌شود؛ یک گزینه ⇒ خودکار انتخاب، هیچ ⇒ پیام emptyMessage و پایان */
  choices?: (ctx: AssistantContext, slots: Record<string, any>) => Promise<EntityRef[]>;
  emptyMessage?: string;
  /** اعتبارسنجی مقدار تایپ‌شده (text/number)؛ پیام خطا یا null. slots = مقدارهای فعلی سایر اسلات‌ها */
  validate?: (value: string | number, slots: Record<string, any>) => string | null;
}

export interface EntityRef {
  id: number;
  label: string;
}

/** مقدار هر اسلات در وضعیت گفتگو */
export interface LineValue {
  /** هنوز حل‌نشده: متن کاربر */
  text?: string;
  ref?: EntityRef;
  quantity: number;
  /** مقدار این قلم هنوز باید از کاربر پرسیده شود (دستور میانبر با «مقدار: بپرس») */
  askQty?: boolean;
}
/** notFound: جستجو نتیجه‌ای نداشت (دوباره جستجو نمی‌شود تا کاربر چیز دیگری بنویسد یا «مشتری جدید» را بزند)؛ isNew: کاربر صریحاً گفته مشتری جدید است */
export interface TextValue {
  text: string;
  notFound?: boolean;
  isNew?: boolean;
}
export type SlotValue = EntityRef | TextValue | number | string | LineValue[];

export interface ChatState {
  actionKey: string | null;
  slots: Record<string, SlotValue>;
  /** اسلاتی که منتظر پاسخ کاربر است؛ index = ردیف مربوط (برای lines) */
  pending: { slot: string; index?: number } | null;
  /** پیش‌نمایشِ کارِ ثبتی نمایش داده شده و منتظر «تایید» (دکمه) است */
  awaitingConfirm?: boolean;
  /** گفتگوی والد (مثلاً پیش‌فاکتور) که این زیرگفتگو (مثلاً تعریف مشتری) از وسطش شروع شده؛ نتیجه در parentSlot والد می‌نشیند. فقط یک سطح */
  parent?: ChatState | null;
  parentSlot?: string | null;
  /** اسلات‌هایی که باید حتماً از کاربر پرسیده شوند و پیش‌فرض نمی‌گیرند (از دستور میانبر؛ فقط وقتی کاربر خودش مقدارشان را نگفته) */
  ask?: string[];
}
export const EMPTY_STATE: ChatState = { actionKey: null, slots: {}, pending: null };

export interface AssistantContext {
  userId: number;
  can(actionKey: string): Promise<boolean>;
}

/** بلوک‌های پاسخ که کلاینت رندر می‌کند */
export type Block =
  | { type: "text"; text: string }
  | { type: "choices"; slot: string; index?: number; items: { id: number; label: string }[] }
  | { type: "suggestions"; items: string[] }
  | { type: "table"; columns: string[]; rows: string[][] }
  /** باز کردن یک فرم «جدید» با داده‌ی پیش‌پر (stageFormPrefill + openTab سمت کلاینت)؛ کاربر خودش ذخیره می‌کند */
  | { type: "prefill"; label: string; path: string; payload: unknown; preview?: { columns: string[]; rows: string[][] } }
  /** خلاصه‌ی کارِ ثبتی + دکمه‌ی «ثبت» (تایید صریح با کلیک، نه با متن) */
  | { type: "confirm"; label: string; summary: { label: string; value: string }[] };

export interface ActionDef {
  key: string;
  title: string;
  description: string;
  examples: string[];
  /** دسترسی‌های لازم (هر کدام باید داشته باشد) */
  permissions: string[];
  slots: SlotDef[];
  run(ctx: AssistantContext, slots: Record<string, any>): Promise<Block[]>;
  /**
   * کارِ ثبتی (نوشتن در دیتابیس): run فقط «پیش‌نمایش» است (خلاصه + دکمه‌ی تایید)، و execute بعد از کلیک کاربر روی دکمه اجرا می‌شود.
   * اگر پیش‌نمایش `existing` بدهد (مثلاً مشتری از قبل هست) چیزی نوشته نمی‌شود و همان موجود نتیجه است.
   */
  preview?(ctx: AssistantContext, slots: Record<string, any>): Promise<{ blocks: Block[]; existing?: EntityRef; error?: string; resetSlot?: string }>;
  execute?(ctx: AssistantContext, slots: Record<string, any>): Promise<{ blocks: Block[]; result?: EntityRef }>;
}

/** خروجی تفسیر یک پیام (قاعده‌محور یا هوش مصنوعی) */
export interface Interpretation {
  actionKey: string | null;
  /** مقدارهای خام: برای موجودیت‌ها {text}، برای lines آرایه‌ی LineValue با text، عدد و رشته مستقیم */
  slots: Record<string, SlotValue>;
  cancel?: boolean;
  /** اسلات‌های «حتماً بپرس» (دستور میانبر) */
  ask?: string[];
}

export interface Interpreter {
  interpret(text: string, ctx: AssistantContext, actions: ActionDef[], state: ChatState): Promise<Interpretation>;
}

export interface ChatReply {
  blocks: Block[];
  state: ChatState;
}
