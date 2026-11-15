

CREATE   VIEW [SLE].[QuotationItem_Order_NotProduced]
AS 

	select q.QuotationItemID,
	       q.MainQuantity - isnull(poi.MainQuantity, 0) MainQuantityRemain,
		   isnull(q.SubQuantity,0) - isnull(poi.SubQuantity,0) SubQuantityRemain
	from SLE.QuotationItem q

	left join (select QuotationItemID,
	                  sum(MainQuantity) MainQuantity,
					  sum(isnull(SubQuantity,0)) SubQuantity					  
	           from PRM.ProductionOrderItem 
			   where QuotationItemID is not null
			   group by QuotationItemID
	          ) poi on q.QuotationItemID = poi.QuotationItemID 
