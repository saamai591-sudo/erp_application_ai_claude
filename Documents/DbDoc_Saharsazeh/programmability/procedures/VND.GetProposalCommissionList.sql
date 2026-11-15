
-------------------------------------------------
CREATE   PROCEDURE [VND].[GetProposalCommissionList]
(
	@FinancialPeriodID INT,
	@PageNumber INT,
	@RowspPage INT,
	@Sort NVARCHAR(MAX) = NULL,
	@Filter NVARCHAR(MAX) = NULL
)
--WITH ENCRYPTION
AS
BEGIN
	DECLARE @UserID INT,
			@DateType TINYINT,
			@DateFormat VARCHAR(10),
			@ViewRelatedToUser INT,
			@ViewRelatedToOthers INT,
			@UnauthorizedUsers NVARCHAR(MAX),
			@CultureInfo VARCHAR(10),
			@CultureNo VARCHAR(10),
			@Submit NVARCHAR(10),
			@Confirmed NVARCHAR(10),
			@Ended NVARCHAR(10)

	SET @UserID = CFG.GetuserID();

	SET @CultureInfo = CFG.GetuserCulture();

	SELECT @CultureNo = CultureNo
	FROM CFG.CultureInfo
	WHERE Culture = @CultureInfo;

	SELECT @Submit = LV.Value
	FROM cfg.LocalizeEnum L
	JOIN cfg.LocalizeEnumValue LV
		ON L.LocalizeEnumID = LV.LocalizeEnumID
	WHERE L.Enum = 'VendorStatus'
		  AND L.Item = 'Submit'
		  AND LV.Culture = @CultureInfo

	SELECT @Confirmed = LV.Value
	FROM cfg.LocalizeEnum L
	JOIN cfg.LocalizeEnumValue LV
		ON L.LocalizeEnumID = LV.LocalizeEnumID
	WHERE L.Enum = 'VendorStatus'
		  AND L.Item = 'Confirmed'
		  AND LV.Culture = @CultureInfo

	SELECT @Ended = LV.Value
	FROM cfg.LocalizeEnum L
	JOIN cfg.LocalizeEnumValue LV
		ON L.LocalizeEnumID = LV.LocalizeEnumID
	WHERE L.Enum = 'VendorStatus'
		  AND L.Item = 'Ended'
		  AND LV.Culture = @CultureInfo	

		SELECT @DateType = us.SettingValue
		FROM CFG.UserSetting us
		WHERE us.SettingKey = 'Date_Type'
				AND us.UserID = @UserID;

	IF @DateType IS NULL
		SET @DateType = CASE @CultureInfo
							WHEN 'en' THEN
								1
							WHEN 'ar' THEN
								2
							ELSE
								0
						END;

	SELECT @DateFormat = us.SettingValue
	FROM CFG.UserSetting us
	WHERE us.SettingKey = 'Date_Format'
		  AND us.UserID = @UserID;

	IF @DateFormat IS NULL
		SET @DateFormat = 'YY/MM/DD';

	IF @Sort IS NULL
	   OR @Sort = ''
		SET @Sort = 'Number ';

	SELECT @ViewRelatedToUser = UserID
	FROM CFG.vwOperationLevelAccess
	WHERE EntityName = 'ProposalCommission'
		  AND AccessKey = 'ViewRelatedToUser'
		  AND UserID = @UserID;

	SELECT @ViewRelatedToOthers = UserID,
		   @UnauthorizedUsers = Users
	FROM CFG.vwOperationLevelAccess
	WHERE EntityName = 'ProposalCommission'
		  AND AccessKey = 'ViewRelatedToOthers'
		  AND UserID = @UserID;
	
	DECLARE @Query NVARCHAR(MAX);
	
	SET @Query
		= N' 
		WITH Query_Result 
		(
			  ProposalCommissionID   ,
			  FinancialPeriodID   ,
			  Number   ,
			  [Date],
			  PurchaseRequestID ,
			  BranchID,
			  BranchTitle,
			  PurchasePlanningID,
			  PurchasePlanningDate,
			  Date_PurchasePlanningDate,
			  PurchasePlanningNumber,
			  PurchaseSubject,
			  [Description],
			  Creator   ,
			  CreationDate ,
			  LastEditor   ,
			  LastEditionDate,
			  [Version]   ,
			  CreateDateString ,
			  EditionDateString ,
			  CreatorUserName ,
			  EditorName ,
			  PurchaseRequestNumber   ,
			  PurchaseRequester,
			  Date_Date,
			  PurchaseRequestDate,
			  Date_PurchaseRequestDate,
			  Status,
			  StatusString
		)
		as
		(
			SELECT  pc.ProposalCommissionID ,
						pc.FinancialPeriodID ,
						pc.Number ,
						pc.Date ,
						pc.PurchaseRequestID ,
						pc.BranchID,
						CASE @CultureNo
								WHEN 2 THEN b.Title2
								ELSE b.Title
						END BranchTitle,
						pc.PurchasePlanningID,
						pp.Date PurchasePlanningDate,
						CFG.GetCLRSaturnDate(pp.Date, @DateFormat, 0, @DateType) Date_PurchasePlanningDate,
						pp.Number PurchasePlanningNumber,
						CASE @CultureNo
								WHEN 2 THEN pp.PurchaseSubject2
								ELSE pp.PurchaseSubject
						END PurchaseSubject,
						CASE @CultureNo
								WHEN 2 THEN pc.[Description2]
								ELSE pc.[Description]
						END [Description],
						pc.Creator ,
						pc.CreationDate ,
						pc.LastEditor ,
						pc.LastEditionDate ,
						pc.Version ,
						CFG.GetCLRSaturnDate(pc.CreationDate, @DateFormat, 1, @DateType) AS CreateDateString ,
						CFG.GetCLRSaturnDate(pc.LastEditionDate, @DateFormat, 1, @DateType) AS EditionDateString ,
						u.Name AS CreatorUserName ,
						u2.Name AS EditorName ,
						pr.PurchaseRequestNumber ,
						CASE @CultureNo
								WHEN 2 THEN ou.Title2
								ELSE ou.Title
						END PurchaseRequester,
						CFG.GetCLRSaturnDate(pc.Date, @DateFormat, 0, @DateType) Date_Date ,
						pr.PurchaseRequestDate,
						CFG.GetCLRSaturnDate(pr.PurchaseRequestDate, @DateFormat, 0, @DateType) Date_PurchaseRequestDate,
						pc.Status,
						CASE pc.Status
							WHEN 1 THEN @Submit
							WHEN 2 THEN @Confirmed
							WHEN 3 THEN @Ended
						END AS StatusString
				FROM    VND.ProposalCommission pc
						JOIN CFG.Branch b ON pc.BranchID = b.BranchID
						LEFT JOIN VND.PurchasePlanning pp ON pc.PurchaseplanningID = pp.PurchasePlanningID
						LEFT JOIN REQ.PurchaseRequest pr ON pr.PurchaseRequestID = pc.PurchaseRequestID
						INNER JOIN CFG.[User] AS u ON u.UserID = pc.Creator
						INNER JOIN CFG.[User] AS u2 ON u2.UserID = pc.LastEditor
						LEFT JOIN CFG.OrganizationUnit ou ON ou.OrganizationUnitID = pr.OrganizationUnitID
				WHERE   pc.FinancialPeriodID = @FinancialPeriodID AND 
						(	@UserID = -1
							OR (@ViewRelatedToUser IS NOT NULL AND pc.Creator = @UserID)
							OR (@ViewRelatedToOthers IS NOT NULL AND pc.Creator NOT IN (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsers) AS rfcst) )
						)
		)
	';

	PRINT @Query;
	DECLARE @selectQuery NVARCHAR(MAX);

	IF @Filter IS NULL
	   OR @Filter = ''
		SET @Filter = '';
	ELSE
		SET @Filter = 'Where (' + @Filter + ')';

	DECLARE @tableName VARCHAR(100);
	SET @tableName = CFG.getTempTableName(1);

	SET @Query = CFG.ApplyPaging(@tableName, @Query, @PageNumber, @RowspPage, @Filter, @Sort);
	--PRINT @Query

	EXECUTE sys.sp_executesql @Query,
		N'  @UserID                 INT,
			@DateType               TINYINT,
			@DateFormat             VARCHAR(10),
			@CultureNo              VARCHAR(10),
			@ViewRelatedToUser      INT,
			@ViewRelatedToOthers    INT,
			@UnauthorizedUsers      NVARCHAR(MAX) ,
			@FinancialPeriodID      INT,
			@Submit					NVARCHAR(10),
			@Confirmed				NVARCHAR(10),
			@Ended					NVARCHAR(10)',
							  @UserID =@UserID ,
							  @DateFormat = @DateFormat,
							  @CultureNo = @CultureNo,
							  @DateType = @DateType,
							  @FinancialPeriodID = @FinancialPeriodID,
							  @ViewRelatedToUser  =@ViewRelatedToUser  ,
							  @ViewRelatedToOthers=@ViewRelatedToOthers,
							  @UnauthorizedUsers  =@UnauthorizedUsers,
							  @Submit = @Submit,
							  @Confirmed = @Confirmed,
							  @Ended = @Ended;

	DECLARE @Count INT;

	EXEC ('SELECT * FROM ' + @tableName + ' ORDER BY _RN');

	SET @Query = N'select top 1 @Count=  r_count from ' + @tableName;
	EXECUTE sys.sp_executesql @Query, N'@count int out', @Count = @Count OUT;

	RETURN ISNULL(@Count, 0);
END;
