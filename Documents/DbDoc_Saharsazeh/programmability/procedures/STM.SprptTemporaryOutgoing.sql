
---------------Start of #9340
CREATE       PROC [STM].SprptTemporaryOutgoing
@ID NVARCHAR(MAX)

--WITH ENCRYPTION                   
AS

CREATE TABLE ##Ids
(
	id INT
)

INSERT INTO ##Ids
SELECT [value]
FROM   cfg.R_FnCommaStr2Table(@ID)

DECLARE @Columns               AS NVARCHAR(MAX),
        @Query                 AS NVARCHAR(MAX),
        @CustomeFields         AS NVARCHAR(MAX),
        @IsBranchInstalled     BIT,
        @Param                 NVARCHAR(MAX)
                

SELECT @Columns = STUFF(
           (
               SELECT DISTINCT ',' + QUOTENAME(TraceID)
               FROM   STF.Trace
                      FOR XML PATH(''),
                      TYPE
           ).value('.', 'NVARCHAR(MAX)'),
           1,
           1,
           ''
       )

IF (@Columns IS NULL)
    SET @Columns = '[-1]'

SELECT @CustomeFields = STUFF(
           (
               SELECT DISTINCT ',' + QUOTENAME(Fieldname)
               FROM   cfg.EntityCustomeField
               WHERE  EntityName = 'TemporaryOutgoing'
                      FOR XML PATH(''), TYPE
           ).value('.', 'NVARCHAR(MAX)'),
           1,
           1,
           ''
       )

IF (@CustomeFields IS NULL)
    SET @CustomeFields = '[NoCustomeField]' 
    
    SELECT @IsBranchInstalled = li.LicenceValue FROM cfg.LicenceInfo AS li 
                                                                   
SET @Query = 
    N'
select 

ou.TemporaryOutgoingID,
CFG.GetSaturnDate(ou.Date,0) Date,
dl.title PartyDltitle,
dl.code DLCode,
ou.Number,
p.EconomicCode,
p.NationalID,
p.IdentificationCode,
stf.Code StuffCode,
stf.Title StuffTitle,
mu.Title UnitTitle,mu2.Title SubUnitTitle,
q.MainQuantity,
q.subQuantity,
a.*,
q.RowIndex,
ph.Phone,
up.Address StockAddress,
up.Code StockCode,
up.Phone StockPhone,
up.Supervisor,
up.Title StockTitle,
case when @IsBranchInstalled = 1 then  br.Title else '''' end BranchTitle,
(q.MainQuantity*q.subQuantity)asliDarFaree,
' + @Columns + 
    ',  
u.Name as CreatorName,q.Description,
rc.number ReceptionNumber,
q.stuffid,'+@CustomeFields+N'


FROM STC.TemporaryOutgoingItem q
JOIN STC.TemporaryOutgoing ou on ou.TemporaryOutgoingID=q.TemporaryOutgoingID
Left join ctm.Reception rc on rc.ReceptionID=q.ReceptionID
LEFT JOIN 
(select TemporaryOutgoingItemID,TraceID,Case When n.DLID IS NOT NULL 
THEN cast ((select title from acc.DL t where t.DLID=n.DlID) as nvarchar(max)) else Value end Value
  from STC.TemporaryOutgoingItemTrace n
  ) x
pivot 
(
         max(Value)
        for TraceID in ( ' + @Columns + 
    ')
)  piv on piv.TemporaryOutgoingItemID = q.TemporaryOutgoingItemID
JOIN stf.[Stuff] stf on stf.StuffID = q.StuffID
LEFT JOIN stf.stuffdetail std on std.stuffid = stf.stuffid
JOIN stf.MeasureUnit mu on stf.MainMeasureUnitID = mu.MeasureUnitID
LEFT JOIN stf.MeasureUnit mu2 on std.MeasureSubUnitID = mu2.MeasureUnitID
LEFT JOIN CFG.Party p on p.DlID=ou.DlID
left join acc.dl  dl on dl.dlid=p.dlid
JOIN STF.Stock up on up.StockID=ou.StockID
join cfg.Branch br on up.BranchID=br.BranchID
LEFT JOIN CFG.Phone ph on ph.PartyID=p.PartyID   And ph.IsMain=1 
LEFT JOIN [CFG].[FULLAddressForAllParties]() a on a.PartyID = p.PartyID   And a.IsMain=1
JOIN cfg.[user] u on u.userid = q.Creator
LEFT JOIN 
(
SELECT * FROM
(SELECT ecf.EntityID,ecfd.Fieldname,
case when ecfd.fieldtype = 2 then cfg.getsaturndate(ecf.[Value],0) else  ecf.[Value] end as Value
 FROM cfg.EntityCustomeField ecfd
LEFT JOIN cfg.EntityCustomeFieldData ecf
 ON ecf.EntityCustomeFieldID = ecfd.EntityCustomeFieldID
WHERE ecfd.EntityName = ''TemporaryOutgoing''
)x
pivot 
(
         max(Value)
        for Fieldname IN (' + @CustomeFields + 
    ')
)  piv        
)CustomEntities on CustomEntities.EntityID = ou.TemporaryOutgoingID
where ou.TemporaryOutgoingID in (select id from ##Ids)'

PRINT @Query
SET @Param = N'@IsBranchInstalled bit'
EXECUTE sp_executeSQL     
            @Query,
            @Param,
            @IsBranchInstalled = @IsBranchInstalled

        
IF EXISTS (
       SELECT *
       FROM   tempdb.sys.tables
       WHERE  NAME = '##Ids'
   )
    DROP TABLE ##Ids
    
------------------End of #9340    

