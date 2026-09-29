// هشدار «تغییرات ذخیره‌نشده» — سازوکار مشترک همه‌ی فرم‌ها (نه کد جداگانه در هر صفحه).
//
// چه چیزی «تغییر» حساب می‌شود؟ هر بار که کاربر (نه بارگذاری خودکار داده) یکی از stateهای فرم را عوض کند.
// همه‌ی stateهای فرم از usePersistedState با کلیدهای «form:<مسیر>…» می‌آیند؛ setter آن‌ها اگر داخل یک رویداد واقعیِ
// کاربر (کلیک/تایپ/انتخاب…) صدا زده شده باشد، فرم را «کثیف» علامت می‌زند. بارگذاری داده از سرور و مقدارهای پیش‌فرض
// (که بعد از await یا داخل effect می‌آیند و رویداد کاربر ندارند) هرگز فرم را کثیف نمی‌کنند — پس باز کردن یک فرم و بستن
// فوری‌اش هشدار نمی‌دهد. برای فرم‌هایی که (هنوز) از usePersistedState استفاده نمی‌کنند، FormPage خودش تایپ داخل فرم را
// هم علامت می‌زند. ذخیره‌ی موفق (useSavedFlash) وضعیت را «تمیز» می‌کند.
//
// چه کسی می‌پرسد؟ فقط چند مسیرِ «بستن/دور انداختن»: دکمه‌ی × فرم (FormPage)، × تب و کلیک وسط (TabsContext.closeTab)،
// دکمه‌ی «جدید» داخل فرم (resetActiveTabToNew)، بستن همه‌ی تب‌ها (تغییر دوره مالی)، و بستن/رفرش خودِ مرورگر
// (beforeunload). همه از confirmDiscard() و همین پیام استفاده می‌کنند.

export const UNSAVED_CHANGES_MESSAGE =
  "این فرم تغییرات ذخیره‌نشده دارد.\nاگر آن را ببندید، اطلاعاتی که وارد یا ویرایش کرده‌اید از بین می‌رود.\n\nآیا می‌خواهید بدون ذخیره ببندید؟";

// کلیدهای کامل stateهای «کثیف»‌شده‌ی فرم‌ها (مثلاً form:/payments/new:header)
const dirtyKeys = new Set<string>();

const USER_EVENT_TYPES = new Set(["input", "change", "click", "dblclick", "keydown", "keyup", "mousedown", "pointerdown", "paste", "cut", "drop"]);

/** آیا این رویداد یک عمل واقعیِ کاربر روی «محتوای فرم» است؟
 *  - isTrusted: رویداد مرورگر، نه dispatch برنامه‌ای.
 *  - هدف رویداد باید هنوز در صفحه باشد و داخل ناحیه‌ی محتوا (.content) یا یک دیالوگ (.modal-overlay، مثل انتخابگرها)
 *    باشد. دلیل: کلیکِ «جدید» در فهرست یا کلیک منوی کناری همان لحظه فرم را باز می‌کند و effectهای mount فرم (مقدارهای
 *    پیش‌فرض: ارز، تاریخ…) هنوز داخل همان رویداد اجرا می‌شوند؛ آن کلیک هدفش بیرون از محتوای فرم است (یا از DOM حذف
 *    شده) و نباید فرمِ تازه‌باز‌شده را «تغییر‌کرده» کند. */
export function isUserInitiatedEvent(ev: Event | undefined | null): boolean {
  if (!ev || !ev.isTrusted || !USER_EVENT_TYPES.has(ev.type)) return false;
  const t = ev.target;
  return t instanceof Element && t.isConnected && !!t.closest(".content, .modal-overlay");
}

/** فراخوانی از usePersistedState هنگام تغییرِ کاربر روی یک state؛ فقط کلیدهای فرم (form:…) ثبت می‌شوند. */
export function markStateKeyDirty(key: string) {
  if (key.startsWith("form:")) dirtyKeys.add(key);
}

function pathOnly(p: string): string {
  return p.split("?")[0];
}
function instanceOf(p: string): string | null {
  const m = /[?&]_i=([^&#]+)/.exec(p);
  return m ? m[1] : null;
}

// همان «خانواده‌ی کلید» که TabsContext.clearFormState برای یک تب پاک می‌کند: تب چندنمونه‌ای (با _i) فقط کلیدهای
// form:<مسیر>@<شماره>؛ بقیه هم کلید با query و هم کلید بدون query.
function familiesOf(tabPath: string): string[] {
  const base = pathOnly(tabPath);
  const inst = instanceOf(tabPath);
  if (inst) return [`form:${base}@${inst}`];
  return base !== tabPath ? [`form:${tabPath}`, `form:${base}`] : [`form:${tabPath}`];
}

function keyBelongs(key: string, families: string[]): boolean {
  return families.some((f) => key === f || key.startsWith(f + ":"));
}

/** علامت‌گذاری دستی یک تب به‌عنوان «تغییر کرده» (مثلاً وقتی کاربر در فرمی بدون usePersistedState تایپ می‌کند). */
export function markTabDirty(tabPath: string) {
  dirtyKeys.add(familiesOf(tabPath)[0]);
}

export function isTabDirty(tabPath: string): boolean {
  const fams = familiesOf(tabPath);
  for (const k of dirtyKeys) if (keyBelongs(k, fams)) return true;
  return false;
}

/** تمیزکردن یک تب: بعد از ذخیره‌ی موفق، یا وقتی تغییرات عمداً دور ریخته/فرم بسته می‌شود. */
export function clearTabDirty(tabPath: string) {
  const fams = familiesOf(tabPath);
  for (const k of Array.from(dirtyKeys)) if (keyBelongs(k, fams)) dirtyKeys.delete(k);
}

export function clearAllDirty() {
  dirtyKeys.clear();
}

/** پرسش تایید از کاربر؛ true = «بدون ذخیره ببند/دور بینداز». */
export function confirmDiscard(): boolean {
  return window.confirm(UNSAVED_CHANGES_MESSAGE);
}

/** مسیر تب جاری (همان قالب Tab.path در TabsContext: مسیر + query) */
export function currentTabPath(): string {
  return window.location.pathname + window.location.search;
}
