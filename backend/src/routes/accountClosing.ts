import { Router } from "express";
import { prisma } from "../lib/prisma";
import { resolveDetailTitles } from "../utils/detailValues";
import { issueJournalEntry, IssueLineInput } from "../services/journalEntryService";
import { computeFullAccountCode } from "../utils/accountCode";

const router = Router();

async function rootNatureGroup(accountId: number, byId: Map<number, any>): Promise<string | null> {
  let cur = byId.get(accountId);
  while (cur) {
    if (!cur.parentId) return cur.natureGroup || null;
    const parent = byId.get(cur.parentId);
    if (!parent) return cur.natureGroup || null;
    cur = parent;
  }
  return null;
}

// حسابهای سود و زیانیِ دارای مانده تا تاریخ مشخص‌شده، به تفکیک حساب و تفصیل‌ها
router.get("/available-lines", async (req, res) => {
  const toDate = req.query.toDate as string;
  if (!toDate) return res.status(400).json({ error: "تاریخ مشخص نشده است" });

  const date = new Date(toDate);
  const fiscalPeriod = await prisma.fiscalPeriod.findFirst({ where: { fromDate: { lte: date }, toDate: { gte: date } } });
  if (!fiscalPeriod) return res.status(400).json({ error: "این تاریخ در هیچ دوره مالی تعریف نشده است" });

  const baseCurrency = await prisma.currency.findFirst({ where: { isBase: true } });
  if (!baseCurrency) return res.status(400).json({ error: "ارز پایه تعریف نشده است" });

  const allAccounts = await prisma.account.findMany();
  const byId = new Map<number, any>(allAccounts.map((a: any) => [a.id, a]));
  const leafIds = new Set<number>(allAccounts.map((a: any) => a.id));
  for (const a of allAccounts) if ((a as any).parentId) leafIds.delete((a as any).parentId);

  const plAccountIds: number[] = [];
  for (const id of leafIds) {
    const group = await rootNatureGroup(id, byId);
    if (group === "PROFIT_LOSS") plAccountIds.push(id);
  }
  if (plAccountIds.length === 0) return res.json([]);

  const entryWhere = { fiscalPeriodId: fiscalPeriod.id, date: { lte: date } };

  const baseGroups: any[] = await prisma.journalEntryLine.groupBy({
    by: ["accountId", "detail1Code", "detail2Code", "detail3Code"],
    where: { accountId: { in: plAccountIds }, journalEntry: entryWhere },
    _sum: { baseDebit: true, baseCredit: true },
  } as any);

  const fxGroups: any[] = await prisma.journalEntryLine.groupBy({
    by: ["accountId", "detail1Code", "detail2Code", "detail3Code", "currencyId"],
    where: { accountId: { in: plAccountIds }, currencyId: { not: baseCurrency.id }, journalEntry: entryWhere },
    _sum: { debit: true, credit: true },
  } as any);

  const codes = baseGroups.flatMap((g) => [g.detail1Code, g.detail2Code, g.detail3Code]);
  const titles = await resolveDetailTitles(codes);

  const results = baseGroups
    .map((g) => {
      const account = byId.get(g.accountId);
      const debit = Number(g._sum.baseDebit || 0);
      const credit = Number(g._sum.baseCredit || 0);
      if (debit === credit) return null; // فقط حسابهای دارای مانده

      const fx = fxGroups.find(
        (f) => f.accountId === g.accountId && f.detail1Code === g.detail1Code && f.detail2Code === g.detail2Code && f.detail3Code === g.detail3Code
      );
      const fxDebitRaw = fx ? Number(fx._sum.debit || 0) : 0;
      const fxCreditRaw = fx ? Number(fx._sum.credit || 0) : 0;

      // فقط مانده (نتِ گردش بدهکار/بستانکار) نمایش داده شود، نه جمع خام گردش هر دو طرف
      const baseBalance = debit - credit;
      const fxBalance = fxDebitRaw - fxCreditRaw;

      return {
        id: `${g.accountId}-${g.detail1Code || ""}-${g.detail2Code || ""}-${g.detail3Code || ""}`,
        accountId: g.accountId,
        code: account ? computeFullAccountCode(g.accountId, byId) : undefined,
        title: account?.title,
        isCurrency: account?.isCurrency || false,
        detail1Code: g.detail1Code,
        detail1Title: g.detail1Code ? titles[g.detail1Code] : null,
        detail2Code: g.detail2Code,
        detail2Title: g.detail2Code ? titles[g.detail2Code] : null,
        detail3Code: g.detail3Code,
        detail3Title: g.detail3Code ? titles[g.detail3Code] : null,
        debit: baseBalance > 0 ? baseBalance : 0,
        credit: baseBalance < 0 ? Math.abs(baseBalance) : 0,
        debitFx: fxBalance > 0 ? fxBalance : 0,
        creditFx: fxBalance < 0 ? Math.abs(fxBalance) : 0,
        currencyId: fx ? fx.currencyId : baseCurrency.id,
      };
    })
    .filter(Boolean);

  res.json(results);
});

router.get("/", async (_req, res) => {
  const items = await prisma.accountClosing.findMany({
    include: { destinationAccount: true, journalEntry: true, lines: true },
    orderBy: { id: "desc" },
  });
  const allAccounts = await prisma.account.findMany({ select: { id: true, code: true, parentId: true } });
  const byId = new Map<number, any>(allAccounts.map((a: any) => [a.id, a]));
  res.json(
    items.map((c: any) => ({
      id: c.id,
      number: c.number,
      date: c.date,
      description: c.description,
      totalDebit: Number(c.totalDebit),
      totalCredit: Number(c.totalCredit),
      difference: Number(c.difference),
      destinationAccount: { id: c.destinationAccount.id, code: computeFullAccountCode(c.destinationAccount.id, byId), title: c.destinationAccount.title },
      issued: !!c.journalEntryId,
      journalEntryId: c.journalEntryId,
      journalEntryReferenceNumber: c.journalEntry?.referenceNumber ?? null,
      lineCount: c.lines.length,
    }))
  );
});

router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const c = await prisma.accountClosing.findUnique({
    where: { id },
    include: {
      destinationAccount: true,
      journalEntry: true,
      lines: { include: { account: true, currency: true } },
    },
  });
  if (!c) return res.status(404).json({ error: "سند بستن حسابها یافت نشد" });

  const allAccounts = await prisma.account.findMany({ select: { id: true, code: true, parentId: true } });
  const byId = new Map<number, any>(allAccounts.map((a: any) => [a.id, a]));

  const codes = [c.detail1Code, c.detail2Code, c.detail3Code, ...c.lines.flatMap((l: any) => [l.detail1Code, l.detail2Code, l.detail3Code])].filter(
    (x): x is string => !!x
  );
  const titles = await resolveDetailTitles(codes);

  res.json({
    id: c.id,
    number: c.number,
    date: c.date,
    fiscalPeriodId: c.fiscalPeriodId,
    description: c.description,
    destinationAccountId: c.destinationAccountId,
    destinationAccount: { id: c.destinationAccount.id, code: computeFullAccountCode(c.destinationAccount.id, byId), title: c.destinationAccount.title },
    detail1Code: c.detail1Code,
    detail1Title: c.detail1Code ? titles[c.detail1Code] : null,
    detail2Code: c.detail2Code,
    detail2Title: c.detail2Code ? titles[c.detail2Code] : null,
    detail3Code: c.detail3Code,
    detail3Title: c.detail3Code ? titles[c.detail3Code] : null,
    totalDebit: Number(c.totalDebit),
    totalCredit: Number(c.totalCredit),
    difference: Number(c.difference),
    issued: !!c.journalEntryId,
    journalEntryId: c.journalEntryId,
    lines: c.lines.map((l: any) => ({
      accountId: l.accountId,
      code: computeFullAccountCode(l.accountId, byId),
      title: l.account.title,
      detail1Code: l.detail1Code,
      detail1Title: l.detail1Code ? titles[l.detail1Code] : null,
      detail2Code: l.detail2Code,
      detail2Title: l.detail2Code ? titles[l.detail2Code] : null,
      detail3Code: l.detail3Code,
      detail3Title: l.detail3Code ? titles[l.detail3Code] : null,
      currencyId: l.currencyId,
      currencyTitle: l.currency.title,
      debit: Number(l.debit),
      credit: Number(l.credit),
      fxRate: Number(l.fxRate),
      baseDebit: Number(l.baseDebit),
      baseCredit: Number(l.baseCredit),
    })),
  });
});

interface LineInput {
  accountId: number;
  detail1Code?: string | null;
  detail2Code?: string | null;
  detail3Code?: string | null;
  currencyId: number;
  debit: number;
  credit: number;
  fxRate: number;
  baseDebit: number;
  baseCredit: number;
}

router.post("/", async (req, res) => {
  const body = req.body as {
    date: string;
    destinationAccountId: number;
    detail1Code?: string | null;
    detail2Code?: string | null;
    detail3Code?: string | null;
    description: string;
    lines: LineInput[];
  };

  if (!body.date || !body.destinationAccountId) return res.status(400).json({ error: "تاریخ و حساب مقصد الزامی است" });
  if (!body.description || !body.description.trim()) return res.status(400).json({ error: "شرح الزامی است" });
  if (!Array.isArray(body.lines) || body.lines.length === 0) return res.status(400).json({ error: "حداقل یک حساب باید انتخاب شود" });

  try {
    const destAccount = await prisma.account.findUnique({ where: { id: body.destinationAccountId } });
    if (!destAccount) return res.status(400).json({ error: "حساب مقصد یافت نشد" });
    if (destAccount.isCurrency) return res.status(400).json({ error: "حساب مقصد نباید ارزی باشد" });

    const date = new Date(body.date);
    const fiscalPeriod = await prisma.fiscalPeriod.findFirst({ where: { fromDate: { lte: date }, toDate: { gte: date } } });
    if (!fiscalPeriod) return res.status(400).json({ error: "این تاریخ در هیچ دوره مالی تعریف نشده است" });

    const totalDebit = body.lines.reduce((s, l) => s + Number(l.baseDebit || 0), 0);
    const totalCredit = body.lines.reduce((s, l) => s + Number(l.baseCredit || 0), 0);
    const difference = totalCredit - totalDebit;

    const lastNumber = await prisma.accountClosing.findFirst({ where: { fiscalPeriodId: fiscalPeriod.id }, orderBy: { number: "desc" } });
    const number = lastNumber ? lastNumber.number + 1 : 1;

    const created = await prisma.accountClosing.create({
      data: {
        fiscalPeriodId: fiscalPeriod.id,
        number,
        date,
        destinationAccountId: body.destinationAccountId,
        detail1Code: body.detail1Code || null,
        detail2Code: body.detail2Code || null,
        detail3Code: body.detail3Code || null,
        description: body.description,
        totalDebit,
        totalCredit,
        difference,
        lines: {
          create: body.lines.map((l) => ({
            accountId: l.accountId,
            detail1Code: l.detail1Code || null,
            detail2Code: l.detail2Code || null,
            detail3Code: l.detail3Code || null,
            currencyId: l.currencyId,
            debit: l.debit,
            credit: l.credit,
            fxRate: l.fxRate,
            baseDebit: l.baseDebit,
            baseCredit: l.baseCredit,
          })),
        },
      },
    });

    res.status(201).json(created);
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در ذخیره" });
  }
});

router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const c = await prisma.accountClosing.findUnique({ where: { id } });
  if (!c) return res.status(404).json({ error: "یافت نشد" });
  if (c.journalEntryId) return res.status(400).json({ error: "سند صادرشده قابل حذف نیست" });
  await prisma.accountClosing.delete({ where: { id } });
  res.status(204).send();
});

// گردش جایگزین: صدور سند حسابداری معکوس‌کننده
router.post("/:id/issue", async (req, res) => {
  const id = Number(req.params.id);
  const c = await prisma.accountClosing.findUnique({
    where: { id },
    include: { lines: true },
  });
  if (!c) return res.status(404).json({ error: "سند بستن حسابها یافت نشد" });
  if (c.journalEntryId) return res.status(400).json({ error: "قبلاً برای این سند، حسابداری صادر شده است" });

  try {
    const docType = await prisma.documentType.findFirst({ where: { systemKey: "CLOSING_ACCOUNTS" } });
    if (!docType) return res.status(400).json({ error: "نوع سند «بستن حسابها» در سیستم تعریف نشده است" });

    const baseCurrency = await prisma.currency.findFirst({ where: { isBase: true } });
    if (!baseCurrency) return res.status(400).json({ error: "ارز پایه تعریف نشده است" });

    // ردیفهای معکوس: بدهکار<->بستانکار و بدهکار ارزی<->بستانکار ارزی، با همان کد حساب/تفصیل/ارز و شرح مرحله ۳
    const reversedLines: IssueLineInput[] = c.lines.map((l: any) => ({
      accountId: l.accountId,
      detail1Code: l.detail1Code,
      detail2Code: l.detail2Code,
      detail3Code: l.detail3Code,
      currencyId: l.currencyId,
      debit: Number(l.credit),
      credit: Number(l.debit),
      fxRate: Number(l.fxRate),
      description: c.description,
    }));

    const difference = Number(c.difference);
    if (Math.abs(difference) > 0.005) {
      reversedLines.push({
        accountId: c.destinationAccountId,
        detail1Code: c.detail1Code,
        detail2Code: c.detail2Code,
        detail3Code: c.detail3Code,
        currencyId: baseCurrency.id,
        debit: difference < 0 ? Math.abs(difference) : 0,
        credit: difference > 0 ? difference : 0,
        fxRate: 1,
        description: c.description,
      });
    }

    const entry = await issueJournalEntry({
      date: c.date,
      documentTypeId: docType.id,
      description: c.description,
      issuingSystem: "ACCOUNT_CLOSING",
      isManual: false,
      lines: reversedLines,
      sources: [{ label: `بستن حسابها شماره ${c.number}`, path: `/account-closing/${c.id}` }],
    });

    await prisma.accountClosing.update({ where: { id }, data: { journalEntryId: entry.id } });

    res.json({ journalEntryId: entry.id });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در صدور سند" });
  }
});

// حذف سند حسابداریِ صادرشده برای این عملیات بستن حسابها (امکان صدور مجدد بعد از حذف)
router.delete("/:id/journal-entry", async (req, res) => {
  const id = Number(req.params.id);
  const c = await prisma.accountClosing.findUnique({ where: { id } });
  if (!c) return res.status(404).json({ error: "سند بستن حسابها یافت نشد" });
  if (!c.journalEntryId) return res.status(400).json({ error: "برای این عملیات سندی صادر نشده است" });

  try {
    await prisma.$transaction([
      prisma.accountClosing.update({ where: { id }, data: { journalEntryId: null } }),
      prisma.journalEntry.delete({ where: { id: c.journalEntryId } }),
    ]);
    res.status(204).send();
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در حذف سند" });
  }
});

export default router;
