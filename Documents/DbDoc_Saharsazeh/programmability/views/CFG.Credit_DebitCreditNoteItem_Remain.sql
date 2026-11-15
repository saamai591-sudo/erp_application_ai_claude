
------------------------------------------------
CREATE   VIEW CFG.Credit_DebitCreditNoteItem_Remain
AS

	select T.DebitCreditNoteItemID,
		   T.Amount,
		   T.Debits,
		   T.Amount - T.Debits AS remain
	from (
		select i.DebitCreditNoteItemID,
			   i.Amount - i.Discount as Amount,
			   ISNULL(dcni.Amount, 0) + ISNULL(ir.Amount, 0) AS Debits
		from CFG.DebitCreditNoteItem i
	
		LEFT JOIN (select DebitCreditID,sum(Amount - Discount) as Amount
				   from CFG.DebitCreditNoteItem
				   where Type = 0 and DebitCreditID is not null
				   group by DebitCreditID
				  ) dcni on i.DebitCreditNoteItemID = dcni.DebitCreditID

		LEFT JOIN (SELECT ipr.DebitCreditNoteItemID,
						  SUM(ipr.Price) Amount
				   FROM SLE.InvoicePreReceive AS ipr
				   JOIN sle.Invoice AS i2 ON i2.InvoiceID = ipr.InvoiceID
		           WHERE  i2.SaleInvoiceStatus <> 5 AND  ipr.DebitCreditNoteItemID IS NOT NULL
				   GROUP BY ipr.DebitCreditNoteItemID 
				   ) ir ON ir.DebitCreditNoteItemID = i.DebitCreditNoteItemID

		where i.Type = 1 
	) T
