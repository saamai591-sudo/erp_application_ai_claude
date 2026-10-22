import { prisma } from "../lib/prisma";
import { getMaxUsers } from "../license/licenseService";

// حساب کاربری: نام کاربری (ورود)، «کاربر سبک» (فقط کارتابل) و سقف کاربران لایسنس. تنها جای این قواعد همین سرویس است (routes/users.ts صدایش می‌زند).
// کاربر سبک: نقش «کارتابل (کاربر سبک)» (فقط مجوزهای «کارهای من») و بدون مجوز مستقیم؛ middleware/lightGuard.ts دسترسی‌اش به APIها را بیشتر هم می‌بندد.

export class UserAccountError extends Error {}

export const LIGHT_ROLE_TITLE = "کارتابل (کاربر سبک)";
const LIGHT_ACTIONS = ["workflow.inbox.my-tasks.view", "workflow.inbox.my-tasks.act"];

/** نقش کاربر سبک را (در صورت نبودن) می‌سازد و مجوزهایش را همگام نگه می‌دارد؛ در راه‌اندازی سرور صدا زده می‌شود */
export async function ensureLightRole(): Promise<number> {
  let role = await prisma.role.findUnique({ where: { title: LIGHT_ROLE_TITLE } });
  if (!role) {
    const last = await prisma.role.findFirst({ orderBy: { code: "desc" }, select: { code: true } });
    role = await prisma.role.create({ data: { code: (last?.code ?? 0) + 1, title: LIGHT_ROLE_TITLE } });
  }
  const actions = await prisma.action.findMany({ where: { key: { in: LIGHT_ACTIONS } }, select: { id: true } });
  await prisma.roleAction.createMany({ data: actions.map((a) => ({ roleId: role!.id, actionId: a.id })), skipDuplicates: true });
  return role.id;
}

export function normalizeUsername(v: unknown): string | null {
  const t = typeof v === "string" ? v.trim().toLowerCase() : "";
  return t || null;
}

/** نام کاربری: حروف انگلیسی، رقم و . _ - (۳ تا ۳۰)؛ یکتا و غیرِ شماره موبایل */
export async function checkUsername(username: string, excludeUserId?: number): Promise<void> {
  if (!/^[a-z0-9._-]{3,30}$/.test(username)) throw new UserAccountError("نام کاربری باید ۳ تا ۳۰ نویسه از حروف انگلیسی، رقم و . _ - باشد");
  if (/^\d{11}$/.test(username)) throw new UserAccountError("نام کاربری نباید شبیه شماره همراه باشد");
  if (await prisma.user.findFirst({ where: { OR: [{ username }, { mobile: username }], ...(excludeUserId ? { NOT: { id: excludeUserId } } : {}) }, select: { id: true } })) throw new UserAccountError("نام کاربری تکراری است");
}

/** سقف کاربران لایسنس: کاربران فعال (کامل و سبک) با هم می‌شمارند؛ فقط ساخت/فعال‌سازیِ کاربرِ تازه رد می‌شود (کاربران موجودِ بیش از سقف دست نمی‌خورند) */
export async function assertUserCapacity(): Promise<void> {
  const max = await getMaxUsers();
  if (max == null) return;
  const active = await prisma.user.count({ where: { isActive: true } });
  if (active >= max) throw new UserAccountError(`سقف کاربران لایسنس (${max} کاربر فعال) پر شده است؛ یک کاربر را غیرفعال کنید یا لایسنس را ارتقا دهید`);
}
