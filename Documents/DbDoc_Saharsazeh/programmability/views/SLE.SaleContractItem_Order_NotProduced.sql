


CREATE   VIEW [SLE].[SaleContractItem_Order_NotProduced]
AS 

	select s.SaleContractItemID,
	       s.MainQuantity - isnull(poi.MainQuantity, 0) MainQuantityRemain,
		   isnull(s.SubQuantity,0) - isnull(poi.SubQuantity,0) SubQuantityRemain
	from SLE.SaleContractItem s

	left join (select SaleContractItemID,
	                  sum(MainQuantity) MainQuantity,
					  sum(isnull(SubQuantity,0)) SubQuantity					  
	           from PRM.ProductionOrderItem 
			   where SaleContractItemID is not null
			   group by SaleContractItemID
	          ) poi on s.SaleContractItemID = poi.SaleContractItemID 
