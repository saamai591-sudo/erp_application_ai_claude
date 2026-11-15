
------------------------------------- START #8368
CREATE   proc [STM].[SpRptQuantityReceipt] 
@ID nvarchar(max)
--WITH ENCRYPTION
AS

        DECLARE @ConfigValue BIT ,            
            @UserID INT ,
            @DateType TINYINT ,
            @DateFormat VARCHAR(10) ,
            @Culture VARCHAR(5),
            @CultureNo TINYINT;

        SET @Culture = CFG.GetuserCulture();
        SET @UserID = CFG.GetuserID();
        SELECT @CultureNo = CultureNo		FROM CFG.CultureInfo WHERE Culture = @Culture;
        
        
        SELECT * into #vwEnums FROM cfg.VwEnums AS ve
        WHERE ve.Enum IN( 'StuffDetailTypes','StuffType')		
      
create table #Ids
(id int)

insert into #Ids
SELECT [value] FROM   cfg.R_FnCommaStr2Table(@ID)

Declare @Columns AS NVARCHAR(MAX),@Query  AS NVARCHAR(MAX),@CustomeFields AS NVARCHAR(MAX)

select @Columns = STUFF((SELECT distinct ',' + QUOTENAME(TraceID) 
									FROM STF.Trace
									FOR XML PATH(''), TYPE
								   ).value('.', 'NVARCHAR(MAX)'),1,1,'')

if(@Columns is null)								   
set @Columns = '[-1]'

    SELECT  @CustomeFields = STUFF((SELECT DISTINCT
                                            ',' + QUOTENAME(FieldName)
                                    FROM    CFG.EntityCustomeField
                                    WHERE   EntityName = 'StockReceipt'
            FOR                    XML PATH('') ,
                                       TYPE
                                                                   ).value('.',
                                                              'NVARCHAR(MAX)'),
                                   1, 1, '')
    IF ( @CustomeFields IS NULL )
        SET @CustomeFields = '[NoCustomeField]' 

set @Query = N'
--------------------------------------------------------------------------
SELECT CASE 
            WHEN @CultureNo = 1 THEN sdt.Title
            ELSE sdt.Title2
       END               ReceiptType,
       sdt.Code          StockDocumentType,
       CASE 
            WHEN DeliverStockID IS NOT NULL THEN Case when @CultureNo = 1 then sh.Address Else sh.Address End
            ELSE Case when @CultureNo = 1 then ad.Address else ad.Address2 End
       END               DeliverAddress,
       a.StockID,
       CASE 
            WHEN DeliverStockID IS NOT NULL THEN sh.Code
            ELSE CAST(u.Code as BIGINT)
       END               DeliverCode,
       CASE 
            WHEN DeliverStockID IS NOT NULL THEN sh.Phone
            ELSE ph.Phone
       END               DeliverPhone,
       CASE 
            WHEN DeliverStockID IS NOT NULL THEN Case when @CultureNo = 1 then sh.Title Else sh.Title2 End
            ELSE Case when @CultureNo = 1 then  u.Title Else u.Title2 End
       END               DeliverTitle,
       a.Number,
       CFG.GetSaturnDate(a.date, 0) [Date],
       q.StockReceiptItemID,
       p.EconomicCode,
       p.NationalID,
       p.IdentificationCode,
       x.Code            StockCode,
       stf.Code          StuffCode,
       st.Barcode,
       ve.[Value]     AS StuffDetailType,
      Case when @CultureNo = 1 then  stf.Title Else stf.Title2 End         StuffTitle,
      Case When @CultureNo = 1 then  mu.Title Else mu.Title2 End         UnitTitle,
       q.MainQuantity,
       q.SubQuantity,
       a.StockReceiptID,
        sh.Supervisor DeliverStockSupervisor,
       q.RowIndex,
       Case when @CultureNo = 1 Then  x.Title Else x.Title2 End          StockTitle,
       
x.Address StockAddress,
x.Supervisor,
x.Phone StockPhone,
Case When @CultureNo = 1 then  mu2.Title Else mu2.Title2 End SubUnitTitle
,' + @Columns + ',
Name as CreatorName,
Case when @CultureNo = 1 then q.Description Else q.Description2 End as Description
,q.fee,q.price,
CustomEntities.*,
 Case When @CultureNo = 1 Then br.Title Else br.Title2 End BranchName,
Case when @CultureNo = 1 Then cmp.Title Else cmp.Title2 End CompanyTitle,
br.BranchID,
st.TechnicalCode,
STF.StuffGroupFullCode(stf.StuffGroupID) StuffGroupCode,
STF.StuffGroupFullTitle(stf.StuffGroupID) StuffGroupTitle
----------------------------------------------------------------------------
from STC.StockReceiptItem q
join STC.StockReceipt a on a.StockReceiptID=q.StockReceiptID
JOIN [STC].[StockDocumentTypeBaseEntity] sdtb ON a.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
JOIN STC.StockDocumentType sdt ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
left join 
(
select StockReceiptItemID,TraceID,
Case When n.DLID IS NOT NULL 
THEN cast ((select Case when @CultureNo = 1 then title Else Title2 End Title from acc.DL u where u.DLID=n.DlID) as nvarchar(max)) 
when n.traceitemid is not null then cast ((select item from stf.traceitem g where g.traceitemid=n.traceitemid ) as nvarchar(max))
else Value end Value
  from STC.StockReceiptItemTrace n
  ) x
pivot 
(
	 max(Value)
	for TraceID in ( ' + @Columns + ')
)  piv on piv.StockReceiptItemID = q.StockReceiptItemID
join stf.[vwStuff] stf on stf.StuffID = q.StuffID
join #vwEnums ve on  stf.StuffDetailType = ve.KeyValue and ve.Enum = ''StuffDetailTypes''
join #vwEnums ve1 on stf.Type = ve1.KeyValue and ve1.Enum = ''StuffType''
join STF.Stock x on x.StockID=a.StockID
join cfg.branch br on br.branchid = x.branchid
join cfg.Company cmp on br.CompanyID = cmp.CompanyID
 left join STF.Stock sh on sh.StockID=a.DeliverStockID
join stf.MeasureUnit mu on stf.MainMeasureUnitID = mu.MeasureUnitID
left join stf.StuffDetail st on st.stuffid=q.stuffid
LEFT JOIN STF.StuffAccountGroup SAG ON SAG.StuffAccountGroupID = st.StuffAccountGroupID
left join stf.MeasureUnit mu2 on mu2.MeasureUnitID=st.MeasureSubUnitID
left join cfg.Party p on p.DlID = a.DeliverDlID
left join ACC.DL u on u.DLID=a.DeliverDlID
left join CFG.Address ad on ad.PartyID=p.PartyID    And ad.IsMain=1
left join CFG.Phone ph on ph.PartyID=p.PartyID        And ph.IsMain=1
join CFG.[User] us on us.UserID=a.Creator
LEFT JOIN 
(
SELECT * FROM
(SELECT ecf.EntityID,ecfd.Fieldname,
case when ecfd.fieldtype = 2 then cfg.getsaturndate(ecf.[Value],0) else  ecf.[Value] end as Value
 FROM cfg.EntityCustomeField ecfd
LEFT JOIN cfg.EntityCustomeFieldData ecf
 ON ecf.EntityCustomeFieldID = ecfd.EntityCustomeFieldID
WHERE ecfd.EntityName = ''StockReceipt''
)x
pivot 
(
         max(Value)
        for Fieldname IN (' + @CustomeFields + ')
)  piv        
)CustomEntities on CustomEntities.EntityID = a.StockReceiptID
where  q.StockReceiptID in (select id from #Ids)'
print @Query



        EXECUTE sp_executesql @Query, N'	
			@CultureNo TinyInt
	       ', 
            @CultureNo = @CultureNo;
	
IF EXISTS (SELECT * FROM tempdb.sys.tables WHERE name = '#Ids')DROP TABLE #Ids
