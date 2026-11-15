
---------------------------------------------------------
CREATE    PROCEDURE [SLE].[GetNonSaleContractForRemittance]
(
    @Date DATE,
    @ids NVARCHAR(MAX),
    @dlId INT,
    @saleTypeId INT = NULL,
    @stockId INT = NULL,
    @branchId INT = NULL,
    @isSaleSpoilage BIT = NULL,
    @saleAreaId INT = NULL
)
--WITH ENCRYPTION
AS
BEGIN

    DECLARE @SelectColumns NVARCHAR(MAX),
            @UserID INT,
            @DateType TINYINT,
            @DateFormat VARCHAR(10),
            @Culture VARCHAR(10),
            @DynamicColumns NVARCHAR(MAX),
            @CodeAndTitleColumn NVARCHAR(MAX),
            @LeftJoin NVARCHAR(MAX),
            @query NVARCHAR(MAX),
            @CultureNo TINYINT;

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

    DECLARE @listLeftJoin NVARCHAR(MAX);

    SELECT @listLeftJoin
        = STUFF(
    (
        SELECT DISTINCT
               '  Left Join STF.TraceItem tri' + CAST(TraceID AS VARCHAR(10)) + ' on tri' + CAST(TraceID AS VARCHAR(10))
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

    SET @query
        = N'
					SELECT qi.SaleContractItemID ,
							q.SaleContractID ,
							qi.RowIndex,
							q.Number ,
							CFG.GetCLRSaturnDate(q.[Date], @DateFormat, 0, @DateType) DateString ,
							s.StuffID ,
							s.Code StuffCode ,
							case when ' + CAST(@CultureNo AS CHAR(1))
          + N' = 1 then s.Title
	                             when ' + CAST(@CultureNo AS CHAR(1))
          + N' = 2 then s.Title2
	                        end as StuffTitle ,
                            s.StuffDetailType,
							s.[Type] StuffType ,
							qi.SaleModelID ,
							qi.MainQuantity ,
							qi.SubQuantity ,
							qi.Fee ,
							qi.Discount ,
							qi.Tax ,
							qi.Duty ,
							qr.Non ,
							qr.SubNon As NonSub,' + @SelectColumns + N',0' + @CodeAndTitleColumn
          + N'	
					 FROM   SLE.SaleContractItem qi
							JOIN SLE.SaleContract q ON q.SaleContractID = qi.SaleContractID
							JOIN SLE.SaleContract_Remains qr ON qr.SaleContractItemID = qi.SaleContractItemID
							JOIN CFG.Party p ON p.PartyID = q.CustomerID
							JOIN STF.vwStuff s ON s.StuffID = qi.StuffID
							LEFT JOIN STF.StuffDetail AS sd ON sd.StuffID = s.StuffID
							LEFT JOIN STF.StuffAccountGroup SAG ON SAG.StuffAccountGroupID = sd.StuffAccountGroupID
							LEFT JOIN ( SELECT  tr.SaleContractItemID ,
												tr.TraceID ,
												CASE WHEN tr.DlID IS NOT NULL THEN CAST(tr.DlID AS NVARCHAR(MAX))
													 WHEN tr.TraceItemID IS NOT NULL THEN CAST(tr.TraceItemID AS NVARCHAR(MAX))
													 ELSE tr.Value
												END Value
										FROM    SLE.SaleContractItemTrace tr
									  ) x PIVOT ( MAX(Value) FOR TraceID IN (' + @DynamicColumns
          + N')
									) AS piv ON piv.SaleContractItemID = qi.SaleContractItemID
									' + @LeftJoin + N' ' + @listLeftJoin
          + N'
					 WHERE  qr.Non > 0
							AND ( @isSaleSpoilage IS NULL  OR  (@isSaleSpoilage = 0 AND SAG.StuffDetailType <> 3 ) OR  (@isSaleSpoilage = 1 AND SAG.StuffDetailType = 3))
							AND (@saleAreaId is null or q.SaleAreaId = @saleAreaId)
							AND s.[Type] = 0
							AND q.[Date] <= @Date
							AND p.DlID = @dlId
							AND ( @branchId IS NULL
								  OR q.BranchID = @branchId
								)
							AND ( @saleTypeId IS NULL
								  OR q.[SaleTypeID] = @saleTypeId
								)
							AND ( @stockId IS NULL
								  OR q.BranchID IN ( SELECT s2.BranchID
													 FROM   STF.Stock AS s2
													 WHERE  s2.StockID = @stockId )
								)
			';

    PRINT @query;

    EXEC sp_executesql @query,
                       N'
			@Date DATE ,
			@ids NVARCHAR(MAX) ,
			@saleTypeId int ,
			@stockId int ,
			@branchId int ,
			@dlId INT,
			@DateFormat nvarchar(20),
			@DateType TINYINT,
			@isSaleSpoilage	BIT,
			@saleAreaId INT
		',
                       @Date = @Date,
                       @ids = @ids,
                       @dlId = @dlId,
                       @saleTypeId = @saleTypeId,
                       @stockId = @stockId,
                       @branchId = @branchId,
                       @DateFormat = @DateFormat,
                       @DateType = @DateType,
                       @isSaleSpoilage = @isSaleSpoilage,
                       @saleAreaId = @saleAreaId;

END;
