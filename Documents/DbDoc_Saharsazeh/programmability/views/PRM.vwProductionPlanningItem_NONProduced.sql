
create   view [PRM].[vwProductionPlanningItem_NONProduced]
as
select 
	a.ProductionPlanningItemID,
	a.MainQuantity,
	ISNULL(b.MainQuantity,0) Produced,
	a.MainQuantity - isnull(b.MainQuantity , 0) Non
from prm.ProductionPlanningItem a
left join 
(
select  ProductionPlanningItemID,sum(MainQuantity) MainQuantity
from prm.ProductionStatisticItem
	group by ProductionPlanningItemID
)b
	on b.ProductionPlanningItemID = a.ProductionPlanningItemID