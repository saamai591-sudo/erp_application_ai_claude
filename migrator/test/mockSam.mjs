/** سام جعلی کوچک برای تست موتور (همان شکل نتیجه‌ی کوئری‌های ماژول حسابداری) */
const d = (s) => new Date(`${s}T00:00:00Z`);

export function makeMockSam() {
  const levels = [
    { SlTreeLevelID: 1, Title: "گروه", LevelOrder: 1, CodeLength: 2 },
    { SlTreeLevelID: 2, Title: "کل", LevelOrder: 2, CodeLength: 2 },
    { SlTreeLevelID: 4, Title: "معین", LevelOrder: 3, CodeLength: 2 },
  ];
  const sl = [
    { SlID: -1, ParentID: null, Code: "00", Title: "حسابها", BalanceTypeID: 2, SlTreeLevelID: null },
    { SlID: 11, ParentID: -1, Code: "01", Title: "دارایی‌های جاری", BalanceTypeID: 2, SlTreeLevelID: 1 },
    { SlID: 12, ParentID: 11, Code: "01", Title: "نقد و بانک", BalanceTypeID: 9, SlTreeLevelID: 2 },
    { SlID: 13, ParentID: 12, Code: "01", Title: "بانک", BalanceTypeID: 13, SlTreeLevelID: 4 },
    { SlID: 14, ParentID: 12, Code: "02", Title: "حسابهای دریافتنی", BalanceTypeID: 13, SlTreeLevelID: 4 },
    { SlID: 21, ParentID: -1, Code: "02", Title: "بدهی", BalanceTypeID: 2, SlTreeLevelID: 1 },
    { SlID: 22, ParentID: 21, Code: "01", Title: "پرداختنی", BalanceTypeID: 9, SlTreeLevelID: 2 },
    { SlID: 23, ParentID: 22, Code: "01", Title: "حسابهای پرداختنی", BalanceTypeID: 14, SlTreeLevelID: 4 },
    { SlID: 31, ParentID: -1, Code: "03", Title: "درآمد", BalanceTypeID: 4, SlTreeLevelID: 1 },
    { SlID: 32, ParentID: 31, Code: "01", Title: "فروش", BalanceTypeID: 19, SlTreeLevelID: 2 },
    { SlID: 33, ParentID: 32, Code: "01", Title: "فروش داخلی", BalanceTypeID: 14, SlTreeLevelID: 4 },
  ];
  const slDl = [
    { SlID: 13, DlTypeID: 1 },
    { SlID: 14, DlTypeID: 28 },
    { SlID: 23, DlTypeID: 28 },
  ];
  const dlTypes = [
    { DlTypeID: 1, Title: "حساب بانکی" },
    { DlTypeID: 28, Title: "طرف حساب" },
    { DlTypeID: 45, Title: "تسهیلات" },
  ];
  const dls = [
    { DLID: 1, DlTypeID: 1, Code: "001", Title: "بانک ملت جاری ۱۲۳", IsActive: true },
    { DLID: 2, DlTypeID: 28, Code: "10000", Title: "شرکت الف", IsActive: true },
    { DLID: 3, DlTypeID: 28, Code: "10001", Title: "شرکت ب", IsActive: false },
    { DLID: 4, DlTypeID: 45, Code: "80100", Title: "تسهیلات ۱", IsActive: true },
  ];
  const docTypes = [
    { DocumentTypeID: 1, Title: "عملیاتی" },
    { DocumentTypeID: 2, Title: "افتتاحیه" },
    { DocumentTypeID: 9, Title: "هزینه های تولید" },
  ];
  const periods = [
    { FinancialPeriodID: 8, Title: "1389", StartDate: d("2010-03-21"), EndDate: d("2011-03-20") },
    { FinancialPeriodID: 9, Title: "1390", StartDate: d("2011-03-21"), EndDate: d("2012-03-19") },
  ];
  const vouchers = [
    { VoucherID: 1, FinancialPeriodID: 8, Number: 1, ReferenceNumber: 1, DailyNumber: 1, Date: d("2010-03-21"), DocumentTypeID: 2, Description: "افتتاحیه" },
    { VoucherID: 2, FinancialPeriodID: 8, Number: 2, ReferenceNumber: 2, DailyNumber: 1, Date: d("2010-05-01"), DocumentTypeID: 1, Description: "فروش" },
    { VoucherID: 3, FinancialPeriodID: 9, Number: 1, ReferenceNumber: 1, DailyNumber: 1, Date: d("2011-04-01"), DocumentTypeID: 9, Description: "هزینه تولید" },
  ];
  const mk = (id, i, SlID, Description, Debit, Credit, DlCode) => ({ VoucherID: id, VoucherItemIndex: i, SlID, Description, Debit, Credit, DlCode });
  const items = [
    mk(1, 1, 13, "افتتاحیه بانک", 5000, 0, "001"),
    mk(1, 2, 23, "افتتاحیه", 0, 5000, "10000"),
    mk(2, 1, 14, "فروش نسیه", 1200, 0, "10000"),
    mk(2, 2, 33, "فروش", 0, 1200, null),
    mk(3, 1, 13, "هزینه", 300, 0, "001"),
    mk(3, 2, 23, "هزینه", 0, 300, "10001"),
  ];
  const inPeriod = (p, cut) => (v) => v.FinancialPeriodID === p && v.Date <= cut;
  const idsOf = (params) => new Set(vouchers.filter(inPeriod(params.p, params.cut)).map((v) => v.VoucherID));

  return {
    async query(text, params = {}) {
      const t = text.replace(/\s+/g, " ").trim();
      if (/FROM ACC\.SlTreeLevel/.test(t)) return levels;
      if (/FROM ACC\.DocumentType$/.test(t)) return docTypes;
      if (/DISTINCT DocumentTypeID FROM ACC\.Voucher/.test(t)) return [...new Set(vouchers.map((v) => v.DocumentTypeID))].map((x) => ({ DocumentTypeID: x }));
      if (/DISTINCT CurrencyID/.test(t)) return [{ CurrencyID: -1 }];
      if (/FROM CFG\.FinancialPeriod/.test(t)) return periods;
      if (/FROM ACC\.DlType$/.test(t)) return dlTypes;
      if (/FROM ACC\.DL ORDER/.test(t)) return dls;
      if (/FROM ACC\.SL$/.test(t)) return sl;
      if (/FROM ACC\.AccountLevelSL/.test(t)) return slDl;
      if (/FROM ACC\.Voucher WHERE FinancialPeriodID/.test(t)) return vouchers.filter(inPeriod(params.p, params.cut));
      if (/LEFT JOIN ACC\.AccountLevelVoucherItem/.test(t)) {
        const ok = idsOf(params);
        return items.filter((i) => ok.has(i.VoucherID));
      }
      if (/COUNT\(DISTINCT v\.VoucherID\)/.test(t)) {
        const ok = idsOf(params);
        const its = items.filter((i) => ok.has(i.VoucherID));
        return [{ entries: ok.size, lines: its.length, debit: its.reduce((s, i) => s + i.Debit, 0), credit: its.reduce((s, i) => s + i.Credit, 0) }];
      }
      if (/GROUP BY vi\.SlID/.test(t)) {
        const ok = idsOf(params);
        const m = new Map();
        for (const i of items.filter((i) => ok.has(i.VoucherID))) {
          const x = m.get(i.SlID) ?? { SlID: i.SlID, debit: 0, credit: 0 };
          x.debit += i.Debit;
          x.credit += i.Credit;
          m.set(i.SlID, x);
        }
        return [...m.values()];
      }
      throw new Error("کوئری ناشناخته در سام جعلی: " + t.slice(0, 80));
    },
    close: async () => {},
  };
}
