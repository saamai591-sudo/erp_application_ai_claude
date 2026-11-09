import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { withoutFiscalPeriodScope } from "../lib/requestContext";
import { AssetError } from "./assetError";
import { day } from "./assetDepreciationService";

// «گزارش مرور گروه دارایی» (دارایی ثابت › گزارش): دو تب — گروه حسابداری و دارایی — با ستون‌های: اول دوره، افزایش، نقل و انتقال، کاهش، بهای پایان دوره،
// استهلاک اول دوره، طی دوره، نقل و انتقال، استهلاک دارایی‌های خارج‌شده، استهلاک انباشته، ارزش دفتری.
// هدف: تطبیق با «مرور حسابها» ← هر مبلغ **با تاریخ سندی که برایش صادر می‌شود** در بازه می‌افتد و رکوردِ وسط بازه کامل می‌آید (بدون تسهیم به نسبت روز):
//  • افزایش: تاریخ سند تحصیل (اگر سند دارد) وگرنه تاریخ تحصیل؛  • استهلاک دوره‌ای: تاریخ پایان دوره؛  • رکورد «تا قبل از تغییر گروه» و نقل و انتقال: تاریخ هدر تغییر گروه.
// پلاکی که در بازه گروهش عوض شده در دو ردیف می‌آید: گروه مبدا (نقل و انتقال منفی) و گروه مقصد (مثبت). کاهش و استهلاک دارایی‌های خارج‌شده تا ساخت فروش/اسقاط صفر است.

const D = (v: any) => new Prisma.Decimal(v ?? 0);

interface Cell {
  open: Prisma.Decimal;
  inc: Prisma.Decimal;
  transfer: Prisma.Decimal;
  dec: Prisma.Decimal;
  accOpen: Prisma.Decimal;
  accDuring: Prisma.Decimal;
  accTransfer: Prisma.Decimal;
  accOut: Prisma.Decimal;
}
const zero = (): Cell => ({ open: D(0), inc: D(0), transfer: D(0), dec: D(0), accOpen: D(0), accDuring: D(0), accTransfer: D(0), accOut: D(0) });

export async function assetGroupReview(fromStr: string, toStr: string, groupIds?: number[]) {
  const from = new Date(fromStr);
  const to = new Date(toStr);
  if (!fromStr || !toStr || Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) throw new AssetError("از تاریخ و تا تاریخ الزامی است");
  if (day(from) > day(to)) throw new AssetError("«از تاریخ» نباید بعد از «تا تاریخ» باشد");

  const assets = await withoutFiscalPeriodScope(() => prisma.fixedAsset.findMany({
    where: { confirmedAt: { not: null }, cost: { not: null } },
    include: {
      acquisitionJournalEntry: { select: { date: true } },
      depreciationItems: { select: { amount: true, assetGroupId: true, run: { select: { reportingPeriod: { select: { toDate: true } } } }, changeItem: { select: { change: { select: { date: true } } } }, exitItem: { select: { exit: { select: { date: true } } } } } },
      exitItems: { where: { exit: { status: "CONFIRMED" } }, select: { groupId: true, costAtExit: true, accumulatedAtExit: true, exit: { select: { date: true } } } },
      groupChangeItems: { where: { change: { status: "CONFIRMED" } }, select: { fromGroupId: true, costAtChange: true, accumulatedAtChange: true, change: { select: { date: true, toGroupId: true } } } },
    },
  }));
  const groups = new Map((await prisma.assetGroup.findMany({ select: { id: true, title: true } })).map((g) => [g.id, g.title]));

  const key = (assetId: number, groupId: number) => `${assetId}|${groupId}`;
  const cells = new Map<string, Cell>();
  const cell = (assetId: number, groupId: number) => {
    const k = key(assetId, groupId);
    let c = cells.get(k);
    if (!c) {
      c = zero();
      cells.set(k, c);
    }
    return c;
  };
  const inRange = (d: Date) => day(d) >= day(from) && day(d) <= day(to);
  const before = (d: Date) => day(d) < day(from);

  for (const a of assets) {
    const cost = D(a.cost);
    const changes = [...a.groupChangeItems].sort((x, y) => day(x.change.date) - day(y.change.date));
    const initialGroup = changes.length ? changes[0].fromGroupId : a.assetGroupId;
    const entryDate = a.acquisitionJournalEntry?.date ?? a.acquisitionDate;

    // ورود بها به گروه اولیه
    if (before(entryDate)) cell(a.id, initialGroup).open = cell(a.id, initialGroup).open.add(cost);
    else if (inRange(entryDate)) cell(a.id, initialGroup).inc = cell(a.id, initialGroup).inc.add(cost);
    // استهلاک انباشته‌ی افتتاحیه (پلاک دستی) در گروه اولیه، به تاریخ ورود
    const opening = D(a.openingAccumulatedDepreciation);
    if (!opening.isZero()) {
      if (before(entryDate)) cell(a.id, initialGroup).accOpen = cell(a.id, initialGroup).accOpen.add(opening);
      else if (inRange(entryDate)) cell(a.id, initialGroup).accDuring = cell(a.id, initialGroup).accDuring.add(opening);
    }
    // نقل و انتقال‌ها
    for (const ch of changes) {
      const d = ch.change.date;
      const c = D(ch.costAtChange);
      const acc = D(ch.accumulatedAtChange);
      if (before(d)) {
        cell(a.id, ch.fromGroupId).open = cell(a.id, ch.fromGroupId).open.sub(c);
        cell(a.id, ch.change.toGroupId).open = cell(a.id, ch.change.toGroupId).open.add(c);
        cell(a.id, ch.fromGroupId).accOpen = cell(a.id, ch.fromGroupId).accOpen.sub(acc);
        cell(a.id, ch.change.toGroupId).accOpen = cell(a.id, ch.change.toGroupId).accOpen.add(acc);
      } else if (inRange(d)) {
        cell(a.id, ch.fromGroupId).transfer = cell(a.id, ch.fromGroupId).transfer.sub(c);
        cell(a.id, ch.change.toGroupId).transfer = cell(a.id, ch.change.toGroupId).transfer.add(c);
        cell(a.id, ch.fromGroupId).accTransfer = cell(a.id, ch.fromGroupId).accTransfer.sub(acc);
        cell(a.id, ch.change.toGroupId).accTransfer = cell(a.id, ch.change.toGroupId).accTransfer.add(acc);
      }
    }
    // خروج (اسقاط/زیان/اهدا): کاهش بها و استهلاک انباشته در گروهِ روز خروج
    for (const ex of a.exitItems) {
      const d = ex.exit.date;
      const c = D(ex.costAtExit);
      const acc = D(ex.accumulatedAtExit);
      if (before(d)) {
        cell(a.id, ex.groupId).open = cell(a.id, ex.groupId).open.sub(c);
        cell(a.id, ex.groupId).accOpen = cell(a.id, ex.groupId).accOpen.sub(acc);
      } else if (inRange(d)) {
        cell(a.id, ex.groupId).dec = cell(a.id, ex.groupId).dec.add(c);
        cell(a.id, ex.groupId).accOut = cell(a.id, ex.groupId).accOut.add(acc);
      }
    }
    // استهلاک (به گروهِ ثبت‌شده در خود رکورد)
    for (const it of a.depreciationItems) {
      const docDate = it.changeItem ? it.changeItem.change.date : it.exitItem ? it.exitItem.exit.date : it.run?.reportingPeriod.toDate;
      if (!docDate) continue;
      if (before(docDate)) cell(a.id, it.assetGroupId).accOpen = cell(a.id, it.assetGroupId).accOpen.add(it.amount);
      else if (inRange(docDate)) cell(a.id, it.assetGroupId).accDuring = cell(a.id, it.assetGroupId).accDuring.add(it.amount);
    }
  }

  const assetById = new Map(assets.map((a) => [a.id, a]));
  const finish = (c: Cell) => {
    const endCost = c.open.add(c.inc).add(c.transfer).sub(c.dec);
    const acc = c.accOpen.add(c.accDuring).add(c.accTransfer).sub(c.accOut);
    return {
      open: c.open.toString(),
      inc: c.inc.toString(),
      transfer: c.transfer.toString(),
      dec: c.dec.toString(),
      endCost: endCost.toString(),
      accOpen: c.accOpen.toString(),
      accDuring: c.accDuring.toString(),
      accTransfer: c.accTransfer.toString(),
      accOut: c.accOut.toString(),
      accumulated: acc.toString(),
      bookValue: endCost.sub(acc).toString(),
    };
  };
  const nonZero = (c: Cell) => ![c.open, c.inc, c.transfer, c.dec, c.accOpen, c.accDuring, c.accTransfer, c.accOut].every((x) => x.isZero());

  // تب دارایی
  const assetRows = [];
  const groupAgg = new Map<number, Cell>();
  for (const [k, c] of cells) {
    if (!nonZero(c)) continue;
    const [aid, gid] = k.split("|").map(Number);
    if (groupIds?.length && !groupIds.includes(gid)) continue;
    const a = assetById.get(aid)!;
    assetRows.push({ assetId: aid, detailCode: a.detailCode, title: a.title, groupId: gid, groupTitle: groups.get(gid) ?? "", ...finish(c) });
    const g = groupAgg.get(gid) ?? zero();
    for (const f of Object.keys(g) as (keyof Cell)[]) g[f] = g[f].add(c[f]);
    groupAgg.set(gid, g);
  }
  assetRows.sort((x, y) => x.detailCode.localeCompare(y.detailCode) || x.groupTitle.localeCompare(y.groupTitle));
  const groupRows = Array.from(groupAgg.entries())
    .map(([gid, c]) => ({ groupId: gid, groupTitle: groups.get(gid) ?? "", ...finish(c) }))
    .sort((x, y) => x.groupTitle.localeCompare(y.groupTitle));
  return { groups: groupRows, assets: assetRows };
}
