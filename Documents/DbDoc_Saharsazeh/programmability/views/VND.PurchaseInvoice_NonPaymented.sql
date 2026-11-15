
CREATE   VIEW [VND].PurchaseInvoice_NonPaymented
AS

with cte as
(
    SELECT s.PurchaseInvoiceID,
            SUM(Amount) Amount
    FROM   FIN.PaymentSubject s
	join fin.PaymentReceipt pr on s.PaymentReceiptID = pr.PaymentReceiptID
    WHERE  s.PurchaseInvoiceID IS NOT NULL
	and pr.Status <> 2
    GROUP BY s.PurchaseInvoiceID

	UNION ALL

    SELECT PurchaseInvoiceID,
            SUM(Price) Amount
    FROM   VND.PurchaseInvoicePrePayment
    GROUP BY PurchaseInvoiceID

	UNION ALL

    SELECT PurchaseInvoiceID,
            SUM(Deduction) Amount
    FROM   cnt.ConfirmStatementItem
	where PurchaseInvoiceID is not null
    GROUP BY PurchaseInvoiceID

	UNION ALL

    SELECT p.PurchaseInvoiceID,
            SUM(Amount) Amount
    FROM   FIN.PettyCashCostItem p
    WHERE  p.PurchaseInvoiceID IS NOT NULL
    GROUP BY p.PurchaseInvoiceID

	UNION ALL

	SELECT p.PurchaseInvoiceID,
			SUM(Amount) Amount
	FROM   cfg.ManualReceipt  p
	WHERE  p.PurchaseInvoiceID IS NOT NULL
	GROUP BY p.PurchaseInvoiceID

	UNION ALL

	select PurchaseInvoiceID,
			sum(Amount) as Amount
	from CFG.DebitCreditNoteItem
	where Type = 0 
	and PurchaseInvoiceID is not null
	group by PurchaseInvoiceID

	UNION ALL
		
	select p.PurchaseInvoiceID, sum(r.Net) Amount
	from VND.ReturnInvoiceItem r
	join VND.PurchaseInvoiceItem p on r.PurchaseInvoiceItemID = p.PurchaseInvoiceItemID
	group by p.PurchaseInvoiceID	

	UNION ALL

	select b.DocumentID PurchaseInvoiceID,sum(a.Amount) Amount 
	from CFG.InstallmentPaymentItem a	
	join CFG.InstallmentPayment b on a.InstallmentPaymentID = b.InstallmentPaymentID			
	where b.BaseType = 4
	group by b.DocumentID

	UNION ALL

	select s.PurchaseInvoiceID,-1 * sum(s.Amount) Amount 
	from FIN.ReceiveSubject	s		
	where s.PurchaseInvoiceID is not null
	group by s.PurchaseInvoiceID

	UNION ALL

	select a.PurchaseInvoiceID,-1 * sum(a.Amount) Amount 
	from CFG.DebitCreditNoteItem a	
	where a.Type = 1 and a.PurchaseInvoiceID is not null
	group by a.PurchaseInvoiceID	

	UNION ALL

	select PurchaseInvoiceID, sum(Amount) Amount
	from FOS.CreditAllocationItem
	where PurchaseInvoiceID is not null 
	group by PurchaseInvoiceID

	UNION ALL

	select PurchaseInvoiceID,-1 * sum(a.Amount) Amount
	from Fin.PaymentSubject a
	join fin.PaymentCheqe b
		on a.PaymentCheqeID = b.PaymentCheqeID
	where PurchaseInvoiceID is not null and b.LastState = 2
	group by PurchaseInvoiceID

	UNION ALL

	select PurchaseInvoiceID,-1 * sum(rc.Amount) Amount
	from fin.PaymentSubject ps
	join fin.PaymentOtherCheqe poc on ps.PaymentOtherCheqeID = poc.PaymentOtherCheqeID
	join FIN.ReceiptCheqeFlowItem rcfi on rcfi.ReceiptCheqeFlowItemID = poc.ReceiptCheqeFlowItemID
	join fin.ReceiptCheqeFlowItem rcfi2 on rcfi.ReceiptCheqeFlowItemID = rcfi2.PreviousFlow
	join fin.ReceivedCheqe rc on rc.ReceivedCheqeID = poc.ReceivedCheqeID
	where ps.PurchaseInvoiceID is not null
	group by PurchaseInvoiceID

	UNION ALL

	SELECT BaseDocumentID PurchaseInvoiceID, 
			sum(a.Amount) Amount
	from cnt.ContractStatementDetail a
	join vnd.PurchaseInvoiceItem b 
		on a.BaseDocumentType = 2 and a.BaseDocumentID = b.PurchaseInvoiceID
	where PurchaseInvoiceItemID is not null				
	group by BaseDocumentID

	UNION ALL

	SELECT pp.PurchaseInvoiceID,-1 * sum(pp.Price) Amount
	from fin.PaymentSubject ps
	join vnd.PurchaseInvoicePrePayment pp on ps.PaymentSubjectID = pp.PaymentSubjectID
	join fin.PaymentCheqe pc on pc.PaymentCheqeID = ps.PaymentCheqeID
	join fin.PaymentCheqeFlowItem fi on fi.PaymentCheqeID = pc.PaymentCheqeID
	join fin.PaymentCheqeFlow f on f.PaymentCheqeFlowID = fi.PaymentCheqeFlowID
	where f.Type = 1
	group by pp.PurchaseInvoiceID

	UNION ALL

	SELECT	pri.BaseDocumentID AS PurchaseInvoiceID, 
			SUM(case when prh.Status = 4 then ord.Price else pri.Amount end) AS Amount
	FROM req.PaymentRequestItem pri
	join req.PaymentRequest prh on pri.PaymentRequestID = prh.PaymentRequestID
	LEFT JOIN 
	(SELECT poi.*,po.PaymentOrderStatus FROM req.PaymentOrderItem poi 
		JOIN req.PaymentOrder po ON poi.PaymentOrderID = po.PaymentOrderID AND po.PaymentOrderStatus <> 5) ord
		ON pri.PaymentRequestItemID = ord.PaymentRequestItemID
	LEFT JOIN FIN.PaymentReceipt pr		
		ON pr.PaymentOrderID = ord.PaymentOrderID
	WHERE prh.Status <> 3 and prh.Status <> 5 and pri.BaseDocumentType = 2 
	AND (ord.PaymentRequestItemID IS NULL 
	 OR( ord.PaymentRequestItemID IS NOT NULL AND ord.PaymentOrderStatus = 5)
		OR pr.PaymentOrderID IS NULL)
	GROUP BY pri.BaseDocumentID

)
SELECT	PurchaseInvoiceID,
		Net,
		ISNULL(Done,0) Done,
		Net - ISNULL(Done,0) AS NonPaymented
FROM   (
           SELECT i.PurchaseInvoiceID,
				  CASE WHEN pt.HasConfirmStatement = 0 THEN i.TotalNetPrice
				  ELSE
						ISNULL(i.TotalTax,0) + ISNULL(i.TotalDuty,0) 
				  END Net,
				  d.Done
           FROM   VND.PurchaseInvoice i
		   JOIN VND.PurchaseType pt on i.[Type] = pt.PurchaseTypeID
		   join cfg.Currency  on Currency.CurrencyID = i.CurrencyID
           LEFT JOIN (
						select PurchaseInvoiceID,sum(Amount) Done
						from cte
						group by PurchaseInvoiceID
					 ) d on d.PurchaseInvoiceID =  i.PurchaseInvoiceID
       )T

