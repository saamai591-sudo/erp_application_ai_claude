------------------------------------- END #7027
CREATE   PROC [STM].[SprptGainorloss]
(
	@EndDate Date,
	@FinanCialPeriodID INT
)

--WITH ENCRYPTION 
	 AS 
----------------------فاکتور فروش--------------------    
SELECT
(SELECT SUM (TotalNetPrice ) 
 FROM SLE.Invoice A 
where SaleInvoiceStatus<>2 
And 
((SELECT LOWER (configValue) From CFG.Configuration
  where ConfigKey='InvoiceNeedConfirm')='False'
  or A.SaleInvoiceStatus=3
 )
 And
  A.FinancialPeriodID=@FinanCialPeriodID
AND a.Date <= @EndDate
)As Invoice
-----------------------برگشت فروش-----------------------
,
(SELECT -SUM(TotalNetPrice )
FROM SLE.ReturnedSaleInvoice 
where FinancialPeriodID=@FinanCialPeriodID
AND Date <= @EndDate
) AS ReturnedSaleInvoice
--------------------------خرید--------------------
,
(SELECT -SUM (TotalNetPrice )
FROM vnd.PurchaseInvoice C
WHERE FinancialPeriodID=@FinanCialPeriodID
AND Date <= @EndDate
)AS PurchaseInvoice
-------------------------برگشت خرید--------------------
,(SELECT SUM (TotalNetPrice ) 
FROM vnd.ReturnInvoice D
 where FinancialPeriodID=@FinanCialPeriodID
 AND Date <= @EndDate
)AS ReturnInvoice
-----------------------------------------------
,
CFG.GetMaskCurrency(-1) AS CurrencyMask
,
(select -SUM (B.Amount)
 from FIN.PaymentSubject B
 join FIN.PaymentType t on B.PaymentTypeID = t.PaymentTypeID
left join ACC.vwaccounts A on A.SLID=t.SLID
join FIN.PaymentReceipt G on G.PaymentReceiptID=B.PaymentReceiptID
where PlCode=71
And g.FinancialPeriodID=@FinanCialPeriodID
 AND Date <= @EndDate
 And g.Status=0
) +
(select -SUM (b.Debit-b.Credit)
 from ACC.Voucher v
 join ACC.VoucherItem B on v.VoucherID=b.VoucherID
 join ACC.vwaccounts A on A.SLID=B.SlID

where PlCode=71
And v.FinancialPeriodID=@FinanCialPeriodID
 AND Date <= @EndDate
 And v.DocumentTypeID=1
)TotalCostAmount
,

(select Title from CFG.Currency where CurrencyID=-1)CurrencyTitle
 
,
(select CFG.GetSaturnDate(EndDate,0) from CFG.FinancialPeriod where FinancialPeriodID=@FinanCialPeriodID)EndDate;
