
CREATE VIEW [CNT].[VWNetContractStatementItem]
AS
SELECT a.FinancialPeriodID,
       b.ContractID,
       c.CurrencyID,
       b.BranchID,
       b.PartyID,
       d.ContractStatementItemID,
       c.Number,
       c.EndDate,
       a.[Date],
       c.ContractStatementID,
       a.ConfirmStatementID,
       d.Tax,
       d.Duty,
       d.Amount,
       d.RowIndex,
       a.CurrencyRate
FROM CNT.ConfirmStatement a
    JOIN CNT.Contract b
        ON a.ContractID = b.ContractID
    JOIN CNT.ContractStatement c
        ON c.ContractStatementID = a.ContractStatementID
    JOIN CNT.ContractStatementItem d
        ON c.ContractStatementID = d.ContractStatementID
WHERE b.StatementDeliverySection = 2
UNION ALL
SELECT a.FinancialPeriodID,
       b.ContractID,
       c.CurrencyID,
       b.BranchID,
       b.PartyID,
       d.ContractStatementItemID,
       c.Number,
       c.EndDate,
       a.[Date],
       c.ContractStatementID,
       a.ConfirmStatementID,
       d.Tax,
       d.Duty,
       d.Amount - ISNULL(oa.Amount, 0) Amount,
       d.RowIndex,
       a.CurrencyRate
FROM CNT.ConfirmStatement a
    JOIN CNT.Contract b
        ON a.ContractID = b.ContractID
    JOIN CNT.ContractStatement c
        ON c.ContractStatementID = a.ContractStatementID
    JOIN CNT.ContractStatementItem d
        ON c.ContractStatementID = d.ContractStatementID
    OUTER APPLY
(
    SELECT TOP (1)
           oa_d.ContractStatementItemID,
           oa_d.Amount
    FROM CNT.ContractStatement oa_c
        JOIN CNT.ContractStatementItem oa_d
            ON c.ContractStatementID = d.ContractStatementID
    WHERE oa_c.ContractID = b.ContractID
          AND oa_c.Number < c.Number
          AND oa_d.ContractSubjectID = d.ContractSubjectID
    ORDER BY oa_c.Number DESC
) oa
WHERE b.StatementDeliverySection = 1;
