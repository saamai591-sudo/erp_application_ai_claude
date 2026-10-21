import DateObject from "react-date-object";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";
import gregorian from "react-date-object/calendars/gregorian";
import gregorian_en from "react-date-object/locales/gregorian_en";
import { prisma } from "../lib/prisma";
import { jalaliMonthRange } from "../utils/jalaliDate";
import { derivePeriods, loadRecordsMany, periodsOverlap, type Period } from "./employmentStatusService";
import { unicodeToIranSystem, sanitizeForIranSystem } from "./iranSystem";
import { DICT_BY_KEY, usesBranch } from "./fileStructureDictionary";
import { buildDbf, buildZip, evalExpr, parseExpr, type DbfFieldDef } from "../utils/fileFormats";
import type { FieldDef, FileDef, StructureDef } from "../data/fileStructureDefaults";

// تولید فایل‌ها از روی یک «ساختار فایل» برای یک ماه (منبع: فیش‌های حقوق ذخیره‌شده؛ بدون محاسبه‌ی دوباره).
// قواعد: فایل‌های «هر کارمند یک ردیف» اول ساخته می‌شوند و بعد فایل‌های «تک‌ردیفی» (که مجموع و تعداد آن‌ها را می‌گیرند).

export interface GenParams {
  year: number;
  month: number;
  employeeIds?: number[] | null;
  /** فقط کارمندان «مشمول» این سازمان ذینفع (و در صورت پر بودن شعبه، همان شعبه) */
  orgId?: number | null;
  branchId?: number | null;
  params?: Record<string, string>;
}
export interface GenProblem {
  level: "ERROR" | "WARNING";
  message: string;
}
export interface GenFile {
  name: string;
  data: Buffer;
  rows: number;
  header: string[];
  /** چند ردیف اول (متن نمایشی) برای پیش‌نمایش */
  sample: string[][];
}
export interface GenResult {
  files: GenFile[];
  zip: { name: string; data: Buffer } | null;
  problems: GenProblem[];
  employeeCount: number;
}

const J8 = (d: Date) => new DateObject({ date: d, calendar: gregorian, locale: gregorian_en }).convert(persian, persian_fa).format("YYYYMMDD");
const toEn = (s: string) => s.replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x06f0)).replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660));
const jalali8 = (d: Date) => toEn(J8(d));
const norm = (t: string) => t.replace(/ي/g, "ی").replace(/ك/g, "ک").replace(/\s+/g, " ").trim();

interface EmpCtx {
  employeeId: number;
  personnelCode: string;
  hasErrors: boolean;
  dict: Map<string, string>;
  /** مجموع مبلغ هر مرجع: «P:<id>» / «D:<id>» / «N:<calcTypeId>» */
  sums: Map<string, number>;
}

export async function generateFiles(def: StructureDef, gp: GenParams): Promise<GenResult> {
  const problems: GenProblem[] = [];
  const { start: monthStart, end: monthEnd } = jalaliMonthRange(gp.year, gp.month);
  const yyyy = String(gp.year), mm = String(gp.month).padStart(2, "0"), yy = yyyy.slice(-2);
  const expandName = (t: string) => t.replace(/\{YYYY\}/g, yyyy).replace(/\{YY\}/g, yy).replace(/\{MM\}/g, mm);

  // ── کنترل ورودی‌ها ──
  const fieldsAll = def.files.flatMap((f) => f.fields);
  const needsBranch = fieldsAll.some((f) => f.source === "EMPLOYEE_FIELD" && f.systemField && usesBranch(f.systemField));
  let branch: { fileNumber: string; employer: string | null; address: string | null; contractRow: string; organizationId: number } | null = null;
  if (gp.branchId) {
    branch = await prisma.beneficiaryBranch.findUnique({ where: { id: gp.branchId }, select: { fileNumber: true, employer: true, address: true, contractRow: true, organizationId: true } });
    if (!branch) problems.push({ level: "ERROR", message: "شعبه‌ی انتخاب‌شده یافت نشد" });
  } else if (needsBranch) problems.push({ level: "ERROR", message: "این ساختار به اطلاعات شعبه‌ی سازمان نیاز دارد؛ شعبه را انتخاب کنید" });
  const orgId = gp.orgId ?? branch?.organizationId ?? null;

  // ── فیش‌ها و کارمندان ──
  const ids = gp.employeeIds && gp.employeeIds.length ? gp.employeeIds : null;
  let allowed: Set<number> | null = null;
  if (orgId) {
    const inc = await prisma.employeeBeneficiary.findMany({ where: { organizationId: orgId, isIncluded: true, ...(gp.branchId ? { branchId: gp.branchId } : {}), ...(ids ? { employeeId: { in: ids } } : {}) }, select: { employeeId: true } });
    allowed = new Set(inc.map((x) => x.employeeId));
  }
  const slips = await prisma.payrollSlip.findMany({
    where: { year: gp.year, month: gp.month, ...(ids ? { employeeId: { in: ids } } : {}) },
    include: {
      lines: { select: { source: true, refId: true, amount: true, error: true } },
      decree: { select: { employmentType: { select: { title: true } } } },
      calcType: { select: { isBase: true } },
      employee: {
        include: {
          party: { include: { addresses: true } },
          birthPlace: { select: { title: true } },
          issuePlace: { select: { title: true } },
          assignments: { include: { job: { select: { title: true, socialSecurityCode: true } }, position: { select: { title: true } } }, orderBy: { fromDate: "asc" } },
        },
      },
    },
    orderBy: { employee: { personnelCode: "asc" } },
  });
  const byEmp = new Map<number, typeof slips>();
  for (const s of slips) {
    if (allowed && !allowed.has(s.employeeId)) continue;
    if (!byEmp.has(s.employeeId)) byEmp.set(s.employeeId, []);
    byEmp.get(s.employeeId)!.push(s);
  }
  if (ids) for (const id of ids) if (!byEmp.has(id)) problems.push({ level: "WARNING", message: `برای کارمند شناسه ${id} فیش محاسبه‌شده‌ی این ماه (با شرایط انتخاب‌شده) وجود ندارد` });
  if (byEmp.size === 0) {
    problems.push({ level: "ERROR", message: "برای این ماه و شرایط انتخاب‌شده فیش محاسبه‌شده‌ای وجود ندارد" });
    return { files: [], zip: null, problems, employeeCount: 0 };
  }
  const empIds = [...byEmp.keys()];
  const [eduRows, statusMap] = await Promise.all([
    prisma.employeeEducationRecord.findMany({ where: { employeeId: { in: empIds }, effectiveDate: { lte: monthEnd } }, orderBy: { effectiveDate: "desc" }, select: { employeeId: true, educationLevel: { select: { title: true } } } }),
    loadRecordsMany(empIds),
  ]);
  const eduBy = new Map<number, string>();
  for (const e of eduRows) if (!eduBy.has(e.employeeId)) eduBy.set(e.employeeId, e.educationLevel.title);
  const company = await prisma.companyProfile.findUnique({ where: { id: 1 }, select: { name: true } });

  // ── مقدارهای سیستمیِ هر کارمند ──
  const emps: EmpCtx[] = [];
  let rowNo = 0;
  for (const [employeeId, list] of byEmp) {
    rowNo++;
    const e = list[0].employee;
    const p = e.party;
    const dict = new Map<string, string>();
    const set = (k: string, v: string | null | undefined) => dict.set(k, v == null ? "" : String(v));
    const addr = p.addresses.find((a) => a.isPrimary) ?? p.addresses[0];
    const periods: Period[] = derivePeriods(statusMap.get(employeeId) ?? []);
    const period = [...periods].reverse().find((x) => periodsOverlap([x], monthStart, monthEnd)) ?? periods[periods.length - 1];
    const asg = e.assignments.filter((a) => a.fromDate <= monthEnd && (!a.toDate || a.toDate >= monthEnd)).pop() ?? e.assignments[e.assignments.length - 1];
    const decreeEmpType = list.find((s) => s.calcType.isBase)?.decree?.employmentType?.title ?? list.find((s) => s.decree)?.decree?.employmentType?.title;
    set("ROW_NO", String(rowNo));
    set("PERSONNEL_CODE", e.personnelCode);
    set("NATIONAL_ID", p.nationalId);
    set("FIRST_NAME", p.firstName);
    set("LAST_NAME", p.lastName ?? p.name);
    set("FATHER_NAME", e.fatherName);
    set("BIRTH_DATE_J8", p.birthDate ? jalali8(p.birthDate) : "");
    set("BIRTH_CERT_NO", e.birthCertificateNumber);
    set("BIRTH_PLACE", e.birthPlace?.title);
    set("ISSUE_PLACE", e.issuePlace?.title ?? e.birthPlace?.title);
    set("GENDER_TEXT", p.gender === "MALE" ? "مرد" : p.gender === "FEMALE" ? "زن" : "");
    set("NATIONALITY_CODE", p.nationality === "FOREIGN" ? "2" : "1");
    set("NATIONALITY_TITLE", p.nationality === "FOREIGN" ? "خارجی" : "ایرانی");
    set("EDUCATION_TITLE", eduBy.get(employeeId));
    set("INSURANCE_NUMBER", e.insuranceNumber);
    set("ADDRESS", addr?.address);
    set("POSTAL_CODE", addr?.postalCode);
    set("JOB_TITLE", asg?.job?.title ?? asg?.position?.title);
    set("JOB_SS_CODE", asg?.job?.socialSecurityCode);
    set("POSITION_TITLE", asg?.position?.title);
    set("EMPLOYMENT_TYPE_TITLE", decreeEmpType);
    const sd = period?.startDate, ed = period?.endDate;
    set("START_DATE_J8", sd ? jalali8(sd) : "");
    set("END_DATE_J8", ed ? jalali8(ed) : "");
    set("START_DATE_IN_MONTH_J8", sd && sd >= monthStart && sd <= monthEnd ? jalali8(sd) : "");
    set("END_DATE_IN_MONTH_J8", ed && ed >= monthStart && ed <= monthEnd ? jalali8(ed) : "");
    const sums = new Map<string, number>();
    const add = (k: string, v: number) => sums.set(k, (sums.get(k) ?? 0) + v);
    for (const s of list) {
      add(`N:${s.calcTypeId}`, Number(s.netPay));
      for (const l of s.lines) {
        if (l.error || l.refId == null) continue;
        add(`${l.source === "DECREE_COMPONENT" ? "D" : "P"}:${l.refId}`, Number(l.amount));
      }
    }
    emps.push({ employeeId, personnelCode: e.personnelCode, hasErrors: list.some((s) => s.hasErrors), dict, sums });
  }
  for (const e of emps) if (e.hasErrors) problems.push({ level: "WARNING", message: `فیش کارمند ${e.personnelCode} خطا دارد؛ مبلغ‌ها ممکن است ناقص باشند` });

  const globals = new Map<string, string>([
    ["COMPANY_NAME", company?.name ?? ""],
    ["PERIOD_YEAR4", yyyy],
    ["PERIOD_YEAR2", yy],
    ["PERIOD_MONTH", String(gp.month)],
    ["PERIOD_MONTH2", mm],
    ["BRANCH_CODE", branch?.fileNumber ?? ""],
    ["BRANCH_EMPLOYER", branch?.employer ?? ""],
    ["BRANCH_ADDRESS", branch?.address ?? ""],
    ["BRANCH_CONTRACT_ROW", branch?.contractRow ?? ""],
  ]);

  // ── مقدار هر فیلد ──
  const unmapped = new Set<string>();
  const factorSum = (f: FieldDef, e: EmpCtx) => {
    let t = 0;
    for (const id of f.refs?.payroll ?? []) t += e.sums.get(`P:${id}`) ?? 0;
    for (const id of f.refs?.decree ?? []) t += e.sums.get(`D:${id}`) ?? 0;
    for (const id of f.refs?.net ?? []) t += e.sums.get(`N:${id}`) ?? 0;
    return t;
  };
  const numeric = (v: string) => (v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : null);
  const paramValue = (f: FieldDef) => gp.params?.[f.paramKey ?? ""] ?? f.constantValue ?? "";

  interface Cell { raw: string; num: number | null }
  const cellFor = (f: FieldDef, e: EmpCtx | null): Cell => {
    switch (f.source) {
      case "CONSTANT": return { raw: f.constantValue ?? "", num: numeric(f.constantValue ?? "") };
      case "EMPTY": return { raw: "", num: null };
      case "PARAM": { const v = paramValue(f); return { raw: v, num: numeric(v) }; }
      case "FACTOR_SUM": {
        const n = e ? factorSum(f, e) : emps.reduce((a, x) => a + factorSum(f, x), 0);
        return { raw: String(n), num: n };
      }
      case "EMPLOYEE_FIELD": {
        const key = f.systemField ?? "";
        let v = DICT_BY_KEY.get(key)?.scope === "GLOBAL" ? globals.get(key) ?? "" : e?.dict.get(key) ?? "";
        if (f.maps && f.maps.length && v) {
          const hit = f.maps.find((m) => norm(m.sourceValue) === norm(v));
          if (hit) v = hit.targetValue;
          else { unmapped.add(`«${v}» برای «${f.title}» نگاشت ندارد و خالی ماند`); v = ""; }
        }
        return { raw: v, num: numeric(v) };
      }
      default: return { raw: "", num: null };
    }
  };

  const fmtNumber = (n: number, f: FieldDef) => (f.decimals ? n.toFixed(f.decimals) : String(Math.round(n)));
  /** مقدار نهایی به‌صورت متن (قبل از طول/ترازبندی) */
  const textOf = (f: FieldDef, c: Cell, dbf: boolean): string => {
    if (f.dataType === "NUMBER") {
      if (c.num != null) return fmtNumber(c.num, f);
      if (c.raw.trim() !== "") { problems.push({ level: "WARNING", message: `مقدار «${c.raw}» برای فیلد عددی «${f.title}» عدد نیست و صفر شد` }); return "0"; }
      return dbf ? "0" : "";
    }
    return c.raw;
  };

  const rowsOf = new Map<number, { cells: Map<string, Cell>; texts: string[] }[]>();
  const results: GenFile[] = [];
  const ordered = [...def.files].sort((a, b) => (a.rowKind === b.rowKind ? a.seq - b.seq : a.rowKind === "PER_EMPLOYEE" ? -1 : 1));

  const computeRow = (file: FileDef, e: EmpCtx | null, detailRows: Map<number, { cells: Map<string, Cell> }[]>) => {
    const cells = new Map<string, Cell>();
    for (const f of file.fields) {
      if (f.source === "EXPR" || f.source === "AGGREGATE") continue;
      cells.set(f.name, cellFor(f, e));
    }
    for (const f of file.fields) {
      if (f.source !== "AGGREGATE") continue;
      const rows = detailRows.get(f.aggFileSeq ?? -1) ?? [];
      const n = f.aggFunc === "COUNT" ? rows.length : rows.reduce((a, r) => a + (r.cells.get(f.aggFieldName ?? "")?.num ?? 0), 0);
      cells.set(f.name, { raw: String(n), num: n });
    }
    // فرمول‌ها: چند دور تا وابستگی‌های زنجیره‌ای حل شود
    const exprFields = file.fields.filter((f) => f.source === "EXPR");
    for (let pass = 0; pass < Math.max(1, exprFields.length); pass++) {
      for (const f of exprFields) {
        const n = evalExpr(parseExpr(f.exprText ?? "0"), (name) => cells.get(name)?.num ?? 0);
        cells.set(f.name, { raw: String(n), num: n });
      }
    }
    return cells;
  };

  for (const file of ordered) {
    const dbf = file.format === "DBF";
    const rowCells: { cells: Map<string, Cell> }[] = [];
    if (file.rowKind === "PER_EMPLOYEE") for (const e of emps) rowCells.push({ cells: computeRow(file, e, rowsOf as any) });
    else rowCells.push({ cells: computeRow(file, null, rowsOf as any) });
    rowsOf.set(file.seq, rowCells as any);

    // متن نهایی هر سلول
    const overflow = new Set<string>();
    const texts: string[][] = rowCells.map((r) =>
      file.fields.map((f) => {
        let t = textOf(f, r.cells.get(f.name) ?? { raw: "", num: null }, dbf);
        if (f.zeroPad && f.length && t !== "" && t.length < f.length) t = t.padStart(f.length, "0");
        if (!dbf) t = t.replace(/[\r\n]+/g, " ").split(file.delimiter).join(" ");
        if (f.length && t.length > f.length && !dbf) overflow.add(f.name);
        return t;
      })
    );

    let data: Buffer;
    if (dbf) {
      const dbfFields: DbfFieldDef[] = file.fields.map((f) => ({ name: f.name, type: f.dataType === "NUMBER" ? "N" : "C", length: f.length ?? 10, decimals: f.dataType === "NUMBER" ? f.decimals ?? 0 : 0 }));
      const cells = texts.map((row) =>
        row.map((t, i) => {
          const f = file.fields[i], d = dbfFields[i];
          if (d.type === "N") {
            if (t.length > d.length) {
              problems.push({ level: "ERROR", message: `مقدار «${t}» از طول فیلد عددی «${f.name}» (${d.length}) بیشتر است` });
              t = t.slice(-d.length);
            }
            return Buffer.from(t.padStart(d.length, " "), "latin1");
          }
          const b = unicodeToIranSystem(sanitizeForIranSystem(t));
          if (b.length > d.length) overflow.add(f.name);
          const out = Buffer.alloc(d.length, 0x20);
          b.copy(out, 0, 0, Math.min(b.length, d.length));
          return out;
        })
      );
      data = buildDbf(dbfFields, cells);
    } else {
      const eol = file.lineEnding === "CRLF" ? "\r\n" : "\n";
      const body = texts.map((r) => r.join(file.delimiter)).join(eol) + (file.trailingNewline ? eol : "");
      const bom = file.encoding === "UTF8_BOM" ? Buffer.from([0xef, 0xbb, 0xbf]) : Buffer.alloc(0);
      data = Buffer.concat([bom, Buffer.from(body, "utf8")]);
    }
    if (overflow.size) problems.push({ level: "WARNING", message: `فایل «${file.nameTemplate}»: مقدار بعضی فیلدها (${[...overflow].join("، ")}) از طول تعریف‌شده بلندتر است و بریده شد` });
    results.push({ name: expandName(file.nameTemplate), data, rows: texts.length, header: file.fields.map((f) => f.name), sample: texts.slice(0, 15) });
  }
  for (const m of unmapped) problems.push({ level: "WARNING", message: m });

  // به ترتیب تعریف ساختار برگردانده شود
  results.sort((a, b) => def.files.findIndex((f) => expandName(f.nameTemplate) === a.name) - def.files.findIndex((f) => expandName(f.nameTemplate) === b.name));
  const zip = def.zipNameTemplate ? { name: expandName(def.zipNameTemplate), data: buildZip(results.map((r) => ({ name: r.name, data: r.data }))) } : null;
  return { files: results, zip, problems, employeeCount: emps.length };
}
