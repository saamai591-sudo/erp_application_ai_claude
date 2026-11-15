-----------------------------------
--RptReception_ConsumableParts.sql:
 
Create     PROCEDURE [CTM].RptReception_ConsumableParts
	@Branches NVARCHAR(MAX) = NULL,
	@Receptions NVARCHAR(MAX) = NULL,
	@Customers NVARCHAR(MAX) = NULL,
	@Dls NVARCHAR(MAX) = NULL,
	@FromDate DATE ,
	@ToDate DATE

--WITH ENCRYPTION 
AS
BEGIN

	DECLARE @Columns NVARCHAR(MAX),
			@Query   NVARCHAR(MAX),
			@Param NVARCHAR(MAX),
			@ParamDefinition NVARCHAR(MAX),
			@TableName1 Nvarchar(250),
			@FinancialPeriodID int

	select @FinancialPeriodID = FinancialPeriodID
	from cfg.FinancialPeriod
	where @ToDate between StartDate and EndDate

	SET @TableName1 = cfg.getTempTableName(1)

	SELECT @Columns = STUFF((SELECT ',' + QUOTENAME(TraceID)+' NVARCHAR(256)'
							FROM STF.Trace 
							WHERE    CheckInventory = 1
							ORDER BY TraceID
							FOR XML PATH(''), TYPE
							).value('.', 'NVARCHAR(MAX)'),1,1,'')
	IF(@Columns is null)								   
	SET @Columns = '[-1] NVARCHAR(256)'

	exec stc.spGetInventoryInDate
    @StuffId  =   Null,
    @stockID =    Null,
	@ToDate =	  @ToDate,
	@FinalTable = @TableName1

		SELECT @Columns = STUFF((SELECT DISTINCT ',' + QUOTENAME(TraceID) 
									FROM STF.Trace
							WHERE    CheckInventory = 1
									FOR XML PATH(''), TYPE
									).value('.', 'NVARCHAR(MAX)'),1,1,'')


	IF(@Columns is null)								   
	SET @Columns = '[-1]'

	exec(@Query)

		set @Query = '
		select res.*,
		  s2.Title                           StockTitle,
	       s2.Title2                          StockTitle2,
	       s2.Code                            StockCode,
	       s.Code                             StuffCode,
	       s.Title                            StuffTitle,
	       s.Title2                           StuffTitle2
		
		 from
		(SELECT ROW_NUMBER() OVER(ORDER BY a.StuffID) ID,
	       a.StuffID,
	       a.StockID,
	       ISNULL(SUM(a.Non_Returned), 0)     NonReturned,
	       ISNULL(SUM(a.SubNon_Returned), 0)  SubNonReturned,
	       sum(b.MainQuantity)				      MainInventory
	FROM   (
	           SELECT toi.StuffID,
	                  to1.StockID,
	                  tor.Non as Non_Returned,
	                  tor.NonSub as SubNon_Returned
	           FROM   STC.TemporaryOutgoing to1
	                  INNER JOIN STC.TemporaryOutgoingItem toi
	                       ON  toi.TemporaryOutgoingID = to1.TemporaryOutgoingID
	                    INNER JOIN stc.TemporaryOutgoing_Remain AS tor
						ON tor.TemporaryOutgoingItemID = toi.TemporaryOutgoingItemID
	           WHERE  (
	                      @pReceptions IS NULL
	                      OR toi.ReceptionID IN (SELECT VALUE
	                                             FROM   CFG.R_FnCommaStr2Table(@pReceptions))
	                  )
	                  AND (
	                          @pDls IS NULL
	                          OR to1.DlID IN (SELECT VALUE
	                                          FROM   CFG.R_FnCommaStr2Table(@pDls))
	                      )
	                  AND to1.Date BETWEEN @pFromDate AND @pToDate
	       
	       )                            AS a
		   
		 INNER JOIN cfg.vwStockAccess AS vsa ON vsa.StockID = a.StockID
	       INNER JOIN  '+@TableName1+' b
	           
	            ON   b.StuffID = a.StuffID AND b.StockID = a.StockID
    GROUP BY
	       a.StuffID,
	       a.StockID
		   ) res
		   INNER JOIN STF.[Stuff] s
	            ON  s.StuffID = res.StuffID
	       INNER JOIN STF.Stock s2
	            ON  res.StockID = s2.StockID 
		   
		   '

	SET @Param = N'@pReceptions AS NVARCHAR(MAX),@pDls AS NVARCHAR(MAX),@pFromDate date,@pToDate date'				
	EXECUTE sp_executeSQL     
				@Query,
				@Param,
				@pReceptions = @Receptions,
				@pDls = @Dls,
				@pFromDate = @FromDate,
				@pToDate = @ToDate
END

