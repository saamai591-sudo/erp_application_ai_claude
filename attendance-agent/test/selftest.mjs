import { initJournal, closeJournal, recordSent, recordBad, recordEvent, summary, listBatches, listPunches, listEvents, journalEnabled } from "../src/journal.mjs";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { convertRow, toEnglishDigits } from "../src/convert.mjs";
import { gregorianToJalali, jalaliToGregorian } from "../src/jalali.mjs";
import { buildQuery, lowerBound } from "../src/source.mjs";
import { normalizeStartDate, resolveConfig } from "../src/config.mjs";

// آزمون بدون شبکه و بدون دیتابیس: تبدیل تاریخ/ساعت و ساخت SELECT. اجرا: npm run selftest

const g = (y, m, d) => {
  const r = jalaliToGregorian(y, m, d);
  return `${r.gy}-${String(r.gm).padStart(2, "0")}-${String(r.gd).padStart(2, "0")}`;
};
// نمونه‌های شناخته‌شده‌ی تقویم
assert.equal(g(1378, 10, 11), "2000-01-01");
assert.equal(g(1400, 1, 1), "2021-03-21");
assert.equal(g(1405, 1, 1), "2026-03-21");
assert.equal(g(1403, 12, 30), "2025-03-20"); // سال کبیسه
assert.equal(g(1405, 8, 20), "2026-11-11");
assert.throws(() => jalaliToGregorian(1404, 12, 30)); // 1404 کبیسه نیست
assert.throws(() => jalaliToGregorian(1405, 7, 31));

const cfgJ = { dateFormat: "jalali" };
const cfgG = { dateFormat: "gregorian" };
assert.deepEqual(convertRow({ userId: "۱۲۳", date: "1405/08/20", time: "8:05:33" }, cfgJ), { deviceUserId: "123", date: "2026-11-11", time: "08:05" });
assert.deepEqual(convertRow({ userId: "5", date: "14050820", time: "0805" }, cfgJ), { deviceUserId: "5", date: "2026-11-11", time: "08:05" });
assert.deepEqual(convertRow({ userId: "5", date: "2026-11-11", time: "830" }, cfgG), { deviceUserId: "5", date: "2026-11-11", time: "08:30" });
assert.deepEqual(convertRow({ userId: "5", dateTime: "2026-11-11 17:45:10", device: "درب" }, cfgG), { deviceUserId: "5", date: "2026-11-11", time: "17:45", deviceName: "درب" });
assert.deepEqual(convertRow({ userId: "5", dateTime: "2026-11-11T17:45:10.000Z" }, cfgG), { deviceUserId: "5", date: "2026-11-11", time: "17:45" });
assert.throws(() => convertRow({ userId: "", date: "2026-11-11", time: "08:00" }, cfgG), /شناسه/);
assert.throws(() => convertRow({ userId: "1", date: "2026-02-30", time: "08:00" }, cfgG), /نامعتبر/);
assert.throws(() => convertRow({ userId: "1", date: "2026-11-11", time: "25:00" }, cfgG), /نامعتبر/);
assert.equal(toEnglishDigits("۰۱۲٣"), "0123");

const src = { table: "dbo.Traffic", columns: { userId: "UserID", date: "TDate", time: "TTime", device: "Dev", cursor: "ID" }, cursorType: "number" };
assert.equal(buildQuery("mssql", src, 100, ">"), "SELECT TOP (100) [UserID] AS c_userid, [TDate] AS c_date, [TTime] AS c_time, [Dev] AS c_device, [ID] AS c_cursor FROM [dbo].[Traffic] WHERE [ID] > @p1 ORDER BY [ID] ASC");
assert.equal(buildQuery("postgres", src, 5, ">="), 'SELECT "UserID" AS c_userid, "TDate" AS c_date, "TTime" AS c_time, "Dev" AS c_device, "ID" AS c_cursor FROM "dbo"."Traffic" WHERE "ID" >= $1 ORDER BY "ID" ASC LIMIT 5');
assert.match(buildQuery("mysql", { ...src, where: "Deleted = 0" }, 5, ">"), /WHERE `ID` > \? AND \(Deleted = 0\) ORDER BY/);
assert.throws(() => buildQuery("mssql", { ...src, table: "a; DROP TABLE x" }, 5, ">"), /مجاز نیست/);
assert.throws(() => buildQuery("mssql", { ...src, where: "1=1; DELETE FROM x" }, 5, ">"), /نباید/);
assert.throws(() => buildQuery("mssql", { ...src, where: "1=1 -- x" }, 5, ">"), /نباید/);
assert.throws(() => buildQuery("mssql", { ...src, columns: { userId: "U", cursor: "ID" } }, 5, ">"), /ستون/);

// بدون ستون پیگیری (auto): پیگیری با تاریخ و ساعت تردد
const auto = { table: "dbo.TimeRecords", columns: { userId: "CardNo", date: "RDATE", time: "RTime" }, cursorType: "auto" };
assert.equal(buildQuery("mssql", auto, 100, ">="), "SELECT TOP (100) [CardNo] AS c_userid, [RDATE] AS c_date, [RTime] AS c_time FROM [dbo].[TimeRecords] WHERE ([RDATE] > @p1 OR ([RDATE] = @p2 AND [RTime] >= @p3)) ORDER BY [RDATE] ASC, [RTime] ASC");
assert.equal(buildQuery("postgres", auto, 5, null), 'SELECT "CardNo" AS c_userid, "RDATE" AS c_date, "RTime" AS c_time FROM "dbo"."TimeRecords" ORDER BY "RDATE" ASC, "RTime" ASC LIMIT 5');
assert.deepEqual(lowerBound(auto, { cursor: null }), { operator: null, values: [] });
assert.deepEqual(lowerBound({ ...auto, initialCursor: "1405/08/10 08:00" }, { cursor: null }), { operator: ">=", values: ["1405/08/10", "1405/08/10", "08:00"] });
assert.deepEqual(lowerBound(auto, { cursor: "2026-11-10	08:30:00" }), { operator: ">=", values: ["2026-11-10", "2026-11-10", "08:30:00"] });
assert.deepEqual(lowerBound({ ...auto, columns: { userId: "U", dateTime: "DT" }, initialCursor: "2026-11-01" }, { cursor: null }), { operator: ">=", values: ["2026-11-01"] });
assert.doesNotThrow(() => resolveConfig({ server: { url: "http://x", token: "t" }, db: { type: "mssql", host: "h", database: "d", user: "u" }, source: { table: "T", columns: { userId: "U", date: "D", time: "T" }, cursorType: "auto" } }));
assert.throws(() => resolveConfig({ server: { url: "http://x", token: "t" }, db: { type: "mssql", host: "h", database: "d", user: "u" }, source: { table: "T", columns: { userId: "", date: "D", time: "T" }, cursorType: "number" } }), /ستون شناسه‌ی کاربر.*ستون پیگیری/);
assert.deepEqual(lowerBound({ cursorType: "number", initialCursor: 0 }, { cursor: null }), { value: 0, operator: ">" });
assert.deepEqual(lowerBound({ cursorType: "number" }, { cursor: 42 }), { value: 42, operator: ">" });
assert.deepEqual(lowerBound({ cursorType: "datetime", initialCursor: "2026-11-01 00:00:00" }, { cursor: null }), { value: "2026-11-01 00:00:00", operator: ">=" });
assert.deepEqual(lowerBound({ cursorType: "datetime", overlapMinutes: 10 }, { cursor: "2026-11-11 08:05:00" }), { value: "2026-11-11 07:55:00", operator: ">=" });
assert.throws(() => lowerBound({ cursorType: "datetime" }, { cursor: null }), /initialCursor/);

// تاریخ شروع خواندن: شمسی/میلادی/ارقام فارسی، و شرط اضافه‌ی «تاریخ >= شروع» به عنوان آخرین پارامتر
assert.deepEqual(gregorianToJalali(2026, 3, 21), { jy: 1405, jm: 1, jd: 1 });
assert.equal(normalizeStartDate("1405/01/01"), "2026-03-21");
assert.equal(normalizeStartDate("۱۴۰۵-۰۱-۰۱"), "2026-03-21");
assert.equal(normalizeStartDate("2026-03-21"), "2026-03-21");
assert.equal(normalizeStartDate(""), "");
assert.equal(normalizeStartDate("2026-02-30"), null);
assert.equal(normalizeStartDate("abc"), null);
assert.equal(buildQuery("mssql", { ...src, startValue: "2022/10/28" }, 5, ">"), "SELECT TOP (5) [UserID] AS c_userid, [TDate] AS c_date, [TTime] AS c_time, [Dev] AS c_device, [ID] AS c_cursor FROM [dbo].[Traffic] WHERE [ID] > @p1 AND [TDate] >= @p2 ORDER BY [ID] ASC");
assert.ok(buildQuery("postgres", { ...auto, startValue: "2022/10/28" }, 5, ">=").includes('WHERE ("RDATE" > $1 OR ("RDATE" = $2 AND "RTime" >= $3)) AND "RDATE" >= $4 ORDER BY'));
assert.ok(buildQuery("postgres", { ...auto, startValue: "2022/10/28" }, 5, null).includes('WHERE "RDATE" >= $1 ORDER BY'));
assert.throws(() => resolveConfig({ server: { url: "http://x", token: "t" }, db: { type: "mssql", host: "h", database: "d", user: "u" }, source: { table: "T", columns: { userId: "U", date: "D", time: "T" }, cursorType: "auto", startDate: "xx" } }), /تاریخ شروع خواندن/);

// ژورنال محلی (نیاز به SQLite داخلی Node ≥ 22.5؛ در Node قدیمی‌تر رد می‌شود)
if (await initJournal(fs.mkdtempSync(path.join(os.tmpdir(), "agj-")))) {
  const pu = [{ deviceUserId: "0000090041", date: "2026-11-10", time: "08:01", deviceName: "1" }, { deviceUserId: "0000090029", date: "2026-11-10", time: "08:05", deviceName: "1" }];
  recordSent(pu, [{ userId: "0000090041" }, { userId: "0000090029" }], { newRows: 2, duplicates: 0, accepted: 1, pending: 1, rejected: 0, invalid: [] });
  recordSent([pu[1]], [{ userId: "0000090029" }], { newRows: 0, duplicates: 1, accepted: 1, pending: 0, rejected: 0, invalid: [] });
  recordBad({ userId: "9", date: "xx", time: "1" }, "قالب نامعتبر");
  recordEvent("ERROR", "خطای آزمایشی");
  const sm = summary();
  assert.equal(sm.enabled, true);
  assert.equal(sm.batches, 2);
  assert.equal(sm.sentPunches, 2);
  assert.equal(sm.badPunches, 1);
  assert.equal(sm.errors24h, 1);
  assert.equal(listBatches(1, 10).total, 2);
  assert.equal(listPunches(1, 10, "0000090029").rows[0].times, 2);
  assert.equal(listPunches(1, 10, "", "BAD").total, 1);
  assert.equal(listPunches(1, 10, "2026-11").total, 2);
  assert.equal(listEvents(1, 10, "ERROR").rows[0].message, "خطای آزمایشی");
  assert.equal(journalEnabled(), true);
  closeJournal();
} else console.log("selftest: ژورنال رد شد (SQLite در این Node نیست)");

console.log("selftest: همه‌ی آزمون‌ها گذشتند");
