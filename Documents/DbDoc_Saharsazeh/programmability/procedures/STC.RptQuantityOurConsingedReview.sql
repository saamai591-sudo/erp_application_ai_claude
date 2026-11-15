------------------------------------------------------------------------------------------------------------------
CREATE   PROC [STC].[RptQuantityOurConsingedReview]
(
    @FinicialPeriodID INT,
    @FromDate DATETIME = NULL,
    @ToDate DATETIME = NULL,
    @SelectedStuff NVARCHAR(MAX) = NULL,
    @SelectedStock NVARCHAR(MAX) = NULL,
    @SelectedStuffTrace NVARCHAR(MAX) = NULL,
    @SelectedStuffGroups NVARCHAR(MAX) = NULL,
    @SelectedDelivers NVARCHAR(MAX) = NULL
)
--WITH ENCRYPTION 
AS
DECLARE @User INT,
        @FinancialPeriod INT,
        @selectedColumns NVARCHAR(MAX),
        @Columns NVARCHAR(MAX),
        @queryParams NVARCHAR(MAX),
        @tableName NVARCHAR(20),
        @query NVARCHAR(MAX),
        @selectTrace NVARCHAR(MAX),
        @stuffTraceTableName NVARCHAR(15),
        @joinColumns NVARCHAR(MAX),
        @Culture VARCHAR(25),
        @CultureNo TINYINT;

SET @User = CFG.GetuserID();

SET @Culture = CFG.GetuserCulture();

SELECT @CultureNo = CultureNo
FROM CFG.CultureInfo
WHERE Culture = @Culture;

SET @tableName = CFG.getTempTableName(1);
SET @stuffTraceTableName = CFG.getTempTableName(1);

SELECT @FinancialPeriod = FinancialPeriodID
FROM CFG.FinancialPeriod
WHERE @FromDate
BETWEEN StartDate AND EndDate;

SELECT trla.EntityRef AS FinancialPeriodID
INTO #noAccessFinancial
FROM CFG.RecordLevelAccess AS trla
WHERE trla.UserID = @User
      AND trla.[Type] = 18;

SELECT StockID
INTO #noStock
FROM STF.Stock s
    JOIN CFG.RecordLevelAccess r
        ON r.Type = 9
           AND r.EntityRef = s.StockID
WHERE r.UserID = @User;

SELECT @selectedColumns = STUFF(
                          (
                              SELECT ',' + QUOTENAME(t.TraceID) + ' NVARCHAR(MAX)'
                              FROM STF.Trace AS t
                              ORDER BY t.TraceID
                              FOR XML PATH('')
                          ),
                          1,
                          1,
                          ''
                               );

IF @selectedColumns IS NULL
    SET @selectedColumns = N'[-1] NVARCHAR(MAX)';

SET @query
    = N'CREATE TABLE ' + @tableName
      + N'(
						DlID bigint,
						InputMain DECIMAL(30,4),
						InputSub DECIMAL(30,4),
						OutputMain DECIMAL(30,4),
						OutputSub DECIMAL(30,4)
					)';

EXEC (@query);

SELECT @selectedColumns = STUFF(
                          (
                              SELECT ',piv.' + QUOTENAME(t.TraceID)
                              FROM STF.Trace AS t
                              ORDER BY t.TraceID
                              FOR XML PATH('')
                          ),
                          1,
                          1,
                          ''
                               );

IF @selectedColumns IS NULL
    SET @selectedColumns = N'piv.[-1]';

SELECT @Columns = STUFF(
                  (
                      SELECT ',' + QUOTENAME(t.TraceID)
                      FROM STF.Trace AS t
                      ORDER BY t.TraceID
                      FOR XML PATH('')
                  ),
                  1,
                  1,
                  ''
                       );

IF @Columns IS NULL
    SET @Columns = N'[-1]';

SELECT @selectTrace
    = STUFF(
      (
          SELECT ', CASE WHEN piv.' + QUOTENAME(t.TraceID) + ' = ''null'' THEN NULL ELSE piv.' + QUOTENAME(t.TraceID)
                 + ' END AS' + QUOTENAME(t.TraceID)
          FROM STF.Trace AS t
          ORDER BY t.TraceID
          FOR XML PATH('')
      ),
      1,
      1,
      ''
           );

IF @selectTrace IS NULL
    SET @selectTrace = N'[-1]';

SELECT @joinColumns
    = STUFF(
      (
          SELECT ' AND ISNULL(st.' + QUOTENAME(t.TraceID) + ', 0) = ISNULL(piv.' + QUOTENAME(t.TraceID) + ', 0) '
          FROM STF.Trace AS t
          ORDER BY t.TraceID
          FOR XML PATH('')
      ),
      1,
      0,
      ''
           );

IF @joinColumns IS NULL
    SET @joinColumns = N'AND 1 = 1';

EXEC STC.GetStuffTraceFilterForReview @stuffTraceTableName = @stuffTraceTableName, -- nvarchar(max)
                                      @SelectedStuffTrace = @SelectedStuffTrace;   -- nvarchar(max)

SET @queryParams
    = N'
			@FromDate				DateTime,
			@ToDate					DateTime,
			@SelectedStuffGroups	NVARCHAR(MAX),
			@SelectedStuff			NVARCHAR(MAX),
			@SelectedStuffTrace 	NVARCHAR(MAX),
			@SelectedStock			NVARCHAR(MAX),
			@SelectedDelivers		NVARCHAR(MAX),
			@User					INT
			';
-----------------------------------------------------------------
SET @query
    = N'INSERT ' + @tableName
      + N'
				SELECT i.DeliverDlID AS DlID ,
                      0 AS InputMain ,
                      0 AS InputSub ,
                      -ii.MainQuantity AS [OutputMain] ,
                      -ii.SubQuantity AS [OutputSub]
               FROM   STC.Outgoing i
                      INNER JOIN STC.OutgoingItem ii ON i.OutgoingID = ii.OutgoingID
                      JOIN [STC].[StockDocumentTypeBaseEntity] sdtb 
                            ON i.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
                      INNER JOIN STC.StockDocumentType sdt ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
                      INNER JOIN STF.[Stuff] s ON s.StuffID = ii.StuffID
                      LEFT JOIN #noStock AS ns ON ns.StockID = i.StockID
					  LEFT JOIN #noAccessFinancial naf on i.FinancialPeriodID = naf.FinancialPeriodID
                      LEFT JOIN (   SELECT OutgoingItemID ,
                                           TraceID ,
                                               CASE WHEN TraceItemID IS NOT NULL THEN CAST(TraceItemID AS NVARCHAR(MAX))
                                                    WHEN DlID IS NULL THEN [Value]
                                                    ELSE CAST(DlID AS NVARCHAR(MAX))
                                               END AS [value]
                                    FROM   STC.OutgoingItemTrace ) x
                      PIVOT (   MAX(value)
                                FOR TraceID IN ( ' + @Columns
      + N' )) piv ON piv.OutgoingItemID = ii.OutgoingItemID
					LEFT JOIN ' + @stuffTraceTableName + N' AS st on st.StuffID = ii.StuffID ' + @joinColumns
      + N'
               WHERE  i.Date
                      BETWEEN @FromDate AND @ToDate
                      AND sdt.DocumentType = 3
					  AND ( @User = -1 or naf.FinancialPeriodID is null)
                      AND (   @SelectedStuffGroups IS NULL
                              OR s.StuffGroupID IN (   SELECT value
                                                       FROM   CFG.R_FnCommaStr2Table(
                                                                  @SelectedStuffGroups) ))
                      AND (   @SelectedStuff IS NULL
                              OR ii.StuffID IN (   SELECT value
                                                   FROM   CFG.R_FnCommaStr2Table(
                                                              @SelectedStuff) ))
                      AND (   @SelectedDelivers IS NULL
                              OR i.DeliverDlID IN (   SELECT value
                                                      FROM   CFG.R_FnCommaStr2Table(
                                                                 @SelectedDelivers) ))
                      AND (   @SelectedStuffTrace IS NULL OR st.StuffID IS NOT NULL)
                      AND (   @SelectedStock IS NULL
                              OR i.StockID IN (   SELECT value
                                                  FROM   CFG.R_FnCommaStr2Table(
                                                             @SelectedStock) ))
                      AND (   @User = -1
                              OR ns.StockID IS NULL )
';
EXEC sp_executesql @query,
                   @queryParams,
                   @FromDate = @FromDate,
                   @ToDate = @ToDate,
                   @SelectedStuffGroups = @SelectedStuffGroups,
                   @SelectedStuff = @SelectedStuff,
                   @SelectedStuffTrace = @SelectedStuffTrace,
                   @SelectedStock = @SelectedStock,
                   @SelectedDelivers = @SelectedDelivers,
                   @User = @User;
-----------------------------------------------------------------
SET @query
    = N'INSERT ' + @tableName
      + N'
SELECT i.DlDeliverID AS DlID ,
                      ii.MainQuantity AS InputMain ,
                      ii.SubQuantity AS InputSub ,
                      0 AS [OutputMain] ,
                      0 AS [OutputSub]
               FROM   STC.ReturnedOutgoing i
               JOIN [STC].[StockDocumentTypeBaseEntity] sdtb 
                    ON i.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
                      INNER JOIN STC.ReturnedOutgoingItem ii ON i.ReturnedOutgoingID = ii.ReturnedOutgoingID
                      INNER JOIN STC.StockDocumentType sdt ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
                      INNER JOIN STF.[Stuff] s ON s.StuffID = ii.StuffID
                      LEFT JOIN #noStock AS ns ON ns.StockID = i.StockID
					  LEFT JOIN #noAccessFinancial naf on i.FinancialPeriodID = naf.FinancialPeriodID
					  LEFT JOIN (   SELECT ReturnedOutgoingItemID ,
                                           TraceID ,
                                               CASE WHEN TraceItemID IS NOT NULL THEN CAST(TraceItemID AS NVARCHAR(MAX))
                                                    WHEN DlID IS NULL THEN [Value]
                                                    ELSE CAST(DlID AS NVARCHAR(MAX))
                                               END AS [value]
                                    FROM   STC.ReturnedOutgoingItemTrace ) x
                      PIVOT (   MAX(value)
                                FOR TraceID IN ( ' + @Columns
      + N' )) piv ON piv.ReturnedOutgoingItemID = ii.ReturnedOutgoingItemID
					LEFT JOIN ' + @stuffTraceTableName + N' AS st on st.StuffID = ii.StuffID ' + @joinColumns
      + N'
               WHERE  i.Date
                      BETWEEN @FromDate AND @ToDate
                      AND sdt.DocumentType = 3
					  AND ( @User = -1 or naf.FinancialPeriodID is null)
                      AND (   @SelectedStuffGroups IS NULL
                              OR s.StuffGroupID IN (   SELECT value
                                                       FROM   CFG.R_FnCommaStr2Table(
                                                                  @SelectedStuffGroups) ))
                      AND (   @SelectedStuff IS NULL
                              OR ii.StuffID IN (   SELECT value
                                                   FROM   CFG.R_FnCommaStr2Table(
                                                              @SelectedStuff) ))
                      AND (   @SelectedStuffTrace IS NULL OR st.StuffID IS NOT NULL)
                      AND (   @SelectedDelivers IS NULL
                              OR i.DlDeliverID IN (   SELECT value
                                                      FROM   CFG.R_FnCommaStr2Table(
                                                                 @SelectedDelivers) ))
                      AND (   @SelectedStock IS NULL
                              OR i.StockID IN (   SELECT value
                                                  FROM   CFG.R_FnCommaStr2Table(
                                                             @SelectedStock) ))
                      AND (   @User = -1
                              OR ns.StockID IS NULL )
';
EXEC sp_executesql @query,
                   @queryParams,
                   @FromDate = @FromDate,
                   @ToDate = @ToDate,
                   @SelectedStuffGroups = @SelectedStuffGroups,
                   @SelectedStuff = @SelectedStuff,
                   @SelectedStuffTrace = @SelectedStuffTrace,
                   @SelectedStock = @SelectedStock,
                   @SelectedDelivers = @SelectedDelivers,
                   @User = @User;
-----------------------------------------------------------------

DECLARE @FinalQuery NVARCHAR(MAX);

SET @FinalQuery
    = N'
    SELECT   A.DlID ,
             d.Code AS DlCode ,
			 case when ' + CAST(@CultureNo AS CHAR(1)) + N' = 1 then d.Title
	              when ' + CAST(@CultureNo AS CHAR(1))
      + N' = 2 then d.Title2
	         end as DlTitle, 
             ISNULL(CAST(SUM([InputMain]) AS DECIMAL(30, 4)), 0) AS InputMain ,
             ISNULL(CAST(SUM([InputSub]) AS DECIMAL(30, 4)), 0) AS InputSub ,
             ISNULL(CAST(SUM([OutputMain]) AS DECIMAL(30, 4)), 0) AS OutputMain ,
             ISNULL(CAST(SUM([OutputSub]) AS DECIMAL(30, 4)), 0) AS OutputSub ,
             ISNULL(
                 CAST(SUM([InputMain]) + SUM([OutputMain]) AS DECIMAL(30, 4)) ,
                 0) AS LastMain ,
             ISNULL(
                 CAST(SUM([InputSub]) + SUM([OutputSub]) AS DECIMAL(30, 4)), 0) AS LastSub
    FROM     ' + @tableName
      + N' A
             JOIN ACC.DL d ON d.DLID = A.DlID
    GROUP BY A.DlID ,
             d.Code ,
             d.Title,
			 d.Title2';

EXEC (@FinalQuery);

