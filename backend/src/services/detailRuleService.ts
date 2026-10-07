import { prisma } from "../lib/prisma";

// «قواعد تفصیل» (کالا و خدمت › تنظیمات): برای یک رکورد «حسابداری کالا و خدمت» و یک تاریخ اجرا، مشخص می‌کند تفصیل‌های سطح ۱/۲/۳ ردیف‌های
// سند حسابداری آن معین از کجا پر شوند: ثابت (یک کد تفصیل) یا از سند انبار (تفصیل پایه‌ی سند / تفصیل‌های اضافه‌ی تنظیم «تفصیل‌های سند انبار»).
// هدر شرط‌های تفکیک را تعیین می‌کند (انبار / گروه کالا / طرف حساب)؛ هر ردیف دیتیل یا همه‌ی شرط‌های انتخاب‌شده را پر دارد یا همه را خالی (ردیف «بقیه»)،
// پس تداخل مبهم ممکن نیست. گروه کالا درختی است: قاعده‌ی گروه Z شامل زیرگروه‌های Z هم می‌شود و نزدیک‌ترین گروه برنده است.

/** انواع حسابِ «حسابداری کالا و خدمت» که در صدور سند اسناد انبار استفاده می‌شوند و قاعده‌ی تفصیل می‌گیرند */
export const RULE_ACCOUNT_TYPES = ["INVENTORY", "WAREHOUSE_RECEIPT_CREDIT", "WAREHOUSE_ISSUE_DEBIT", "SERVICE_PURCHASE", "PURCHASE_VAT", "PURCHASE_PAYABLE", "PURCHASE_CONTROL"];

/** شرط «انبار» فقط برای حساب‌هایی معنا دارد که از انبار سند می‌آیند؛ برای خرید خدمت/مالیات/پرداختنی انبار ندارند */
export const WAREHOUSE_CONDITION_TYPES = ["INVENTORY", "WAREHOUSE_RECEIPT_CREDIT", "WAREHOUSE_ISSUE_DEBIT"];

export interface RuleRow {
  id: number;
  warehouseId: number | null;
  goodsGroupId: number | null;
  partyDetailCode: string | null;
  slot1Source: string | null;
  slot1Code: string | null;
  slot2Source: string | null;
  slot2Code: string | null;
  slot3Source: string | null;
  slot3Code: string | null;
}

export interface RuleHeader {
  id: number;
  settingId: number;
  effectiveDate: Date;
  byWarehouse: boolean;
  byGoodsGroup: boolean;
  byParty: boolean;
  rows: RuleRow[];
}

export interface RuleContext {
  warehouseId: number | null;
  goodsGroupId: number | null;
  /** کد تفصیلِ هدر سند (طرف حساب)؛ فقط وقتی از نوع طرف حساب باشد */
  partyCode: string | null;
}

/** مجموعه‌ی قاعده‌های چند رکورد حسابداری کالا و خدمت، یک‌بار واکشی شده برای صدور دسته‌ای */
export class DetailRuleIndex {
  private bySetting = new Map<number, RuleHeader[]>();
  private parentOf = new Map<number, number | null>();

  static async load(settingIds: number[]): Promise<DetailRuleIndex> {
    const idx = new DetailRuleIndex();
    const headers = settingIds.length
      ? await prisma.detailRuleHeader.findMany({ where: { settingId: { in: settingIds } }, include: { rows: true }, orderBy: { effectiveDate: "asc" } })
      : [];
    for (const h of headers as any[]) {
      const arr = idx.bySetting.get(h.settingId) ?? [];
      arr.push(h as RuleHeader);
      idx.bySetting.set(h.settingId, arr);
    }
    if (headers.some((h: any) => h.byGoodsGroup)) {
      const groups = await prisma.goodsGroup.findMany({ select: { id: true, parentId: true } });
      for (const g of groups) idx.parentOf.set(g.id, g.parentId);
    }
    return idx;
  }

  /** فاصله‌ی گروه کالای سند تا گروه قاعده در درخت (۰ = خودش)؛ null = جزو زیرشاخه‌ی آن نیست */
  private groupDistance(itemGroupId: number | null, ruleGroupId: number): number | null {
    let cur = itemGroupId;
    let d = 0;
    const seen = new Set<number>();
    while (cur != null && !seen.has(cur)) {
      if (cur === ruleGroupId) return d;
      seen.add(cur);
      cur = this.parentOf.get(cur) ?? null;
      d++;
    }
    return null;
  }

  /** قاعده‌ی مؤثر (آخرین تاریخ اجرای ≤ تاریخ سند) و ردیف منطبق با شرط‌ها؛ null اگر قاعده‌ای نباشد */
  pick(settingId: number, docDate: Date, ctx: RuleContext): { header: RuleHeader; row: RuleRow } | null {
    const headers = this.bySetting.get(settingId) ?? [];
    const limit = new Date(docDate).getTime();
    let header: RuleHeader | null = null;
    for (const h of headers) {
      if (new Date(h.effectiveDate).getTime() > limit) continue;
      if (!header || new Date(h.effectiveDate).getTime() > new Date(header.effectiveDate).getTime()) header = h;
    }
    if (!header) return null;

    const fallback = header.rows.find((r) => r.warehouseId == null && r.goodsGroupId == null && r.partyDetailCode == null) ?? null;
    let best: { row: RuleRow; dist: number } | null = null;
    for (const r of header.rows) {
      if (r === fallback) continue;
      if (header.byWarehouse && r.warehouseId !== ctx.warehouseId) continue;
      if (header.byParty && r.partyDetailCode !== ctx.partyCode) continue;
      let dist = 0;
      if (header.byGoodsGroup) {
        if (r.goodsGroupId == null) continue;
        const d = this.groupDistance(ctx.goodsGroupId, r.goodsGroupId);
        if (d == null) continue;
        dist = d;
      }
      if (!best || dist < best.dist) best = { row: r, dist };
    }
    const row = best?.row ?? fallback;
    return row ? { header, row } : null;
  }
}

export interface RuleSlotAccount {
  title: string;
  detailType1Id: number | null;
  detailType2Id: number | null;
  detailType3Id: number | null;
}

export interface RuleDocValues {
  /** کد تفصیل پایه‌ی سند (InventoryDocument.detailCode) و نوع تفصیل آن */
  baseCode: string | null;
  baseTypeId: number | null;
  /** مقدارهای تفصیل‌های اضافه‌ی ردیف/هدر: typeId → کد */
  lineValues: Map<number, string>;
  headerValues: Map<number, string>;
}

/**
 * مقدار تفصیل‌های سه‌گانه‌ی ردیف سند حسابداری را طبق قاعده می‌سازد. فقط سطح‌هایی که حساب برایشان نوع تفصیل دارد و قاعده منبع تعیین کرده.
 * اگر منبع «از سند» باشد ولی سند مقدار نداشته باشد، خطا در errors برمی‌گردد (ردیف صادر نمی‌شود).
 */
export function applyRule(
  row: RuleRow,
  account: RuleSlotAccount,
  doc: RuleDocValues,
  typeTitles: Map<number, string>
): { fields: { detail1Code?: string; detail2Code?: string; detail3Code?: string }; errors: string[] } {
  const fields: { detail1Code?: string; detail2Code?: string; detail3Code?: string } = {};
  const errors: string[] = [];
  const slots = [
    { n: 1 as const, typeId: account.detailType1Id, source: row.slot1Source, code: row.slot1Code },
    { n: 2 as const, typeId: account.detailType2Id, source: row.slot2Source, code: row.slot2Code },
    { n: 3 as const, typeId: account.detailType3Id, source: row.slot3Source, code: row.slot3Code },
  ];
  for (const s of slots) {
    if (!s.typeId || !s.source) continue;
    let value: string | null = null;
    if (s.source === "FIXED") {
      value = s.code;
    } else if (doc.baseTypeId === s.typeId) {
      value = doc.baseCode;
    } else {
      value = doc.lineValues.get(s.typeId) ?? doc.headerValues.get(s.typeId) ?? null;
    }
    if (!value) {
      errors.push(`مقدار تفصیل «${typeTitles.get(s.typeId) ?? ""}» (سطح ${s.n} حساب «${account.title}») طبق قاعده‌ی تفصیل باید از سند گرفته شود ولی در سند خالی است`);
      continue;
    }
    fields[`detail${s.n}Code` as "detail1Code"] = value;
  }
  return { fields, errors };
}
