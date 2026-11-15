
CREATE    PROCEDURE [STC].GetNonInvoiceForQuantityOutgoing
(
    @date DATE,
    @stuffId INT = NULL,
    @ids NVARCHAR(MAX) = NULL,
    @dlId INT,
    @financialId INT,
    @stockId INT,
    @isSaleSpoilage BIT = NULL
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


    --InvoiceNeedConfirm
    DECLARE @InvoiceNeedConfirm NVARCHAR(100),
            @isConfirmed BIT;

    SELECT @InvoiceNeedConfirm = ConfigValue
    FROM CFG.Configuration
    WHERE ConfigKey = 'InvoiceNeedConfirm';

    IF (
           @InvoiceNeedConfirm IS NOT NULL
           AND LOWER(@InvoiceNeedConfirm) = 'true'
       )
    BEGIN
        SET @isConfirmed = 1;
    END;
    ELSE
    BEGIN
        SET @isConfirmed = 0;
    END;

    DECLARE @branchId INT;

    SELECT @branchId = BranchID
    FROM STF.Stock
    WHERE StockID = @stockId;

	select * into #vwBranchAccess
	from cfg.vwBranchAccess

    SET @query
        = N'
			SELECT  ii.InvoiceItemID ,
					i.InvoiceID ,
					i.Number ,
					CFG.GetCLRSaturnDate(i.[Date], @dateFormat, 0, @dateType) DateString ,
					ii.StuffID ,
					s.Code StuffCode ,
					case when ' + CAST(@CultureNo AS CHAR(1)) + N' = 1 then s.Title
	                     when ' + CAST(@CultureNo AS CHAR(1))
          + N' = 2 then s.Title2
	                end as StuffTitle ,
                    s.StuffDetailType,
					s.[Type] StuffType ,
					ii.SaleModelID ,
					ii.MainQuantity ,
					ii.SubQuantity ,
					ir.Non ,
					ir.NonSub ,
					ii.Fee ,
					ii.Discount,' + @SelectColumns + N',0' + @CodeAndTitleColumn
          + N'	
			FROM    SLE.InvoiceItem ii
					JOIN SLE.Invoice i ON i.InvoiceID = ii.InvoiceID
					JOIN SLE.Invoice_Remains ir ON ir.InvoiceItemID = ii.InvoiceItemID					 
					JOIN STF.vwStuff s ON s.StuffID = ii.StuffID
					LEFT JOIN STF.StuffDetail AS sd ON sd.StuffID = s.StuffID
					LEFT JOIN STF.StuffAccountGroup SAG ON SAG.StuffAccountGroupID = sd.StuffAccountGroupID
					JOIN CFG.Party p ON p.PartyID = i.CustomerID
					LEFT JOIN SLE.RemittanceItem ri ON ri.RemittanceItemID = ii.RemittanceItemID
					LEFT JOIN SLE.Remittance r ON r.RemittanceID = ri.RemittanceID
					INNER JOIN  #vwBranchAccess AS vba on i.BranchID=vba.BranchID
					LEFT JOIN (SELECT tr.InvoiceItemID ,
								   tr.TraceID ,
								   CASE WHEN tr.DlID IS NOT NULL THEN CAST(tr.DlID AS NVARCHAR(MAX)) 
										WHEN tr.TraceItemID IS NOT NULL THEN CAST(tr.TraceItemID AS NVARCHAR(MAX)) 
										ELSE tr.Value
								   END Value
								   FROM SLE.InvoiceItemTrace tr
							) x
							PIVOT (
								MAX(Value)
								FOR TraceID IN ( ' + @DynamicColumns
          + N')
							) AS piv ON piv.InvoiceItemID = ii.InvoiceItemID
							' + @LeftJoin + N' ' + @listLeftJoin
          + N'
					WHERE   ii.OutgoingItemId IS NULL
							AND ( @isSaleSpoilage IS NULL  OR  (@isSaleSpoilage = 0 AND SAG.StuffDetailType <> 3 ) OR  (@isSaleSpoilage = 1 AND SAG.StuffDetailType = 3))
							AND i.BaseDocument <> 13
							AND i.BranchID = @branchId
							AND (
								ii.RemittanceItemID IS NULL OR 
									r.StockID = @stockId					
							)
							AND ir.Non > 0
							and s.type = 0
							AND i.SaleInvoiceStatus <> 5
							AND ( @isConfirmed = 0
								  OR i.SaleInvoiceStatus = 2
								)
							AND i.[Date] <= @date
							AND ( @stuffId IS NULL
								  OR ii.StuffID = @stuffId
								)
							AND p.DlID = @dlId
							--AND ( @ids IS NULL
							--	  OR ii.InvoiceItemID NOT IN (
							--	  SELECT    value
							--	  FROM      CFG.R_FnCommaStr2Table(@ids) )
							--	)
							AND i.FinancialPeriodID = @financialId
			';

    PRINT @query;

    EXEC sp_executesql @query,
                       N'
			@Date DATE ,
			@stuffId int,
			@ids NVARCHAR(MAX) ,	
			@dlId INT,	
			@financialId INT,
			@isConfirmed BIT,
			@UserID INT,
			@DateFormat nvarchar(20),
			@DateType TINYINT	,
			@stockId INT	,
			@BranchId int,
			@isSaleSpoilage BIT
		',
                       @date = @date,
                       @stuffId = @stuffId,
                       @ids = @ids,
                       @dlId = @dlId,
                       @financialId = @financialId,
                       @isConfirmed = @isConfirmed,
                       @UserID = @UserID,
                       @DateFormat = @DateFormat,
                       @DateType = @DateType,
                       @stockId = @stockId,
                       @BranchId = @branchId,
                       @isSaleSpoilage = @isSaleSpoilage;

END;
