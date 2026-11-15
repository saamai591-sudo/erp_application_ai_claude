
-----------------------------------------
CREATE   VIEW [VND].[VWConfirmPurchaseInvoiceItemNonePayment]
AS 
with cte as
(
	select ConfirmPurchaseInvoiceItemID , Amount 
	from fin.PettyCashCostItem
	where ConfirmPurchaseInvoiceItemID is not null
	UNION ALL
	select ConfirmPurchaseInvoiceItemID , Amount 
	from CFG.DebitCreditNoteItem
	where ConfirmPurchaseInvoiceItemID is not null
	UNION ALL
	select ConfirmPurchaseInvoiceItemID , Amount 
	from FIN.PaymentSubject 
	where ConfirmPurchaseInvoiceItemID is not null
	UNION ALL
	select ConfirmPurchaseInvoiceItemID , Amount 
	from FOS.CreditAllocationItem 
	where ConfirmPurchaseInvoiceItemID is not null
)

SELECT	cpi.ConfirmPurchaseInvoiceItemID, 
		cpi.AdditionDeductionTypeID,
		cp.PurchaseInvoiceID,
		cpi.Deduction - cpi.Addition Net,
		ISNULL(d.Used,0) Done,
		cpi.Deduction - cpi.Addition - ISNULL(d.Used,0) AS NonPayment 
FROM VND.ConfirmPurchaseInvoiceItem cpi
join VND.ConfirmPurchaseInvoice cp on cpi.ConfirmPurchaseInvoiceID = cp.ConfirmPurchaseInvoiceID
LEFT JOIN
(
	select ConfirmPurchaseInvoiceItemID, SUM(Amount) AS Used 
	from CTE 
	group by ConfirmPurchaseInvoiceItemID 
) AS d on d.ConfirmPurchaseInvoiceItemID = cpi.ConfirmPurchaseInvoiceItemID
