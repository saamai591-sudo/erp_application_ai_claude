import { Router } from "express";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { computeAccountBalance, listEntriesForPicker, listAccountsForPicker, BalanceInput } from "../services/accountBalanceService";
import { printAccountBalance } from "../services/accountBalancePrint";

const FORM = findFormPrefix("account-balance");
const router = Router();

function parseBody(b: any): BalanceInput {
  return {
    fromDate: String(b.fromDate ?? ""),
    toDate: String(b.toDate ?? ""),
    kind: b.kind === "ANALYTIC" ? "ANALYTIC" : "TRIAL",
    levelOrder: b.levelOrder ? Number(b.levelOrder) : undefined,
    dims: Array.isArray(b.dims) ? b.dims.map(String) : [],
    documentTypeIds: Array.isArray(b.documentTypeIds) ? b.documentTypeIds.map(Number).filter(Number.isFinite) : [],
    docMode: b.docMode === "INCLUDE" || b.docMode === "EXCLUDE" ? b.docMode : "ALL",
    entryIds: Array.isArray(b.entryIds) ? b.entryIds.map(Number).filter(Number.isFinite) : [],
    accountMode: b.accountMode === "INCLUDE" || b.accountMode === "EXCLUDE" ? b.accountMode : "ALL",
    accountIds: Array.isArray(b.accountIds) ? b.accountIds.map(Number).filter(Number.isFinite) : [],
    onlyWithBalance: b.onlyWithBalance === true,
  };
}

// محاسبه‌ی گزارش (POST تا فهرست اسناد انتخابی در URL نیاید)
router.post("/", can(`${FORM}.view`), async (req, res) => {
  try {
    res.json(await computeAccountBalance(parseBody(req.body)));
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.post("/print", can(`${FORM}.view`), async (req, res) => {
  try {
    const columns = [2, 4, 6].includes(Number(req.body.columns)) ? (Number(req.body.columns) as 2 | 4 | 6) : 6;
    res.json(await printAccountBalance({ ...parseBody(req.body), columns, digits: req.body.digits === "LATIN" ? "LATIN" : "PERSIAN" }));
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.get("/accounts", can(`${FORM}.view`), async (_req, res) => {
  res.json(await listAccountsForPicker());
});

// اسناد دوره مالی جاری برای گرید انتخاب سند
router.get("/entries", can(`${FORM}.view`), async (req, res) => {
  const ids = String(req.query.documentTypeIds ?? "").split(",").map(Number).filter(Number.isFinite);
  res.json(await listEntriesForPicker({ fromDate: req.query.fromDate as string, toDate: req.query.toDate as string, documentTypeIds: ids.length ? ids : undefined }));
});

export default router;
