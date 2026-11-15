
CREATE   VIEW [CNT].vwContractStatementRemain
AS 

with cte as
	(
	select ContractStatementID,SUM(Amount) Amount from (
		select ContractStatementID,SUM(Amount) Amount
		from fin.PaymentSubject a
		join fin.PaymentReceipt b
			ON A.PaymentReceiptID = B.PaymentReceiptID
		where ContractStatementID is not null
		AND B.Status <> 2
		group by ContractStatementID

		union all

		select ContractStatementID,SUM(Amount) Amount
		from fos.CreditAllocationItem 
		where ContractStatementID is not null
		group by ContractStatementID

		union all

		select ContractStatementID, sum(Amount) Amount
		from CFG.DebitCreditNoteItem 
		where ContractStatementID is not null and [Type] = 0
		group by ContractStatementID

		union all
		
		SELECT ContractStatementID, sum(Amount) Amount
		from FIN.ReceiveSubject
		where ContractStatementID is not null 
		group by ContractStatementID

		union all

		SELECT	pri.BaseDocumentID AS ContractStatementID, 
				SUM(pri.Amount) AS Amount
		FROM req.PaymentRequestItem pri
		JOIN req.PaymentRequest prh ON pri.PaymentRequestID = prh.PaymentRequestID
		LEFT JOIN req.PaymentOrderItem poi 
			ON poi.PaymentRequestItemID = pri.PaymentRequestItemID
		LEFT JOIN FIN.PaymentReceipt pr		
			ON pr.PaymentOrderID = poi.PaymentOrderID
		WHERE pri.BaseDocumentType = 5 AND (poi.PaymentRequestItemID IS NULL 
			OR pr.PaymentOrderID IS NULL)
			AND prh.Status NOT IN (3,5)
		GROUP BY pri.BaseDocumentID
		)a group by ContractStatementID
	)
	SELECT 
		c.ContractID,
		cs.ContractStatementID,
		item.Amount NetAmount,
		Tax + Duty Vat,
		isnull(cte.Amount,0) Done,
		Tax + Duty - isnull(cte.Amount,0) VatRemain,
		s.PreVoucherID,
		cs.Number ContractStatementNumber,
		c.Number ContractNumber,
		c.DLID,
		cs.CurrencyID,
		c.Date ContractDate
	from CNT.ContractStatement cs
	join CNT.ConfirmStatement s 
		on s.ContractStatementID = cs.ContractStatementID
	join CNT.Contract c
		on c.ContractID = cs.ContractID
	join CFG.Currency 
		on Currency.CurrencyID = cs.CurrencyID
	join
	(
		select  ContractStatementID,
				SUM(Amount) Amount,
				SUM(Tax) Tax,
				SUM(Duty) Duty
		from cnt.ContractStatementItem
		group by ContractStatementID
	) item
		on item.ContractStatementID = cs.ContractStatementID
	left join cte on cte.ContractStatementID = cs.ContractStatementID

