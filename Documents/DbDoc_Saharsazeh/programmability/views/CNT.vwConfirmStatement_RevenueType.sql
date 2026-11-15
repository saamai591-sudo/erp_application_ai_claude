CREATE VIEW  CNT.vwConfirmStatement_RevenueType
AS 
SELECT cs.ConfirmStatementID,
       cs.ContractID,
       cs.ContractStatementID,
       cs.Amount,
       cs.PaidAmount,
       cs.CurrencyRate,
       cs.PreVoucherID,
       cs.Number,
       cs.[Date],
       cs.FinancialPeriodID,
	   c.BranchID
FROM   CNT.ConfirmStatement  AS cs
       JOIN cnt.[Contract]   AS c
            ON  c.ContractID = cs.ContractID
WHERE  c.CompanyRoll = 2
