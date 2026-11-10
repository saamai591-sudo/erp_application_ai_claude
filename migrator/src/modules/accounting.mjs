import { chunk, isoDay, toEnDigits } from "../util.mjs";

/**
 * ماژول حسابداری: سام (ACC.* / CFG.FinancialPeriod) → ERP.
 * ترتیب: سطح‌های حساب ← انواع سند ← دوره‌های مالی ← تفصیل‌ها ← حساب‌ها ← اسناد ← تطبیق.
 * همه‌ی مراحل idempotent‌اند؛ هر اجرا نگاشت شناسه‌ها را از پاسخ ERP دوباره می‌سازد (جدول نگاشت جدا لازم نیست).
 * طرح و تصمیم‌ها: Documents/مهاجرت از سام - مطالعه و طرح سند حسابداری.md
 */

// نوع تفصیل سام (ACC.DlType.DlTypeID) → نوع موجودیت ERP
const DL_KIND = {
  28: "PARTY", // طرف حساب
  27: "COST_CENTER", // مرکز هزینه
  2: "CASH_BOX", // صندوق
  1: "BANK_ACCOUNT", // حساب بانکی
  39: "PROJECT", // سایر پروژه‌ها
  45: "PROJECT", // تسهیلات (تصمیم: به پروژه می‌خورد)
  42: "PROJECT", // سایر
  48: "PROJECT", // قراردادها و سفارشات
};
// کد نوع تفصیل ERP برای هر نوع موجودیت (ثابت در seed)
const KIND_DETAIL_TYPE = { PARTY: 1, COST_CENTER: 2, CASH_BOX: 3, BANK_ACCOUNT: 4, PROJECT: 8 };

// نوع سند سام → کلید سیستمی ERP (بقیه با عنوان، به‌صورت نوع تعریف‌شده‌ی کاربر)
const DOC_SYSTEM_KEY = { 1: "OPERATIONAL", 2: "OPENING", 3: "CLOSING", 4: "CLOSING_ACCOUNTS" };

const GROUP_NATURE = { 2: "BALANCE_SHEET", 4: "PROFIT_LOSS", 5: "MEMORANDUM" };
const KOL_NATURE = { 9: "ASSET", 10: "LIABILITY", 12: "MEMORANDUM", 18: "LIABILITY", 19: "REVENUE", 20: "EXPENSE", 21: "EXPENSE", 22: "EXPENSE", 23: "EXPENSE", 24: "EXPENSE" };
const MOEIN_NATURE = { 13: "DEBIT", 14: "CREDIT", 15: "DEBIT" };

const normTitle = (s) => String(s ?? "").replace(/ي/g, "ی").replace(/ك/g, "ک").replace(/\s+/g, " ").trim();
const cutoverDate = (cutover) => new Date(`${cutover ?? "9999-12-31"}T00:00:00Z`);

export const accounting = {
  key: "accounting",
  title: "حسابداری",

  async run(ctx) {
    const { sam, erp, log, report, dryRun, cutover } = ctx;
    const warn = (where, message, extra = {}) => {
      log("warn", `${where}: ${message}`);
      report.add("warnings", { where, message, ...extra });
    };
    const fail = (where, message, extra = {}) => {
      log("error", `${where}: ${message}`);
      report.add("errors", { where, message, ...extra });
    };

    // ───── ۰) بررسی اولیه ─────
    log("step", "بررسی اولیه");
    const state = erp.offline ? null : await erp.state().catch((e) => {
      if (!dryRun) throw new Error(`API ورود داده در ERP پاسخ نداد (${e.message}) — ERP هدف باید نسخه‌ای باشد که ورود داده را دارد و کاربر باید مجوز «مهاجرت داده» را داشته باشد`);
      warn("preflight", `وضعیت ERP خوانده نشد (${e.message}); ادامه‌ی آزمایشی`);
      return null;
    });
    if (state) {
      log("info", `ERP: طرح دیتابیس ${state.schemaVersion}، ${state.counts.accounts} حساب، ${state.counts.journalEntries} سند، ${state.fiscalPeriods.length} دوره مالی`);
      if (!state.baseCurrency || state.baseCurrency.code !== "IRR") warn("preflight", `ارز پایه ERP «${state.baseCurrency?.title ?? "—"}» است؛ سام فقط ریالی است`);
    }
    const currencies = await sam.query("SELECT DISTINCT CurrencyID FROM ACC.VoucherItem");
    if (currencies.length !== 1 || Number(currencies[0].CurrencyID) !== -1) warn("preflight", `آرتیکل‌های سام ارزهای غیر ریال دارند (${currencies.map((c) => c.CurrencyID).join("، ")}); ارز‌ها در ERP نادیده و ریالی وارد می‌شوند`);
    if (cutover) log("info", `تاریخ قطع سام: ${cutover} (اسناد بعد از آن وارد نمی‌شوند)`);

    // ───── ۱) سطح‌های گزارشگری ─────
    log("step", "سطح‌های حساب");
    const slLevels = await sam.query("SELECT SlTreeLevelID, Title, LevelOrder, CodeLength FROM ACC.SlTreeLevel ORDER BY LevelOrder");
    const orderOfLevel = new Map(slLevels.map((l) => [l.SlTreeLevelID, l.LevelOrder]));
    if (!dryRun) await erp.reportingLevels(slLevels.map((l) => ({ order: l.LevelOrder, title: normTitle(l.Title), codeLength: l.CodeLength })));

    // ───── ۲) انواع سند ─────
    log("step", "انواع سند");
    const samDocTypes = await sam.query("SELECT DocumentTypeID, Title FROM ACC.DocumentType");
    const usedDocTypes = new Set((await sam.query("SELECT DISTINCT DocumentTypeID FROM ACC.Voucher")).map((r) => r.DocumentTypeID));
    const docTypeMap = new Map(); // سام → ERP
    const docItems = samDocTypes
      .filter((t) => DOC_SYSTEM_KEY[t.DocumentTypeID] || usedDocTypes.has(t.DocumentTypeID))
      .map((t) => ({ sourceId: t.DocumentTypeID, title: normTitle(t.Title), systemKey: DOC_SYSTEM_KEY[t.DocumentTypeID] ?? null }));
    if (dryRun) docItems.forEach((d) => docTypeMap.set(d.sourceId, d.sourceId));
    else for (const r of await erp.documentTypes(docItems)) docTypeMap.set(r.sourceId, r.id);
    log("info", `${docItems.length} نوع سند نگاشت شد`);

    // ───── ۳) دوره‌های مالی ─────
    log("step", "دوره‌های مالی");
    const samPeriods = (await sam.query("SELECT FinancialPeriodID, Title, StartDate, EndDate FROM CFG.FinancialPeriod ORDER BY StartDate")).filter((p) => !cutover || isoDay(p.StartDate) <= cutover);
    const periodTitle = new Map(); // شناسه‌ی سام → عنوان ERP
    const periodItems = samPeriods.map((p) => {
      const year = /\d{4}/.exec(toEnDigits(p.Title))?.[0];
      if (!year) throw new Error(`عنوان دوره‌ی مالی سام «${p.Title}» سال ۴ رقمی ندارد`);
      periodTitle.set(p.FinancialPeriodID, year);
      return { title: year, fromDate: isoDay(p.StartDate), toDate: isoDay(p.EndDate) };
    });
    if (!dryRun) await erp.fiscalPeriods(periodItems);
    log("info", `${periodItems.length} دوره مالی (${periodItems[0]?.title} تا ${periodItems.at(-1)?.title})`);

    // ───── ۴) تفصیل‌ها ─────
    log("step", "تفصیل‌ها");
    const dlTypes = new Map((await sam.query("SELECT DlTypeID, Title FROM ACC.DlType")).map((t) => [t.DlTypeID, normTitle(t.Title)]));
    const dls = await sam.query("SELECT DLID, DlTypeID, Code, Title, IsActive FROM ACC.DL ORDER BY DlTypeID, Code");
    const knownDl = new Set(); // کدهای تفصیلی که در ERP هستند (یا در حالت آزمایشی خواهند بود)
    const dlKindByCode = new Map(); // کد تفصیل → نوع موجودیت (برای کشف ناهمخوانی نوع تفصیل ردیف با حساب)
    const byKind = new Map();
    const skippedTypes = new Map();
    for (const d of dls) {
      const kind = DL_KIND[d.DlTypeID];
      if (!kind) {
        skippedTypes.set(d.DlTypeID, (skippedTypes.get(d.DlTypeID) ?? 0) + 1);
        continue;
      }
      const item = { code: String(d.Code).trim(), title: normTitle(d.Title), isActive: !!d.IsActive };
      dlKindByCode.set(item.code, kind);
      if (kind === "PROJECT") item.description = `منشأ سام: ${dlTypes.get(d.DlTypeID) ?? d.DlTypeID}`;
      if (!byKind.has(kind)) byKind.set(kind, []);
      byKind.get(kind).push(item);
    }
    for (const [t, n] of skippedTypes) warn("details", `نوع تفصیل «${dlTypes.get(t) ?? t}» (${n} مورد) نگاشتی ندارد و وارد نمی‌شود`, { dlType: t });
    // ترتیب مهم است: همه‌ی کدهای سام اول ثبت می‌شوند و حساب بانکیِ جایگزین (بانک نامشخص) آخر، تا کدش با کد سام برخورد نکند
    for (const kind of ["PARTY", "COST_CENTER", "CASH_BOX", "PROJECT", "BANK_ACCOUNT"]) {
      const items = byKind.get(kind) ?? [];
      let created = 0;
      for (const part of chunk(items, 500)) {
        if (dryRun) {
          part.forEach((i) => knownDl.add(i.code));
          continue;
        }
        const r = await erp.details(kind, part);
        created += r.results.filter((x) => x.created).length;
        r.results.forEach((x) => knownDl.add(x.code));
        r.errors.forEach((e) => fail(`details/${kind}`, e.message, { code: e.code }));
      }
      log("info", `${kind}: ${items.length} تفصیل${dryRun ? "" : ` (${created} جدید)`}`);
    }

    // ───── ۵) حساب‌ها ─────
    log("step", "درخت حساب‌ها");
    const sl = await sam.query("SELECT SlID, ParentID, Code, Title, BalanceTypeID, SlTreeLevelID FROM ACC.SL");
    const slDl = new Map((await sam.query("SELECT SlID, DlTypeID FROM ACC.AccountLevelSL WHERE DlTypeID IS NOT NULL")).map((r) => [r.SlID, r.DlTypeID]));
    const children = new Map();
    for (const r of sl) children.set(r.ParentID, [...(children.get(r.ParentID) ?? []), r]);
    const levelOrder = (r) => orderOfLevel.get(r.SlTreeLevelID);

    // ماهیت «کل»: از سام + اصلاح با ماهیت مانده‌ی معین‌های زیرش (فیلد کل در سام برای بسیاری از حساب‌ها یکنواخت است)
    const moeinsOf = (kol) => (children.get(kol.SlID) ?? []).filter((m) => levelOrder(m) === 3);
    const kolNature = (kol, groupNature) => {
      if (groupNature === "MEMORANDUM") return "MEMORANDUM";
      let n = KOL_NATURE[kol.BalanceTypeID];
      const ms = moeinsOf(kol);
      const credit = ms.filter((m) => MOEIN_NATURE[m.BalanceTypeID] === "CREDIT").length;
      const majorityCredit = ms.length > 0 && credit * 2 > ms.length;
      if (groupNature === "BALANCE_SHEET" && (n === "ASSET" || n === "LIABILITY" || !n)) n = majorityCredit ? "LIABILITY" : "ASSET";
      if (groupNature === "PROFIT_LOSS" && (n === "REVENUE" || n === "EXPENSE" || n === "ASSET" || !n)) n = majorityCredit ? "REVENUE" : "EXPENSE";
      return n ?? "MEMORANDUM";
    };

    const roots = sl.filter((r) => levelOrder(r) === undefined && r.ParentID == null);
    const groups = roots.flatMap((root) => (children.get(root.SlID) ?? []).filter((g) => levelOrder(g) === 1));
    const accountId = new Map(); // SlID → شناسه‌ی ERP (در حالت آزمایشی: خود SlID)
    const level3 = []; // معین‌های سام (برای تطبیق)
    const accKind = new Map(); // SlID معین → نوع موجودیت تفصیل فعلی حساب
    let accCreated = 0;

    const sendAccounts = async (items) => {
      if (!items.length) return;
      if (dryRun) {
        items.forEach((i) => accountId.set(Number(i.key), Number(i.key)));
        return;
      }
      const r = await erp.accounts(items);
      for (const x of r.results) {
        accountId.set(Number(x.key), x.id);
        if (x.created) accCreated++;
      }
      r.errors.forEach((e) => fail("accounts", e.message, { slId: e.key }));
    };

    const groupItems = groups.map((g) => ({ key: String(g.SlID), parentId: null, code: String(g.Code).trim(), title: normTitle(g.Title), natureGroup: GROUP_NATURE[g.BalanceTypeID] ?? "MEMORANDUM" }));
    groups.forEach((g) => {
      if (!GROUP_NATURE[g.BalanceTypeID]) warn("accounts", `ماهیت گروه «${g.Title}» (نوع ${g.BalanceTypeID}) ناشناخته است؛ «انتظامی» ثبت شد`, { slId: g.SlID });
    });
    await sendAccounts(groupItems);

    const kolItems = [];
    const moeinItems = [];
    for (const g of groups) {
      const gNature = GROUP_NATURE[g.BalanceTypeID] ?? "MEMORANDUM";
      for (const kol of (children.get(g.SlID) ?? []).filter((k) => levelOrder(k) === 2)) {
        kolItems.push({ key: String(kol.SlID), parentId: accountId.get(g.SlID) ?? null, code: String(kol.Code).trim(), title: normTitle(kol.Title), natureDetail: kolNature(kol, gNature) });
      }
    }
    // پدر کل‌ها باید قبل از ارسال معلوم باشد (گروه‌ها فرستاده شده‌اند)
    for (const it of kolItems) if (it.parentId == null) fail("accounts", `گروه والد کل «${it.title}» ساخته نشد`, { slId: it.key });
    await sendAccounts(kolItems.filter((i) => i.parentId != null));

    for (const g of groups) {
      for (const kol of (children.get(g.SlID) ?? []).filter((k) => levelOrder(k) === 2)) {
        for (const m of moeinsOf(kol)) {
          const dlType = slDl.get(m.SlID);
          let detailTypeCodes;
          if (dlType != null) {
            const kind = DL_KIND[dlType];
            if (!kind) fail("accounts", `نوع تفصیل «${dlTypes.get(dlType) ?? dlType}» حساب «${m.Title}» نگاشتی ندارد`, { slId: m.SlID });
            else {
              detailTypeCodes = [KIND_DETAIL_TYPE[kind]];
              accKind.set(m.SlID, kind);
            }
          }
          if (!MOEIN_NATURE[m.BalanceTypeID]) warn("accounts", `ماهیت مانده‌ی معین «${m.Title}» ناشناخته است؛ «بدهکار» ثبت شد`, { slId: m.SlID });
          else if (m.BalanceTypeID === 15) warn("accounts", `ماهیت مانده‌ی معین «${m.Title}» در سام «مهم نیست» است؛ «بدهکار» ثبت شد`, { slId: m.SlID });
          moeinItems.push({ key: String(m.SlID), parentId: accountId.get(kol.SlID) ?? null, code: String(m.Code).trim(), title: normTitle(m.Title), balanceNature: MOEIN_NATURE[m.BalanceTypeID] ?? "DEBIT", detailTypeCodes });
          level3.push(m);
        }
      }
    }
    for (const part of chunk(moeinItems.filter((i) => i.parentId != null), 300)) await sendAccounts(part);
    log("info", `حساب‌ها: ${groups.length} گروه، ${kolItems.length} کل، ${moeinItems.length} معین${dryRun ? "" : ` (${accCreated} جدید)`}`);
    report.stat("accounts", { groups: groups.length, kols: kolItems.length, moeins: moeinItems.length });

    // ───── ۶) اسناد ─────
    log("step", "اسناد حسابداری");
    const totals = { entries: 0, lines: 0, created: 0, skipped: 0, errors: 0, warnings: 0 };
    const cut = cutoverDate(cutover);
    for (const p of samPeriods) {
      const title = periodTitle.get(p.FinancialPeriodID);
      const vouchers = await sam.query(
        "SELECT VoucherID, Number, ReferenceNumber, DailyNumber, Date, DocumentTypeID, Description FROM ACC.Voucher WHERE FinancialPeriodID = @p AND Date <= @cut ORDER BY Number",
        { p: p.FinancialPeriodID, cut }
      );
      const items = await sam.query(
        `SELECT vi.VoucherID, vi.VoucherItemIndex, vi.SlID, vi.Description, vi.Debit, vi.Credit, dl.Code AS DlCode
         FROM ACC.VoucherItem vi
         JOIN ACC.Voucher v ON v.VoucherID = vi.VoucherID
         LEFT JOIN ACC.AccountLevelVoucherItem a ON a.VoucherItemID = vi.VoucherItemID
         LEFT JOIN ACC.DL dl ON dl.DLID = a.DlID
         WHERE v.FinancialPeriodID = @p AND v.Date <= @cut
         ORDER BY vi.VoucherID, vi.VoucherItemIndex`,
        { p: p.FinancialPeriodID, cut }
      );
      const itemsByVoucher = new Map();
      for (const it of items) {
        if (!itemsByVoucher.has(it.VoucherID)) itemsByVoucher.set(it.VoucherID, []);
        itemsByVoucher.get(it.VoucherID).push(it);
      }
      totals.entries += vouchers.length;
      totals.lines += items.length;

      const payload = [];
      for (const v of vouchers) {
        const docTypeId = docTypeMap.get(v.DocumentTypeID);
        const rows = itemsByVoucher.get(v.VoucherID) ?? [];
        const where = `سند ${title}/${v.Number}`;
        if (docTypeId == null) { fail(where, `نوع سند ${v.DocumentTypeID} نگاشت نشده است`, { period: title, number: v.Number }); totals.errors++; continue; }
        const lines = [];
        let bad = "";
        for (const r of rows) {
          const accId = accountId.get(r.SlID);
          if (accId == null) { bad = `حساب سام ${r.SlID} در ERP ساخته نشده است`; break; }
          const code = r.DlCode == null ? null : String(r.DlCode).trim();
          lines.push({ accountId: accId, detail1Code: code, debit: Number(r.Debit) || 0, credit: Number(r.Credit) || 0, description: r.Description || null, rowOrder: r.VoucherItemIndex });
        }
        if (bad) { fail(where, bad, { period: title, number: v.Number }); totals.errors++; continue; }
        payload.push({ fiscalPeriodTitle: title, number: v.Number, referenceNumber: v.ReferenceNumber, dailyNumber: v.DailyNumber, date: isoDay(v.Date), documentTypeId: docTypeId, description: v.Description || null, lines });
      }

      if (dryRun) {
        // ناهمخوانی نوع تفصیل ردیف با نوع فعلی حساب (در حالت واقعی، ERP همین هشدار را برمی‌گرداند)
        for (const v of vouchers) {
          for (const r of itemsByVoucher.get(v.VoucherID) ?? []) {
            const code = r.DlCode == null ? null : String(r.DlCode).trim();
            const want = accKind.get(r.SlID);
            const got = code ? dlKindByCode.get(code) : null;
            const msg = want && !code ? "حساب تفصیل دارد ولی ردیف بدون تفصیل است" : !want && code ? `ردیف تفصیل «${code}» دارد ولی حساب فعلی تفصیل ندارد` : want && got && want !== got ? `نوع تفصیل ردیف (${got}) با نوع فعلی حساب (${want}) نمی‌خواند` : "";
            if (msg) {
              totals.warnings++;
              report.add("warnings", { where: `سند ${title}/${v.Number}`, message: `ردیف ${r.VoucherItemIndex}: ${msg}`, period: title, number: v.Number, slId: r.SlID, dlCode: code });
            }
          }
        }
        // بررسی محلی: تراز بودن و وجود تفصیل
        for (const e of payload) {
          const d = e.lines.reduce((s, l) => s + l.debit, 0);
          const c = e.lines.reduce((s, l) => s + l.credit, 0);
          if (Math.abs(d - c) > 0.01) { fail(`سند ${title}/${e.number}`, `سند تراز نیست (${d} / ${c})`, { period: title, number: e.number }); totals.errors++; }
          for (const l of e.lines) if (l.detail1Code && !knownDl.has(l.detail1Code)) { fail(`سند ${title}/${e.number}`, `تفصیل «${l.detail1Code}» در فهرست تفصیل‌ها نیست`, { period: title, number: e.number }); totals.errors++; break; }
        }
        log("progress", `دوره ${title}: ${payload.length} سند بررسی شد`);
        continue;
      }

      let done = 0;
      for (const part of chunk(payload, ctx.batchSize)) {
        const r = await erp.journalEntries(part);
        totals.created += r.created;
        totals.skipped += r.skipped;
        totals.errors += r.errors.length;
        totals.warnings += r.warningsTotal;
        r.errors.forEach((e) => fail(`سند ${e.period}/${e.number}`, e.message, { period: e.period, number: e.number }));
        r.warnings.forEach((w) => report.add("warnings", { where: `سند ${w.period}/${w.number}`, message: `ردیف ${w.row}: ${w.message}`, period: w.period, number: w.number }));
        done += part.length;
        log("progress", `دوره ${title}: ${done}/${payload.length}`);
      }
      log("info", `دوره ${title}: ${vouchers.length} سند در سام`);
    }
    report.stat("vouchers", totals);
    log("info", dryRun ? `آزمایشی: ${totals.entries} سند و ${totals.lines} آرتیکل خوانده شد، ${totals.errors} خطا، ${totals.warnings} ردیف با تفصیل ناهمخوان` : `اسناد: ${totals.created} جدید، ${totals.skipped} موجود، ${totals.errors} خطا، ${totals.warnings} هشدار`);

    // ───── ۷) تطبیق ─────
    if (dryRun) return;
    log("step", "گزارش تطبیق (سام در برابر ERP)");
    const slOfErp = new Map([...accountId].map(([s, e]) => [e, s]));
    let mismatches = 0;
    for (const p of samPeriods) {
      const title = periodTitle.get(p.FinancialPeriodID);
      const [t] = await sam.query(
        "SELECT COUNT(DISTINCT v.VoucherID) AS entries, COUNT(*) AS lines, SUM(vi.Debit) AS debit, SUM(vi.Credit) AS credit FROM ACC.Voucher v JOIN ACC.VoucherItem vi ON vi.VoucherID = v.VoucherID WHERE v.FinancialPeriodID = @p AND v.Date <= @cut",
        { p: p.FinancialPeriodID, cut }
      );
      const perAcc = await sam.query(
        "SELECT vi.SlID, SUM(vi.Debit) AS debit, SUM(vi.Credit) AS credit FROM ACC.Voucher v JOIN ACC.VoucherItem vi ON vi.VoucherID = v.VoucherID WHERE v.FinancialPeriodID = @p AND v.Date <= @cut GROUP BY vi.SlID",
        { p: p.FinancialPeriodID, cut }
      );
      const e = await erp.periodTotals(title, true);
      const diff = (a, b) => Math.abs(Number(a ?? 0) - Number(b ?? 0)) > 0.5;
      const head = { period: title, samEntries: t.entries, erpEntries: e.entries, samLines: t.lines, erpLines: e.lines, samDebit: Number(t.debit ?? 0), erpDebit: e.debit, samCredit: Number(t.credit ?? 0), erpCredit: e.credit };
      const bad = Number(t.entries) !== e.entries || Number(t.lines) !== e.lines || diff(t.debit, e.debit) || diff(t.credit, e.credit);
      const erpByAcc = new Map(e.accounts.map((a) => [slOfErp.get(a.accountId), a]));
      const badAcc = [];
      for (const a of perAcc) {
        const x = erpByAcc.get(a.SlID);
        if (!x || diff(a.debit, x.debit) || diff(a.credit, x.credit)) badAcc.push({ slId: a.SlID, samDebit: Number(a.debit), erpDebit: x?.debit ?? 0, samCredit: Number(a.credit), erpCredit: x?.credit ?? 0 });
      }
      report.add("reconcile", { ...head, status: bad || badAcc.length ? "ناهمخوان" : "مطابق", badAccounts: badAcc.length });
      for (const b of badAcc) report.add("reconcile", { period: title, status: "حساب ناهمخوان", ...b });
      if (bad || badAcc.length) {
        mismatches++;
        fail("reconcile", `دوره ${title} ناهمخوان است (سند ${t.entries}/${e.entries}، بدهکار ${head.samDebit}/${head.erpDebit}، حساب‌های ناهمخوان ${badAcc.length})`, { period: title });
      } else log("info", `دوره ${title}: مطابق (${t.entries} سند، بدهکار ${head.samDebit.toLocaleString("en-US")})`);
    }
    report.stat("reconcileMismatches", mismatches);
    log(mismatches ? "error" : "info", mismatches ? `${mismatches} دوره ناهمخوان است` : "همه‌ی دوره‌ها مطابق است ✔");
  },
};
