------------Start of #NoTask
	
CREATE   PROCEDURE [STC].GetNonStuffRequestItemForQuantityOutgoing
(
    @date DATE,
    @ids NVARCHAR(MAX) = NULL,
    @isSpoilage BIT = NULL,
    @isAsset BIT = NULL,
	@StockDocumentTypeBaseEntityID int = NULL,
	@Type TINYINT,
	@fromStockId INT NULL =NULL,	
	@toStockId INT  NULL = NULL,
    @deliverDlId INT = NULL
)
--WITH ENCRYPTION
AS
BEGIN

    DECLARE @SelectColumns NVARCHAR(MAX),
            @UserID INT,
            @DateType TINYINT,
            @DateFormat VARCHAR(10),
            @DynamicColumns NVARCHAR(MAX),
            @CodeAndTitleColumn NVARCHAR(MAX),
            @LeftJoin NVARCHAR(MAX),
            @query NVARCHAR(MAX),
            @Culture NVARCHAR(100),
            @CultureNo TINYINT,
			@DocumentType TINYINT,
			@StockDocumentDltypeID int


	select @DocumentType = sdt.DocumentType,@StockDocumentDltypeID = sdt.DlTypeID
	FROM stc.StockDocumentTypeBaseEntity sdtbe
    JOIN STC.StockDocumentType sdt
        ON sdt.StockDocumentTypeID = sdtbe.StockDocumentTypeID
	WHERE sdtbe.StockDocumentTypeBaseEntityID = @StockDocumentTypeBaseEntityID

    IF (@ids = '')
        SET @ids = NULL;

    SET @UserID = CFG.GetuserID();
    SET @Culture = CFG.GetuserCulture();

    SELECT @CultureNo = CultureNo
    FROM CFG.CultureInfo
    WHERE Culture = @Culture;


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
        
        SELECT * INTO #Stuff 
        FROM stf.VWStuff AS v

		select * into #vwStuffStock_ForPursuiteGroup
		from stf.vwStuffStock_ForPursuiteGroup
		where (StockID = @toStockId or Stockid is null)

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

    DECLARE @IsStuffRequestSurveyable NVARCHAR(100),
            @isConfirmed BIT;

    SELECT @IsStuffRequestSurveyable = isnull(ConfigValue,'false')
    FROM CFG.Configuration
    WHERE ConfigKey = 'IsStuffRequestSurveyable';

         
    SELECT StuffRequestItemID,NonOutgoing,NonSubOutgoing 
	into #StuffRequest_Remains
	FROM REQ.StuffRequest_Remains
    WHERE NonOutgoing>0 
	and ((@IsStuffRequestSurveyable = 'true' and StuffRequestState = 2)
	or @IsStuffRequestSurveyable = 'false' and StuffRequestState  in (1,2))

    SET @query
        = N'
			SELECT  sri.StuffRequestItemID ,
					sr.StuffRequestID ,
					sri.StuffRequestItemIndex RowIndex,
					CFG.GetCLRSaturnDate(sr.StuffRequestDate, @dateFormat, 0, @dateType) DateString ,
					sr.StuffRequestNumber Number ,
					sri.StuffID ,
					s.Code StuffCode ,
					case when @CultureNo = 1 then s.Title else s.Title2 end as StuffTitle ,
                    s.StuffDetailType,
					sri.MainQuantity ,
					sri.SubQuantity ,
					srr.NonOutgoing Non ,
					srr.NonSubOutgoing NonSub,' + @SelectColumns + N',0' + @CodeAndTitleColumn+ N'	
			FROM    REQ.StuffRequestItem sri
			        left  join cfg.CostCenter cc on sri.CostCenterID = cc.CostCenterID
					JOIN REQ.StuffRequest sr ON sr.StuffRequestID = sri.StuffRequestID
					JOIN #Stuff s on sri.StuffID = s.StuffID
					join #vwStuffStock_ForPursuiteGroup vssfpg on s.StuffID = vssfpg.StuffID
					join stf.StuffAccountGroup sag on s.StuffAccountGroupID = sag.StuffAccountGroupID
					JOIN #StuffRequest_Remains srr ON srr.StuffRequestItemID = sri.StuffRequestItemID
					LEFT JOIN (SELECT tr.StuffRequestItemID ,
								   tr.TraceID ,
								   CASE WHEN tr.DlID IS NOT NULL THEN CAST(tr.DlID AS NVARCHAR(MAX)) 
										WHEN tr.TraceItemID IS NOT NULL THEN CAST(tr.TraceItemID AS NVARCHAR(MAX)) 
										ELSE tr.Value
								   END Value
								   FROM REQ.StuffRequestItemTrace tr
							) x
							PIVOT (
								MAX(Value)
								FOR TraceID IN ( ' + @DynamicColumns+ N')
							) AS piv ON piv.StuffRequestItemID = sri.StuffRequestItemID
							' + @LeftJoin + ' ' + @listLeftJoin+ N'
					WHERE   sr.type = @Type
					and (sr.type = 2 or cc.DlID = @deliverDlId or @StockDocumentDltypeID<>27)
							AND sr.StuffRequestDate <= @date
							AND ( 
									@DocumentType is NULL
									or
									(@DocumentType = 2 and sag.StuffdetailType in(0,5,7,8))
									or
									(@DocumentType = 16 and sag.StuffdetailType = 1)
									or
									(@DocumentType = 8 and sag.StuffdetailType = 4)
									or
									(@DocumentType in (3,4,6))
								)
							AND ( @isSpoilage is null or @isSpoilage = 0 or sag.StuffdetailType = 3)
							AND ( @isAsset is null or @isAsset = 0 or ( s.Type = 0 and sag.StuffdetailType <>  3 
							AND s.FixedAssetConversion = 1  ))
							AND (@type = 1 or (sr.FromStockID = @fromStockId and sr.ToStockID = @toStockId) )
							';

    PRINT @query;

    EXEC sp_executesql @query,
                       N'
			@Date DATE ,
			@ids NVARCHAR(MAX) ,
			@isConfirmed BIT,
			@UserID INT,
			@DateFormat nvarchar(20),
			@DateType TINYINT	,
			@isSpoilage BIT	,
			@isAsset BIT	,
			@CultureNo TINYINT,
			@DocumentType TINYINT,
			@Type tinyint,
			@fromStockId INT,
			@toStockId INT ,
			@deliverDlId  int,
			@StockDocumentDltypeID int
		',
                       @date = @date,
                       @ids = @ids,
                       @isConfirmed = @isConfirmed,
                       @UserID = @UserID,
                       @DateFormat = @DateFormat,
                       @DateType = @DateType,
                       @isSpoilage = @isSpoilage,
                       @isAsset = @isAsset,
					   @CultureNo = @CultureNo,
					   @DocumentType = @DocumentType,
					   @Type = @Type,
                       @fromStockId = @fromStockId,
                       @toStockId = @toStockId,
                       @deliverDlId = @deliverDlId,
                       @StockDocumentDltypeID = @StockDocumentDltypeID
END;
