import { prisma } from "../lib/prisma";
import { nextSerialNumber } from "../utils/coding";
import { SYSTEM_STRUCTURES, type FieldDef, type FileDef, type StructureDef } from "../data/fileStructureDefaults";
import { DICT_BY_KEY } from "./fileStructureDictionary";
import { exprNames, parseExpr } from "../utils/fileFormats";

// ساختار فایل (فایل‌های بانک‌ها و سازمان‌ها): تعریف، اعتبارسنجی، ذخیره، کپی از ساختار پیش‌فرض نصب. تولید فایل: services/fileGeneratorService.ts.
// ساختارهای پیش‌فرض نصب (data/fileStructureDefaults.ts) فقط‌خواندنی و در کد هستند؛ «کپی» یک نسخه‌ی دیتابیسی از آن می‌سازد و عنوان عامل‌های پیشنهادی را با
// عامل‌های همین نصب تطبیق می‌دهد.

export class FileStructureError extends Error {}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().replace(/\s+/g, " ") : null);

/** عنوان‌های پیشنهادی → شناسه‌ی عامل‌ها؛ عامل حکم در اولویت (عنوان یکسان در هر دو: فقط حکم) */
export async function resolveSuggestions(def: StructureDef): Promise<{ def: StructureDef; unresolved: { field: string; title: string }[] }> {
  const [payroll, decree, calc] = await Promise.all([
    prisma.payrollComponent.findMany({ select: { id: true, title: true } }),
    prisma.decreeComponent.findMany({ select: { id: true, title: true } }),
    prisma.payrollCalcType.findMany({ select: { id: true, title: true } }),
  ]);
  const norm = (t: string) => t.replace(/ي/g, "ی").replace(/ك/g, "ک").replace(/\s+/g, " ").trim();
  const byTitle = <T extends { id: number; title: string }>(rows: T[]) => new Map(rows.map((r) => [norm(r.title), r.id]));
  const P = byTitle(payroll), D = byTitle(decree), C = byTitle(calc);
  const unresolved: { field: string; title: string }[] = [];
  const out: StructureDef = {
    ...def,
    files: def.files.map((f) => ({
      ...f,
      fields: f.fields.map((fl) => {
        if (!fl.suggest) return fl;
        const refs = { payroll: [] as number[], decree: [] as number[], net: [] as number[] };
        for (const t of fl.suggest.factorTitles ?? []) {
          const d = D.get(norm(t)), p = P.get(norm(t));
          if (d) refs.decree.push(d);
          else if (p) refs.payroll.push(p);
          else unresolved.push({ field: fl.name, title: t });
        }
        for (const t of fl.suggest.netCalcTypeTitles ?? []) {
          const c = C.get(norm(t));
          if (c) refs.net.push(c);
          else unresolved.push({ field: fl.name, title: `خالص پرداختی «${t}»` });
        }
        return { ...fl, refs };
      }),
    })),
  };
  return { def: out, unresolved };
}

// ── اعتبارسنجی بدنه‌ی فرم → ساختار نرمال ──

function cleanField(raw: any, file: FileDef, fileIdx: number, seqInFile: number): FieldDef {
  const name = str(raw.name);
  if (!name) throw new FileStructureError(`فایل ${fileIdx}: نام فیلد ردیف ${seqInFile} الزامی است`);
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw new FileStructureError(`نام فیلد «${name}» فقط می‌تواند حروف انگلیسی، رقم و _ باشد`);
  if (file.format === "DBF" && name.length > 10) throw new FileStructureError(`نام فیلد DBF «${name}» حداکثر ۱۰ نویسه است`);
  const title = str(raw.title) ?? name;
  const dataType = raw.dataType === "NUMBER" ? "NUMBER" : "TEXT";
  let length: number | null = null;
  if (raw.length !== undefined && raw.length !== null && raw.length !== "") {
    length = Number(raw.length);
    if (!Number.isInteger(length) || length < 1 || length > 254) throw new FileStructureError(`طول فیلد «${name}» باید عدد صحیح ۱ تا ۲۵۴ باشد`);
  }
  if (file.format === "DBF" && !length) throw new FileStructureError(`طول فیلد DBF «${name}» الزامی است`);
  const decimals = raw.decimals ? Number(raw.decimals) : 0;
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 8) throw new FileStructureError(`تعداد اعشار «${name}» نامعتبر است`);
  const f: FieldDef = { name, title, dataType, length, decimals, zeroPad: !!raw.zeroPad, source: raw.source };
  switch (raw.source) {
    case "CONSTANT":
      f.constantValue = typeof raw.constantValue === "string" ? raw.constantValue : String(raw.constantValue ?? "");
      break;
    case "EMPTY":
      break;
    case "EMPLOYEE_FIELD": {
      const d = DICT_BY_KEY.get(String(raw.systemField));
      if (!d) throw new FileStructureError(`فیلد سیستمی «${raw.systemField}» برای «${name}» وجود ندارد`);
      if (file.rowKind === "SINGLE" && d.scope !== "GLOBAL") throw new FileStructureError(`«${name}»: در فایل تک‌ردیفی فقط فیلدهای «شرکت و دوره / شعبه» مجازند`);
      f.systemField = d.key;
      f.maps = (Array.isArray(raw.maps) ? raw.maps : [])
        .map((m: any) => ({ sourceValue: String(m.sourceValue ?? "").trim(), targetValue: String(m.targetValue ?? "").trim() }))
        .filter((m: any) => m.sourceValue);
      break;
    }
    case "FACTOR_SUM": {
      const r = raw.refs ?? {};
      const ids = (a: unknown) => [...new Set((Array.isArray(a) ? a : []).map(Number).filter((n) => Number.isInteger(n) && n > 0))];
      f.refs = { payroll: ids(r.payroll), decree: ids(r.decree), net: ids(r.net) };
      break;
    }
    case "PARAM": {
      const key = str(raw.paramKey);
      if (!key || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) throw new FileStructureError(`کلید پارامتر «${name}» نامعتبر است (حروف انگلیسی، رقم و _)`);
      f.paramKey = key;
      f.constantValue = typeof raw.constantValue === "string" ? raw.constantValue : String(raw.constantValue ?? "");
      break;
    }
    case "AGGREGATE": {
      if (file.rowKind !== "SINGLE") throw new FileStructureError(`«${name}»: مجموع/تعداد فقط در فایل تک‌ردیفی ممکن است`);
      if (raw.aggFunc !== "SUM" && raw.aggFunc !== "COUNT") throw new FileStructureError(`«${name}»: تابع مجموع‌گیری را انتخاب کنید`);
      f.aggFunc = raw.aggFunc;
      f.aggFileSeq = Number(raw.aggFileSeq) || null;
      f.aggFieldName = str(raw.aggFieldName);
      if (!f.aggFileSeq || !f.aggFieldName) throw new FileStructureError(`«${name}»: فایل و فیلد مبنای مجموع‌گیری را انتخاب کنید`);
      break;
    }
    case "EXPR": {
      const t = str(raw.exprText);
      if (!t) throw new FileStructureError(`«${name}»: فرمول الزامی است`);
      try {
        parseExpr(t);
      } catch (e: any) {
        throw new FileStructureError(`فرمول «${name}»: ${e.message}`);
      }
      f.exprText = t;
      break;
    }
    default:
      throw new FileStructureError(`منبع مقدار «${name}» را انتخاب کنید`);
  }
  return f;
}

export function validateDef(b: any): StructureDef {
  const title = str(b.title);
  if (!title) throw new FileStructureError("عنوان الزامی است");
  const rawFiles = Array.isArray(b.files) ? b.files : [];
  if (rawFiles.length === 0) throw new FileStructureError("دست‌کم یک فایل لازم است");
  const files: FileDef[] = rawFiles.map((rf: any, i: number) => {
    const nameTemplate = str(rf.nameTemplate);
    if (!nameTemplate) throw new FileStructureError(`فایل ${i + 1}: الگوی نام فایل الزامی است`);
    if (!/^[^\\/:*?"<>|]+$/.test(nameTemplate)) throw new FileStructureError(`فایل ${i + 1}: نام فایل نویسه‌ی غیرمجاز دارد`);
    const format = rf.format === "DBF" ? "DBF" : "DELIMITED";
    const rowKind = rf.rowKind === "SINGLE" ? "SINGLE" : "PER_EMPLOYEE";
    const delimiter = typeof rf.delimiter === "string" && rf.delimiter.length >= 1 && rf.delimiter.length <= 3 ? rf.delimiter : ",";
    const encoding = format === "DBF" ? "IRAN_SYSTEM" : rf.encoding === "UTF8" ? "UTF8" : "UTF8_BOM";
    const file: FileDef = { seq: i + 1, nameTemplate, format, rowKind, delimiter, encoding, lineEnding: rf.lineEnding === "CRLF" ? "CRLF" : "LF", trailingNewline: rf.trailingNewline !== false, fields: [] };
    const rawFields = Array.isArray(rf.fields) ? rf.fields : [];
    if (rawFields.length === 0) throw new FileStructureError(`فایل ${i + 1}: دست‌کم یک فیلد لازم است`);
    file.fields = rawFields.map((fl: any, j: number) => cleanField(fl, file, i + 1, j + 1));
    const names = new Set<string>();
    for (const fl of file.fields) {
      if (names.has(fl.name)) throw new FileStructureError(`فایل ${i + 1}: نام فیلد «${fl.name}» تکراری است`);
      names.add(fl.name);
    }
    for (const fl of file.fields) {
      if (fl.source === "EXPR") {
        for (const n of exprNames(parseExpr(fl.exprText!))) if (!names.has(n)) throw new FileStructureError(`فرمول «${fl.name}»: فیلد «${n}» در همین فایل نیست`);
      }
    }
    return file;
  });
  for (const f of files) {
    for (const fl of f.fields) {
      if (fl.source !== "AGGREGATE") continue;
      const target = files.find((x) => x.seq === fl.aggFileSeq);
      if (!target || target.rowKind !== "PER_EMPLOYEE") throw new FileStructureError(`«${fl.name}»: فایل مبنای مجموع‌گیری باید فایل «یک ردیف به ازای هر کارمند» باشد`);
      if (!target.fields.some((x) => x.name === fl.aggFieldName)) throw new FileStructureError(`«${fl.name}»: فیلد «${fl.aggFieldName}» در فایل ${target.seq} نیست`);
    }
  }
  return { systemKey: null, title, sourceKind: "PAYROLL_LIST", isActive: b.isActive === undefined ? true : !!b.isActive, files };
}

/** وجود عامل‌های مرجع (کنترل FK قبل از ذخیره، پیام فارسی به‌جای خطای دیتابیس) */
async function assertRefsExist(def: StructureDef) {
  const P = new Set<number>(), D = new Set<number>(), N = new Set<number>();
  for (const f of def.files) for (const fl of f.fields) {
    fl.refs?.payroll.forEach((x) => P.add(x));
    fl.refs?.decree.forEach((x) => D.add(x));
    fl.refs?.net.forEach((x) => N.add(x));
  }
  const [p, d, n] = await Promise.all([
    P.size ? prisma.payrollComponent.count({ where: { id: { in: [...P] } } }) : 0,
    D.size ? prisma.decreeComponent.count({ where: { id: { in: [...D] } } }) : 0,
    N.size ? prisma.payrollCalcType.count({ where: { id: { in: [...N] } } }) : 0,
  ]);
  if (p !== P.size || d !== D.size || n !== N.size) throw new FileStructureError("برخی عامل‌های انتخاب‌شده دیگر وجود ندارند");
}

const refRows = (r?: { payroll: number[]; decree: number[]; net: number[] }) => [
  ...(r?.payroll ?? []).map((id) => ({ payrollComponentId: id })),
  ...(r?.decree ?? []).map((id) => ({ decreeComponentId: id })),
  ...(r?.net ?? []).map((id) => ({ netCalcTypeId: id })),
];

const filesCreate = (def: StructureDef) =>
  def.files.map((f) => ({
    seq: f.seq,
    nameTemplate: f.nameTemplate,
    format: f.format,
    rowKind: f.rowKind,
    delimiter: f.delimiter,
    encoding: f.encoding,
    lineEnding: f.lineEnding,
    trailingNewline: f.trailingNewline,
    fields: {
      create: f.fields.map((fl, i) => ({
        seq: i + 1,
        name: fl.name,
        title: fl.title,
        dataType: fl.dataType,
        length: fl.length ?? null,
        decimals: fl.decimals ?? 0,
        zeroPad: !!fl.zeroPad,
        source: fl.source,
        constantValue: fl.constantValue ?? null,
        systemField: fl.systemField ?? null,
        paramKey: fl.paramKey ?? null,
        aggFunc: fl.aggFunc ?? null,
        aggFileSeq: fl.aggFileSeq ?? null,
        aggFieldName: fl.aggFieldName ?? null,
        exprText: fl.exprText ?? null,
        refs: { create: refRows(fl.refs) },
        maps: { create: (fl.maps ?? []).map((m) => ({ sourceValue: m.sourceValue, targetValue: m.targetValue })) },
      })),
    },
  }));

export async function createStructure(def: StructureDef) {
  await assertRefsExist(def);
  if (await prisma.fileStructure.findUnique({ where: { title: def.title } })) throw new FileStructureError("ساختار دیگری با همین عنوان وجود دارد");
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.fileStructure.create({
        data: {
          code: await nextSerialNumber(prisma.fileStructure, "code"),
          title: def.title,
          sourceKind: def.sourceKind,
          isActive: def.isActive,
          files: { create: filesCreate(def) },
        },
      });
    } catch (e: any) {
      if (e?.code === "P2002" && attempt < 3) continue; // مسابقه روی کد
      throw e;
    }
  }
}

export async function updateStructure(id: number, def: StructureDef) {
  await assertRefsExist(def);
  if (await prisma.fileStructure.findFirst({ where: { title: def.title, NOT: { id } } })) throw new FileStructureError("ساختار دیگری با همین عنوان وجود دارد");
  await prisma.$transaction([
    prisma.fileStructureFile.deleteMany({ where: { structureId: id } }),
    prisma.fileStructure.update({
      where: { id },
      data: { title: def.title, isActive: def.isActive, files: { create: filesCreate(def) } },
    }),
  ]);
}

const FULL = {
  files: {
    orderBy: { seq: "asc" as const },
    include: { fields: { orderBy: { seq: "asc" as const }, include: { refs: true, maps: true } } },
  },
};

/** ردیف دیتابیس → ساختار */
function toDef(row: any): StructureDef {
  return {
    id: row.id,
    systemKey: null,
    code: row.code,
    title: row.title,
    sourceKind: row.sourceKind,
    isActive: row.isActive,
    files: row.files.map((f: any) => ({
      seq: f.seq,
      nameTemplate: f.nameTemplate,
      format: f.format,
      rowKind: f.rowKind,
      delimiter: f.delimiter,
      encoding: f.encoding,
      lineEnding: f.lineEnding,
      trailingNewline: f.trailingNewline,
      fields: f.fields.map((fl: any) => ({
        name: fl.name,
        title: fl.title,
        dataType: fl.dataType,
        length: fl.length,
        decimals: fl.decimals,
        zeroPad: fl.zeroPad,
        source: fl.source,
        constantValue: fl.constantValue,
        systemField: fl.systemField,
        paramKey: fl.paramKey,
        aggFunc: fl.aggFunc,
        aggFileSeq: fl.aggFileSeq,
        aggFieldName: fl.aggFieldName,
        exprText: fl.exprText,
        refs: {
          payroll: fl.refs.filter((r: any) => r.payrollComponentId).map((r: any) => r.payrollComponentId),
          decree: fl.refs.filter((r: any) => r.decreeComponentId).map((r: any) => r.decreeComponentId),
          net: fl.refs.filter((r: any) => r.netCalcTypeId).map((r: any) => r.netCalcTypeId),
        },
        maps: fl.maps.map((m: any) => ({ sourceValue: m.sourceValue, targetValue: m.targetValue })),
      })),
    })),
  };
}

export const isSystemRef = (idOrKey: string) => idOrKey.startsWith("sys-");

/** ساختار با شناسه‌ی عددی (دیتابیس) یا «sys-<KEY>» (پیش‌فرض نصب). برای پیش‌فرض نصب عامل‌ها با عنوان تطبیق داده می‌شوند. */
export async function loadStructure(idOrKey: string): Promise<{ def: StructureDef; unresolved: { field: string; title: string }[] } | null> {
  if (isSystemRef(idOrKey)) {
    const sys = SYSTEM_STRUCTURES.find((s) => s.systemKey === idOrKey.slice(4));
    if (!sys) return null;
    const r = await resolveSuggestions(sys);
    return { def: { ...r.def, id: null }, unresolved: r.unresolved };
  }
  const row = await prisma.fileStructure.findUnique({ where: { id: Number(idOrKey) }, include: FULL });
  return row ? { def: toDef(row), unresolved: [] } : null;
}

export async function listStructures() {
  const rows = await prisma.fileStructure.findMany({ orderBy: { code: "asc" }, include: { files: { select: { id: true } } } });
  const sys = SYSTEM_STRUCTURES.map((s) => ({
    ref: `sys-${s.systemKey}`,
    id: null as number | null,
    code: null as number | null,
    title: s.title,
    isActive: true,
    isSystem: true,
    fileCount: s.files.length,
  }));
  const own = rows.map((r) => ({ ref: String(r.id), id: r.id, code: r.code, title: r.title, isActive: r.isActive, isSystem: false, fileCount: r.files.length }));
  return [...sys, ...own];
}

export async function copyStructure(idOrKey: string, title?: string) {
  const src = await loadStructure(idOrKey);
  if (!src) throw new FileStructureError("ساختار یافت نشد");
  const baseTitle = str(title) ?? `کپی ${src.def.title}`;
  let t = baseTitle;
  for (let n = 2; await prisma.fileStructure.findUnique({ where: { title: t } }); n++) t = `${baseTitle} (${n})`;
  const created = await createStructure({ ...src.def, title: t, systemKey: null });
  return { id: created.id, unresolved: src.unresolved };
}
