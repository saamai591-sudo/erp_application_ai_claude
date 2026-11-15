---------------------------------------------------------------------------------------------------------------
CREATE   proc [STM].[SpRptReturnQuantityReceiptItem]
@ID nvarchar(max)
--WITH ENCRYPTION 
AS

create table ##Ids
(id int)

insert into ##Ids
SELECT [value] FROM   cfg.R_FnCommaStr2Table(@ID)

DECLARE @IsBranchInstalled BIT

SELECT @IsBranchInstalled = li.LicenceValue FROM cfg.LicenceInfo AS li 
WHERE li.LicenceKey='IsBranchInstalled'

Declare @Columns AS NVARCHAR(MAX),@Query  AS NVARCHAR(MAX)


select @Columns = STUFF((SELECT distinct ',' + QUOTENAME(TraceID) 
									FROM STF.Trace
									FOR XML PATH(''), TYPE
								   ).value('.', 'NVARCHAR(MAX)'),1,1,'')

if(@Columns is null)								   
set @Columns = '[-1]'

set @Query = N'
select
sdt.Title ReturnQuantityReceiptType,
			kh.Number,
			CFG.GetSaturnDate(kh.Date,0)[date],
q.ReturnStockReceiptID,
p.EconomicCode,
p.NationalID,
p.IdentificationCode,
stf.Code StuffCode,
stf.Title StuffTitle,
mu.Title UnitTitle,
q.MainQuantity,
lp.Title StockTitle,
lp.Phone StockPhone,
lp.Code StockCode
,lp.Supervisor StockSupervisor,
lp.Address StockAddress,
mu3.title SubUnitTitle,
q.SubQuantity,
q.RowIndex,
' + @Columns + ',
case when DeliverStockID IS NOT NULL THEN 
dh.Address 
else ad.Address  end DeliverAddress,
case when DeliverStockID IS NOT NULL THEN 
dh.Code
else cast(dl.Code as bigint)  end  DeliverCode,
case when DeliverStockID IS NOT NULL THEN 
dh.Phone 
else ph.Phone  end  DeliverPhone,
case when DeliverStockID IS NOT NULL THEN 
dh.Title 
else dl.Title  end  DeliverTitle,
q.Description,
u.name CreatorName,
br.BranchID,
case when @IsBranchInstalled = 1 then  br.Title else '''' end BranchTitle

from STC.ReturnStockReceipt kh
JOIN [STC].[StockDocumentTypeBaseEntity] sdtb
	ON kh.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
join STC.ReturnStockReceiptItem q on kh.ReturnStockReceiptID=q.ReturnStockReceiptID
JOIN STC.StockDocumentType sdt ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
left join 
(select ReturnStockReceiptItemID,TraceID,Case When n.DLID IS NOT NULL 
THEN cast ((select title from acc.DL dl where dl.DLID=n.DlID) as nvarchar(max)) else Value end Value
  from STC.ReturnStockReceiptItemTrace n
  ) x
pivot 
(
	 max(Value)
	for TraceID in ( ' + @Columns + ')
)  piv on piv.ReturnStockReceiptItemID = q.ReturnStockReceiptItemID
LEFT join ACC.DL dl on dl.DLID=kh.DeliverDlID
LEFT join STF.Stock dh on dh.StockID=kh.DeliverStockID
join STF.Stock lp on lp.StockID=kh.StockID
join cfg.branch br on br.branchid = lp.branchid
join STF.[Stuff] STF on STF.StuffID = q.StuffID
join STF.MeasureUnit mu on STF.MainMeasureUnitID = mu.MeasureUnitID
left join STF.StuffDetail mu2 on mu2.StuffID = q.StuffID
left join STF.MeasureUnit mu3 on mu3.MeasureUnitID=mu2.MeasuresubUnitID
left join CFG.Party p on p.DlID=kh.DeliverDlID
left join CFG.Phone ph on ph.PartyID=p.PartyID  And ph.IsMain=1
left join CFG.Address ad on ad.PartyID=p.PartyID And ad.IsMain=1
left join cfg.[user] u on u.userid = kh.creator
where  q.ReturnStockReceiptID in (select id from ##Ids)'

DECLARE @Param nVARCHAR(max)
SET @Param = N'@IsBranchInstalled bit'
EXECUTE sp_executeSQL     
            @Query,
              @Param,
            @IsBranchInstalled = @IsBranchInstalled

	
IF EXISTS (SELECT * FROM tempdb.sys.tables WHERE name = '##Ids')DROP TABLE ##Ids


