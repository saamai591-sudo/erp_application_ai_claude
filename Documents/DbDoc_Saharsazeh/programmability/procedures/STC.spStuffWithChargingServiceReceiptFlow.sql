
-------------------------------------
CREATE   proc Stc.spStuffWithChargingServiceReceiptFlow
(	@CompanyID				 int,
    @SelectedStuffDls		 NVARCHAR(MAX) = '',
    @SelectedOutgoingItemIDs NVARCHAR(MAX) = ''
)
as

if @SelectedStuffDls = ''
    set @SelectedStuffDls = null

if @SelectedOutgoingItemIDs = ''
    set @SelectedOutgoingItemIDs = null

SELECT *
INTO   #vwStuff
FROM   stf.VWStuff

---filterTable @SelectedStuffDls
begin
create table #DlStuffFilter
(DlID int,
 StuffID int)
 
 insert into #DlStuffFilter
select [CFG].[GetStringPartBySpliter](value,1,'|') as DlID ,
	[CFG].[GetStringPartBySpliter](value,2,'|') StuffID 
from [CFG].[Split] (@SelectedStuffDls,',')
END
------filterTable @OutgoingItemIDs
SELECT VALUE as OutgoingItemID into #OutgoingItems
FROM CFG.R_FnCommaStr2Table(@SelectedOutgoingItemIDs)

--- Create Source

create table #Src
(StockReceiptID int,
ReturnedOutgoingID int,
ReceiptStuffID int,
OutgoingStuffID int,
DlID int,
OutgoingItemID int,
ReceivedQuantity decimal(36,10),
EquivalentQuantity decimal(36,10),
PersianDate nvarchar(20),
GregorianDate nvarchar(20),
Number Int
)


insert into #Src
SELECT
sr.StockReceiptID,
Null ReturnedOutgoingID,
sri.StuffID ReceiptStuffID,
oi.StuffID OutgoingStuffID,
       sr.DeliverDlID,
	   srcs.OutgoingItemID,
      sri.MainQuantity               ReceivedQuantity,
       srcs.MainQuantity              EquivalentQuantity,
	   dd.PersianFullDateAlternateKey,
	   dd.FullDateAlternateKey,
	   sr.Number
      FROM   stc.StockReceipt            AS sr
	  join cfg.DimDate dd on sr.Date = dd.Date
       JOIN stc.StockReceiptItem   AS sri
            ON  sri.StockReceiptID = sr.StockReceiptID
  join stc.StockReceiptChargingService srcs on sri.StockReceiptItemID = srcs.StockReceiptItemID
  join stc.OutgoingItem oi on srcs.OutgoingItemID = oi.OutgoingItemID
  join stc.Outgoing o on oi.OutgoingID = o.OutgoingID
  JOIN stc.StockDocumentTypeBaseEntity AS sdtbe
          ON  sdtbe.StockDocumentTypeBaseEntityID = sr.StockDocumentTypeBaseEntityID
  JOIN stc.StockDocumentType  AS sdt
       ON  sdt.StockDocumentTypeID = sdtbe.StockDocumentTypeID
  left join #DlStuffFilter dsf on sr.DeliverDlID = dsf.DlID and oi.StuffID = dsf.StuffID		
  left join #OutgoingItems ois on oi.OutgoingItemID = ois.OutgoingItemID
  join stf.Stock stc on stc.StockID = o.StockID
  join cfg.Branch br on stc.BranchID = br.BranchID
  WHERE  sdt.type = 1 and sdt.DocumentType = 10
  and (@SelectedStuffDls is null or dsf.DlID is not null)  
  and (@SelectedOutgoingItemIDs is null or ois.OutgoingItemID is NOT NULL)
  and br.CompanyID = @CompanyID
  union all

  select 
Null,
ro.ReturnedOutgoingID,
roi.StuffID,
roi.StuffID,
       ro.DlDeliverID,
	   roi.OutgoingItemID,
      roi.MainQuantity               ReceivedQuantity,
       roi.MainQuantity              EquivalentQuantity,
	   dd.PersianFullDateAlternateKey,
	   dd.FullDateAlternateKey,
	   ro.Number	   
	   from stc.ReturnedOutgoingItem roi
  join stc.ReturnedOutgoing ro on roi.ReturnedOutgoingID = ro.ReturnedOutgoingID
  join stc.OutgoingItem oi on roi.OutgoingItemID = oi.OutgoingItemID
  join stc.Outgoing o on oi.OutgoingID = o.OutgoingID
  join stc.StockDocumentTypeBaseEntity sdtbe on o.StockDocumentTypeBaseEntityID = sdtbe.StockDocumentTypeBaseEntityID
  join stc.StockDocumentType sdt on sdtbe.StockDocumentTypeID = sdt.StockDocumentTypeID  
  left join #DlStuffFilter dsf on ro.DlDeliverID = dsf.DlID and roi.StuffID = dsf.StuffID
  left join #OutgoingItems ois on oi.OutgoingItemID = ois.OutgoingItemID
  join stf.Stock stc on o.StockID = stc.StockID
  join cfg.Branch br on stc.BranchID = br.BranchID
  join cfg.DimDate dd on ro.Date = dd.Date
  where sdt.Type = 2 and sdt.DocumentType = 14
  and (@SelectedStuffDls is null or dsf.DlID is not null )
  and (@SelectedOutgoingItemIDs is null or ois.OutgoingItemID is NOT NULL)
  and br.CompanyID = @CompanyID
  
  --- Fetch Data
  select 
  case when StockReceiptID is not null then  'StockReceipt' when ReturnedOutgoingID is not null then 'ReturnedOutgoing' end DocType,
  isnull(src.StockReceiptID,src.ReturnedOutgoingID) DocumentID,
       src.DlID,
       src.ReceiptStuffID,
       s.code                       ReceivedStuffCode,
       s.Title                        ReceivedStuffTitle,
       s.Title2                       ReceivedStuffTitle2,
       src.ReceivedQuantity           ReceivedQuantity,
       src.EquivalentQuantity              EquivalentQuantity,
       vs.code                        OutgoingStuffCode,
       vs.Title                       OutgoingStuffTitle,
       vs.Title2                      OutgoingStuffTitle2,
       dl.Title                       PartyDlTitle,
       dl.Title2                      PartyDlTitle2,
       dl.Code                        PartyDlCode,
	   src.PersianDate,
	   src.GregorianDate,
	   src.Number
   from #Src src
   join #vwStuff s on src.ReceiptStuffID = s.StuffID
   join #vwStuff vs on src.OutgoingStuffID = vs.StuffID
   join acc.DL dl on src.DlID = dl.DLID
