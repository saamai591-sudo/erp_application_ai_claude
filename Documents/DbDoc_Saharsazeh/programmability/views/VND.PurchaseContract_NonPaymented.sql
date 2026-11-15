
CREATE    VIEW [VND].PurchaseContract_NonPaymented
AS 
	SELECT	T.PurchaseContractID,
			T.NonPaymented
	FROM(
			SELECT c.PurchaseContractID,
				   c.TotalNetPrice - ISNULL(ps.Amount,0) - ISNULL(pcct.Amount,0) - isnull(dcni.Amount,0) - isnull(PaymentRequestItem.Amount,0) as NonPaymented
			FROM VND.PurchaseContract c

			LEFT JOIN (select PurchaseContractID, sum(Amount) Amount 
					from FIN.PaymentSubject a
					join fin.PaymentReceipt b
						on a.PaymentReceiptID = b.PaymentReceiptID
					where PurchaseContractID is not null
					and b.Status <> 2
					group by PurchaseContractID
			) ps 
				on c.PurchaseContractID = ps.PurchaseContractID

			LEFT JOIN (select PurchaseContractID,sum(Amount) Amount 
					from FIN.PettyCashCostItem 
					where PurchaseContractID is not null 
					group by PurchaseContractID
			) pcct 
				on c.PurchaseContractID = pcct.PurchaseContractID

			LEFT JOIN (select PurchaseContractID,sum(Amount) as Amount
					   from CFG.DebitCreditNoteItem
					   where PurchaseContractID is not null
					   group by PurchaseContractID
			) dcni 
				on c.PurchaseContractID = dcni.PurchaseContractID

			LEFT JOIN (
				SELECT	pri.BaseDocumentID AS PurchaseContractID, 
						SUM(pri.Amount) AS Amount
				FROM req.PaymentRequestItem pri
				join req.PaymentRequest pre on pre.PaymentRequestID = pri.PaymentRequestID
				LEFT JOIN req.PaymentOrderItem poi 
					ON poi.PaymentRequestItemID = pri.PaymentRequestItemID
				LEFT JOIN FIN.PaymentReceipt pr		
					ON pr.PaymentOrderID = poi.PaymentOrderID
				WHERE pri.BaseDocumentType = 9 
				AND (poi.PaymentRequestItemID IS NULL OR pr.PaymentOrderID IS NULL)
				and pre.Status not in (3,5)
				GROUP BY pri.BaseDocumentID
			) PaymentRequestItem 
				on c.PurchaseContractID = PaymentRequestItem.PurchaseContractID
		)T

