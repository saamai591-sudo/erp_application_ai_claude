

Create   VIEW [STC].[vwReturnedOutgoingItem_NotPlacedRemain]
AS 

	select i.ReturnedOutgoingItemID,		   		   
		   isnull(p.MainQuantity, 0) + isnull(ph.MainQuantity, 0) DoMainQuantity,
           isnull(p.SubQuantity, 0) + isnull(ph.SubQuantity, 0) DoSubQuantity,
		   i.MainQuantity - (isnull(p.MainQuantity, 0) + isnull(ph.MainQuantity, 0)) Remain,
		   isnull(i.SubQuantity, 0) - (isnull(p.SubQuantity, 0) + isnull(ph.SubQuantity, 0)) SubRemain
	from STC.ReturnedOutgoingItem i 

	left join (
	           select ReturnedOutgoingItemID,
			          sum(MainQuantity) MainQuantity,
					  sum(isnull(SubQuantity,0)) SubQuantity
			   from WMS.PackingItem 
			   where ReturnedOutgoingItemID is not null
			   group by ReturnedOutgoingItemID
	          ) p on i.ReturnedOutgoingItemID = p.ReturnedOutgoingItemID

	left join (
	           select ReturnedOutgoingItemID,
			          sum(MainQuantity) MainQuantity,
					  sum(isnull(SubQuantity,0)) SubQuantity
			   from WMS.PhysicalLocationItem
			   where ReturnedOutgoingItemID is not null
			   group by ReturnedOutgoingItemID
	          ) ph on i.ReturnedOutgoingItemID = ph.ReturnedOutgoingItemID


