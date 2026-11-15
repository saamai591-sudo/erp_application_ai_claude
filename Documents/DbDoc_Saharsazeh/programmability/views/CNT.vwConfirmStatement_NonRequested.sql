
CREATE    VIEW CNT.vwConfirmStatement_NonRequested
AS 

select  cs.ConfirmStatementID,
		cs.Amount,
		cs.Amount + isnull(Addition,0) - ISNULL(Deduction,0) Net,
		isnull(pri.Amount,0) Done,
		cs.Amount + isnull(Addition,0) - ISNULL(Deduction,0) - isnull(pri.Amount,0) Remain
	from CNT.ConfirmStatement cs
	left join
	(
		select  ConfirmStatementID,
				sum(Addition-Paid) Addition , 
				SUM(Deduction-Paid) Deduction
		from cnt.ConfirmStatementItem
		group by ConfirmStatementID
	)item
		on item.ConfirmStatementID = cs.ConfirmStatementID
	left join 
	(
		select i.BaseDocumentID,sum(i.Amount) Amount 
		from REQ.PaymentRequestItem i	
		join REQ.PaymentRequest h on i.PaymentRequestID = h.PaymentRequestID
		where i.BaseDocumentType = 4 
		and i.BaseDocumentID is not null 
		and h.Status not in (3,5)
		group by i.BaseDocumentID					
	) pri on cs.ConfirmStatementID = pri.BaseDocumentID

