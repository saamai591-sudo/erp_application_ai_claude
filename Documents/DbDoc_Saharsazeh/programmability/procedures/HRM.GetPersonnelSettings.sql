CREATE   PROCEDURE [HRM].[GetPersonnelSettings]
(
	@PageNumber            INT,
	@RowspPage             INT,
	@Sort                  NVARCHAR(MAX) = NULL,
	@Filter                NVARCHAR(MAX) = NULL
)
AS
BEGIN
DECLARE @UserID INT ,
				@CultureNo tinyint,
				@DateType TINYINT ,
				@DateFormat VARCHAR(10),
				@NeedConfirm BIT;

		SET @UserID = CFG.GetuserID();

		SELECT @DateType = us.SettingValue
		FROM   CFG.UserSetting us
		WHERE  us.SettingKey = 'Date_Type'
			   AND us.UserID = @UserID;
		IF @DateType IS NULL
			SET @DateType = CASE CFG.GetuserCulture()
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

					select @CultureNo = CultureNo
		from CFG.CultureInfo 
		where Culture = CFG.GetuserCulture();

	  SELECT @DateFormat = us.SettingValue
		FROM   CFG.UserSetting us
		WHERE  us.SettingKey = 'Date_Format'
			   AND us.UserID = @UserID;

		IF @DateFormat IS NULL
			SET @DateFormat = 'YY/MM/DD';

			  SELECT @NeedConfirm = CASE 
							 WHEN c.ConfigValue = 'true' THEN 1 
							 ELSE 0 
						  END
	FROM cfg.Configuration c
	WHERE c.ConfigKey = 'AgreementNeedConfirm';

DECLARE @Query NVARCHAR(MAX);
	SET @Query
		= N'
		WITH Query_Result 
		as
		(     
		SELECT 
				p.PersonelID,
				p.Code,
				CASE WHEN @CultureNo = 2 THEN pa.Title2 + '' '' + pa.LastName2 ELSE pa.Title + '' '' + pa.LastName END AS Title,
				CASE WHEN @CultureNo = 2 THEN cc.Title2 ELSE cc.Title END AS LastCostCenterTitle,
				la.EmploymentDate AS LastEmploymentDate,		
				CFG.GetCLRSaturnDate(la.EmploymentDate, @DateFormat, 0, @DateType) AS Date_LastEmploymentDate,
				CASE WHEN @CultureNo = 2 THEN et.Title2 ELSE et.Title END AS LastEmploymentTypeTitle,
				CASE WHEN @CultureNo = 2 THEN pos.Title2 ELSE pos.Title END AS LastPositionTitle,
				CASE WHEN @CultureNo = 2 THEN f.Title2 ELSE f.Title END AS LastFlowchartTitle,
				CASE WHEN @CultureNo = 2 THEN wp.Title2 ELSE wp.Title END AS LastWorkPlaceTitle,
				CASE WHEN @CultureNo = 2 THEN j.Title2 ELSE j.Title END AS LastJobTitle,
				p.Creator,
				CASE WHEN @CultureNo = 2 THEN cu.Name2 ELSE cu.Name END AS CreatorUserName,
				p.CreationDate,
				CFG.GetCLRSaturnDate(p.CreationDate, @DateFormat, 1, @DateType) AS CreateDateString ,
				CASE WHEN @CultureNo = 2 THEN eu.Name2 ELSE eu.Name END AS EditorName,
		
				CFG.GetCLRSaturnDate(p.LastEditionDate, @DateFormat, 1, @DateType) AS EditionDateString ,
				p.Version
				FROM hrm.Personel p 
						LEFT JOIN (
								SELECT a.PersonelID,
										a.AgreementID,
										a.EmploymentDate,
										a.CostCenterID,
										a.EmploymentTypeID,
										a.PositionID,
										a.WorkPlaceID,
										a.JobID,
										ROW_NUMBER() OVER (
												PARTITION BY a.PersonelID 
												ORDER BY 
												CASE WHEN @NeedConfirm = 1 THEN a.ConfirmDate ELSE a.IssueDate END DESC
										) AS rn
								FROM HRM.Agreement a
								WHERE (@NeedConfirm = 0 AND a.IssueDate <= GETDATE())
										OR (@NeedConfirm = 1 AND a.ConfirmDate <= GETDATE())
						)la on p.PersonelID = la.PersonelID and la.rn =1
						JOIN CFG.[User] cu ON p.Creator = cu.UserID
						JOIN CFG.[User] eu ON p.LastEditor = eu.UserID
						JOIN CFG.Party pa ON p.PartyID = pa.PartyID						
						LEFT JOIN CFG.CostCenter cc ON la.CostCenterID = cc.CostCenterID
						LEFT JOIN HRM.EmploymentType et ON la.EmploymentTypeID = et.EmploymentTypeID
						LEFT JOIN HRM.Position pos ON la.PositionID = pos.PositionID
						LEFT JOIN HRM.FlowChart f
								on f.FlowChartID = pos.FlowChartID
						LEFT JOIN HRM.WorkPlace wp ON la.WorkPlaceID = wp.WorkPlaceID
						LEFT JOIN HRM.Job j ON la.JobID = j.JobID
		)'
		
		DECLARE @selectQuery NVARCHAR(MAX);

	IF @Sort IS NULL
	   OR @Sort = ''
		SET @Sort = 'Code desc ';
	
	IF @Filter IS NULL
	   OR @Filter = ''
		SET @Filter = '';
	ELSE
		SET @Filter = 'Where (' + @Filter + ')';

	DECLARE @tableName VARCHAR(100);
	SET @tableName = CFG.getTempTableName(1);
	 
	SET @Query = CFG.ApplyPaging(@tableName, @Query, @PageNumber, @RowspPage, @Filter, @Sort);
   
	PRINT @Query

	EXECUTE sp_executesql @Query,N'
			@UserID				    INT ,
			@CultureNo				INT ,
			@DateType			    TINYINT ,
			@DateFormat			    VARCHAR(10) ,
			@NeedConfirm BIT
	',
			@UserID = @UserID,
			@CultureNo = @CultureNo,
			@DateType = @DateType,
			@DateFormat = @DateFormat,
			@NeedConfirm =@NeedConfirm;

	DECLARE @Count INT;

	EXEC ('SELECT * FROM ' + @tableName + ' ORDER BY _RN');

	SET @Query = 'select top 1 @Count=  r_count from ' + @tableName;
	EXECUTE sp_executesql @Query, N'@count int out', @Count = @Count OUT;

	RETURN ISNULL(@Count, 0);
END;

