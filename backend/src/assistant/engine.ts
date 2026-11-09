import { userHasAction } from "../authz/guard";
import { ACTIONS, actionByKey } from "./registry";
import { entityLabel, listOptions, searchEntity } from "./entities";
import { ruleInterpreter } from "./ruleInterpreter";
import { norm, toNumber } from "./text";
import { ActionDef, AssistantContext, Block, ChatReply, ChatState, EMPTY_STATE, EntityRef, Interpreter, LineValue, SlotDef, SlotValue, TextValue } from "./types";

// موتور گفتگو (مستقل از نوع تفسیرگر): پیام ← تفسیر ← ادغام اسلات‌ها در وضعیت ← حل موجودیت‌ها (پرسیدن در صورت ابهام) ← اجرای کار.
// سرور بدون حافظه است: وضعیت را کلاینت نگه می‌دارد و با هر پیام می‌فرستد (اینجا اعتبارسنجی/پاک‌سازی می‌شود). هر اجرا دسترسی کاربر را دوباره می‌سنجد.
// زیرگفتگو: وسط یک کار (مثلاً پیش‌فاکتور) اگر مشتری جدید لازم شد، «تعریف مشتری» به‌عنوان زیرگفتگو شروع می‌شود و نتیجه‌اش (مشتری ساخته‌شده) در همان اسلات والد می‌نشیند.
// کار ثبتی (preview/execute): اول خلاصه و دکمه‌ی «ثبت»، و فقط با کلیک کاربر (confirm) نوشته می‌شود.

export interface ChatInput {
  text?: string;
  /** انتخاب یکی از کاندیدهای پیشنهادی (دکمه)؛ id = 0 یعنی «مشتری جدید» */
  choice?: { slot: string; index?: number; id: number };
  /** تایید کارِ ثبتی (دکمه‌ی «ثبت») */
  confirm?: boolean;
  state?: unknown;
}

const NEW_ID = 0;
const CANCEL_RE = /^(?:انصراف|لغو|کنسل|بیخیال|ولش کن)s*[.!؟]*$/;
const SKIP = /^(?:رد|ندارم|ندارد|بعدا|بعداً|نمی\s?دانم|-|—)$/;

const isRef = (v: unknown): v is EntityRef => !!v && typeof v === "object" && typeof (v as any).id === "number" && typeof (v as any).label === "string";
const isText = (v: unknown): v is TextValue => !!v && typeof v === "object" && typeof (v as any).text === "string";

/** وضعیت دریافتی از کلاینت را به شکل مجاز برمی‌گرداند (کار ناشناخته/اسلات ناشناخته/مقدار بدشکل حذف می‌شود)؛ parent فقط یک سطح */
function sanitizeState(raw: unknown, allowParent = true): ChatState {
  const s = raw as Partial<ChatState> | undefined;
  const action = actionByKey(s?.actionKey ?? null);
  if (!s || !action || typeof s.slots !== "object" || !s.slots) return { ...EMPTY_STATE, slots: {} };
  const slots: Record<string, SlotValue> = {};
  for (const def of action.slots) {
    const v = (s.slots as any)[def.name];
    if (v === undefined || v === null) continue;
    if (def.type === "lines") {
      if (!Array.isArray(v)) continue;
      slots[def.name] = v
        .slice(0, 30)
        .map((l: any): LineValue | null => {
          const quantity = typeof l?.quantity === "number" && l.quantity > 0 && l.quantity < 1e9 ? l.quantity : 1;
          if (isRef(l?.ref)) return { ref: { id: l.ref.id, label: String(l.ref.label).slice(0, 200) }, quantity, askQty: l.askQty === true ? true : undefined };
          if (typeof l?.text === "string") return { text: l.text.slice(0, 200), quantity };
          return null;
        })
        .filter((x: LineValue | null): x is LineValue => !!x);
    } else if (def.type === "number") {
      if (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= (def.name === "amount" ? 1e13 : def.name === "macroId" ? 1e9 : 100)) slots[def.name] = v;
    } else if (def.type === "text") {
      if (typeof v === "string") slots[def.name] = v.slice(0, 500);
    } else if (def.type === "choice") {
      // گزینه‌ی پویا هنگام اجرا/ادامه دوباره با دیتابیس سنجیده می‌شود (advance و run)
      if (def.choices) {
        if (isRef(v)) slots[def.name] = { id: v.id, label: String(v.label).slice(0, 200) };
      } else {
        const opt = def.options?.find((o) => isRef(v) && o.id === v.id);
        if (opt) slots[def.name] = opt;
      }
    } else if (isRef(v)) slots[def.name] = { id: v.id, label: String(v.label).slice(0, 200) };
    else if (isText(v)) slots[def.name] = { text: v.text.slice(0, 200), notFound: v.notFound === true ? true : undefined, isNew: v.isNew === true ? true : undefined };
  }
  const p = s.pending;
  const ask = Array.isArray(s.ask) ? s.ask.filter((n): n is string => typeof n === "string" && action.slots.some((d) => d.name === n)) : undefined;
  const pending = p && typeof p.slot === "string" && action.slots.some((d) => d.name === p.slot) ? { slot: p.slot, index: typeof p.index === "number" ? p.index : undefined } : null;
  const parent = allowParent && s.parent ? sanitizeState(s.parent, false) : null;
  return { actionKey: action.key, slots, pending, awaitingConfirm: s.awaitingConfirm === true, ask: ask?.length ? ask : undefined, parent: parent?.actionKey ? parent : null, parentSlot: parent?.actionKey && typeof s.parentSlot === "string" ? s.parentSlot : null };
}

function helpBlocks(allowed: ActionDef[], prefix?: string): Block[] {
  if (!allowed.length) return [{ type: "text", text: "هیچ‌کدام از دستورهای دستیار برای دسترسی‌های شما فعال نیست." }];
  const blocks: Block[] = [];
  blocks.push({ type: "text", text: `${prefix ? `${prefix}\n` : ""}این کارها را بلدم:\n${allowed.map((a) => `• ${a.title}: ${a.description}`).join("\n")}` });
  blocks.push({ type: "suggestions", items: allowed.flatMap((a) => a.examples.slice(0, 1)) });
  return blocks;
}

function mergeSlots(state: ChatState, add: Record<string, SlotValue>, action: ActionDef) {
  for (const def of action.slots) {
    const v = add[def.name];
    if (v === undefined) continue;
    if (def.type === "lines") {
      const cur = Array.isArray(state.slots[def.name]) ? (state.slots[def.name] as LineValue[]) : [];
      state.slots[def.name] = [...cur, ...(v as LineValue[])].slice(0, 30);
    } else state.slots[def.name] = v;
  }
}

/** شروع زیرگفتگوی «مشتری جدید» با نام پیشنهادی؛ گفتگوی فعلی والد می‌شود */
function startNewCustomer(state: ChatState, slot: string, name: string): ChatState {
  const parent: ChatState = { ...state, pending: null, awaitingConfirm: false, parent: null, parentSlot: null };
  return { actionKey: "create-customer", slots: name ? { name } : {}, pending: null, awaitingConfirm: false, parent, parentSlot: slot };
}

async function setChoice(ctx: AssistantContext, state: ChatState, action: ActionDef, choice: NonNullable<ChatInput["choice"]>): Promise<{ error?: string; state?: ChatState }> {
  const def = action.slots.find((d) => d.name === choice.slot);
  if (!def) return { error: "این گزینه معتبر نیست." };
  if (def.type === "customer" && choice.id === NEW_ID) {
    const cur = state.slots[def.name];
    return { state: startNewCustomer(state, def.name, isText(cur) ? cur.text : "") };
  }
  if (def.type === "choice") {
    const opts = def.choices ? await def.choices(ctx, state.slots) : def.options;
    const opt = opts?.find((o) => o.id === choice.id);
    if (!opt) return { error: "این گزینه معتبر نیست." };
    state.slots[def.name] = opt;
    state.pending = null;
    return {};
  }
  const type = def.type === "lines" ? "goodsItem" : def.type;
  const ref = await entityLabel(type, choice.id);
  if (!ref) return { error: "این مورد دیگر در دسترس نیست." };
  if (def.type === "lines") {
    const lines = Array.isArray(state.slots[def.name]) ? (state.slots[def.name] as LineValue[]) : [];
    const i = choice.index ?? 0;
    if (!lines[i]) return { error: "این گزینه معتبر نیست." };
    lines[i] = { ref, quantity: lines[i].quantity };
    state.slots[def.name] = lines;
  } else state.slots[def.name] = ref;
  state.pending = null;
  return {};
}

const NEW_CUSTOMER_CHIP = { id: NEW_ID, label: "+ مشتری جدید" };

/** تا جایی که ممکن است اسلات‌ها را حل می‌کند؛ اگر سؤالی لازم شد بلوک‌های سؤال را برمی‌گرداند (و state.pending را می‌گذارد). state ممکن است عوض شود (زیرگفتگو) */
async function advance(ctx: AssistantContext, state: ChatState, action: ActionDef): Promise<{ blocks: Block[]; state: ChatState; end?: boolean } | null> {
  const notes: Block[] = [];
  for (const def of action.slots) {
    const val = state.slots[def.name];
    if (def.type === "lines") {
      const lines = Array.isArray(val) ? (val as LineValue[]) : [];
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].ref) continue;
        const r = await searchEntity("goodsItem", lines[i].text ?? "");
        if (r.exact) lines[i] = { ref: r.exact, quantity: lines[i].quantity };
        else if (r.candidates.length) {
          state.slots[def.name] = lines;
          state.pending = { slot: def.name, index: i };
          return { blocks: [...notes, { type: "text", text: `کدام «${lines[i].text}»؟` }, { type: "choices", slot: def.name, index: i, items: r.candidates }], state };
        } else {
          notes.push({ type: "text", text: `کالایی با عبارت «${lines[i].text}» پیدا نشد؛ از لیست اقلام حذف شد.` });
          lines.splice(i, 1);
          i--;
        }
      }
      state.slots[def.name] = lines;
      // مقدار قلمِ «بپرس» (از دستور میانبر): برای هر قلم جدا
      const qi = lines.findIndex((l) => l.ref && l.askQty);
      if (qi >= 0) {
        state.pending = { slot: def.name, index: qi };
        return { blocks: [...notes, { type: "text", text: `«${lines[qi].ref!.label}» چند عدد؟` }], state };
      }
      if (def.required && lines.length === 0) {
        state.pending = { slot: def.name };
        return { blocks: [...notes, { type: "text", text: def.prompt ?? `${def.title} را بگویید.` }], state };
      }
      continue;
    }
    if (def.type === "number" || def.type === "text") {
      if (val !== undefined && def.validate) {
        const err = def.validate(val as string | number, Object.fromEntries(Object.entries(state.slots)));
        if (err) {
          delete state.slots[def.name];
          state.pending = { slot: def.name };
          return { blocks: [...notes, { type: "text", text: `${err} ${def.prompt ?? ""}`.trim() }], state };
        }
      }
      if (val === undefined && (def.required || state.ask?.includes(def.name))) {
        state.pending = { slot: def.name };
        return { blocks: [...notes, { type: "text", text: def.prompt ?? `${def.title} را بگویید.` }], state };
      }
      continue;
    }
    if (def.type === "choice") {
      let opts = def.options ?? [];
      if (def.choices) {
        opts = await def.choices(ctx, state.slots);
        // مقدار قبلی که دیگر معتبر نیست (مثلاً مشتری عوض شده) کنار گذاشته می‌شود
        if (isRef(val) && !opts.some((o) => o.id === val.id)) delete state.slots[def.name];
        else if (isRef(val)) continue;
        if (!opts.length) return { blocks: [...notes, { type: "text", text: def.emptyMessage ?? `گزینه‌ای برای «${def.title}» نیست.` }], state, end: true };
        if (opts.length === 1) {
          state.slots[def.name] = opts[0];
          notes.push({ type: "text", text: `${def.title}: ${opts[0].label}` });
          continue;
        }
      } else if (val !== undefined || !def.required) continue;
      if (!def.required) continue;
      state.pending = { slot: def.name };
      return { blocks: [...notes, { type: "text", text: def.prompt ?? `${def.title} را مشخص کنید.` }, { type: "choices", slot: def.name, items: opts }], state };
    }
    if (isRef(val)) continue;
    if (isText(val)) {
      if (def.type === "customer" && val.isNew) return { blocks: notes, state: startNewCustomer(state, def.name, val.text) };
      if (val.notFound) {
        state.pending = { slot: def.name };
        return { blocks: [...notes, { type: "text", text: `${def.title} «${val.text}» پیدا نشد. اگر جدید است دکمه‌ی «مشتری جدید» را بزنید، وگرنه نام یا کد را دوباره بنویسید.` }, { type: "choices", slot: def.name, items: [NEW_CUSTOMER_CHIP] }], state };
      }
      const r = await searchEntity(def.type, val.text);
      if (r.exact) {
        state.slots[def.name] = r.exact;
        continue;
      }
      if (r.candidates.length) {
        state.pending = { slot: def.name };
        return { blocks: [...notes, { type: "text", text: `کدام ${def.title}؟` }, { type: "choices", slot: def.name, items: def.type === "customer" ? [...r.candidates, NEW_CUSTOMER_CHIP] : r.candidates }], state };
      }
      state.pending = { slot: def.name };
      if (def.type === "customer") {
        state.slots[def.name] = { text: val.text, notFound: true };
        return { blocks: [...notes, { type: "text", text: `مشتری «${val.text}» پیدا نشد. مشتری جدید است؟ دکمه‌ی «مشتری جدید» را بزنید، یا نام/کد دیگری بنویسید.` }, { type: "choices", slot: def.name, items: [NEW_CUSTOMER_CHIP] }], state };
      }
      delete state.slots[def.name];
      return { blocks: [...notes, { type: "text", text: `${def.title} «${val.text}» پیدا نشد. دوباره بنویسید (نام یا کد).` }], state };
    }
    const forced = !!state.ask?.includes(def.name);
    if (!def.required && !forced) continue;
    if (def.defaultValue && !forced) {
      const d = await def.defaultValue(ctx);
      if (d) {
        state.slots[def.name] = d;
        continue;
      }
    }
    state.pending = { slot: def.name };
    if (def.type === "salesType" || def.type === "salesCenter") {
      const opts = await listOptions(def.type);
      return { blocks: [...notes, { type: "text", text: def.prompt ?? `${def.title} را مشخص کنید.` }, { type: "choices", slot: def.name, items: opts }], state };
    }
    if (def.type === "customer") return { blocks: [...notes, { type: "text", text: def.prompt ?? `${def.title} را بگویید.` }, { type: "choices", slot: def.name, items: [NEW_CUSTOMER_CHIP] }], state };
    return { blocks: [...notes, { type: "text", text: def.prompt ?? `${def.title} را بگویید.` }], state };
  }
  return null;
}

const reset = (): ChatState => ({ actionKey: null, slots: {}, pending: null });

/** ادامه‌ی گفتگو از حالتی که همه‌ی اسلات‌ها پر یا قابل‌پرسش است: حل اسلات‌ها ← (پیش‌نمایش/تایید) ← اجرا؛ پایان زیرگفتگو والد را ادامه می‌دهد */
async function proceed(ctx: AssistantContext, state: ChatState, allowed: ActionDef[], confirm: boolean, lead: Block[] = []): Promise<ChatReply> {
  const action = allowed.find((a) => a.key === state.actionKey);
  if (!action) return { blocks: [...lead, ...helpBlocks(allowed)], state: reset() };
  state.pending = null;
  const ask = await advance(ctx, state, action);
  if (ask) {
    // زیرگفتگوی تازه‌شروع‌شده (مشتری جدید): از اول پیش برو
    if (ask.end) return { blocks: [...lead, ...ask.blocks], state: reset() };
    if (ask.state !== state) return proceed(ctx, ask.state, allowed, false, [...lead, ...ask.blocks]);
    return { blocks: [...lead, ...ask.blocks], state };
  }

  const slots: Record<string, any> = {};
  for (const def of action.slots) if (state.slots[def.name] !== undefined) slots[def.name] = state.slots[def.name];

  if (action.preview && action.execute) {
    let result: EntityRef | undefined;
    let blocks: Block[] = [];
    if (confirm && state.awaitingConfirm) {
      const out = await action.execute(ctx, slots);
      result = out.result;
      blocks = out.blocks;
      if (!result) return { blocks: [...lead, ...blocks], state: { ...state, awaitingConfirm: false } };
    } else {
      const pv = await action.preview(ctx, slots);
      if (pv.error) return { blocks: [...lead, ...pv.blocks], state: reset() };
      if (pv.existing) {
        result = pv.existing;
        blocks = pv.blocks;
      } else {
        state.awaitingConfirm = true;
        return { blocks: [...lead, ...pv.blocks], state };
      }
    }
    // نتیجه‌ی کار ثبتی: اگر زیرگفتگو بود در اسلات والد می‌نشیند و والد ادامه می‌یابد
    if (state.parent && state.parentSlot && result) {
      const parent = state.parent;
      parent.slots[state.parentSlot] = result;
      parent.pending = null;
      return proceed(ctx, parent, allowed, false, [...lead, ...blocks]);
    }
    return { blocks: [...lead, ...blocks], state: reset() };
  }

  const blocks = await action.run(ctx, slots);
  return { blocks: [...lead, ...blocks], state: reset() };
}

export async function handleMessage(userId: number, input: ChatInput, interpreter: Interpreter = ruleInterpreter): Promise<ChatReply> {
  const cache = new Map<string, boolean>();
  const ctx: AssistantContext = {
    userId,
    async can(key) {
      if (!cache.has(key)) cache.set(key, await userHasAction(userId, key));
      return cache.get(key)!;
    },
  };
  const allowed: ActionDef[] = [];
  for (const a of ACTIONS) if ((await Promise.all(a.permissions.map((p) => ctx.can(p)))).every(Boolean)) allowed.push(a);

  let state = sanitizeState(input.state);

  if (input.confirm) {
    if (!state.actionKey || !state.awaitingConfirm) return { blocks: [{ type: "text", text: "چیزی برای ثبت در انتظار نیست." }], state: reset() };
    return proceed(ctx, state, allowed, true);
  }

  if (input.choice) {
    const action = allowed.find((a) => a.key === state.actionKey);
    if (!action) return { blocks: helpBlocks(allowed, "گفتگو منقضی شد."), state: reset() };
    state.awaitingConfirm = false;
    const r = await setChoice(ctx, state, action, input.choice);
    if (r.error) return { blocks: [{ type: "text", text: r.error }], state };
    if (r.state) state = r.state;
  } else {
    const text = (input.text ?? "").toString().slice(0, 1000).trim();
    if (!text) return { blocks: helpBlocks(allowed, "سلام! هر دستوری دارید همین‌جا بنویسید."), state };
    // پاسخ به «<کالا> چند عدد؟» (قلمِ دستور میانبر با مقدارِ «بپرس»): فقط عدد؛ قبل از تفسیرگر تا به‌عنوان کالای تازه خوانده نشود
    const qAction = allowed.find((a) => a.key === state.actionKey);
    const qLines = qAction && state.pending ? state.slots[state.pending.slot] : undefined;
    if (qAction && state.pending?.index !== undefined && Array.isArray(qLines) && (qLines as LineValue[])[state.pending.index]?.askQty && (qLines as LineValue[])[state.pending.index]?.ref) {
      if (CANCEL_RE.test(norm(text))) return { blocks: [{ type: "text", text: "لغو شد." }], state: reset() };
      const n = toNumber(text);
      if (Number.isNaN(n) || n <= 0 || n >= 1e9) return { blocks: [{ type: "text", text: `مقدار را به‌صورت یک عدد مثبت بگویید. «${(qLines as LineValue[])[state.pending.index].ref!.label}» چند عدد؟` }], state };
      const ql = qLines as LineValue[];
      ql[state.pending.index] = { ref: ql[state.pending.index].ref, quantity: n };
      state.slots[state.pending.slot] = ql;
      state.awaitingConfirm = false;
      return proceed(ctx, state, allowed, false);
    }
    const interp = await interpreter.interpret(text, ctx, allowed, state);
    if (interp.cancel) return { blocks: [{ type: "text", text: "لغو شد." }, ...(allowed.length ? [{ type: "suggestions" as const, items: allowed.flatMap((a) => a.examples.slice(0, 1)) }] : [])], state: reset() };
    // دستور تازه‌ی همان زیرگفتگو را نمی‌بُرد؛ یک کار دیگر وسط زیرگفتگو والد را کنار می‌گذارد
    if (interp.actionKey && interp.actionKey !== state.actionKey) state = { actionKey: interp.actionKey, slots: {}, pending: null };
    const action = allowed.find((a) => a.key === state.actionKey);
    if (!action) return { blocks: helpBlocks(allowed, state.actionKey ? "برای این کار دسترسی ندارید." : "متوجه نشدم."), state: reset() };
    state.awaitingConfirm = false;
    const before = JSON.stringify(state.slots);
    mergeSlots(state, interp.slots, action);
    if (interp.ask?.length) state.ask = Array.from(new Set([...(state.ask ?? []), ...interp.ask]));
    // پاسخ آزاد به سؤال یک اسلات وقتی تفسیرگر چیزی برنداشت
    if (JSON.stringify(state.slots) === before && state.pending) {
      const def = action.slots.find((d) => d.name === state.pending!.slot) as SlotDef | undefined;
      if (def && ["customer", "party", "goodsItem", "salesType", "salesCenter"].includes(def.type)) state.slots[def.name] = { text };
      else if (def && def.type === "choice") {
        const opts = def.choices ? await def.choices(ctx, state.slots) : def.options ?? [];
        const nt = norm(text);
        const numRe = /^\d+$/.test(nt) ? new RegExp(String.raw`(^|\D)${nt}(\D|$)`) : null;
        const opt = opts.find((o) => nt.includes(norm(o.label)) || (numRe !== null && numRe.test(norm(o.label))));
        if (opt) state.slots[def.name] = opt;
        else return { blocks: [{ type: "text", text: `متوجه نشدم. ${def.prompt ?? ""}` }, { type: "choices", slot: def.name, items: opts }], state };
      } else if (def && def.type === "text") state.slots[def.name] = SKIP.test(norm(text)) ? "" : text.trim();
      else if (def && def.type === "number") {
        const n = toNumber(text);
        if (Number.isNaN(n)) return { blocks: [{ type: "text", text: `متوجه نشدم. ${def.prompt ?? ""}` }], state };
        state.slots[def.name] = n;
      } else if (def && def.type !== "lines") return { blocks: [{ type: "text", text: `متوجه نشدم. ${def.prompt ?? ""}` }], state };
    }
    if (JSON.stringify(state.slots) === before && !state.pending && !Object.keys(state.slots).length && !interp.actionKey) return { blocks: helpBlocks(allowed, "متوجه نشدم."), state: reset() };
  }

  return proceed(ctx, state, allowed, false);
}
