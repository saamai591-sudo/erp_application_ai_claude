import { prisma } from "../lib/prisma";
import { findEffectiveSetting } from "./goodsAccountingSettingService";
import { DetailRuleIndex, applyRule } from "./detailRuleService";
import { loadDocumentDetails } from "./docDetailService";
import { resolveAccountDetailFields, resolveDetailTypeId } from "../utils/detailValues";

// حساب بستانکارِ «سند تحصیل دارایی» برای هر جزء (ردیف رسید دارایی): همان معینی که در «حسابداری کالا و خدمت» برای مبنای آن ردیف تعیین شده — نه از سند منبع.
//  • مبنای فاکتور خرید (مجوز تحویل / بدون مبنا): «کنترل خرید» (PURCHASE_CONTROL) به کلید گروه حسابداری کالا + نوع خرید فاکتور، مؤثر در تاریخ فاکتور؛
//    تفصیل‌ها مثل سند فاکتور (طرف حساب فاکتور + «قواعد تفصیل» همان رکورد).
//  • مبنای حواله «دارایی ثابت»: «بدهکار حواله انبار» (WAREHOUSE_ISSUE_DEBIT) به کلید گروه حسابداری کالا + نوع سند انبار، مؤثر در تاریخ حواله؛ تفصیل‌ها مثل سند انبار.
// رکورد مورداستفاده در خروجی می‌آید تا سازنده‌ی سند بعد از صدور آن را قفل کند (markSettingsUsed).

export interface ControlAccount {
  settingId: number;
  accountId: number;
  d1: string | null;
  d2: string | null;
  d3: string | null;
}

export async function resolveAssetCreditAccount(receiptLineId: number): Promise<{ ok: true; value: ControlAccount } | { ok: false; reason: string }> {
  const rl = await prisma.assetReceiptLine.findUnique({
    where: { id: receiptLineId },
    include: {
      assetReceipt: { select: { basis: true } },
      goodsItem: { select: { title: true, accountingGroupId: true, goodsGroupId: true } },
      purchaseInvoiceLine: { select: { id: true, purchaseInvoice: { select: { id: true, date: true, purchaseTypeId: true, purchaseType: { select: { title: true } }, party: { select: { detailCode: true } } } } } },
      sourceInventoryLine: { include: { document: true } },
    },
  });
  if (!rl) return { ok: false, reason: "ردیف رسید دارایی یافت نشد" };
  const item = rl.goodsItem;
  const titles = new Map((await prisma.detailType.findMany({ select: { id: true, title: true } })).map((t) => [t.id, t.title]));

  if (rl.assetReceipt.basis === "WAREHOUSE_ISSUE") {
    const line = rl.sourceInventoryLine;
    if (!line) return { ok: false, reason: "ردیف حواله‌ی مبنا یافت نشد" };
    const doc = line.document;
    const setting = await findEffectiveSetting({ accountType: "WAREHOUSE_ISSUE_DEBIT", accountingGroupId: item.accountingGroupId, warehouseDocType: doc.documentType }, doc.date);
    if (!setting) return { ok: false, reason: `برای کالای «${item.title}»، حساب «بدهکار حواله انبار» (حواله دارایی ثابت) در حسابداری کالا و خدمت تعریف نشده است` };
    const baseTypeId = doc.detailCode ? await resolveDetailTypeId(doc.detailCode) : null;
    let fields: { detail1Code?: string; detail2Code?: string; detail3Code?: string } = resolveAccountDetailFields(setting.account, baseTypeId, doc.detailCode ?? null);
    const rules = await DetailRuleIndex.load([setting.id]);
    const picked = rules.pick(setting.id, doc.date, { warehouseId: doc.warehouseId ?? null, goodsGroupId: item.goodsGroupId, partyCode: null });
    if (picked) {
      const extra = await prisma.inventoryDocumentDetail.findMany({ where: { documentId: doc.id } });
      const header = new Map<number, string>();
      const own = new Map<number, string>();
      for (const x of extra) (x.lineId == null ? header : x.lineId === line.id ? own : new Map()).set(x.detailTypeId, x.detailCode);
      const applied = applyRule(picked.row, setting.account, { baseCode: doc.detailCode ?? null, baseTypeId, lineValues: own, headerValues: header }, titles);
      if (applied.errors.length) return { ok: false, reason: applied.errors[0] };
      fields = { ...fields, ...applied.fields };
    }
    return { ok: true, value: { settingId: setting.id, accountId: setting.accountId, d1: fields.detail1Code ?? null, d2: fields.detail2Code ?? null, d3: fields.detail3Code ?? null } };
  }

  const pil = rl.purchaseInvoiceLine;
  if (!pil) return { ok: false, reason: "این ردیف رسید هنوز در فاکتور خرید قیمت‌گذاری نشده است" };
  const inv = pil.purchaseInvoice;
  const setting = await findEffectiveSetting({ accountType: "PURCHASE_CONTROL", accountingGroupId: item.accountingGroupId, purchaseTypeId: inv.purchaseTypeId }, inv.date);
  if (!setting) return { ok: false, reason: `برای کالای «${item.title}» و نوع خرید «${inv.purchaseType.title}»، حساب «کنترل خرید» در حسابداری کالا و خدمت تعریف نشده است` };
  const partyCode = inv.party.detailCode;
  const baseTypeId = await resolveDetailTypeId(partyCode);
  let fields: { detail1Code?: string; detail2Code?: string; detail3Code?: string } = resolveAccountDetailFields(setting.account, baseTypeId, partyCode);
  const rules = await DetailRuleIndex.load([setting.id]);
  const picked = rules.pick(setting.id, inv.date, { warehouseId: null, goodsGroupId: item.goodsGroupId, partyCode });
  if (picked) {
    const extra = await loadDocumentDetails(inv.id, "PURCHASE_INVOICE");
    const applied = applyRule(
      picked.row,
      setting.account,
      {
        baseCode: partyCode,
        baseTypeId,
        lineValues: new Map((extra.byLine.get(pil.id) ?? []).map((d) => [d.detailTypeId, d.detailCode])),
        headerValues: new Map(extra.header.map((d) => [d.detailTypeId, d.detailCode])),
      },
      titles
    );
    if (applied.errors.length) return { ok: false, reason: applied.errors[0] };
    fields = { ...fields, ...applied.fields };
  }
  return { ok: true, value: { settingId: setting.id, accountId: setting.accountId, d1: fields.detail1Code ?? null, d2: fields.detail2Code ?? null, d3: fields.detail3Code ?? null } };
}
