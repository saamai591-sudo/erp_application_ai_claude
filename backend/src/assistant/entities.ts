import { prisma } from "../lib/prisma";
import { EntityRef, SlotType } from "./types";
import { loose, norm, tokens } from "./text";

// جستجوی موجودیت‌ها برای پر کردن اسلات‌ها: مشتری، کالا/خدمت، نوع فروش، مرکز فروش. هر جستجو {exact?, candidates} برمی‌گرداند؛
// exact = یک مورد قطعی (کد دقیق یا عنوان دقیقاً برابر)، وگرنه اگر فقط یک کاندید بود همان انتخاب می‌شود و اگر چند تا بود کاربر انتخاب می‌کند.

const MAX_CANDIDATES = 8;
const FETCH_LIMIT = 300;

export interface SearchResult {
  exact: EntityRef | null;
  candidates: EntityRef[];
}

function customerLabel(c: { code: number; party: { detailTitle: string | null; name: string | null; firstName: string | null; lastName: string | null } }): string {
  const t = c.party.detailTitle || c.party.name || `${c.party.firstName ?? ""} ${c.party.lastName ?? ""}`.trim();
  return `${c.code} — ${t}`;
}

/** امتیازدهی ساده روی نتایجِ واکشی‌شده: همه‌ی کلمه‌ها باید در متنِ نرمال‌شده باشند؛ برابری کامل بالاتر، سپس شروع‌شدن با عبارت */
function rank<T>(rows: T[], query: string, textOf: (r: T) => string, codeOf: (r: T) => string | null): T[] {
  const q = loose(query);
  const toks = tokens(query).map((t) => loose(t));
  const scored: { r: T; s: number }[] = [];
  for (const r of rows) {
    const t = loose(textOf(r));
    const code = codeOf(r);
    if (code !== null && loose(code) === q) {
      scored.push({ r, s: 100 });
      continue;
    }
    if (!toks.every((k) => t.includes(k))) continue;
    scored.push({ r, s: t === q ? 90 : t.startsWith(q) ? 60 : t.includes(q) ? 50 : 30 });
  }
  scored.sort((a, b) => b.s - a.s);
  return scored.map((x) => x.r);
}

function decide(ranked: { ref: EntityRef; exact: boolean }[]): SearchResult {
  const exact = ranked.filter((x) => x.exact);
  const refs = ranked.slice(0, MAX_CANDIDATES).map((x) => x.ref);
  if (exact.length === 1) return { exact: exact[0].ref, candidates: refs };
  if (refs.length === 1) return { exact: refs[0], candidates: refs };
  return { exact: null, candidates: refs };
}

async function searchCustomer(query: string): Promise<SearchResult> {
  const toks = tokens(query);
  if (!toks.length) return { exact: null, candidates: [] };
  const num = /^\d+$/.test(norm(query)) ? Number(norm(query)) : null;
  const rows = await prisma.customer.findMany({
    where: {
      isActive: true,
      OR: [
        ...(num !== null ? [{ code: num }] : []),
        ...toks.flatMap((t) => [
          { party: { detailTitle: { contains: t, mode: "insensitive" as const } } },
          { party: { name: { contains: t, mode: "insensitive" as const } } },
          { party: { firstName: { contains: t, mode: "insensitive" as const } } },
          { party: { lastName: { contains: t, mode: "insensitive" as const } } },
        ]),
      ],
    },
    select: { id: true, code: true, party: { select: { detailTitle: true, name: true, firstName: true, lastName: true } } },
    take: FETCH_LIMIT,
  });
  const ranked = rank(rows, query, (c) => `${c.party.detailTitle ?? ""} ${c.party.name ?? ""} ${c.party.firstName ?? ""} ${c.party.lastName ?? ""}`, (c) => String(c.code));
  const q = loose(query);
  return decide(ranked.map((c) => ({ ref: { id: c.id, label: customerLabel(c) }, exact: String(c.code) === q || loose(c.party.detailTitle ?? "") === q })));
}

const partyLabel = (p: { detailCode: string; detailTitle: string }) => `${p.detailCode} — ${p.detailTitle}`;

/** هر طرف حساب فعال (مشتری، تأمین‌کننده، پرسنل، …) با نام/عنوان تفصیل/کد تفصیل */
async function searchParty(query: string): Promise<SearchResult> {
  const toks = tokens(query);
  if (!toks.length) return { exact: null, candidates: [] };
  const nq = norm(query);
  const rows = await prisma.party.findMany({
    where: {
      isActive: true,
      OR: [
        { detailCode: { equals: nq } },
        { nationalId: { equals: nq } },
        ...toks.flatMap((t) => [
          { detailTitle: { contains: t, mode: "insensitive" as const } },
          { name: { contains: t, mode: "insensitive" as const } },
          { firstName: { contains: t, mode: "insensitive" as const } },
          { lastName: { contains: t, mode: "insensitive" as const } },
        ]),
      ],
    },
    select: { id: true, detailCode: true, detailTitle: true, name: true, firstName: true, lastName: true },
    take: FETCH_LIMIT,
  });
  const ranked = rank(rows, query, (p) => `${p.detailTitle} ${p.name ?? ""} ${p.firstName ?? ""} ${p.lastName ?? ""}`, (p) => p.detailCode);
  const q = loose(query);
  return decide(ranked.map((p) => ({ ref: { id: p.id, label: partyLabel(p) }, exact: loose(p.detailCode) === q || loose(p.detailTitle) === q })));
}

async function searchGoods(query: string, kind?: "GOODS" | "SERVICE"): Promise<SearchResult> {
  const toks = tokens(query);
  if (!toks.length) return { exact: null, candidates: [] };
  const rows = await prisma.goodsItem.findMany({
    where: {
      isActive: true,
      ...(kind ? { kind } : {}),
      OR: [
        { fullCode: { equals: norm(query) } },
        { barcode: { equals: norm(query) } },
        ...toks.map((t) => ({ title: { contains: t, mode: "insensitive" as const } })),
      ],
    },
    select: { id: true, fullCode: true, title: true, barcode: true },
    take: FETCH_LIMIT,
  });
  const ranked = rank(rows, query, (g) => g.title, (g) => g.fullCode);
  const q = loose(query);
  const barcodeHit = rows.find((g) => g.barcode && loose(g.barcode) === q);
  const out = (barcodeHit ? [barcodeHit, ...ranked.filter((g) => g.id !== barcodeHit.id)] : ranked).map((g) => ({
    ref: { id: g.id, label: `${g.fullCode} — ${g.title}` },
    exact: loose(g.fullCode) === q || loose(g.title) === q || g.id === barcodeHit?.id,
  }));
  return decide(out);
}

async function searchSimple(model: "salesType" | "salesCenter", query: string): Promise<SearchResult> {
  const rows: { id: number; title: string }[] =
    model === "salesType"
      ? await prisma.salesType.findMany({ select: { id: true, title: true }, take: FETCH_LIMIT })
      : await prisma.salesCenter.findMany({ where: { isActive: true }, select: { id: true, title: true }, take: FETCH_LIMIT });
  const ranked = rank(rows, query, (r) => r.title, () => null);
  const q = loose(query);
  return decide(ranked.map((r) => ({ ref: { id: r.id, label: r.title }, exact: loose(r.title) === q })));
}

export async function searchEntity(type: SlotType, query: string): Promise<SearchResult> {
  switch (type) {
    case "customer":
      return searchCustomer(query);
    case "party":
      return searchParty(query);
    case "goodsItem":
      return searchGoods(query);
    case "salesType":
    case "salesCenter":
      return searchSimple(type, query);
    default:
      return { exact: null, candidates: [] };
  }
}

/** کاندیدهای پیشنهادی وقتی کاربر چیزی ننوشته (مثلاً فهرست مراکز فروش) */
export async function listOptions(type: "salesType" | "salesCenter"): Promise<EntityRef[]> {
  const rows: { id: number; title: string }[] =
    type === "salesType" ? await prisma.salesType.findMany({ select: { id: true, title: true }, orderBy: { id: "asc" }, take: MAX_CANDIDATES }) : await prisma.salesCenter.findMany({ where: { isActive: true }, select: { id: true, title: true }, orderBy: { id: "asc" }, take: MAX_CANDIDATES });
  return rows.map((r) => ({ id: r.id, label: r.title }));
}

/** برچسب یک موجودیت با شناسه (برای انتخاب با دکمه‌ی کاندید؛ وجود و فعال‌بودن دوباره سنجیده می‌شود) */
export async function entityLabel(type: SlotType, id: number): Promise<EntityRef | null> {
  switch (type) {
    case "customer": {
      const c = await prisma.customer.findFirst({ where: { id, isActive: true }, select: { id: true, code: true, party: { select: { detailTitle: true, name: true, firstName: true, lastName: true } } } });
      return c ? { id: c.id, label: customerLabel(c) } : null;
    }
    case "party": {
      const p = await prisma.party.findFirst({ where: { id, isActive: true }, select: { id: true, detailCode: true, detailTitle: true } });
      return p ? { id: p.id, label: partyLabel(p) } : null;
    }
    case "goodsItem": {
      const g = await prisma.goodsItem.findFirst({ where: { id, isActive: true }, select: { id: true, fullCode: true, title: true } });
      return g ? { id: g.id, label: `${g.fullCode} — ${g.title}` } : null;
    }
    case "salesType": {
      const t = await prisma.salesType.findUnique({ where: { id }, select: { id: true, title: true } });
      return t ? { id: t.id, label: t.title } : null;
    }
    case "salesCenter": {
      const c = await prisma.salesCenter.findFirst({ where: { id, isActive: true }, select: { id: true, title: true } });
      return c ? { id: c.id, label: c.title } : null;
    }
    default:
      return null;
  }
}
