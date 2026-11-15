
------------Start of #9269
CREATE   PROC [STM].SpRptStuffRequest 
	@ID NVARCHAR(MAX)
--WITH ENCRYPTION 
AS
	SELECT [value] id
	INTO   #Ids
	FROM   CFG.R_FnCommaStr2Table(@ID);

	DECLARE @Columns AS NVARCHAR(MAX) ,
			@Query AS NVARCHAR(MAX) ,
			@CustomeFields AS NVARCHAR(MAX) ,
			@CustomeFieldSelect AS NVARCHAR(MAX) ,
			@DateType VARCHAR(10) ,
			@DateFormat VARCHAR(10) ,
			@UserID INT ,
			@Culture VARCHAR(10),
			@CultureNo Tinyint;


	SET @Culture = CFG.GetuserCulture();

	SET @UserID = CFG.GetuserID();

	select @CultureNo = CultureNo
	from cfg.CultureInfo
	where Culture = @Culture

	SELECT @DateType = us.SettingValue
	FROM   CFG.UserSetting us
	WHERE  us.SettingKey = 'Date_Type'
		   AND us.UserID = @UserID;
	IF @DateType IS NULL
		SET @DateType = CASE @Culture
							 WHEN 'fa' THEN 0
							 WHEN 'en' THEN 1
							 WHEN 'ar' THEN 2
						END;

	SELECT @DateFormat = us.SettingValue
	FROM   CFG.UserSetting us
	WHERE  us.SettingKey = 'Date_Format'
		   AND us.UserID = @UserID;

	IF @DateFormat IS NULL
		SET @DateFormat = 'YY/MM/DD';

	SELECT @Columns = STUFF(
	(   SELECT DISTINCT ',' + QUOTENAME(TraceID)
		FROM   STF.Trace
		FOR XML PATH(''), TYPE ).value('.', 'NVARCHAR(MAX)') ,
	1   ,
	1   ,
	''  );

	IF ( @Columns IS NULL )
		SET @Columns = '[-1]';


	SELECT @CustomeFields = STUFF(
	(   SELECT DISTINCT ',' + QUOTENAME(FieldName)
		FROM   CFG.EntityCustomeField
		WHERE  EntityName = 'StuffRequest'
		FOR XML PATH(''), TYPE  ).value('.', 'NVARCHAR(MAX)') ,
	1   ,
	1   ,
	''  );
	IF ( @CustomeFields IS NULL )
		SET @CustomeFields = '[NoCustomeField]';

	SELECT @CustomeFieldSelect = STUFF(
	(   SELECT DISTINCT ',CustomEntities.' + QUOTENAME(FieldName) + ' As cf_'
						+ FieldName
		FROM   CFG.EntityCustomeField
		WHERE  EntityName = 'StuffRequest'
		FOR XML PATH(''), TYPE       ).value('.', 'NVARCHAR(MAX)') ,
	1   ,
	1   ,
	''  );
	IF ( @CustomeFieldSelect IS NULL )
		SET @CustomeFieldSelect = '[NoCustomeField]';

	SET @Query = N'
		SELECT a.StuffRequestNumber ,
			   CFG.GetCLRSaturnDate(a.StuffRequestDate,''' + @DateFormat + '''  , 0, ''' + @DateType + ''')  [date] ,
			   fp.Title StuffRequestYear,
			   ou.Title StuffRequester ,
			   ou.Code StuffRequesterCode,
			   a.StuffRequestID ,
			   q.StuffID,
			   q.MainQuantity ,
			   q.AcceptRequestMainMeasureQuantity,
			   q.AcceptRequestSubMeasureQuantity,
			   q.StuffRequestItemIndex ,
			   case when @CultureNo = 1 then stf.Title else stf.Title2  end stuffTitle ,
			   stf.TechnicalCode,
			   case when @CultureNo = 1 then stf.MainMeasureUnit else stf.MainMeasureUnit2  end MeasureUnit ,
			   StuffRequestState,
			   ' + @Columns + ' ,
			   ' + @CustomeFieldSelect + ' ,
			   stf.Code StuffCode ,
			   case when @CultureNo = 1 then q.Description else q.Description2  end Description,
			   stc1.Code FromStockCode,
			   case when @CultureNo = 1 then stc1.Title else stc1.Title2  end FromStockTitle,
			   stc2.Code ToStockCode,
			   case when @CultureNo = 1 then stc2.Title else stc2.Title2  end ToStockTitle,
			   case when @CultureNo = 1 then cc.Title else cc.Title2  end CostCenterTitle
		FROM   REQ.[StuffRequest] a
			   join cfg.financialperiod fp on fp.financialperiodID = a.financialperiodID
			   JOIN REQ.StuffRequestItem q ON q.StuffRequestID = a.StuffRequestID
			   Left join cfg.CostCenter cc on q.CostCenterID = cc.CostCenterID
			   LEFT JOIN (   SELECT StuffRequestItemID ,
									TraceID ,
									CASE WHEN tr.DlID IS NOT NULL THEN
											 CAST((   SELECT case when @CultureNo = 1 then Title else Title2  end
													  FROM   ACC.DL u
													  WHERE  u.DLID = tr.DlID ) AS NVARCHAR(MAX))
										 ELSE Value
									END Value
							 FROM   REQ.StuffRequestItemTrace tr ) x
			   PIVOT (   MAX(Value)
						 FOR TraceID IN ( ' + @Columns  + ')
			   ) piv ON piv.StuffRequestItemID = q.StuffRequestItemID
			   JOIN STF.[vwStuff] stf ON stf.StuffID = q.StuffID
			   left JOIN CFG.OrganizationUnit ou ON ou.OrganizationUnitID = a.OrganizationUnitID
			   left join STF.Stock stc1 on a.FromStockID = stc1.StockID
			   left join stf.Stock stc2 on a.ToStockID = stc2.StockID
			   JOIN #Ids ON #Ids.id = a.StuffRequestID
			   LEFT JOIN 
			   (   
					SELECT ecf.EntityID ,
							ecfd.FieldName ,
							CASE WHEN ecfd.FieldType = 2 THEN CFG.GetCLRSaturnDate(ecf.[Value],''' + @DateFormat + '''  , 0, ''' + @DateType + ''') 
							WHEN ld.Type = 1 then ldi.Title 
							When ld.Entity = ''Currency'' then case when @CultureNo = 1 then Currency.Title else Currency.Title2  end 
							When ld.Entity = ''Party'' then case when @CultureNo = 1 then dl.Title else dl.Title2  end 
							ELSE ecf.[Value]
							END AS Value
					FROM   CFG.EntityCustomeField ecfd
					LEFT JOIN CFG.EntityCustomeFieldData ecf ON ecf.EntityCustomeFieldID = ecfd.EntityCustomeFieldID
					LEFT JOIN CFG.LookupData ld on ld.LookupDataID = ecfd.LookupDataID
					LEFT JOIN CFG.LookupDataItem ldi on ldi.LookupDataID = ld.LookupDataID and ldi.LookupDataItemID = ecf.LookupDataItemID
					LEFT JOIN CFG.Currency on ld.Entity = ''Currency'' and Currency.CurrencyID = ecf.LookupDataItemID
					LEFT JOIN CFG.Party on ld.Entity = ''Party'' and Party.PartyID = ecf.LookupDataItemID
					LEFT JOIN acc.dl on dl.DLID = party.DlID
					WHERE  ecfd.EntityName = ''StuffRequest''
			   ) x
			   PIVOT (   MAX(Value)
						 FOR FieldName IN ( ' + @CustomeFields + ')
			   ) CustomEntities ON CustomEntities.EntityID = q.StuffRequestID
'   ;

	EXECUTE sp_executesql @Query,
						N'@CultureNo TinyInt',
						  @CultureNo = @CultureNo;
-----------------End of #9269

