------------------------------------------------------------------------------------------------------------------
CREATE   proc [STM].[SpRptAmountOutgoingItem] 
@ID nvarchar(max)
--WITH ENCRYPTION 
AS

create table ##Ids
(id int)

insert into ##Ids
SELECT [value] FROM   cfg.R_FnCommaStr2Table(@ID)

DECLARE @IsBranchInstalled BIT
SELECT @IsBranchInstalled = li.LicenceValue FROM cfg.LicenceInfo AS li 

Declare @Columns AS NVARCHAR(MAX),@Query  AS NVARCHAR(MAX)
select @Columns = STUFF((SELECT distinct ',' + QUOTENAME(TraceID) 
									FROM STF.Trace
									FOR XML PATH(''), TYPE
								   ).value('.', 'NVARCHAR(MAX)'),1,1,'')

if(@Columns is null)								   
set @Columns = '[-1]'

set @Query = N'
select 
sdt.Title   OutgoingType,
ou.OutgoingID,
CFG.GetSaturnDate(ou.date,0) [Date],
ou.Number,
STF.StuffGroupCode StuffGroupCode,
STF.StuffGroupTitle StuffGroupTitle,
stf.Code StuffCode,
stf.Title StuffTitle,
stf.MainMeasureUnit UnitTitle,
q.MainQuantity,
q.SubQuantity,
a.*,
q.RowIndex,
q.Fee,
q.Price,
up.Address StockAddress,
up.Code StockCode,
up.Phone StockPhone,
up.Supervisor,
up.Title StockTitle,
case when @IsBranchInstalled = 1 then  br.Title else '''' end  BranchTitle,
br.BranchID,
' + @Columns + ',
case when DeliverStockID IS NOT NULL THEN 
h.Address 
else a.Address  end DeliverAddress,
case when DeliverStockID IS NOT NULL THEN 
CAST(h.Code AS BIGINT)
else t.Code  end  DeliverCode,
case when DeliverStockID IS NOT NULL THEN 
h.Phone 
else ph.Phone  end  DeliverPhone,
case when DeliverStockID IS NOT NULL THEN 
h.Title 
else t.Title  end  DeliverTitle
,h.Supervisor DeliverStockSupervisor,stf.SubMeasureUnit SubUnitTitle
,us.Name CreatorName
from STC.OutgoingItem q
JOIN STC.Outgoing ou on ou.OutgoingID=q.OutgoingID
JOIN [STC].[StockDocumentTypeBaseEntity] sdtb 
	ON ou.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
JOIN STC.StockDocumentType sdt ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
LEFT JOIN 
(select OutgoingItemID,TraceID,Case When n.DLID IS NOT NULL 
THEN cast ((select title from acc.DL t where t.DLID=n.DlID) as nvarchar(max)) else Value end Value
  from STC.OutgoingItemTrace n
  ) x
pivot 
(
	 max(Value)
	for TraceID in ( ' + @Columns + ')
)  piv on piv.OutgoingItemID = q.OutgoingItemID
JOIN stf.vwStuff stf on stf.StuffID = q.StuffID
LEFT JOIN CFG.Party p on p.DlID=ou.DeliverDlID
LEFT JOIN Acc.DL t on t.DLID=ou.DeliverDlID
LEFT JOIN STF.Stock h on h.StockID=ou.DeliverStockID 
JOIN STF.Stock up on up.StockID=ou.StockID
join Cfg.Branch Br on up.BranchID=Br.BranchID
LEFT JOIN CFG.Phone ph on ph.PartyID=p.PartyID   And ph.IsMain=1
LEFT JOIN [CFG].[FULLAddressForAllParties]() a on a.PartyID = p.PartyID   And a.IsMain=1
JOIN [CFG].[User] us ON us.UserId = q.Creator
where q.OutgoingID in (select id from ##Ids)'

DECLARE @Param nVARCHAR(max)
SET @Param = N'@IsBranchInstalled bit'
EXECUTE sp_executeSQL     
            @Query,
            @Param,
            @IsBranchInstalled = @IsBranchInstalled
	
IF EXISTS (SELECT * FROM tempdb.sys.tables WHERE name = '##Ids')DROP TABLE ##Ids





