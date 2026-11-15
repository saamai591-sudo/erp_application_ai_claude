----------------------------------------------------------------------------------------------------------------------------


CREATE   PROCEDURE [SLE].[GetQuotationNonReturn]
(
    @date DATE,
    @branchId INT
)
--WITH ENCRYPTION 
AS
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
           ' Left Join ACC.DL d' + CAST(TraceID AS VARCHAR(10)) + ' on d' + CAST(TraceID AS VARCHAR(10)) + '.DlID = piv.'
           + QUOTENAME(TraceID)
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
				SELECT qi.QuotationItemID ,
					   qi.QuotationID ,
					   q.Number,
					   CFG.GetCLRSaturnDate(q.Date, @DateFormat, 0, @DateType) DateString ,
					   qi.RowIndex ,
					   qi.StuffID ,
					   s.Code StuffCode ,
					   case when ' + CAST(@CultureNo AS CHAR(1)) + N' = 1 then s.Title
	                        when ' + CAST(@CultureNo AS CHAR(1))
      + N' = 2 then s.Title2
	                   end as StuffTitle ,
					   qi.MainQuantity ,
					   qi.SubQuantity ,
					   qnr.Non ,
					   qnr.NonSub ,
					   ' + @SelectColumns + N',0' + @CodeAndTitleColumn
      + N'
				FROM   SLE.QuotationItem AS qi 
					   JOIN STF.VWStuff AS s ON s.StuffID = qi.StuffID
					   JOIN SLE.Quotation AS q ON q.QuotationID = qi.QuotationID
					   LEFT JOIN (   SELECT qit.QuotationItemID ,
											qit.TraceID ,
											CASE WHEN qit.DlID IS NOT NULL THEN CAST(qit.DlID AS NVARCHAR(MAX))
												 WHEN qit.TraceItemID IS NOT NULL THEN CAST(qit.TraceItemID AS NVARCHAR(MAX))
												 ELSE qit.[Value]
											END Value
									 FROM   SLE.QuotationItemTrace AS qit ) x
					   PIVOT (   MAX(Value)
								 FOR TraceID IN (' + @DynamicColumns
      + N' )) 
					   AS piv ON piv.QuotationItemID = qi.QuotationItemID
					   ' + @LeftJoin + N' ' + @listLeftJoin
      + N'
					   JOIN [SLE].[Quotation_Non_Request] AS [qnr] ON qnr.QuotationItemID = qi.QuotationItemID
				WHERE  q.Date <= @date
					   AND q.BranchID = @branchId
					   AND 
					   qnr.Non > 0
					   AND q.[Status] <> 2
	';

PRINT @query;

EXEC sp_executesql @query,
                   N'@date DATE ,
							@branchId int,
							@DateFormat nvarchar(20),
							@DateType TINYINT		
						',
                   @date = @date,
                   @branchId = @branchId,
                   @DateFormat = @DateFormat,
                   @DateType = @DateType;
