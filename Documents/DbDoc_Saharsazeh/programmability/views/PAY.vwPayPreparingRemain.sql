-------------------------------------
CREATE     VIEW [PAY].vwPayPreparingRemain
AS 
	with PayPreparingTotal as (
		select p.PayPreparingID,Value= value + p.PaymentRound from PAY.PayPreparing p 
		join(
			select PayPreparingID,sum(Value) Value
			from PAY.PayPreparingItem
			group by PayPreparingID) t on t.PayPreparingID = p.PayPreparingID
	)

	select  p.PayPreparingID,
			items.Value,
			ISNULL(ps.Amount, 0) + ISNULL(pcc.Amount, 0) + ISNULL(dcn.Amount, 0) Done,
			items.Value - (ISNULL(ps.Amount, 0) + ISNULL(pcc.Amount, 0) + ISNULL(dcn.Amount, 0)) Remain,
			items.Value - (ISNULL(ps.Amount, 0) + ISNULL(pcc.Amount, 0) + ISNULL(dcn.Amount, 0)+isnull(po.Amount,0)) RequestedAndPaidRemain

	from PAY.PayPreparing p
	join PayPreparingTotal items on p.PayPreparingID = items.PayPreparingID

	left join
	(
		select PayPreparingID,SUM(Amount) Amount
		from FIN.PaymentSubject A
		join fin.PaymentReceipt b on a.PaymentReceiptID = b.PaymentReceiptID
		where PayPreparingID is not null
		and b.Status <> 2
		group by PayPreparingID
	) ps
		on ps.PayPreparingID = p.PayPreparingID

	left join
	(
		select PayPreparingID,SUM(Amount) Amount
		from FIN.PettyCashCostItem A
		join FIN.PettyCashCost b on a.PettyCashCostID = b.PettyCashCostID
		where PayPreparingID is not null
		group by PayPreparingID
	) pcc
		on pcc.PayPreparingID = p.PayPreparingID

	left join
	(
		select PayPreparingID,SUM(Amount) Amount
		from [CFG].[DebitCreditNoteItem]  A
		join [CFG].[DebitCreditNote] b on a.DebitCreditNoteID = b.DebitCreditNoteID
		where PayPreparingID is not null
		group by PayPreparingID
	) dcn
		on dcn.PayPreparingID = p.PayPreparingID
	left join (select PayPreparingID,sum(poi.Price) Amount
		from req.PaymentOrderItem poi
		join req.PaymentOrder po on poi.PaymentOrderID = po.PaymentOrderID
		where PayPreparingID is not null
		group by PayPreparingID) po on p.PayPreparingID = po.PayPreparingID	;
