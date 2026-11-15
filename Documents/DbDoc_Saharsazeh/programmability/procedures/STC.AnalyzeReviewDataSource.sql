-----------------------------------------------------------------------------------------------------------------
CREATE   PROC [STC].AnalyzeReviewDataSource
(
    @FromDate DATETIME = NULL,
    @ToDate DATETIME = NULL,
    @TableName NVARCHAR(500),
    @SelectedStocks NVARCHAR(MAX) = NULL,
    @SelectedDl NVARCHAR(MAX) = NULL,
    @SelectedStuffTrace NVARCHAR(MAX) = NULL,
    @SelectedStuffAccountGroup NVARCHAR(MAX) = NULL,
    @SelectedStuffGroup NVARCHAR(MAX) = NULL,
    @SelectedStuff NVARCHAR(MAX) = NULL,
    @SelectedStockDocumentType NVARCHAR(MAX) = NULL,
    @IsTraceTab BIT = 0,
    @Parameter NVARCHAR(100)
)
--WITH ENCRYPTION 
AS

SET NOCOUNT ON


SELECT VALUE StockDocumentTypeID
INTO   #SelectedStockDocumentType
FROM   CFG.R_FnCommaStr2Table(@SelectedStockDocumentType)  


SELECT sdt.* INTO #StockDocument
FROM stc.StockDocumentType AS sdt 
JOIN cfg.vwStockDocumentsAccess AS vsda ON vsda.StockDocumentTypeID = sdt.StockDocumentTypeID
LEFT JOIN #SelectedStockDocumentType ssdt ON sdt.StockDocumentTypeID = ssdt.StockDocumentTypeID
WHERE (@SelectedStockDocumentType IS NULL OR ssdt.StockDocumentTypeID IS NOT NULL)


SELECT VALUE StockID
INTO   #SelectedStocks
FROM   CFG.R_FnCommaStr2Table(@SelectedStocks)  
	
SELECT s.*
INTO   #vwStockAccess
FROM   cfg.vwStockAccess AS s
       LEFT JOIN #SelectedStocks ss
            ON  s.StockID = ss.StockID
WHERE  (@SelectedStocks IS NULL OR ss.StockID IS NOT NULL)
	
SELECT VALUE DlID
INTO   #SelectedDl
FROM   CFG.R_FnCommaStr2Table(@SelectedDl)

SELECT VALUE StuffTraceID
INTO   #SelectedStuffTrace
FROM   CFG.R_FnCommaStr2Table(@SelectedStuffTrace)

SELECT VALUE StuffAccountGroupID
INTO   #SelectedStuffAccountGroup
FROM   CFG.R_FnCommaStr2Table(@SelectedStuffAccountGroup)

SELECT VALUE StuffGroupID
INTO   #SelectedStuffGroup
FROM   CFG.R_FnCommaStr2Table(@SelectedStuffGroup)

SELECT VALUE StuffID
INTO   #SelectedStuff
FROM   CFG.R_FnCommaStr2Table(@SelectedStuff) 
       
       
       /*
       @ReviewType = 1 Quantity
       @ReviewType = 2 Amount
       */

DECLARE @Culture                         VARCHAR(10),
        @query                           NVARCHAR(MAX),
        @Columns                         NVARCHAR(MAX),
        @SelectColumns                   NVARCHAR(MAX),
        @stuffTraceTableName             NVARCHAR(15),
        @stuffInfo                       NVARCHAR(15),
        @joinColumns                     NVARCHAR(MAX),
        @TraceTableName                  NVARCHAR(MAX),
        @GroupByField                    NVARCHAR(100),
        @PosInvoiceStockDocumentType     INT	
			
			
SELECT @PosInvoiceStockDocumentType = StockDocumentTypeID
FROM   #StockDocument AS sdt
WHERE  sdt.[Type] = 2
       AND sdt.DocumentType = 17


SET @stuffTraceTableName = CFG.getTempTableName(1);
SET @stuffInfo = CFG.getTempTableName(1);
SET @TraceTableName = CFG.getTempTableName(1);

SET @query = N'
			select a.StuffID,a.Type,a.StuffGroupID,b.StuffAccountGroupID
			into ' + @stuffInfo + 
    N'
			from stf.stuff a 
			join stf.StuffDetail b on a.StuffID = b.StuffID
			left join #SelectedStuffAccountGroup ssag on ssag.StuffAccountGroupID = b.StuffAccountGroupID
			left join #SelectedStuffGroup ssg on ssg.StuffGroupID = a.StuffGroupID
			left join #SelectedStuff ss on ss.StuffID = a.StuffID
			where (@SelectedStuffAccountGroup IS NULL OR ssag.StuffAccountGroupID is not null)
			AND   (@SelectedStuffGroup IS NULL OR ssg.StuffGroupID is not null)
			AND (@SelectedStuff IS NULL OR ss.StuffID is not null )'

EXECUTE sp_executesql @query,
     N'    @SelectedStuffAccountGroup    NVARCHAR(MAX),
							  @SelectedStuffGroup           NVARCHAR(MAX),
							  @SelectedStuff				NVARCHAR(MAX)',
     @SelectedStuffAccountGroup = @SelectedStuffAccountGroup,
     @SelectedStuffGroup = @SelectedStuffGroup,
     @SelectedStuff = @SelectedStuff




----print sysdatetime()
----print 1

SELECT @Columns = STUFF(
           (
               SELECT DISTINCT
                      ',' + QUOTENAME(TraceID)
               FROM   STF.Trace
               WHERE  CheckInventory = 1
                      FOR XML PATH(''), TYPE
           ).value('.', 'NVARCHAR(MAX)'),
           1,
           1,
           ''
       );

IF (@Columns IS NULL)
    SET @Columns = N'[-1]';

		
IF @SelectedStuffTrace IS NOT NULL
   OR @IsTraceTab = 1
    SELECT @SelectColumns = STUFF(
               (
                   SELECT DISTINCT
                          ',P.' + QUOTENAME(TraceID)
                   FROM   STF.Trace
                   WHERE  CheckInventory = 1
                          FOR XML PATH(''), TYPE
               ).value('.', 'NVARCHAR(MAX)'),
               1,
               1,
               ''
           );
		ELSE
SELECT @SelectColumns = STUFF(
           (
               SELECT DISTINCT
                      ',Null AS' + QUOTENAME(TraceID)
               FROM   STF.Trace
               WHERE  CheckInventory = 1
                      FOR XML PATH(''), TYPE
           ).value('.', 'NVARCHAR(MAX)'),
           1,
           1,
           ''
       );
IF (@SelectColumns IS NULL)
    SET @SelectColumns = N'NULL [-1]';

SET @GroupByField = CASE @Parameter
                         WHEN 'Stock' THEN 'i.StockID'
                         WHEN 'StuffAccountGroup' THEN 'si.StuffAccountGroupID'
                         WHEN 'StuffGroup' THEN 'si.StuffGroupID'
                         WHEN 'Stuff' THEN CASE 
                                                WHEN @IsTraceTab = 0 THEN 'ii.StuffID'
                                                WHEN @IsTraceTab = 1 THEN 'ii.StuffID,' + @SelectColumns
                                           END
                         WHEN 'DL' THEN 'i.DeliverDlID'
                         WHEN 'StockDocumentType' THEN 'sdt.StockDocumentTypeID'
                    END
			
			
			
DECLARE @CreateTable NVARCHAR(MAX)
SELECT @CreateTable = STUFF(
           (
               SELECT DISTINCT ',' + QUOTENAME(TraceID) + '  NVARCHAR(max)'
               FROM   STF.Trace
               WHERE  CheckInventory = 1
                      FOR XML PATH(''), TYPE
           ).value('.', 'NVARCHAR(MAX)'),
           1,
           1,
           ''
       );

IF (@CreateTable IS NULL)
    SET @CreateTable = N'[-1]   varchar(max)';

SET @query = N'
		create table ' + @TraceTableName + N'
		(
		Type Varchar(50),
		Id INT,
		StuffID INT,
		' + @CreateTable + N'
		)
		'

EXEC (@query)

SET @query = N'
		create table ' + @tableName + N'
		(
		ID int,' + CASE 
           WHEN @IsTraceTab = 1 THEN @CreateTable + ','
           ELSE ''
      END + N'
		StockDocumentTypeID int,
		Entity nvarchar(100),		
		MainQuantity decimal(36,10),
		SubQuantity  decimal(36,10),
		Price   decimal(36,10)
		)
		'
		
		----print @query

EXECUTE sp_executesql @query


EXEC STC.GetStuffTraceFilterForReview @stuffTraceTableName = @stuffTraceTableName,
     @SelectedStuffTrace = @SelectedStuffTrace;   

SELECT @joinColumns = STUFF(
           (
               SELECT ' AND ISNULL(st.' + QUOTENAME(t.TraceID) + ', 0) = ISNULL(p.' + QUOTENAME(t.TraceID) + ', 0) '
               FROM   STF.Trace AS t
               WHERE  CheckInventory = 1
               ORDER BY
                      t.TraceID
                      FOR XML PATH('')
           ),
           1,
           0,
           ''
       );

IF @joinColumns IS NULL
    SET @joinColumns = N'AND 1 = 1';


		
			

SELECT a.PosInvoiceID,
       a.Date,
       a.StockID,
       IsReturnInvoice,
       a.CustomerID,
       a.FinancialPeriodID,
	   @PosInvoiceStockDocumentType StockDocumentTypeID
INTO   #FreePosInvoice
FROM   pos.PosInvoice a
WHERE  deliverd = 0
       AND a.date BETWEEN @FromDate AND @todate
       AND a.Status = 1


IF @SelectedStuffTrace IS NOT NULL
   OR @IsTraceTab = 1
BEGIN
    SET @query = N'insert into ' + @TraceTableName + 
        N' 
					   select ''StockReceipt'',p.* from
						(select iit.StockReceiptItemID,sri.StuffID,iit.TraceID,
									case when AccountLevelTypeID = 1 then cast (DLID as nvarchar(max))
											when AccountLevelTypeID = 6 then cast (TraceItemID as nvarchar(max))
											when AccountLevelTypeID = 5 then  CFG.GetCLRSaturnDate(value, ''YYYY/MM/DD'' ,0,0)
										else Value end value
						from STC.StockReceiptItemTrace iit
						join stf.trace t on t.traceid = iit.traceid
						join STC.StockReceiptItem sri	on sri.StockReceiptItemID = iit.StockReceiptItemID
						join STC.StockReceipt sr	on sri.StockReceiptID = sr.StockReceiptID
						JOIN [STC].[StockDocumentTypeBaseEntity] sdtb
							ON sr.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
						join #StockDocument sdt on sdtb.StockDocumentTypeID = sdt.StockDocumentTypeID
						INNER JOIN #vwStockAccess AS vsa ON vsa.StockID = sr.StockID
						join '+@stuffInfo+N' si on sri.Stuffid = si.StuffID 
						WHERE sr.date between @FromDate and @toDate
						and t.checkinventory = 1
						)x 
						pivot
						(
						max(value)
						for traceid in (' + @Columns + N')
						)p 
						LEFT JOIN ' + @stuffTraceTableName + N' AS st on st.StuffID = p.StuffID ' + @joinColumns + 
        '
						WHERE (@SelectedStuffTrace IS NULL OR st.StuffID is not null)
						'
    
    EXECUTE sp_executesql @query,
         N'@ToDate datetime,
         @FromDate datetime,
								@SelectedDl NVARCHAR(MAX),
								@SelectedStuff NVARCHAR(MAX),
								@SelectedStuffTrace NVARCHAR(MAX)',
         @ToDate = @ToDate,
         @FromDate = @FromDate,
         @SelectedDl = @SelectedDl,
         @SelectedStuff = @SelectedStuff,
         @SelectedStuffTrace = @SelectedStuffTrace
    

    
    SET @query = N'insert into ' + @TraceTableName + 
        N' 
					   select ''ReturnStockReceipt'',p.* from
						(select iit.ReturnStockReceiptItemID,rsri.StuffID,iit.TraceID,
											case when AccountLevelTypeID = 1 then  cast (DLID as nvarchar(max))
												 when AccountLevelTypeID = 6 then cast (TraceItemID as nvarchar(max))
											  when AccountLevelTypeID = 5 then  CFG.GetCLRSaturnDate(value, ''YYYY/MM/DD'' ,0,0)
											  else Value end value
						from STC.ReturnStockReceiptItemTrace iit
						join stf.trace t on t.traceid = iit.traceid
						join STC.ReturnStockReceiptItem rsri on rsri.ReturnStockReceiptItemID = iit.ReturnStockReceiptItemID
						join '+@stuffInfo+N' si on rsri.Stuffid = si.StuffID 
						join STC.ReturnStockReceipt rsr on rsri.ReturnStockReceiptID = rsr.ReturnStockReceiptID	
						JOIN [STC].[StockDocumentTypeBaseEntity] sdtb ON rsr.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID					
						join #StockDocument sdt on sdtb.StockDocumentTypeID = sdt.StockDocumentTypeID
						INNER JOIN #vwStockAccess AS vsa ON vsa.StockID = rsr.StockID
						where rsr.date between @FromDate and @todate
						and t.checkinventory = 1
						)x 
						pivot
						(
						max(value)
						for traceid in (' + @Columns + N')
						)p
						LEFT JOIN ' + @stuffTraceTableName + N' AS st on st.StuffID = p.StuffID ' + @joinColumns + 
        '
						where (@SelectedStuffTrace IS NULL OR st.StuffID is not null)'
    
    EXECUTE sp_executesql @query,
         N'@ToDate datetime,@FromDate datetime,
								@SelectedDl NVARCHAR(MAX),
								@SelectedStuff NVARCHAR(MAX),
								@SelectedStuffTrace NVARCHAR(MAX)',
         @ToDate = @ToDate,
         @FromDate = @FromDate,
         @SelectedDl = @SelectedDl,
         @SelectedStuff = @SelectedStuff,
         @SelectedStuffTrace = @SelectedStuffTrace
    
    
    SET @query = N'insert into ' + @TraceTableName + 
        N' 
					   select ''Outgoing'',p.* from
						(select iit.OutgoingItemID,oi.StuffID,iit.TraceID,
											case when AccountLevelTypeID = 1 then  cast (DLID as nvarchar(max))
												 when AccountLevelTypeID = 6 then cast (TraceItemID as nvarchar(max))
												 when AccountLevelTypeID = 5 then  CFG.GetCLRSaturnDate(value, ''YYYY/MM/DD'' ,0,0)
											  else Value end value
						from STC.OutgoingItemTrace iit
						join stf.trace t on t.traceid = iit.traceid
						join STC.OutgoingItem oi on oi.OutgoingItemID = iit.OutgoingItemID
						join '+@stuffInfo+N' si on oi.Stuffid = si.StuffID 
						join STC.Outgoing o on oi.OutgoingID = o.OutgoingID
						JOIN [STC].[StockDocumentTypeBaseEntity] sdtb 
							ON o.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
						join #StockDocument sdt on sdtb.StockDocumentTypeID = sdt.StockDocumentTypeID
						INNER JOIN #vwStockAccess AS vsa ON vsa.StockID = o.StockID
						where o.date between @FromDate and @todate
						AND (@SelectedStuff IS NULL OR oi.StuffID IN (' + ISNULL(@SelectedStuff, 0) + 
        N'))
						and t.checkinventory = 1
						)x 
						pivot
						(
						max(value)
						for traceid in (' + @Columns + N')
						)p
						LEFT JOIN ' + @stuffTraceTableName + N' AS st on st.StuffID = p.StuffID ' + @joinColumns + 
        '
						where (@SelectedStuffTrace IS NULL OR st.StuffID is not null) '
    
    EXECUTE sp_executesql @query,
         N'@ToDate datetime,@FromDate datetime,
								@SelectedDl NVARCHAR(MAX),
								@SelectedStuff NVARCHAR(MAX),
								@SelectedStuffTrace NVARCHAR(MAX)',
         @ToDate = @ToDate,
         @FromDate = @FromDate,
         @SelectedDl = @SelectedDl,
         @SelectedStuff = @SelectedStuff,
         @SelectedStuffTrace = @SelectedStuffTrace
    
    
  --print sysdatetime()
  --print 6.5
    
    SET @query = N'insert into ' + @TraceTableName + 
        N' 
					   select ''ReturnedOutgoing'',p.* from
						(select iit.ReturnedOutgoingItemID,roi.StuffID,iit.TraceID,
											case when AccountLevelTypeID = 1 then  cast (DLID as nvarchar(max))
												 when AccountLevelTypeID = 6 then cast (TraceItemID as nvarchar(max))
											  when AccountLevelTypeID = 5 then  CFG.GetCLRSaturnDate(value, ''YYYY/MM/DD'' ,0,0)
											  else Value end value
						from STC.ReturnedOutgoingItemTrace iit
						join stf.trace t on t.traceid = iit.traceid
						join STC.ReturnedOutgoingItem roi on roi.ReturnedOutgoingItemID = iit.ReturnedOutgoingItemID
						join '+@stuffInfo+N' si on roi.Stuffid = si.StuffID 						
						join STC.ReturnedOutgoing ro on roi.ReturnedOutgoingID = ro.ReturnedOutgoingID
						join #StockDocument sdt on ro.StockDocumentTypeID = sdt.StockDocumentTypeID
						INNER JOIN #vwStockAccess AS vsa ON vsa.StockID = ro.StockID
						where ro.date between @FromDate and @todate
						AND (@SelectedStuff IS NULL OR roi.StuffID IN (' + ISNULL(@SelectedStuff, 0) + 
        N'))
						and t.checkinventory = 1
						)x 
						pivot
						(
						max(value)
						for traceid in (' + @Columns + N')
						)p
						LEFT JOIN ' + @stuffTraceTableName + N' AS st on st.StuffID = p.StuffID ' + @joinColumns + 
        '
						where (@SelectedStuffTrace IS NULL OR st.StuffID is not null) '
    
    EXECUTE sp_executesql @query,
         N'@ToDate datetime,@FromDate datetime,
								@SelectedDl NVARCHAR(MAX),
								@SelectedStuff NVARCHAR(MAX),
								@SelectedStuffTrace NVARCHAR(MAX)',
         @ToDate = @ToDate,
         @FromDate = @FromDate,
         @SelectedDl = @SelectedDl,
         @SelectedStuff = @SelectedStuff,
         @SelectedStuffTrace = @SelectedStuffTrace
         

    
    SET @query = N'insert into ' + @TraceTableName + 
        N' 
					   select ''PosInvoice'',p.* from
						(SELECT iit.PosInvoiceItemID,pii.StuffID ,
								iit.TraceID , 
								case when AccountLevelTypeID = 1 then  cast (DLID as nvarchar(max))
										when AccountLevelTypeID = 6 then cast (TraceItemID as nvarchar(max))
										WHEN AccountLevelTypeID = 5 THEN CFG.GetCLRSaturnDate(value, ''YYYY/MM/DD'' ,0,0)
										ELSE Value
								END value
						FROM    POS.PosInvoiceItemTrace iit
						join POS.PosInvoiceItem pii on pii.PosInvoiceItemid = iit.PosInvoiceItemid
						join '+@stuffInfo+N' si on pii.Stuffid = si.StuffID 
						JOIN STF.Trace t ON t.TraceID = iit.TraceID
						join #FreePosInvoice pi on pi.PosInvoiceID = pii.PosInvoiceID
						join #StockDocument sdt on @PosInvoiceStockDocumentType = sdt.StockDocumentTypeID
						INNER JOIN #vwStockAccess AS vsa ON vsa.StockID = pi.StockID
						WHERE (@SelectedStuff IS NULL OR pii.StuffID IN (' + ISNULL(@SelectedStuff, 0) + 
        N'))
						and t.checkinventory = 1
						)x 
						pivot
						(
						max(value)
						for traceid in (' + @Columns + N')
						)p
						LEFT JOIN ' + @stuffTraceTableName + N' AS st on st.StuffID = p.StuffID ' + @joinColumns + 
        '
						WHERE (@SelectedStuffTrace IS NULL OR st.StuffID is not null)'
    
    EXECUTE sp_executesql @query,
         N'@ToDate datetime,@FromDate datetime,
								@SelectedDl NVARCHAR(MAX),
								@SelectedStuff NVARCHAR(MAX),
								@SelectedStuffTrace NVARCHAR(MAX),
								@PosInvoiceStockDocumentType int',
         @ToDate = @ToDate,
         @FromDate = @FromDate,
         @SelectedDl = @SelectedDl,
         @SelectedStuff = @SelectedStuff,
         @SelectedStuffTrace = @SelectedStuffTrace,
         @PosInvoiceStockDocumentType = @PosInvoiceStockDocumentType
         
 
END
		
----print sysdatetime()
----print 2	

SELECT ri.StockReceiptItemID,
       ri.ReturnStockReceiptItemID,
       ri.OutgoingItemID,
       ri.ReturnedOutgoingItemID,
       SUM(Deference)                     RevisionPrice
INTO   #RevisionCost
FROM   STC.RevisionCost h
       JOIN STC.RevisionCostItem ri
            ON  h.RevisionCostID = ri.RevisionCostID
WHERE  h.[Date] BETWEEN @FromDate AND     @ToDate
GROUP BY
       ri.StockReceiptItemID,
       ri.ReturnStockReceiptItemID,
       ri.OutgoingItemID,
       ri.ReturnedOutgoingItemID
		

	----print sysdatetime()
----print 3


SET @query = N'insert into ' + @TableName + N' 
				SELECT     ' + @GroupByField + 
    N',
		sdt.StockDocumentTypeID,
		''StockReceipt'' Entity,
			sum(ii.MainQuantity) AS MainQuantity ,
			sum(ii.SubQuantity ) AS SubQuantity ,
			sum(ii.NetPrice + isnull(Revision.RevisionPrice,0) ) AS Price 
					
			FROM      STC.StockReceipt i
			INNER JOIN STC.StockReceiptItem ii ON i.StockReceiptID = ii.StockReceiptID
			INNER JOIN ' + @stuffInfo + N' si on si.StuffID = ii.StuffID' +
    CASE 
         WHEN @SelectedStuffTrace IS NOT NULL OR @IsTraceTab = 1 THEN N'
					left	JOIN ' + @TraceTableName + N' p on p.ID = ii.StockReceiptItemID and p.Type = ''StockReceipt'''
         ELSE N''
    END + 
    N'
						LEFT JOIN #RevisionCost Revision on Revision.StockReceiptItemID = ii.StockReceiptItemID
						INNER JOIN #vwStockAccess AS vsa ON vsa.StockID = i.StockID
						JOIN [STC].[StockDocumentTypeBaseEntity] sdtb ON i.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
						join #StockDocument sdt on sdtb.StockDocumentTypeID = sdt.StockDocumentTypeID
						left join #SelectedDl sd on i.DeliverDlID = sd.DlID
						WHERE i.date between @FromDate and @todate
						AND (@SelectedDl IS NULL OR i.DeliverDlID IN (' + ISNULL(@SelectedDl, 0) + 
    N'))
				group by sdt.StockDocumentTypeID, ' + @GroupByField + '
						'

					
EXECUTE sp_executesql @query,
     N'@FromDate datetime,
								@ToDate datetime,
								@SelectedDl NVARCHAR(MAX)',
     @FromDate = @FromDate,
     @ToDate = @ToDate,
     @SelectedDl = @SelectedDl
								
								
	----print sysdatetime()
----print 4							
						
						
SET @query = N'insert into ' + @TableName + N' 
				SELECT     ' + @GroupByField + 
    N',
				sdt.StockDocumentTypeID,				
				''ReturnStockReceipt'' Entity,
					-sum(ii.MainQuantity) AS MainQuantity ,
					-sum(ii.SubQuantity ) AS SubQuantity ,
					-sum(ii.Price + isnull(Revision.RevisionPrice,0) ) AS Price 
					
					  FROM      STC.ReturnStockReceipt i
						INNER JOIN STC.ReturnStockReceiptItem ii ON i.ReturnStockReceiptID = ii.ReturnStockReceiptID
						INNER JOIN ' + @stuffInfo + N' si on si.StuffID = ii.StuffID' +
    CASE 
         WHEN @SelectedStuffTrace IS NOT NULL OR @IsTraceTab = 1 THEN N'
					left	JOIN ' + @TraceTableName + N' p on p.ID = ii.ReturnStockReceiptItemID and p.Type = ''ReturnStockReceipt'''
         ELSE N''
    END + 
    N'
						LEFT JOIN #RevisionCost Revision on Revision.ReturnStockReceiptItemID = ii.ReturnStockReceiptItemID
						INNER JOIN #vwStockAccess AS vsa ON vsa.StockID = i.StockID
						JOIN [STC].[StockDocumentTypeBaseEntity] sdtb ON i.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
						join #StockDocument sdt on sdtb.StockDocumentTypeID = sdt.StockDocumentTypeID
						left join #SelectedDl sd on i.DeliverDlID = sd.DlID
						WHERE i.date between @FromDate and @todate
						AND (@SelectedDl IS NULL OR i.DeliverDlID IN (' + ISNULL(@SelectedDl, 0) + 
    N'))
				group by sdt.StockDocumentTypeID, ' + @GroupByField + '
						'

						----print @query
EXECUTE sp_executesql @query,
     N'@FromDate datetime,
								@ToDate datetime,
								@SelectedDl NVARCHAR(MAX)',
     @FromDate = @FromDate,
     @ToDate = @ToDate,
     @SelectedDl = @SelectedDl	
								
	----print sysdatetime()
----print 5											

						
SET @query = N'insert into ' + @TableName + N' 
				SELECT     ' + @GroupByField + 
    N',
				sdt.StockDocumentTypeID,				
				''Outgoing'' Entity,
					-sum(ii.MainQuantity) AS MainQuantity ,
					-sum(ii.SubQuantity ) AS SubQuantity ,
					-sum(ii.Price + isnull(Revision.RevisionPrice,0) ) AS Price 
					
					  FROM      STC.Outgoing i
						INNER JOIN STC.OutgoingItem ii ON i.OutgoingID = ii.OutgoingID
						INNER JOIN ' + @stuffInfo + N' si on si.StuffID = ii.StuffID' +
    CASE 
         WHEN @SelectedStuffTrace IS NOT NULL OR @IsTraceTab = 1 THEN N'
					left	JOIN ' + @TraceTableName + N' p on p.ID = ii.OutgoingItemID and p.Type = ''Outgoing'''
         ELSE N''
    END + 
    N'
						LEFT JOIN #RevisionCost Revision on Revision.OutgoingItemID = ii.OutgoingItemID
						INNER JOIN #vwStockAccess AS vsa ON vsa.StockID = i.StockID
						JOIN [STC].[StockDocumentTypeBaseEntity] sdtb 
							ON i.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
						join #StockDocument sdt on sdtb.StockDocumentTypeID = sdt.StockDocumentTypeID
						left join #SelectedDl sd on i.DeliverDlID = sd.DlID
						WHERE i.date between @FromDate and @todate
						AND (@SelectedDl IS NULL OR i.DeliverDlID IN (' + ISNULL(@SelectedDl, 0) + 
    N'))
				group by sdt.StockDocumentTypeID, ' + @GroupByField + '
						'

						----print @query
EXECUTE sp_executesql @query,
     N'@FromDate datetime,
								@ToDate datetime,
								@SelectedDl NVARCHAR(MAX)',
     @FromDate = @FromDate,
     @ToDate = @ToDate,
     @SelectedDl = @SelectedDl	
								
--print sysdatetime()
--print 6

if @Parameter = 'Dl'
	begin
	   	SET @GroupByField =  'i.DlDeliverID'  
	end


SET @query = N'insert into ' + @TableName + N' 
				SELECT     ' + @GroupByField + 
    N',
				sdtb.StockDocumentTypeID,				
				''ReturnedOutgoing'' Entity,
					sum(ii.MainQuantity) AS MainQuantity ,
					sum(ii.SubQuantity ) AS SubQuantity ,
					sum(ii.Price + isnull(Revision.RevisionPrice,0) ) AS Price 
					
					  FROM      STC.ReturnedOutgoing i
						INNER JOIN STC.ReturnedOutgoingItem ii ON i.ReturnedOutgoingID = ii.ReturnedOutgoingID
						INNER JOIN ' + @stuffInfo + N' si on si.StuffID = ii.StuffID' +
    CASE 
         WHEN @SelectedStuffTrace IS NOT NULL OR @IsTraceTab = 1 THEN N'
					left	JOIN ' + @TraceTableName + N' p on p.ID = ii.ReturnedOutgoingItemID and p.Type = ''ReturnedOutgoing'''
         ELSE N''
    END + 
    N'
						JOIN [STC].[StockDocumentTypeBaseEntity] sdtb 
							ON i.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
						LEFT JOIN #RevisionCost Revision on Revision.ReturnedOutgoingItemID = ii.ReturnedOutgoingItemID
						INNER JOIN #vwStockAccess AS vsa ON vsa.StockID = i.StockID
						join #StockDocument sdt on sdtb.StockDocumentTypeID = sdt.StockDocumentTypeID
						left join #SelectedDl sd on i.DlDeliverID = sd.DlID
						WHERE i.date between @FromDate and @todate
						AND (@SelectedDl IS NULL OR i.DlDeliverID IN (' + ISNULL(@SelectedDl, 0) + 
    N'))
				group by sdtb.StockDocumentTypeID, ' + @GroupByField + '
						'
						

						----print @query
EXECUTE sp_executesql @query,
     N'@FromDate datetime,
								@ToDate datetime,
								@SelectedDl NVARCHAR(MAX)',
     @FromDate = @FromDate,
     @ToDate = @ToDate,
     @SelectedDl = @SelectedDl	
								
--print 111
	if @Parameter = 'Dl'
	begin
	   	SET @GroupByField =  'prt.DlID'  
	end

								
SET @query = N'insert into ' + @TableName + N' 
				SELECT     ' + @GroupByField + 
    N',
				@PosInvoiceStockDocumentType,				
				''PosInvoice'' Entity,
					-sum(ii.MainQuantity) AS MainQuantity ,
					-sum(ii.SubQuantity ) AS SubQuantity ,
					0 AS Price 
					
					  FROM      #FreePosInvoice i
						INNER JOIN Pos.PosInvoiceItem ii ON i.PosInvoiceID = ii.PosInvoiceID
						INNER JOIN #StockDocument sdt on sdt.StockDocumentTypeID = @PosInvoiceStockDocumentType
						INNER JOIN ' + @stuffInfo + N' si on si.StuffID = ii.StuffID' +
    CASE 
         WHEN @SelectedStuffTrace IS NOT NULL OR @IsTraceTab = 1 THEN N'
					left	JOIN ' + @TraceTableName + N' p on p.ID = ii.PosInvoiceItemID and p.Type = ''PosInvoice'''
         ELSE N''
    END + 
    N'
						INNER JOIN #vwStockAccess AS vsa ON vsa.StockID = i.StockID
						left join cfg.party prt on i.CustomerID = prt.PartyID
						left join #SelectedDl sd on prt.DlID = sd.DlID
						WHERE i.date between @FromDate and @todate
						AND (@SelectedDl IS NULL OR prt.DlID IN (' + ISNULL(@SelectedDl, 0) + 
    N'))
				group by i.StockDocumentTypeID,  ' + @GroupByField + '
						'

EXECUTE sp_executesql @query,
     N'@FromDate datetime,
								@ToDate datetime,
								@SelectedDl NVARCHAR(MAX),
								@PosInvoiceStockDocumentType int',
     @FromDate = @FromDate,
     @ToDate = @ToDate,
     @SelectedDl = @SelectedDl,
     @PosInvoiceStockDocumentType = @PosInvoiceStockDocumentType	
								
	----print sysdatetime()

