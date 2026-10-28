import { prisma } from "../lib/prisma";
import { AttendanceError, dayStr } from "./attendancePunchService";
import { formulaUsers } from "./attendanceFormulaUsage";
import { buildWorksheet } from "./attendanceWorksheetService";
import { getParameterValue } from "./payrollParameterService";
import { evaluate, evaluateCondition, parseCondition, parseFormula, collectRefs, collectCondRefs, FormulaError, type Cond, type EvalEnv, type Node, type Ns, type RefInfo } from "./payrollFormula";
import { bandOverlap, effectiveBands, type EffectiveBand } from "./attendanceTimeBandService";
import { leaveForDay, leaveValuesByRequestType, loadApprovedLeave, type DayLeave } from "./attendanceLeaveService";
import { hourlyMissionMinutesByType, loadMissions, loadSettlements, missionForDay, type DayMission, type DaySettlement } from "./attendanceMissionCalc";
import { missionTypeKey } from "./attendanceMissionTypeService";
import { leaveRequestKey, requestTypeKey } from "./attendanceRequestTypeService";
import { BAND_KEY_RE } from "./attendanceFormulaDefs";
import { AGG_HINTS, ATT_BASE_HINTS, ATT_GROUP_HINTS, DAY_VAR_HINTS } from "./attendanceFormulaHints";
import { AGG_VARIANTS, ALLOWED_NS, ATT_BASE_INFO, ATT_LEVEL_FA, ATT_VALUE_TYPE_FA, DAY_VARS, PALETTE_HIDDEN_DAY_VARS, type AttLevel, type AttValueType } from "./attendanceFormulaDefs";

// مدیریت تردد › عوامل و فرمول. تنها محل قواعد: تعریف عامل (روزانه/ماهانه)، روش‌های تاریخ‌دار (ماه اجرا از «تقویم کاری») با شاخه‌های شرط ← فرمول، اعتبارسنجی (نام‌فضاهای مجاز هر سطح،
// وجود عامل‌های ارجاع‌شده، ارجاع دوری) و محاسبه‌ی نتایج یک ماه تقویم کاری. نتایج ذخیره نمی‌شوند (مشتق از کارکرد روزانه‌اند؛ ذخیره با «بستن ماه تردد» می‌آید).
// عامل روزانه: برای هر روزِ هر کارمند از متغیرهای [V:…] همان روز، عوامل روزانه‌ی دیگر [F:…]، پارامترها و اطلاعات پایه.
// عامل ماهانه: از تجمیع عوامل روزانه [A:…:SUM|MAX|DAYS]، تجمیع متغیرهای روز [T:…:SUM|MAX|DAYS] و عوامل ماهانه‌ی دیگر [M:…].
// همه‌ی زمان‌ها دقیقه‌اند. روزی که بازه‌ی ناقص (تعداد فردِ تردد) دارد محاسبه می‌شود ولی «ناقص» علامت می‌خورد و از متغیرهایش فقط بازه‌های کامل می‌آید.

const DAY_MS = 86400000;

export const levelOf = (v: unknown): AttLevel => {
  if (v !== "DAY" && v !== "MONTH") throw new AttendanceError("سطح عامل را انتخاب کنید (روزانه یا ماهانه)");
  return v;
};
const valueTypeOf = (v: unknown): AttValueType => {
  if (v === undefined || v === null || v === "") return "TIME";
  if (v !== "NUMBER" && v !== "TIME" && v !== "DAYS") throw new AttendanceError("نوع مقدار نامعتبر است");
  return v;
};

export interface BranchInput {
  conditionText: string;
  formulaText: string;
}

// ───────────────────────── تعریف عامل ─────────────────────────

export function factorShape(f: any) {
  return {
    id: f.id,
    title: f.title,
    level: f.level as AttLevel,
    levelTitle: ATT_LEVEL_FA[f.level as AttLevel],
    valueType: f.valueType as AttValueType,
    valueTypeTitle: ATT_VALUE_TYPE_FA[f.valueType as AttValueType],
    isActive: f.isActive,
    showInWorksheet: !!f.showInWorksheet,
    source: (f.source ?? "COMPUTED") as "COMPUTED" | "PERMIT",
    sourceTitle: f.source === "PERMIT" ? "مجوز" : "محاسباتی",
    description: f.description ?? "",
    methodCount: f._count?.methods,
    updatedAt: f.updatedAt,
  };
}

/** عامل‌هایی که متنِ یکی از شاخه‌های روش‌هایشان به این عامل ارجاع می‌دهد */
export async function factorsReferencing(key: string): Promise<string[]> {
  const re = new RegExp(`\\[(F|A|M):${key}(:[A-Za-z_]+)?\\]`, "i");
  return formulaUsers(re, key);
}

export async function saveFactor(body: any, id?: number) {
  const title = String(body?.title ?? "").trim().replace(/\s+/g, " ");
  if (!title) throw new AttendanceError("عنوان عامل الزامی است");
  const valueType = valueTypeOf(body?.valueType);
  const data = { title, valueType, isActive: body?.isActive !== false, showInWorksheet: body?.showInWorksheet === true, description: String(body?.description ?? "").trim() || null };
  if (!id) {
    const level = levelOf(body?.level);
    const source = body?.source === "PERMIT" ? "PERMIT" : "COMPUTED";
    return prisma.$transaction(async (tx) => {
      const f = await tx.attendanceFactor.create({ data: { ...data, source, showInWorksheet: data.showInWorksheet && level === "DAY", level, key: `TMP${Date.now()}${Math.floor(Math.random() * 1000)}` } });
      return tx.attendanceFactor.update({ where: { id: f.id }, data: { key: `AF${f.id}` } });
    });
  }
  const ex = await prisma.attendanceFactor.findUnique({ where: { id }, include: { _count: { select: { methods: true } } } });
  if (!ex) throw new AttendanceError("عامل یافت نشد");
  if (body?.source && body.source !== ex.source) throw new AttendanceError("منبع عامل (محاسباتی / مجوز) بعد از ثبت قابل تغییر نیست");
  const level = body?.level ? levelOf(body.level) : ex.level;
  const storedItems = await prisma.attendanceCalculationItem.count({ where: { factorId: id } });
  if (storedItems > 0 && (level !== ex.level || data.valueType !== ex.valueType)) throw new AttendanceError(`نتیجه‌ی این عامل در ${storedItems} محاسبه‌ی تردد ذخیره شده است؛ سطح و نوع مقدارش قابل تغییر نیست (ابتدا محاسبه‌ها را حذف کنید)`);
  const permitValues = ex.source === "PERMIT" ? await prisma.attendancePermitValue.count({ where: { factorId: id } }) : 0;
  if (permitValues > 0 && (level !== ex.level || data.valueType !== ex.valueType)) throw new AttendanceError(`این عامل مجوز ${permitValues} مقدار ثبت‌شده دارد؛ سطح و نوع مقدارش قابل تغییر نیست`);
  if (level !== ex.level) {
    if (ex._count.methods > 0) throw new AttendanceError("سطح عاملی که روش محاسبه دارد قابل تغییر نیست؛ ابتدا روش‌هایش را حذف کنید");
    const by = await factorsReferencing(ex.key);
    if (by.length) throw new AttendanceError(`سطح عاملی که در فرمول عامل دیگر استفاده شده قابل تغییر نیست (${by.slice(0, 5).join("، ")})`);
  }
  if (data.valueType !== ex.valueType && ex._count.methods > 0) {
    const by = await factorsReferencing(ex.key);
    if (by.length) throw new AttendanceError(`نوع مقدارِ عاملی که در فرمول عامل دیگر استفاده شده قابل تغییر نیست (${by.slice(0, 5).join("، ")})`);
  }
  return prisma.attendanceFactor.update({ where: { id }, data: { ...data, showInWorksheet: data.showInWorksheet && level === "DAY", level } });
}

export async function deleteFactor(id: number) {
  const f = await prisma.attendanceFactor.findUnique({ where: { id } });
  if (!f) throw new AttendanceError("عامل یافت نشد");
  const storedItems = await prisma.attendanceCalculationItem.count({ where: { factorId: id } });
  if (storedItems > 0) throw new AttendanceError(`نتیجه‌ی این عامل در ${storedItems} محاسبه‌ی تردد ذخیره شده است و حذف نمی‌شود؛ می‌توانید آن را غیرفعال کنید`);
  const permitValues = await prisma.attendancePermitValue.count({ where: { factorId: id } });
  if (permitValues > 0) throw new AttendanceError(`این عامل مجوز ${permitValues} مقدار ثبت‌شده دارد و حذف نمی‌شود؛ ابتدا مقدارها را در «مجوزها» حذف کنید`);
  const by = await factorsReferencing(f.key);
  if (by.length) throw new AttendanceError(`این عامل در فرمول عامل‌های دیگر استفاده شده است و حذف نمی‌شود: ${by.slice(0, 5).join("، ")}${by.length > 5 ? " …" : ""}`);
  await prisma.attendanceFactor.delete({ where: { id } });
}

// ───────────────────────── اعتبارسنجی فرمول ─────────────────────────

export function cleanBranches(raw: unknown): BranchInput[] {
  if (!Array.isArray(raw)) throw new AttendanceError("شاخه‌های روش نامعتبر است");
  const out: BranchInput[] = [];
  for (const b of raw) {
    const conditionText = String(b?.conditionText ?? "").trim();
    const formulaText = String(b?.formulaText ?? "").trim();
    if (!conditionText && !formulaText) continue;
    out.push({ conditionText, formulaText });
  }
  if (out.length === 0) throw new AttendanceError("حداقل یک فرمول لازم است");
  return out;
}

interface Parsed {
  cond: Cond | null;
  formula: Node;
  refs: RefInfo[];
}
function parseBranch(b: BranchInput, i: number, multi: boolean): Parsed {
  const tag = multi ? `شاخه‌ی ${i + 1}: ` : "";
  try {
    if (!b.formulaText) throw new FormulaError("فرمول خالی است");
    const cond = b.conditionText ? parseCondition(b.conditionText, "ATTENDANCE") : null;
    const formula = parseFormula(b.formulaText, "ATTENDANCE");
    return { cond, formula, refs: [...(cond ? collectCondRefs(cond) : []), ...collectRefs(formula)] };
  } catch (e: any) {
    throw new AttendanceError(tag + (e instanceof FormulaError ? e.message : e?.message || "فرمول نامعتبر است"));
  }
}

/** وابستگی‌های «همین ماه/روز» بین عامل‌ها: روزانه‌ها با [F]، ماهانه‌ها با [M] (ارجاع [A] به عامل روزانه است و حلقه نمی‌سازد) */
function sameLevelDeps(refs: RefInfo[], level: AttLevel): string[] {
  return refs.filter((r) => r.ns === (level === "DAY" ? "F" : "M")).map((r) => r.key);
}

/** حلقه‌یابی روی گراف عامل‌ها (همه‌ی روش‌های ذخیره‌شده + شاخه‌های در دست ذخیره). برمی‌گرداند مسیر حلقه (کلیدها) یا null */
function findCycle(graph: Map<string, Set<string>>, start: string): string[] | null {
  const path: string[] = [];
  const onPath = new Set<string>();
  const done = new Set<string>();
  const dfs = (n: string): string[] | null => {
    if (onPath.has(n)) return [...path.slice(path.indexOf(n)), n];
    if (done.has(n)) return null;
    onPath.add(n);
    path.push(n);
    for (const m of graph.get(n) ?? []) {
      const c = dfs(m);
      if (c) return c;
    }
    path.pop();
    onPath.delete(n);
    done.add(n);
    return null;
  };
  return dfs(start);
}

/** بررسی کامل شاخه‌های روشِ یک عامل (ساختار، نام‌فضای مجاز سطح، وجود عامل‌های ارجاع‌شده، حلقه) */
export async function validateBranches(factor: { id: number | null; key: string; level: AttLevel }, branches: BranchInput[]) {
  const multi = branches.length > 1;
  branches.forEach((b, i) => {
    if (!b.conditionText && i !== branches.length - 1) throw new AttendanceError(`شاخه‌ی ${i + 1}: شاخه‌ی بدون شرط فقط می‌تواند آخرین شاخه باشد`);
  });
  const parsed = branches.map((b, i) => parseBranch(b, i, multi));
  const all = await prisma.attendanceFactor.findMany({ include: { methods: { include: { branches: true } } } });
  const byKey = new Map(all.map((f) => [f.key, f]));
  const bandRows: { key: string; title: string; isActive: boolean; monthOnly?: boolean }[] = [
    ...(await prisma.attendanceTimeBand.findMany({ select: { key: true, title: true, isActive: true } })),
    ...(await prisma.attendanceLeaveType.findMany({ select: { key: true, title: true, isActive: true } })),
    ...(await prisma.attendanceMissionType.findMany({ select: { id: true, title: true, isActive: true } })).map((t) => ({ key: missionTypeKey(t.id), title: t.title, isActive: t.isActive, monthOnly: true })),
    // مقدارِ گزارش و ماموریتِ روزانه در روز پایان ماموریت می‌نشیند، پس فقط در عامل ماهانه معنا دارد
    ...(await prisma.attendanceRequestType.findMany({ select: { id: true, title: true, nature: true, unit: true, isActive: true } })).map((t) => ({ key: t.nature === "LEAVE" ? leaveRequestKey(t.id) : requestTypeKey(t.id), title: t.title, isActive: t.isActive, monthOnly: t.nature === "MISSION" && t.unit === "DAILY" })),
  ];
  const myRefs: RefInfo[] = [];
  parsed.forEach((p, i) => {
    const tag = multi ? `شاخه‌ی ${i + 1}: ` : "";
    for (const r of p.refs) {
      if (!ALLOWED_NS[factor.level].includes(r.ns)) {
        throw new AttendanceError(`${tag}در عامل ${ATT_LEVEL_FA[factor.level]} استفاده از «${nsTitle(r.ns)}» مجاز نیست`);
      }
      if (r.ns === "F" || r.ns === "A" || r.ns === "M") {
        const t = byKey.get(r.key);
        if (!t) throw new AttendanceError(`${tag}عامل ارجاع‌شده یافت نشد`);
        if (r.key === factor.key) throw new AttendanceError(`${tag}یک عامل نمی‌تواند به خودش ارجاع بدهد`);
        const want: AttLevel = r.ns === "M" ? "MONTH" : "DAY";
        if (t.level !== want) throw new AttendanceError(`${tag}عامل «${t.title}» ${ATT_LEVEL_FA[t.level as AttLevel]} است و در این جای فرمول مجاز نیست`);
        if (!t.isActive) throw new AttendanceError(`${tag}عامل «${t.title}» غیرفعال است`);
      }
      if ((r.ns === "V" || r.ns === "T") && BAND_KEY_RE.test(r.key)) {
        const bd = bandRows.find((x) => x.key === r.key);
        const what = r.key.startsWith("LV") ? "نوع مرخصی" : r.key.startsWith("MT") ? "نوع ماموریت" : r.key.startsWith("RQ") || r.key.startsWith("RL") ? "نوع درخواست" : "بازه‌ی زمانی";
        if (!bd) throw new AttendanceError(`${tag}${what}ِ ارجاع‌شده یافت نشد`);
        if (!bd.isActive) throw new AttendanceError(`${tag}${what} «${bd.title}» غیرفعال است`);
        if (r.ns === "V" && bd.monthOnly) throw new AttendanceError(`${tag}«${bd.title}» (ماموریت روزانه / گزارش ماموریت) فقط در عامل ماهانه قابل استفاده است؛ مقدارش در روز پایان ماموریت می‌نشیند`);
      }
      if (r.ns === "P") {
        // پارامتر مبنا: مقدار ثابتِ عددی/مبلغی (نه جدول پلکانی/مبنا/پرسنلی)
      }
    }
    myRefs.push(...p.refs);
  });
  // حلقه
  const graph = new Map<string, Set<string>>();
  for (const f of all) {
    const set = new Set<string>();
    for (const m of f.methods) for (const b of m.branches) {
      try {
        const pb = parseBranch({ conditionText: b.conditionText ?? "", formulaText: b.formulaText }, 0, false);
        sameLevelDeps(pb.refs, f.level as AttLevel).forEach((k) => set.add(k));
      } catch {
        /* روش قدیمیِ نامعتبر در بررسی حلقه نادیده گرفته می‌شود */
      }
    }
    graph.set(f.key, set);
  }
  graph.set(factor.key, new Set(sameLevelDeps(myRefs, factor.level)));
  const cyc = findCycle(graph, factor.key);
  if (cyc) {
    const titleOf = (k: string) => (k === factor.key && !byKey.has(k) ? "این عامل" : byKey.get(k)?.title ?? k);
    throw new AttendanceError(`ارجاع دوری بین عامل‌ها: ${cyc.map(titleOf).join(" ← ")}`);
  }
}

const nsTitle = (ns: Ns) =>
  ns === "V" ? "متغیر روز" : ns === "F" ? "عامل روزانه" : ns === "A" ? "تجمیع عامل روزانه" : ns === "T" ? "تجمیع متغیر روز" : ns === "M" ? "عامل ماهانه" : ns === "P" ? "پارامتر" : "اطلاعات پایه";

// ───────────────────────── پالت فرمول‌ساز ─────────────────────────

export async function palette(level: AttLevel, factorId?: number) {
  const [factors, params, bandRows, leaveRows, missionRows, requestRows] = await Promise.all([
    prisma.attendanceFactor.findMany({ where: { isActive: true }, orderBy: { id: "asc" } }),
    prisma.payrollParameter.findMany({ where: { isActive: true, kind: "CONSTANT", type: { in: ["NUMBER", "AMOUNT"] } }, orderBy: { id: "asc" } }),
    prisma.attendanceTimeBand.findMany({ where: { isActive: true }, orderBy: { id: "asc" } }),
    prisma.attendanceLeaveType.findMany({ where: { isActive: true }, orderBy: { id: "asc" } }),
    prisma.attendanceMissionType.findMany({ where: { isActive: true }, orderBy: { id: "asc" }, include: { requestType: { select: { title: true } } } }),
    prisma.attendanceRequestType.findMany({ where: { isActive: true }, orderBy: { id: "asc" }, include: { leaveType: { select: { unit: true } } } }),
  ]);
  // طبقه‌ی «درخواست» (مرخصی و ماموریت به تفکیک نوع درخواست) و «گزارش» (نوع‌های ماموریت): چهار ستون دسته ← گروه ← نوع ← مقدار.
  // در عامل روزانه فقط درخواست مرخصی و ماموریتِ ساعتی می‌آید؛ ماموریت روزانه و گزارش مقدارشان در روز پایان می‌نشیند و فقط در عامل ماهانه (مجموع ماه) هستند.
  const leaveReq = requestRows.filter((t) => t.nature === "LEAVE");
  const missionReq = requestRows.filter((t) => t.nature === "MISSION");
  const leaveType3 = (t: (typeof leaveReq)[number]) => {
    const days = t.leaveType?.unit === "DAY";
    return {
      key: leaveRequestKey(t.id),
      title: t.title,
      hint: [t.description, `نوع مرخصی: ${days ? "روز" : "روز و ساعت"}؛ مقدار به ${days ? "روز" : "دقیقه"} است.`].filter(Boolean).join(" — "),
      values: [{ key: leaveRequestKey(t.id), title: days ? "مدت مرخصی (روز)" : "مدت مرخصی (دقیقه)", hint: days ? "هر روز کاریِ پوشش‌داده‌شده با درخواست تاییدشده‌ی این نوع ۱ است (روز تعطیل فقط وقتی نوع مرخصی «روز تعطیل جزو مرخصی» باشد)." : "دقیقه‌ی مرخصیِ تاییدشده‌ی این نوع درخواست: روزانه = ساعت مرخصیِ روز شیفت، ساعتی = هم‌پوشانی با بازه‌های کاری (روز تعطیل فقط وقتی نوع مرخصی «روز تعطیل جزو مرخصی» باشد)." }],
    };
  };
  const missionType3 = (t: (typeof missionReq)[number]) => {
    const hourly = t.unit === "HOURLY";
    return {
      key: requestTypeKey(t.id),
      title: t.title,
      hint: [t.description, hourly ? "نوع درخواست ساعتی؛ مقدار به دقیقه است." : "نوع درخواست روزانه؛ مقدار به روز است و در روز پایان ماموریت می‌نشیند."].filter(Boolean).join(" — "),
      values: [{ key: requestTypeKey(t.id), title: hourly ? "مدت ماموریت (دقیقه)" : "طول درخواست (روز)", hint: hourly ? "دقیقه‌ی ماموریتِ ساعتیِ تاییدشده‌ی همین روز که با بازه‌های کاری هم‌پوشانی دارد." : "کل روزهای تقویمیِ درخواست‌های روزانه‌ی تاییدشده و پایان‌یافته‌ی این نوع؛ در روز پایان ماموریت می‌نشیند (فقط در عامل ماهانه)." }],
    };
  };
  const requestsNested = (forMonth: boolean) => [
    { key: "LEAVE", title: "درخواست مرخصی", types: leaveReq.map(leaveType3) },
    { key: "MISSION", title: "درخواست ماموریت", types: missionReq.filter((t) => forMonth || t.unit === "HOURLY").map(missionType3) },
  ];
  const reportsNested = [
    {
      key: "MISSION",
      title: "ماموریت",
      types: missionRows.map((t) => ({
        key: missionTypeKey(t.id),
        title: t.title,
        hint: [t.description, `نوع درخواست: ${t.requestType.title}`].filter(Boolean).join(" — "),
        values: [{ key: missionTypeKey(t.id), title: "طول گزارش (روز)", hint: "روزهای گزارش‌های تاییدشده‌ی این نوع ماموریت؛ در روز پایان ماموریت می‌نشیند." }],
      })),
    },
  ];
  const hasTypes = (n: { types: unknown[] }[]) => n.some((x) => x.types.length > 0);
  // متغیرهای عمومی/قدیمیِ مرخصی و ماموریت از پالت رفته‌اند ولی در فرمول‌های موجود کار می‌کنند؛ فقط برای نمایش عنوان چیپ‌ها برمی‌گردند
  const legacy = [...PALETTE_HIDDEN_DAY_VARS.map((k) => ({ key: k, title: DAY_VARS[k] })), ...leaveRows.map((t) => ({ key: t.key, title: `مرخصی ${t.title}` }))];
  const bandItems = bandRows.map((b) => ({ key: b.key, title: `حضور در ${b.title}`, hint: [b.description, "کل حضور (جفت‌ترددها) در این بازه‌ی ساعتی، اعم از داخل شیفت و اضافه‌کار؛ ساعت بازه در «بازه‌های زمانی» تعریف می‌شود و به شیفت وابسته نیست. حداقل مدت یا ضریب را در فرمول بگذارید."].filter(Boolean).join(" — ") }));
  const self = factorId ? factors.find((f) => f.id === factorId) : undefined;
  const pick = (lv: AttLevel) =>
    factors
      .filter((f) => f.level === lv && f.id !== self?.id)
      .map((f) => ({
        key: f.key,
        title: f.title,
        hint: [
          f.description,
          f.source === "PERMIT"
            ? lv === "DAY" ? "عامل مجوز روزانه؛ مقدار هر روز را در «مجوزها» وارد می‌کنید و ثبت‌نشده = ۰." : "عامل مجوز ماهانه؛ مقدار را در «مجوزها» از یک ماه به بعد وارد می‌کنید (تا مقدار بعدی ادامه دارد) و ثبت‌نشده = ۰."
            : lv === "DAY" ? "عامل روزانه؛ مقدارش برای هر روز جداگانه محاسبه می‌شود." : "عامل ماهانه؛ یک مقدار برای کل ماه.",
        ].filter(Boolean).join(" — "),
      }));
  const aggVariants = Object.entries(AGG_VARIANTS).map(([key, title]) => ({ key, title, hint: AGG_HINTS[key] }));
  const dayVars = Object.entries(DAY_VARS).filter(([key]) => !PALETTE_HIDDEN_DAY_VARS.includes(key)).map(([key, title]) => ({ key, title, hint: DAY_VAR_HINTS[key] }));
  const groups =
    level === "DAY"
      ? [
          { ns: "V", title: "متغیرهای روز", hint: ATT_GROUP_HINTS.V, items: dayVars, variants: null },
          { ns: "F", title: "عوامل روزانه", hint: ATT_GROUP_HINTS.F, items: pick("DAY"), variants: null },
          ...(bandItems.length ? [{ ns: "V", key: "BANDS", title: "حضور در بازه‌های زمانی", hint: ATT_GROUP_HINTS.BANDS, items: bandItems, variants: null }] : []),
          ...(hasTypes(requestsNested(false)) ? [{ ns: "V", key: "REQUESTS", title: "درخواست", hint: ATT_GROUP_HINTS.REQUESTS, items: [], variants: null, nested: requestsNested(false) }] : []),
        ]
      : [
          { ns: "A", title: "تجمیع عوامل روزانه در ماه", hint: ATT_GROUP_HINTS.A, items: pick("DAY"), variants: aggVariants },
          { ns: "T", title: "تجمیع متغیرهای روز در ماه", hint: ATT_GROUP_HINTS.T, items: [...dayVars, ...bandItems], variants: aggVariants },
          ...(hasTypes(requestsNested(true)) ? [{ ns: "T", key: "REQUESTS", title: "درخواست", hint: ATT_GROUP_HINTS.REQUESTS, items: [], variants: null, nested: requestsNested(true), valueSuffix: ":SUM" }] : []),
          ...(hasTypes(reportsNested) ? [{ ns: "T", key: "REPORTS", title: "گزارش", hint: ATT_GROUP_HINTS.REPORTS, items: [], variants: null, nested: reportsNested, valueSuffix: ":SUM" }] : []),
          { ns: "M", title: "عوامل ماهانه", hint: ATT_GROUP_HINTS.M, items: pick("MONTH"), variants: null },
        ];
  return {
    level,
    groups,
    legacy,
    baseHint: ATT_GROUP_HINTS.BASE,
    baseInfo: Object.entries(ATT_BASE_INFO).map(([key, title]) => ({ key, title, hint: ATT_BASE_HINTS[key] })),
    params: params.map((p) => ({ key: p.key, title: p.title, type: p.type })),
  };
}

// ───────────────────────── محاسبه ─────────────────────────

interface Compiled {
  id: number;
  key: string;
  title: string;
  level: AttLevel;
  valueType: AttValueType;
  branches: { cond: Cond | null; formula: Node; condText: string; formulaText: string }[] | null;
  error: string | null;
  deps: string[];
  /** عامل مجوز: مقدار از «مجوزها» می‌آید (روش و فرمول ندارد) */
  permit?: boolean;
  /** روشِ مؤثرِ این ماه (برای ذخیره در ردیف محاسبه؛ عامل روزانه: آخرین روشِ مؤثر تا پایان بازه‌ی تردد) */
  methodId?: number | null;
  /** عامل روزانه: روش‌های تاریخ‌دار (صعودی)؛ برای هر روز آخرین روشِ با تاریخ ≤ آن روز اجرا می‌شود */
  variants?: Variant[];
  /** عامل حقوقِ دارای روش «ورود از تردد» (روش از فرم «روش محاسبه»): شناسه‌ی عامل حقوق */
  payrollComponentId?: number;
  /** عامل در حلقه‌ی ارجاع افتاده (خطای حلقه روی همه‌ی روزها اثر دارد) */
  cycle?: boolean;
}
interface Variant {
  /** شماره‌ی روز شروع اثر */
  from: number;
  methodId: number;
  branches: Compiled["branches"];
  error: string | null;
  deps: string[];
}
interface Val {
  value: number | null;
  /** شماره‌ی شاخه‌ی اجراشده (۰ = هیچ‌کدام) */
  branch?: number;
  expression?: string;
  error?: string;
}

const dayNum = (d: Date) => Math.floor(d.getTime() / DAY_MS);

function compileMethod(branchRows: { seq: number; conditionText: string | null; formulaText: string }[], level: AttLevel) {
  const sorted = [...branchRows].sort((x, y) => x.seq - y.seq);
  const branches = sorted.map((b, i) => {
    const p = parseBranch({ conditionText: b.conditionText ?? "", formulaText: b.formulaText }, i, sorted.length > 1);
    return { cond: p.cond, formula: p.formula, condText: b.conditionText ?? "", formulaText: b.formulaText, refs: p.refs };
  });
  return { branches, deps: sameLevelDeps(branches.flatMap((x) => x.refs), level) };
}

/** عامل‌های تردد با روش مؤثر: ماهانه = آخرین ماه اجرای ≤ پایان ماه؛ روزانه = همه‌ی روش‌های تاریخ‌دار (هر روز روشِ خودش) */
async function compileFactors(monthEnd: Date, trafficEnd: Date): Promise<Compiled[]> {
  const rows = await prisma.attendanceFactor.findMany({
    where: { isActive: true },
    orderBy: { id: "asc" },
    include: { methods: { include: { branches: true, execCalendarMonth: true } } },
  });
  return rows.map((f) => {
    const level = f.level as AttLevel;
    const base: Compiled = { id: f.id, key: f.key, title: f.title, level, valueType: f.valueType as AttValueType, branches: null, error: null, deps: [], methodId: null };
    if (f.source === "PERMIT") return { ...base, permit: true };
    if (level === "DAY") {
      const variants: Variant[] = f.methods
        .filter((m) => m.effectiveDate)
        .sort((x, y) => x.effectiveDate!.getTime() - y.effectiveDate!.getTime())
        .map((m) => {
          try {
            const c = compileMethod(m.branches, level);
            return { from: dayNum(m.effectiveDate!), methodId: m.id, branches: c.branches, error: null, deps: c.deps };
          } catch (e: any) {
            return { from: dayNum(m.effectiveDate!), methodId: m.id, branches: null, error: e?.message || "روش نامعتبر است", deps: [] };
          }
        });
      const last = [...variants].reverse().find((v) => v.from <= dayNum(trafficEnd));
      return { ...base, variants, branches: last?.branches ?? null, error: last ? last.error : "برای این ماه روش محاسبه‌ای تعریف نشده است", deps: [...new Set(variants.flatMap((v) => v.deps))], methodId: last?.methodId ?? null };
    }
    const eff = f.methods.filter((m) => m.execCalendarMonth && m.execCalendarMonth.startDate <= monthEnd).sort((x, y) => y.execCalendarMonth!.startDate.getTime() - x.execCalendarMonth!.startDate.getTime())[0];
    const withMethod: Compiled = { ...base, methodId: eff?.id ?? null };
    if (!eff) return { ...withMethod, error: "برای این ماه روش محاسبه‌ای تعریف نشده است" };
    try {
      const c = compileMethod(eff.branches, level);
      return { ...withMethod, branches: c.branches, deps: c.deps };
    } catch (e: any) {
      return { ...withMethod, error: e?.message || "روش نامعتبر است" };
    }
  });
}

/** عامل‌های حقوقی که روش مؤثرِ حقوقی‌شان در این ماه «ورود از تردد» است (و مبلغی نیستند)؛ فرمولشان از فرم «روش محاسبه» می‌آید و بعد از عامل‌های ماهانه حساب می‌شود */
async function compilePayrollMethods(monthEnd: Date): Promise<Compiled[]> {
  const comps = await prisma.payrollComponent.findMany({
    where: { isActive: true, methods: { some: { method: "ATTENDANCE" } } },
    orderBy: { id: "asc" },
    include: { methods: { include: { execCalendarMonth: true } }, attendanceMethods: { include: { branches: true, execCalendarMonth: true } } },
  });
  const out: Compiled[] = [];
  for (const c of comps) {
    const pm = c.methods.filter((m) => m.execCalendarMonth.startDate <= monthEnd).sort((x, y) => y.execCalendarMonth.startDate.getTime() - x.execCalendarMonth.startDate.getTime())[0];
    if (!pm || pm.method !== "ATTENDANCE" || pm.valueType === "AMOUNT") continue;
    const base: Compiled = { id: c.id, key: `PC${c.id}`, title: c.title, level: "MONTH", valueType: pm.valueType as AttValueType, branches: null, error: null, deps: [], methodId: null, payrollComponentId: c.id };
    const eff = c.attendanceMethods.filter((m) => m.execCalendarMonth && m.execCalendarMonth.startDate <= monthEnd).sort((x, y) => y.execCalendarMonth!.startDate.getTime() - x.execCalendarMonth!.startDate.getTime())[0];
    if (!eff) { out.push({ ...base, error: "برای این ماه روش محاسبه‌ی تردد (فرم «روش محاسبه») تعریف نشده است" }); continue; }
    try {
      const cm = compileMethod(eff.branches, "MONTH");
      out.push({ ...base, methodId: eff.id, branches: cm.branches, deps: cm.deps });
    } catch (e: any) {
      out.push({ ...base, methodId: eff.id, error: e?.message || "روش نامعتبر است" });
    }
  }
  return out;
}

/** ترتیب محاسبه (وابسته‌ها بعد از وابستگی‌ها)؛ عامل‌های درگیر حلقه خطا می‌گیرند */
function orderFactors(list: Compiled[]): Compiled[] {
  const byKey = new Map(list.map((f) => [f.key, f]));
  const out: Compiled[] = [];
  const state = new Map<string, 1 | 2>();
  const visit = (f: Compiled) => {
    if (state.get(f.key) === 2) return;
    if (state.get(f.key) === 1) {
      f.error = f.error ?? "ارجاع دوری بین عامل‌ها";
      f.cycle = true;
      return;
    }
    state.set(f.key, 1);
    for (const d of f.deps) {
      const t = byKey.get(d);
      if (t) visit(t);
    }
    state.set(f.key, 2);
    out.push(f);
  };
  list.forEach(visit);
  return out;
}

function runBranches(f: { branches: Compiled["branches"]; error: string | null }, env: EvalEnv): Val {
  if (f.error || !f.branches) return { value: null, error: f.error ?? "روش نامعتبر است" };
  try {
    for (let i = 0; i < f.branches.length; i++) {
      const b = f.branches[i];
      let condText: string | null = null;
      if (b.cond) {
        const c = evaluateCondition(b.cond, env);
        if (!c.value) continue;
        condText = c.expression;
      }
      const r = evaluate(b.formula, env);
      return { value: r.value, branch: i + 1, expression: `${condText ? `اگر ${condText} ← ` : ""}${r.expression}` };
    }
    return { value: 0, branch: 0, expression: "هیچ‌یک از شرط‌ها برقرار نبود" };
  } catch (e: any) {
    return { value: null, error: e instanceof FormulaError ? e.message : e?.message || "خطا در محاسبه" };
  }
}

/** عامل روزانه در یک روز: آخرین روشِ با تاریخ شروع ≤ آن روز */
function runDayFactor(f: Compiled, dn: number, env: EvalEnv): Val {
  if (f.cycle) return { value: null, error: f.error ?? "ارجاع دوری بین عامل‌ها" };
  let v: Variant | undefined;
  for (const x of f.variants ?? []) if (x.from <= dn) v = x;
  if (!v) return { value: null, error: "برای این روز روش محاسبه‌ای تعریف نشده است (تاریخ شروع اثر روش‌ها بعد از این روز است)" };
  return runBranches({ branches: v.branches, error: v.error }, env);
}

/** همه‌ی شاخه‌های ترکیب‌شده‌ی یک عامل (برای پیش‌خوانی پارامترها) */
const allBranchesOf = (f: Compiled) => (f.variants ? f.variants.flatMap((v) => v.branches ?? []) : f.branches ?? []);

/** متغیرهای یک روز از ردیف‌های «کارکرد روزانه» همان روز */
function dayVariables(rows: any[], bands: EffectiveBand[] = [], leave?: DayLeave, leaveKeys: string[] = [], mission?: DayMission, settle?: DaySettlement, missionTypeIds: number[] = [], extra: Record<string, number> = {}): { vars: Record<string, number>; incomplete: boolean; shiftTitle: string } {
  const work = rows.filter((r) => !r.rest);
  const rest = rows.filter((r) => r.rest);
  const ok = work.filter((r) => r.status === "OK");
  const sum = (arr: any[], f: string) => arr.reduce((n, r) => n + (r[f] ?? 0), 0);
  const isWork = work.length > 0;
  const first = rows[0];
  const vars: Record<string, number> = {
    PLANNED: isWork ? first.dayNetMinutes : 0,
    PLANNED_GROSS: isWork ? first.dayGrossMinutes : 0,
    PRESENCE: sum(ok, "presenceMinutes"),
    PRESENCE_IN_SHIFT: sum(ok, "presenceInShiftMinutes"),
    REST_PRESENCE: sum(rest.filter((r) => r.status === "WORK_ON_REST"), "presenceMinutes"),
    LATE: sum(ok, "lateMinutes"),
    EARLY_LEAVE: sum(ok, "earlyLeaveMinutes"),
    OT_BEFORE: sum(ok, "overtimeBeforeMinutes"),
    OT_AFTER: sum(ok, "overtimeAfterMinutes"),
    BREAK: isWork ? first.dayBreakMinutes : 0,
    LEAVE_MINUTES: isWork ? first.dayLeaveMinutes : 0,
    IS_WORK_DAY: isWork ? 1 : 0,
    IS_REST_DAY: isWork ? 0 : 1,
    IS_SHIFT_OFF_DAY: !isWork && first.dayType === "SHIFT_OFF" ? 1 : 0,
    IS_OFFICIAL_HOLIDAY: !isWork && first.dayType === "OFFICIAL_HOLIDAY" ? 1 : 0,
    // مرخصی/ماموریتِ روزانه‌ی تاییدشده غیبت را برمی‌دارد؛ ساعتی فقط وقتی که مجموعشان کل ساعت کاری را بپوشاند
    ABSENT: isWork && work.every((r) => r.status === "NO_PUNCH") && !leave?.hasDaily && !mission?.hasDaily && (leave?.total ?? 0) + (mission?.total ?? 0) < first.dayNetMinutes ? 1 : 0,
    LEAVE_TAKEN: leave?.total ?? 0,
    MISSION_MINUTES: mission?.total ?? 0,
    // احتسابِ ماموریت‌های پایان‌یافته: کل بازه در روز پایان (تجمیع ماهانه‌اش در ماهِ پایان می‌افتد)
    MISSION_DAYS: settle?.total ?? 0,
    MISSION_REPORT_DAYS: settle?.reportTotal ?? 0,
    ROWS: work.length,
    INCOMPLETE_ROWS: rows.filter((r) => r.status === "INCOMPLETE").length,
  };
  // حضور در هر بازه‌ی زمانی: اشتراک همه‌ی جفت‌ترددهای آن روز (ردیف‌های کامل، شامل روز استراحت) با بازه‌ی ساعتی؛ بازه‌ای که برای این ماه نسخه ندارد متغیرش نیست
  const pairs: [number, number][] = rows.filter((r) => r.status === "OK" || r.status === "WORK_ON_REST").flatMap((r) => r.pairsAbs ?? []);
  for (const b of bands) if (b.startMinute !== null && b.endMinute !== null) vars[b.key] = bandOverlap(pairs, b.startMinute, b.endMinute);
  for (const k of leaveKeys) vars[k] = leave?.byKey[k] ?? 0;
  for (const id of missionTypeIds) vars[missionTypeKey(id)] = settle?.byType[id] ?? 0;
  // متغیر هر نوع درخواست (مرخصی: RL، ماموریت: RQ) که بیرون از این تابع محاسبه شده
  Object.assign(vars, extra);
  return { vars, incomplete: vars.INCOMPLETE_ROWS > 0, shiftTitle: first.shiftTitle };
}

export interface ComputeOpts {
  year: number;
  month: number;
  employeeId?: number;
  employeeIds?: number[];
}

export async function computeAttendanceResults(opts: ComputeOpts) {
  const cal = await prisma.workCalendarMonth.findFirst({ where: { month: opts.month, calendar: { year: opts.year } }, include: { calendar: true } });
  if (!cal) throw new AttendanceError(`ماه ${opts.month} سال ${opts.year} در «تقویم کاری» تعریف نشده است`);
  const from = cal.trafficStartDate, to = cal.trafficEndDate;
  const compiled = orderFactors(await compileFactors(cal.endDate, to));
  const payrollCompiled = await compilePayrollMethods(cal.endDate);
  const bands = await effectiveBands(cal.endDate);
  const leaveTypes = await prisma.attendanceLeaveType.findMany({ where: { isActive: true }, select: { key: true, title: true }, orderBy: { id: "asc" } });
  const leaveKeys = leaveTypes.map((t) => t.key);
  const missionTypes = await prisma.attendanceMissionType.findMany({ where: { isActive: true }, select: { id: true, title: true }, orderBy: { id: "asc" } });
  const missionTypeIds = missionTypes.map((t) => t.id);
  const requestTypes = await prisma.attendanceRequestType.findMany({ where: { isActive: true }, select: { id: true, title: true, nature: true, unit: true }, orderBy: { id: "asc" } });
  const reqKey = (t: { id: number; nature: string }) => (t.nature === "LEAVE" ? leaveRequestKey(t.id) : requestTypeKey(t.id));
  const bandTitle = new Map<string, string>([
    ...bands.map((b) => [b.key, `حضور در ${b.title}`] as [string, string]),
    ...leaveTypes.map((t) => [t.key, `مرخصی ${t.title}`] as [string, string]),
    ...missionTypes.map((t) => [missionTypeKey(t.id), `طول گزارش ماموریت ${t.title}`] as [string, string]),
    ...requestTypes.map((t) => [reqKey(t), `${t.nature === "LEAVE" ? "مدت مرخصی" : t.unit === "HOURLY" ? "مدت ماموریت" : "طول درخواست ماموریت"} ${t.title}`] as [string, string]),
  ]);
  const dayFactors = compiled.filter((f) => f.level === "DAY");
  const monthFactors = compiled.filter((f) => f.level === "MONTH");
  const showSet = new Set((await prisma.attendanceFactor.findMany({ where: { showInWorksheet: true }, select: { id: true } })).map((x) => x.id));
  const factorsOut = compiled.map((f) => ({ key: f.key, id: f.id, title: f.title, level: f.level, valueType: f.valueType, error: f.error, showInWorksheet: showSet.has(f.id), methodId: f.methodId ?? null }));

  // پارامترهای مبنا: مقدار معتبر در پایان ماه (یک بار)
  const paramCache = new Map<string, number>();
  const param = async (key: string) => {
    if (!paramCache.has(key)) {
      const v = await getParameterValue(key, cal.endDate);
      if (!v || v.type === "BRACKETS" || v.value === null) throw new FormulaError(`برای پارامتر مبنا ${key} در این ماه مقداری تعریف نشده است`);
      paramCache.set(key, v.value);
    }
    return paramCache.get(key)!;
  };
  const paramRows = await prisma.payrollParameter.findMany({ select: { key: true, title: true } });
  const paramTitle = new Map(paramRows.map((p) => [p.key, p.title]));
  const factorTitle = new Map(compiled.map((f) => [f.key, f.title]));
  // پارامترهای استفاده‌شده را پیش‌خوانی می‌کنیم تا ارزیابی همگام بماند
  const used = new Set<string>();
  for (const f of [...compiled, ...payrollCompiled]) for (const b of allBranchesOf(f)) {
    for (const r of [...(b.cond ? collectCondRefs(b.cond) : []), ...collectRefs(b.formula)]) if (r.ns === "P") used.add(r.key);
  }
  const paramErr = new Map<string, string>();
  for (const k of used) {
    try {
      await param(k);
    } catch (e: any) {
      paramErr.set(k, e?.message || "پارامتر نامعتبر است");
    }
  }
  const baseInfo: Record<string, number> = {
    MONTH_DAYS: dayNum(cal.endDate) - dayNum(cal.startDate) + 1,
    STANDARD_DAYS: cal.standardDays,
    ALLOWED_DAYS: cal.allowedDays,
    STANDARD_MINUTES: cal.standardMinutes,
    ALLOWED_MINUTES: cal.allowedMinutes,
    DAILY_MINUTES: cal.calendar.dailyMinutes,
  };
  const scalarCommon = (ns: Ns, key: string): number | undefined => {
    if (ns === "B") return baseInfo[key];
    if (ns === "P") {
      if (paramErr.has(key)) throw new FormulaError(paramErr.get(key)!);
      return paramCache.get(key);
    }
    return undefined;
  };
  const labelOf = (ns: Ns, key: string, variant: string) => {
    if ((ns === "V" || ns === "T") && bandTitle.has(key)) return `${bandTitle.get(key)}${ns === "T" ? ` (${AGG_VARIANTS[variant] ?? variant})` : ""}`;
    if (ns === "V" || ns === "T") return DAY_VARS[key] ? `${ns === "T" ? "تجمیع " : ""}${DAY_VARS[key]}${ns === "T" ? ` (${AGG_VARIANTS[variant] ?? variant})` : ""}` : key;
    if (ns === "F" || ns === "M") return factorTitle.get(key) ?? key;
    if (ns === "A") return `${factorTitle.get(key) ?? key} (${AGG_VARIANTS[variant] ?? variant})`;
    if (ns === "B") return ATT_BASE_INFO[key] ?? key;
    if (ns === "P") return paramTitle.get(key) ?? key;
    return key;
  };
  const noBrackets = () => {
    throw new FormulaError("جدول پلکانی در فرمول تردد پشتیبانی نمی‌شود");
  };

  const ws = await buildWorksheet({ from, to, employeeId: opts.employeeId, employeeIds: opts.employeeIds, includeRest: true });
  const wsEmployeeIds = [...new Set(ws.rows.map((r: any) => r.employeeId as number))];
  const approvedLeave = await loadApprovedLeave(wsEmployeeIds, dayNum(from), dayNum(to));
  const approvedMissions = await loadMissions(wsEmployeeIds, dayNum(from), dayNum(to));
  const settlements = await loadSettlements(wsEmployeeIds, dayNum(from), dayNum(to));

  // مقدار عامل‌های مجوز: روزانه = ردیفِ همان تاریخ؛ ماهانه = آخرین ردیف تا همین ماه (تا مقدار بعدی ادامه دارد)؛ ثبت‌نشده = ۰
  const permitIds = compiled.filter((f) => f.permit).map((f) => f.id);
  const permitDay = new Map<string, number>();
  const permitMonthRows = new Map<string, { start: number; value: number }[]>();
  if (permitIds.length && wsEmployeeIds.length) {
    const pr = await prisma.attendancePermitValue.findMany({
      where: { employeeId: { in: wsEmployeeIds }, factorId: { in: permitIds }, OR: [{ date: { gte: from, lte: to } }, { calendarMonthId: { not: null }, calendarMonth: { startDate: { lte: cal.startDate } } }] },
      select: { employeeId: true, factorId: true, date: true, value: true, calendarMonth: { select: { startDate: true } } },
    });
    for (const r of pr) {
      if (r.date) permitDay.set(`${r.employeeId}:${r.factorId}:${dayNum(r.date)}`, Number(r.value));
      else if (r.calendarMonth) {
        const k = `${r.employeeId}:${r.factorId}`;
        (permitMonthRows.get(k) ?? permitMonthRows.set(k, []).get(k)!).push({ start: dayNum(r.calendarMonth.startDate), value: Number(r.value) });
      }
    }
  }
  const permitVal = (v: number | undefined): Val => (v === undefined ? { value: 0, branch: 0, expression: "مجوز ثبت نشده (صفر)" } : { value: v, branch: 0, expression: "مجوز ثبت‌شده" });
  const permitMonthValue = (empId: number, factorId: number): number | undefined => {
    let best: { start: number; value: number } | undefined;
    for (const r of permitMonthRows.get(`${empId}:${factorId}`) ?? []) if (r.start <= dayNum(cal.startDate) && (!best || r.start > best.start)) best = r;
    return best?.value;
  };
  const rowsByEmp = new Map<number, any[]>();
  for (const r of ws.rows) (rowsByEmp.get(r.employeeId) ?? rowsByEmp.set(r.employeeId, []).get(r.employeeId)!).push(r);

  const employees: any[] = [];
  const days: any[] = [];
  for (const [empId, rows] of rowsByEmp) {
    const byDate = new Map<string, any[]>();
    for (const r of rows) (byDate.get(r.workDate) ?? byDate.set(r.workDate, []).get(r.workDate)!).push(r);
    const dates = [...byDate.keys()].sort();
    const dayRows: { date: string; vars: Record<string, number>; incomplete: boolean; shiftTitle: string; values: Record<string, Val> }[] = [];

    for (const date of dates) {
      const dn = dayNum(new Date(date));
      const dayRowsOf = byDate.get(date)!;
      const leaveVals = leaveValuesByRequestType(approvedLeave, empId, dn, dayRowsOf, cal.calendar.dailyMinutes);
      const hourlyMis = hourlyMissionMinutesByType(approvedMissions, empId, dn, dayRowsOf);
      const settle = settlements.get(`${empId}:${dn}`);
      const extra: Record<string, number> = {};
      for (const t of requestTypes) extra[reqKey(t)] = t.nature === "LEAVE" ? leaveVals[t.id] ?? 0 : t.unit === "HOURLY" ? hourlyMis[t.id] ?? 0 : settle?.byRequestType[t.id] ?? 0;
      const dv = dayVariables(byDate.get(date)!, bands, leaveForDay(approvedLeave, empId, dn, byDate.get(date)!), leaveKeys, missionForDay(approvedMissions, empId, dn, byDate.get(date)!), settle, missionTypeIds, extra);
      const values: Record<string, Val> = {};
      const env: EvalEnv = {
        scalar: (ns, key) => {
          if (ns === "V") {
            if (dv.vars[key] === undefined) throw new FormulaError(`${labelOf(ns, key, "")} برای این ماه تعریف نشده است (بازه‌ی زمانی نسخه‌ای ندارد)`);
            return dv.vars[key];
          }
          if (ns === "F") {
            const v = values[key];
            if (!v || v.value === null) throw new FormulaError(`عامل «${factorTitle.get(key) ?? key}» مقدار ندارد${v?.error ? ` (${v.error})` : ""}`);
            return v.value;
          }
          const c = scalarCommon(ns, key);
          if (c === undefined) throw new FormulaError(`عملوند [${ns}:${key}] در عامل روزانه مجاز نیست`);
          return c;
        },
        brackets: noBrackets,
        label: labelOf,
      };
      for (const f of dayFactors) values[f.key] = f.permit ? permitVal(permitDay.get(`${empId}:${f.id}:${dn}`)) : runDayFactor(f, dn, env);
      dayRows.push({ date, vars: dv.vars, incomplete: dv.incomplete, shiftTitle: dv.shiftTitle, values });
    }

    // تجمیع ماهانه
    const agg = (get: (d: (typeof dayRows)[number]) => number | null, variant: string): number | null => {
      let sum = 0, max = 0, cnt = 0;
      for (const d of dayRows) {
        const v = get(d);
        if (v === null) return null;
        sum += v;
        if (v > max) max = v;
        if (v > 0) cnt++;
      }
      return variant === "SUM" ? sum : variant === "MAX" ? max : cnt;
    };
    const mvals: Record<string, Val> = {};
    const menv: EvalEnv = {
      scalar: (ns, key, variant) => {
        if (ns === "T") {
          if (dayRows.length && dayRows[0].vars[key] === undefined) throw new FormulaError(`${labelOf(ns, key, "")} برای این ماه تعریف نشده است (بازه‌ی زمانی نسخه‌ای ندارد)`);
          return agg((d) => d.vars[key], variant) as number;
        }
        if (ns === "A") {
          const bad = dayRows.filter((d) => d.values[key] === undefined || d.values[key].value === null).length;
          if (bad > 0) throw new FormulaError(`عامل روزانه‌ی «${factorTitle.get(key) ?? key}» در ${bad} روز مقدار نداشت (خطا یا روش تعریف‌نشده)`);
          return agg((d) => d.values[key]?.value ?? 0, variant) as number;
        }
        if (ns === "M") {
          const v = mvals[key];
          if (!v || v.value === null) throw new FormulaError(`عامل «${factorTitle.get(key) ?? key}» مقدار ندارد${v?.error ? ` (${v.error})` : ""}`);
          return v.value;
        }
        const c = scalarCommon(ns, key);
        if (c === undefined) throw new FormulaError(`عملوند [${ns}:${key}] در عامل ماهانه مجاز نیست`);
        return c;
      },
      brackets: noBrackets,
      label: labelOf,
    };
    for (const f of monthFactors) mvals[f.key] = f.permit ? permitVal(permitMonthValue(empId, f.id)) : runBranches(f, menv);
    // عامل‌های حقوقیِ «ورود از تردد»: بعد از عامل‌های ماهانه (فقط از آن‌ها و تجمیع روزها می‌خوانند)
    const pvals: Record<string, Val> = {};
    for (const f of payrollCompiled) pvals[f.key] = runBranches(f, menv);

    const emp = rows[0];
    employees.push({
      employeeId: empId,
      personnelCode: emp.personnelCode,
      employeeName: emp.employeeName,
      days: dayRows.length,
      incompleteDays: dayRows.filter((d) => d.incomplete).length,
      values: mvals,
      payroll: pvals,
    });
    for (const d of dayRows) days.push({ employeeId: empId, personnelCode: emp.personnelCode, employeeName: emp.employeeName, date: d.date, shiftTitle: d.shiftTitle, incomplete: d.incomplete, vars: d.vars, values: d.values });
  }
  employees.sort((a, b) => (a.personnelCode < b.personnelCode ? -1 : 1));
  days.sort((a, b) => (a.personnelCode < b.personnelCode ? -1 : a.personnelCode > b.personnelCode ? 1 : a.date < b.date ? -1 : 1));
  return {
    year: opts.year,
    month: opts.month,
    from: dayStr(from),
    to: dayStr(to),
    factors: factorsOut,
    payrollFactors: payrollCompiled.map((f) => ({ key: f.key, componentId: f.payrollComponentId!, title: f.title, valueType: f.valueType, error: f.error, methodId: f.methodId ?? null })),
    bands: [...bands.map((b) => ({ key: b.key, title: `حضور در ${b.title}` })), ...leaveTypes.map((t) => ({ key: t.key, title: `مرخصی ${t.title}` })), ...missionTypes.map((t) => ({ key: missionTypeKey(t.id), title: `طول گزارش ماموریت ${t.title}` })), ...requestTypes.map((t) => ({ key: reqKey(t), title: bandTitle.get(reqKey(t)) ?? t.title }))],
    employees,
    days,
    summary: { employees: employees.length, days: days.length, incompleteDays: days.filter((d) => d.incomplete).length, factorErrors: factorsOut.filter((f) => f.error).length },
  };
}
