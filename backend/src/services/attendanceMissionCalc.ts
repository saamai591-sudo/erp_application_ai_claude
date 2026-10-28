import { prisma } from "../lib/prisma";

// مدیریت تردد › ماموریت: محاسبه‌ی اثر ماموریتِ تاییدشده روی کارکرد (بدون وابستگی به سرویس مرخصی/مانده تا چرخه‌ی import نسازد).
// دو چیز جداست:
//  ۱) «پوشش» روزانه (missionForDay): ماموریت تاییدشده غیبت را برمی‌دارد. تمام‌روز در یک روز کاری = ساعت کاری خالصِ همان روز؛ ساعتی = بخشی از بازه‌ی درخواست که با
//     بازه‌های کاریِ همان روز هم‌پوشانی دارد (محور زمان پیوسته، مثل مرخصی ساعتی). روز غیرکاری دقیقه‌ی ماموریت ندارد.
//  ۲) «احتساب» (loadSettlements): فقط برای ماموریت روزانه‌ی تاییدشده و پایان‌یافته؛ در روزِ پایان ثبت می‌شود (تا تجمیع ماهانه‌ی آن روز در ماهِ پایان بیفتد):
//     طول درخواست (به تفکیک نوع درخواست) و طول گزارش‌های تاییدشده (به تفکیک نوع ماموریت و کل). هیچ «نوع پایه»ای نیست؛ تفاوت را فرمول می‌سازد.

const DAY_MS = 86400000;
const dayNum = (d: Date) => Math.floor(d.getTime() / DAY_MS);

export interface ApprovedMission {
  employeeId: number;
  requestTypeId: number;
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
    select: { employeeId: true, requestTypeId: true, fromDate: true, toDate: true, startMinute: true, endMinute: true },
  });
  return rows.map((r) => ({ employeeId: r.employeeId, requestTypeId: r.requestTypeId, fromDay: dayNum(r.fromDate), toDay: dayNum(r.toDate), startMinute: r.startMinute, endMinute: r.endMinute }));
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
  /** کل روزهای تقویمیِ درخواست‌ها (همه‌ی نوع درخواست‌ها) = «طول درخواست» */
  total: number;
  /** کل روزهای گزارش‌های تاییدشده (همه‌ی نوع‌ها) = «طول گزارش» */
  reportTotal: number;
  /** طول درخواست به تفکیک نوع درخواست (کلید = id نوع درخواست) */
  byRequestType: Record<number, number>;
  /** روزهای گزارش‌های تاییدشده به تفکیک نوع ماموریت (نوع گزارش؛ کلید = id نوع ماموریت) */
  byType: Record<number, number>;
}

const addTo = (rec: Record<number, number>, k: number, n: number) => {
  rec[k] = (rec[k] ?? 0) + n;
};

/** احتسابِ ماموریت‌های روزانه‌ی پایان‌یافته‌ی تاییدشده که روز پایانشان در بازه است؛ کلید نتیجه `<employeeId>:<dayNum روز پایان>` (کل در روز پایان می‌نشیند تا تجمیع ماهانه‌ی آن روز در ماهِ پایان بیفتد) */
export async function loadSettlements(employeeIds: number[], fromDay: number, toDay: number): Promise<Map<string, DaySettlement>> {
  const out = new Map<string, DaySettlement>();
  if (employeeIds.length === 0) return out;
  const rows = await prisma.attendanceMissionRequest.findMany({
    where: { employeeId: { in: employeeIds }, status: "APPROVED", endedAt: { not: null }, startMinute: null, toDate: { gte: new Date(fromDay * DAY_MS), lte: new Date(toDay * DAY_MS) } },
    select: { employeeId: true, requestTypeId: true, fromDate: true, toDate: true, reports: { where: { status: "APPROVED" }, select: { typeId: true, fromDate: true, toDate: true } } },
  });
  for (const r of rows) {
    const total = dayNum(r.toDate) - dayNum(r.fromDate) + 1;
    const key = `${r.employeeId}:${dayNum(r.toDate)}`;
    const cur = out.get(key) ?? { total: 0, reportTotal: 0, byRequestType: {}, byType: {} };
    let reported = 0;
    for (const p of r.reports) {
      const n = dayNum(p.toDate) - dayNum(p.fromDate) + 1;
      addTo(cur.byType, p.typeId, n);
      reported += n;
    }
    cur.total += total;
    cur.reportTotal += reported;
    addTo(cur.byRequestType, r.requestTypeId, total);
    out.set(key, cur);
  }
  return out;
}

/** دقیقه‌ی ماموریت‌های ساعتیِ تاییدشده‌ی یک روز به تفکیک نوع درخواست (هم‌پوشانی با بازه‌های کاری آن روز؛ روز غیرکاری ۰) */
export function hourlyMissionMinutesByType(missions: ApprovedMission[], employeeId: number, day: number, dayRows: any[]): Record<number, number> {
  const out: Record<number, number> = {};
  const work = dayRows.filter((r) => !r.rest && r.dayType === "WORK");
  for (const q of missions) {
    if (q.employeeId !== employeeId || q.startMinute === null) continue;
    const qs = q.fromDay * 1440 + q.startMinute, qe = q.toDay * 1440 + (q.endMinute as number);
    let minutes = 0;
    for (const r of work) {
      const s = day * 1440 + (r.segStartRel as number), e = day * 1440 + (r.segEndRel as number);
      minutes += Math.max(0, Math.min(qe, e) - Math.max(qs, s));
    }
    if (minutes > 0) out[q.requestTypeId] = (out[q.requestTypeId] ?? 0) + minutes;
  }
  return out;
}
