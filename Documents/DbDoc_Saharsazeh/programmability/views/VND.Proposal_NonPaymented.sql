
CREATE    VIEW [VND].Proposal_NonPaymented
AS 
	SELECT	T.ProposalID,
			T.NonPaymented
	FROM(
			SELECT p.ProposalID,
				   item.TotalNetPrice -
				   ISNULL(ps.Amount,0) - 
				   ISNULL(PaymentRequestItem.Amount,0) - 
				   ISNULL(pcct.Amount,0) - 
				   isnull(dcni.Amount,0) -
				   isnull(pii.Amount,0) -
				   isnull(pci.Amount,0) +
				   isnull(RecalledCheuqe.Amount,0) as NonPaymented
			FROM VND.Proposal p

			JOIN (select i.ProposalID,sum(i.Price - i.Discount + i.Tax + i.Duty) TotalNetPrice 
				  from VND.ProposalItem i
				  group by i.ProposalID
				 ) item on p.ProposalID = item.ProposalID
		   
			LEFT JOIN (select ProposalID,sum(Amount) Amount 
					   from FIN.PaymentSubject a
					   join fin.PaymentReceipt b
						on a.PaymentReceiptID = b.PaymentReceiptID
					   where ProposalID is not null
					   and b.Status <> 2
					   group by ProposalID
					  ) ps on p.ProposalID = ps.ProposalID

			LEFT JOIN (select ProposalID,sum(Amount) Amount 
					   from FIN.PettyCashCostItem 
					   where ProposalID is not null 
					   group by ProposalID
					  ) pcct on p.ProposalID = pcct.ProposalID

			LEFT JOIN (select ProposalID,sum(Amount) as Amount
					   from CFG.DebitCreditNoteItem
					   where [Type] = 0 and ProposalID is not null
					   group by ProposalID
					  ) dcni on p.ProposalID = dcni.ProposalID

			LEFT JOIN (
						select i2.ProposalID, sum(i.Net) as Amount
						from VND.PurchaseInvoiceItem i
						join VND.ProposalItem i2 on i.ProposalItemID = i2.ProposalItemID
						group by i2.ProposalID
					  ) pii on p.ProposalID = pii.ProposalID

			LEFT JOIN (
						select i2.ProposalID, sum(i.Net) as Amount
						from VND.PurchaseContractItem i
						join VND.ProposalItem i2 on i.ProposalItemID = i2.ProposalItemID
						group by i2.ProposalID
					  ) pci on p.ProposalID = pci.ProposalID
			LEFT JOIN (
						select ProposalID, sum(a.Amount) Amount
						from Fin.PaymentSubject a
						join fin.PaymentCheqe b
							on a.PaymentCheqeID = b.PaymentCheqeID
						where ProposalID is not null and b.LastState = 2
						group by ProposalID
						) RecalledCheuqe on p.ProposalID = RecalledCheuqe.ProposalID
			LEFT JOIN (
					SELECT	pri.BaseDocumentID AS ProposalID, 
							SUM(pri.Amount) AS Amount
					FROM req.PaymentRequestItem pri
					JOIN req.PaymentRequest pre ON pre.PaymentRequestID = pri.PaymentRequestID
					LEFT JOIN req.PaymentOrderItem poi 
						ON poi.PaymentRequestItemID = pri.PaymentRequestItemID
					LEFT JOIN FIN.PaymentReceipt pr		
						ON pr.PaymentOrderID = poi.PaymentOrderID
					WHERE pri.BaseDocumentType = 8 
					AND (poi.PaymentRequestItemID IS NULL OR pr.PaymentOrderID IS NULL)
					AND pre.Status NOT IN (3,5)
					GROUP BY pri.BaseDocumentID
			) PaymentRequestItem on p.ProposalID = PaymentRequestItem.ProposalID
		)T

