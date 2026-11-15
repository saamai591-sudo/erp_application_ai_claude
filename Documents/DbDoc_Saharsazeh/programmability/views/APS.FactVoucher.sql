

/************************************************************
 * Code formatted by SoftTree SQL Assistant © v9.2.349
 * Time: 10/4/2017 3:42:57 PM
 ************************************************************/

CREATE VIEW [APS].[FactVoucher]
AS 


SELECT vi.VoucherItemID,
       v.DocumentTypeID,
       v.BranchID,
       v.FinancialPeriodID,
       dd.DateId,
       v.VoucherStatusID,
       vi.CurrencyID,
       vi.CurrencyRate,
       vi.Debit,
       vi.Credit,
       vi.CurrencyDebit,
       vi.CurrencyCredit,
       v.VoucherID,
       vi.SlID
       
FROM   acc.Voucher                 AS v
       INNER JOIN acc.VoucherItem  AS vi
            ON  vi.VoucherID = v.VoucherID
       INNER JOIN cfg.DimDate      AS dd
            ON  dd.[Date] = v.[Date]
