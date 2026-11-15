------------------------------------------------------------------------------------------------------------------
CREATE   proc [STM].SpRptAmountReturnedOutgoingItem 
@ID nvarchar(max)
--WITH ENCRYPTION 
AS

create table ##Ids
(id int)

insert into ##Ids
SELECT [value] FROM   cfg.R_FnCommaStr2Table(@ID)

Declare @Columns AS NVARCHAR(MAX),@Query  AS NVARCHAR(MAX),@CustomeFields NVARCHAR(MAX)

SELECT  @CustomeFields = STUFF((SELECT DISTINCT
                                            ',' + QUOTENAME(FieldName)
                                    FROM    CFG.EntityCustomeField
                                    WHERE   EntityName = 'ReturnedOutgoing'
            FOR                    XML PATH('') ,
                                       TYPE
                                                                   ).value('.',
                                                              'NVARCHAR(MAX)'),
                                   1, 1, '')
    IF ( @CustomeFields IS NULL )
        SET @CustomeFields = '[NoCustomeField]' 


DECLARE @IsBranchInstalled BIT

SELECT @IsBranchInstalled = li.LicenceValue FROM cfg.LicenceInfo AS li 
WHERE li.LicenceKey='IsBranchInstalled'

select @Columns = STUFF((SELECT distinct ',' + QUOTENAME(TraceID) 
									FROM STF.Trace
									FOR XML PATH(''), TYPE
								   ).value('.', 'NVARCHAR(MAX)'),1,1,'')

if(@Columns is null)								   
set @Columns = '[-1]'

set @Query = N'
------------------------
select 
sdt.Title OutgoingType,
------------------
case when StockDeliverID IS NOT NULL THEN mo.Address 
                                     else ad.Address 
                                      end DeliverAddress,
case when StockDeliverID IS NOT NULL THEN CAST( mo.Code AS BIGINT)
                                     else dl.Code  
                                     end  DeliverCode,
case when StockDeliverID IS NOT NULL THEN mo.Phone 
                                      else ph.Phone 
                                      end  DeliverPhone,
case when StockDeliverID IS NOT NULL THEN  mo.Title 
                                      else dl.Title 
                                       end  DeliverTitle
,mo.Supervisor DeliverSupervisorStock,h.Number 
----------------------
,CFG.GetSaturnDate(po.Date,0)[Date],
po.ReturnedOutgoingID,
po.Number NumberAmountOutgoing
----------------------
,stf.Code StuffCode,
stf.Title StuffTitle,
mu.Title UnitTitle,
q.MainQuantity,
q.SubQuantity,
mu2.title SubUnitTitle,
q.RowIndex,
q.Fee,
q.Price,
q.Description
-----------------------
,jo.Phone Stockphone,
jo.Supervisor,
case when @IsBranchInstalled = 1 then  br.Title else '''' end BranchTitle,
br.BranchID,
jo.Title StockTitle,
jo.Code StockCode,
jo.Address StockAddress

,us.Name CreatorName, '+@CustomeFields+N' 
------------------------
from STC.ReturnedOutgoingItem q
left join 
(select ReturnedOutgoingItemID,TraceID,Case When n.DLID IS NOT NULL 
THEN cast ((select title from acc.DL dl where dl.DLID=n.DlID) as nvarchar(max)) else Value end Value
  from STC.ReturnedOutgoingItemTrace n
  ) x
pivot 
(
	 max(Value)
	for TraceID in ( ' + @Columns + ')
)  piv on piv.ReturnedOutgoingItemID = q.ReturnedOutgoingItemID	
join stf.[Stuff] stf on stf.StuffID = q.StuffID
join stf.MeasureUnit mu on stf.MainMeasureUnitID = mu.MeasureUnitID
left join stf.stuffdetail st on st.stuffID=q.StuffID
left join stf.MeasureUnit mu2 on mu2.MeasureUnitID=st.MeasureSubUnitID
join STC.ReturnedOutgoing po on po.ReturnedOutgoingID=q.ReturnedOutgoingID
JOIN [STC].[StockDocumentTypeBaseEntity] sdtb 
    ON po.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
LEFT JOIN 
(
SELECT * FROM
(SELECT ecf.EntityID,ecfd.Fieldname,
case when ecfd.fieldtype = 2 then cfg.GetCLRSaturnDate(ecf.[Value],''YY/MM/DD'',0,0)
when ecf.LookupDataItemID is not null then ldi.Title
else  ecf.[Value] end as Value
 FROM cfg.EntityCustomeField ecfd
LEFT JOIN cfg.EntityCustomeFieldData ecf
 ON ecf.EntityCustomeFieldID = ecfd.EntityCustomeFieldID
LEFT JOIN cfg.LookupDataItem ldi on ldi.LookupDataItemID = ecf.LookupDataItemID
WHERE ecfd.EntityName = ''ReturnedOutgoing''
)x
pivot 
(
         max(Value)
        for Fieldname IN (' + @CustomeFields + ')
)  piv        
)CustomEntities on CustomEntities.EntityID = po.ReturnedOutgoingID
JOIN STC.StockDocumentType sdt ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID

left join CFG.Party p on p.DlID=po.DlDeliverID
left join Acc.DL dl on dl.DLID=po.DlDeliverID
join STF.Stock jo on jo.StockID=po.StockID
left join STF.Stock mo on mo.StockID=po.StockDeliverID
left join cfg.Branch br on mo.BranchID=br.BranchID
left join CFG.Phone ph on ph.PartyID=p.PartyID   And ph.IsMain=1
left join CFG.Address ad on ad.PartyID=p.PartyID  And ad.IsMain=1
left join STC.OutGoingitem qq on qq.OutgoingItemID=q.OutgoingItemID
left join STC.Outgoing h on h.OutgoingID=qq.OutgoingID
JOIN [CFG].[User] us ON us.UserID = q.Creator 
where po.ReturnedOutgoingID in (select id from ##Ids)'
PRINT @Query
DECLARE @Param nVARCHAR(max)

SET @Param = N'@IsBranchInstalled bit'
EXECUTE sp_executeSQL     
            @Query,
            @Param,
            @IsBranchInstalled = @IsBranchInstalled

	
IF EXISTS (SELECT * FROM tempdb.sys.tables WHERE name = '##Ids')DROP TABLE ##Ids

