
CREATE   VIEW CNT.vwContractNonRequestedRemain
AS 

	select  c.ContractID,
			vw.Price Net,
			vw.CurrencyID,
			ISNULL(pri.Amount, 0) Done,
			vw.Price  - 
			ISNULL(pri.Amount, 0) Remain
	from CNT.[Contract] c
	join (
	select ContractID,CurrencyID,sum(price) Price
	from	cnt.vwcontractsubject
	group by ContractID,CurrencyID
	) vw
		on c.ContractID = vw.ContractID
	
	left join (select i.BaseDocumentID,i.CurrencyID,sum(i.Amount) Amount 
						from REQ.PaymentRequestItem i	
						join REQ.PaymentRequest h on i.PaymentRequestID = h.PaymentRequestID
						where i.BaseDocumentType = 7 and i.BaseDocumentID is not null 
						and h.Status not in (3,5)
						group by i.BaseDocumentID,i.CurrencyID					
					) pri on c.ContractID = pri.BaseDocumentID and vw.CurrencyID = pri.CurrencyID

