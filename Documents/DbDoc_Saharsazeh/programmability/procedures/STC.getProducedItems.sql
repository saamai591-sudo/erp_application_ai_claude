---------------------------------------------------------------------------------------------------------------
CREATE   PROC [STC].getProducedItems
(
    @ProduceCenter BIGINT,
    @FromDate DATE,
    @ToDate DATE
)
--WITH ENCRYPTION
AS
DECLARE @Columns NVARCHAR(MAX),
        @Query NVARCHAR(MAX),
        @Params NVARCHAR(MAX),
        @FinancialPeriodID INT,
        @Date DATE,
        @StockID INT,
        @ConditionalInnerJoin NVARCHAR(MAX),
        @TableName1 NVARCHAR(255),
        @traceTableName NVARCHAR(255),
        @Culture NVARCHAR(100),
        @CultureNo TINYINT;

SET @Culture = CFG.GetuserCulture();

SELECT @CultureNo = CultureNo
FROM CFG.CultureInfo
WHERE Culture = @Culture;

SET @TableName1 = CFG.getTempTableName(1);
SET @traceTableName = CFG.getTempTableName(1);

SELECT @Columns = STUFF(
(
    SELECT DISTINCT
           ',' + QUOTENAME(TraceID)
    FROM STF.Trace
    FOR XML PATH(''), TYPE
).value('.', 'NVARCHAR(MAX)'),
1   ,
1   ,
''
                       );

IF (@Columns IS NULL)
    SET @Columns = N'[-1]';

SET @Query
    = N'
	SELECT  CAST(ROW_NUMBER() OVER ( ORDER BY a.StuffID , ' + @Columns
      + N' ) AS INT) StockReceiptItemID ,
        1 StockReceiptID ,
        a.*
	into ' + @TableName1
      + N'
	FROM    ( SELECT    ii.StuffID ,
						[STF].[GetStuffCode](ii.StuffID) AS StuffCode ,
						case @CultureNo
							when 1 then stf.Title
							when 2 then stf.Title2
			            end as StuffTitle,
						SUM(ii.MainQuantity) MainQuantity ,
						SUM(ii.SubQuantity) SubQuantity ,
						' + @Columns+ N'
			  FROM      STC.StockReceipt i
						INNER JOIN STC.StockReceiptItem ii ON i.StockReceiptID = ii.StockReceiptID
						JOIN [STC].[StockDocumentTypeBaseEntity] sdtb ON i.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
						JOIN STC.StockDocumentType sdt ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID AND sdt.DocumentType = 0
						JOIN STF.VwStuff stf ON ii.StuffID = stf.StuffID
						LEFT JOIN ( SELECT  StockReceiptItemID ,
											iit.TraceID ,
											CASE WHEN AccountLevelTypeID = 1 THEN CAST (DlID AS NVARCHAR(MAX))
												 WHEN AccountLevelTypeID = 6 THEN CAST (TraceItemID AS NVARCHAR(MAX))
												 ELSE Value
											END value
									FROM    STC.StockReceiptItemTrace iit
											JOIN STF.Trace t ON t.TraceID = iit.TraceID
								  ) x PIVOT ( MAX(value) FOR TraceID IN ( ' + @Columns
      + N' ) ) p ON p.StockReceiptItemID = ii.StockReceiptItemID
			  WHERE     i.DeliverDlID =@pProduceCenter
						AND i.Date BETWEEN @pFromDate AND @pToDate
			  GROUP BY  ii.StuffID ,
						stf.Code ,
						stf.Title ,
						stf.Title2 ,
						' + @Columns+ N'
			  
			  UNION

			  SELECT    ii.StuffID ,
						[STF].[GetStuffCode](ii.StuffID)  AS StuffCode ,
						case @CultureNo
							when 1 then stf.Title
							when 2 then stf.Title2
			            end as StuffTitle,
						SUM(ii.MainQuantity) MainQuantity ,
						SUM(ii.SubQuantity) SubQuantity ,
						' + @Columns+ N'
			  FROM      STC.ReturnStockReceipt i
						INNER JOIN STC.ReturnStockReceiptItem ii ON i.ReturnStockReceiptID = ii.ReturnStockReceiptID
						JOIN [STC].[StockDocumentTypeBaseEntity] sdtb ON i.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
						JOIN STC.StockDocumentType sdt ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
														  AND sdt.DocumentType = 0
						JOIN STF.VwStuff stf ON ii.StuffID = stf.StuffID
						LEFT JOIN ( SELECT  iit.ReturnStockReceiptItemID ,
											iit.TraceID ,
											CASE WHEN AccountLevelTypeID = 1 THEN CAST (DlID AS NVARCHAR(MAX))
												 WHEN AccountLevelTypeID = 6 THEN CAST (TraceItemID AS NVARCHAR(MAX))
												 ELSE Value
											END value
									FROM    STC.ReturnStockReceiptItemTrace iit
											JOIN STF.Trace t ON t.TraceID = iit.TraceID
								  ) x PIVOT ( MAX(value) FOR TraceID IN ( ' + @Columns
      + N' ) ) p ON p.ReturnStockReceiptItemID = ii.ReturnStockReceiptItemID
			  WHERE     i.DeliverDlID = @pProduceCenter
						AND i.Date BETWEEN @pFromDate AND @pToDate
			  GROUP BY  ii.StuffID ,
						stf.Code ,
						stf.Title ,
						stf.Title2 ,
						' + @Columns + N'
			) a	
	';

SET @Params = N'@pProduceCenter int,@pFromDate date,@pToDate date,@CultureNo tinyint';
EXECUTE sp_executesql @Query,
                      @Params,
                      @pProduceCenter = @ProduceCenter,
                      @pFromDate = @FromDate,
                      @pToDate = @ToDate,
                      @CultureNo = @CultureNo;
					  
SET @Query
    = N'select StockReceiptItemID, 
			   TraceID, 
			   Value 
		into ' + @traceTableName + N' 
		from
		( 
			select StockReceiptItemID,' + @Columns + N' from ' + @TableName1
+ N'
		)x
		UNPIVOT
		(
			Value For TraceID  IN (' + @Columns + N')
		)A';
EXEC (@Query);


SET @Query
    = N'
		SELECT  StockReceiptItemID ,
				1 StockReceiptID ,
				CAST(ROW_NUMBER() OVER ( ORDER BY StockReceiptItemID ) AS SMALLINT) RowIndex ,
				StuffID ,
				StuffCode ,
				StuffTitle ,
				MainQuantity ,
				SubQuantity
		FROM  ' + @TableName1;

EXECUTE sp_executesql @Query;




SET @Query
    = N'
			SELECT  CAST(ROW_NUMBER() OVER ( ORDER BY StockReceiptItemID ) AS INT) StockReceiptItemTraceID ,
					StockReceiptItemID ,
					CAST(temp.[TraceID] AS INT) TraceID ,
					CASE WHEN T.AccountLevelTypeID = 1 THEN CAST(Value AS BIGINT)
						 ELSE NULL
					END AS DlID ,
					CASE WHEN T.AccountLevelTypeID <> 1 AND T.AccountLevelTypeID <> 6 THEN Value
						 WHEN T.AccountLevelTypeID = 6 THEN  
							(select top(1) case 
									when @CultureNo = 2 then 
										ti.Item2 
									else 
										ti.Item 
									end   from stf.TraceItem ti where ti.TraceItemID = Value)
						 ELSE NULL
					END AS Value,
					CAST( CASE WHEN T.AccountLevelTypeID = 6 THEN  Value
						 ELSE NULL
					END AS INT) AS TraceItemID
			FROM   ' + @traceTableName + N'  temp
					JOIN STF.Trace T ON T.TraceID = temp.TraceID;
			';
EXECUTE sp_executesql @Query, N'@CultureNo int', @CultureNo = @CultureNo;


SET @Query
    = N'

    IF EXISTS ( SELECT  1
                FROM    tempdb.sys.tables
                WHERE   name = ''' + @TableName1 + N''' ) DROP TABLE ' + @TableName1
      + N';

    IF EXISTS ( SELECT 1
                FROM    tempdb.sys.tables
                WHERE   name = ''' + @traceTableName + N''' ) DROP TABLE ' + @traceTableName;

EXECUTE sp_executesql @Query;


