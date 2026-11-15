import { prisma, getCurrentFiscalPeriod } from "../lib/prisma";
import { withoutFiscalPeriodScope } from "../lib/requestContext";
import { PartyBalanceRole, ROLE_TITLE, ROLES, Movement, MovementPart, MOVEMENT_PARTS, movementTotals, openingMovements } from "./partyBalanceService";
import { listRoleParties } from "./partyBalanceOpeningService";
import { parseIsoDay } from "../utils/inputParse";

// =========================================================================
// «مانده مشتریان / تامین‌کنندگان / طرف‌حساب‌ها» — گزارش مانده‌ی عملیاتی (نه از سند حسابداری؛ منبع: services/partyBalanceService.ts#movementTotals).
// فقط داخل یک سال مالی (سال مالی انتخاب‌شده): مانده‌ی اول دوره = افتتاحیه‌ی همان سال + گردش اسناد از ابتدای سال تا قبل از «از تاریخ»؛ بعد گردش بازه و مانده‌ی پایان.
// علامت: بدهکار (+) = طرف‌حساب به ما بدهکار است. مبالغ به ارز خودِ سند (بدون تبدیل)، پس هر ردیف یک ارز دارد.
// scope: CUSTOMER (فروش) | SUPPLIER (زنجیره تامین) | ALL (حسابداری؛ هر دو نقش).
//   mode SEPARATE = ردیف به تفکیک نقش؛ CONSOLIDATED = یک ردیف برای هر طرف‌حساب (جمع جبری دو نقش) + مانده‌ی هر نقش جدا برای مقایسه.
// =========================================================================

export type ReportScope = PartyBalanceRole | "ALL";
export type ReportMode = "SEPARATE" | "CONSOLIDATED";

export interface ReportQuery {
  from?: string;
  to?: string;
  partyId?: number;
  currencyId?: number;
  mode?: ReportMode;
  /** فقط ردیف‌هایی که مانده‌ی پایانشان صفر نیست */
  onlyWithBalance?: boolean;
  /** فقط طرف‌حساب‌هایی که هر دو نقش را دارند (فقط scope=ALL) */
  bothRoles?: boolean;
  /** کدام تب را بدهد (هم‌الگوی مرورهای زنجیره‌ای): GROUP = فقط groupRows، PARTY = فقط rows؛ خالی = هر دو */
  tab?: "GROUP" | "PARTY";
  /** انتخاب تب «گروه» (بالادست): «نقش:شناسه‌ی گروه:شناسه‌ی ارز» (گروه ۰ = بدون گروه) — تب طرف‌حساب را به همان گروه **و همان ارز** محدود می‌کند */
  groupKeys?: string[];
  /** انتخاب تب «طرف‌حساب» (بالادست): «شناسه‌ی طرف‌حساب:شناسه‌ی ارز» — تب گروه فقط همین طرف‌حساب‌ها در همان ارز را جمع می‌زند */
  partyKeys?: string[];
}

export interface ReportRow {
  key: string;
  role: PartyBalanceRole | null;
  roleTitle: string;
  partyId: number;
  partyCode: number | null;
  partyTitle: string;
  currencyId: number;
  currencyTitle: string;
  /** همه علامت‌دار (بدهکار +). ستون‌ها مثل «مرور فروش/خرید» سام: اول دوره، فروش(خرید)، برگشت، تخفیف، ارزش افزوده، خالص، دریافت، پرداخت، مانده */
  opening: number;
  sale: number;
  saleReturn: number;
  discount: number;
  vat: number;
  /** فروش + برگشت + تخفیف + ارزش افزوده */
  net: number;
  received: number;
  paid: number;
  closing: number;
  /** فقط در حالت تجمیعی: مانده‌ی پایان هر نقش */
  customerClosing: number | null;
  supplierClosing: number | null;
}

/** یک ردیف «به تفکیک گروه»: جمع نقش × گروه × ارز؛ همیشه به تفکیک نقش (گروه مشتری و گروه تامین‌کننده دو فهرست جدا هستند) و مستقل از حالت تفکیکی/تجمیعی */
export interface GroupRow {
  key: string;
  role: PartyBalanceRole;
  roleTitle: string;
  groupId: number | null;
  groupTitle: string;
  currencyId: number;
  currencyTitle: string;
  partyCount: number;
  opening: number;
  sale: number;
  saleReturn: number;
  discount: number;
  vat: number;
  net: number;
  received: number;
  paid: number;
  closing: number;
}

const toDate = (s: string, label: string): Date => parseIsoDay(s, label) as Date;
const dayBefore = (d: Date) => new Date(d.getTime() - 86400000);

export async function partyBalanceReport(scope: ReportScope, q: ReportQuery) {
  const period = await getCurrentFiscalPeriod();
  if (!period) throw new Error("دوره مالی جاری مشخص نیست");
  const from = q.from ? toDate(q.from, "از تاریخ") : period.fromDate;
  const to = q.to ? toDate(q.to, "تا تاریخ") : period.toDate;
  if (from < period.fromDate || to > period.toDate) throw new Error("بازه‌ی گزارش باید داخل سال مالی انتخاب‌شده باشد");
  if (from > to) throw new Error("«از تاریخ» نباید بعد از «تا تاریخ» باشد");
  const roles: PartyBalanceRole[] = scope === "ALL" ? ROLES : [scope];
  const mode: ReportMode = scope === "ALL" ? q.mode ?? "SEPARATE" : "SEPARATE";

  // جمع علامت‌دار هر (نقش، طرف‌حساب، ارز)
  type Acc = { role: PartyBalanceRole; partyId: number; currencyId: number; opening: number; parts: Record<MovementPart, number> };
  const acc = new Map<string, Acc>();
  const slot = (m: { role: PartyBalanceRole; partyId: number; currencyId: number }) => {
    const k = `${m.role}|${m.partyId}|${m.currencyId}`;
    let a = acc.get(k);
    if (!a) acc.set(k, (a = { role: m.role, partyId: m.partyId, currencyId: m.currencyId, opening: 0, parts: { SALE: 0, RETURN: 0, DISCOUNT: 0, VAT: 0, RECEIVED: 0, PAID: 0 } }));
    return a;
  };
  for (const role of roles) {
    const [open, before, during] = await Promise.all([
      openingMovements(period.id, role),
      from > period.fromDate ? movementTotals(period.id, null, dayBefore(from), role) : Promise.resolve(new Map<string, Movement>()),
      movementTotals(period.id, from, to, role),
    ]);
    for (const m of [...open.values(), ...before.values()]) slot(m).opening += m.debit - m.credit;
    for (const m of during.values()) {
      const a = slot(m);
      for (const p of MOVEMENT_PARTS) a.parts[p] += m.parts[p];
    }
  }

  const [currencies, parties] = await Promise.all([
    prisma.currency.findMany({ select: { id: true, title: true, decimalPlaces: true } }),
    withoutFiscalPeriodScope(() => prisma.party.findMany({ where: { id: { in: [...new Set([...acc.values()].map((a) => a.partyId))] } }, select: { id: true, detailTitle: true } })),
  ]);
  const curById = new Map<number, any>(currencies.map((c: any) => [c.id, c]));
  const titleOf = new Map<number, string>(parties.map((p: any) => [p.id, p.detailTitle]));
  const codes = new Map<string, number>();
  /** گروه هر طرف‌حساب در هر نقش (گروه مشتری / گروه تامین‌کننده) */
  const groupOf = new Map<string, { id: number | null; title: string | null }>();
  const ids = [...titleOf.keys()];
  if (ids.length) {
    const [cu, su]: any[][] = await Promise.all([
      prisma.customer.findMany({ where: { partyId: { in: ids } }, select: { partyId: true, code: true, groupId: true, group: { select: { title: true } } } }),
      prisma.supplier.findMany({ where: { partyId: { in: ids } }, select: { partyId: true, code: true, classGroupId: true, classGroup: { select: { title: true } } } }),
    ]);
    for (const c of cu) {
      codes.set(`CUSTOMER|${c.partyId}`, c.code);
      groupOf.set(`CUSTOMER|${c.partyId}`, { id: c.groupId, title: c.group?.title ?? null });
    }
    for (const s of su) {
      codes.set(`SUPPLIER|${s.partyId}`, s.code);
      groupOf.set(`SUPPLIER|${s.partyId}`, { id: s.classGroupId, title: s.classGroup?.title ?? null });
    }
  }
  const round = (n: number, cur: number) => {
    const f = 10 ** (curById.get(cur)?.decimalPlaces ?? 2);
    return Math.round(n * f) / f;
  };

  let list = [...acc.values()].filter((a) => (!q.partyId || a.partyId === q.partyId) && (!q.currencyId || a.currencyId === q.currencyId));
  if (scope === "ALL" && q.bothRoles) {
    const byParty = new Map<number, Set<string>>();
    for (const a of list) (byParty.get(a.partyId) ?? byParty.set(a.partyId, new Set()).get(a.partyId)!).add(a.role);
    list = list.filter((a) => byParty.get(a.partyId)!.size > 1);
  }
  if (q.partyKeys?.length) {
    const ps = new Set(q.partyKeys);
    list = list.filter((a) => ps.has(`${a.partyId}:${a.currencyId}`));
  }

  // «به تفکیک گروه»: جمع هر (نقش، گروه، ارز)؛ طرف‌حسابِ بدون گروه در «بدون گروه» می‌آید
  const groupAcc = new Map<string, { role: PartyBalanceRole; groupId: number | null; title: string; currencyId: number; parties: Set<number>; opening: number; parts: Record<MovementPart, number> }>();
  for (const a of list) {
    const g = groupOf.get(`${a.role}|${a.partyId}`) ?? { id: null, title: null };
    const k = `${a.role}|${g.id ?? 0}|${a.currencyId}`;
    let x = groupAcc.get(k);
    if (!x) groupAcc.set(k, (x = { role: a.role, groupId: g.id, title: g.title ?? "بدون گروه", currencyId: a.currencyId, parties: new Set(), opening: 0, parts: { SALE: 0, RETURN: 0, DISCOUNT: 0, VAT: 0, RECEIVED: 0, PAID: 0 } }));
    x.parties.add(a.partyId);
    x.opening += a.opening;
    for (const p of MOVEMENT_PARTS) x.parts[p] += a.parts[p];
  }
  const groupRows: GroupRow[] = [...groupAcc.values()].map((x) => {
    const net = x.parts.SALE + x.parts.RETURN + x.parts.DISCOUNT + x.parts.VAT;
    return {
      key: `${x.role}|${x.groupId ?? 0}|${x.currencyId}`,
      role: x.role,
      roleTitle: ROLE_TITLE[x.role],
      groupId: x.groupId,
      groupTitle: x.title,
      currencyId: x.currencyId,
      currencyTitle: curById.get(x.currencyId)?.title ?? "",
      partyCount: x.parties.size,
      opening: round(x.opening, x.currencyId),
      sale: round(x.parts.SALE, x.currencyId),
      saleReturn: round(x.parts.RETURN, x.currencyId),
      discount: round(x.parts.DISCOUNT, x.currencyId),
      vat: round(x.parts.VAT, x.currencyId),
      net: round(net, x.currencyId),
      received: round(x.parts.RECEIVED, x.currencyId),
      paid: round(x.parts.PAID, x.currencyId),
      closing: round(x.opening + net + x.parts.RECEIVED + x.parts.PAID, x.currencyId),
    };
  });

  // تب طرف‌حساب: محدود به گروه‌های انتخاب‌شده (تفکیکی: همان نقش و گروه؛ تجمیعی: همه‌ی ردیف‌های طرف‌حسابی که حداقل در یکی از گروه‌های انتخاب‌شده است)
  let rowList = list;
  if (q.groupKeys?.length) {
    const keys = new Set(q.groupKeys);
    const inGroup = (a: { role: PartyBalanceRole; partyId: number; currencyId: number }) => keys.has(`${a.role}:${groupOf.get(`${a.role}|${a.partyId}`)?.id ?? 0}:${a.currencyId}`);
    if (mode === "SEPARATE") rowList = list.filter(inGroup);
    else {
      // تجمیعی: هر ردیف = طرف‌حساب × ارز؛ همه‌ی نقش‌های همان طرف‌حساب در همان ارز می‌آیند
      const parties = new Set(list.filter(inGroup).map((a) => `${a.partyId}:${a.currencyId}`));
      rowList = list.filter((a) => parties.has(`${a.partyId}:${a.currencyId}`));
    }
  }

  const rows: ReportRow[] = [];
  const build = (key: string, role: PartyBalanceRole | null, roleTitle: string, partyId: number, currencyId: number, opening: number, parts: Record<MovementPart, number>, partyCode: number | null) => {
    const net = parts.SALE + parts.RETURN + parts.DISCOUNT + parts.VAT;
    return {
      key,
      role,
      roleTitle,
      partyId,
      partyCode,
      partyTitle: titleOf.get(partyId) ?? "",
      currencyId,
      currencyTitle: curById.get(currencyId)?.title ?? "",
      opening: round(opening, currencyId),
      sale: round(parts.SALE, currencyId),
      saleReturn: round(parts.RETURN, currencyId),
      discount: round(parts.DISCOUNT, currencyId),
      vat: round(parts.VAT, currencyId),
      net: round(net, currencyId),
      received: round(parts.RECEIVED, currencyId),
      paid: round(parts.PAID, currencyId),
      closing: round(opening + net + parts.RECEIVED + parts.PAID, currencyId),
      customerClosing: null,
      supplierClosing: null,
    } as ReportRow;
  };
  if (mode === "SEPARATE") {
    for (const a of rowList) rows.push(build(`${a.role}|${a.partyId}|${a.currencyId}`, a.role, ROLE_TITLE[a.role], a.partyId, a.currencyId, a.opening, a.parts, codes.get(`${a.role}|${a.partyId}`) ?? null));
  } else {
    const groups = new Map<string, { partyId: number; currencyId: number; opening: number; parts: Record<MovementPart, number>; customer: number; supplier: number; roles: Set<string> }>();
    for (const a of rowList) {
      const k = `${a.partyId}|${a.currencyId}`;
      let g = groups.get(k);
      if (!g) groups.set(k, (g = { partyId: a.partyId, currencyId: a.currencyId, opening: 0, parts: { SALE: 0, RETURN: 0, DISCOUNT: 0, VAT: 0, RECEIVED: 0, PAID: 0 }, customer: 0, supplier: 0, roles: new Set() }));
      g.opening += a.opening;
      for (const p of MOVEMENT_PARTS) g.parts[p] += a.parts[p];
      g.roles.add(a.role);
      const closing = a.opening + a.parts.SALE + a.parts.RETURN + a.parts.DISCOUNT + a.parts.VAT + a.parts.RECEIVED + a.parts.PAID;
      if (a.role === "CUSTOMER") g.customer += closing;
      else g.supplier += closing;
    }
    for (const g of groups.values()) {
      const row = build(`${g.partyId}|${g.currencyId}`, null, [...g.roles].map((r) => ROLE_TITLE[r as PartyBalanceRole]).join(" و "), g.partyId, g.currencyId, g.opening, g.parts, codes.get(`CUSTOMER|${g.partyId}`) ?? codes.get(`SUPPLIER|${g.partyId}`) ?? null);
      row.customerClosing = g.roles.has("CUSTOMER") ? round(g.customer, g.currencyId) : null;
      row.supplierClosing = g.roles.has("SUPPLIER") ? round(g.supplier, g.currencyId) : null;
      rows.push(row);
    }
  }

  const visible = rows
    .filter((r) => r.opening !== 0 || r.sale !== 0 || r.saleReturn !== 0 || r.discount !== 0 || r.vat !== 0 || r.received !== 0 || r.paid !== 0 || r.closing !== 0)
    .filter((r) => !q.onlyWithBalance || r.closing !== 0)
    .sort((a, b) => a.partyTitle.localeCompare(b.partyTitle, "fa") || a.currencyTitle.localeCompare(b.currencyTitle, "fa") || a.roleTitle.localeCompare(b.roleTitle, "fa"));

  return {
    scope,
    mode,
    period: { id: period.id, title: period.title, fromDate: period.fromDate, toDate: period.toDate },
    from,
    to,
    rows: q.tab === "GROUP" ? [] : visible,
    groupRows: q.tab === "PARTY" ? [] : groupRows
      .filter((r) => r.opening !== 0 || r.sale !== 0 || r.saleReturn !== 0 || r.discount !== 0 || r.vat !== 0 || r.received !== 0 || r.paid !== 0 || r.closing !== 0)
      .filter((r) => !q.onlyWithBalance || r.closing !== 0)
      .sort((a, b) => a.roleTitle.localeCompare(b.roleTitle, "fa") || (a.groupId === null ? 1 : 0) - (b.groupId === null ? 1 : 0) || a.groupTitle.localeCompare(b.groupTitle, "fa") || a.currencyTitle.localeCompare(b.currencyTitle, "fa")),
  };
}

/** طرف‌حساب‌های قابل انتخاب در فیلتر گزارش (scope=ALL: هر دو نقش بدون تکرار) */
export async function reportParties(scope: ReportScope) {
  const lists = await Promise.all((scope === "ALL" ? ROLES : [scope]).map((r) => listRoleParties(r)));
  const seen = new Map<number, { id: number; code: number; title: string }>();
  for (const l of lists) for (const p of l) if (!seen.has(p.id)) seen.set(p.id, { id: p.id, code: p.code, title: p.title });
  return [...seen.values()];
}
