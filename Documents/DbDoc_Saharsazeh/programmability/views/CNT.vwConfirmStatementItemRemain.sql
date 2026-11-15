
CREATE    VIEW [CNT].vwConfirmStatementItemRemain
AS 
	SELECT 
		cs.ConfirmStatementID,
		cs.ContractID,
		csi.ConfirmStatementItemID,
		csi.AdditionDeductionTypeID,
		csi.Deduction - csi.Addition - csi.Paid Net,
		ISNULL(ps.Amount,0) + ISNULL(ca.Amount,0) + ISNULL(dcni.Amount,0) + ISNULL(rs.Amount,0) + ISNULL(PaymentRequestItem.Amount , 0) Done,
		csi.Deduction - csi.Addition - csi.Paid -
		ISNULL(ps.Amount,0) -
		ISNULL(ca.Amount,0) -
		ISNULL(dcni.Amount,0) -
		ISNULL(rs.Amount,0) -
		ISNULL(PaymentRequestItem.Amount , 0) Remain,
		Contract.DLID,
		cs1.CurrencyID,
		csi.PurchaseInvoiceID
	from CNT.ConfirmStatementItem csi
	LEFT JOIN cnt.ConfirmStatement cs
		on cs.ConfirmStatementID = csi.ConfirmStatementID
	LEFT JOIN cnt.ContractStatement cs1
		on cs1.ContractStatementID = cs.ContractStatementID
	LEFT JOIN CNT.Contract on Contract.ContractID = cs.ContractID
	LEFT JOIN
	(
		select ConfirmStatementItemID,SUM(Amount) Amount
		from fin.PaymentSubject a
		join fin.PaymentReceipt b
			on a.PaymentReceiptID = b.PaymentReceiptID
		where ConfirmStatementItemID is not null
		and b.Status <> 2
		group by ConfirmStatementItemID
	) ps
		on ps.ConfirmStatementItemID = csi.ConfirmStatementItemID
	LEFT JOIN
	(
		select ConfirmStatementItemID,SUM(Amount) Amount
		from fos.CreditAllocationItem 
		where ConfirmStatementItemID is not null
		group by ConfirmStatementItemID
	) ca
		on ca.ConfirmStatementItemID = csi.ConfirmStatementItemID
	LEFT JOIN
	(
		select ConfirmStatementItemID, sum(Amount) Amount
		from CFG.DebitCreditNoteItem 
		where ConfirmStatementItemID is not null and [Type] = 0
		group by ConfirmStatementItemID
	) dcni
		on csi.ConfirmStatementItemID = dcni.ConfirmStatementItemID
	LEFT JOIN
	(
		select ConfirmStatementItemID, sum(Amount) Amount
		from FIN.ReceiveSubject
		where ConfirmStatementItemID is not null 
		group by ConfirmStatementItemID
	) rs
		on csi.ConfirmStatementItemID = rs.ConfirmStatementItemID
	LEFT JOIN
	(
		SELECT	pri.BaseDocumentID AS ConfirmStatementItemID, 
				SUM(pri.Amount) AS Amount
		FROM req.PaymentRequestItem pri
		JOIN req.PaymentRequest prh ON pri.PaymentRequestID = prh.PaymentRequestID
		LEFT JOIN req.PaymentOrderItem poi 
			ON poi.PaymentRequestItemID = pri.PaymentRequestItemID
		LEFT JOIN FIN.PaymentReceipt pr		
			ON pr.PaymentOrderID = poi.PaymentOrderID
		WHERE pri.BaseDocumentType = 6 AND (poi.PaymentRequestItemID IS NULL 
			OR pr.PaymentOrderID IS NULL)
			AND prh.Status NOT IN (3,5)
		GROUP BY pri.BaseDocumentID
	) PaymentRequestItem
		on csi.ConfirmStatementItemID = PaymentRequestItem.ConfirmStatementItemID

