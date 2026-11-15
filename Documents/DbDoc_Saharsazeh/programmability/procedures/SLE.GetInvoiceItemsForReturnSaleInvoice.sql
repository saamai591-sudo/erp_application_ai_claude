
------------------------------------- START #8346
CREATE   PROCEDURE [SLE].GetInvoiceItemsForReturnSaleInvoice
    @Date DATE,
    @FinancialPeriodId INT,
    @Ids NVARCHAR(MAX),
    @DlId INT,
    @SaleTypeId INT,
    @CurrencyId INT,
    @BranchId INT,
    @StuffId INT = NULL,
    @IsConfirmed BIT,
    @Traces NVARCHAR(MAX) = NULL,
    @SaleAreaId INT = NULL
--WITH ENCRYPTION
AS
BEGIN
    DECLARE @WhereClause NVARCHAR(MAX),
            @Culture NVARCHAR(100),
            @CultureNo TINYINT;

    SET @Culture = CFG.GetuserCulture();

    SELECT @CultureNo = CultureNo
    FROM CFG.CultureInfo
    WHERE Culture = @Culture;

    SELECT CFG.GetStringPart(VALUE, 1) AS TraceId,
           CFG.GetStringPart(VALUE, 2) AS Value
    INTO #traceTempTable
    FROM CFG.R_FnStr2TableBySplitor(@Traces, '#') rfstbs;

    SELECT @WhereClause
        = STUFF(
    (
        SELECT DISTINCT
               ' AND piv.' + QUOTENAME(CAST(TraceId AS NVARCHAR(5))) + '= N'
               + QUOTENAME(CAST(Value AS NVARCHAR(500)), '''')
        FROM #traceTempTable
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'),
    1   ,
    1   ,
    ''
               );

    IF (@WhereClause IS NULL)
        SET @WhereClause = N'';
    DECLARE @SelectColumns NVARCHAR(MAX),
            @UserID INT,
            @DateType TINYINT,
            @DateFormat VARCHAR(10),
            @DynamicColumns NVARCHAR(MAX),
            @CodeAndTitleColumn NVARCHAR(MAX),
            @LeftJoin NVARCHAR(MAX),
            @query NVARCHAR(MAX);

    IF (@Ids = '')
        SET @Ids = NULL;

    SET @UserID = CFG.GetuserID();

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
        
    SELECT irr.InvoiceItemID,irr.Non,irr.NonSub into #Invoice_Return_Remains
         FROM sle.Invoice_Return_Remains AS irr
         
    SELECT v.StuffID ,v.code,v.Title,v.Title2,v.[Type] into #vwStuff
      FROM stf.VWStuff AS v    
       
    SET @query
        = N'
		SELECT  ii.InvoiceItemID,
        i.InvoiceID ,
		ii.RowIndex,
        i.Number ,
        CFG.GetCLRSaturnDate(i.[Date], @dateFormat, 0, @dateType) DateString ,
        ii.StuffID ,
        s.Code StuffCode ,
		case when ' + CAST(@CultureNo AS CHAR(1)) + N' = 1 then s.Title
	         when ' + CAST(@CultureNo AS CHAR(1))
          + N' = 2 then s.Title2
	    end as StuffTitle ,
        s.[Type] StuffType ,
        ii.SaleModelID ,
        ii.MainQuantity ,
        ii.SubQuantity ,
        isnull(ici.RevisionFee,ii.Fee) Fee ,
        isnull(ici.RevisionDiscount,ii.Discount) Discount ,
        ir.Non ,
        ir.NonSub,' + @SelectColumns + N',0' + @CodeAndTitleColumn
          + N'	
		FROM    SLE.InvoiceItem ii
		left join sle.InvoiceCorrectionItem ici on ii.InvoiceItemID = ici.InvoiceItemID
        JOIN SLE.Invoice i ON i.InvoiceID = ii.InvoiceID
        JOIN #Invoice_Return_Remains ir ON ir.InvoiceItemID = ii.InvoiceItemID
        JOIN #vwStuff s ON s.StuffID = ii.StuffID
        JOIN CFG.Party p ON p.PartyID = i.CustomerID
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
          + N' )
							) AS piv ON piv.InvoiceItemID = ii.InvoiceItemID
							' + @LeftJoin + N' ' + @listLeftJoin
          + N'
			WHERE   ir.Non > 0
					AND i.[Date] <= @date
					AND (@SaleAreaId is null or i.SaleAreaID = @SaleAreaId)
					--AND i.FinancialPeriodID = @financialPeriodId
					AND i.[SaleInvoiceStatus] <> 5
					AND i.[SaleTypeId] = @SaleTypeId
					AND i.CurrencyID = @CurrencyId
					AND p.DlID = @dlId
					AND i.BranchID = @BranchId
					AND ( @StuffId IS NULL
						  OR ii.StuffID = @StuffId
						)
					AND ( @IsConfirmed = 0
						  OR i.SaleInvoiceStatus = 2
						)
			' + @WhereClause;

    EXECUTE sp_executesql @query,
                          N'
			@Date				DATE ,
			@FinancialPeriodId	INT ,
			@Ids				NVARCHAR(MAX),
			@DlId				INT ,
			@SaleTypeId			INT ,
			@CurrencyId			INT ,
			@BranchId			INT ,
			@StuffId			INT ,
			@IsConfirmed		BIT,
            @DateType TINYINT ,
            @DateFormat VARCHAR(10) ,
			@SaleAreaId int
'   ,
                          @Date = @Date,
                          @FinancialPeriodId = @FinancialPeriodId,
                          @Ids = @Ids,
                          @DlId = @DlId,
                          @SaleTypeId = @SaleTypeId,
                          @CurrencyId = @CurrencyId,
                          @BranchId = @BranchId,
                          @StuffId = @StuffId,
                          @IsConfirmed = @IsConfirmed,
                          @DateFormat = @DateFormat,
                          @DateType = @DateType,
                          @SaleAreaId = @SaleAreaId;
END;
