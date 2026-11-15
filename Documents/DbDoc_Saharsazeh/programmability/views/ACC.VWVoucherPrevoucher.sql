
-------------------------------------- ReturnedSaleInvoiceHasFlow ---------------------------------------
CREATE   VIEW ACC.VWVoucherPrevoucher
AS
SELECT a.PrevoucherID,
       b.VoucherID,
       b.ReferenceNumber,
       b.Date,
       d.EngName,
       b.Number,
       c.FinancialPeriodID,
       CASE b.VoucherStatusID
           WHEN 1 THEN
               N'Record'
           WHEN 2 THEN
               N'Note'
           WHEN 3 THEN
               N'Survey'
           WHEN 4 THEN
               N'Confirm'
           ELSE
               N''
       END AS VoucherStatus,
	   d.Type
FROM
(
    SELECT VoucherID,
           PrevoucherID
    FROM ACC.VoucherPrevoucher
    GROUP BY VoucherID,
             PrevoucherID
) a
JOIN ACC.Voucher b
    ON a.VoucherID = b.VoucherID
JOIN ACC.PreVoucher c
    ON c.PreVoucherID = a.PrevoucherID
JOIN CFG.DocumentNumType d
    ON c.DocumentNumtypeID = d.DocumentNumTypeID;

