---------------------------------------------------------------

CREATE   PROc [STM].[SpRptRevisionCost]
@ID nvarchar(max)
--WITH ENCRYPTION
AS

DECLARE @IsBranchInstalled BIT
SELECT @IsBranchInstalled = li.LicenceValue FROM cfg.LicenceInfo AS li 


select 
--------------------------اطلاعاتی که از خود اصلاح فی می آیند-------------------
re.RevisionCostID,
CFG.GetSaturnDate(re.Date,0) Date,
re.Type
,b.Deference,
case when @IsBranchInstalled = 1 then  br.Title else '' end BranchTitle,
b.RevisionFee,
u.Username CreatorName,
b.RevisionPrice,
re.Number  RevisionNumber
-----------------------------------نوع اصلاح فی--------------------------
,Case when b.StockReceiptItemID Is not null then 'رسید مبلغی'
      when b.ReturnStockReceiptItemID Is not null then 'برگشت رسید مبلغی'
      when b.OutgoingItemID Is not null then 'حواله مبلغی'
      when b.ReturnedOutgoingItemID Is not null then 'برگشت حواله مبلغی'
      end TypeRevision,
Case when b.StockReceiptItemID Is not null then Receipt.Title
      when b.ReturnStockReceiptItemID Is not null then st2.Title
      when b.OutgoingItemID Is not null then st3.Title
      when b.ReturnedOutgoingItemID Is not null then st4.Title
      end StuffTiTle,
Case when b.StockReceiptItemID Is not null then Receipt.Code
      when b.ReturnStockReceiptItemID Is not null then st2.Code
      when b.OutgoingItemID Is not null then st3.Code
      when b.ReturnedOutgoingItemID Is not null then st4.Code
      end StuffCode,
Case when b.StockReceiptItemID Is not null then SR.Number
      when b.ReturnStockReceiptItemID Is not null then RSR.Number
      when b.OutgoingItemID Is not null then ou.OutgoingID
      when b.ReturnedOutgoingItemID Is not null then Rou.Number
      end Number,
Case when b.StockReceiptItemID Is not null then c.Fee
      when b.ReturnStockReceiptItemID Is not null then D.Fee
      when b.OutgoingItemID Is not null then E.Fee
      when b.ReturnedOutgoingItemID Is not null then g.Fee
      end Fee,
Case when b.StockReceiptItemID Is not null then c.MainQuantity
      when b.ReturnStockReceiptItemID Is not null then D.MainQuantity
      when b.OutgoingItemID Is not null then E.MainQuantity
      when b.ReturnedOutgoingItemID Is not null then G.MainQuantity
      end MainQuantity




from STC.RevisionCost re
JOIN cfg.Branch AS br ON br.BranchID = re.BranchID
JOIN cfg.[User] AS u ON u.UserID = re.Creator
JOIN STC.RevisionCostItem b on re.RevisionCostID=b.RevisionCostID
------------------رسید مبلغی-----------
LEFT JOIN STC.StockReceiptItem C on C.StockReceiptItemID=b.StockReceiptItemID
LEFT JOIN STC.StockReceipt SR on SR.StockReceiptID=c.StockReceiptID
LEFT JOIN STF.VWStuff Receipt on Receipt.StuffID=c.StuffID
-----------------برگشت رسید مبلغی------
LEFT JOIN STC.ReturnStockReceiptItem D on D.ReturnStockReceiptItemID=b.ReturnStockReceiptItemID
LEFT JOIN STF.VWStuff st2 on st2.StuffID=D.StuffID
LEFT JOIN STC.ReturnStockReceipt RSR on RSR.ReturnStockReceiptID=D.ReturnStockReceiptID
---------------------حواله مبلغی-------
LEFT JOIN STC.OutgoingItem E on E.OutgoingItemID=b.OutgoingItemID
LEFT JOIN STF.VWStuff st3 on st3.StuffID=E.StuffID
LEFT JOIN STC.Outgoing ou on ou.OutgoingID=e.OutgoingID
-------------------برگشت حواله مبلغی-------
LEFT JOIN STC.ReturnedOutgoingItem G on G.ReturnedOutgoingItemID=b.ReturnedOutgoingItemID
LEFT JOIN STF.VWStuff st4 on st4.StuffID=G.StuffID
LEFT JOIN STC.ReturnedOutgoing Rou on Rou.ReturnedOutgoingID=g.ReturnedOutgoingID
 where re.RevisionCostID=@ID;
