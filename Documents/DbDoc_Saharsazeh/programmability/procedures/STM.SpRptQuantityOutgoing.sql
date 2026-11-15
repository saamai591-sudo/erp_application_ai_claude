



CREATE   PROC [STM].SpRptQuantityOutgoing
    @ID NVARCHAR(MAX)

--WITH ENCRYPTION 
AS
 IF EXISTS ( SELECT  *
                FROM    tempdb.sys.tables
                WHERE   name = '#Ids' )
        DROP TABLE #Ids

    CREATE TABLE #Ids ( id INT )

    INSERT  INTO #Ids
            SELECT  [value]
            FROM    CFG.R_FnCommaStr2Table(@ID)

    DECLARE @Columns AS NVARCHAR(MAX) ,
	    @UserID INT,
    	@Culture varchar(10),
        @Query AS NVARCHAR(MAX) ,
        @CustomeFields AS NVARCHAR(MAX),
		@DateType  VARCHAR(10),
		@DateFormat VARCHAR(10),
		@RemittanceCustomeFields  AS NVARCHAR(MAX)
		DECLARE @IsBranchInstalled BIT
SELECT @IsBranchInstalled = li.LicenceValue FROM cfg.LicenceInfo AS li 

	set @Culture = CFG.GetuserCulture()

	SET  @UserID=cfg.GetuserID()

	SELECT @DateType = us.SettingValue
	FROM   cfg.UserSetting us
	WHERE  us.SettingKey = 'Date_Type'
		   AND us.UserID = @UserID
	IF @DateType IS NULL
	SET @DateType = CASE @Culture WHEN 'fa' THEN 0	
											  WHEN 'en' THEN 1
											  WHEN 'ar' THEN 2 END
	
	SELECT @DateFormat = us.SettingValue
	FROM   cfg.UserSetting us
	WHERE  us.SettingKey = 'Date_Format'
		   AND us.UserID =  @UserID
	       
	IF @DateFormat IS NULL
	SET @DATEFORMAT = 'YY/MM/DD'
                

    SELECT  @Columns = STUFF((SELECT DISTINCT
                                        ',' + QUOTENAME(TraceID)
                              FROM      STF.Trace
            FOR              XML PATH('') ,
                                 TYPE
                                                                   ).value('.',
                                                              'NVARCHAR(MAX)'),
                             1, 1, '')

    IF ( @Columns IS NULL )
        SET @Columns = '[-1]'

    SELECT  @CustomeFields = STUFF((SELECT DISTINCT
                                            ',' + QUOTENAME(FieldName)
                                    FROM    CFG.EntityCustomeField
                                    WHERE   EntityName = 'Outgoing'
            FOR                    XML PATH('') ,
                                       TYPE
                                                                   ).value('.',
                                                              'NVARCHAR(MAX)'),
                                   1, 1, '')
    IF ( @CustomeFields IS NULL )
        SET @CustomeFields = '[NoCustomeField]' 


								   
if(@Columns is null)								   
set @Columns = '[-1]'
                                                                   
   SET @Query = N'




select  
		sdt.Title   OutgoingType,
		STF.StuffGroupCode,
		STF.StuffGroupTitle,
		ou.OutgoingID,
		cfg.GetCLRSaturnDate(ou.date,''YY/MM/DD'',0,0) [Date],
		ou.Number,
		p.EconomicCode,
		p.NationalID,
		p.IdentificationCode,
		stf.Code StuffCode,
		stf.StuffCode CodewithoutGroup,
		stf.Title StuffTitle,
		stf.stuffid,
		stf.TechnicalCode,
		stf.ConvertRatio,
		MainMeasureUnit UnitTitle,
		SubMeasureUnit SubUnitTitle,
		q.MainQuantity,
		q.subQuantity,
		q.fee,
		q.outgoingitemid,
		q.price,
		a.AddressID	,
		a.AddressTypeID	,
		a.IsMain	,
		a.TitleAddress	Address	,
		a.ZipCode	,
		a.country	,
		a.province	,
		a.county	,
		a.city	,
		a.PreNumberOfCity	PreNumber	,
		q.RowIndex,
		up.Address StockAddress,
		up.Code StockCode,
		up.Phone StockPhone,
		up.Supervisor,
		up.Title StockTitle,
		p.PartyID,
		h.Supervisor DeliverStockSupervisor,
		(q.MainQuantity*q.subQuantity) asliDarFaree,
		' + @Columns+ ',
		u.Name as CreatorName,
		case when DeliverStockID IS NOT NULL THEN h.Address 
			else a.TitleAddress  end DeliverAddress,
		case when DeliverStockID IS NOT NULL THEN cast(h.Code as nvarchar(250))
			else t.Code  end  DeliverCode,
		case when DeliverStockID IS NOT NULL THEN h.Phone 
			else ph.Phone end  DeliverPhone,
		case when DeliverStockID IS NOT NULL THEN 
		h.Title 
		else t.Title  end  DeliverTitle,
		(select top 1 H.number
		from sle.invoiceitem  I
		JOIN sle.invoice H on H.invoiceid = I.invoiceid
		where I.invoiceitemid = q.invoiceitemid
		order by I.invoiceitemid)as InvoiceNumber,
		(select top 1 ad.Address
		from sle.invoiceitem  I
		JOIN sle.invoice H on H.invoiceid = I.invoiceid
		LEFT JOIN cfg.Address ad on ad.AddressID=H.AddressID
		where I.invoiceitemid = q.invoiceitemid
		and H.AddressID is not null
		order by I.invoiceitemid)as InvoiceAddress, 
		CustomEntities.*,
		ph.fax  ,
		q.description,
		ph.Mobile ,
		case when @IsBranchInstalled = 1 then  br.Title else '''' end BranchName,
		br.BranchID,
		(select top 1 ad.Address 
		from sle.Remittanceitem re 
		join sle.Remittance r on re.RemittanceID=r.RemittanceID
		join cfg.Address ad on ad.AddressID=r.AddressID
		join cfg.Location lo on lo.LocationID=ad.LocationID
		where re.RemittanceItemID=q.RemittanceItemID
		) Address_From_Remittance


FROM STC.Outgoing ou
JOIN [STC].[StockDocumentTypeBaseEntity] sdtb ON ou.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
JOIN STC.OutgoingItem q on ou.OutgoingID=q.OutgoingID
JOIN STC.StockDocumentType sdt ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
LEFT JOIN 
(select OutgoingItemID,TraceID,Case When n.DLID IS NOT NULL 
THEN cast ((select title from acc.DL t where t.DLID=n.DlID) as nvarchar(max)) 
when n.traceitemid is not null then cast ((select item from stf.traceitem t where t.traceitemid=n.traceitemid) as nvarchar(max))
else Value end Value
  from STC.OutgoingItemTrace n
  ) x
pivot 
(
         max(Value)
        for TraceID in ( ' + @Columns
        + ')
)  piv on piv.OutgoingItemID = q.OutgoingItemID
JOIN stf.vwStuff stf on stf.StuffID = q.StuffID
LEFT JOIN CFG.Party p on p.DlID=ou.DeliverDlID
LEFT JOIN Acc.DL t on t.DLID=ou.DeliverDlID
LEFT JOIN STF.Stock h on h.StockID=ou.DeliverStockID 
JOIN STF.Stock up on up.StockID=ou.StockID
JOIN cfg.branch br on br.branchid = up.branchid
left join sle.Remittanceitem re on re.Remittanceitemid=q.Remittanceitemid
LEFT JOIN [CFG].vwaddress a on a.PartyID = p.PartyID   And a.IsMain=1
LEFT JOIN [CFG].vwphone ph on ph.PartyID = p.PartyID
JOIN cfg.[user] u on u.userid = q.Creator
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
WHERE ecfd.EntityName = ''Outgoing''
)x
pivot 
(
         max(Value)
        for Fieldname IN (' + @CustomeFields + ')
)  piv        
)CustomEntities on CustomEntities.EntityID = ou.OutgoingID




where ou.OutgoingID in (select id from #Ids)'

DECLARE @Param nVARCHAR(max)
SET @Param = N'@IsBranchInstalled bit'
EXECUTE sp_executeSQL     
            @Query,
            @Param,
            @IsBranchInstalled = @IsBranchInstalled

        print @Query
    IF EXISTS ( SELECT  *
                FROM    tempdb.sys.tables
                WHERE   name = '#Ids' )
        DROP TABLE #Ids


