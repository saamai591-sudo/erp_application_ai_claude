
CREATE    VIEW [CNT].vwContractRemain
AS 
	select  c.ContractID,
			vw.CurrencyID,
			vw.Price Net,
			ISNULL(ps.Amount, 0)  +
			ISNULL(dcni.Amount, 0)  +
			ISNULL(rs.Amount, 0)  +
			ISNULL(PaymentRequestItem.Amount, 0) AS Done,
			vw.Price  - 
			ISNULL(ps.Amount, 0) -
			ISNULL(dcni.Amount, 0) -
			ISNULL(rs.Amount, 0) -
			ISNULL(PaymentRequestItem.Amount, 0) Remain,
			c.Number ContractNumber
	from CNT.[Contract] c
	join (
		SELECT ContractID,CurrencyID,sum(price) Price
		FROM	cnt.vwcontractsubject
		GROUP BY ContractID,CurrencyID
	) vw
		on c.ContractID = vw.ContractID
	left join
	(
		select ContractID,CurrencyID,SUM(Amount) Amount
		from fin.PaymentSubject A
		JOIN FIN.PaymentReceipt B
		on a.PaymentReceiptID = b.PaymentReceiptID
		where ContractID is not null
		and b.Status <> 2 
		group by ContractID,CurrencyID
	) ps
		on ps.ContractID = c.ContractID and ps.CurrencyID = vw.CurrencyID
	left join
	(
		select ContractID,CurrencyID, sum(Amount) Amount
		from CFG.DebitCreditNoteItem 
		where ContractID is not null and [Type] = 0
		group by ContractID,CurrencyID
	) dcni
		on c.ContractID = dcni.ContractID and dcni.CurrencyID = vw.CurrencyID
	left join
	(
		select ContractID,a.CurrencyID, sum(a.Amount) Amount
		from FIN.ReceiveSubject a
		left join fin.ReceivedCheqe b on a.ReceivedCheqeID = b.ReceivedCheqeID
		where ContractID is not null 
		and b.LastState <> 2
		group by ContractID,a.CurrencyID
	) rs
		on c.ContractID = rs.ContractID and rs.CurrencyID = vw.CurrencyID
	LEFT JOIN
	(
		SELECT	pri.BaseDocumentID AS ContractID, 
				pri.CurrencyID,
				SUM(pri.Amount) AS Amount
		FROM req.PaymentRequestItem pri
		JOIN req.PaymentRequest prr on pri.PaymentRequestID = prr.PaymentRequestID
		LEFT JOIN req.PaymentOrderItem poi 
			ON poi.PaymentRequestItemID = pri.PaymentRequestItemID
		LEFT JOIN FIN.PaymentReceipt pr		
			ON pr.PaymentOrderID = poi.PaymentOrderID
		WHERE pri.BaseDocumentType = 7 AND (poi.PaymentRequestItemID IS NULL 
			OR pr.PaymentOrderID IS NULL)
			AND prr.Status NOT IN (3,5)
		GROUP BY pri.BaseDocumentID, pri.CurrencyID
	) PaymentRequestItem
		on c.ContractID = PaymentRequestItem.ContractID and PaymentRequestItem.CurrencyID = vw.CurrencyID

