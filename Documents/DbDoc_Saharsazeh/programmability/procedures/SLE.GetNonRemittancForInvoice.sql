------------------------------------- START #8744
CREATE   PROCEDURE [SLE].GetNonRemittancForInvoice
(
    @Date DATE,
    @ids NVARCHAR(MAX),
    @dlId INT,
    @saleTypeId INT,
    @branchId INT,
    @saleAreaId INT = NULL,
    @remittanceId INT = NULL

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
            @basePrecisionCount SMALLINT,
            @CultureNo TINYINT;


    SELECT @basePrecisionCount = c.PrecisionCount
    FROM CFG.Currency AS c
    WHERE c.CurrencyID = -1;

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
        
        
        SELECT * into #SaleContract_Non_Invoice
        FROM sle.SaleContract_Non_Invoice AS scni
        WHERE scni.DlID = @dlId and scni.[Date]<=@Date
        and scni.NonPrice >0


    SET @query
        = N'
 SELECT		ri.RemittanceItemID ,
			ri.RowIndex,
			r.RemittanceID ,
			r.Number ,
			r.StockID ,
			CFG.GetCLRSaturnDate(r.[Date],@DateFormat, 0, @DateType) DateString,
			s.Code StuffCode ,
			case when ' + CAST(@CultureNo AS CHAR(1)) + N' = 1 then s.Title
	             when ' + CAST(@CultureNo AS CHAR(1))
          + N' = 2 then s.Title2
	        end as StuffTitle ,
			ri.StuffID ,
            s.Barcode,
            s.IranCode,
            case when ' + CAST(@CultureNo AS CHAR(1)) + N' = 1 then s.MainMeasureUnit
	             when ' + CAST(@CultureNo AS CHAR(1))
          + N' = 2 then s.MainMeasureUnit2
	        end as MainUnit ,
			ri.MainQuantity ,
			ri.SubQuantity ,
			rr.Non ,
			rr.NonSub,
			CASE WHEN ri.QuotationItemID IS NOT NULL THEN
                CASE WHEN rr.Non = qni.Non THEN qni.NonPrice
                     ELSE
                         ROUND((qni.Price / qni.MainQuantity ) * rr.Non , @basePrecisionCount)
                END
            WHEN ri.JustificationItemID IS NOT NULL THEN
				CASE WHEN rr.Non = jni.Non THEN jni.NonPrice
						ELSE
							ROUND((jni.Price / jni.MainQuantity ) * rr.Non , @basePrecisionCount)
							End
							
			 WHEN ri.SaleContractItemID IS NOT NULL THEN
				CASE WHEN rr.Non = scr.Non THEN scr.NonPrice
						ELSE
							ROUND((scr.Price / scr.MainQuantity ) * rr.Non , @basePrecisionCount)				
				END
				ELSE 0
				
				End
			NonPrice,
			
			CASE 
				WHEN ri.QuotationItemID IS NOT NULL THEN qi.SaleModelId
				WHEN ri.JustificationItemID IS NOT NULL THEN ji.SaleModelId
				ELSE NULL 
			END AS SaleModelID,
			CASE WHEN ri.QuotationItemID IS NOT NULL THEN
                CASE WHEN rr.Non = qni.Non THEN qni.NonDiscount
                     ELSE
                         ROUND((qni.Discount / qni.MainQuantity ) * rr.Non , @basePrecisionCount)
                END
            WHEN ri.JustificationItemID IS NOT NULL THEN
                CASE WHEN rr.Non = jni.Non THEN jni.NonDiscount
                     ELSE
                         ROUND((jni.Discount / jni.MainQuantity ) * rr.Non , @basePrecisionCount)
                END
             WHEN ri.SaleContractItemID IS NOT NULL THEN
                CASE WHEN rr.Non = scr.Non THEN scr.NonDiscount
                     ELSE
                         ROUND((scr.Discount / scr.MainQuantity ) * rr.Non , @basePrecisionCount)
                END    
            ELSE 0
			END
			NonDiscount,
			CASE WHEN ri.QuotationItemID IS NOT NULL THEN qni.Price
				 WHEN ri.JustificationItemID IS NOT NULL THEN jni.Price
				 ELSE 0
            END BasePrice,
			CASE WHEN ri.QuotationItemID IS NOT NULL THEN qni.Discount
				 WHEN ri.JustificationItemID IS NOT NULL THEN jni.Discount
				 ELSE 0
            END BaseDiscount,
			CASE WHEN ri.QuotationItemID IS NOT NULL THEN qni.MainQuantity
				 WHEN ri.JustificationItemID IS NOT NULL THEN jni.MainQuantity
				 ELSE 0
            END BaseMainQuantity,
			' + @SelectColumns + N',0' + @CodeAndTitleColumn
          + N'	
 FROM   SLE.RemittanceItem ri
        JOIN SLE.Remittance r ON r.RemittanceID = ri.RemittanceID
        JOIN STF.[VWStuff] s ON s.StuffID = ri.StuffID
        JOIN SLE.Remittance_Remains rr ON rr.RemittanceItemID = ri.RemittanceItemID
		JOIN CFG.Party p ON p.PartyID = r.CustomerID
		--------------------
		LEFT JOIN SLE.JustificationItem ji ON ji.JustificationItemID = ri.JustificationItemID
		LEFT JOIN [SLE].[Justification_Non_Invoice] AS jni ON jni.JustificationItemID = ri.JustificationItemID
		--------------------
		LEFT JOIN  SLE.QuotationItem qi ON qi.QuotationItemID = ri.QuotationItemID
		LEFT JOIN [SLE].[Quotation_Non_Invoice] qni ON qni.QuotationItemID = ri.QuotationItemID
		left join #SaleContract_Non_Invoice AS scr on ri.SaleContractItemID = scr.SaleContractItemID
		-------------------
		LEFT JOIN (SELECT tr.RemittanceItemID ,
					   tr.TraceID ,
					   CASE WHEN tr.DlID IS NOT NULL THEN CAST(tr.DlID AS NVARCHAR(MAX)) 
							WHEN tr.TraceItemID IS NOT NULL THEN CAST(tr.TraceItemID AS NVARCHAR(MAX)) 
							ELSE tr.Value
					   END Value
					   FROM SLE.RemittanceItemTrace tr
				) x
				PIVOT (
					MAX(Value)
					FOR TraceID IN ( ' + @DynamicColumns
          + N')
				) AS piv ON piv.RemittanceItemID = ri.RemittanceItemID
				' + @LeftJoin + ' '+ @listLeftJoin
          + N'
 WHERE  ri.InvoiceItemID IS NULL
        AND rr.Non > 0
		AND (@saleAreaId is null OR r.SaleAreaID = @saleAreaId)
        AND (@remittanceId is null OR r.RemittanceID = @remittanceId)
        AND r.[Status] = 3
        AND p.DlID = @dlId
		AND r.[Date] <= @Date
        --AND ( @ids IS NULL
        --      OR ri.RemittanceItemID NOT IN (
        --      SELECT    value
        --      FROM      CFG.R_FnCommaStr2Table(@ids) )
        --    )
		AND r.[SaleTypeID] = @saleTypeId
		AND r.[BranchID] = @branchId
 order by r.date Desc
			';

    PRINT @query;

    EXEC sp_executesql @query,
                       N'
			@Date DATE ,
			@ids NVARCHAR(MAX) ,
			@branchId int,
			@saleTypeId int,
			@dlId INT,
			@DateFormat nvarchar(20),
			@DateType TINYINT,
			@basePrecisionCount SMALLINT	,
			@saleAreaId int,
            @remittanceId int
		',
                       @Date = @Date,
                       @ids = @ids,
                       @dlId = @dlId,
                       @branchId = @branchId,
                       @saleTypeId = @saleTypeId,
                       @DateFormat = @DateFormat,
                       @DateType = @DateType,
                       @basePrecisionCount = @basePrecisionCount,
                       @saleAreaId = @saleAreaId,
                       @remittanceId = @remittanceId;

END;
