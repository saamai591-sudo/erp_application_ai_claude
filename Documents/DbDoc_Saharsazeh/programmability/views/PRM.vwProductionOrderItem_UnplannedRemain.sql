

CREATE   VIEW [PRM].[vwProductionOrderItem_UnplannedRemain]
AS 

	select i.ProductionOrderItemID,
	       i.MainQuantity - isnull(ppi.MainQuantity, 0) MainQuantityRemain,
		   i.SubQuantity - isnull(ppi.SubQuantity,0) SubQuantityRemain
	from PRM.ProductionOrderItem i

	left join (select ProductionOrderItemID,
	                  sum(MainQuantity) MainQuantity,
					  sum(SubQuantity) SubQuantity					  
	           from PRM.ProductionPlanningItem 
			   where ProductionOrderItemID is not null
			   group by ProductionOrderItemID
	          ) ppi on i.ProductionOrderItemID = ppi.ProductionOrderItemID
