---------------------------------------------------------------------------------------------------------------
CREATE   proc [STM].[SpRptReturnAmountReceiptItem] 
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
sdt.Title ReceiptType,
			CFG.GetSaturnDate(f.date,0) [Date],
p.EconomicCode,
p.IdentificationCode
----------اطلاعات آیتم--------
,stf.Code StuffCode,
stf.Title StuffTitle,
mu.Title UnitTitle,
q.MainQuantity,
q.SubQuantity,
q.RowIndex,' + @Columns + ',
q.Fee InvoiceFee,
q.Price InvoicePrice,
mu2.Title SubUnitTitle
----------------اطلاعات هدر و انبار  --------------
,f.ReturnStockReceiptID,
f.Number NumberReturnAmountReceipt,
stu.Address StockAddress,
stu.Supervisor,
stu.Title StockTitle,
stu.code stockcode
,stu.Phone StockPhone
,case when @IsBranchInstalled = 1 then  br.Title else '''' end BranchTitle
,br.BranchID
----------------------------------------------------
,lp.Supervisor DeliverStockSuprvisor,
case when DeliverStockID IS NOT NULL THEN  lp.Address 
                                     else ad.Address 
                                     end DeliverAddress,
case when DeliverStockID IS NOT NULL THEN lp.Code
                                     else cast(t.Code as bigint) 
                                     end  DeliverCode,
case when DeliverStockID IS NOT NULL THEN lp.Phone 
                                     else ph.Phone  
                                     end  DeliverPhone,
case when DeliverStockID IS NOT NULL THEN lp.Title 
                                      else t.Title
                                      end  DeliverTitle
---------------------
,us.Name CreatorName 

from STC.ReturnStockReceiptItem q
left join 
(select ReturnStockReceiptItemID,TraceID,Case When Re.DLID IS NOT NULL 
THEN cast ((select title from acc.DL u where u.DLID=Re.DlID) as nvarchar(max)) else Value end Value
  from STC.ReturnStockReceiptItemTrace Re
  ) x
pivot 
(
	 max(Value)
	for TraceID in ( ' + @Columns + ')
)  piv on piv.ReturnStockReceiptItemID = q.ReturnStockReceiptItemID
join stf.[Stuff] stf on stf.StuffID = q.StuffID
join stf.MeasureUnit mu on stf.MainMeasureUnitID = mu.MeasureUnitID
left join stf.stuffdetail st on st.stuffID=q.stuffID
left join stf.MeasureUnit mu2 on  mu2.MeasureUnitID=st.MeasureSubUnitID
join STC.ReturnStockReceipt f on f.ReturnStockReceiptID=q.ReturnStockReceiptID
JOIN [STC].[StockDocumentTypeBaseEntity] sdtb
    ON f.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
JOIN STC.StockDocumentType sdt ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID

left join cfg.Party p on p.DlID=f.DeliverDlID
left join ACC.DL t on t.DLID=f.DeliverDlID
left join STF.Stock stu on stu.stockID=f.stockID
left join CFG.Phone ph on ph.PartyID=p.PartyID   And ph.IsMain=1
left join STC.StockReceiptItem r on r.StockReceiptItemID=q.StockReceiptItemID
left join CFG.Address ad on ad.PartyID=p.PartyID  And ad.IsMain=1
left join STF.Stock lp  on lp.StockID=f.DeliverStockID
JOIN CFG.[USER] Us ON us.UserId= q.Creator
join cfg.Branch br on stu.branchid=br.branchid
where f.ReturnStockReceiptID in (select id from ##Ids)'

DECLARE @Param nVARCHAR(max)

SET @Param = N'@IsBranchInstalled bit'
EXECUTE sp_executeSQL     
            @Query,
            @Param,
            @IsBranchInstalled = @IsBranchInstalled
	
IF EXISTS (SELECT * FROM tempdb.sys.tables WHERE name = '##Ids')DROP TABLE ##Ids

