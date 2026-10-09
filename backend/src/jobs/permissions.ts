import { getUserActionKeys } from "../authz/guard";
import { isRegisteredActionKey } from "../authz/registry";
import type { JobDefinition } from "./types";

// دسترسی «کاربر اجراکننده»: کار داخل سرور و بدون درخواست HTTP اجرا می‌شود، پس میان‌افزار can(...) مسیرها اجرا نمی‌شود؛
// هر کار با requiredActions اعلام می‌کند که برای انجام عملیاتش همان کاربر باید کدام دسترسی‌های فرم‌ها را می‌داشت.
// این‌جا همان مجموعه‌ی دسترسی‌ها (نقش‌ها + اعطای مستقیم، getUserActionKeys) با آن‌ها مقایسه می‌شود.

/** کلیدهای دسترسی لازم برای این کار با پارامترهای ذخیره‌شده (کلید ثبت‌نشده در Registry خطای معماری است) */
export function requiredActionKeys(def: JobDefinition, params: Record<string, any>): string[] {
  const keys = def.requiredActions ? def.requiredActions(params) : [];
  for (const k of keys) {
    if (!isRegisteredActionKey(k)) throw new Error(`خطای معماری: کلید دسترسی «${k}» (کار ${def.key}) در Registry ثبت نشده است`);
  }
  return keys;
}

/** دسترسی‌هایی که کاربر ندارد (آرایه‌ی خالی = همه را دارد) */
export async function missingActionKeys(def: JobDefinition, params: Record<string, any>, userId: number): Promise<string[]> {
  const required = requiredActionKeys(def, params);
  if (required.length === 0) return [];
  const have = await getUserActionKeys(userId);
  return required.filter((k) => !have.has(k));
}

export function missingActionsMessage(missing: string[]): string {
  return `کاربر اجراکننده دسترسی لازم را ندارد (${missing.join("، ")})`;
}
