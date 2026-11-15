
CREATE  VIEW CFG.Debit_DebitCreditNoteItem_Remain
AS

	select T.DebitCreditNoteItemID,
           T.Amount,
           T.Credits,
           T.Amount - T.Credits AS remain
	from (
			select i.DebitCreditNoteItemID,
				   i.Amount - i.Discount as Amount,
				   ISNULL(dcni.Amount, 0) + ISNULL(pip.Amount, 0) + ISNULL(cspp.Amount, 0) AS Credits
			from CFG.DebitCreditNoteItem i
	
			LEFT JOIN (select DebitCreditID,sum(Amount - Discount) as Amount
					   from CFG.DebitCreditNoteItem
					   where Type = 1 and DebitCreditID is not null
					   group by DebitCreditID
					  ) dcni on i.DebitCreditNoteItemID = dcni.DebitCreditID

			LEFT JOIN (SELECT pipp.DebitCreditNoteItemID,
                              SUM(pipp.Price) AS Amount
                       FROM VND.PurchaseInvoicePrePayment AS pipp
                       WHERE pipp.DebitCreditNoteItemID IS NOT NULL
                       GROUP BY pipp.DebitCreditNoteItemID
					  ) pip ON pip.DebitCreditNoteItemID = i.DebitCreditNoteItemID

			LEFT JOIN (select DebitCreditNoteItemID, sum(Price) as Amount
					   from cnt.ConfirmStatementPrePayment
					   where DebitCreditNoteItemID is not null
					   group by DebitCreditNoteItemID
					   ) cspp on i.DebitCreditNoteItemID = cspp.DebitCreditNoteItemID
		) T
