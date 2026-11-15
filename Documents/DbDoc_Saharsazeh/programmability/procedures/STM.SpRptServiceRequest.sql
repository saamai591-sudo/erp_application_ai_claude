
-----------------------------------------------------------
CREATE   PROC [STM].SpRptServiceRequest
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
            @Culture VARCHAR(10);


    SET @Culture = CFG.GetuserCulture();

    SET @UserID = CFG.GetuserID();

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
        WHERE  EntityName = 'ServiceRequest'
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
        WHERE  EntityName = 'ServiceRequest'
        FOR XML PATH(''), TYPE       ).value('.', 'NVARCHAR(MAX)') ,
    1   ,
    1   ,
    ''  );
    IF ( @CustomeFieldSelect IS NULL )
        SET @CustomeFieldSelect = '[NoCustomeField]';

    SET @Query = N'
		SELECT a.Number ,
			   CFG.GetCLRSaturnDate(a.Date,''' + @DateFormat + '''  , 0, ''' + @DateType + ''')  [date] ,
			   ou.Title ServiceRequester ,
			   a.ServiceRequestID ,
			   q.StuffID,
			   q.Quantity ,
			   q.RowIndex ,
			   stf.Title stuffTitle ,
			   stf.TechnicalCode,
			   vb.Title MeasureUnit ,
			   ' + @CustomeFieldSelect + ' ,
			   stf.Code StuffCode ,
			   q.Description,
			   cc.Title CostCenterTitle
		FROM   REQ.[ServiceRequest] a
			   JOIN REQ.ServiceRequestItem q ON q.ServiceRequestID = a.ServiceRequestID
			   join cfg.OrganizationUnit ou on a.OrganizationUnitID = ou.OrganizationUnitID
			   left join cfg.CostCenter cc on ou.CostCenterID = cc.CostCenterID
			   JOIN STF.[vwStuff] stf ON stf.StuffID = q.StuffID
			   JOIN STF.MeasureUnit vb ON vb.MeasureUnitID = stf.MainMeasureUnitID
			   JOIN #Ids ON #Ids.id = a.ServiceRequestID
			   LEFT JOIN (   SELECT ecf.EntityID ,
									ecfd.FieldName ,
									CASE WHEN ecfd.FieldType = 2 THEN
											 CFG.GetCLRSaturnDate(ecf.[Value],''' + @DateFormat + '''  , 0, ''' + @DateType + ''') 
										 ELSE ecf.[Value]
									END AS Value
							 FROM   CFG.EntityCustomeField ecfd
									LEFT JOIN CFG.EntityCustomeFieldData ecf ON ecf.EntityCustomeFieldID = ecfd.EntityCustomeFieldID
							 WHERE  ecfd.EntityName = ''ServiceRequest''
			   ) x
			   PIVOT (   MAX(Value)
						 FOR FieldName IN ( ' + @CustomeFields + ')
			   ) CustomEntities ON CustomEntities.EntityID = q.ServiceRequestID
'   ;

    EXECUTE sp_executesql @Query;
