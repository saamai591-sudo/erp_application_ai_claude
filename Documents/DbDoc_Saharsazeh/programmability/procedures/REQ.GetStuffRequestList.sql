------------------------------------- START #9351
CREATE    PROCEDURE [REQ].GetStuffRequestList
(
    @FinancialPeriodID INT,
	@Type TinyInt,
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
            @Culture VARCHAR(10),
			@CultureNo tinyint,	        
			@ViewRelatedToUser       INT,
	        @ViewRelatedToOthers     NVARCHAR(MAX),
            @UnauthorizedUsers NVARCHAR(MAX);

	SET @UserID = cfg.GetuserID()
	SET @Culture = cfg.GetuserCulture()

	select @CultureNo = CultureNo
	from CFG.CultureInfo 
	where Culture = @Culture
    option (recompile)

	DECLARE @rAccess     INT ,
	        @oAccess     INT ,
			@EngName nvarchar(512),
            @AccessKey nvarchar(512)
	

	if @Type = 1
	set @EngName = 'StuffRequest'
	else 
	set @EngName = 'transferRequest'

    set @AccessKey = @EngName + '_ViewRelatedToOthers'

    SELECT @ViewRelatedToUser = UserID
	FROM CFG.vwOperationLevelAccess
	WHERE EntityName = @EngName
		  AND AccessKey = 'ViewRelatedToUser'
		  AND UserID = @UserID
          option (recompile);

	SELECT @ViewRelatedToOthers = UserID ,
           @UnauthorizedUsers = Users
	FROM CFG.vwOperationLevelAccess
	WHERE EntityName = @EngName
		  AND AccessKey = 'ViewRelatedToOthers'
		  AND UserID = @UserID
          option(recompile);

    SELECT @DateType = us.SettingValue
    FROM CFG.UserSetting us
    WHERE us.SettingKey = 'Date_Type'
          AND us.UserID = @UserID
          option (recompile);

    IF @DateType IS NULL
        SET @DateType = CASE @Culture
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
          AND us.UserID = @UserID
          option (recompile);

    IF @DateFormat IS NULL
        SET @DateFormat = 'YY/MM/DD';

    IF @Sort IS NULL
       OR @Sort = ''
        SET @Sort = 'CreationDate Desc ';

    DECLARE @Submit NVARCHAR(100),
            @Confirmed NVARCHAR(100),
            @Ended NVARCHAR(100),
            @Rejected NVARCHAR(100);

    SELECT @Submit = LV.Value
    FROM CFG.LocalizeEnum L
        JOIN CFG.LocalizeEnumValue LV
            ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE L.Enum = 'RequestStates'
          AND L.Item = 'Submitted'
          AND LV.Culture = @Culture
          option (recompile);


    SELECT @Confirmed = LV.Value
    FROM CFG.LocalizeEnum L
        JOIN CFG.LocalizeEnumValue LV
            ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE L.Enum = 'RequestStates'
          AND L.Item = 'Confirmed'
          AND LV.Culture = @Culture
          option (recompile);

    SELECT @Rejected = LV.Value
    FROM CFG.LocalizeEnum L
        JOIN CFG.LocalizeEnumValue LV
            ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE L.Enum = 'RequestStates'
          AND L.Item = 'Rejected'
          AND LV.Culture = @Culture
          option (recompile);

    SELECT @Ended = LV.Value
    FROM CFG.LocalizeEnum L
        JOIN CFG.LocalizeEnumValue LV
            ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE L.Enum = 'RequestStates'
          AND L.Item = 'Ended'
          AND LV.Culture = @Culture
          option (recompile);

    DECLARE @withoutBase NVARCHAR(200),
            @material NVARCHAR(200),
            @product NVARCHAR(200),
			@StuffRequest NVARCHAR(200);

    --    WithOutBase: 1

    SELECT @withoutBase = LV.Value
    FROM CFG.LocalizeEnum L
        JOIN CFG.LocalizeEnumValue LV
            ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE L.Enum = 'StuffRequestDocumentBase'
          AND L.Item = 'WithOutBase'
          AND LV.Culture = @Culture
          option (recompile);

    SELECT @StuffRequest = LV.Value
    FROM CFG.LocalizeEnum L
        JOIN CFG.LocalizeEnumValue LV
            ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE L.Enum = 'StuffRequestDocumentBase'
          AND L.Item = 'StuffRequest'
          AND LV.Culture = @Culture
          option (recompile);

    --    RequiredMaterial: 2
    SELECT @material = LV.Value
    FROM CFG.LocalizeEnum L
        JOIN CFG.LocalizeEnumValue LV
            ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE L.Enum = 'StuffRequestDocumentBase'
          AND L.Item = 'RequiredMaterial'
          AND LV.Culture = @Culture
          option (recompile);

    --    RequiredProduct: 3,
    SELECT @product = LV.Value
    FROM CFG.LocalizeEnum L
        JOIN CFG.LocalizeEnumValue LV
            ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE L.Enum = 'StuffRequestDocumentBase'
          AND L.Item = 'RequiredProduct'
          AND LV.Culture = @Culture
          option (recompile);


    DECLARE @Query NVARCHAR(MAX);

    SET @Query = N'
    WITH Query_Result 
    as
    (
	    SELECT  sr.StuffRequestID ,
			    sr.BranchID ,
			    sr.StuffRequestNumber ,
			    sr.StuffRequestDate ,
			    sr.StuffRequestState ,
			    sr.OrganizationUnitID ,
			    case when @CultureNo = 1 then ou.Title else ou.Title2 end  StuffRequester ,
			    sr.Creator ,
			    sr.CreationDate ,
			    sr.LastEditor ,
			    sr.LastEditionDate ,
			    sr.[Version] ,
			    sr.FinancialPeriodID ,
			    b.Code BranchCode ,
			    case when @CultureNo = 1 then b.Title else b.Title2 end BranchTitle ,
			    CFG.GetCLRSaturnDate(sr.StuffRequestDate, @DateFormat, 0, @DateType) Date_StuffRequestDate ,
			    CFG.GetCLRSaturnDate(sr.CreationDate, @DateFormat, 1, @DateType) CreateDateString ,
			    CFG.GetCLRSaturnDate(sr.LastEditionDate, @DateFormat, 1, @DateType) EditionDateString ,
			    u.Name CreatorUserName ,
			    u2.Name EditorName,
			    CASE sr.StuffRequestState
				    WHEN 1 THEN @Submit 
				    WHEN 2 THEN @Confirmed
				    WHEN 3 THEN @Rejected
				    WHEN 4 THEN @Ended
			    END AS StateString,					
			    case when sr.StuffRequestState <> 1 then u2.Name else '''' end EditorNameRelatedToState,
			    case when sr.StuffRequestState <> 1 then 
				    CFG.GetCLRSaturnDate(sr.LastEditionDate, @DateFormat, 1, @DateType)
				    else ''''
				    end LastUpdateDateRelatedToState,
			    sr.BaseDocument,
			    CASE sr.BaseDocument
				    WHEN 1 THEN @withoutBase
				    WHEN 2 THEN @material
				    WHEN 3 THEN @product
				    WHEN 4 THEN @StuffRequest
			    END AS BaseDocumentTitle,
			    FromStockID,
			    ToStockID,
			    Type,
			    case when @CultureNo = 1 then s1.Title else s1.Title2 end FromStock ,
			    case when @CultureNo = 1 then s2.Title else s2.Title2 end ToStock,
                sr.UtilizationPlace,
                u3.Name ReviewerName,
                sr.Reviewer,
                sr.ReviewDate,
                CFG.GetCLRSaturnDate(sr.ReviewDate, @DateFormat, 1, @DateType) Date_ReviewDate
	    FROM    REQ.StuffRequest sr
			    INNER JOIN cfg.vwBranchAccess AS vba ON vba.BranchID =  sr.BranchID
			    LEFT JOIN CFG.OrganizationUnit ou ON ou.OrganizationUnitID = sr.OrganizationUnitID
			    JOIN CFG.Branch b ON b.BranchID = sr.BranchID
			    JOIN CFG.[User] u ON u.UserID = sr.Creator
			    JOIN CFG.[User] u2 ON u2.UserID = sr.LastEditor
                LEFT JOIN CFG.[User] u3 on u3.UserID=sr.Reviewer
			    Left JOIN cfg.vwOrganizationUnitAccess AS voua ON voua.OrganizationUnitID = sr.OrganizationUnitID 
			    left join stf.stock s1 on s1.stockid = sr.FromStockID
			    left join stf.stock s2 on s2.stockid = sr.ToStockID
				left JOIN cfg.vwStockAccess AS vsa ON vsa.StockID = sr.FromStockID
				left JOIN cfg.vwStockAccess AS tostock ON tostock.StockID = sr.ToStockID

	    WHERE   Type = @Type 
			    AND sr.FinancialPeriodID = @FinancialPeriodID
			    and 
				(
				(@Type=1 and voua.OrganizationUnitID is not null)
				or (@Type = 2 and (vsa.StockID is not null or tostock.StockID is not null)
				))

	            AND (
	                @UserID = -1
	                OR (@ViewRelatedToUser IS NOT NULL AND sr.Creator = @UserID)
	                OR (@ViewRelatedToOthers IS NOT NULL AND sr.Creator NOT IN (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsers) AS rfcst) 
					))
			
	           
		)
	';

    --PRINT @Query;
    DECLARE @selectQuery NVARCHAR(MAX);

    IF @Filter IS NULL
       OR @Filter = ''
        SET @Filter = '';
    ELSE
        SET @Filter = 'Where (' + @Filter + ')';

    DECLARE @tableName VARCHAR(100);
    SET @tableName = CFG.getTempTableName(1);

    SET @Query = CFG.ApplyPaging(@tableName, @Query, @PageNumber, @RowspPage, @Filter, @Sort);
    PRINT @Query

    EXECUTE sp_executesql @Query,
                          N'
							@FinancialPeriodID INT,
							@userId INT,
							@DateType TINYINT ,
							@DateFormat VARCHAR(10),
							@Submit NVARCHAR(100),
							@Confirmed NVARCHAR(100),
							@Ended NVARCHAR(100),
							@Rejected NVARCHAR(100),
							@withoutBase  NVARCHAR(200),
							@material  NVARCHAR(200),
							@product  NVARCHAR(200),
							@CultureNo tinyint,
							@ViewRelatedToUser int,
							@ViewRelatedToOthers NVARCHAR(MAX),
							@UnauthorizedUsers   NVARCHAR(MAX),
							@Type TinyInt,
							@StuffRequest NVARCHAR(200),
                            @AccessKey NVARCHAR(500)
							',
                          @FinancialPeriodID = @FinancialPeriodID,
                          @DateType = @DateType,
                          @DateFormat = @DateFormat,
                          @userId = @UserID,
                          @Submit = @Submit,
                          @Confirmed = @Confirmed,
                          @Ended = @Ended,
                          @Rejected = @Rejected,
                          @withoutBase = @withoutBase,
                          @material = @material,
                          @product = @product,
						  @CultureNo = @CultureNo,
						  @ViewRelatedToUser = @ViewRelatedToUser,
						  @ViewRelatedToOthers = @ViewRelatedToOthers,
						  @UnauthorizedUsers = @UnauthorizedUsers,
						  @Type = @Type,
						  @StuffRequest = @StuffRequest,
                          @AccessKey = @AccessKey

    DECLARE @Count INT;

    EXEC ('SELECT * FROM ' + @tableName + ' ORDER BY _RN');

    SET @Query = N'select top 1 @Count=  r_count from ' + @tableName;
    EXECUTE sp_executesql @Query, N'@count int out', @Count = @Count OUT;

    RETURN ISNULL(@Count, 0);
END;
