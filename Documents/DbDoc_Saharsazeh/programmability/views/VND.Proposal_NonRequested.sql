
CREATE    VIEW VND.Proposal_NonRequested
AS 

SELECT *
FROM(
		SELECT p.ProposalID,
		       item.TotalNetPrice -
			   ISNULL(pri.Amount,0) as NonRequested
		FROM VND.Proposal p

		JOIN (select i.ProposalID,sum(i.Price - i.Discount + i.Tax + i.Duty) TotalNetPrice 
		      from VND.ProposalItem i
			  group by i.ProposalID
			 ) item on p.ProposalID = item.ProposalID
		   
		left join (select i.BaseDocumentID,sum(i.Amount) Amount 
						from REQ.PaymentRequestItem i	
						join REQ.PaymentRequest h on i.PaymentRequestID = h.PaymentRequestID
						where i.BaseDocumentType = 8 and i.BaseDocumentID is not null 
						and h.Status not in (3,5)
						group by i.BaseDocumentID					
					) pri on p.ProposalID = pri.BaseDocumentID
	)T

