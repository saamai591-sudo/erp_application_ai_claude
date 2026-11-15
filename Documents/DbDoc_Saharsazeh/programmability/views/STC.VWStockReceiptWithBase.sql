------------------------------------------------------------------------------------------------------------------
create   view STC.VWStockReceiptWithBase
as

select o.FinancialPeriodID,o.Date OriginDate, o.StockID OriginStock, oi.StuffID OriginStuff, oi.OutgoingItemID,sr.Date DestinationDate, sr.StockID DestinationStock, sri.StuffID DestinationStuff, sri.StockReceiptItemID
from stc.Outgoing o
JOIN [STC].[StockDocumentTypeBaseEntity] sdtb ON o.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
join stc.OutgoingItem oi on o.OutgoingID = oi.OutgoingID
join stc.StockReceiptItem sri on sri.OutgoingItemID = oi.OutgoingItemID
join stc.StockReceipt sr on sr.StockReceiptID = sri.StockReceiptID
join stc.StockDocumentType sdt on sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID 
where sdt.DocumentType = 4

union all


select o.FinancialPeriodID,o.Date OriginDate,o.StockID OriginStock, oi.StuffID OriginStuff, oi.OutgoingItemID,sr.Date DestinationDate, sr.StockID DestinationStock, sri.StuffID DestinationStuff, sri.StockReceiptItemID
from stc.Outgoing o
join stc.OutgoingItem oi on o.OutgoingID = oi.OutgoingID
join stc.ConvertSpecification cs on cs.OutgoingItemID = oi.OutgoingItemID
join stc.StockReceiptItem sri on sri.ConvertSpecificationID = cs.ConvertSpecificationID
join stc.StockReceipt sr on sr.StockReceiptID = sri.StockReceiptID

union all


select o.FinancialPeriodID,o.Date OriginDate,o.StockID OriginStock, oi.StuffID OriginStuff, oi.OutgoingItemID,sr.Date DestinationDate, sr.StockID DestinationStock, sri.StuffID DestinationStuff, sri.StockReceiptItemID
from stc.StockReceipt sr 
join stc.StockReceiptItem sri on sr.StockReceiptID = sri.StockReceiptID
join stc.StuffComposition sc on sc.StockReceiptItemID = sri.StockReceiptItemID
join stc.OutgoingItem oi on sc.StuffCompositionID = oi.StuffCompositionID
join stc.Outgoing o on  o.OutgoingID = oi.OutgoingID

union all


select o.FinancialPeriodID,o.Date OriginDate,o.StockID OriginStock, oi.StuffID OriginStuff, oi.OutgoingItemID, sr.Date DestinationDate,sr.StockID DestinationStock, sri.StuffID DestinationStuff, sri.StockReceiptItemID
from stc.StockReceipt sr 
join stc.StockReceiptItem sri on sr.StockReceiptID = sri.StockReceiptID
join stc.StockReceiptChargingService srcs on srcs.StockReceiptItemID = sri.StockReceiptItemID
join stc.OutgoingItem oi on srcs.OutgoingItemID = oi.OutgoingItemID
join stc.Outgoing o on  o.OutgoingID = oi.OutgoingID


