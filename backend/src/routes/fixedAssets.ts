import { Router } from "express";
import { prisma } from "../lib/prisma";
import { can, userHasAction } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { AuthedRequest } from "../middleware/auth";
import { sendBulkError } from "../lib/bulkError";
import { getAssetLineAmounts } from "../services/assetAmountService";
import { deleteLocation, locationPaths, saveLocation } from "../services/assetLocationService";
import { ASSET_ACCOUNT_TYPES, deleteAccountSetting, getAccountSetting, listAccountSettings, saveAccountSetting, bulkCandidates, bulkCreate } from "../services/assetAccountSettingService";
import { issueAssetAcquisitionEntry, revertAssetAcquisitionEntry } from "../services/assetAcquisitionJournalService";
import { bookValuesAt, calculateInsurance, deleteInsurance, deleteInsuranceType, listInsuranceTypes, saveInsuranceType, deletePolicy, getPolicy, issueInsuranceEntry, listInsurancePeriods, listPolicies, pickableInvoiceLines, revertInsuranceEntry, savePolicy } from "../services/assetInsuranceService";
import { confirmExit, deleteExit, deleteExitType, issueExitEntry, listExitTypes, revertExitEntry, saveExit, saveExitType, unconfirmExit } from "../services/assetExitService";
import { confirmChange, deleteChange, issueChangeEntry, previewFromGroups, revertChangeEntry, saveChange, unconfirmChange } from "../services/assetGroupChangeService";
import { buildAssetCard } from "../services/assetCardService";
import { assetGroupReview } from "../services/assetGroupReviewService";
import { calculateDepreciation, deleteDepreciation, issueDepreciationEntry, listDepreciationPeriods, revertDepreciationEntry } from "../services/assetDepreciationService";
import {
  AssetError,
  changePositions,
  confirmAssetReceipt,
  createAssetsFromReceipt,
  confirmAssets,
  defineAssets,
  deleteAsset,
  deleteAssetReceipt,
  deletePosition,
  receiptLinesWithRemaining,
  saveAssetGroup,
  saveAssetReceipt,
  unconfirmAssetReceipt,
  unconfirmAssets,
  updateAsset,
} from "../services/fixedAssetService";

// ماژول «دارایی ثابت» — گروه حسابداری دارایی، رسید دارایی، تعریف دارایی (پلاک)، تغییر موقعیت. قواعد: services/fixedAssetService.ts

const GROUPS = findFormPrefix("asset-groups");
const RECEIPTS = findFormPrefix("asset-receipts");
const ASSETS = findFormPrefix("fixed-assets");
const POSITIONS = findFormPrefix("asset-positions");
const LOCATIONS = findFormPrefix("asset-locations");
const DEPRECIATION = findFormPrefix("asset-depreciation");
const CHANGES = findFormPrefix("asset-group-changes");
const REVIEW = findFormPrefix("asset-group-review");
const EXITS = findFormPrefix("asset-exits");
const INSURANCES = findFormPrefix("asset-insurances");
const INSURANCE_CALC = findFormPrefix("asset-insurance-calculation");
const EXIT_TYPES = findFormPrefix("asset-exit-types");
const INSURANCE_TYPES = findFormPrefix("asset-insurance-types");
const ACCOUNT_SETTINGS = findFormPrefix("asset-account-settings");
// طبق رسید انبار: «مشاهده اطلاعات حسابداری» (ریالی) جدا از دسترسی «مشاهده» (تعدادی) است؛ مبلغ رسید تا تایید اصلاً نمایش داده نمی‌شود
const RECEIPT_ACCOUNTING = `${RECEIPTS}.viewAccounting`;
const ASSET_ACCOUNTING = `${ASSETS}.viewAccounting`;

const router = Router();

function handle(res: any, e: any) {
  if (e instanceof AssetError) {
    if (e.details) return sendBulkError(res, 400, e.message, e.details);
    return res.status(400).json({ error: e.message });
  }
  if (e?.code === "P2002") return res.status(400).json({ error: "مقدار تکراری است" });
  console.error("[fixed-assets]", e);
  res.status(400).json({ error: e?.message || "خطا" });
}

// ───────────── محاسبه استهلاک (در سطح دوره‌ی گزارشگری) ─────────────
router.get("/asset-depreciation/periods", can(`${DEPRECIATION}.view`), async (_req, res) => {
  res.json(await listDepreciationPeriods());
});
router.post("/asset-depreciation/calculate", can(`${DEPRECIATION}.calculate`), async (req: AuthedRequest, res) => {
  try {
    res.status(201).json(await calculateDepreciation(Number(req.body.reportingPeriodId), req.user?.id ?? null));
  } catch (e) {
    handle(res, e);
  }
});
router.post("/asset-depreciation/delete", can(`${DEPRECIATION}.deleteCalculation`), async (req, res) => {
  try {
    await deleteDepreciation(Number(req.body.reportingPeriodId));
    res.json({ ok: true });
  } catch (e) {
    handle(res, e);
  }
});
router.post("/asset-depreciation/issue-journal-entry", can(`${DEPRECIATION}.issueJournalEntry`), async (req, res) => {
  try {
    res.status(201).json(await issueDepreciationEntry(Number(req.body.reportingPeriodId)));
  } catch (e) {
    handle(res, e);
  }
});
router.post("/asset-depreciation/revert-journal-entry", can(`${DEPRECIATION}.revertJournalEntry`), async (req, res) => {
  try {
    await revertDepreciationEntry(Number(req.body.reportingPeriodId));
    res.json({ ok: true });
  } catch (e) {
    handle(res, e);
  }
});

// ───────────── تغییر گروه ─────────────
router.get("/asset-group-changes", can(`${CHANGES}.view`), async (_req, res) => {
  const list = await prisma.assetGroupChange.findMany({ include: { toGroup: { select: { title: true } }, items: { select: { id: true } }, journalEntry: { select: { referenceNumber: true } } }, orderBy: { number: "desc" } });
  res.json(list.map((c) => ({ id: c.id, number: c.number, date: c.date, toGroupTitle: c.toGroup.title, status: c.status, itemCount: c.items.length, description: c.description, journalEntryReferenceNumber: c.journalEntry?.referenceNumber ?? null, journalEntryId: c.journalEntryId })));
});
router.get("/asset-group-changes/preview-from-groups", can(`${CHANGES}.view`), async (req, res) => {
  const ids = String(req.query.assetIds ?? "").split(",").map(Number).filter(Number.isFinite);
  res.json(await previewFromGroups(ids, String(req.query.date ?? "")));
});
router.get("/asset-group-changes/:id", can(`${CHANGES}.view`), async (req: AuthedRequest, res) => {
  const canAmount = await userHasAction(req.user!.id, `${CHANGES}.viewAccounting`);
  const c = await prisma.assetGroupChange.findUnique({
    where: { id: Number(req.params.id) },
    include: {
      toGroup: { select: { id: true, title: true } },
      journalEntry: { select: { id: true, referenceNumber: true } },
      items: { include: { asset: { select: { id: true, detailCode: true, title: true } }, fromGroup: { select: { id: true, title: true } }, depreciationItems: { select: { amount: true } } }, orderBy: { id: "asc" } },
    },
  });
  if (!c) return res.status(404).json({ error: "تغییر گروه یافت نشد" });
  res.json({
    id: c.id,
    number: c.number,
    date: c.date,
    toGroupId: c.toGroupId,
    toGroupTitle: c.toGroup.title,
    description: c.description,
    status: c.status,
    journalEntryId: c.journalEntryId,
    journalEntryReferenceNumber: c.journalEntry?.referenceNumber ?? null,
    items: c.items.map((i) => ({
      id: i.id,
      assetId: i.assetId,
      detailCode: i.asset.detailCode,
      title: i.asset.title,
      fromGroupId: i.fromGroupId,
      fromGroupTitle: i.fromGroup.title,
      costAtChange: canAmount && i.costAtChange !== null ? i.costAtChange.toString() : null,
      accumulatedAtChange: canAmount && i.accumulatedAtChange !== null ? i.accumulatedAtChange.toString() : null,
      depreciationBeforeChange: canAmount && c.status === "CONFIRMED" ? i.depreciationItems.reduce((s, x) => s + Number(x.amount), 0).toString() : null,
    })),
  });
});
router.post("/asset-group-changes", can(`${CHANGES}.create`), async (req, res) => {
  try {
    res.status(201).json(await saveChange(null, req.body));
  } catch (e) {
    handle(res, e);
  }
});
router.put("/asset-group-changes/:id", can(`${CHANGES}.edit`), async (req, res) => {
  try {
    res.json(await saveChange(Number(req.params.id), req.body));
  } catch (e) {
    handle(res, e);
  }
});
router.delete("/asset-group-changes/:id", can(`${CHANGES}.delete`), async (req, res) => {
  try {
    await deleteChange(Number(req.params.id));
    res.status(204).end();
  } catch (e) {
    handle(res, e);
  }
});
router.post("/asset-group-changes/:id/confirm", can(`${CHANGES}.confirm`), async (req: AuthedRequest, res) => {
  try {
    await confirmChange(Number(req.params.id), req.user?.id ?? null);
    res.json({ ok: true });
  } catch (e) {
    handle(res, e);
  }
});
router.post("/asset-group-changes/:id/unconfirm", can(`${CHANGES}.unconfirm`), async (req, res) => {
  try {
    await unconfirmChange(Number(req.params.id));
    res.json({ ok: true });
  } catch (e) {
    handle(res, e);
  }
});
router.post("/asset-group-changes/:id/issue-journal-entry", can(`${CHANGES}.issueJournalEntry`), async (req, res) => {
  try {
    res.status(201).json(await issueChangeEntry(Number(req.params.id)));
  } catch (e) {
    handle(res, e);
  }
});
router.post("/asset-group-changes/:id/revert-journal-entry", can(`${CHANGES}.revertJournalEntry`), async (req, res) => {
  try {
    await revertChangeEntry(Number(req.params.id));
    res.json({ ok: true });
  } catch (e) {
    handle(res, e);
  }
});

// ───────────── بیمه دارایی‌ها ─────────────
router.get("/asset-insurances", can(`${INSURANCES}.view`), async (_req, res) => {
  res.json(await listPolicies());
});
router.get("/asset-insurances/pickable-invoice-lines", can(`${INSURANCES}.view`), async (req, res) => {
  res.json(await pickableInvoiceLines(req.query.includeLineId ? Number(req.query.includeLineId) : undefined));
});
router.get("/asset-insurances/book-values", can(`${INSURANCES}.view`), async (req, res) => {
  const ids = String(req.query.assetIds ?? "").split(",").map(Number).filter(Number.isFinite);
  res.json(await bookValuesAt(ids, String(req.query.date ?? "")));
});
router.get("/asset-insurances/:id", can(`${INSURANCES}.view`), async (req, res) => {
  const p = await getPolicy(Number(req.params.id));
  if (!p) return res.status(404).json({ error: "بیمه‌نامه یافت نشد" });
  res.json(p);
});
router.post("/asset-insurances", can(`${INSURANCES}.create`), async (req, res) => {
  try {
    res.status(201).json(await savePolicy(null, req.body));
  } catch (e) {
    handle(res, e);
  }
});
router.put("/asset-insurances/:id", can(`${INSURANCES}.edit`), async (req, res) => {
  try {
    res.json(await savePolicy(Number(req.params.id), req.body));
  } catch (e) {
    handle(res, e);
  }
});
router.delete("/asset-insurances/:id", can(`${INSURANCES}.delete`), async (req, res) => {
  try {
    await deletePolicy(Number(req.params.id));
    res.status(204).end();
  } catch (e) {
    handle(res, e);
  }
});

// ───────────── محاسبه هزینه بیمه (در سطح دوره‌ی گزارشگری) ─────────────
router.get("/asset-insurance-calculation/periods", can(`${INSURANCE_CALC}.view`), async (_req, res) => {
  res.json(await listInsurancePeriods());
});
router.post("/asset-insurance-calculation/calculate", can(`${INSURANCE_CALC}.calculate`), async (req: AuthedRequest, res) => {
  try {
    res.status(201).json(await calculateInsurance(Number(req.body.reportingPeriodId), req.user?.id ?? null));
  } catch (e) {
    handle(res, e);
  }
});
router.post("/asset-insurance-calculation/delete", can(`${INSURANCE_CALC}.deleteCalculation`), async (req, res) => {
  try {
    await deleteInsurance(Number(req.body.reportingPeriodId));
    res.json({ ok: true });
  } catch (e) {
    handle(res, e);
  }
});
router.post("/asset-insurance-calculation/issue-journal-entry", can(`${INSURANCE_CALC}.issueJournalEntry`), async (req, res) => {
  try {
    res.status(201).json(await issueInsuranceEntry(Number(req.body.reportingPeriodId)));
  } catch (e) {
    handle(res, e);
  }
});
router.post("/asset-insurance-calculation/revert-journal-entry", can(`${INSURANCE_CALC}.revertJournalEntry`), async (req, res) => {
  try {
    await revertInsuranceEntry(Number(req.body.reportingPeriodId));
    res.json({ ok: true });
  } catch (e) {
    handle(res, e);
  }
});

// ───────────── نوع خروج دارایی ─────────────
router.get("/asset-exit-types", async (_req, res) => res.json(await listExitTypes())); // فهرست پایه (انتخابگر فرم خروج)
router.post("/asset-exit-types", can(`${EXIT_TYPES}.create`), async (req, res) => {
  try {
    res.status(201).json(await saveExitType(null, req.body));
  } catch (e) {
    handle(res, e);
  }
});
router.put("/asset-exit-types/:id", can(`${EXIT_TYPES}.edit`), async (req, res) => {
  try {
    res.json(await saveExitType(Number(req.params.id), req.body));
  } catch (e) {
    handle(res, e);
  }
});
router.delete("/asset-exit-types/:id", can(`${EXIT_TYPES}.delete`), async (req, res) => {
  try {
    await deleteExitType(Number(req.params.id));
    res.status(204).end();
  } catch (e) {
    handle(res, e);
  }
});

// ───────────── خروج دارایی ─────────────
router.get("/asset-exits", can(`${EXITS}.view`), async (_req, res) => {
  const list = await prisma.assetExit.findMany({ include: { type: { select: { title: true, nature: true } }, items: { select: { id: true } }, journalEntry: { select: { referenceNumber: true } } }, orderBy: { number: "desc" } });
  res.json(list.map((c) => ({ id: c.id, number: c.number, date: c.date, typeTitle: c.type.title, nature: c.type.nature, status: c.status, itemCount: c.items.length, description: c.description, journalEntryReferenceNumber: c.journalEntry?.referenceNumber ?? null, journalEntryId: c.journalEntryId })));
});
router.get("/asset-exits/:id", can(`${EXITS}.view`), async (req: AuthedRequest, res) => {
  const canAmount = await userHasAction(req.user!.id, `${EXITS}.viewAccounting`);
  const c = await prisma.assetExit.findUnique({
    where: { id: Number(req.params.id) },
    include: {
      type: { select: { id: true, title: true, nature: true } },
      journalEntry: { select: { id: true, referenceNumber: true } },
      items: { include: { asset: { select: { id: true, detailCode: true, title: true } }, group: { select: { id: true, title: true } }, depreciationItems: { select: { amount: true } } }, orderBy: { id: "asc" } },
    },
  });
  if (!c) return res.status(404).json({ error: "سند خروج یافت نشد" });
  res.json({
    id: c.id,
    number: c.number,
    date: c.date,
    typeId: c.typeId,
    typeTitle: c.type.title,
    nature: c.type.nature,
    description: c.description,
    status: c.status,
    updatedAt: c.updatedAt,
    journalEntryId: c.journalEntryId,
    journalEntryReferenceNumber: c.journalEntry?.referenceNumber ?? null,
    items: c.items.map((i) => ({
      id: i.id,
      assetId: i.assetId,
      detailCode: i.asset.detailCode,
      title: i.asset.title,
      groupId: i.groupId,
      groupTitle: i.group.title,
      costAtExit: canAmount && i.costAtExit !== null ? i.costAtExit.toString() : null,
      accumulatedAtExit: canAmount && i.accumulatedAtExit !== null ? i.accumulatedAtExit.toString() : null,
      bookValue: canAmount && i.costAtExit !== null && i.accumulatedAtExit !== null ? i.costAtExit.sub(i.accumulatedAtExit).toString() : null,
      depreciationBeforeExit: canAmount && c.status === "CONFIRMED" ? i.depreciationItems.reduce((s, x) => s + Number(x.amount), 0).toString() : null,
    })),
  });
});
router.post("/asset-exits", can(`${EXITS}.create`), async (req, res) => {
  try {
    res.status(201).json(await saveExit(null, req.body));
  } catch (e) {
    handle(res, e);
  }
});
router.put("/asset-exits/:id", can(`${EXITS}.edit`), async (req, res) => {
  try {
    res.json(await saveExit(Number(req.params.id), req.body));
  } catch (e) {
    handle(res, e);
  }
});
router.delete("/asset-exits/:id", can(`${EXITS}.delete`), async (req, res) => {
  try {
    await deleteExit(Number(req.params.id));
    res.status(204).end();
  } catch (e) {
    handle(res, e);
  }
});
router.post("/asset-exits/:id/confirm", can(`${EXITS}.confirm`), async (req: AuthedRequest, res) => {
  try {
    await confirmExit(Number(req.params.id), req.user?.id ?? null);
    res.json({ ok: true });
  } catch (e) {
    handle(res, e);
  }
});
router.post("/asset-exits/:id/unconfirm", can(`${EXITS}.unconfirm`), async (req, res) => {
  try {
    await unconfirmExit(Number(req.params.id));
    res.json({ ok: true });
  } catch (e) {
    handle(res, e);
  }
});
router.post("/asset-exits/:id/issue-journal-entry", can(`${EXITS}.issueJournalEntry`), async (req, res) => {
  try {
    res.status(201).json(await issueExitEntry(Number(req.params.id)));
  } catch (e) {
    handle(res, e);
  }
});
router.post("/asset-exits/:id/revert-journal-entry", can(`${EXITS}.revertJournalEntry`), async (req, res) => {
  try {
    await revertExitEntry(Number(req.params.id));
    res.json({ ok: true });
  } catch (e) {
    handle(res, e);
  }
});

// ───────────── گزارش مرور گروه دارایی ─────────────
router.get("/asset-group-review", can(`${REVIEW}.view`), async (req, res) => {
  try {
    const groupIds = String(req.query.groupIds ?? "").split(",").map(Number).filter((n) => Number.isFinite(n) && n > 0);
    res.json(await assetGroupReview(String(req.query.fromDate ?? ""), String(req.query.toDate ?? ""), groupIds));
  } catch (e) {
    handle(res, e);
  }
});

// ───────────── درخت موقعیت دارایی ─────────────
router.get("/asset-locations", async (_req, res) => {
  const [nodes, paths] = await Promise.all([prisma.assetLocation.findMany({ orderBy: { code: "asc" } }), locationPaths()]);
  res.json(nodes.map((n) => ({ ...n, path: paths.get(n.id) ?? n.title })));
});
router.post("/asset-locations", can(`${LOCATIONS}.create`), async (req, res) => {
  try {
    res.status(201).json(await saveLocation(null, req.body));
  } catch (e) {
    handle(res, e);
  }
});
router.put("/asset-locations/:id", can(`${LOCATIONS}.edit`), async (req, res) => {
  try {
    res.json(await saveLocation(Number(req.params.id), req.body));
  } catch (e) {
    handle(res, e);
  }
});
router.delete("/asset-locations/:id", can(`${LOCATIONS}.delete`), async (req, res) => {
  try {
    await deleteLocation(Number(req.params.id));
    res.status(204).end();
  } catch (e) {
    handle(res, e);
  }
});

// ───────────── نوع بیمه ─────────────
router.get("/asset-insurance-types", async (_req, res) => res.json(await listInsuranceTypes())); // فهرست پایه (انتخابگر بیمه‌نامه)
router.post("/asset-insurance-types", can(`${INSURANCE_TYPES}.create`), async (req, res) => {
  try {
    res.status(201).json(await saveInsuranceType(null, req.body));
  } catch (e) {
    handle(res, e);
  }
});
router.put("/asset-insurance-types/:id", can(`${INSURANCE_TYPES}.edit`), async (req, res) => {
  try {
    res.json(await saveInsuranceType(Number(req.params.id), req.body));
  } catch (e) {
    handle(res, e);
  }
});
router.delete("/asset-insurance-types/:id", can(`${INSURANCE_TYPES}.delete`), async (req, res) => {
  try {
    await deleteInsuranceType(Number(req.params.id));
    res.status(204).end();
  } catch (e) {
    handle(res, e);
  }
});

// ───────────── حسابهای دارایی ثابت (تاریخ‌دار) ─────────────
router.get("/asset-account-types", (_req, res) => res.json(ASSET_ACCOUNT_TYPES));
router.get("/asset-account-settings", can(`${ACCOUNT_SETTINGS}.view`), async (_req, res) => res.json(await listAccountSettings()));
router.get("/asset-account-settings/bulk/candidates", can(`${ACCOUNT_SETTINGS}.create`), async (req, res) => {
  try {
    res.json(await bulkCandidates({ groupId: Number(req.query.groupId), date: String(req.query.date ?? ""), includeExisting: req.query.includeExisting === "true" }));
  } catch (e) {
    handle(res, e);
  }
});
router.post("/asset-account-settings/bulk", can(`${ACCOUNT_SETTINGS}.create`), async (req, res) => {
  try {
    const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
    res.status(201).json(
      await bulkCreate({
        groupId: Number(req.body.groupId),
        date: String(req.body.date ?? ""),
        rows: rows.map((r: any) => ({ rowKey: String(r.rowKey), accountType: String(r.accountType), insuranceTypeId: r.insuranceTypeId ? Number(r.insuranceTypeId) : null, accountId: r.accountId ? Number(r.accountId) : null })),
      })
    );
  } catch (e) {
    handle(res, e);
  }
});
router.get("/asset-account-settings/:id", can(`${ACCOUNT_SETTINGS}.view`), async (req, res) => {
  const r = await getAccountSetting(Number(req.params.id));
  if (!r) return res.status(404).json({ error: "رکورد یافت نشد" });
  res.json(r);
});
router.post("/asset-account-settings", can(`${ACCOUNT_SETTINGS}.create`), async (req, res) => {
  try {
    res.status(201).json(await saveAccountSetting(null, req.body));
  } catch (e) {
    handle(res, e);
  }
});
router.put("/asset-account-settings/:id", can(`${ACCOUNT_SETTINGS}.edit`), async (req, res) => {
  try {
    res.json(await saveAccountSetting(Number(req.params.id), req.body));
  } catch (e) {
    handle(res, e);
  }
});
router.delete("/asset-account-settings/:id", can(`${ACCOUNT_SETTINGS}.delete`), async (req, res) => {
  try {
    await deleteAccountSetting(Number(req.params.id));
    res.status(204).end();
  } catch (e) {
    handle(res, e);
  }
});

// ───────────── گروه حسابداری دارایی ─────────────
router.get("/asset-groups", async (req, res) => {
  res.json(await prisma.assetGroup.findMany({ where: req.query.activeOnly === "true" ? { isActive: true } : undefined, orderBy: { code: "asc" } }));
});
router.post("/asset-groups", can(`${GROUPS}.create`), async (req, res) => {
  try {
    res.status(201).json(await saveAssetGroup(null, req.body));
  } catch (e) {
    handle(res, e);
  }
});
router.put("/asset-groups/:id", can(`${GROUPS}.edit`), async (req, res) => {
  try {
    res.json(await saveAssetGroup(Number(req.params.id), req.body));
  } catch (e) {
    handle(res, e);
  }
});
router.delete("/asset-groups/:id", can(`${GROUPS}.delete`), async (req, res) => {
  try {
    await prisma.assetGroup.delete({ where: { id: Number(req.params.id) } });
    res.status(204).end();
  } catch (e) {
    handle(res, e);
  }
});

// ───────────── منابع مبنای رسید دارایی ─────────────
// ردیف‌های حواله «دارایی ثابت» که هنوز (کامل) رسید نشده‌اند
router.get("/asset-receipts/pickable-issue-lines", can(`${RECEIPTS}.view`), async (req, res) => {
  const excludeReceiptId = req.query.excludeReceiptId ? Number(req.query.excludeReceiptId) : null;
  const lines = await prisma.inventoryDocumentLine.findMany({
    where: { document: { documentType: "FIXED_ASSET_ISSUE" } },
    include: { document: { select: { number: true, date: true } }, goodsItem: { select: { title: true, fullCode: true } }, unit: { select: { title: true } } },
    orderBy: [{ documentId: "desc" }, { rowOrder: "asc" }],
    take: 2000,
  });
  const used = await prisma.assetReceiptLine.groupBy({
    by: ["sourceInventoryLineId"],
    where: { sourceInventoryLineId: { in: lines.map((l) => l.id) }, ...(excludeReceiptId ? { assetReceiptId: { not: excludeReceiptId } } : {}) },
    _sum: { quantity: true },
  });
  const usedMap = new Map(used.map((u) => [u.sourceInventoryLineId, u._sum.quantity]));
  res.json(
    lines
      .map((l) => ({
        id: l.id,
        documentNumber: l.document.number,
        documentDate: l.document.date,
        goodsItemId: l.goodsItemId,
        goodsItemTitle: l.goodsItem.title,
        goodsItemCode: l.goodsItem.fullCode,
        unitId: l.unitId,
        unitTitle: l.unit.title,
        quantity: l.quantity.toString(),
        remaining: l.quantity.sub(usedMap.get(l.id) ?? 0).toString(),
      }))
      .filter((l) => Number(l.remaining) > 0)
  );
});

// ردیف‌های مجوز تحویل که هنوز (کامل) رسید دارایی نشده‌اند، فقط کالاهای نوع دارایی ثابت
router.get("/asset-receipts/pickable-authorization-lines", can(`${RECEIPTS}.view`), async (req, res) => {
  const excludeReceiptId = req.query.excludeReceiptId ? Number(req.query.excludeReceiptId) : null;
  const lines = await prisma.deliveryAuthorizationLine.findMany({
    where: { goodsItem: { kind: "GOODS" }, deliveryAuthorization: { status: "APPROVED" } },
    include: { deliveryAuthorization: { select: { number: true, date: true } }, goodsItem: { select: { title: true, fullCode: true } }, unit: { select: { title: true } } },
    orderBy: [{ deliveryAuthorizationId: "desc" }, { rowOrder: "asc" }],
    take: 2000,
  });
  const used = await prisma.assetReceiptLine.groupBy({
    by: ["sourceDeliveryAuthorizationLineId"],
    where: { sourceDeliveryAuthorizationLineId: { in: lines.map((l) => l.id) }, ...(excludeReceiptId ? { assetReceiptId: { not: excludeReceiptId } } : {}) },
    _sum: { quantity: true },
  });
  const usedMap = new Map(used.map((u) => [u.sourceDeliveryAuthorizationLineId, u._sum.quantity]));
  res.json(
    lines
      .map((l) => ({
        id: l.id,
        documentNumber: l.deliveryAuthorization.number,
        documentDate: l.deliveryAuthorization.date,
        goodsItemId: l.goodsItemId,
        goodsItemTitle: l.goodsItem.title,
        goodsItemCode: l.goodsItem.fullCode,
        unitId: l.unitId,
        unitTitle: l.unit.title,
        quantity: l.quantity.toString(),
        remaining: l.quantity.sub(usedMap.get(l.id) ?? 0).toString(),
      }))
      .filter((l) => Number(l.remaining) > 0)
  );
});

// ───────────── رسید دارایی ─────────────
router.get("/asset-receipts", can(`${RECEIPTS}.view`), async (req: AuthedRequest, res) => {
  const canAmount = await userHasAction(req.user!.id, RECEIPT_ACCOUNTING);
  const list = await prisma.assetReceipt.findMany({ include: { lines: { select: { id: true, quantity: true } } }, orderBy: { number: "desc" } });
  const amountMap = await getAssetLineAmounts(list.flatMap((r) => r.lines.map((l) => l.id)));
  res.json(
    list.map((r) => ({
      id: r.id,
      number: r.number,
      date: r.date,
      basis: r.basis,
      status: r.status,
      description: r.description,
      lineCount: r.lines.length,
      totalAmount: canAmount && r.status === "FINALIZED" ? r.lines.reduce((s, l) => s + Number(amountMap.get(l.id) ?? 0), 0) : null,
      hasUnknownAmount: canAmount && r.status === "FINALIZED" ? r.lines.some((l) => !amountMap.has(l.id)) : false,
    }))
  );
});

router.get("/asset-receipts/:id", can(`${RECEIPTS}.view`), async (req: AuthedRequest, res) => {
  const r = await prisma.assetReceipt.findUnique({ where: { id: Number(req.params.id) } });
  if (!r) return res.status(404).json({ error: "رسید دارایی یافت نشد" });
  const showAmount = r.status === "FINALIZED" && (await userHasAction(req.user!.id, RECEIPT_ACCOUNTING));
  const lines = (await receiptLinesWithRemaining({ assetReceiptId: r.id })).map((l) => (showAmount ? l : { ...l, amount: null }));
  res.json({ ...r, lines });
});

router.post("/asset-receipts", can(`${RECEIPTS}.create`), async (req, res) => {
  try {
    res.status(201).json(await saveAssetReceipt(null, req.body));
  } catch (e) {
    handle(res, e);
  }
});
router.put("/asset-receipts/:id", can(`${RECEIPTS}.edit`), async (req, res) => {
  try {
    res.json(await saveAssetReceipt(Number(req.params.id), req.body));
  } catch (e) {
    handle(res, e);
  }
});
router.delete("/asset-receipts/:id", can(`${RECEIPTS}.delete`), async (req, res) => {
  try {
    await deleteAssetReceipt(Number(req.params.id));
    res.status(204).end();
  } catch (e) {
    handle(res, e);
  }
});

router.post("/asset-receipts/:id/create-assets", can(`${ASSETS}.create`), async (req, res) => {
  try {
    res.status(201).json(await createAssetsFromReceipt(Number(req.params.id), req.body));
  } catch (e) {
    handle(res, e);
  }
});
router.post("/asset-receipts/:id/confirm", can(`${RECEIPTS}.confirm`), async (req, res) => {
  try {
    await confirmAssetReceipt(Number(req.params.id));
    res.json({ ok: true });
  } catch (e) {
    handle(res, e);
  }
});
router.post("/asset-receipts/:id/unconfirm", can(`${RECEIPTS}.unconfirm`), async (req, res) => {
  try {
    await unconfirmAssetReceipt(Number(req.params.id));
    res.json({ ok: true });
  } catch (e) {
    handle(res, e);
  }
});

// ───────────── تعریف دارایی ─────────────
router.get("/fixed-assets/pickable-receipt-lines", can(`${ASSETS}.view`), async (req: AuthedRequest, res) => {
  const canAmount = await userHasAction(req.user!.id, ASSET_ACCOUNTING);
  const lines = await receiptLinesWithRemaining({});
  res.json(lines.filter((l) => Number(l.remaining) > 0).map((l) => (canAmount ? l : { ...l, amount: null })));
});

async function currentPositions(assetIds: number[]) {
  const rows = await prisma.assetPosition.findMany({
    where: { assetId: { in: assetIds } },
    include: { costCenter: { select: { title: true } }, project: { select: { title: true } } },
    orderBy: { fromDate: "desc" },
  });
  const map = new Map<number, (typeof rows)[number]>();
  for (const r of rows) if (!map.has(r.assetId)) map.set(r.assetId, r);
  return map;
}

router.get("/fixed-assets", can(`${ASSETS}.view`), async (req: AuthedRequest, res) => {
  const canAmount = await userHasAction(req.user!.id, ASSET_ACCOUNTING);
  const paths = await locationPaths();
  const list = await prisma.fixedAsset.findMany({ include: { assetGroup: { select: { title: true } }, acquisitionJournalEntry: { select: { referenceNumber: true } } }, orderBy: { detailCode: "asc" } });
  const pos = await currentPositions(list.map((a) => a.id));
  res.json(
    list.map((a) => {
      const p = pos.get(a.id);
      return {
        id: a.id,
        detailCode: a.detailCode,
        title: a.title,
        assetGroupId: a.assetGroupId,
        assetGroupTitle: a.assetGroup.title,
        cost: canAmount && a.cost !== null ? a.cost.toString() : null,
        confirmed: !!a.confirmedAt,
        journalEntryReferenceNumber: a.acquisitionJournalEntry?.referenceNumber ?? null,
        journalEntryId: a.acquisitionJournalEntryId,
        acquisitionDate: a.acquisitionDate,
        inServiceDate: a.inServiceDate,
        status: a.status,
        costCenterTitle: p?.costCenter.title ?? "",
        projectTitle: p?.project?.title ?? "",
        location: p?.locationId ? paths.get(p.locationId) ?? "" : "",
      };
    })
  );
});

router.get("/fixed-assets/:id/card", can(`${ASSETS}.view`), async (req: AuthedRequest, res) => {
  try {
    const canAmount = await userHasAction(req.user!.id, ASSET_ACCOUNTING);
    res.json(await buildAssetCard(Number(req.params.id), canAmount));
  } catch (e) {
    handle(res, e);
  }
});

router.get("/fixed-assets/:id", can(`${ASSETS}.view`), async (req: AuthedRequest, res) => {
  const canAmount = await userHasAction(req.user!.id, ASSET_ACCOUNTING);
  const a = await prisma.fixedAsset.findUnique({
    where: { id: Number(req.params.id) },
    include: {
      assetGroup: { select: { id: true, title: true } },
      acquisitionJournalEntry: { select: { id: true, referenceNumber: true } },
      components: { include: { receiptLine: { include: { goodsItem: { select: { title: true } }, assetReceipt: { select: { number: true } } } } } },
      positions: { include: { costCenter: { select: { id: true, title: true } }, project: { select: { id: true, title: true } }, location: { select: { id: true, title: true } } }, orderBy: { fromDate: "asc" } },
    },
  });
  if (!a) return res.status(404).json({ error: "دارایی یافت نشد" });
  res.json({
    ...a,
    cost: canAmount && a.cost !== null ? a.cost.toString() : null,
    salvageValue: a.salvageValue === null ? null : a.salvageValue.toString(),
    depreciationRatePercent: a.depreciationRatePercent === null ? null : a.depreciationRatePercent.toString(),
    confirmed: !!a.confirmedAt,
    journalEntryReferenceNumber: a.acquisitionJournalEntry?.referenceNumber ?? null,
    journalEntryId: a.acquisitionJournalEntryId,
    components: a.components.map((c) => ({
      id: c.id,
      receiptNumber: c.receiptLine?.assetReceipt.number ?? null,
      goodsItemTitle: c.receiptLine?.goodsItem.title ?? "(دستی)",
      quantity: c.quantity.toString(),
      amount: canAmount && c.amount !== null ? c.amount.toString() : null,
    })),
  });
});

router.post("/fixed-assets", can(`${ASSETS}.create`), async (req: AuthedRequest, res) => {
  try {
    const allowManual = await userHasAction(req.user!.id, `${ASSETS}.createManual`);
    const created = await defineAssets(req.body, { allowManual });
    res.status(201).json(created);
  } catch (e) {
    handle(res, e);
  }
});
router.post("/fixed-assets/confirm", can(`${ASSETS}.confirm`), async (req: AuthedRequest, res) => {
  try {
    await confirmAssets(req.body.ids ?? [], req.user?.id ?? null);
    res.json({ ok: true });
  } catch (e) {
    handle(res, e);
  }
});
router.post("/fixed-assets/issue-journal-entry", can(`${ASSETS}.issueJournalEntry`), async (req: AuthedRequest, res) => {
  try {
    res.status(201).json(await issueAssetAcquisitionEntry(req.body.ids ?? [], req.body.date, req.user?.id ?? null));
  } catch (e) {
    handle(res, e);
  }
});
router.post("/fixed-assets/revert-journal-entry", can(`${ASSETS}.revertJournalEntry`), async (req, res) => {
  try {
    res.json(await revertAssetAcquisitionEntry(req.body.ids ?? []));
  } catch (e) {
    handle(res, e);
  }
});
router.post("/fixed-assets/unconfirm", can(`${ASSETS}.unconfirm`), async (req, res) => {
  try {
    await unconfirmAssets(req.body.ids ?? []);
    res.json({ ok: true });
  } catch (e) {
    handle(res, e);
  }
});
router.put("/fixed-assets/:id", can(`${ASSETS}.edit`), async (req, res) => {
  try {
    res.json(await updateAsset(Number(req.params.id), req.body));
  } catch (e) {
    handle(res, e);
  }
});
router.delete("/fixed-assets/:id", can(`${ASSETS}.delete`), async (req, res) => {
  try {
    await deleteAsset(Number(req.params.id));
    res.status(204).end();
  } catch (e) {
    handle(res, e);
  }
});

// ───────────── موقعیت ─────────────
router.get("/asset-positions", can(`${POSITIONS}.view`), async (_req, res) => {
  const paths = await locationPaths();
  const list = await prisma.assetPosition.findMany({
    include: { asset: { select: { detailCode: true, title: true } }, costCenter: { select: { title: true } }, project: { select: { title: true } } },
    orderBy: [{ fromDate: "desc" }, { id: "desc" }],
    take: 5000,
  });
  res.json(
    list.map((p) => ({
      id: p.id,
      assetId: p.assetId,
      assetCode: p.asset.detailCode,
      assetTitle: p.asset.title,
      fromDate: p.fromDate,
      costCenterTitle: p.costCenter.title,
      projectTitle: p.project?.title ?? "",
      location: p.locationId ? paths.get(p.locationId) ?? "" : "",
    }))
  );
});
router.post("/asset-positions/bulk", can(`${POSITIONS}.create`), async (req, res) => {
  try {
    await changePositions(req.body);
    res.status(201).json({ ok: true });
  } catch (e) {
    handle(res, e);
  }
});
router.delete("/asset-positions/:id", can(`${POSITIONS}.delete`), async (req, res) => {
  try {
    await deletePosition(Number(req.params.id));
    res.status(204).end();
  } catch (e) {
    handle(res, e);
  }
});

export default router;
