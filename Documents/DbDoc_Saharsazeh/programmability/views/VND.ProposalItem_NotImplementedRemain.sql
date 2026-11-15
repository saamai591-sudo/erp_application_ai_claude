
CREATE VIEW [VND].[ProposalItem_NotImplementedRemain]
AS 

SELECT *
FROM(
		SELECT i.ProposalItemID,
		       i.MainQuantity - isnull(pii.MainQuantity,0) MainRemain,
			   isnull(i.SubQuantity,0) - isnull(pii.SubQuantity,0) SubRemain
		FROM VND.ProposalItem i
				
		LEFT JOIN (select p.ProposalItemID,sum(MainQuantity) MainQuantity,sum(isnull(SubQuantity,0)) SubQuantity  
		           from FOS.ProformaInvoiceItem p 
				   where p.ProposalItemID is not null
				   group by p.ProposalItemID) pii on i.ProposalItemID = pii.ProposalItemID
		)T










