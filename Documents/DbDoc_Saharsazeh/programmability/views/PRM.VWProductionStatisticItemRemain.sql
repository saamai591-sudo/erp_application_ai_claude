
create   view [PRM].[VWProductionStatisticItemRemain]
as

select  a.ProductionStatisticItemID,
		a.MainQuantity - ISNULL(b.MainQuantity,0) - ISNULL(c.MainQuantity,0) MainRemain,
		a.SubQuantity - ISNULL(b.SubQuantity,0) - ISNULL(c.SubQuantity,0) SubRemain
from PRM.ProductionStatisticItem a
left join
(
select ProductionStatisticItemID,sum(MainQuantity) MainQuantity,sum(SubQuantity) SubQuantity
from stc.StockReceiptItem
group by ProductionStatisticItemID
)b
	on a.ProductionStatisticItemID = b.ProductionStatisticItemID
left join
(
select ProductionStatisticItemID,sum(MainQuantity) MainQuantity,sum(SubQuantity) SubQuantity
from PRM.ProductionDeliveryItem
group by ProductionStatisticItemID
)c
	on a.ProductionStatisticItemID = c.ProductionStatisticItemID