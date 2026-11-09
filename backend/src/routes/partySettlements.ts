import { Router } from "express";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { prisma } from "../lib/prisma";
import { registerTreasuryAccountingRoutes } from "../services/treasuryDocAccountingActions";
import { candidatesForBasisType as receiptBasisCandidates } from "./receipts";
import { pickableBasisDocuments } from "../services/paymentBasisCandidates";
import {
  listPartySettlements,
  getPartySettlement,
  savePartySettlement,
  deletePartySettlement,
  accountingApprovePartySettlement,
  setPartySettlementUnapproved,
  countPartySettlementAccountingLines,
  deletePartySettlementAccountingLines,
  PARTY_SETTLEMENT_JE_LOCK_MESSAGE,
  getPartySettlementAccountingView,
  savePartySettlementAccountingDetails,
  issuePartySettlementJournal,
  revertPartySettlementJournal,
  SettlementSide,
} from "../services/partySettlementService";

// «اعلامیه بدهکار بستانکار» (مدیریت خزانه › دریافت): تسویه بین طرف‌حساب‌ها بدون ابزار. تمام قواعد در services/partySettlementService.ts.
const FORM = findFormPrefix("party-settlements");
const router = Router();

const fail = (res: any, e: any, fallback: string) => {
  if (e?.code === "P2002") return res.status(400).json({ error: "شماره اعلامیه تکراری است؛ دوباره ذخیره کنید" });
  return res.status(400).json({ error: e?.message || fallback });
};
const sideOf = (req: any): SettlementSide => (String(req.query.side).toUpperCase() === "PAYMENT" ? "PAYMENT" : "RECEIPT");

// انتخابگر سند مبنای ردیف‌های دریافت/پرداخت — همان منطق مانده‌ی دریافت/پرداخت، با مجوز همین فرم (excludeSettlementId = ردیف‌های خودِ اعلامیه در حال ویرایش از مانده کم نمی‌شود)
router.get("/party-settlements/pickable-receipt-basis", can(`${FORM}.view`), async (req, res) => {
  try {
    const basisType = req.query.basisType as any;
    const partyId = req.query.partyId ? Number(req.query.partyId) : null;
    if (!basisType || basisType === "NONE" || !partyId) return res.json([]);
    const excludeSettlementId = req.query.excludeSettlementId ? Number(req.query.excludeSettlementId) : undefined;
    const nature = req.query.nature ? String(req.query.nature) : undefined;
    const date = req.query.date ? new Date(req.query.date as string) : null;
    const candidates = await receiptBasisCandidates(basisType, partyId, undefined, nature, undefined, excludeSettlementId);
    res.json(candidates.filter((c) => c.remaining > 0.001 && (!date || c.date.getTime() <= date.getTime())));
  } catch (e) {
    fail(res, e, "خطا");
  }
});

router.get("/party-settlements/pickable-payment-basis", can(`${FORM}.view`), async (req, res) => {
  try {
    res.json(
      await pickableBasisDocuments({
        basisType: req.query.basisType as any,
        partyId: req.query.partyId ? Number(req.query.partyId) : null,
        paymentTypeId: req.query.paymentTypeId ? Number(req.query.paymentTypeId) : null,
        excludeSettlementId: req.query.excludeSettlementId ? Number(req.query.excludeSettlementId) : undefined,
        date: req.query.date ? new Date(req.query.date as string) : null,
      })
    );
  } catch (e) {
    fail(res, e, "خطا");
  }
});

router.get("/party-settlements", can(`${FORM}.view`), async (_req, res) => res.json(await listPartySettlements()));

router.get("/party-settlements/:id", can(`${FORM}.view`), async (req, res) => {
  try {
    res.json(await getPartySettlement(Number(req.params.id)));
  } catch (e: any) {
    res.status(404).json({ error: e.message || "اعلامیه یافت نشد" });
  }
});

router.post("/party-settlements", can(`${FORM}.create`), async (req: any, res) => {
  try {
    const id = await savePartySettlement(req.body, req.user?.id ?? null);
    res.status(201).json({ id });
  } catch (e) {
    fail(res, e, "خطا در ذخیره");
  }
});

router.put("/party-settlements/:id", can(`${FORM}.edit`), async (req: any, res) => {
  try {
    const id = await savePartySettlement(req.body, req.user?.id ?? null, Number(req.params.id));
    res.json({ id });
  } catch (e) {
    fail(res, e, "خطا در ذخیره");
  }
});

router.delete("/party-settlements/:id", can(`${FORM}.delete`), async (req, res) => {
  try {
    await deletePartySettlement(Number(req.params.id));
    res.status(204).send();
  } catch (e) {
    fail(res, e, "خطا در حذف");
  }
});

// مسیرهای مشترک «تایید حسابداری» و سند حسابداری (services/treasuryDocAccountingActions.ts؛ مشترک با دریافت، پرداخت و تضمین‌ها)
// اطلاعات حسابداری هر دو طرف: ?side=RECEIPT|PAYMENT (پنل مشترک TreasuryAccountingPanel دو بار با side متفاوت نمایش داده می‌شود)
registerTreasuryAccountingRoutes(router, {
  basePath: "/party-settlements",
  form: FORM,
  adapter: {
    label: "اعلامیه",
    jeLockMessage: PARTY_SETTLEMENT_JE_LOCK_MESSAGE,
    requireEffective: false,
    load: (id) => prisma.partySettlement.findUnique({ where: { id }, select: { accountingStatus: true, journalEntryId: true } }),
    approve: (id, userId) => accountingApprovePartySettlement(id, userId),
    setUnapproved: (id) => setPartySettlementUnapproved(id),
    view: (id, req) => getPartySettlementAccountingView(id, sideOf(req)),
    saveDetails: (id, rows, req) => savePartySettlementAccountingDetails(id, sideOf(req), rows),
    countLines: (id) => countPartySettlementAccountingLines(id),
    deleteLines: (id) => deletePartySettlementAccountingLines(id),
    issue: (id) => issuePartySettlementJournal(id) as any,
    revert: (id) => revertPartySettlementJournal(id),
  },
});

export default router;
