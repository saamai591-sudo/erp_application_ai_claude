
CREATE      PROCEDURE [STC].GetStuffRequestForPurchaseRequest
(
    @organizationUnitId INT,
    @branchId INT,
    @date DATE,
    @ids NVARCHAR(MAX),
	@type TinyInt
)
--WITH ENCRYPTION
AS
BEGIN

--@type = 1 => درخواست کالا
--@type = 2 => درخواست انتقال
    DECLARE @SelectColumns NVARCHAR(MAX),
            @UserID INT,
            @DateType TINYINT,
            @DateFormat VARCHAR(10),
            @DynamicColumns NVARCHAR(MAX),
            @CodeAndTitleColumn NVARCHAR(MAX),
            @LeftJoin NVARCHAR(MAX),
            @query NVARCHAR(MAX);

    IF (@ids = '')
        SET @ids = NULL;

    SET @UserID = CFG.GetuserID();

    SELECT @DateType = us.SettingValue
    FROM CFG.UserSetting us
    WHERE us.SettingKey = 'Date_Type'
          AND us.UserID = @UserID;

    IF @DateType IS NULL
        SET @DateType = CASE CFG.GetuserCulture()
                            WHEN 'fa' THEN
                                0
                            WHEN 'en' THEN
                                1
                            WHEN 'ar' THEN
                                2
                        END;

    SELECT @DateFormat = us.SettingValue
    FROM CFG.UserSetting us
    WHERE us.SettingKey = 'Date_Format'
          AND us.UserID = @UserID;

    IF @DateFormat IS NULL
        SET @DateFormat = 'YY/MM/DD';

    SELECT @DynamicColumns = STUFF(
    (
        SELECT DISTINCT
               ',' + QUOTENAME(CAST(TraceID AS VARCHAR(5)))
        FROM STF.Trace
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'),
    1   ,
    1   ,
    ''
                                  );

    IF (@DynamicColumns IS NULL)
        SET @DynamicColumns = N'[-1]';

		DECLARE @CultureNo INT

		SELECT @CultureNo = ci.CultureNo FROM CFG.CultureInfo AS ci
		WHERE ci.Culture = CFG.GetuserCulture()

    SELECT @SelectColumns
        = STUFF(
    (
        SELECT DISTINCT
               CASE
                   WHEN AccountLevelTypeID <> 5 THEN
                       ',Piv.' + QUOTENAME(CAST(TraceID AS VARCHAR(5))) + ' AS TR' + CAST(TraceID AS VARCHAR(5))
					   + CASE AccountLevelTypeID
                             WHEN 6 THEN
                                 ',tri' + CAST(TraceID AS VARCHAR(5)) + '.Item' + CASE @CultureNo
                                                                                     WHEN 2 THEN
                                                                                         '2'
                                                                                     ELSE
                                                                                         ''
                                                                                 END + ' AS TRCode'
                                 + CAST(TraceID AS VARCHAR(5))
                             ELSE
                                 ''
                         END
                   ELSE
                       ',Piv.' + QUOTENAME(CAST(TraceID AS VARCHAR(5))) + ' AS TR' + CAST(TraceID AS VARCHAR(5))
                       + ',CFG.GetCLRSaturnDate(Piv.' + QUOTENAME(CAST(TraceID AS VARCHAR(5)))
                       + ', @DateFormat, 0, @DateType) AS TRDate' + CAST(TraceID AS VARCHAR(5))
               END
        FROM STF.Trace
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'),
    1   ,
    1   ,
    ''
               );

    IF (@SelectColumns IS NULL)
        SET @SelectColumns = N'[-1]';

    SELECT @CodeAndTitleColumn
        = STUFF(
    (
        SELECT DISTINCT
               ' ,d' + CAST(TraceID AS VARCHAR(10)) + '.Code [TRCode' + CAST(TraceID AS VARCHAR(10)) + '],d'
               + CAST(TraceID AS VARCHAR(10)) + '.Title [TRTitle' + CAST(TraceID AS VARCHAR(10)) + ']'
        FROM STF.Trace
        WHERE DlTypeID IS NOT NULL
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'),
    1   ,
    1   ,
    ''
               );

    IF @CodeAndTitleColumn IS NULL
        SET @CodeAndTitleColumn = N' ';

    SELECT @LeftJoin
        = STUFF(
    (
        SELECT DISTINCT
               ' Left Join ACC.DL d' + CAST(TraceID AS VARCHAR(10)) + ' on d' + CAST(TraceID AS VARCHAR(10))
               + '.DlID = piv.' + QUOTENAME(TraceID)
        FROM STF.Trace
        WHERE DlTypeID IS NOT NULL
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'),
    1   ,
    1   ,
    ''
               );

    IF @LeftJoin IS NULL
        SET @LeftJoin = N' ';

		
	DECLARE @listLeftJoin NVARCHAR(MAX)

    SELECT @listLeftJoin
        = STUFF(
    (
        SELECT DISTINCT
               ' Left Join STF.TraceItem tri' + CAST(TraceID AS VARCHAR(10)) + ' on tri' + CAST(TraceID AS VARCHAR(10))
               + '.TraceItemID = piv.' + QUOTENAME(TraceID)
        FROM STF.Trace
        WHERE AccountLevelTypeID = 6
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'),
    1   ,
    1   ,
    ''
               );

    IF @listLeftJoin IS NULL
        SET @listLeftJoin = N' ';

    --RequestNeedConfirm

    DECLARE @RequestNeedConfirm NVARCHAR(100),
            @isConfirmed BIT;

    SELECT @RequestNeedConfirm = ConfigValue
    FROM CFG.Configuration
    WHERE ConfigKey = 'IsStuffRequestSurveyable';

    IF (
           @RequestNeedConfirm IS NOT NULL
           AND LOWER(@RequestNeedConfirm) = 'true'
       )
    BEGIN
        SET @isConfirmed = 1;
    END;
    ELSE
    BEGIN
        SET @isConfirmed = 0;
    END;

    SET @query = N'
			SELECT  sri.StuffRequestItemID ,
					sr.StuffRequestID ,
					sr.StuffRequestNumber Number ,
					sri.StuffRequestItemIndex RowIndex,
					sr.StuffRequestDate ,
					CFG.GetCLRSaturnDate(sr.StuffRequestDate, @DateFormat, 0, @DateType) RequestDate ,
					sri.StuffID ,
					s.Code StuffCode ,
					s.Title StuffTitle ,
					case when sr.OrganizationUnitID is not null then ou.Title
						 when sr.FromStockID is not null then st.Title end Requester ,
					srr.Non ,
					srr.NonSub ,
					sri.MainQuantity ,
					sri.SubQuantity
					,' + @SelectColumns + N',0' + @CodeAndTitleColumn + N'	
			FROM    REQ.StuffRequestItem sri
					JOIN REQ.StuffRequest sr ON sr.StuffRequestID = sri.StuffRequestID
					JOIN STF.vwStuff s ON s.StuffID = sri.StuffID
					left JOIN CFG.OrganizationUnit ou ON ou.OrganizationUnitID = sr.OrganizationUnitID
					left JOIN stf.stock st on st.stockid = sr.fromStockid
					JOIN REQ.StuffRequest_Remains srr ON srr.StuffRequestItemID = sri.StuffRequestItemID
					INNER JOIN cfg.vwBranchAccess AS vba ON vba.BranchID=sr.BranchID 
					LEFT JOIN (
							SELECT tr.StuffRequestItemID ,
								   tr.TraceID ,
								   CASE WHEN tr.DlID IS NOT NULL THEN CAST(tr.DlID AS NVARCHAR(MAX))
										WHEN tr.TraceItemID IS NOT NULL THEN CAST(tr.TraceItemID AS NVARCHAR(MAX))
										ELSE tr.Value
								   END Value
							FROM   REQ.StuffRequestItemTrace tr
							) x
							PIVOT (
								MAX(Value)
								FOR TraceID IN ( ' + @DynamicColumns + N')
							) AS piv ON piv.StuffRequestItemID = sri.StuffRequestItemID
					' + @LeftJoin +' ' + @listLeftJoin + N'
					WHERE   srr.Non > 0
							AND sr.BranchID = @branchId
							AND sr.StuffRequestDate <= @date
							AND ( @isConfirmed = 0 OR sr.StuffRequestState = 2)
							AND @type = sr.Type
			';

    PRINT @query;

    EXEC sp_executesql @query,
                       N'
			@organizationUnitId INT ,
			@branchId INT ,
			@date DATE ,
			@ids NVARCHAR(MAX),
			@isConfirmed BIT,
			@UserID INT,
			@DateFormat nvarchar(20),
			@DateType TINYINT,
			@type TinyInt
		',
                       @organizationUnitId = @organizationUnitId,
                       @branchId = @branchId,
                       @date = @date,
                       @ids = @ids,
                       @isConfirmed = @isConfirmed,
                       @UserID = @UserID,
                       @DateFormat = @DateFormat,
                       @DateType = @DateType,
					   @type = @type;
END;
