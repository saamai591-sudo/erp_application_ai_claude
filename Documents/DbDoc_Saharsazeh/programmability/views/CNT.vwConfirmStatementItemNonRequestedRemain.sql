
CREATE    VIEW CNT.vwConfirmStatementItemNonRequestedRemain
AS 

	select 
		cs.ConfirmStatementID,
		cs.ContractID,
		csi.ConfirmStatementItemID,
		csi.AdditionDeductionTypeID,
		csi.Deduction - csi.Addition - csi.Paid Net,
		isnull(pri.Amount,0) Done,
		csi.Deduction - csi.Addition - csi.Paid -
		isnull(pri.Amount,0) Remain
	from CNT.ConfirmStatementItem csi
	left join cnt.ConfirmStatement cs
		on cs.ConfirmStatementID = csi.ConfirmStatementID	
	left join (select i.BaseDocumentID,sum(i.Amount) Amount 
						from REQ.PaymentRequestItem i	
						join REQ.PaymentRequest h on i.PaymentRequestID = h.PaymentRequestID
						where i.BaseDocumentType = 6 and i.BaseDocumentID is not null 
						and h.Status not in (3,5)
						group by i.BaseDocumentID					
					) pri on csi.ConfirmStatementItemID = pri.BaseDocumentID

