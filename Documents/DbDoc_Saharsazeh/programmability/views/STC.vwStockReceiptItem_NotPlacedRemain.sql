

Create   VIEW [STC].[vwStockReceiptItem_NotPlacedRemain]
AS 

	select i.StockReceiptItemID,		   		   
		   isnull(p.MainQuantity, 0) + isnull(ph.MainQuantity, 0) DoMainQuantity,
           isnull(p.SubQuantity, 0) + isnull(ph.SubQuantity, 0) DoSubQuantity,
		   i.MainQuantity - (isnull(p.MainQuantity, 0) + isnull(ph.MainQuantity, 0)) Remain,
		   isnull(i.SubQuantity, 0) - (isnull(p.SubQuantity, 0) + isnull(ph.SubQuantity, 0)) SubRemain
	from STC.StockReceiptItem i 

	left join (
	           select StockReceiptItemID,
			          sum(MainQuantity) MainQuantity,
					  sum(isnull(SubQuantity,0)) SubQuantity
			   from WMS.PackingItem 
			   where StockReceiptItemID is not null
			   group by StockReceiptItemID
	          ) p on i.StockReceiptItemID = p.StockReceiptItemID

	left join (
	           select StockReceiptItemID,
			          sum(MainQuantity) MainQuantity,
					  sum(isnull(SubQuantity,0)) SubQuantity
			   from WMS.PhysicalLocationItem 
			   where StockReceiptItemID is not null
			   group by StockReceiptItemID
	          ) ph on i.StockReceiptItemID = ph.StockReceiptItemID



