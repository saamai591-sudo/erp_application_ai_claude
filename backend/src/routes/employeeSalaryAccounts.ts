import { Router } from "express";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { assertRecordNotStale } from "../utils/concurrency";
import {
  SalaryAccountError,
  createSalaryAccount,
  deleteSalaryAccount,
  getSalaryAccount,
  listSalaryAccounts,
  salaryAccountOptions,
  updateSalaryAccount,
} from "../services/employeeSalaryAccountService";

// منابع انسانی › پرسنلی › «حساب دریافت حقوق»: سابقه‌ی تاریخ‌دار (از ماه) حساب بانکی دریافت حقوق هر کارمند به تفکیک نوع پرداخت حقوق.
// همه‌ی قواعد در services/employeeSalaryAccountService.ts است؛ این فایل فقط HTTP است.

const router = Router();
const FORM = findFormPrefix("employee-salary-accounts");

const fail = (res: any, e: any, fallback: string) => {
  if (e instanceof SalaryAccountError) return res.status(400).json({ error: e.message });
  return res.status(400).json({ error: e?.message || fallback });
};

// فهرست؛ employeeId اختیاری (لینک از فرم کارمند)
router.get("/employee-salary-accounts", can(`${FORM}.view`), async (req, res) => {
  const employeeId = req.query.employeeId ? Number(req.query.employeeId) : undefined;
  res.json(await listSalaryAccounts(employeeId));
});

// گزینه‌های فرم: نوع‌های پرداخت «پرسنل» و حساب‌های بانکی شخصِ کارمند
router.get("/employee-salary-accounts/options", can(`${FORM}.view`), async (req, res) => {
  res.json(await salaryAccountOptions(req.query.employeeId ? Number(req.query.employeeId) : undefined));
});

router.get("/employee-salary-accounts/:id", can(`${FORM}.view`), async (req, res) => {
  const r = await getSalaryAccount(Number(req.params.id));
  if (!r) return res.status(404).json({ error: "رکورد حساب دریافت حقوق یافت نشد" });
  res.json(r);
});

router.post("/employee-salary-accounts", can(`${FORM}.create`), async (req, res) => {
  const b = req.body as any;
  try {
    const r = await createSalaryAccount({ employeeId: Number(b.employeeId), paymentTypeId: Number(b.paymentTypeId), year: Number(b.year), month: Number(b.month), bankAccountId: Number(b.bankAccountId), note: b.note });
    res.status(201).json(r);
  } catch (e) {
    fail(res, e, "خطا در ثبت حساب دریافت حقوق");
  }
});

router.put("/employee-salary-accounts/:id", can(`${FORM}.edit`), async (req, res) => {
  const id = Number(req.params.id);
  const b = req.body as any;
  try {
    const existing = await getSalaryAccount(id);
    if (!existing) return res.status(404).json({ error: "رکورد حساب دریافت حقوق یافت نشد" });
    assertRecordNotStale(existing.updatedAt, b.updatedAt, "این رکورد");
    await updateSalaryAccount(id, { employeeId: existing.employeeId, paymentTypeId: Number(b.paymentTypeId), year: Number(b.year), month: Number(b.month), bankAccountId: Number(b.bankAccountId), note: b.note });
    res.json({ ok: true });
  } catch (e) {
    fail(res, e, "خطا در ویرایش حساب دریافت حقوق");
  }
});

router.delete("/employee-salary-accounts/:id", can(`${FORM}.delete`), async (req, res) => {
  try {
    await deleteSalaryAccount(Number(req.params.id));
    res.status(204).send();
  } catch (e) {
    fail(res, e, "خطا در حذف حساب دریافت حقوق");
  }
});

export default router;
