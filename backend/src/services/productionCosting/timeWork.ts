import { prisma } from "../../lib/prisma";
import { displayDate } from "../../utils/dateDisplay";
import { fail } from "../productionCommon";
import { loadTimeStandards, timeAt } from "../productionTimeService";
import type { AcctCalc } from "./accounts";
import type { CenterCalc, CenterItemCalc, CostCtx, CostInputs } from "./types";

/** کار معادل تبدیل یک کالا (تولید + پای کار آخر به واحد) */
const convEUOf = (it: CenterItemCalc) => it.finished + it.wipQty * it.wipPct;

/** زمان‌های استاندارد دوره از «زمان‌بندی تولید» و کار دقیقه‌ای هر کالای مرکز برای یک مبنای زمانی */
export async function prepareTimeWork(ctx: CostCtx) {
  const { rp } = ctx;
  const timeStd = await loadTimeStandards(rp.toDate);
  const driverTitle = new Map((await prisma.costTimeDriver.findMany({ select: { id: true, title: true } })).map((d) => [d.id, d.title]));
  const dayBeforeStart = new Date(rp.fromDate.getTime() - 86400000);
  /** کار دقیقه‌ای یک کالای مرکز برای یک مبنای زمانی: F = تولید (هر ردیف آمار × زمان تاریخ خودش)، E = پای کار آخر، O = پای کار اول؛ missing = تاریخ‌هایی که زمان ندارند */
  const timeWork = (c: CenterCalc, it: CenterItemCalc, did: number) => {
    let F = 0, E = 0, O = 0;
    const missing = new Set<string>();
    for (const st of it.stats) {
      const m = timeAt(timeStd, c.id, it.itemId, did, st.date);
      if (m === undefined) missing.add(displayDate(st.date));
      else F += st.qty * m;
    }
    const eEU = it.wipQty * it.wipPct;
    if (eEU > 0) {
      const m = timeAt(timeStd, c.id, it.itemId, did, rp.toDate);
      if (m === undefined) missing.add(`${displayDate(rp.toDate)} (پای کار آخر دوره)`);
      else E = eEU * m;
    }
    const oEU = it.open.qty * it.open.pct;
    if (oEU > 0) {
      const m = timeAt(timeStd, c.id, it.itemId, did, dayBeforeStart) ?? timeAt(timeStd, c.id, it.itemId, did, rp.fromDate);
      if (m === undefined) missing.add(`${displayDate(dayBeforeStart)} (پای کار اول دوره)`);
      else O = oEU * m;
    }
    return { F, E, O, missing: [...missing] };
  };
  return { timeStd, driverTitle, timeWork };
}
export type TimeWork = Awaited<ReturnType<typeof prepareTimeWork>>;

/** هر مرکزی که از معینِ دارای مبنای زمانی هزینه می‌گیرد، باید برای همه‌ی کالاهای دارای کارش در تاریخ‌های کارشان زمان (یا صفر) داشته باشد */
export function assertTimeCoverage(inputs: CostInputs, accts: AcctCalc[], time: TimeWork) {
  const { centers, itemLabel } = inputs;
  const { driverTitle, timeWork } = time;
  {
    const problems: string[] = [];
    for (const a of accts) {
      if (a.total <= 0 || a.basis !== "TIME_DRIVER" || a.driverId === null) continue;
      const dt = driverTitle.get(a.driverId) ?? `#${a.driverId}`;
      for (const c of [...centers.values()].sort((x, y) => x.id - y.id)) {
        if ((a.direct.get(c.id) ?? 0) === 0) continue; // فقط مرکزی که از این معین هزینه می‌گیرد
        const working = [...c.items.values()].filter((it) => convEUOf(it) > 0).sort((x, y) => x.itemId - y.itemId);
        const miss = working.map((it) => ({ it, dates: timeWork(c, it, a.driverId!).missing })).filter((x) => x.dates.length);
        if (!miss.length) continue;
        const what = miss.map((x) => `«${itemLabel(x.it.itemId)}» (تاریخ ${x.dates.slice(0, 3).join("، ")}${x.dates.length > 3 ? " و ..." : ""})`).join("، ");
        problems.push(`مرکز «${c.title}»: برای مبنای زمانی «${dt}» (حساب «${a.title}») زمان این کالاها در «زمان‌بندی تولید» ثبت نشده است: ${what} (اگر کالا از این مرحله عبور نمی‌کند صفر ثبت کنید؛ برگه باید تاریخ اجرای ≤ تاریخ آمار داشته باشد)`);
      }
    }
    if (problems.length) fail(`محاسبه انجام نشد؛ مشکل‌ها را برطرف کنید:\n${problems.join("\n")}`);
  }
}
