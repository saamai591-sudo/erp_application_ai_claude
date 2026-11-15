
------------Start #Notask
CREATE     PROCEDURE [STC].GetNonInvoiceForReturn
(
    @ids NVARCHAR(MAX) = NULL,
    @date DATE,
    @saleTypeId INT,
    @branchId INT,
    @currencyId INT,
    @customerId INT,
    @financialId INT,
    @isConfirmed BIT,
    @stuffId INT = NULL
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

    SET @query
        = N'
			SELECT  ii.InvoiceItemID ,
					i.InvoiceID ,
					ii.RowIndex,
					i.Number ,
					CFG.GetCLRSaturnDate(i.[Date],@dateFormat,0,@dateType) DateString ,
					ii.StuffID ,
					s.Code StuffCode ,
					case when ' + CAST(@CultureNo AS CHAR(1)) + N' = 1 then s.Title
	                     when ' + CAST(@CultureNo AS CHAR(1))
          + N' = 2 then s.Title2
	                end as StuffTitle ,
					ii.MainQuantity ,
					ii.SubQuantity ,
				    
					ii.MainQuantity - ISNULL(irr.MainQuantity, 0) Non ,
				    ii.SubQuantity - ISNULL(irr.SubQuantity, 0) NonSub ,
				    ii.Discount - ISNULL(irr.Discount, 0) NonDiscount ,
				    ii.Price - ISNULL(irr.Price, 0) NonPrice,

					ii.Fee ,
					ii.Price,
					ii.Discount,' + @SelectColumns + N',0' + @CodeAndTitleColumn
          + N'	
			FROM    SLE.InvoiceItem ii
					JOIN SLE.Invoice i ON i.InvoiceID = ii.InvoiceID
					JOIN STF.[Stuff] s ON s.StuffID = ii.StuffID
					LEFT JOIN (   SELECT   rsji.InvoiceItemID ,
                              SUM(rsji.MainQuantity) MainQuantity ,
                              SUM(ISNULL(rsji.SubQuantity, 0)) SubQuantity ,
                              SUM(rsji.Discount) Discount ,
                              SUM(rsji.Price) Price
                     FROM     SLE.ReturnedSaleJustificationItem AS rsji
                     GROUP BY rsji.InvoiceItemID ) irr ON irr.InvoiceItemID = ii.InvoiceItemID
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
								FOR TraceID IN (' + @DynamicColumns
          + N' )
							)AS piv ON piv.InvoiceItemID = ii.InvoiceItemID
							' + @LeftJoin + N' ' + @listLeftJoin
          + N'
					WHERE	(ii.MainQuantity - ISNULL(irr.MainQuantity, 0)) > 0
							AND i.[Date] <= @date
							AND i.[SaleTypeId] = @saleTypeId
							AND i.BranchID = @branchId
							AND i.CurrencyID = @currencyId
							AND i.CustomerID = @customerId
							AND i.FinancialPeriodID = @financialId
							AND i.[SaleInvoiceStatus] <> 5
							AND ( @isConfirmed = 0
								OR i.[SaleInvoiceStatus] = 2
							)
							--AND ( @ids IS NULL
							--	  OR  ii.InvoiceItemID NOT IN (
							--	  SELECT    value
							--	  FROM      CFG.R_FnCommaStr2Table(@ids) )
							--	)
							AND ( @stuffId IS NULL
								  OR  ii.StuffID = @stuffId
								)
			';

    PRINT @query;

    EXEC sp_executesql @query,
                       N'
				@date DATE ,	
				@saleTypeId INT  ,
				@branchId INT  ,
				@currencyId INT ,
				@customerId INT ,
				@financialId INT,
				@isConfirmed BIT,
				@ids NVARCHAR(MAX),
				@dateFormat nvarchar(20),
				@dateType TINYINT,
				@stuffId int	
		',
                       @date = @date,
                       @saleTypeId = @saleTypeId,
                       @branchId = @branchId,
                       @currencyId = @currencyId,
                       @customerId = @customerId,
                       @financialId = @financialId,
                       @isConfirmed = @isConfirmed,
                       @stuffId = @stuffId,
                       @ids = @ids,
                       @DateFormat = @DateFormat,
                       @DateType = @DateType;

END;
