CREATE VIEW  CNT.vwConfirmStatement_CostType
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
       cs.FinancialPeriodID
FROM   CNT.ConfirmStatement  AS cs
       JOIN cnt.[Contract]   AS c
            ON  c.ContractID = cs.ContractID
WHERE  c.CompanyRoll = 1
