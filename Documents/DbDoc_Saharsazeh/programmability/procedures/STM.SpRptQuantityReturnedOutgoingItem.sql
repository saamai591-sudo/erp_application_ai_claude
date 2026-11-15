------------------------------------------------------------

CREATE     PROC [STM].SpRptQuantityReturnedOutgoingItem 
@ID nvarchar(max)

	--WITH ENCRYPTION 
	AS

	create table ##Ids
	(id int)

	insert into ##Ids
	SELECT [value] FROM   cfg.R_FnCommaStr2Table(@ID)

	DECLARE @UserID                    INT,
			@DateType                  VARCHAR(10),
			@DateFormat                VARCHAR(10),
			@Columns                   AS NVARCHAR(MAX),
			@SelectColumns                   AS NVARCHAR(MAX),
			@Query                     AS NVARCHAR(MAX),
			@CustomeFields             AS NVARCHAR(MAX),
			@CustomeFieldSelect        AS NVARCHAR(MAX),
			@Culture                   VARCHAR(10),
			@OutgoingCustomeFields     AS NVARCHAR(MAX),
			@Param nVARCHAR(max)

	
	SET @Culture = CFG.GetuserCulture()

	SET @UserID = cfg.GetuserID()

	SELECT @DateType = us.SettingValue
	FROM   cfg.UserSetting us
	WHERE  us.SettingKey = 'Date_Type'
		   AND us.UserID = @UserID

	IF @DateType IS NULL
		SET @DateType = CASE @Culture
							 WHEN 'fa' THEN 0
							 WHEN 'en' THEN 1
							 WHEN 'ar' THEN 2
						END
	
	SELECT @DateFormat = us.SettingValue
	FROM   cfg.UserSetting us
	WHERE  us.SettingKey = 'Date_Format'
		   AND us.UserID = @UserID
		   
	IF @DateFormat IS NULL
		SET @DATEFORMAT = 'YY/MM/DD'


	select @Columns = STUFF((SELECT distinct ',' + QUOTENAME(TraceID) 
										FROM STF.Trace
										FOR XML PATH(''), TYPE
									   ).value('.', 'NVARCHAR(MAX)'),1,1,'')

	if(@Columns is null)								   
	set @Columns = '[-1]'

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

	set @Query = N'
	select
			sdt.Title OutgoingType,
			sdt.DocumentType,
			kh.Number,
			CFG.GetCLRSaturnDate(kh.[date] , @DateFormat  , 0,  @DateType ) [date],
			case when StockDeliverID IS NOT NULL THEN dh.Address else ad.TitleAddress  end DeliverAddress,
			case when StockDeliverID IS NOT NULL THEN CAST( dh.Code AS BIGINT) else dl.Code  end  DeliverCode,
			case when StockDeliverID IS NOT NULL THEN dh.Phone else ph.Phone  end  DeliverPhone,
			case when StockDeliverID IS NOT NULL THEN dh.Title else dl.Title  end  DeliverTitle,
			p.EconomicCode,
			p.NationalID,
			p.IdentificationCode,
			stf.Code StuffCode,
			stf.Title StuffTitle,
			MainMeasureUnit UnitTitle,
			q.MainQuantity,
			q.OutGoingItemID,
			lp.Title StockTitle,
			lp.Phone StockPhone,
			lp.Code StockCode,
			lp.Supervisor StockSupervisor,
			lp.Address StockAddress,
			q.RowIndex,
			dh.Supervisor  DeliverStockSupervisor,
			' + @Columns + ',
			kh.ReturnedOutgoingID,
			q.Description,
			q.SubQuantity,
			SubMeasureUnit SubUnitTitle,
			ad.*,
			us.Name CreatorName ,
			ph.Fax,
			br.Title BranchName,
			br.BranchID,
			'+@CustomeFields+N'
	from ##Ids id
	join STC.ReturnedOutgoingItem q on id.id = q.ReturnedOutgoingID
	JOIN STC.ReturnedOutgoing kh ON kh.ReturnedOutgoingID=q.ReturnedOutgoingID
	LEFT JOIN 
	(
		SELECT  ecf.EntityID,
				ecfd.Fieldname,
				case when ecfd.fieldtype = 2 then cfg.GetCLRSaturnDate(ecf.[Value],''YY/MM/DD'',0,0)
					 when ecf.LookupDataItemID is not null then ldi.Title
					else  ecf.[Value] end as Value
		FROM cfg.EntityCustomeField ecfd
		LEFT JOIN cfg.EntityCustomeFieldData ecf ON ecf.EntityCustomeFieldID = ecfd.EntityCustomeFieldID
		LEFT JOIN cfg.LookupDataItem ldi on ldi.LookupDataItemID = ecf.LookupDataItemID
		WHERE ecfd.EntityName = ''ReturnedOutgoing''
	)x
	pivot 
	(
		max(Value)
		for Fieldname IN (' + @CustomeFields + ')
	)CustomEntities on CustomEntities.EntityID = kh.ReturnedOutgoingID
	JOIN [STC].[StockDocumentTypeBaseEntity] sdtb 
		ON kh.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
	JOIN STC.StockDocumentType sdt ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
	LEFT JOIN 
	(
		select  ReturnedOutgoingItemID,
				TraceID,
				Case When n.DLID IS NOT NULL 
						THEN cast ((select title from acc.DL t where t.DLID=n.DlID) as nvarchar(max)) 
					 When n.traceitemid is not null then cast ((select item from stf.traceitem t where t.traceitemid=n.traceitemid) as nvarchar(max))
					else Value end Value
		from STC.ReturnedOutgoingItemTrace n
	) x
	pivot 
	(
		 max(Value)
		for TraceID in ( ' + @Columns + ')
	)  piv on piv.ReturnedOutgoingItemID = q.ReturnedOutgoingItemID
	LEFT JOIN ACC.DL dl ON dl.DLID=kh.DlDeliverID
	LEFT JOIN STF.Stock dh ON dh.StockID=kh.StockDeliverID
	JOIN STF.Stock lp ON lp.StockID=kh.StockID
	join cfg.branch br on br.branchid = lp.branchid
	JOIN STF.vwStuff stf ON stf.StuffID = q.StuffID
	LEFT JOIN CFG.Party p ON p.DlID=kh.DlDeliverID
	left join CFG.vwPhone ph on ph.PartyID=p.PartyID 
	LEFT JOIN CFG.vwAddress ad ON ad.PartyID=p.PartyID and ad.ismain = 1
	JOIN CFG.[USER] Us ON us.USERID=kh.Creator'
	

	EXECUTE sp_executeSQL     
				@Query,
				N'@DateType    VARCHAR(10),
				  @DateFormat  VARCHAR(10)',
				@DateType = @DateType,
				@DateFormat = @DateFormat

	
	IF EXISTS (SELECT * FROM tempdb.sys.tables WHERE name = '##Ids')DROP TABLE ##Ids
