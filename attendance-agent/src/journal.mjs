import path from "node:path";

// ژورنال محلی عامل (agent-journal.db، SQLite داخلی Node): برای صفحه‌ی «وضعیت و رکوردها» نگه می‌دارد که چه ردیف‌هایی از دستگاه خوانده و به ERP ارسال شده،
// هر ارسال چه نتیجه‌ای داشته و چه خطاهایی رخ داده. کار اصلی عامل به آن وابسته نیست: اگر SQLite در دسترس نباشد (Node قدیمی) یا نوشتن خطا بدهد، فقط ژورنال کار نمی‌کند.
// رمز و توکن هرگز در ژورنال نمی‌آیند. نگه‌داری: ردیف‌ها ۱۸۰ روز، ارسال‌ها ۱۸۰ روز، خطاها ۹۰ روز.

let db = null;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS batch (
  id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, rows INTEGER NOT NULL,
  new_rows INTEGER, duplicates INTEGER, accepted INTEGER, pending INTEGER, rejected INTEGER, invalid INTEGER,
  first_punch TEXT, last_punch TEXT
);
CREATE TABLE IF NOT EXISTS punch (
  id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, date TEXT NOT NULL, time TEXT NOT NULL, device TEXT, raw TEXT,
  status TEXT NOT NULL, note TEXT, first_at TEXT NOT NULL, last_at TEXT NOT NULL, times INTEGER NOT NULL DEFAULT 1, batch_id INTEGER,
  UNIQUE (user_id, date, time, status)
);
CREATE INDEX IF NOT EXISTS punch_last_at ON punch (last_at);
CREATE INDEX IF NOT EXISTS punch_user ON punch (user_id);
CREATE TABLE IF NOT EXISTS event (id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, level TEXT NOT NULL, message TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS event_at ON event (at);
`;

const now = () => new Date().toISOString();
const safe = (fn) => {
  try {
    return fn();
  } catch {
    return undefined;
  }
};

/** ژورنال را در پوشه‌ی وضعیت باز می‌کند؛ true = در دسترس */
export async function initJournal(dir) {
  if (db) return true;
  try {
    const { DatabaseSync } = await import("node:sqlite");
    db = new DatabaseSync(path.join(dir, "agent-journal.db"));
    db.exec("PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL;");
    db.exec(SCHEMA);
    return true;
  } catch {
    db = null;
    return false;
  }
}

export const journalEnabled = () => db !== null;

export function closeJournal() {
  safe(() => db?.close());
  db = null;
}

/** ردیف‌های ارسال‌شده در یک دسته: punches (قالب ERP)، raws (ردیف خام دیتابیس، هم‌ترتیب)، result (پاسخ سرور) */
export function recordSent(punches, raws, result) {
  if (!db || !punches.length) return;
  safe(() => {
    const t = now();
    db.exec("BEGIN");
    try {
      const ordered = [...punches].map((p) => `${p.date} ${p.time}`).sort();
      const b = db
        .prepare("INSERT INTO batch (at, rows, new_rows, duplicates, accepted, pending, rejected, invalid, first_punch, last_punch) VALUES (?,?,?,?,?,?,?,?,?,?)")
        .run(t, punches.length, result?.newRows ?? null, result?.duplicates ?? null, result?.accepted ?? null, result?.pending ?? null, result?.rejected ?? null, result?.invalid?.length ?? 0, ordered[0], ordered[ordered.length - 1]);
      const up = db.prepare(
        "INSERT INTO punch (user_id, date, time, device, raw, status, first_at, last_at, times, batch_id) VALUES (?,?,?,?,?,'SENT',?,?,1,?) " +
          "ON CONFLICT (user_id, date, time, status) DO UPDATE SET last_at = excluded.last_at, times = times + 1, batch_id = excluded.batch_id, device = excluded.device",
      );
      punches.forEach((p, i) => up.run(String(p.deviceUserId), p.date, p.time, p.deviceName ?? null, raws?.[i] ? JSON.stringify(raws[i]) : null, t, t, Number(b.lastInsertRowid)));
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  });
}

/** ردیفی که قابل تبدیل نبود و ارسال نشد */
export function recordBad(rawRow, message) {
  if (!db) return;
  safe(() => {
    const t = now();
    db.prepare(
      "INSERT INTO punch (user_id, date, time, device, raw, status, note, first_at, last_at, times) VALUES (?,?,?,?,?,'BAD',?,?,?,1) " +
        "ON CONFLICT (user_id, date, time, status) DO UPDATE SET last_at = excluded.last_at, times = times + 1, note = excluded.note",
    ).run(String(rawRow?.userId ?? ""), String(rawRow?.date || rawRow?.dateTime || ""), String(rawRow?.time ?? ""), rawRow?.device ?? null, JSON.stringify(rawRow), message, t, t);
  });
}

export function recordEvent(level, message) {
  if (!db) return;
  safe(() => db.prepare("INSERT INTO event (at, level, message) VALUES (?,?,?)").run(now(), level, String(message).slice(0, 2000)));
}

/** حذف سابقه‌های قدیمی (هر دور اجرا یک بار) */
export function pruneJournal() {
  if (!db) return;
  safe(() => {
    const ago = (days) => new Date(Date.now() - days * 86400000).toISOString();
    db.prepare("DELETE FROM punch WHERE last_at < ?").run(ago(180));
    db.prepare("DELETE FROM batch WHERE at < ?").run(ago(180));
    db.prepare("DELETE FROM event WHERE at < ?").run(ago(90));
  });
}

const page = (n, size) => ({ limit: size, offset: (Math.max(1, Number(n) || 1) - 1) * size });

/** خلاصه‌ی وضعیت برای صفحه */
export function summary() {
  if (!db) return { enabled: false };
  return (
    safe(() => {
      const one = (sql, ...a) => db.prepare(sql).get(...a);
      const day = new Date(Date.now() - 86400000).toISOString();
      return {
        enabled: true,
        batches: one("SELECT COUNT(*) AS n FROM batch").n,
        sentPunches: one("SELECT COUNT(*) AS n FROM punch WHERE status = 'SENT'").n,
        badPunches: one("SELECT COUNT(*) AS n FROM punch WHERE status = 'BAD'").n,
        errors24h: one("SELECT COUNT(*) AS n FROM event WHERE level = 'ERROR' AND at >= ?", day).n,
        warnings24h: one("SELECT COUNT(*) AS n FROM event WHERE level = 'WARN' AND at >= ?", day).n,
        lastBatch: one("SELECT at, rows, first_punch, last_punch FROM batch ORDER BY id DESC LIMIT 1") ?? null,
        lastError: one("SELECT at, message FROM event WHERE level = 'ERROR' ORDER BY id DESC LIMIT 1") ?? null,
        lastPunch: one("SELECT user_id, date, time FROM punch WHERE status = 'SENT' ORDER BY date DESC, time DESC LIMIT 1") ?? null,
      };
    }) ?? { enabled: false }
  );
}

export function listBatches(n, size = 50) {
  if (!db) return { rows: [], total: 0 };
  return safe(() => ({ total: db.prepare("SELECT COUNT(*) AS n FROM batch").get().n, rows: db.prepare("SELECT * FROM batch ORDER BY id DESC LIMIT ? OFFSET ?").all(...Object.values(page(n, size))) })) ?? { rows: [], total: 0 };
}

/** ردیف‌ها با جست‌وجو (شناسه‌ی کارت یا تاریخ) و فیلتر وضعیت SENT | BAD */
export function listPunches(n, size = 50, q = "", status = "") {
  if (!db) return { rows: [], total: 0 };
  return (
    safe(() => {
      const where = [];
      const args = [];
      if (status === "SENT" || status === "BAD") {
        where.push("status = ?");
        args.push(status);
      }
      const text = String(q || "").trim();
      if (text) {
        where.push("(user_id LIKE ? OR date LIKE ? OR note LIKE ?)");
        args.push(`%${text}%`, `%${text}%`, `%${text}%`);
      }
      const w = where.length ? ` WHERE ${where.join(" AND ")}` : "";
      const total = db.prepare(`SELECT COUNT(*) AS n FROM punch${w}`).get(...args).n;
      const p = page(n, size);
      const rows = db.prepare(`SELECT id, user_id, date, time, device, raw, status, note, first_at, last_at, times, batch_id FROM punch${w} ORDER BY date DESC, time DESC, id DESC LIMIT ? OFFSET ?`).all(...args, p.limit, p.offset);
      return { total, rows };
    }) ?? { rows: [], total: 0 }
  );
}

export function listEvents(n, size = 50, level = "") {
  if (!db) return { rows: [], total: 0 };
  return (
    safe(() => {
      const w = level === "ERROR" || level === "WARN" ? " WHERE level = ?" : "";
      const a = w ? [level] : [];
      const p = page(n, size);
      return { total: db.prepare(`SELECT COUNT(*) AS n FROM event${w}`).get(...a).n, rows: db.prepare(`SELECT * FROM event${w} ORDER BY id DESC LIMIT ? OFFSET ?`).all(...a, p.limit, p.offset) };
    }) ?? { rows: [], total: 0 }
  );
}
