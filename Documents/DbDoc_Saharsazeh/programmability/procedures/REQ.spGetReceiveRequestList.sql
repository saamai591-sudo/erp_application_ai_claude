	   
CREATE    PROCEDURE REQ.spGetReceiveRequestList
(
	  @FinancialPeriodID int = null,
	  @PageNumber INT ,
	  @RowspPage INT ,
	  @Sort NVARCHAR(MAX) = NULL ,
	  @Filter NVARCHAR(MAX) = NULL 
)
--WITH ENCRYPTION
AS
	DECLARE @UserID int,	       
			@Culture varchar(25),
			@DateType tinyint,
			@DateFormat varchar(10),
			@CultureNo tinyint;

	SET @UserID = cfg.GetuserID()
	SET @Culture = cfg.GetuserCulture()

	select @CultureNo = CultureNo
	from CFG.CultureInfo 
	where Culture = @Culture

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


	DECLARE @ViewRelatedToUser int,
			@ViewRelatedToOthers NVARCHAR(MAX),
			@UnauthorizedUsers NVARCHAR(MAX);

	SELECT @ViewRelatedToUser = UserID
	FROM   cfg.vwOperationLevelAccess
	WHERE  EntityName = 'ReceiveRequest'
			AND AccessKey = 'ViewRelatedToUser'
			AND UserID = @UserID
	
	SELECT @ViewRelatedToOthers = UserID ,
		   @UnauthorizedUsers = Users
	FROM   cfg.vwOperationLevelAccess
	WHERE  EntityName = 'ReceiveRequest'
			AND AccessKey = 'ViewRelatedToOthers'
			AND UserID = @UserID

	IF @Sort IS NULL
	OR @Sort = ''
	SET @Sort = 'Number desc ';
	
	declare @Submited nvarchar(25),
			@Confirmed nvarchar(25),
			@Rejected nvarchar(25),
			@Ended nvarchar(25);

	SELECT @Submited = LV.Value
	FROM   CFG.LocalizeEnum L
		   JOIN CFG.LocalizeEnumValue LV
				ON  L.LocalizeEnumID = LV.LocalizeEnumID
	WHERE  L.Enum = 'RequestStates'
		   AND L.Item = 'Submited'
		   AND LV.Culture = @Culture;

	SELECT @Confirmed = LV.Value
	FROM   CFG.LocalizeEnum L
		   JOIN CFG.LocalizeEnumValue LV
				ON  L.LocalizeEnumID = LV.LocalizeEnumID
	WHERE  L.Enum = 'RequestStates'
		   AND L.Item = 'Confirmed'
		   AND LV.Culture = @Culture;

	SELECT @Rejected = LV.Value
	FROM   CFG.LocalizeEnum L
		   JOIN CFG.LocalizeEnumValue LV
				ON  L.LocalizeEnumID = LV.LocalizeEnumID
	WHERE  L.Enum = 'RequestStates'
		   AND L.Item = 'Rejected'
		   AND LV.Culture = @Culture;

	SELECT @Ended = LV.Value
	FROM   CFG.LocalizeEnum L
		   JOIN CFG.LocalizeEnumValue LV
				ON  L.LocalizeEnumID = LV.LocalizeEnumID
	WHERE  L.Enum = 'RequestStates'
		   AND L.Item = 'Ended'
		   AND LV.Culture = @Culture;
		   
   DECLARE  @Normal NVARCHAR(100),
			@Guaranteed  NVARCHAR(100)

	SELECT @Normal = LV.Value
	FROM   CFG.LocalizeEnum L
		   JOIN CFG.LocalizeEnumValue LV
				ON  L.LocalizeEnumID = LV.LocalizeEnumID
	WHERE  L.Enum = 'PaymentRequestTypes'
		   AND L.Item = 'Normal'
		   AND LV.Culture = @Culture;
		   
	SELECT @Guaranteed = LV.Value
	FROM   CFG.LocalizeEnum L
		   JOIN CFG.LocalizeEnumValue LV
				ON  L.LocalizeEnumID = LV.LocalizeEnumID
	WHERE  L.Enum = 'PaymentRequestTypes'
		   AND L.Item = 'Guaranteed'
		   AND LV.Culture = @Culture;

	DECLARE @Query NVARCHAR(MAX);    
	SET @Query = '	   
	WITH Query_Result 
	as	(
	select  p.ReceiveRequestID,
			p.FinancialPeriodID,
			p.BranchID,
			b.Code BranchCode,
			case when @CultureNo = 1 then b.Title else b.Title2 end BranchName,
			p.Number,
			p.Date,
			p.Type,
			CASE p.Type
				WHEN 1 THEN @Normal
				WHEN 1 THEN @Guaranteed
			END AS TypeString,
			p.PartyID,
			d.Code PartyCode,
			case when @CultureNo = 1 then d.Title else d.Title2 end PartyName,
			case when @CultureNo = 1 then p.Description else p.Description2 end Description,
			p.Status,
			case when @CultureNo = 1 then o.Title else o.Title2 end DemandantUnit,
			p.OrganizationUnitID,					
			p.Version,
			p.Creator,
			p.CreationDate,
			p.LastEditor,
			p.LastEditionDate,
			CFG.GetCLRSaturnDate(p.[Date], @DateFormat, 0, @DateType) Date_Date,
			CFG.GetCLRSaturnDate(p.CreationDate, @DateFormat, 1, @DateType) CreateDateString,
			CFG.GetCLRSaturnDate(p.LastEditionDate, @DateFormat, 1, @DateType) EditionDateString,
			case when @CultureNo = 1 then u.[Name] else u.[Name2] end CreatorUserName,
			case when @CultureNo = 1 then u2.[Name] else u.[Name2] end EditorName,
			case p.status when 1 then  @Submited
						  when 2 then  @Confirmed
						  when 3 then  @Rejected
						  when 4 then  @Ended
				end StatusString,
			p.Amount,
			case when @CultureNo = 1 then currency.Title else currency.Title2 end CurrencyName,
			u3.Name ReviewerName,
			p.Reviewer,
			p.ReviewDate,
			CFG.GetCLRSaturnDate(p.ReviewDate, @DateFormat, 1, @DateType) Date_ReviewDate
	from REQ.ReceiveRequest p
		LEFT JOIN CFG.[User] u3 on u3.UserID=p.Reviewer
		join cfg.currency on currency.currencyid = p.currencyid
		join CFG.Branch b on p.BranchID = b.BranchID
		join CFG.Party pa on p.PartyID = pa.PartyID
		left join ACC.DL d on pa.DlID = d.DLID
		join CFG.OrganizationUnit o on p.OrganizationUnitID = o.OrganizationUnitID
		join CFG.[User] u on u.UserID = p.Creator
		join CFG.[User] u2 on u2.UserID = p.LastEditor
		INNER JOIN cfg.vwBranchAccess AS vba ON vba.BranchID =  p.BranchID 
		INNER JOIN cfg.vwOrganizationUnitAccess AS voua ON voua.OrganizationUnitID =  p.OrganizationUnitID 
	where  p.FinancialPeriodID = @FinancialPeriodID
		AND (@UserID = -1
			OR (@ViewRelatedToUser IS NOT NULL AND p.Creator = @UserID)
			OR (@ViewRelatedToOthers IS NOT NULL AND p.Creator NOT IN (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsers) AS rfcst) )
		)
	)'

	PRINT @Query;
	DECLARE @selectQuery NVARCHAR(MAX);
	
	IF @Filter IS NULL
		OR @Filter = ''
		SET @Filter = '';
	ELSE
		SET @Filter = 'Where (' + @Filter + ')';
	
	
	DECLARE @tableName VARCHAR(100);
	SET @tableName = CFG.getTempTableName(1);
	
	SET @Query = CFG.ApplyPaging(@tableName, @Query, @PageNumber, @RowspPage,
								 @Filter, @Sort);
	--PRINT @Query
	EXECUTE sp_executesql @Query,
		N'  @dateFormat varchar(10),
			@dateType int,
			@ViewRelatedToOthers NVARCHAR(MAX),
			@UnauthorizedUsers	 NVARCHAR(MAX),
			@Normal NVARCHAR(100),
			@Guaranteed  NVARCHAR(100),
			@FinancialPeriodID int,
			@UserID int,
			@ViewRelatedToUser int,
			@CultureNo TinyInt,
			@Submited nvarchar(25),
			@Confirmed nvarchar(25),
			@Rejected nvarchar(25),
			@Ended nvarchar(25)', 
			@DateType = @DateType, 
			@FinancialPeriodID = @FinancialPeriodID,
			@DateFormat = @DateFormat, 
			@ViewRelatedToUser = @ViewRelatedToUser,
			@UserID = @UserID, 
			@ViewRelatedToOthers = @ViewRelatedToOthers,
			@UnauthorizedUsers = @UnauthorizedUsers,
			@CultureNo = @CultureNo,
			@Submited = @Submited,
			@Confirmed = @Confirmed,
			@Rejected = @Rejected,
			@Ended = @Ended,
			@Normal = @Normal,
			@Guaranteed = @Guaranteed;
			
	DECLARE @Count INT;
	
	EXEC ('select * from ' + @tableName +' ORDER BY _RN');
	
	SET @Query = 'select top 1 @Count=  r_count from ' + @tableName; 
	EXECUTE sp_executesql @Query, N'@count int out', @Count = @Count OUT;
	
	RETURN ISNULL(@Count, 0);
