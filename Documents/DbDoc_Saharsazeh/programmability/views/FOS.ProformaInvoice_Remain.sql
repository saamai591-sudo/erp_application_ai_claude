CREATE     VIEW [FOS].[ProformaInvoice_Remain]
AS 
	SELECT ProformaInvoiceID , Remain
	FROM(
			SELECT p.ProformaInvoiceID,
				  CAST( ISNULL(items.Amount,0) -
				   ISNULL(ps.Amount,0) -
				   ISNULL(dcni.Amount,0) AS DECIMAL(36,10)) as Remain
			FROM FOS.ProformaInvoice p
			LEFT JOIN (select i.ProformaInvoiceID, sum(i.Price) as Amount
					   from FOS.ProformaInvoiceItem i
					   group by i.ProformaInvoiceID
					  ) items on p.ProformaInvoiceID = items.ProformaInvoiceID
			LEFT JOIN (select ProformaInvoiceID,sum(Amount) as Amount
					   from FIN.PaymentSubject A
					   JOIN FIN.PaymentReceipt B
						ON A.PaymentReceiptID = B.PaymentReceiptID
					   where ProformaInvoiceID is not null
					   AND B.Status <> 2
					   group by ProformaInvoiceID
					  ) ps on p.ProformaInvoiceID = ps.ProformaInvoiceID
			LEFT JOIN (
					   select ProformaInvoiceID, sum(Amount) Amount
					   from CFG.DebitCreditNoteItem
					   where ProformaInvoiceID is not null and [Type] = 0
					   group by ProformaInvoiceID
					  ) dcni on p.ProformaInvoiceID = dcni.ProformaInvoiceID
		)T
