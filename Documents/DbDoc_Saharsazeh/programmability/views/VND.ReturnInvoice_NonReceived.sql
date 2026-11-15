
CREATE   VIEW [VND].[ReturnInvoice_NonReceived]
AS 

SELECT r.ReturnInvoiceID,i.Net - ISNULL(rs.Amount,0) - ISNULL(dcni.Amount,0) as NonReceived
FROM VND.ReturnInvoice r
INNER JOIN (
			select ReturnInvoiceID,sum(Net) Net
			from vnd.ReturnInvoiceItem
			where PurchaseInvoiceItemID is null
			group by ReturnInvoiceID
		   )i on i.ReturnInvoiceID = r.ReturnInvoiceID
LEFT JOIN (
			select s.ReturnInvoiceID,sum(Amount) Amount 
			from FIN.ReceiveSubject s
			where s.ReturnInvoiceID is not null 
			group by s.ReturnInvoiceID
		  ) rs on rs.ReturnInvoiceID = r.ReturnInvoiceID
LEFT JOIN (
			select ReturnInvoiceID,sum(Amount) as Amount
			from CFG.DebitCreditNoteItem
			where Type = 1 and ReturnInvoiceID is not null
			group by ReturnInvoiceID
		  ) dcni on r.ReturnInvoiceID = dcni.ReturnInvoiceID
