
------------------------------- START #8212
CREATE   PROC [STC].RptGetStockAnalyticalStuffWithTraceReview
(
    @FromDate DATETIME = NULL,
    @ToDate DATETIME = NULL,
    @SelectedAccountGroup NVARCHAR(MAX) = NULL,
    @SelectedStuff NVARCHAR(MAX) = NULL,
    @SelectedStocks NVARCHAR(MAX) = NULL,
    @SelectedStockDocumentType NVARCHAR(MAX) = NULL,
    @SelectedDl NVARCHAR(MAX) = NULL,
    @ReviewType INT = 2
)
--WITH ENCRYPTION 
AS
SET NOCOUNT on
BEGIN
	DECLARE @stockDocumentsType          NVARCHAR(MAX),
	        @PricestockDocumentsType     NVARCHAR(MAX),
	        @TableName                   NVARCHAR(MAX),
	        @TableName1                  NVARCHAR(MAX),
	        @Columns                     NVARCHAR(MAX),
	        @CodeAndTitleColumn          NVARCHAR(MAX),
	        @SelectColumns               NVARCHAR(MAX),
	        @joinTracesEqual             NVARCHAR(MAX),
	        @Query                       NVARCHAR(MAX),
	        @Culture                     VARCHAR(10),
	        @CultureNo                   TINYINT,
	        @LeftJoin                    NVARCHAR(MAX),
	        @listLeftJoin                NVARCHAR(MAX),
	        @PriceAndQuantityJoin        NVARCHAR(MAX),
	        @TotalQuantity               NVARCHAR(MAX),
	        @TotalAmount                 NVARCHAR(MAX);
	
	SET @Culture = CFG.GetuserCulture();
	
	SELECT @CultureNo = CultureNo
	FROM   CFG.CultureInfo
	WHERE  Culture = @Culture;	        
	
	SELECT @Columns = STUFF(
	           (
	               SELECT DISTINCT
	                      ',' + QUOTENAME(TraceID)
	               FROM   STF.Trace
	               WHERE CASE WHEN @ReviewType = 2 THEN PricingBase ELSE CheckInventory END = 1
	                      FOR XML PATH(''),
	                      TYPE
	           ).value('.', 'NVARCHAR(MAX)'),
	           1,
	           1,
	           ''
	       );
	
	IF (@Columns IS NULL)
	    SET @Columns = N'[-1]';
	
	SELECT @CodeAndTitleColumn = STUFF(
	           (
	               SELECT DISTINCT
	                      ' ,d' + CAST(TraceID AS VARCHAR(10)) + '.Code AS T' + CAST(TraceID AS VARCHAR(10)) + 'Code,d'
	                      + CAST(TraceID AS VARCHAR(10)) + '.Title
					 AS T' + CAST(TraceID AS VARCHAR(10)) + 'Title'
	               FROM   STF.Trace
	               WHERE  DlTypeID IS NOT NULL
	                      AND CASE WHEN @ReviewType = 2 THEN PricingBase ELSE CheckInventory END = 1
	                          FOR XML PATH(''), TYPE
	           ).value('.', 'NVARCHAR(MAX)'),
	           1,
	           1,
	           ''
	       );
	
	IF (@CodeAndTitleColumn IS NULL)
	    SET @CodeAndTitleColumn = N'';
	SELECT @SelectColumns = STUFF(
	           (
	               SELECT DISTINCT
	                      ',items.' + QUOTENAME(TraceID) + ' AS T' + CAST(TraceID AS NVARCHAR(5))
	                      + CASE	
	                             WHEN AccountLevelTypeID = 6 THEN ',d' + CAST(TraceID AS VARCHAR(10)) + '.Item' + CASE 
	                                                                                                                   WHEN 
	                                                                                                                        @CultureNo 
	                                                                                                                        =
	                                                                                                                        2 THEN 
	                                                                                                                        '2'
	                                                                                                                   ELSE 
	                                                                                                                        ''
	                                                                                                              END +
	                                   ' AS T' + CAST(TraceID AS NVARCHAR(5)) + 'Title' 
	                             ELSE ''
	                        END
	               FROM   STF.Trace
	               WHERE CASE WHEN @ReviewType = 2 THEN PricingBase ELSE CheckInventory END = 1
	                      FOR XML PATH(''),
	                      TYPE
	           ).value('.', 'NVARCHAR(MAX)'),
	           1,
	           1,
	           ''
	       );
		
	SELECT @LeftJoin = STUFF(
	           (
	               SELECT DISTINCT
	                      ' Left Join acc.dl d' + CAST(TraceID AS VARCHAR(10)) + ' on d' + CAST(TraceID AS VARCHAR(10))
	                      + '.DlID = items.' + QUOTENAME(TraceID)
	               FROM   STF.Trace
	               WHERE  DlTypeID IS NOT NULL
	                      AND CASE WHEN @ReviewType = 2 THEN PricingBase ELSE CheckInventory END = 1
	                          FOR XML PATH(''), TYPE
	           ).value('.', 'NVARCHAR(MAX)'),
	           1,
	           1,
	           ''
	       );
	
	IF (@LeftJoin IS NULL)
	    SET @LeftJoin = N'';
	
	
	IF (@SelectColumns IS NULL)
	    SET @SelectColumns = N'[-1]';
	
	SELECT @listLeftJoin = STUFF(
	           (
	               SELECT DISTINCT
	                      ' Left Join STF.TraceItem d' + CAST(TraceID AS VARCHAR(10)) + ' on d' + CAST(TraceID AS VARCHAR(10))
	                      + '.TraceItemID = items.' + QUOTENAME(TraceID)
	               FROM   STF.Trace
	               WHERE  AccountLevelTypeID = 6
	                      AND CASE WHEN @ReviewType = 2 THEN PricingBase ELSE CheckInventory END = 1
	                          FOR XML PATH(''), TYPE
	           ).value('.', 'NVARCHAR(MAX)'),
	           1,
	           1,
	           ''
	       );
		   
	IF (@listLeftJoin IS NULL)
	    SET @listLeftJoin = N'';    
	       
	SELECT @PriceAndQuantityJoin = STUFF(
	            (
	                SELECT DISTINCT
	                        '  and  isnull(a.[' + CAST(TraceID AS VARCHAR(10)) + '],0) = isnull(b.[' + CAST(TraceID AS VARCHAR(10)) + 
	                        N'],0) '
	                FROM   STF.Trace
	                WHERE CASE WHEN @ReviewType = 2 THEN PricingBase ELSE CheckInventory END = 1
	                            FOR XML PATH(''), TYPE
	            ).value('.', 'NVARCHAR(MAX)'),
	            1,
	            1,
	            ''
	        );	
	              
if @PriceAndQuantityJoin is NULL
BEGIN
	set @PriceAndQuantityJoin = ''
END
	
	
	
	
	
	SET @TableName = cfg.getTempTableName(1);
	SET @TableName1 = cfg.getTempTableName(1);
	
	EXEC stc.RptReviewDataSource
	     @FromDate = @FromDate,
	     @ToDate = @ToDate,
	     @TableName = @TableName,
	     @SelectedStocks = @SelectedStocks,
	     @SelectedDl = @SelectedDl,
	     @SelectedStuffTrace = NULL,
	     @SelectedStuffAccountGroup = @SelectedAccountGroup,
	     @SelectedStuff = @SelectedStuff,
	     @SelectedStockDocumentType = @SelectedStockDocumentType,
	     @IsTraceTab = 1,
	     @Parameter = 'Stuff',
	     @ReviewType = @ReviewType
	
	SELECT *
	INTO   #vwStuff
	FROM   stf.VWStuff AS v
	
	
	    CREATE TABLE #StockDocument
    (
        StockDocumentTypeID INT NOT NULL
    );
	
	  SET @Query
      = N'
insert into #StockDocument
select StockDocumentTypeID from ' + @TableName
        + N'
group by StockDocumentTypeID
order by StockDocumentTypeID
' ;

  EXEC (@Query);
	
	 SELECT @stockDocumentsType = STUFF(
 (
     SELECT DISTINCT
            ',' + QUOTENAME('SDTQ' + CAST(StockDocumentTypeID AS VARCHAR(5)))
     FROM #StockDocument
     FOR XML PATH(''), TYPE
 ).value('.', 'NVARCHAR(MAX)'),
 1   ,
 1   ,
 '');
 
SELECT @TotalQuantity = STUFF(
 (
     SELECT DISTINCT
            '+isnull(' + QUOTENAME('SDTQ' + CAST(StockDocumentTypeID AS VARCHAR(5))) +N',0)'
     FROM #StockDocument
     FOR XML PATH(''), TYPE
 ).value('.', 'NVARCHAR(MAX)'),
 1   ,
 1   ,
 '');
 
 SELECT @TotalAmount = STUFF(
 (
     SELECT DISTINCT
            '+isnull(' + QUOTENAME('SDTP' + CAST(StockDocumentTypeID AS VARCHAR(5)))+N',0)' 
     FROM #StockDocument
     FOR XML PATH(''), TYPE
 ).value('.', 'NVARCHAR(MAX)'),
 1   ,
 1   ,
 '');
	    
set @TotalQuantity = @TotalQuantity + N' as TotalQuantity'
set @TotalAmount = @TotalAmount + N' as TotalAmount'

 SELECT @PricestockDocumentsType = STUFF(
            (
                SELECT DISTINCT
                       ',' + QUOTENAME('SDTP' + CAST(StockDocumentTypeID AS VARCHAR(5)))
                FROM   #StockDocument
                       FOR XML PATH(''),
                       TYPE
            ).value('.', 'NVARCHAR(MAX)'),
            1,
            1,
            ''
        );
        
	
	SET @query = N'SELECT   A.*,'+@TotalQuantity+N',b.'+@PricestockDocumentsType+N',' + @TotalAmount + N' 
					into ' + @tableName1 + ' 
			FROM (
			         SELECT *       FROM   (
			                    SELECT ID,
			                           '+@Columns+N',
			                           ''SDTQ'' + CAST(StockDocumentTypeID as NVARCHAR(20)) QSdt,
			                           MainQuantity
			                    FROM   ' + @TableName
	    + N'
			                ) x
			                pivot(
			                    SUM(MainQuantity) 
			                    for QSdt IN (' + @stockDocumentsType
	    + 
	    N')
			                ) piv1
			     ) a 
	   JOIN 
(
    SELECT *
    FROM   (
               SELECT ID,
                      '+@Columns+N',
                      ''SDTP'' + CAST(StockDocumentTypeID as NVARCHAR(20)) QSdt,
                      Price
               FROM   ' + @TableName
	    + N'
           ) x
           pivot(
               SUM(Price) 
               for QSdt IN (' + @PricestockDocumentsType
	    + 
	    N')    ) piv1
) b  on a.ID = b.ID '+@PriceAndQuantityJoin
	    
	EXEC (@query)
	

	
	--print 88
	DECLARE @userid                INT,
	        @FinancialPeriodID     INT;
	
	
	SET @userid = CFG.GetuserID();
	

	SET @Query = N'
  insert into #StockDocument
  select StockDocumentTypeID from ' + @TableName +
	    N'
  group by StockDocumentTypeID
  order by StockDocumentTypeID
  '
	
	EXEC (@Query)
	
	--print 89
	SELECT @stockDocumentsType = STUFF(
	           (
	               SELECT DISTINCT
	                      ',' + QUOTENAME('SDTQ' + CAST(StockDocumentTypeID AS VARCHAR(5)))
	               FROM   #StockDocument
	                      FOR XML PATH(''),
	                      TYPE
	           ).value('.', 'NVARCHAR(MAX)'),
	           1,
	           1,
	           ''
	       );
	
	SELECT @PricestockDocumentsType = STUFF(
	           (
	               SELECT DISTINCT
	                      ',' + QUOTENAME('SDTP' + CAST(StockDocumentTypeID AS VARCHAR(5)))
	               FROM   #StockDocument
	                      FOR XML PATH(''),
	                      TYPE
	           ).value('.', 'NVARCHAR(MAX)'),
	           1,
	           1,
	           ''
	       );		
	
	SELECT @joinTracesEqual = STUFF(
	           (
	               SELECT DISTINCT
	                      ' AND ISNULL(q.' + QUOTENAME(CAST(TraceID AS VARCHAR(10))) + ',0) = ISNULL(p.'
	                      + QUOTENAME(CAST(TraceID AS VARCHAR(10))) + ',0)'
	               FROM   STF.Trace
	               WHERE CASE WHEN @ReviewType = 2 THEN PricingBase ELSE CheckInventory END = 1
	                      FOR XML PATH(''), TYPE
	           ).value('.', 'NVARCHAR(MAX)'),
	           1,
	           0,
	           ''
	       );
	
	IF @joinTracesEqual IS NULL
	    SET @joinTracesEqual = N'';
	
	
	SET @query = 
	    N'SELECT 
				items.ID StuffID,	
				s.Code AS StuffCode ,
				case when @CultureNo = 1 then s.Title else s.Title2 end as StuffTitle, 
				sd.TechnicalCode,
				mu.Title AS MainUnit ,
				mu2.Title AS SubMeasureUnit ,
				items.*,
				' + @SelectColumns + ' ' + @CodeAndTitleColumn + N'
			FROM ' + @tableName1 + 
	    ' items	
			JOIN STF.VWStuff s ON items.ID = s.StuffID
			JOIN STF.StuffDetail sd ON sd.StuffID = s.StuffID
			JOIN STF.MeasureUnit mu ON mu.MeasureUnitID = s.MainMeasureUnitID
			LEFT JOIN STF.MeasureUnit mu2 ON mu2.MeasureUnitID = sd.MeasureSubUnitID ' + @LeftJoin + ' ' + @listLeftJoin 
	
	
	EXECUTE sp_executesql @query,
	     N' @CultureNo tinyint',
	     @CultureNo = @CultureNo
END;
