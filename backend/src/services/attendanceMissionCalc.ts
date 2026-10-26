import { prisma } from "../lib/prisma";

// مدیریت تردد › ماموریت: محاسبه‌ی اثر ماموریتِ تاییدشده روی کارکرد (بدون وابستگی به سرویس مرخصی/مانده تا چرخه‌ی import نسازد).
// دو چیز جداست:
//  ۱) «پوشش» روزانه (missionForDay): ماموریت تاییدشده غیبت را برمی‌دارد. تمام‌روز در یک روز کاری = ساعت کاری خالصِ همان روز؛ ساعتی = بخشی از بازه‌ی درخواست که با
//     بازه‌های کاریِ همان روز هم‌پوشانی دارد (محور زمان پیوسته، مثل مرخصی ساعتی). روز غیرکاری دقیقه‌ی ماموریت ندارد.
//  ۲) «احتساب» (loadSettlements): فقط برای ماموریت روزانه‌ی تاییدشده و پایان‌یافته؛ کل بازه (روز تقویمی) در روزِ پایان و به تفکیک نوع ثبت می‌شود
//     (گزارش‌های تاییدشده بازه‌هایی را به نوع دیگر می‌برند، باقیمانده به نوع خود درخواست)، تا تجمیع ماهانه‌ی آن روز در ماهِ پایان بیفتد.

const DAY_MS = 86400000;
const dayNum = (d: Date) => Math.floor(d.getTime() / DAY_MS);

export interface ApprovedMission {
  employeeId: number;
  fromDay: number;
  toDay: number;
  startMinute: number | null;
  endMinute: number | null;
}

export interface DayMission {
  total: number;
  /** ماموریت روزانه‌ی تاییدشده آن روز را می‌پوشاند (غیبت نیست) */
  hasDaily: boolean;
}

/** ماموریت‌های تاییدشده‌ی کارمندان که با بازه‌ی روزها هم‌پوشان‌اند (یک روز حاشیه برای ماموریت ساعتیِ شبانه) */
export async function loadMissions(employeeIds: number[], fromDay: number, toDay: number): Promise<ApprovedMission[]> {
  if (employeeIds.length === 0) return [];
  const rows = await prisma.attendanceMissionRequest.findMany({
    where: { employeeId: { in: employeeIds }, status: "APPROVED", fromDate: { lte: new Date((toDay + 1) * DAY_MS) }, toDate: { gte: new Date((fromDay - 1) * DAY_MS) } },
    select: { employeeId: true, fromDate: true, toDate: true, startMinute: true, endMinute: true },
  });
  return rows.map((r) => ({ employeeId: r.employeeId, fromDay: dayNum(r.fromDate), toDay: dayNum(r.toDate), startMinute: r.startMinute, endMinute: r.endMinute }));
}

export function missionForDay(missions: ApprovedMission[], employeeId: number, day: number, dayRows: any[]): DayMission {
  const out: DayMission = { total: 0, hasDaily: false };
  const work = dayRows.filter((r) => !r.rest && r.dayType === "WORK");
  for (const q of missions) {
    if (q.employeeId !== employeeId) continue;
    let minutes = 0;
    if (q.startMinute === null) {
      if (day < q.fromDay || day > q.toDay) continue;
      out.hasDaily = true;
      minutes = work.length ? work[0].dayNetMinutes ?? 0 : 0;
    } else {
      const qs = q.fromDay * 1440 + q.startMinute, qe = q.toDay * 1440 + (q.endMinute as number);
      for (const r of work) {
        const s = day * 1440 + (r.segStartRel as number), e = day * 1440 + (r.segEndRel as number);
        minutes += Math.max(0, Math.min(qe, e) - Math.max(qs, s));
      }
    }
    out.total += minutes;
  }
  return out;
}

export interface DaySettlement {
  /** کل روزهای تقویمیِ ماموریت (همه‌ی انواع) */
  total: number;
  /** روز به تفکیک نوع ماموریت (کلید = id نوع) */
  byType: Record<number, number>;
}

/** احتسابِ ماموریت‌های پایان‌یافته‌ی تاییدشده که روز پایانشان در بازه است؛ کلید نتیجه `<employeeId>:<dayNum روز پایان>` */
export async function loadSettlements(employeeIds: number[], fromDay: number, toDay: number): Promise<Map<string, DaySettlement>> {
  const out = new Map<string, DaySettlement>();
  if (employeeIds.length === 0) return out;
  const rows = await prisma.attendanceMissionRequest.findMany({
    where: { employeeId: { in: employeeIds }, status: "APPROVED", endedAt: { not: null }, startMinute: null, toDate: { gte: new Date(fromDay * DAY_MS), lte: new Date(toDay * DAY_MS) } },
    select: { employeeId: true, typeId: true, fromDate: true, toDate: true, reports: { where: { status: "APPROVED" }, select: { typeId: true, fromDate: true, toDate: true } } },
  });
  for (const r of rows) {
    const total = dayNum(r.toDate) - dayNum(r.fromDate) + 1;
    const byType: Record<number, number> = {};
    let reported = 0;
    for (const p of r.reports) {
      const n = dayNum(p.toDate) - dayNum(p.fromDate) + 1;
      byType[p.typeId] = (byType[p.typeId] ?? 0) + n;
      reported += n;
    }
    byType[r.typeId] = (byType[r.typeId] ?? 0) + Math.max(0, total - reported);
    const key = `${r.employeeId}:${dayNum(r.toDate)}`;
    const cur = out.get(key) ?? { total: 0, byType: {} };
    cur.total += total;
    for (const [t, n] of Object.entries(byType)) cur.byType[Number(t)] = (cur.byType[Number(t)] ?? 0) + n;
    out.set(key, cur);
  }
  return out;
}
