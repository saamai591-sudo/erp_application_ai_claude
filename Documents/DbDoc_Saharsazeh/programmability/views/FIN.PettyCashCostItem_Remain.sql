
create view [FIN].[PettyCashCostItem_Remain]
AS

	select T.PettyCashCostItemID,
           T.Amount,
           T.Credits,
           T.Amount - T.Credits AS remain
	from (
		select i.PettyCashCostItemID,
			   i.Amount,
			   ISNULL(dcni.Amount, 0) + ISNULL(pip.Amount, 0) AS Credits
		from FIN.PettyCashCostItem i

		LEFT JOIN (select PettyCashCostItemID,sum(Amount - Discount) as Amount
				   from CFG.DebitCreditNoteItem 
				   where PettyCashCostItemID is not null
				   group by PettyCashCostItemID
				  ) dcni on i.PettyCashCostItemID = dcni.PettyCashCostItemID

		LEFT JOIN (SELECT pipp.PettyCashCostItemID,
                          SUM(pipp.Price) Amount
                   FROM VND.PurchaseInvoicePrePayment AS pipp
                   WHERE pipp.PettyCashCostItemID IS NOT NULL
                   GROUP BY pipp.PettyCashCostItemID
				  ) pip ON pip.PettyCashCostItemID = i.PettyCashCostItemID

		) T
    




