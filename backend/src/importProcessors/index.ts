import { prisma } from "../lib/prisma";
import { registerImportEntity } from "../services/importJobService";
import { resolveDetailCode, registerDetailCode, nextSerialNumber } from "../utils/coding";
import { computeFullAccountCode, buildAccountByIdMap } from "../utils/accountCode";
import { issueJournalEntry, IssueLineInput } from "../services/journalEntryService";
import { resolveDateString } from "../utils/jalaliDate";
import { toEnglishDigits } from "../utils/digits";
import { KIND_FA, computePrefixes, resolveSerial, AttrSelection } from "../routes/goodsItems";
import { createInitialInventory, updateInitialInventoryAccounting } from "../routes/initialInventory";
import { createProductionReceipt } from "../routes/productionReceipts";
import { createWarehouseReceipt } from "../routes/warehouseReceipts";
import { createProductionConsumption } from "../routes/productionConsumptions";
import { createSalesDelivery } from "../routes/salesDeliveries";
import { createCenterConsumption } from "../routes/centerConsumptions";
import { createWarehouseAdjustment } from "../routes/warehouseAdjustments";
import { createInventoryCountingShortage } from "../routes/inventoryCountingShortages";

const DETAIL_TYPE_PARTY = 1;
const DETAIL_TYPE_COST_CENTER = 2;
const DETAIL_TYPE_CASHBOX = 3;
const DETAIL_TYPE_BANK_ACCOUNT = 4;

const NATURE_GROUP_FA_REVERSE: Record<string, string> = { "ترازنامه‌ای": "BALANCE_SHEET", "سود و زیانی": "PROFIT_LOSS", "انتظامی": "MEMORANDUM" };
const NATURE_DETAIL_FA_REVERSE: Record<string, string> = { "دارایی": "ASSET", "بدهی": "LIABILITY", "درآمد": "REVENUE", "هزینه": "EXPENSE", "انتظامی": "MEMORANDUM" };
const BALANCE_NATURE_FA_REVERSE: Record<string, string> = { "بدهکار": "DEBIT", "بستانکار": "CREDIT" };
const LEGAL_TYPE_FA_REVERSE: Record<string, string> = { "حقوقی": "LEGAL", "مشارکت خاص": "SPECIAL_PARTNERSHIP", "بانک/موسسه مالی": "BANK" };
const COST_CENTER_TYPE_FA_REVERSE: Record<string, string> = { "عملیاتی/تولیدی": "OPERATIONAL", "پشتیبانی": "SUPPORT", "خدماتی": "SERVICE", "اداری و تشکیلاتی": "ADMIN" };
const TRACKING_METHOD_FA_REVERSE: Record<string, string> = { "بدون ردیابی": "NONE", "بچ": "BATCH", "سریال": "SERIAL" };
const GOODS_TYPE_FA_REVERSE: Record<string, string> = {
  "مواد اولیه": "RAW_MATERIAL",
  "نیمه‌ساخته": "SEMI_FINISHED",
  "محصول": "PRODUCT",
  "ملزومات و لوازم": "SUPPLIES",
  "خدمت": "SERVICE",
  "کالای کارمزدی": "CONTRACT_GOODS",
  "ضایعات": "SCRAP",
  "دارایی ثابت": "FIXED_ASSET",
  "کالای تجاری": "TRADE_GOODS",
};

// وقتی یک کالای سریال‌دار مثلاً ۱۰۰۰ سریال دارد، هر سریال یک ردیف اکسل جداست (نمی‌شود ۱۰۰۰ سریال را در
// یک سلول نوشت)، اما تبدیل بی‌قید‌وشرط هر ردیف به یک سطر سند جداگانه یعنی سند نهایی ۱۰۰۰ سطر می‌شود —
// روی گرید/محاسبه‌ی موجودی/اسنپ‌شات تایید انبار و... کند است. این تابع ردیف‌های خام (هرکدام حداکثر یک
// بچ/سریال) را بر اساس (کالا+واحد+محل‌فیزیکی) با هم ادغام می‌کند: مقدار جمع می‌شود، سریال‌ها/بچ‌ها روی
// همان یک سطر تجمیع می‌شوند (بچ‌های تکراری هم جمع می‌شوند، چون InventoryLineBatch یکتای lineId+batchId
// است)، و چون یک سطر فقط یک «فی» دارد، فی نهایی میانگین موزون (بر مبنای مقدار) ردیف‌های همان گروه است —
// نه انتخاب یکی و نه رد کردن ستون فی، چون میانگین موزون همان مقدار ریاضی درستی است که با ادغام از دست
// نمی‌رود. محل‌فیزیکی و واحد عمداً بخشی از کلید گروه‌بندی‌اند (نه فقط کالا) چون یک سطر فقط یک مقدار برای
// هرکدام دارد و ادغام مقادیر متفاوتِ این دو، برخلاف فی، از نظر معنایی نادرست است (نمی‌شود «میانگین» دو
// محل فیزیکی گرفت).
function mergeLinesByItem(rawLines: any[]): any[] {
  const groups = new Map<string, any[]>();
  const order: string[] = [];
  for (const line of rawLines) {
    const key = `${line.goodsItemId}__${line.unitId}__${line.physicalLocation || ""}`;
    if (!groups.has(key)) {
      groups.set(key, []);
      order.push(key);
    }
    groups.get(key)!.push(line);
  }
  return order.map((key) => {
    const rows = groups.get(key)!;
    const first = rows[0];
    const quantity = rows.reduce((s, r) => s + r.quantity, 0);
    const costWeightSum = rows.reduce((s, r) => s + r.quantity * r.unitCost, 0);
    const unitCost = quantity > 0 ? costWeightSum / quantity : 0;
    const serialIds = rows.flatMap((r) => r.serialIds as number[]);
    const batchQuantityByBatchId = new Map<number, number>();
    for (const r of rows) {
      for (const a of r.batchAllocations as { batchId: number; quantity: number }[]) {
        batchQuantityByBatchId.set(a.batchId, (batchQuantityByBatchId.get(a.batchId) || 0) + a.quantity);
      }
    }
    return {
      goodsItemId: first.goodsItemId,
      unitId: first.unitId,
      quantity,
      unitCost,
      description: rows.find((r) => r.description)?.description ?? null,
      serialIds,
      batchAllocations: Array.from(batchQuantityByBatchId.entries()).map(([batchId, batchQuantity]) => ({ batchId, quantity: batchQuantity })),
      physicalLocation: first.physicalLocation,
    };
  });
}

// «موجودی اول دوره» و «رسید تولید» ساختار ردیف اکسل یکسانی دارند (کد انبار/تاریخ/شرح در سطح سند —
// تکرارشده روی هر ردیف، دقیقاً هم‌الگوی groupByKey ترکیبی «حساب+تاریخ» در journal-entry — به‌علاوه
// کد کالا/واحد/مقدار/فی/بچ/سریال/تاریخ‌انقضا/محل‌فیزیکی در سطح ردیف)، پس یک تابع مشترک هر دو گروه را
// به بدنه‌ی قابل‌قبول createInitialInventory/createProductionReceipt تبدیل می‌کند.
// groupByItem فعلاً فقط برای «موجودی اول دوره» روشن است (طبق تصمیم صریح کاربر: اول همین‌جا تایید شود،
// بعد به «رسید تولید» و بقیه هم تعمیم داده می‌شود) — تا آن زمان رسید تولید با رفتار قبلی (هر ردیف اکسل =
// یک سطر سند) دست‌نخورده می‌ماند.
// موقت — مهاجرت داده‌ی «موجودی اول دوره» از سیستم قبلی: چون کد کالا در سیستم جدید عوض شده، اکسل خروجی
// سیستم قبلی دیگر با fullCode فعلی مطابقت ندارد. ستون «کد کالا (سیستم قدیم)» به‌جای «کد کالا» پر می‌شود
// و روی technicalSpec (که موقتاً با کد قدیم پر شده) جستجو می‌شود، نه fullCode. دقیقاً یکی از این دو ستون
// باید پر باشد تا ابهامی نباشد (اگر هر دو خالی/پر باشند خطا می‌دهیم) — چون بعد از تغییر کلی کدها، ممکن
// است کد قدیمِ یک کالا با fullCode فعلیِ یک کالای کاملاً متفاوت یکی باشد؛ جستجوی کورکورانه (اول fullCode
// بعد technicalSpec) می‌توانست بی‌سروصدا کالای اشتباه را برگرداند.
async function resolveGoodsItemByCode(row: Record<string, string>, idx: number): Promise<{ item: any } | { error: string }> {
  const newCode = toEnglishDigits(row.goodsItemCode || "").trim();
  const oldCode = toEnglishDigits(row.goodsItemOldCode || "").trim();
  if (newCode && oldCode) return { error: `ردیف ${idx + 1}: فقط یکی از «کد کالا» یا «کد کالا (سیستم قدیم)» باید پر باشد` };
  if (!newCode && !oldCode) return { error: `ردیف ${idx + 1}: «کد کالا» یا «کد کالا (سیستم قدیم)» باید پر باشد` };
  const item = newCode
    ? await prisma.goodsItem.findFirst({ where: { fullCode: newCode } })
    : await prisma.goodsItem.findFirst({ where: { technicalSpec: oldCode } });
  if (!item) return { error: `ردیف ${idx + 1}: کالا با کد «${newCode || oldCode}» یافت نشد` };
  return { item };
}

async function resolveWarehouseDocGroup(
  groupRows: Record<string, string>[],
  opts: { groupByItem?: boolean; requireParty?: boolean; requireCostCenter?: boolean; requireNumber?: boolean } = {}
): Promise<
  | {
      warehouseId: number;
      date: string;
      description?: string;
      partyId?: number;
      costCenterId?: number;
      /** detailCode طرف مقابل/مرکز هزینه (هرکدام که resolve شده) — برای isDuplicateInventoryDocGroup، بدون نیاز به fetch دوباره */
      detailCode?: string;
      number?: number;
      lines: any[];
    }
  | { error: string }
> {
  const first = groupRows[0];
  const warehouseCode = toEnglishDigits(first.warehouseCode || "").trim();
  const warehouse = await prisma.warehouse.findFirst({ where: { code: Number(warehouseCode) } });
  if (!warehouse) return { error: `انبار با کد «${first.warehouseCode}» یافت نشد` };

  // فقط برای «رسید انبار خرید» و «رسید تولید» — طبق تصمیم صریح کاربر، هنگام مهاجرت از سیستم قبلی، شماره
  // سند نباید خودکار بازتولید شود؛ همان مقدار ستون «شماره سند» عیناً حفظ می‌شود (نگاه کنید به
  // createWarehouseReceipt/createProductionReceipt برای بررسی تکراری‌نبودنش). چون همین شماره برای
  // گروه‌بندی ردیف‌ها هم استفاده می‌شود (groupByKey)، اگر این ستون در یک ردیف خالی بماند، «required:true»
  // در قالب اکسل فقط وجود خودِ ستون را چک می‌کند نه خالی‌نبودن هر سلول — پس بدون این بررسی صریح، چند
  // ردیف با شماره‌ی خالی که تصادفاً انبار+تاریخ یکسان دارند، اشتباهاً زیر یک سند ادغام می‌شدند. برای
  // initial-inventory/production-receiptِ قدیمی (که requireNumber نمی‌فرستند) این فیلد اصلاً خوانده
  // نمی‌شود، پس بی‌تاثیر می‌ماند.
  const rawNumber = toEnglishDigits(first.number || "").trim();
  if (opts.requireNumber && !rawNumber) return { error: "شماره سند الزامی است" };
  const number = rawNumber ? Number(rawNumber) : undefined;

  // فقط برای «رسید انبار خرید» — طرف مقابل (خودِ Import عمداً فقط بدون‌مبنا را پوشش می‌دهد، طبق تصمیم
  // صریح کاربر، نه رسیدهای متصل به سفارش‌خرید/مجوزتحویل/درخواست‌تامین، که هر ردیفشان باید به یک سطر
  // مبنای مشخص و باقیمانده‌ی آن گره بخورد — کاری که در قالب اکسل به‌سختی و مستعد خطا قابل انجام است).
  let partyId: number | undefined;
  let detailCode: string | undefined;
  if (opts.requireParty) {
    const partyDetailCode = toEnglishDigits(first.partyDetailCode || "").trim();
    if (!partyDetailCode) return { error: "کد تفصیل طرف مقابل الزامی است" };
    const party = await prisma.party.findFirst({ where: { detailCode: partyDetailCode } });
    if (!party) return { error: `طرف مقابل با کد تفصیل «${first.partyDetailCode}» یافت نشد` };
    partyId = party.id;
    detailCode = party.detailCode;
  }

  // فقط برای «مصرف تولید» — مرکز هزینه (دقیقاً هم‌الگوی طرف مقابل در «رسید انبار خرید»)
  let costCenterId: number | undefined;
  if (opts.requireCostCenter) {
    const costCenterDetailCode = toEnglishDigits(first.costCenterDetailCode || "").trim();
    if (!costCenterDetailCode) return { error: "کد تفصیل مرکز هزینه الزامی است" };
    const costCenter = await prisma.costCenter.findFirst({ where: { detailCode: costCenterDetailCode } });
    if (!costCenter) return { error: `مرکز هزینه با کد تفصیل «${first.costCenterDetailCode}» یافت نشد` };
    costCenterId = costCenter.id;
    detailCode = costCenter.detailCode;
  }

  const lines: any[] = [];
  for (const [idx, row] of groupRows.entries()) {
    const resolvedItem = await resolveGoodsItemByCode(row, idx);
    if ("error" in resolvedItem) return { error: resolvedItem.error };
    const item = resolvedItem.item;

    let unitId = item.mainUnitId;
    if (row.unitTitle && row.unitTitle.trim()) {
      const unit = await prisma.unitOfMeasure.findFirst({ where: { title: row.unitTitle.trim() } });
      if (!unit) return { error: `ردیف ${idx + 1}: واحد سنجش «${row.unitTitle}» یافت نشد` };
      unitId = unit.id;
    }

    // برخلاف قبل، بچ/سریال دیگر با متن ردیف find-or-create نمی‌شوند (طبق «اصلاح مدل رهگیری کالا»)؛
    // چون نمی‌شود شناسه‌ی خام دیتابیس را در اکسل تایپ کرد، اینجا فقط با (کالا، شماره) در Master
    // از‌قبل‌موجود جستجو می‌شود و اگر نبود خطا می‌دهد.
    let batchId: number | null = null;
    if (row.batchNumber && row.batchNumber.trim()) {
      const batch = await prisma.batch.findUnique({ where: { goodsItemId_batchNumber: { goodsItemId: item.id, batchNumber: row.batchNumber.trim() } } });
      if (!batch) return { error: `ردیف ${idx + 1}: بچ «${row.batchNumber}» برای این کالا یافت نشد` };
      batchId = batch.id;
    }
    let serialId: number | null = null;
    if (row.serialNumber && row.serialNumber.trim()) {
      const serial = await prisma.serial.findUnique({ where: { goodsItemId_serialNumber: { goodsItemId: item.id, serialNumber: row.serialNumber.trim() } } });
      if (!serial) return { error: `ردیف ${idx + 1}: سریال «${row.serialNumber}» برای این کالا یافت نشد` };
      serialId = serial.id;
    }

    const quantity = Number(toEnglishDigits(row.quantity || "")) || 0;
    // «رسید تولید» هنوز ستون «فی» مستقیم دارد (پابرجا برای سازگاری با قبل)؛ اما «موجودی اول دوره» طبق
    // تصمیم کاربر دیگر ستون فی ندارد و به‌جایش (وقتی ستون مبلغ در قالب باشد) مبلغ می‌گیرد و فی را از
    // مبلغ÷مقدار می‌سازد — دقیقاً هم‌الگوی initial-inventory-cost. اگر مبلغ ستون این ردیف خالی/غایب
    // باشد (قالب اصلی انبارداری، بدون ستون مبلغ)، به فی مستقیم (اگر بود) برمی‌گردد.
    const rowAmount = row.amount ? Number(toEnglishDigits(row.amount)) : null;
    const unitCost = rowAmount != null && quantity > 0 ? rowAmount / quantity : Number(toEnglishDigits(row.unitCost || "")) || 0;
    lines.push({
      goodsItemId: item.id,
      unitId,
      quantity,
      unitCost,
      description: row.lineDescription || null,
      serialIds: serialId ? [serialId] : [],
      batchAllocations: batchId ? [{ batchId, quantity }] : [],
      physicalLocation: row.physicalLocation || null,
    });
  }

  return {
    warehouseId: warehouse.id,
    date: resolveDateString(first.date),
    description: first.description || undefined,
    partyId,
    costCenterId,
    detailCode,
    number,
    lines: opts.groupByItem ? mergeLinesByItem(lines) : lines,
  };
}

export function registerAllImportProcessors() {
  registerImportEntity("party", {
    row: async (row, ctx) => {
      try {
        const category = row.category === "LEGAL" ? "LEGAL" : "INDIVIDUAL";
        const nationality = row.nationality === "خارجی" ? "FOREIGN" : "LOCAL";
        const data: any = { category, nationality };
        if (category === "INDIVIDUAL") {
          if (!row.firstName || !row.lastName) return { ok: false, error: "نام و نام خانوادگی الزامی است" };
          data.firstName = row.firstName;
          data.lastName = row.lastName;
          data.nationalId = row.nationalId || null;
        } else {
          if (!row.name) return { ok: false, error: "نام الزامی است" };
          data.name = row.name;
          data.legalType = LEGAL_TYPE_FA_REVERSE[row.legalType] || "LEGAL";
          data.nationalId = row.nationalId || null;
          data.economicCode = row.economicCode || null;
        }

        if (!ctx.allowDuplicates) {
          const dup = await prisma.party.findFirst({
            where: category === "INDIVIDUAL" ? { firstName: data.firstName, lastName: data.lastName } : { name: data.name },
          });
          if (dup) return { ok: false, error: "طرف‌حساب مشابه (هم‌نام) از قبل موجود است" };
        }

        const { code, detailTypeId } = await resolveDetailCode(DETAIL_TYPE_PARTY, row.detailCode);
        const party = await prisma.party.create({ data: { ...data, detailCode: code } });
        await registerDetailCode(code, detailTypeId, "Party", party.id);
        return { ok: true };
      } catch (e: any) {
        if (e.code === "P2002") return { ok: false, error: "یکی از فیلدهای یکتا (کد ملی/شناسه ملی/کد اقتصادی/کد تفصیل) تکراری است" };
        return { ok: false, error: e.message || "خطا در ثبت طرف‌حساب" };
      }
    },
  });

  registerImportEntity("cash-box", {
    row: async (row) => {
      try {
        if (!row.title) return { ok: false, error: "عنوان الزامی است" };
        const dup = await prisma.cashBox.findUnique({ where: { title: row.title } });
        if (dup) return { ok: false, error: "عنوان تکراری است" };
        const { code, detailTypeId } = await resolveDetailCode(DETAIL_TYPE_CASHBOX, row.detailCode);
        const cashBox = await prisma.cashBox.create({ data: { detailCode: code, title: row.title } });
        await registerDetailCode(code, detailTypeId, "CashBox", cashBox.id);
        return { ok: true };
      } catch (e: any) {
        return { ok: false, error: e.message || "خطا در ثبت صندوق" };
      }
    },
  });

  registerImportEntity("bank-branch", {
    row: async (row) => {
      try {
        if (!row.partyDetailCode) return { ok: false, error: "کد تفصیل بانک الزامی است" };
        if (!row.title) return { ok: false, error: "عنوان الزامی است" };

        const bankParty = await prisma.party.findFirst({ where: { detailCode: row.partyDetailCode.trim() } });
        if (!bankParty) return { ok: false, error: `طرف‌حساب با کد تفصیل «${row.partyDetailCode}» یافت نشد` };
        if (bankParty.legalType !== "BANK") return { ok: false, error: "طرف‌حساب انتخاب‌شده از نوع بانک/موسسه مالی نیست" };

        const dupTitle = await prisma.bankBranch.findUnique({ where: { title: row.title } });
        if (dupTitle) return { ok: false, error: "عنوان تکراری است" };

        let finalCode = row.code ? Number(row.code) : undefined;
        if (!finalCode) {
          const last = await prisma.bankBranch.findFirst({ where: { bankPartyId: bankParty.id }, orderBy: { code: "desc" } });
          finalCode = last ? last.code + 1 : 1;
        }
        const dupCode = await prisma.bankBranch.findFirst({ where: { bankPartyId: bankParty.id, code: finalCode } });
        if (dupCode) return { ok: false, error: "کد در سطح این بانک تکراری است" };

        await prisma.bankBranch.create({ data: { code: finalCode, title: row.title, bankPartyId: bankParty.id } });
        return { ok: true };
      } catch (e: any) {
        return { ok: false, error: e.message || "خطا در ثبت شعبه بانک" };
      }
    },
  });

  registerImportEntity("bank-account", {
    row: async (row) => {
      try {
        if (!row.accountTypeTitle || !row.branchTitle || !row.accountNumber) {
          return { ok: false, error: "نوع حساب، شعبه بانک و شماره حساب الزامی است" };
        }

        const accountType = await prisma.bankAccountType.findFirst({ where: { title: row.accountTypeTitle.trim() } });
        if (!accountType) return { ok: false, error: `نوع حساب بانکی «${row.accountTypeTitle}» یافت نشد` };

        const branch = await prisma.bankBranch.findFirst({ where: { title: row.branchTitle.trim() } });
        if (!branch) return { ok: false, error: `شعبه بانک «${row.branchTitle}» یافت نشد` };

        const dup = await prisma.bankAccount.findFirst({ where: { bankPartyId: branch.bankPartyId, accountNumber: row.accountNumber.trim() } });
        if (dup) return { ok: false, error: "شماره حساب در سطح این بانک تکراری است" };

        let currencyId: number | undefined;
        if (row.currencyCode) {
          const currency = await prisma.currency.findFirst({ where: { code: row.currencyCode.trim() } });
          if (!currency) return { ok: false, error: `ارز «${row.currencyCode}» یافت نشد` };
          currencyId = currency.id;
        } else {
          const base = await prisma.currency.findFirst({ where: { isBase: true } });
          currencyId = base?.id;
        }

        // برخلاف فرم دستی «حساب بانکی جدید» (که کد تفصیل همیشه خودکار است)، ورود اکسل امکان تعیین
        // صریح کد تفصیل را هم می‌دهد — برای مهاجرت داده از سیستم قبلی که کدهای از پیش موجود دارد.
        const { code, detailTypeId } = await resolveDetailCode(DETAIL_TYPE_BANK_ACCOUNT, row.detailCode);
        const created = await prisma.bankAccount.create({
          data: {
            detailCode: code,
            accountTypeId: accountType.id,
            bankBranchId: branch.id,
            accountNumber: row.accountNumber.trim(),
            currencyId,
            bankPartyId: branch.bankPartyId,
          },
        });
        await registerDetailCode(code, detailTypeId, "BankAccount", created.id);
        return { ok: true };
      } catch (e: any) {
        return { ok: false, error: e.message || "خطا در ثبت حساب بانکی" };
      }
    },
  });

  registerImportEntity("org-unit", {
    row: async (row) => {
      try {
        if (!row.title || !row.orgStructureTitle) return { ok: false, error: "عنوان و شاخه ساختار سازمانی الزامی است" };
        const nodes = await prisma.orgStructure.findMany();
        const parentIds = new Set(nodes.map((n: any) => n.parentId).filter(Boolean));
        const leaf = nodes.find((n: any) => n.title === row.orgStructureTitle && !parentIds.has(n.id));
        if (!leaf) return { ok: false, error: `شاخه ساختار سازمانی «${row.orgStructureTitle}» (به‌عنوان آخرین شاخه) یافت نشد` };
        const dup = await prisma.orgUnit.findUnique({ where: { title: row.title } });
        if (dup) return { ok: false, error: "عنوان تکراری است" };
        const finalCode = row.code ? Number(row.code) : await nextSerialNumber(prisma.orgUnit as any, "code");
        await prisma.orgUnit.create({ data: { code: finalCode, title: row.title, orgStructureId: leaf.id } });
        return { ok: true };
      } catch (e: any) {
        if (e.code === "P2002") return { ok: false, error: "کد یا عنوان تکراری است" };
        return { ok: false, error: e.message || "خطا در ثبت واحد سازمانی" };
      }
    },
  });

  registerImportEntity("cost-center", {
    row: async (row) => {
      try {
        if (!row.title || !row.orgUnitTitle) return { ok: false, error: "عنوان و واحد سازمانی الزامی است" };
        const type = COST_CENTER_TYPE_FA_REVERSE[row.type];
        if (!type) return { ok: false, error: `نوع «${row.type}» نامعتبر است` };
        const orgUnit = await prisma.orgUnit.findFirst({ where: { title: row.orgUnitTitle } });
        if (!orgUnit) return { ok: false, error: `واحد سازمانی «${row.orgUnitTitle}» یافت نشد` };
        const dup = await prisma.costCenter.findUnique({ where: { title: row.title } });
        if (dup) return { ok: false, error: "عنوان تکراری است" };
        const { code, detailTypeId } = await resolveDetailCode(DETAIL_TYPE_COST_CENTER, row.detailCode);
        const created = await prisma.costCenter.create({
          data: { detailCode: code, title: row.title, type: type as any, orgUnitId: orgUnit.id },
        });
        await registerDetailCode(code, detailTypeId, "CostCenter", created.id);
        return { ok: true };
      } catch (e: any) {
        return { ok: false, error: e.message || "خطا در ثبت مرکز هزینه" };
      }
    },
  });

  registerImportEntity("accounting-group", {
    row: async (row) => {
      try {
        if (!row.title || !row.goodsType) return { ok: false, error: "عنوان و نوع کالا الزامی است" };
        const goodsType = GOODS_TYPE_FA_REVERSE[row.goodsType];
        if (!goodsType) return { ok: false, error: `نوع کالا «${row.goodsType}» نامعتبر است` };

        const dupTitle = await prisma.accountingGroup.findUnique({ where: { title: row.title } });
        if (dupTitle) return { ok: false, error: "عنوان تکراری است" };

        const finalCode = row.code ? Number(row.code) : await nextSerialNumber(prisma.accountingGroup, "code");
        const dupCode = await prisma.accountingGroup.findUnique({ where: { code: finalCode } });
        if (dupCode) return { ok: false, error: "کد تکراری است" };

        await prisma.accountingGroup.create({
          data: { code: finalCode, title: row.title, goodsType: goodsType as any, isActive: row.isActive !== "خیر" },
        });
        return { ok: true };
      } catch (e: any) {
        if (e.code === "P2002") return { ok: false, error: "کد یا عنوان تکراری است" };
        return { ok: false, error: e.message || "خطا در ثبت گروه حسابداری" };
      }
    },
  });

  registerImportEntity("unit-of-measure", {
    row: async (row) => {
      try {
        if (!row.title) return { ok: false, error: "عنوان الزامی است" };
        const isWeight = row.isWeight === "بله";
        if (isWeight && !row.kgEquivalent) return { ok: false, error: "برای واحد وزنی، معادل به کیلوگرم الزامی است" };

        const dupTitle = await prisma.unitOfMeasure.findUnique({ where: { title: row.title } });
        if (dupTitle) return { ok: false, error: "عنوان تکراری است" };

        const finalCode = row.code ? Number(row.code) : await nextSerialNumber(prisma.unitOfMeasure, "code");
        const dupCode = await prisma.unitOfMeasure.findUnique({ where: { code: finalCode } });
        if (dupCode) return { ok: false, error: "کد تکراری است" };

        await prisma.unitOfMeasure.create({
          data: { code: finalCode, title: row.title, isWeight, kgEquivalent: isWeight ? Number(row.kgEquivalent) : null },
        });
        return { ok: true };
      } catch (e: any) {
        if (e.code === "P2002") return { ok: false, error: "کد یا عنوان تکراری است" };
        return { ok: false, error: e.message || "خطا در ثبت واحد سنجش" };
      }
    },
  });

  registerImportEntity("warehouse", {
    row: async (row) => {
      try {
        if (!row.title || !row.warehouseGroupTitle) return { ok: false, error: "عنوان و گروه انبار الزامی است" };

        const group = await prisma.warehouseGroup.findFirst({ where: { title: row.warehouseGroupTitle } });
        if (!group) return { ok: false, error: `گروه انبار «${row.warehouseGroupTitle}» یافت نشد` };

        const dupTitle = await prisma.warehouse.findUnique({ where: { title: row.title } });
        if (dupTitle) return { ok: false, error: "عنوان تکراری است" };

        let managerId: number | null = null;
        if (row.managerDetailCode) {
          const manager = await prisma.party.findFirst({ where: { detailCode: toEnglishDigits(row.managerDetailCode).trim() } });
          if (!manager || manager.category !== "INDIVIDUAL" || !manager.isActive) {
            return { ok: false, error: `مسئول انبار با کد تفصیل «${row.managerDetailCode}» یافت نشد یا شخص حقیقی فعال نیست` };
          }
          managerId = manager.id;
        }

        const finalCode = row.code ? Number(toEnglishDigits(row.code)) : await nextSerialNumber(prisma.warehouse, "code");
        const dupCode = await prisma.warehouse.findUnique({ where: { code: finalCode } });
        if (dupCode) return { ok: false, error: "کد تکراری است" };

        await prisma.warehouse.create({
          data: {
            code: finalCode,
            title: row.title,
            warehouseGroupId: group.id,
            address: row.address?.trim() || null,
            phone: row.phone?.trim() || null,
            managerId,
            stockControl: row.stockControl !== "خیر",
            isActive: row.isActive !== "خیر",
          },
        });
        return { ok: true };
      } catch (e: any) {
        if (e.code === "P2002") return { ok: false, error: "کد یا عنوان تکراری است" };
        return { ok: false, error: e.message || "خطا در ثبت انبار" };
      }
    },
  });

  registerImportEntity("currency", {
    row: async (row) => {
      try {
        if (!row.code || !row.title) return { ok: false, error: "کد و عنوان الزامی است" };
        const dup = await prisma.currency.findFirst({ where: { OR: [{ code: row.code }, { title: row.title }] } });
        if (dup) return { ok: false, error: "کد یا عنوان تکراری است" };
        await prisma.currency.create({
          data: {
            code: row.code,
            title: row.title,
            decimalPlaces: row.decimalPlaces ? Number(row.decimalPlaces) : 2,
            isBase: false,
            rateDirection: "TO_BASE",
            baseVolume: 1,
          },
        });
        return { ok: true };
      } catch (e: any) {
        return { ok: false, error: e.message || "خطا در ثبت ارز" };
      }
    },
  });

  registerImportEntity("account", {
    row: async (row) => {
      try {
        if (!row.code || !row.title) return { ok: false, error: "کد و عنوان الزامی است" };
        const code = toEnglishDigits(row.code).trim();

        let parentId: number | null = null;
        let level;
        if (row.parentFullCode) {
          const parentFullCode = toEnglishDigits(row.parentFullCode).trim();
          const allAccounts = await prisma.account.findMany({ select: { id: true, code: true, parentId: true } });
          const byId = buildAccountByIdMap(allAccounts as any);
          const parent = allAccounts.find((a: any) => toEnglishDigits(computeFullAccountCode(a.id, byId)) === parentFullCode);
          if (!parent) return { ok: false, error: `حساب والد با کد کامل «${row.parentFullCode}» یافت نشد` };
          parentId = parent.id;
          const parentFull = await prisma.account.findUnique({ where: { id: parentId }, include: { level: true } });
          level = await prisma.reportingLevel.findFirst({ where: { order: parentFull!.level.order + 1 } });
          if (!level) return { ok: false, error: "سطح گزارشگری بعدی تعریف نشده است" };
        } else {
          level = await prisma.reportingLevel.findFirst({ where: { order: 1 } });
          if (!level) return { ok: false, error: "ابتدا سطح گزارشگری (سطح گروه) را تعریف کنید" };
        }

        if (code.length !== level.codeLength) {
          return { ok: false, error: `طول کد باید ${level.codeLength} رقم باشد (سطح ${level.title})` };
        }
        const dup = await prisma.account.findFirst({ where: { parentId, code } });
        if (dup) return { ok: false, error: "کد در این سطح تکراری است" };

        const data: any = { parentId, levelId: level.id, code, title: row.title };
        if (level.order === 1) {
          if (!row.natureGroup) return { ok: false, error: "ماهیت حساب (سطح گروه) الزامی است" };
          data.natureGroup = NATURE_GROUP_FA_REVERSE[row.natureGroup];
        } else if (level.order === 2) {
          if (!row.natureDetail) return { ok: false, error: "ماهیت حساب (سطح کل) الزامی است" };
          data.natureDetail = NATURE_DETAIL_FA_REVERSE[row.natureDetail];
        } else {
          if (!row.balanceNature) return { ok: false, error: "ماهیت مانده الزامی است" };
          data.balanceNature = BALANCE_NATURE_FA_REVERSE[row.balanceNature];
          data.isCurrency = row.isCurrency === "بله";
          data.isRevaluable = row.isRevaluable === "بله";
          if (row.detailType1 || row.detailType2 || row.detailType3) {
            const detailTypes = await prisma.detailType.findMany();
            for (const [col, field] of [
              ["detailType1", "detailType1Id"],
              ["detailType2", "detailType2Id"],
              ["detailType3", "detailType3Id"],
            ] as const) {
              const value = (row as any)[col];
              if (!value) continue;
              const normalizedValue = toEnglishDigits(value).trim();
              const match = detailTypes.find((t: any) => String(t.code) === normalizedValue);
              if (!match) return { ok: false, error: `نوع تفصیل با کد «${value}» یافت نشد` };
              data[field] = match.id;
            }
          }
        }

        await prisma.account.create({ data });
        return { ok: true };
      } catch (e: any) {
        if (e.code === "P2002") return { ok: false, error: "کد در این سطح تکراری است" };
        return { ok: false, error: e.message || "خطا در ثبت حساب" };
      }
    },
  });

  registerImportEntity("goods-item", {
    row: async (row, ctx) => {
      try {
        const kind = row.kind === "SERVICE" ? "SERVICE" : "GOODS";
        const label = KIND_FA[kind];
        if (!row.groupFullCode) return { ok: false, error: `کد کامل گروه ${label} الزامی است` };
        if (!row.title) return { ok: false, error: "عنوان الزامی است" };
        if (!row.mainUnitCode) return { ok: false, error: "کد واحد اصلی الزامی است" };
        if (!row.accountingGroupCode) return { ok: false, error: "کد گروه حساب الزامی است" };

        // پیدا کردن گروه (شاخه‌ی آخر) بر اساس کد کامل — دقیقاً همان کدی که در انتخابگر گروه فرانت‌اند
        // نمایش داده می‌شود (زنجیره‌ی کد همه‌ی سطوح از ریشه تا برگ، نه فقط سطوحی که در کد کالا موثرند).
        const allGroups = await prisma.goodsGroup.findMany();
        const byId = new Map(allGroups.map((g: any) => [g.id, g]));
        function fullGroupCode(g: any): string {
          const parts: string[] = [];
          let cur = g;
          while (cur) {
            parts.unshift(cur.code);
            cur = cur.parentId ? byId.get(cur.parentId) : undefined;
          }
          return parts.join("");
        }
        const normalizedGroupFullCode = toEnglishDigits(row.groupFullCode!).trim();
        const group = allGroups.find((g: any) => g.isLastBranch && toEnglishDigits(fullGroupCode(g)) === normalizedGroupFullCode);
        if (!group) return { ok: false, error: `گروه ${label} با کد کامل «${row.groupFullCode}» (شاخه‌ی آخر) یافت نشد` };

        const mainUnit = await prisma.unitOfMeasure.findFirst({ where: { code: Number(toEnglishDigits(row.mainUnitCode)) } });
        if (!mainUnit) return { ok: false, error: `واحد اصلی با کد «${row.mainUnitCode}» یافت نشد` };

        const accountingGroup = await prisma.accountingGroup.findFirst({ where: { code: Number(toEnglishDigits(row.accountingGroupCode)) } });
        if (!accountingGroup) return { ok: false, error: `گروه حساب با کد «${row.accountingGroupCode}» یافت نشد` };

        // ویژگی‌ها (اختیاری): «عنوان ویژگی=عنوان مقدار» به‌ازای هر ویژگی، جدا شده با «،» — مثلاً «رنگ=قرمز،سایز=بزرگ»
        const attrSelections: AttrSelection[] = [];
        if (row.attributes) {
          const pairs = row.attributes.split(/[،,]/).map((s) => s.trim()).filter(Boolean);
          for (const pair of pairs) {
            const [attrTitle, itemTitle] = pair.split("=").map((s) => s?.trim());
            if (!attrTitle || !itemTitle) {
              return { ok: false, error: `فرمت ویژگی «${pair}» نامعتبر است — باید «عنوان ویژگی=عنوان مقدار» باشد` };
            }
            const attr = await prisma.goodsAttribute.findFirst({ where: { title: attrTitle } });
            if (!attr) return { ok: false, error: `ویژگی «${attrTitle}» یافت نشد` };
            const item = await prisma.goodsAttributeItem.findFirst({ where: { attributeId: attr.id, title: itemTitle } });
            if (!item) return { ok: false, error: `مقدار «${itemTitle}» برای ویژگی «${attrTitle}» یافت نشد` };
            attrSelections.push({ attributeId: attr.id, itemId: item.id });
          }
        }

        let weightUnitId: number | null = null;
        let weightRatio: number | null = null;
        if (kind === "GOODS" && !mainUnit.isWeight && row.weightUnitCode) {
          const weightUnit = await prisma.unitOfMeasure.findFirst({ where: { code: Number(toEnglishDigits(row.weightUnitCode)) } });
          if (!weightUnit) return { ok: false, error: `واحد وزنی با کد «${row.weightUnitCode}» یافت نشد` };
          weightUnitId = weightUnit.id;
          if (!row.weightRatio) return { ok: false, error: "نسبت وزنی الزامی است" };
          weightRatio = Number(toEnglishDigits(row.weightRatio));
        }

        const isSpecial = row.isSpecial === "بله";
        let taxRate: number | null = null;
        if (isSpecial) {
          if (!row.taxRate) return { ok: false, error: "نرخ مالیات الزامی است" };
          taxRate = Number(toEnglishDigits(row.taxRate));
        }

        // «نحوه حسابداری» فقط برای خدمت (خالی = هزینه)؛ کالا همیشه null
        let accountingTreatment: "EXPENSE" | "INVENTORY_COST" | null = null;
        if (kind === "SERVICE") {
          const raw = (row.accountingTreatment || "").trim();
          if (!raw || raw === "هزینه") accountingTreatment = "EXPENSE";
          else if (raw === "بهای موجودی") accountingTreatment = "INVENTORY_COST";
          else return { ok: false, error: "نحوه حسابداری باید «هزینه» یا «بهای موجودی» باشد" };
        }

        const reorderControl = kind === "GOODS" && row.reorderControl === "بله";
        let reorderPoint: number | null = null;
        if (reorderControl) {
          if (!row.reorderPoint) return { ok: false, error: "مقدار نقطه سفارش الزامی است" };
          reorderPoint = Number(toEnglishDigits(row.reorderPoint));
        }

        const { leaf, codePrefix, titlePrefix, resolvedAttrs } = await computePrefixes(group.id, attrSelections);
        const serial = await resolveSerial(group.id, row.code ? toEnglishDigits(row.code) : undefined, leaf.childCodeLength!);
        const fullCode = codePrefix + serial;
        const rawTitle = row.title.trim();
        const fullTitle = titlePrefix ? `${titlePrefix}، ${rawTitle}` : rawTitle;

        await prisma.goodsItem.create({
          data: {
            kind,
            goodsGroupId: group.id,
            code: serial,
            fullCode,
            rawTitle,
            title: fullTitle,
            mainUnitId: mainUnit.id,
            weightUnitId,
            weightRatio,
            technicalSpec: row.technicalSpec?.trim() || null,
            barcode: row.barcode?.trim() || null,
            reorderControl,
            reorderPoint,
            trackingMethod: kind === "GOODS" ? (TRACKING_METHOD_FA_REVERSE[row.trackingMethod] as any) || "NONE" : "NONE",
            isLocationTracked: kind === "GOODS" && row.isLocationTracked === "بله",
            accountingGroupId: accountingGroup.id,
            isSpecial,
            taxRate,
            accountingTreatment,
            isActive: row.isActive !== "خیر",
            attributeValues: { create: resolvedAttrs.map((a: AttrSelection) => ({ attributeId: a.attributeId, itemId: a.itemId })) },
          },
        });
        return { ok: true };
      } catch (e: any) {
        if (e.code === "P2002") return { ok: false, error: "این کد قبلا در همین گروه استفاده شده است" };
        return { ok: false, error: e.message || "خطا در ثبت" };
      }
    },
  });

  registerImportEntity("journal-entry", {
    // کلید گروه‌بندی ترکیبی است: «شماره گروه سند» + «تاریخ» — فقط «شماره گروه سند» کافی نیست، چون
    // کاربر ممکن است یک شماره‌گذاری ساده (۱، ۲، ۳...) را در دسته‌های اکسل مختلف/تاریخ‌های مختلف
    // تکرار کند؛ در آن حالت دو سند واقعاً جدا با شماره گروه یکسان اما تاریخ متفاوت، اشتباهاً به‌عنوان
    // ردیف‌های یک سند چندردیفی با هم ادغام می‌شدند (و تاریخ ردیف‌های بعدی هم نادیده گرفته می‌شد، چون
    // فقط تاریخ اولین ردیف گروه برای کل سند استفاده می‌شود).
    groupByKey: (row) => `${row.documentGroup || ""}__${row.date || ""}`,
    group: async (groupRows) => {
      try {
        const first = groupRows[0];
        const docType = await prisma.documentType.findFirst({ where: { title: first.documentType } });
        if (!docType) return { ok: false, error: `نوع سند «${first.documentType}» یافت نشد` };

        const allAccounts = await prisma.account.findMany({ select: { id: true, code: true, parentId: true } });
        const byId = buildAccountByIdMap(allAccounts as any);
        const currencies = await prisma.currency.findMany();
        const baseCurrency = currencies.find((c: any) => c.isBase);
        if (!baseCurrency) return { ok: false, error: "ارز پایه تعریف نشده است" };

        const lines: IssueLineInput[] = [];
        for (const row of groupRows) {
          const normalizedAccountCode = toEnglishDigits(row.accountCode).trim();
          const account = allAccounts.find((a: any) => toEnglishDigits(computeFullAccountCode(a.id, byId)) === normalizedAccountCode);
          if (!account) return { ok: false, error: `حساب با کد «${row.accountCode}» یافت نشد` };
          const currency = row.currencyCode ? currencies.find((c: any) => c.code === row.currencyCode) : baseCurrency;
          if (!currency) return { ok: false, error: `ارز «${row.currencyCode}» یافت نشد` };
          lines.push({
            accountId: account.id,
            detail1Code: row.detail1Code || null,
            detail2Code: row.detail2Code || null,
            detail3Code: row.detail3Code || null,
            currencyId: currency.id,
            debit: Number(row.debit) || 0,
            credit: Number(row.credit) || 0,
            fxRate: currency.id === baseCurrency.id ? 1 : Number(row.fxRate) || 1,
            description: row.lineDescription || first.description || "-",
          });
        }

        await issueJournalEntry({
          date: new Date(resolveDateString(first.date)),
          documentTypeId: docType.id,
          description: first.description,
          issuingSystem: "ACCOUNTING_EXCEL_IMPORT",
          isManual: true,
          lines,
        });
        return { ok: true };
      } catch (e: any) {
        return { ok: false, error: e.message || "خطا در ثبت سند" };
      }
    },
  });

  registerImportEntity("initial-inventory", {
    // کلید گروه‌بندی «کد انبار + شماره گروه سند + تاریخ» است. توجه: چون هر انبار در هر دوره مالی حداکثر
    // یک سند موجودی اول دوره می‌تواند داشته باشد (نگاه کنید به بررسی «dup» در createInitialInventory)،
    // صرفاً کد انبار+تاریخ همیشه برای گروه‌بندی کافی بوده؛ «شماره گروه سند» فقط برای هم‌الگو بودن با
    // journal-entry و مرجع/کنترل صریح‌تر کاربر روی گروه‌بندی ردیف‌ها اضافه شده، نه برای رفع ابهام گروه‌بندی.
    groupByKey: (row) => `${row.warehouseCode || ""}__${row.documentGroup || ""}__${row.date || ""}`,
    group: async (groupRows) => {
      try {
        const resolved = await resolveWarehouseDocGroup(groupRows, { groupByItem: true });
        if ("error" in resolved) return { ok: false, error: resolved.error };
        await createInitialInventory(resolved as any);
        return { ok: true };
      } catch (e: any) {
        return { ok: false, error: e.message || "خطا در ثبت سند" };
      }
    },
  });

  // «حسابداری انبار»: برخلاف حالت بالا، اینجا سند جدید ساخته نمی‌شود — فقط فی/مبلغ ردیف‌های یک سند
  // «موجودی اول دوره» از قبل موجود (که با کد انبار+تاریخ پیدا می‌شود) به‌روزرسانی می‌شود، دقیقاً با همان
  // منطق فرم دستی حسابداری انبار (updateInitialInventoryAccounting در initialInventory.ts).
  registerImportEntity("initial-inventory-cost", {
    // «شماره گروه سند» این‌جا برای پیدا کردن سند نقشی ندارد (هر انبار در هر دوره مالی حداکثر یک سند
    // موجودی اول دوره دارد، پس کد انبار+تاریخ به‌تنهایی کافی است)، فقط برای هم‌الگو بودن ستون‌های قالب
    // اکسل با «موجودی اول دوره» اضافه شده — تا کاربر بتواند ردیف‌های یک رویداد اصلاح فی را از رویداد بعدی
    // (مثلاً هفته‌ی بعد، هنوز همان انبار/تاریخ) در همان فایل جدا نگه دارد؛ هر گروه میانگین‌موزون خودش را
    // جدا محاسبه می‌کند، پس اگر دو گروه به یک سطر اشاره کنند، گروه پردازش‌شده‌ی بعدی همان last-write است.
    groupByKey: (row) => `${row.warehouseCode || ""}__${row.documentGroup || ""}__${row.date || ""}`,
    group: async (groupRows) => {
      try {
        const first = groupRows[0];
        const warehouseCode = toEnglishDigits(first.warehouseCode || "").trim();
        const warehouse = await prisma.warehouse.findFirst({ where: { code: Number(warehouseCode) } });
        if (!warehouse) return { ok: false, error: `انبار با کد «${first.warehouseCode}» یافت نشد` };

        const date = resolveDateString(first.date);
        const docs = await prisma.inventoryDocument.findMany({
          where: { documentType: "INITIAL_INVENTORY", warehouseId: warehouse.id, date: new Date(date) },
          include: { lines: { include: { serials: true, batches: true } } },
        });
        if (docs.length === 0) return { ok: false, error: "سند موجودی اول دوره‌ای با این کد انبار و تاریخ یافت نشد" };
        if (docs.length > 1) return { ok: false, error: "بیش از یک سند موجودی اول دوره با این کد انبار و تاریخ موجود است؛ امکان تشخیص خودکار سند وجود ندارد" };
        const doc = docs[0];

        // از وقتی «موجودی اول دوره» ردیف‌های اکسل را بر اساس کالا ادغام می‌کند (mergeLinesByItem)، یک
        // سطر سند می‌تواند چند بچ/سریال داشته باشد؛ پس این‌جا هم دیگر با اندیس ۰ (l.batches[0]) تطبیق
        // داده نمی‌شود (فقط اولین بچ/سریال را می‌دید)، بلکه با .some در کل آرایه‌ی بچ‌ها/سریال‌های همان
        // سطر جستجو می‌شود. همچنین چون «فی» ملک کل سطر است نه یک بچ/سریال خاص، وقتی چند ردیف اکسل به یک
        // سطر ادغام‌شده اشاره کنند (چند بچ/سریال از یک سطر)، مبلغ/مقدار آن‌ها تجمیع و در پایان یک فیِ
        // میانگین‌موزون برای کل سطر محاسبه می‌شود — دقیقاً هم‌الگوی mergeLinesByItem، نه last-write-wins.
        const accByLineId = new Map<number, { qty: number; amount: number }>();
        for (const [idx, row] of groupRows.entries()) {
          const resolvedItem = await resolveGoodsItemByCode(row, idx);
          if ("error" in resolvedItem) return { ok: false, error: resolvedItem.error };
          const item = resolvedItem.item;

          // برخلاف resolveWarehouseDocGroup، اینجا نبودِ بچ/سریال متناظر خطا نیست (ردیف ممکن است اصلا
          // بچ/سریال نداشته باشد)؛ فقط اگر خودِ ستون پر شده و بچ/سریالی با آن پیدا نشود خطا می‌دهیم.
          let expectedBatchId: number | null = null;
          if (row.batchNumber && row.batchNumber.trim()) {
            const batch = await prisma.batch.findUnique({ where: { goodsItemId_batchNumber: { goodsItemId: item.id, batchNumber: row.batchNumber.trim() } } });
            if (!batch) return { ok: false, error: `ردیف ${idx + 1}: بچ «${row.batchNumber}» برای این کالا یافت نشد` };
            expectedBatchId = batch.id;
          }
          let expectedSerialId: number | null = null;
          if (row.serialNumber && row.serialNumber.trim()) {
            const serial = await prisma.serial.findUnique({ where: { goodsItemId_serialNumber: { goodsItemId: item.id, serialNumber: row.serialNumber.trim() } } });
            if (!serial) return { ok: false, error: `ردیف ${idx + 1}: سریال «${row.serialNumber}» برای این کالا یافت نشد` };
            expectedSerialId = serial.id;
          }

          const line = doc.lines.find(
            (l: any) =>
              l.goodsItemId === item.id &&
              (expectedBatchId === null || l.batches.some((b: any) => b.batchId === expectedBatchId)) &&
              (expectedSerialId === null || l.serials.some((s: any) => s.serialId === expectedSerialId))
          );
          if (!line) return { ok: false, error: `ردیف ${idx + 1}: ردیفی با این کالا/سریال/بچ در سند یافت نشد` };

          // مقدار مرجع برای اعتبارسنجی/محاسبه، مقدار همان بچ/سریال خاص است (نه کل مقدار سطر ادغام‌شده)؛
          // سریال همیشه مقدار ۱ دارد، بچ مقدار اختصاصی خودش را در همان سطر دارد.
          let allocationQuantity: number;
          if (expectedBatchId !== null) {
            allocationQuantity = Number(line.batches.find((b: any) => b.batchId === expectedBatchId)!.quantity);
          } else if (expectedSerialId !== null) {
            allocationQuantity = 1;
          } else {
            allocationQuantity = Number(line.quantity);
          }

          const enteredQty = row.quantity ? Number(toEnglishDigits(row.quantity)) : null;
          if (enteredQty != null && Math.abs(enteredQty - allocationQuantity) > 1e-9) {
            return { ok: false, error: `ردیف ${idx + 1}: مقدار وارد شده (${row.quantity}) با مقدار این بچ/سریال در سند (${allocationQuantity}) مطابقت ندارد` };
          }

          // ستون «فی» عمداً در این ورودی وجود ندارد (طبق تصمیم کاربر) — دقیقاً مثل فرم دستی «حسابداری
          // انبار» که کاربر فقط مبلغ را وارد می‌کند و فی از تقسیم مبلغ بر مقدار به‌دست می‌آید
          // (recomputeUnitCostFromAmount در InitialInventory.tsx)، نه برعکس.
          const rowAmount = Number(toEnglishDigits(row.amount || "")) || 0;

          const acc = accByLineId.get(line.id) || { qty: 0, amount: 0 };
          acc.qty += allocationQuantity;
          acc.amount += rowAmount;
          accByLineId.set(line.id, acc);
        }

        const updates = Array.from(accByLineId.entries()).map(([id, acc]) => ({
          id,
          unitCost: acc.qty > 0 ? acc.amount / acc.qty : 0,
        }));
        await updateInitialInventoryAccounting(doc.id, updates);
        return { ok: true };
      } catch (e: any) {
        return { ok: false, error: e.message || "خطا در ثبت فی/مبلغ" };
      }
    },
  });

  registerImportEntity("production-receipt", {
    // طبق تصمیم صریح کاربر (هم‌الگوی «رسید انبار خرید»): «شماره سند» هم برای گروه‌بندی ردیف‌ها و هم
    // به‌عنوان شماره‌ی نهایی سند استفاده می‌شود — ستون جدای «شماره گروه» لازم نیست. طبق تصمیم صریح کاربر،
    // این سند هم یک «مرکز هزینه» الزامی دارد (دقیقاً هم‌الگوی «مصرف تولید»).
    groupByKey: (row) => `${row.warehouseCode || ""}__${row.number || ""}__${row.date || ""}`,
    group: async (groupRows, ctx) => {
      try {
        const resolved = await resolveWarehouseDocGroup(groupRows, { requireCostCenter: true, requireNumber: true });
        if ("error" in resolved) return { ok: false, error: resolved.error };
        if (!ctx.allowDuplicates) {
          const isDup = await isDuplicateInventoryDocGroup("PRODUCTION_RECEIPT", resolved.warehouseId, resolved.date, resolved.detailCode, resolved.lines);
          if (isDup) return { ok: false, error: "رسیدی با همین انبار، تاریخ، مرکز هزینه و اقلام از قبل ثبت شده است" };
        }
        await createProductionReceipt(resolved as any);
        return { ok: true };
      } catch (e: any) {
        return { ok: false, error: e.message || "خطا در ثبت سند" };
      }
    },
  });


  // «رسید انبار خرید» — فقط انبارداری (بدون فی/مبلغ، دقیقاً مثل فرم دستی که هرگز این دو را از کاربر
  // نمی‌گیرد) و فقط بدون‌مبنا (طبق تصمیم صریح کاربر؛ رسید‌های متصل به سفارش‌خرید/مجوزتحویل/درخواست‌تامین
  // از این Import پشتیبانی نمی‌شوند، چون هر ردیفشان باید به یک سطر مبنای مشخص گره بخورد).
  registerImportEntity("warehouse-receipt", {
    // طبق تصمیم صریح کاربر: به‌جای دو شماره‌ی جدا («شماره گروه سند» فقط برای گروه‌بندی + «شماره سند»
    // برای شماره‌ی نهایی)، همان «شماره سند» واقعی هم برای گروه‌بندی ردیف‌ها استفاده می‌شود — چون به هر
    // حال باید در دوره مالی یکتا باشد (createWarehouseReceipt این را چک می‌کند)، همین یکتایی برای
    // گروه‌بندی درست هم کافی است.
    groupByKey: (row) => `${row.warehouseCode || ""}__${row.number || ""}__${row.date || ""}`,
    group: async (groupRows, ctx) => {
      try {
        const resolved = await resolveWarehouseDocGroup(groupRows, { requireParty: true, requireNumber: true });
        if ("error" in resolved) return { ok: false, error: resolved.error };
        // برخلاف «موجودی اول دوره» که یک قانون سخت («حداکثر یک سند در هر دوره مالی») این کار را خودکار
        // انجام می‌دهد، رسید انبار خرید ذاتاً می‌تواند چندین‌بار برای یک انبار/تامین‌کننده ثبت شود — پس
        // اجرای دوباره‌ی همان فایل Import (مثلاً چون بار قبل نیمه‌کاره خطا خورده بود) هیچ مانع طبیعی‌ای
        // نداشت و منجر به ثبت دوبرابر می‌شد. طبق همان قرارداد allowDuplicates که در Import «طرف‌حساب»
        // هم استفاده شده: پیش‌فرض، رسیدی با همان انبار/تاریخ/طرف‌مقابل/اقلامِ عیناً یکسان رد می‌شود؛
        // کاربر با تیک «ردیف‌های مشابه هم ثبت شوند» می‌تواند صراحتاً override کند.
        if (!ctx.allowDuplicates) {
          const isDup = await isDuplicateInventoryDocGroup("WAREHOUSE_RECEIPT", resolved.warehouseId, resolved.date, resolved.detailCode, resolved.lines);
          if (isDup) return { ok: false, error: "رسیدی با همین انبار، تاریخ، طرف مقابل و اقلام از قبل ثبت شده است" };
        }
        await createWarehouseReceipt({ ...resolved, partyDetailCode: resolved.detailCode, basis: "NO_BASIS" } as any);
        return { ok: true };
      } catch (e: any) {
        return { ok: false, error: e.message || "خطا در ثبت سند" };
      }
    },
  });

  // «مصرف تولید» — فقط انبارداری (بدون فی/مبلغ) و همیشه بدون‌مبنا (این سند اصلاً مفهوم مبنا ندارد)؛
  // برخلاف «رسید انبار خرید»/«رسید تولید»، این یکی یک «مرکز هزینه» الزامی دارد (طبق تصمیم صریح کاربر
  // برای تخصیص بهای تمام‌شده در فاز بعدی)، دقیقاً هم‌الگوی طرف مقابل در «رسید انبار خرید».
  registerImportEntity("production-consumption", {
    groupByKey: (row) => `${row.warehouseCode || ""}__${row.number || ""}__${row.date || ""}`,
    group: async (groupRows, ctx) => {
      try {
        const resolved = await resolveWarehouseDocGroup(groupRows, { requireCostCenter: true, requireNumber: true });
        if ("error" in resolved) return { ok: false, error: resolved.error };
        if (!ctx.allowDuplicates) {
          const isDup = await isDuplicateInventoryDocGroup("PRODUCTION_CONSUMPTION", resolved.warehouseId, resolved.date, resolved.detailCode, resolved.lines);
          if (isDup) return { ok: false, error: "مصرفی با همین انبار، تاریخ، مرکز هزینه و اقلام از قبل ثبت شده است" };
        }
        await createProductionConsumption(resolved as any);
        return { ok: true };
      } catch (e: any) {
        return { ok: false, error: e.message || "خطا در ثبت سند" };
      }
    },
  });

  // «حواله فروش» (تحویل کالا به مشتری) — فقط انبارداری (بدون فی/مبلغ) و فقط بدون‌مبنا، دقیقاً هم‌الگوی
  // «رسید انبار خرید» (خودِ createSalesDelivery/validateLines طرف مقابل را فقط طرف‌حساب معتبر می‌خواهد؛
  // بحث تخصیص «فقط مشتری» مثل رسید انبار خرید/تامین‌کننده در این سند اصلاً به‌عنوان قید backend وجود
  // ندارد، پس این Import هم چیزی فراتر از فرم دستی تحمیل نمی‌کند).
  registerImportEntity("sales-delivery", {
    groupByKey: (row) => `${row.warehouseCode || ""}__${row.number || ""}__${row.date || ""}`,
    group: async (groupRows, ctx) => {
      try {
        const resolved = await resolveWarehouseDocGroup(groupRows, { requireParty: true, requireNumber: true });
        if ("error" in resolved) return { ok: false, error: resolved.error };
        if (!ctx.allowDuplicates) {
          const isDup = await isDuplicateInventoryDocGroup("SALES_DELIVERY", resolved.warehouseId, resolved.date, resolved.detailCode, resolved.lines);
          if (isDup) return { ok: false, error: "حواله‌ای با همین انبار، تاریخ، طرف مقابل و اقلام از قبل ثبت شده است" };
        }
        await createSalesDelivery({ ...resolved, basis: "NO_BASIS" } as any);
        return { ok: true };
      } catch (e: any) {
        return { ok: false, error: e.message || "خطا در ثبت سند" };
      }
    },
  });

  // «مصرف مرکز هزینه» — فقط انبارداری (بدون فی/مبلغ) و فقط بدون‌مبنا (دقیقاً هم‌الگوی «مصرف تولید»)
  registerImportEntity("center-consumption", {
    groupByKey: (row) => `${row.warehouseCode || ""}__${row.number || ""}__${row.date || ""}`,
    group: async (groupRows, ctx) => {
      try {
        const resolved = await resolveWarehouseDocGroup(groupRows, { requireCostCenter: true, requireNumber: true });
        if ("error" in resolved) return { ok: false, error: resolved.error };
        if (!ctx.allowDuplicates) {
          const isDup = await isDuplicateInventoryDocGroup("CENTER_CONSUMPTION", resolved.warehouseId, resolved.date, resolved.detailCode, resolved.lines);
          if (isDup) return { ok: false, error: "مصرفی با همین انبار، تاریخ، مرکز هزینه و اقلام از قبل ثبت شده است" };
        }
        await createCenterConsumption({ ...resolved, basis: "NO_BASIS" } as any);
        return { ok: true };
      } catch (e: any) {
        return { ok: false, error: e.message || "خطا در ثبت سند" };
      }
    },
  });

  // «اضافات انبارگردانی» — فقط انبارداری (بدون فی/مبلغ، فی فقط بعد از «تایید حسابداری» دستی وارد
  // می‌شود، دقیقاً هم‌الگوی «رسید تولید»)، بدون مبنا و بدون طرف‌حساب/مرکز هزینه.
  registerImportEntity("warehouse-adjustment", {
    groupByKey: (row) => `${row.warehouseCode || ""}__${row.number || ""}__${row.date || ""}`,
    group: async (groupRows, ctx) => {
      try {
        const resolved = await resolveWarehouseDocGroup(groupRows, { requireNumber: true });
        if ("error" in resolved) return { ok: false, error: resolved.error };
        if (!ctx.allowDuplicates) {
          const isDup = await isDuplicateInventoryDocGroup("WAREHOUSE_ADJUSTMENT", resolved.warehouseId, resolved.date, undefined, resolved.lines);
          if (isDup) return { ok: false, error: "سندی با همین انبار، تاریخ و اقلام از قبل ثبت شده است" };
        }
        await createWarehouseAdjustment(resolved as any);
        return { ok: true };
      } catch (e: any) {
        return { ok: false, error: e.message || "خطا در ثبت سند" };
      }
    },
  });

  // «کسری انبارگردانی» — فقط انبارداری (بدون فی/مبلغ، بدون مبنا و بدون طرف‌حساب/مرکز هزینه)؛ این سند
  // «تایید حسابداری» فردی ندارد، فی/مبلغ فقط با «تایید انبار» دسته‌ای وارد می‌شود.
  registerImportEntity("inventory-counting-shortage", {
    groupByKey: (row) => `${row.warehouseCode || ""}__${row.number || ""}__${row.date || ""}`,
    group: async (groupRows, ctx) => {
      try {
        const resolved = await resolveWarehouseDocGroup(groupRows, { requireNumber: true });
        if ("error" in resolved) return { ok: false, error: resolved.error };
        if (!ctx.allowDuplicates) {
          const isDup = await isDuplicateInventoryDocGroup("INVENTORY_COUNTING_SHORTAGE", resolved.warehouseId, resolved.date, undefined, resolved.lines);
          if (isDup) return { ok: false, error: "سندی با همین انبار، تاریخ و اقلام از قبل ثبت شده است" };
        }
        await createInventoryCountingShortage(resolved as any);
        return { ok: true };
      } catch (e: any) {
        return { ok: false, error: e.message || "خطا در ثبت سند" };
      }
    },
  });
}

// مشترک بین «رسید انبار خرید» (detailCode از طرف مقابل)، «مصرف تولید» (detailCode از مرکز هزینه) و
// «رسید تولید» (detailCode ندارد) — یک سند از همان نوع با همان انبار/تاریخ/(تفصیل اگر داشت)/مجموعه‌ی
// دقیقاً یکسانِ اقلام، تکراری در نظر گرفته می‌شود. تفصیل (اگر ماهیت سند دارد) از قبل توسط فراخوان
// resolve شده و مستقیم به‌عنوان detailCode داده می‌شود — این تابع خودش نمی‌داند طرف مقابل است یا مرکز
// هزینه، فقط رشته‌ی detailCode را می‌بیند.
async function isDuplicateInventoryDocGroup(
  documentType:
    | "WAREHOUSE_RECEIPT"
    | "PRODUCTION_RECEIPT"
    | "PRODUCTION_CONSUMPTION"
    | "SALES_DELIVERY"
    | "CENTER_CONSUMPTION"
    | "WAREHOUSE_ADJUSTMENT"
    | "INVENTORY_COUNTING_SHORTAGE",
  warehouseId: number,
  dateStr: string,
  detailCode: string | undefined,
  lines: { goodsItemId: number; quantity: number }[]
): Promise<boolean> {
  const candidates = await prisma.inventoryDocument.findMany({
    where: { documentType, warehouseId, date: new Date(dateStr), ...(detailCode ? { detailCode } : {}) },
    include: { lines: { select: { goodsItemId: true, quantity: true } } },
  });
  if (!candidates.length) return false;

  const signature = (rows: { goodsItemId: number; quantity: any }[]) =>
    rows
      .map((r) => `${r.goodsItemId}:${Number(r.quantity)}`)
      .sort()
      .join("|");
  const incoming = signature(lines);
  return candidates.some((c) => signature(c.lines) === incoming);
}
