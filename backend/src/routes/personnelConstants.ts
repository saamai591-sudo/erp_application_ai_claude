import { Response, Router } from "express";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import {
  PersonnelValueError,
  bulkSetValues,
  deleteEmployeeValue,
  listEmployeeValues,
  listParametersOfKind,
  personnelMatrix,
  setEmployeeValue,
  type SetEntry,
} from "../services/personnelValueService";

// مقدارهای ثابت پرسنلی: دو محل ثبت جدا با دسترسی جدا.
//  • «منابع انسانی»: تب «مقادیر ثابت» در فرم کارمند (employees.editHistory-مانند: employees.editPayrollParams) فقط پارامترهای PERSONNEL_HR
//  • «حقوقی»: فرم «مقادیر ثابت پرسنل» (ماتریس کارمند × پارامتر برای یک ماه) فقط پارامترهای PERSONNEL_PAYROLL
// هر محل در سرور فیلتر می‌شود: نوع دیگر نه دیده می‌شود نه قابل ثبت است.

const EMP = findFormPrefix("employees");
const PC = findFormPrefix("personnel-constants");
const router = Router();

function fail(res: Response, e: any) {
  return res.status(400).json({ error: e instanceof PersonnelValueError ? e.message : e?.message || "خطا در ثبت مقدار" });
}
const uid = (req: any): number | null => req.user?.id ?? null;

// ── تب فرم کارمند (نوع منابع انسانی) ──
router.get("/employees/:id/hr-params", can(`${EMP}.view`), async (req, res) => {
  try {
    const id = Number(req.params.id);
    res.json({ parameters: await listParametersOfKind("PERSONNEL_HR"), values: await listEmployeeValues(id, ["PERSONNEL_HR"]) });
  } catch (e) {
    fail(res, e);
  }
});

router.post("/employees/:id/hr-params", can(`${EMP}.editPayrollParams`), async (req, res) => {
  try {
    const b = req.body as any;
    const r = await setEmployeeValue({ employeeId: Number(req.params.id), parameterId: Number(b.parameterId), year: Number(b.year), month: Number(b.month), value: b.value }, ["PERSONNEL_HR"], uid(req));
    res.json(r);
  } catch (e) {
    fail(res, e);
  }
});

router.delete("/employees/hr-params/:valueId", can(`${EMP}.editPayrollParams`), async (req, res) => {
  try {
    await deleteEmployeeValue(Number(req.params.valueId), ["PERSONNEL_HR"]);
    res.status(204).send();
  } catch (e) {
    fail(res, e);
  }
});

// ── فرم «مقادیر ثابت پرسنل» (نوع حقوقی) ──
router.get("/personnel-constants/matrix", can(`${PC}.view`), async (req, res) => {
  try {
    res.json(await personnelMatrix(Number(req.query.year), Number(req.query.month)));
  } catch (e) {
    fail(res, e);
  }
});

router.get("/personnel-constants/history", can(`${PC}.view`), async (req, res) => {
  try {
    res.json(await listEmployeeValues(Number(req.query.employeeId), ["PERSONNEL_PAYROLL"]));
  } catch (e) {
    fail(res, e);
  }
});

/** ثبت گروهی سلول‌های تغییرکرده؛ بدنه: {year, month, entries:[{employeeId, parameterId, value}]} (value=null حذف مقدارِ همین ماه) */
router.put("/personnel-constants/values", can(`${PC}.edit`), async (req, res) => {
  try {
    const b = req.body as any;
    const year = Number(b.year);
    const month = Number(b.month);
    const entries: SetEntry[] = (Array.isArray(b.entries) ? b.entries : []).map((x: any) => ({ employeeId: Number(x.employeeId), parameterId: Number(x.parameterId), year, month, value: x.value === "" ? null : x.value }));
    if (entries.length === 0) throw new PersonnelValueError("موردی برای ثبت وجود ندارد");
    const results = await bulkSetValues(entries, ["PERSONNEL_PAYROLL"], uid(req));
    res.json({ results });
  } catch (e) {
    fail(res, e);
  }
});

router.delete("/personnel-constants/values/:valueId", can(`${PC}.edit`), async (req, res) => {
  try {
    await deleteEmployeeValue(Number(req.params.valueId), ["PERSONNEL_PAYROLL"]);
    res.status(204).send();
  } catch (e) {
    fail(res, e);
  }
});

export default router;
