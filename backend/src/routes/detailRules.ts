import { Router } from "express";
import { prisma } from "../lib/prisma";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { RULE_ACCOUNT_TYPES, WAREHOUSE_CONDITION_TYPES } from "../services/detailRuleService";
import { resolveDetailTitles } from "../utils/detailValues";

// «قواعد تفصیل» (کالا و خدمت › تنظیمات): هدر = رکورد حسابداری کالا و خدمت + تاریخ اجرا + شرط‌های تفکیک، دیتیل = ردیف قاعده.
// منطق اعمال در صدور سند: services/detailRuleService.ts

const FORM = findFormPrefix("detail-rules");
const router = Router();

const SETTING_INCLUDE = {
  accountingGroup: true,
  warehouseGroup: true,
  account: { include: { detailType1: true, detailType2: true, detailType3: true } },
} as const;

function settingDto(s: any) {
  return {
    id: s.id,
    accountType: s.accountType,
    warehouseDocType: s.warehouseDocType,
    effectiveDate: s.effectiveDate,
    accountingGroupTitle: s.accountingGroup?.title ?? null,
    warehouseGroupTitle: s.warehouseGroup?.title ?? null,
    accountCode: s.account?.code ?? "",
    accountTitle: s.account?.title ?? "",
    detailTypes: [s.account?.detailType1, s.account?.detailType2, s.account?.detailType3].map((t: any) => (t ? { id: t.id, title: t.title } : null)),
  };
}

const HEADER_INCLUDE = { setting: { include: SETTING_INCLUDE }, rows: { orderBy: { id: "asc" as const } } };

async function headerDto(h: any) {
  const wIds = Array.from(new Set(h.rows.map((r: any) => r.warehouseId).filter(Boolean))) as number[];
  const gIds = Array.from(new Set(h.rows.map((r: any) => r.goodsGroupId).filter(Boolean))) as number[];
  const codes = Array.from(new Set(h.rows.flatMap((r: any) => [r.partyDetailCode, r.slot1Code, r.slot2Code, r.slot3Code]).filter(Boolean))) as string[];
  const [ws, gs] = await Promise.all([
    wIds.length ? prisma.warehouse.findMany({ where: { id: { in: wIds } }, select: { id: true, title: true } }) : [],
    gIds.length ? prisma.goodsGroup.findMany({ where: { id: { in: gIds } }, select: { id: true, title: true } }) : [],
  ]);
  const titles = codes.length ? await resolveDetailTitles(codes) : {};
  return {
    id: h.id,
    settingId: h.settingId,
    setting: settingDto(h.setting),
    effectiveDate: h.effectiveDate,
    byWarehouse: h.byWarehouse,
    byGoodsGroup: h.byGoodsGroup,
    byParty: h.byParty,
    rows: h.rows.map((r: any) => ({
      id: r.id,
      warehouseId: r.warehouseId,
      warehouseTitle: ws.find((w: any) => w.id === r.warehouseId)?.title ?? null,
      goodsGroupId: r.goodsGroupId,
      goodsGroupTitle: gs.find((g: any) => g.id === r.goodsGroupId)?.title ?? null,
      partyDetailCode: r.partyDetailCode,
      partyTitle: r.partyDetailCode ? titles[r.partyDetailCode] ?? null : null,
      slots: [1, 2, 3].map((n) => ({ source: r[`slot${n}Source`], code: r[`slot${n}Code`], codeTitle: r[`slot${n}Code`] ? titles[r[`slot${n}Code`]] ?? null : null })),
    })),
  };
}

// رکوردهای حسابداری کالا و خدمتی که قاعده‌ی تفصیل می‌گیرند (برای انتخابگر هدر)
router.get("/eligible-settings", can(`${FORM}.view`), async (_req, res) => {
  const list = await prisma.goodsServiceAccountingSetting.findMany({ where: { accountType: { in: RULE_ACCOUNT_TYPES as any } }, include: SETTING_INCLUDE, orderBy: { id: "asc" } });
  res.json(list.map(settingDto));
});

router.get("/", can(`${FORM}.view`), async (_req, res) => {
  const list = await prisma.detailRuleHeader.findMany({ include: { setting: { include: SETTING_INCLUDE }, rows: { select: { id: true } } }, orderBy: [{ settingId: "asc" }, { effectiveDate: "asc" }] });
  res.json(
    list.map((h: any) => ({
      id: h.id,
      setting: settingDto(h.setting),
      effectiveDate: h.effectiveDate,
      byWarehouse: h.byWarehouse,
      byGoodsGroup: h.byGoodsGroup,
      byParty: h.byParty,
      rowCount: h.rows.length,
    }))
  );
});

router.get("/:id", can(`${FORM}.view`), async (req, res) => {
  const h = await prisma.detailRuleHeader.findUnique({ where: { id: Number(req.params.id) }, include: HEADER_INCLUDE });
  if (!h) return res.status(404).json({ error: "قاعده یافت نشد" });
  res.json(await headerDto(h));
});

interface RowBody {
  warehouseId?: number | null;
  goodsGroupId?: number | null;
  partyDetailCode?: string | null;
  slots?: { source?: string | null; code?: string | null }[];
}
interface Body {
  settingId?: number;
  effectiveDate?: string;
  byWarehouse?: boolean;
  byGoodsGroup?: boolean;
  byParty?: boolean;
  rows?: RowBody[];
}

async function validate(body: Body, excludeHeaderId?: number) {
  if (!body.settingId) throw new Error("رکورد حسابداری کالا و خدمت انتخاب نشده است");
  if (!body.effectiveDate) throw new Error("تاریخ اجرا الزامی است");
  const effectiveDate = new Date(body.effectiveDate);
  if (Number.isNaN(effectiveDate.getTime())) throw new Error("تاریخ اجرا معتبر نیست");
  const setting = await prisma.goodsServiceAccountingSetting.findUnique({ where: { id: body.settingId }, include: SETTING_INCLUDE });
  if (!setting) throw new Error("رکورد حسابداری کالا و خدمت یافت نشد");
  if (!RULE_ACCOUNT_TYPES.includes(setting.accountType)) throw new Error("برای این نوع حساب قاعده‌ی تفصیل تعریف نمی‌شود (فقط موجودی کالا، بستانکار رسید انبار، بدهکار حواله انبار، خرید خدمت، ارزش افزوده خرید، پرداختنی خرید و کنترل خرید)");
  if (body.byWarehouse && !WAREHOUSE_CONDITION_TYPES.includes(setting.accountType)) throw new Error("شرط «انبار» برای این نوع حساب معنا ندارد");
  const dup = await prisma.detailRuleHeader.findFirst({ where: { settingId: body.settingId, effectiveDate, ...(excludeHeaderId ? { NOT: { id: excludeHeaderId } } : {}) } });
  if (dup) throw new Error("برای این رکورد در همین تاریخ اجرا قبلاً قاعده تعریف شده است؛ آن را ویرایش کنید یا تاریخ دیگری بگیرید");

  const byWarehouse = !!body.byWarehouse;
  const byGoodsGroup = !!body.byGoodsGroup;
  const byParty = !!body.byParty;
  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (rows.length === 0) throw new Error("حداقل یک ردیف قاعده لازم است");

  const slotTypeIds = [setting.account.detailType1Id, setting.account.detailType2Id, setting.account.detailType3Id];
  const cleaned: any[] = [];
  const seen = new Set<string>();
  for (const [idx, r] of rows.entries()) {
    const n = idx + 1;
    const w = r.warehouseId ? Number(r.warehouseId) : null;
    const g = r.goodsGroupId ? Number(r.goodsGroupId) : null;
    const p = r.partyDetailCode ? String(r.partyDetailCode).trim() : null;
    if (!byWarehouse && w) throw new Error(`ردیف ${n}: شرط «انبار» در هدر انتخاب نشده است`);
    if (!byGoodsGroup && g) throw new Error(`ردیف ${n}: شرط «گروه کالا» در هدر انتخاب نشده است`);
    if (!byParty && p) throw new Error(`ردیف ${n}: شرط «طرف حساب» در هدر انتخاب نشده است`);
    // یا همه‌ی شرط‌های انتخاب‌شده پر باشند یا همه خالی (ردیف «بقیه»)
    const required = [byWarehouse && !w, byGoodsGroup && !g, byParty && !p];
    const given = [byWarehouse && w, byGoodsGroup && g, byParty && p];
    const anyGiven = given.some(Boolean);
    if (anyGiven && required.some(Boolean)) throw new Error(`ردیف ${n}: همه‌ی شرط‌های انتخاب‌شده باید مقدار داشته باشند (یا همه خالی برای ردیف «بقیه»)`);
    const key = [w ?? "", g ?? "", p ?? ""].join("|");
    if (seen.has(key)) throw new Error(anyGiven ? `ردیف ${n}: این ترکیب شرط‌ها تکراری است` : `ردیف ${n}: فقط یک ردیف «بقیه» (بدون شرط) مجاز است`);
    seen.add(key);
    if (w && !(await prisma.warehouse.findUnique({ where: { id: w } }))) throw new Error(`ردیف ${n}: انبار یافت نشد`);
    if (g && !(await prisma.goodsGroup.findUnique({ where: { id: g } }))) throw new Error(`ردیف ${n}: گروه کالا یافت نشد`);
    if (p) {
      const u = await prisma.detailCodeUsage.findUnique({ where: { code: p }, include: { detailType: true } });
      if (!u || u.entityTable !== "Party") throw new Error(`ردیف ${n}: طرف حساب یافت نشد`);
    }

    const out: any = { warehouseId: w, goodsGroupId: g, partyDetailCode: p };
    for (let i = 0; i < 3; i++) {
      const src = r.slots?.[i]?.source || null;
      const code = r.slots?.[i]?.code ? String(r.slots![i].code).trim() : null;
      const typeId = slotTypeIds[i];
      if (!typeId) {
        if (src) throw new Error(`ردیف ${n}: حساب «${setting.account.title}» در سطح ${i + 1} نوع تفصیل ندارد`);
        continue;
      }
      if (!src) continue;
      if (src !== "FIXED" && src !== "FROM_DOCUMENT") throw new Error(`ردیف ${n}: منبع سطح ${i + 1} نامعتبر است`);
      if (src === "FIXED") {
        if (!code) throw new Error(`ردیف ${n}: برای منبع «ثابت» در سطح ${i + 1}، تفصیل را انتخاب کنید`);
        const u = await prisma.detailCodeUsage.findUnique({ where: { code } });
        if (!u) throw new Error(`ردیف ${n}: کد تفصیل سطح ${i + 1} یافت نشد`);
        if (u.detailTypeId !== typeId) throw new Error(`ردیف ${n}: کد تفصیل سطح ${i + 1} از نوع تفصیل این سطح نیست`);
      }
      out[`slot${i + 1}Source`] = src;
      out[`slot${i + 1}Code`] = src === "FIXED" ? code : null;
    }
    cleaned.push(out);
  }
  // گروه کالا درختی است و قاعده‌ی هر گروه شامل زیرگروه‌هایش هم می‌شود؛ پس دو ردیف با شرط‌های دیگرِ یکسان (انبار/طرف حساب)
  // نباید گروه‌هایی داشته باشند که یکی سرشاخه‌ی (یا همان) دیگری است — وگرنه روی یک کالا هر دو قاعده جور می‌شود
  if (byGoodsGroup) {
    const all = await prisma.goodsGroup.findMany({ select: { id: true, parentId: true, title: true } });
    const byId = new Map(all.map((g) => [g.id, g]));
    const ancestorsOf = (id: number) => {
      const out = new Set<number>();
      for (let cur = byId.get(id)?.parentId ?? null; cur != null && !out.has(cur); cur = byId.get(cur)?.parentId ?? null) out.add(cur);
      return out;
    };
    for (let j = 0; j < cleaned.length; j++) {
      for (let i = 0; i < j; i++) {
        const a = cleaned[i];
        const b = cleaned[j];
        if (!a.goodsGroupId || !b.goodsGroupId) continue;
        if ((a.warehouseId ?? null) !== (b.warehouseId ?? null) || (a.partyDetailCode ?? null) !== (b.partyDetailCode ?? null)) continue;
        const titleOf = (id: number) => byId.get(id)?.title ?? "";
        if (ancestorsOf(b.goodsGroupId).has(a.goodsGroupId)) throw new Error(`ردیف ${j + 1}: گروه «${titleOf(b.goodsGroupId)}» زیرمجموعه‌ی گروه «${titleOf(a.goodsGroupId)}» است که در ردیف ${i + 1} (با همین شرط‌ها) آمده و قاعده‌ی آن شامل این گروه هم می‌شود`);
        if (ancestorsOf(a.goodsGroupId).has(b.goodsGroupId)) throw new Error(`ردیف ${i + 1}: گروه «${titleOf(a.goodsGroupId)}» زیرمجموعه‌ی گروه «${titleOf(b.goodsGroupId)}» است که در ردیف ${j + 1} (با همین شرط‌ها) آمده و قاعده‌ی آن شامل این گروه هم می‌شود`);
      }
    }
  }
  return { effectiveDate, byWarehouse, byGoodsGroup, byParty, rows: cleaned };
}

router.post("/", can(`${FORM}.create`), async (req, res) => {
  try {
    const body = req.body as Body;
    const v = await validate(body);
    const created = await prisma.detailRuleHeader.create({
      data: { settingId: body.settingId!, effectiveDate: v.effectiveDate, byWarehouse: v.byWarehouse, byGoodsGroup: v.byGoodsGroup, byParty: v.byParty, rows: { create: v.rows } },
      include: HEADER_INCLUDE,
    });
    res.status(201).json(await headerDto(created));
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در ثبت" });
  }
});

router.put("/:id", can(`${FORM}.edit`), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = await prisma.detailRuleHeader.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: "قاعده یافت نشد" });
    const body = req.body as Body;
    // رکورد حسابداری کالا و خدمت بعد از ثبت تغییر نمی‌کند (کلید قاعده است)
    const v = await validate({ ...body, settingId: existing.settingId }, id);
    const updated = await prisma.$transaction(async (tx) => {
      await tx.detailRuleRow.deleteMany({ where: { headerId: id } });
      await tx.detailRuleHeader.update({
        where: { id },
        data: { effectiveDate: v.effectiveDate, byWarehouse: v.byWarehouse, byGoodsGroup: v.byGoodsGroup, byParty: v.byParty, rows: { create: v.rows } },
      });
      return tx.detailRuleHeader.findUniqueOrThrow({ where: { id }, include: HEADER_INCLUDE });
    });
    res.json(await headerDto(updated));
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در ویرایش" });
  }
});

router.delete("/:id", can(`${FORM}.delete`), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = await prisma.detailRuleHeader.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: "قاعده یافت نشد" });
    await prisma.detailRuleHeader.delete({ where: { id } });
    res.status(204).send();
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در حذف" });
  }
});

export default router;
