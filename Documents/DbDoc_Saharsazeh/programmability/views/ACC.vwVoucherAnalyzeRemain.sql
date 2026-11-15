CREATE   VIEW [ACC].[vwVoucherAnalyzeRemain]
AS
SELECT vi.VoucherItemID,
       ISNULL(vi.Debit, 0) + ISNULL(vi.Credit, 0) - ISNULL(used1.Amount, 0) - ISNULL(used2.Amount, 0) AS remain
FROM ACC.VoucherItem AS vi
    LEFT JOIN
    (
        SELECT va.DebitVoucherItemID AS VoucherItemID,
               SUM(va.Amount) Amount
        FROM ACC.VoucherAnalyze AS va
        WHERE va.DebitVoucherItemID IS NOT NULL
        GROUP BY va.DebitVoucherItemID
    ) AS used1
        ON used1.VoucherItemID = vi.VoucherItemID
    LEFT JOIN
    (
        SELECT va.CreditVoucherItemID AS VoucherItemID,
               SUM(va.Amount) Amount
        FROM ACC.VoucherAnalyze AS va
        WHERE va.CreditVoucherItemID IS NOT NULL
        GROUP BY CreditVoucherItemID
    ) AS used2
        ON used2.VoucherItemID = vi.VoucherItemID;
