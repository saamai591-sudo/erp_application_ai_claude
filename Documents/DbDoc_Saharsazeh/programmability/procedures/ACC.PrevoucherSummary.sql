-----------Start of #7464

CREATE   PROCEDURE [ACC].PrevoucherSummary
(
@VoucherItemID INT	
)
--WITH ENCRYPTION 

AS



SELECT     PreVoucherItemID, 
		   pvi.PreVoucherID, 
		   acc.SlFullCode(SlID) AS SlFullCode , 
		   pvi.Description, 
		   pvi.Description2, 
		   Debit, 
		   Credit, 
		   CurrencyRate, 
		   CurrencyDebit, 
		   CurrencyCredit, 
		   c.Title AS CurrencyTitle,
		   CASE WHEN pr.PaymentOrderID is NOT NULL then 'PaymentWithOrder' else  dnt.EngName End AS DocumentNumType
		   
FROM         ACC.PreVoucherItem AS pvi
JOIN acc.PreVoucher pv ON pv.PreVoucherID = pvi.PreVoucherID
JOIN cfg.Currency c ON c.CurrencyID = pvi.CurrencyID
JOIN cfg.DocumentNumType dnt ON pv.DocumentNumtypeID = dnt.DocumentNumTypeID
left join fin.PaymentReceipt AS pr on pv.PreVoucherID = pr.PreVoucherID and dnt.EngName = 'PaymentReceipt'
WHERE pvi.PreVoucherItemID IN (
SELECT PrevoucherItemID FROM acc.VoucherPrevoucher vp
WHERE vp.VoucherItemID = @VoucherItemID)


SELECT * FROM acc.PreVoucherItemAccountLevel pvial
WHERE pvial.PreVoucherItemID  IN (
SELECT PrevoucherItemID FROM acc.VoucherPrevoucher vp
WHERE vp.VoucherItemID = @VoucherItemID)
