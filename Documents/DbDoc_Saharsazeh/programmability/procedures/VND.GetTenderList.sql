
CREATE   PROCEDURE VND.GetTenderList
    (
        @PageNumber INT ,
        @RowspPage INT ,
        @Sort NVARCHAR(MAX) = NULL ,
        @Filter NVARCHAR(MAX) = NULL
    )
--WITH ENCRYPTION
AS
    DECLARE @UserID INT ,
            @DateType TINYINT ,
            @DateFormat VARCHAR(10) ,
            @ViewRelatedToUser INT ,
            @ViewRelatedToOthers NVARCHAR(MAX) ,
            @Employer NVARCHAR(MAX) ,
            @Contractor NVARCHAR(MAX) ,
            @Culture VARCHAR(10),
			@CultureNo int,
            @UnauthorizedUsers NVARCHAR(MAX);

    SET @UserID = CFG.GetuserID();
    SET @Culture = CFG.GetuserCulture();


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
        
	SELECT @ViewRelatedToUser = UserID
	FROM CFG.vwOperationLevelAccess
	WHERE EntityName = 'Tender'
		  AND AccessKey = 'ViewRelatedToUser'
		  AND UserID = @UserID;

	SELECT @ViewRelatedToOthers = UserID ,
           @UnauthorizedUsers = Users
	FROM CFG.vwOperationLevelAccess
	WHERE EntityName = 'Tender'
		  AND AccessKey = 'ViewRelatedToOthers'
		  AND UserID = @UserID;

    IF @Sort IS NULL
       OR @Sort = ''
        SET @Sort = 'Number ';

    DECLARE @Query NVARCHAR(MAX);
    SET @Query = '
	WITH Query_Result 
	as
	(
		SELECT  t.TenderID ,
                t.Number ,
                t.Date ,
                t.[TimeOut],
				t.Method,
                t.Title,
				t.Title2,
                t.TenderRequestID ,
				t.TechnicalRating,
				t.Type,
				t.Description,
                t.Creator ,
                t.CreationDate ,
                t.LastEditor ,
                t.LastEditionDate ,
                t.Version ,
                tr.Number TenderRequestNumber,
				tr.[Date] AS TenderRequestDate,
				CFG.GetCLRSaturnDate(tr.[Date], @DateFormat, 0,  @DateType) AS Date_TenderRequestDate,
				case when @CultureNo = 1 then ou.Title else ou.Title2 end AS OrganizationUnitTitle,
                CFG.GetCLRSaturnDate(t.[Date], @DateFormat, 0,  @DateType) AS Date_Date ,
                CFG.GetCLRSaturnDate(t.CreationDate, @DateFormat, 1, @DateType) AS CreateDateString ,
                CFG.GetCLRSaturnDate(t.LastEditionDate, @DateFormat, 1, @DateType) AS EditionDateString ,
                u.Name AS CreatorUserName ,
                u2.Name AS EditorName ,
                CFG.GetSaturnDate(t.[TimeOut], 0) Date_TimeOut,
				CAST( CASE WHEN VND.TenderHasFlow(t.TenderID) = 0 THEN 1 ELSE 0 END  AS BIT) AS IsNotInFlow
        FROM    [VND].Tender t
                JOIN CFG.[User] AS u ON u.UserID = t.Creator
                JOIN CFG.[User] AS u2 ON u2.UserID = t.LastEditor
				LEFT JOIN REQ.TenderRequest tr ON t.TenderRequestID = tr.TenderRequestID
				join cfg.OrganizationUnit ou on ou.OrganizationUnitID = tr.OrganizationUnitID
        WHERE ( @UserID = -1
                OR ( @ViewRelatedToUser IS NOT NULL AND t.Creator = @UserID )
                OR ( @ViewRelatedToOthers IS NOT NULL AND t.Creator NOT IN ( SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsers) AS rfcst) )
            )
		)';

    PRINT @Query;
    DECLARE @selectQuery NVARCHAR(MAX);

    IF @Filter IS NULL
       OR @Filter = ''
        SET @Filter = '';
    ELSE
        SET @Filter = 'Where (' + @Filter + ')';


    DECLARE @tableName VARCHAR(100);
    SET @tableName = CFG.getTempTableName(1);



    SET @Query = CFG.ApplyPaging(
                     @tableName ,
                     @Query ,
                     @PageNumber ,
                     @RowspPage ,
                     @Filter ,
                     @Sort);

    EXECUTE sp_executesql @Query ,
                          N'
							@UserID INT ,
							@DateType TINYINT ,
							@DateFormat VARCHAR(10) ,
							@ViewRelatedToUser INT ,
							@ViewRelatedToOthers NVARCHAR(MAX),
							@CultureNo int,
							@UnauthorizedUsers   NVARCHAR(MAX)
						  ' ,
                          @UserID = @UserID ,
                          @DateType = @DateType ,
                          @DateFormat = @DateFormat ,
                          @ViewRelatedToUser = @ViewRelatedToUser ,
                          @ViewRelatedToOthers = @ViewRelatedToOthers ,
                          @CultureNo = @CultureNo,
                          @UnauthorizedUsers = @UnauthorizedUsers

    DECLARE @Count INT;

    EXEC ( 'SELECT * FROM ' + @tableName + ' ORDER BY _RN' );

    SET @Query = 'select top 1 @Count=  r_count from ' + @tableName;
    EXECUTE sp_executesql @Query ,
                          N'@count int out' ,
                          @Count = @Count OUT;

    RETURN ISNULL(@Count, 0);
