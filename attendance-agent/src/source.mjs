import { normalizeStartDate } from "./config.mjs";
import { rawToString, toEnglishDigits } from "./convert.mjs";
import { gregorianToJalali } from "./jalali.mjs";

// خواندن «فقط‌خواندنی» از دیتابیس کارت‌ساعت (SQL Server / MySQL / PostgreSQL). تنها یک نوع دستور ساخته می‌شود: SELECT با پارامتر برای cursor؛ نام جدول/ستون‌ها فقط با
// الگوی شناسه‌ی امن پذیرفته و نقل‌قول می‌شوند و شرط اضافه (where) نباید ; یا -- یا /* داشته باشد. حتی با این‌ها، حتماً یک کاربر فقط‌خواندنی برای اتصال بسازید.

const IDENT = /^[A-Za-z_؀-ۿ][A-Za-z0-9_$؀-ۿ]*$/;

function quote(dialect, name) {
  const parts = String(name).split(".");
  for (const p of parts) if (!IDENT.test(p)) throw new Error(`نام «${name}» برای جدول/ستون مجاز نیست (فقط حرف، عدد و _ و نقطه)`);
  const q = (p) => (dialect === "mssql" ? `[${p}]` : dialect === "mysql" ? `\`${p}\`` : `"${p}"`);
  return parts.map(q).join(".");
}

const LOGICAL = [
  ["userId", "c_userid"],
  ["date", "c_date"],
  ["time", "c_time"],
  ["dateTime", "c_datetime"],
  ["device", "c_device"],
  ["cursor", "c_cursor"],
];

/**
 * SELECT ساخته‌شده برای یک بار خواندن.
 *  - cursorType «number» / «datetime»: شرط روی ستون cursor با operator «>» یا «>=»
 *  - cursorType «auto» (بدون ستون پیگیری): پیگیری با خودِ ستون‌های تاریخ و ساعت تردد (مرتب‌سازی تاریخ، ساعت)؛ operator خالی = از ابتدای جدول
 */
export function buildQuery(dbType, source, limit, operator) {
  const cols = source.columns;
  const auto = source.cursorType === "auto";
  const n = Math.max(1, Math.min(50000, Math.trunc(Number(limit))));
  if (!cols?.userId || (!auto && !cols?.cursor)) throw new Error("ستون شناسه‌ی کاربر و ستون cursor الزامی است");
  if (!cols.dateTime && !(cols.date && cols.time)) throw new Error("یا ستون «تاریخ و ساعت» یا هر دو ستون «تاریخ» و «ساعت» لازم است");
  const select = LOGICAL.filter(([k]) => cols[k]).map(([k, alias]) => `${quote(dbType, cols[k])} AS ${alias}`).join(", ");
  const ph = (i) => (dbType === "mssql" ? `@p${i + 1}` : dbType === "mysql" ? "?" : `$${i + 1}`);
  const conds = [];
  let order;
  let cursorParams = 1;
  if (auto) {
    const dt = cols.dateTime ? [quote(dbType, cols.dateTime)] : [quote(dbType, cols.date), quote(dbType, cols.time)];
    order = dt.map((c) => `${c} ASC`).join(", ");
    cursorParams = operator ? (dt.length === 1 ? 1 : 3) : 0;
    if (operator) conds.push(dt.length === 1 ? `${dt[0]} >= ${ph(0)}` : `(${dt[0]} > ${ph(0)} OR (${dt[0]} = ${ph(1)} AND ${dt[1]} >= ${ph(2)}))`);
  } else {
    const cur = quote(dbType, cols.cursor);
    order = `${cur} ASC`;
    conds.push(`${cur} ${operator} ${ph(0)}`);
  }
  if (source.startValue) conds.push(`${quote(dbType, cols.dateTime || cols.date)} >= ${ph(cursorParams)}`); // «تاریخ شروع خواندن» (آخرین پارامتر)
  if (source.where && String(source.where).trim()) {
    const w = String(source.where).trim();
    if (/[;]|--|\/\*/.test(w)) throw new Error("شرط اضافه (where) نباید ; یا -- یا /* داشته باشد");
    conds.push(`(${w})`);
  }
  const whereSql = conds.length ? ` WHERE ${conds.join(" AND ")}` : "";
  const from = quote(dbType, source.table);
  if (dbType === "mssql") return `SELECT TOP (${n}) ${select} FROM ${from}${whereSql} ORDER BY ${order}`;
  return `SELECT ${select} FROM ${from}${whereSql} ORDER BY ${order} LIMIT ${n}`;
}

const wallToDate = (s) => new Date(`${s.replace(" ", "T")}Z`);

/** مقدار پارامتر cursor برای هر درایور (در حالت «auto» مقدار خام همان رشته‌ی ستون است و دیتابیس خودش تبدیل می‌کند) */
function cursorParam(dbType, cursorType, value) {
  if (cursorType === "auto") return String(value);
  if (cursorType === "number") return Number(value);
  const s = String(value);
  return dbType === "mssql" ? wallToDate(s) : s;
}

/** پارامترهای مقدار حد پایین (lowerBound) برای query؛ مقدار «تاریخ شروع» (در صورت وجود) آخر می‌آید و تبدیل نوع cursor روی آن اعمال نمی‌شود */
export function boundParams(lb, source) {
  const vals = lb.values ?? (lb.value === undefined ? [] : [lb.value]);
  return source?.startValue ? [...vals, { raw: source.startValue }] : vals;
}

const toParam = (dbType, cursorType, v) => (v && typeof v === "object" ? v.raw : cursorParam(dbType, cursorType, v));

/**
 * «تاریخ شروع خواندن» (source.startDate، میلادی) را با قالبی که ستون تاریخ همین دیتابیس دارد می‌نویسد (شمسی یا میلادی، جداکننده، ارقام فارسی یا انگلیسی)
 * تا مقایسه‌ی «تاریخ >= شروع» روی ستون متنی هم درست کار کند. قالب از یک ردیف نمونه‌ی جدول تشخیص داده می‌شود (جدول خالی: قالب پیش‌فرض).
 */
export async function prepareStart(src, source) {
  source.startValue = undefined;
  const iso = source.startDate ? normalizeStartDate(source.startDate) : "";
  if (!iso) return;
  const [gy, gm, gd] = iso.split("-").map(Number);
  let y = gy, m = gm, d = gd;
  if (source.dateFormat === "jalali") {
    const j = gregorianToJalali(gy, gm, gd);
    y = j.jy; m = j.jm; d = j.jd;
  }
  const raw = rawToString(await src.sampleDate());
  const en = toEnglishDigits(raw);
  let sep = source.dateFormat === "jalali" ? "/" : "-";
  let padded = true;
  const mm = en.match(/^(\d{4})([\/\-.])(\d{1,2})\2(\d{1,2})/);
  if (mm) {
    sep = mm[2];
    padded = !(mm[3].length === 1 || mm[4].length === 1);
  } else if (/^\d{8}/.test(en)) sep = "";
  const p = (n) => (padded ? String(n).padStart(2, "0") : String(n));
  let out = `${y}${sep}${p(m)}${sep}${p(d)}`;
  if (/[۰-۹]/.test(raw)) out = out.replace(/\d/g, (c) => "۰۱۲۳۴۵۶۷۸۹"[Number(c)]);
  source.startValue = out;
}

/** باز کردن منبع و آماده‌کردن «تاریخ شروع» (در صورت وجود) */
export async function openReady(db, source) {
  const src = await openSource(db, source);
  try {
    await prepareStart(src, source);
  } catch (e) {
    await src.close().catch(() => {});
    throw e;
  }
  return src;
}

export async function openSource(db, source) {
  const type = db.type;
  if (type === "mssql") {
    const sql = (await import("mssql")).default;
    const cfg = {
      server: db.host,
      database: db.database,
      user: db.user,
      password: db.password,
      options: { encrypt: false, trustServerCertificate: true, ...(db.options || {}) },
      requestTimeout: 60000,
      connectionTimeout: 15000,
    };
    if (db.port) cfg.port = Number(db.port);
    const pool = await new sql.ConnectionPool(cfg).connect();
    return {
      async query(text, params) {
        const r = pool.request();
        params.forEach((v, i) => r.input(`p${i + 1}`, toParam(type, source.cursorType, v)));
        return (await r.query(text)).recordset;
      },
      async sampleDate() {
        const c = quote(type, source.columns.dateTime || source.columns.date);
        return (await pool.request().query(`SELECT TOP 1 ${c} AS c_d FROM ${quote(type, source.table)} WHERE ${c} IS NOT NULL`)).recordset[0]?.c_d;
      },
      ping: async () => void (await pool.request().query("SELECT 1 AS ok")),
      close: () => pool.close(),
    };
  }
  if (type === "mysql") {
    const mysql = (await import("mysql2/promise")).default;
    const conn = await mysql.createConnection({ host: db.host, port: db.port ? Number(db.port) : 3306, user: db.user, password: db.password, database: db.database, dateStrings: true, connectTimeout: 15000 });
    return {
      async query(text, params) {
        const [rows] = await conn.execute(text, params.map((v) => toParam(type, source.cursorType, v)));
        return rows;
      },
      async sampleDate() {
        const c = quote(type, source.columns.dateTime || source.columns.date);
        const [rows] = await conn.query(`SELECT ${c} AS c_d FROM ${quote(type, source.table)} WHERE ${c} IS NOT NULL LIMIT 1`);
        return rows[0]?.c_d;
      },
      ping: async () => void (await conn.query("SELECT 1")),
      close: () => conn.end(),
    };
  }
  if (type === "postgres") {
    const pg = (await import("pg")).default;
    const raw = new Set([1082, 1083, 1114, 1184]); // date/time/timestamp → رشته‌ی خام (بدون تبدیل منطقه‌ی زمانی)
    const client = new pg.Client({
      host: db.host,
      port: db.port ? Number(db.port) : 5432,
      user: db.user,
      password: db.password,
      database: db.database,
      connectionTimeoutMillis: 15000,
      types: { getTypeParser: (oid, fmt) => (raw.has(oid) ? (v) => v : pg.types.getTypeParser(oid, fmt)) },
    });
    await client.connect();
    return {
      async query(text, params) {
        return (await client.query(text, params.map((v) => toParam(type, source.cursorType, v)))).rows;
      },
      async sampleDate() {
        const c = quote(type, source.columns.dateTime || source.columns.date);
        return (await client.query(`SELECT ${c} AS c_d FROM ${quote(type, source.table)} WHERE ${c} IS NOT NULL LIMIT 1`)).rows[0]?.c_d;
      },
      ping: async () => void (await client.query("SELECT 1")),
      close: () => client.end(),
    };
  }
  throw new Error(`نوع دیتابیس «${type}» پشتیبانی نمی‌شود (mssql | mysql | postgres)`);
}

/** cursor خام ستون → مقدار نگه‌داری‌شده در وضعیت (عدد یا «YYYY-MM-DD HH:mm:ss») */
export function cursorValue(cursorType, raw) {
  return cursorType === "number" ? Number(raw) : rawToString(raw);
}

/** ردیف‌های خام (با نام مستعار) → { raw: ردیف منطقی رشته‌ای، cursor } */
export function toLogical(rows, source) {
  return rows.map((r) => ({
    raw: {
      userId: rawToString(r.c_userid),
      date: rawToString(r.c_date),
      time: rawToString(r.c_time),
      dateTime: rawToString(r.c_datetime),
      device: rawToString(r.c_device),
    },
    cursor: source.cursorType === "auto" ? (source.columns.dateTime ? rawToString(r.c_datetime) : `${rawToString(r.c_date)}\t${rawToString(r.c_time)}`) : cursorValue(source.cursorType, r.c_cursor),
  }));
}

/**
 * حد پایین خواندن: عددی → «>» نسبت به آخرین cursor؛ زمانی → «>=» با هم‌پوشانی چند دقیقه (سرور ثبت تکراری را نادیده می‌گیرد)؛
 * «auto» (بدون ستون پیگیری) → از آخرین تاریخ و ساعتی که خوانده‌ایم به بعد («>=» روی ساعت؛ ردیف‌های هم‌زمانِ آخر دوباره خوانده و در ERP نادیده گرفته می‌شوند)
 */
export function lowerBound(source, state) {
  if (source.cursorType === "auto") {
    const start = state.cursor ?? (source.initialCursor ? String(source.initialCursor).trim() : "");
    if (!start) return { operator: null, values: [] }; // اولین بار و بدون نقطه‌ی شروع: از ابتدای جدول
    if (source.columns.dateTime) return { operator: ">=", values: [start] };
    let d, t;
    if (state.cursor != null) [d, t] = String(state.cursor).split("\t");
    else {
      const m = start.match(/^(\S+)\s+(.+)$/);
      d = m ? m[1] : start;
      t = m ? m[2] : "00:00:00";
    }
    return { operator: ">=", values: [d, d, t] };
  }
  if (source.cursorType === "number") return { value: state.cursor ?? source.initialCursor ?? 0, operator: ">" };
  if (state.cursor === null || state.cursor === undefined) {
    if (!source.initialCursor) throw new Error("برای cursor زمانی، «initialCursor» (مثلاً 2026-11-01 00:00:00) الزامی است");
    return { value: String(source.initialCursor), operator: ">=" };
  }
  const t = wallToDate(String(state.cursor)).getTime() - (source.overlapMinutes ?? 10) * 60000;
  const d = new Date(t);
  const p = (x) => String(x).padStart(2, "0");
  return { value: `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`, operator: ">=" };
}
