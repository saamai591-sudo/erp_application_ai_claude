
CREATE    VIEW VND.PurchaseContract_NonRequested
AS 

SELECT *
FROM(
		SELECT c.PurchaseContractID,
		       c.TotalNetPrice - ISNULL(pri.Amount,0) as NonRequested
		FROM VND.PurchaseContract c

		left join (select i.BaseDocumentID,sum(i.Amount) Amount 
						from REQ.PaymentRequestItem i	
						join REQ.PaymentRequest h on i.PaymentRequestID = h.PaymentRequestID
						where i.BaseDocumentType = 9 and i.BaseDocumentID is not null 
						and h.Status not in (3,5)
						group by i.BaseDocumentID					
					) pri on c.PurchaseContractID = pri.BaseDocumentID
	)T

