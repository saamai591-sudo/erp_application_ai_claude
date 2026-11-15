
-------------------------------------
CREATE   Proc Stc.spStuffWithChargingServiceOutgoingFlow
(
@CompanyID int,
@SelectedStuffDls nvarchar(MAX) = ''
) 
as

if @SelectedStuffDls = ''
    set @SelectedStuffDls = NULL

 select * into #vwStuff
from stf.VWStuff

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



SELECT 
	   o.OutgoingID,o.DeliverDlID,
       oi.StuffID                     DeliveredStuffID,
       s.code StuffCode,
       s.Title DeliveredStuffTitle,
       s.Title2 DeliveredStuffTitle2,	
       oi.MainQuantity MainQuantity,
       ro.ReceiptQuantity ,
	   ret.ReturnedQuantity,
	   oi.MainQuantity + isnull(ro.ReceiptQuantity,0)+ isnull(ret.ReturnedQuantity,0) Non,
       dl.Title PartyDlTitle ,
	   dl.Title2 PartyDlTitle2,
	   dl.Code PartyDlCode,
	   oi.OutgoingItemID,
	   dd.FullDateAlternateKey AS GregorianDate,
	   dd.PersianFullDateAlternateKey PersianDate,
	   o.Number
FROM   stc.Outgoing                AS o
join acc.DL dl on o.DeliverDlID = dl.DLID
       JOIN stc.OutgoingItem       AS oi 
            ON  oi.OutgoingID = o.OutgoingID
	   join stf.Stock stc on o.StockID = stc.StockID
	   join cfg.Branch br on stc.BranchID = br.BranchID 
       join #vwStuff s on oi.StuffID = s.StuffID     
       JOIN stc.StockDocumentTypeBaseEntity AS sdtbe
            ON  sdtbe.StockDocumentTypeBaseEntityID = o.StockDocumentTypeBaseEntityID
       JOIN stc.StockDocumentType  AS sdt
            ON  sdt.StockDocumentTypeID = sdtbe.StockDocumentTypeID
       left JOIN (
                SELECT SUM(-srcs.MainQuantity) ReceiptQuantity,
                       srcs.OutgoingItemID
                FROM   stc.StockReceiptChargingService AS srcs
                GROUP BY
                       srcs.OutgoingItemID
            ) ro
            ON  ro.OutgoingItemID = oi.OutgoingItemID

left join (select sum(-roi.MainQuantity)  ReturnedQuantity,roi.OutgoingItemID from stc.ReturnedOutgoingItem roi 
group by roi.OutgoingItemID
) Ret 
on oi.OutgoingItemID = ret.OutgoingItemID
join acc.DL d on o.DeliverDlID = d.DLID
join cfg.DimDate dd on o.Date = dd.Date
left join #DlStuffFilter dsf on oi.StuffID = dsf.StuffID and o.DeliverDlID = dsf.DlID
WHERE  sdt.type = 2 and sdt.DocumentType = 14
and (@SelectedStuffDls is null or dsf.DlID is not null)
and br.CompanyID = @CompanyID
