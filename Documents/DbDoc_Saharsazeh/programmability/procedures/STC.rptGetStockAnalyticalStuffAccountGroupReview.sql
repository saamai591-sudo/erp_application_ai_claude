CREATE   PROCEDURE [STC].rptGetStockAnalyticalStuffAccountGroupReview
(
    @FromDate DATE,
    @ToDate DATE,
    @SelectedStocks NVARCHAR(MAX) = NULL,
    @SelectedStuff NVARCHAR(MAX) = NULL,
    @SelectedStuffTrace NVARCHAR(MAX) = NULL,
    @SelectedStockDocumentType NVARCHAR(MAX) = NULL,
    @SelectedDl NVARCHAR(MAX) = NULL,
    @ReviewType INT = 2
)
-- WITH ENCRYPTION
AS
SET NOCOUNT on
BEGIN
    DECLARE @stockDocumentsType NVARCHAR(MAX),
    @PricestockDocumentsType NVARCHAR(MAX),
    @TableName NVARCHAR(MAX),
    @Query NVARCHAR(MAX);	
    
    SET @TableName = cfg.getTempTableName(1);
    
    EXEC stc.RptReviewDataSource
        @ReviewType = @ReviewType,
    	@FromDate = @FromDate,
    	@ToDate = @ToDate,
    	@TableName = @TableName,
    	@SelectedStocks = @SelectedStocks,
    	@SelectedDl = @SelectedDl,
    	@SelectedStuffTrace = @SelectedStuffTrace,
    	@SelectedStuffAccountGroup = NULL,
    	@SelectedStuff = @SelectedStuff,
    	@SelectedStockDocumentType = @SelectedStockDocumentType,
    	@IsTraceTab = 0,
    	@Parameter = 'StuffAccountGroup'


		--print 88
    DECLARE @userid INT,
            @FinancialPeriodID INT,
            @Culture VARCHAR(25),
            @CultureNo TINYINT;

    SET @userid = CFG.GetuserID();

    SET @Culture = CFG.GetuserCulture();

    SELECT @CultureNo = CultureNo
    FROM CFG.CultureInfo
    WHERE Culture = @Culture;

	CREATE TABLE #StockDocument
	(StockDocumentTypeID INT)

  SET @Query = N'
  insert into #StockDocument
  select StockDocumentTypeID from '+@TableName+N'
  group by StockDocumentTypeID
  order by StockDocumentTypeID
  '
  
  EXEC (@Query)
  
  --print 89
    SELECT @stockDocumentsType = STUFF(
    (
        SELECT DISTINCT
               ',' + QUOTENAME('SDTQ'+CAST(StockDocumentTypeID AS VARCHAR(5)))
        FROM #StockDocument
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'),
    1   ,
    1   ,
    '' );
    
        SELECT @PricestockDocumentsType = STUFF(
    (
        SELECT DISTINCT
               ',' + QUOTENAME('SDTP'+CAST(StockDocumentTypeID AS VARCHAR(5)))
        FROM #StockDocument
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'),
    1   ,
    1   ,
    '' );		
  	
   	
   			
   SET @Query=N'
   
   select  s.StuffAccountGroupID, s.code StuffAccountGroupCode,
		case when ' + CAST(@CultureNo AS CHAR(1)) + N' = 1 then s.Title
	                when ' + CAST(@CultureNo AS CHAR(1)) + N' = 2 then s.Title2
	           end as StuffAccountGroupTitle,'+@stockDocumentsType+N','+@PricestockDocumentsType+N',Total.TotalQuantity,Total.TotalAmount from 
   (select *   from (
   	select ID,''SDTQ''+cast(StockDocumentTypeID as nvarchar(20)) QSdt,MainQuantity from '+@TableName+N') x
   	pivot(sum(MainQuantity) 
   	for QSdt in ('+@stockDocumentsType+N')) piv1) q
   	join 
   	
   (select *   from (
   	select ID ,''SDTP''+cast(StockDocumentTypeID as nvarchar(20)) PSdt,price from '+@TableName+N') x
   pivot (sum(price) for Psdt in ('+@PricestockDocumentsType+N')) piv) p on q.ID= p.ID
   join stf.StuffAccountGroup s on q.ID = s.StuffAccountGroupID
   join (select sum(MainQuantity) as TotalQuantity,sum(price) as TotalAmount,ID
         from '+@TableName+N' group by ID) Total on q.ID= Total.ID
   '
   	
   	
   	
   	EXEC (@Query)
   	
   	
END
