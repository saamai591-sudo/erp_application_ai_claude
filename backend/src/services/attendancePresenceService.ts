import { prisma } from "../lib/prisma";
import { displayDate } from "../utils/dateDisplay";
import { AttendanceError, minuteText } from "./attendancePunchService";
import { buildWorksheet } from "./attendanceWorksheetService";

// مدیریت تردد › «کنترل تداخل با ترددِ ثبت‌شده» — تنها محل این قاعده؛ مشترک بین مرخصی ساعتی و ماموریت (ساعتی/روزانه).
// الگو (همان مدلِ «فاصله‌ی زمانی مطلق»): بازه‌ی درخواست [s, e] به دقیقه از مبدأ روز (UTC). رد می‌شود اگر
//   (۱) هیچ تردد منفردی «داخل» بازه باشد (s < t < e؛ تردد دقیقاً روی مرز مجاز است)، یا
//   (۲) شروع یا پایان بازه داخل یک «جفت‌تردد» (حضورِ ثبت‌شده) بیفتد، یعنی جفت‌تردد با بازه هم‌پوشانی داشته باشد (جفت‌ها از «کارکرد روزانه» می‌آیند).
// ماموریت روزانه: بازه = از شروع اولین بازه‌ی کاریِ شیفت در روز اول تا پایان آخرین بازه‌ی کاری در روز آخر (workSpan)؛ تردد بیرون از ساعت شیفتِ دو سرِ بازه مجاز است.

const DAY_MS = 86400000;
const DAY = 1440;
const dayNum = (d: Date) => Math.floor(d.getTime() / DAY_MS);
const atText = (abs: number) => `${displayDate(new Date(Math.floor(abs / DAY) * DAY_MS))} ساعت ${minuteText(((abs % DAY) + DAY) % DAY)}`;

type Pair = [number, number];

async function pairsAround(employeeId: number, centerDay: number): Promise<Pair[]> {
  const ws = await buildWorksheet({ from: new Date((centerDay - 1) * DAY_MS), to: new Date((centerDay + 1) * DAY_MS), employeeIds: [employeeId], includeRest: true });
  return ws.rows.filter((r: any) => r.employeeId === employeeId).flatMap((r: any) => (r.pairsAbs ?? []) as Pair[]);
}

/** کنترل ترددهای ثبت‌شده در بازه‌ی [s, e] (دقیقه‌ی مطلق) برای کارمند؛ what = «مرخصی» | «ماموریت» فقط برای متن پیام */
export async function assertNoPresenceInInterval(employeeId: number, s: number, e: number, what: "مرخصی" | "ماموریت") {
  // جفت‌تردد: فقط جفت‌هایی که از مرزهای بازه می‌گذرند مهم‌اند (جفتِ کاملاً داخل بازه حتماً ترددِ داخلی دارد و در بخش بعد گرفته می‌شود) ⇒ دور دو مرز
  const d0 = Math.floor(s / DAY), d1 = Math.floor((e - 1) / DAY);
  const pairs = [...(await pairsAround(employeeId, d0)), ...(d1 === d0 ? [] : await pairsAround(employeeId, d1))];
  for (const [i, o] of pairs) {
    if (Math.min(o, e) > Math.max(i, s)) throw new AttendanceError(`این ${what} با حضورِ ثبت‌شده‌ی کارمند (از ${atText(i)} تا ${atText(o)}) تداخل دارد؛ ابتدا ترددها را اصلاح کنید یا بازه‌ی ${what} را عوض کنید`);
  }
  // تردد منفردِ داخل بازه (پیش‌فیلتر با تاریخ، بعد مقایسه‌ی مطلق)
  const punches = await prisma.attendancePunch.findMany({ where: { employeeId, date: { gte: new Date(d0 * DAY_MS), lte: new Date(d1 * DAY_MS) } }, orderBy: [{ date: "asc" }, { minute: "asc" }], select: { date: true, minute: true } });
  for (const p of punches) {
    const abs = dayNum(p.date) * DAY + p.minute;
    if (s < abs && abs < e) throw new AttendanceError(`در بازه‌ی این ${what} ترددی در ${atText(abs)} ثبت شده است`);
  }
}

/**
 * بازه‌ی مطلقِ یک درخواست روزانه (مثل «Mode 2»): شروعِ اولین بازه‌ی کاریِ شیفت از روز شروع تا پایانِ آخرین بازه‌ی کاری تا روز پایان (روزهای استراحتِ وسط داخل بازه‌اند).
 * فقط دو سرِ بازه از «کارکرد روزانه» خوانده می‌شود (حداکثر یک هفته‌ی هر سر)، پس برای درخواستِ یک‌ساله هم سبک است. اگر در هیچ روزی بازه‌ی کاری نبود، کل روزهای تقویمی.
 */
export async function workSpan(employeeId: number, fromDay: number, toDay: number): Promise<{ s: number; e: number }> {
  const rowsOf = async (a: number, b: number) =>
    (await buildWorksheet({ from: new Date(a * DAY_MS), to: new Date(b * DAY_MS), employeeIds: [employeeId], includeRest: true })).rows.filter((r: any) => r.employeeId === employeeId && !r.rest);
  const abs = (r: any) => {
    const wd = dayNum(new Date(r.workDate));
    return { s: wd * DAY + (r.segStartRel as number), e: wd * DAY + (r.segEndRel as number), wd };
  };
  const head = (await rowsOf(fromDay, Math.min(toDay, fromDay + 7))).map(abs).filter((x) => x.wd >= fromDay && x.wd <= toDay);
  const tail = (await rowsOf(Math.max(fromDay, toDay - 7), toDay)).map(abs).filter((x) => x.wd >= fromDay && x.wd <= toDay);
  const s = head.length ? Math.min(...head.map((x) => x.s)) : null;
  const e = tail.length ? Math.max(...tail.map((x) => x.e)) : null;
  if (s === null || e === null || s >= e) return { s: fromDay * DAY, e: (toDay + 1) * DAY };
  return { s, e };
}
