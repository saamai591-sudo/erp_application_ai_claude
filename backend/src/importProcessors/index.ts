import { prisma } from "../lib/prisma";
import { registerImportEntity } from "../services/importJobService";
import { resolveDetailCode, registerDetailCode, nextSerialNumber } from "../utils/coding";
import { computeFullAccountCode, buildAccountByIdMap } from "../utils/accountCode";
import { issueJournalEntry, IssueLineInput } from "../services/journalEntryService";
import { resolveDateString } from "../utils/jalaliDate";
import { KIND_FA, computePrefixes, resolveSerial, AttrSelection } from "../routes/goodsItems";

const DETAIL_TYPE_PARTY = 1;
const DETAIL_TYPE_COST_CENTER = 2;
const DETAIL_TYPE_CASHBOX = 3;
const DETAIL_TYPE_BANK_ACCOUNT = 4;

const NATURE_GROUP_FA_REVERSE: Record<string, string> = { "ترازنامه‌ای": "BALANCE_SHEET", "سود و زیانی": "PROFIT_LOSS", "انتظامی": "MEMORANDUM" };
const NATURE_DETAIL_FA_REVERSE: Record<string, string> = { "دارایی": "ASSET", "بدهی": "LIABILITY", "درآمد": "REVENUE", "هزینه": "EXPENSE", "انتظامی": "MEMORANDUM" };
const BALANCE_NATURE_FA_REVERSE: Record<string, string> = { "بدهکار": "DEBIT", "بستانکار": "CREDIT" };
const LEGAL_TYPE_FA_REVERSE: Record<string, string> = { "حقوقی": "LEGAL", "مشارکت خاص": "SPECIAL_PARTNERSHIP", "بانک/موسسه مالی": "BANK" };
const COST_CENTER_TYPE_FA_REVERSE: Record<string, string> = { "عملیاتی/تولیدی": "OPERATIONAL", "پشتیبانی": "SUPPORT", "خدماتی": "SERVICE", "اداری و تشکیلاتی": "ADMIN" };
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

        let parentId: number | null = null;
        let level;
        if (row.parentFullCode) {
          const allAccounts = await prisma.account.findMany({ select: { id: true, code: true, parentId: true } });
          const byId = buildAccountByIdMap(allAccounts as any);
          const parent = allAccounts.find((a: any) => computeFullAccountCode(a.id, byId) === row.parentFullCode);
          if (!parent) return { ok: false, error: `حساب والد با کد کامل «${row.parentFullCode}» یافت نشد` };
          parentId = parent.id;
          const parentFull = await prisma.account.findUnique({ where: { id: parentId }, include: { level: true } });
          level = await prisma.reportingLevel.findFirst({ where: { order: parentFull!.level.order + 1 } });
          if (!level) return { ok: false, error: "سطح گزارشگری بعدی تعریف نشده است" };
        } else {
          level = await prisma.reportingLevel.findFirst({ where: { order: 1 } });
          if (!level) return { ok: false, error: "ابتدا سطح گزارشگری (سطح گروه) را تعریف کنید" };
        }

        if (row.code.length !== level.codeLength) {
          return { ok: false, error: `طول کد باید ${level.codeLength} رقم باشد (سطح ${level.title})` };
        }
        const dup = await prisma.account.findFirst({ where: { parentId, code: row.code } });
        if (dup) return { ok: false, error: "کد در این سطح تکراری است" };

        const data: any = { parentId, levelId: level.id, code: row.code, title: row.title };
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
              const match = detailTypes.find((t: any) => String(t.code) === value.trim());
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
        const group = allGroups.find((g: any) => g.isLastBranch && fullGroupCode(g) === row.groupFullCode!.trim());
        if (!group) return { ok: false, error: `گروه ${label} با کد کامل «${row.groupFullCode}» (شاخه‌ی آخر) یافت نشد` };

        const mainUnit = await prisma.unitOfMeasure.findFirst({ where: { code: Number(row.mainUnitCode) } });
        if (!mainUnit) return { ok: false, error: `واحد اصلی با کد «${row.mainUnitCode}» یافت نشد` };

        const accountingGroup = await prisma.accountingGroup.findFirst({ where: { code: Number(row.accountingGroupCode) } });
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
          const weightUnit = await prisma.unitOfMeasure.findFirst({ where: { code: Number(row.weightUnitCode) } });
          if (!weightUnit) return { ok: false, error: `واحد وزنی با کد «${row.weightUnitCode}» یافت نشد` };
          weightUnitId = weightUnit.id;
          if (!row.weightRatio) return { ok: false, error: "نسبت وزنی الزامی است" };
          weightRatio = Number(row.weightRatio);
        }

        const isSpecial = row.isSpecial === "بله";
        let taxRate: number | null = null;
        if (isSpecial) {
          if (!row.taxRate) return { ok: false, error: "نرخ مالیات الزامی است" };
          taxRate = Number(row.taxRate);
        }

        const reorderControl = kind === "GOODS" && row.reorderControl === "بله";
        let reorderPoint: number | null = null;
        if (reorderControl) {
          if (!row.reorderPoint) return { ok: false, error: "مقدار نقطه سفارش الزامی است" };
          reorderPoint = Number(row.reorderPoint);
        }

        const { leaf, codePrefix, titlePrefix, resolvedAttrs } = await computePrefixes(group.id, attrSelections);
        const serial = await resolveSerial(group.id, row.code || undefined, leaf.childCodeLength!);
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
            hasSerialNumber: kind === "GOODS" && row.hasSerialNumber === "بله",
            hasExpiryDate: kind === "GOODS" && row.hasExpiryDate === "بله",
            isSerialTracked: kind === "GOODS" && row.isSerialTracked === "بله",
            isExpiryTracked: kind === "GOODS" && row.isExpiryTracked === "بله",
            isBatchTracked: kind === "GOODS" && row.isBatchTracked === "بله",
            isLocationTracked: kind === "GOODS" && row.isLocationTracked === "بله",
            accountingGroupId: accountingGroup.id,
            isSpecial,
            taxRate,
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
          const account = allAccounts.find((a: any) => computeFullAccountCode(a.id, byId) === row.accountCode);
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
}
