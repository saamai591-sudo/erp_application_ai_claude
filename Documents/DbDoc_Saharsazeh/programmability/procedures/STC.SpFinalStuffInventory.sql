
CREATE   PROC [STC].SpFinalStuffInventory
(
    @ID AS NVARCHAR(MAX),
    @EntityName AS NVARCHAR(500),
    @Confirmed TINYINT = 1,
    @IsDeleteOperation BIT = 0,
    @HeaderIDs NVARCHAR(MAX) = Null,
    @ControlType TINYINT = 0,
    @RecountingInvetoryID INT = null,
    @InventoryEditionID INT = null,
    @ErrorTable NVARCHAR(MAX) = null
)
--WITH ENCRYPTION
AS
BEGIN
	IF @ErrorTable is NULL
	BEGIN
	    SET @ErrorTable = cfg.getTempTableName(1)
	END
	
	SET NOCOUNT ON
	
	CREATE TABLE #error
	(
		[Message]     NVARCHAR(MAX),
		IsDetail      BIT
	);
	
	EXEC (N'Create table '+@ErrorTable+N'(
		[Message]     NVARCHAR(MAX),
		IsDetail      BIT)')
	
	
	IF (@ID is NOT null AND @HeaderIDs is NOT null)
	   OR (@ID is null AND @HeaderIDs is null)
	BEGIN
	    INSERT INTO #error values(N'خطا در برنامه ', 0);
	    
	    EXEC (N'Insert into  ' + @ErrorTable + N' select [Message] ,IsDetail   from #Error')
	    EXEC (N'Select * from ' + @ErrorTable)			  
	    RETURN;
	END
	
	--According to Mr. Hassanzadeh, to control negative inventory, this code must be removed.
	--if @HeaderIDs is not null
	--begin
	--set @IsDeleteOperation = 1
	--end
	
	-- @ControlType
	-- 0 Quantity change
	-- 1 Amount change
	-- 2 ConterventionRecountingInventory
	-- 3 RemoveStockDocumentForPosDelivery
	
	--@Confirmed documentation
	--@Confirmed = 1 => not assinged
	--@Confirmed = 2 => confirmed
	--@Confirmed = 3 => not confirmed
	
	DECLARE @SourceTemp NVARCHAR(50) = CFG.getTempTableName(1);
	DECLARE @PricingTemp NVARCHAR(50) = CFG.getTempTableName(1);
	DECLARE @ReseveMustBeChecked TINYINT = 0;
	
	
	
	DECLARE @StockID                        AS INT,
	        @branchId                       INT,
	        @StockDocumentTypeID            INT,
	        @FinancialPeriodID              AS INT,
	        @Date                           AS DATE,
	        @MainQuantity                   AS DECIMAL(30, 4),
	        @SubQuantity                    AS DECIMAL(30, 4),
	        @NegativeInventoryMustBeChecked BIT = 0,
	        @Columns                        AS NVARCHAR(MAX),
	        @ColumnsForMessage              NVARCHAR(MAX),
	        @Query                          AS NVARCHAR(MAX),
	        @ParmDefinition                 NVARCHAR(MAX),
	        @ConditionalInnerJoin           VARCHAR(MAX),
	        @WhereClose                     VARCHAR(MAX),
	        @Message                        NVARCHAR(MAX),
	        @Error                          BIT = 0,
	        @HasReserve                     BIT = 0,	-----------0 Reserve not Controlled,1 ReserveMustControl,
	        @StartDateFinancialPeriodID     INT,
	        @NextDayOfDate                  DATE,
	        @TableName1                     NVARCHAR(MAX),
	        @TableName2                     NVARCHAR(MAX),
	        @InventoryToEndDateTable        NVARCHAR(MAX),
	        @SrcTable                       NVARCHAR(MAX),
	        @ColumnsForCreateTable          NVARCHAR(MAX),
	        @StockToFetchInventory          INT = Null,
	        @TemporaryTableName1            NVARCHAR(MAX),
	        @ActionsNegativeMustbeChecked BIT ;
	
	SET @TableName1 = CFG.getTempTableName(1);
	SET @TableName2 = CFG.getTempTableName(1);
	SET @InventoryToEndDateTable = CFG.getTempTableName(1);
	SET @SrcTable = CFG.getTempTableName(1);
	SET @TemporaryTableName1 = CFG.getTempTableName(1);
	
	SELECT @Columns = STUFF(
	           (
	               SELECT ',' + QUOTENAME(TraceID)
	               FROM   STF.Trace
	               WHERE  CheckInventory = 1
	               ORDER BY
	                      TraceID
	                      FOR XML PATH(''),
	                      TYPE
	           ).value('.', 'NVARCHAR(MAX)'),
	           1,
	           1,
	           ''
	       );
	
	IF (@Columns IS NULL)
	    SET @Columns = N'[-1]';
	IF (@Columns IS NULL)
	    SET @Columns = N'[-1]';		
	
	SELECT @ColumnsForMessage = STUFF(
	           (
	               SELECT ' +isnull(' + QUOTENAME(TraceID) + N','''')'
	               FROM   STF.Trace
	               WHERE  CheckInventory = 1
	               ORDER BY
	                      TraceID
	                      FOR XML PATH(''),
	                      TYPE
	           ).value('.', 'NVARCHAR(MAX)'),
	           1,
	           1,
	           ''
	       );
	
	IF (@ColumnsForMessage IS NULL)
	    SET @ColumnsForMessage = N'';		
	
	SELECT CAST(rfcst.value AS INT)     AS ItemId
	INTO   #ItemsIds
	FROM   CFG.R_FnCommaStr2Table(@ID)  AS rfcst;
	
	SELECT CAST(rfcst.value AS INT) AS HeaderId
	INTO   #HeadersIds
	FROM   CFG.R_FnCommaStr2Table(@HeaderIDs) AS rfcst;
	
	SELECT @StartDateFinancialPeriodID = fp.FinancialPeriodID
	FROM   cfg.FinancialPeriod AS fp
	WHERE  @Date BETWEEN fp.StartDate AND fp.EndDate
	
	-- Check IF HasReserve is Checked
	
	IF EXISTS
	   (
	       SELECT 1
	       FROM   CFG.[Configuration] AS c
	       WHERE  c.ConfigKey = 'ReservedStoreIsControlable'
	              AND c.ConfigValue = 'true'
	   )
	BEGIN
	    SET @HasReserve = 1
	END
	
	IF EXISTS (
	       SELECT 1
	       FROM   CFG.[Configuration] AS c
	       WHERE  c.ConfigKey = 'ReservedStoreIsControlable'
	              AND c.ConfigValue = 'false'
	   )
	   AND EXISTS
	       (
	           SELECT 1
	           FROM   CFG.[Configuration] AS c
	           WHERE  c.ConfigKey = 'ConsumeReservedStoreIsControlable'
	                  AND c.ConfigValue = 'true'
	       )
	BEGIN
	    SET @HasReserve = 2
	END
	
	
	
	
	BEGIN
		IF (@EntityName = 'OutgoingItem' OR @EntityName = 'Outgoing')
		BEGIN
		    SET @Query = 
		        N'select ROW_NUMBER() OVER(ORDER BY [DATE] DESC) AS Row,oi.OutgoingItemID ParentId,StuffID,StockID,[DATE],
							   FinancialPeriodID,-MainQuantity MainQuantity,-SubQuantity SubQuantity,p.*,sdtb.StockDocumentTypeID
						into ' + @SourceTemp
		        +
		        N'
						from stc.Outgoing o 
						JOIN [STC].[StockDocumentTypeBaseEntity] sdtb 
							ON o.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
						INNER JOIN stc.OutgoingItem oi on o.OutgoingID = oi.OutgoingID
											LEFT JOIN(select OutgoingItemID,TraceID,
												Case 
													When DLID IS NOT NULL THEN cast (DLID as nvarchar(max)) 
													When TraceItemID IS NOT NULL THEN cast (TraceItemID as nvarchar(max)) 
													else Value 
												end Value
													  from stc.OutgoingItemTrace ) x
											pivot 
											(
												 max(Value)
												for TraceID in ( ' + @Columns
		        + N')
											) p on oi.OutgoingItemID = p.OutgoingItemID' + CASE 
		        	                                                    WHEN @ID is NOT null THEN 
		        	                                                         N'
										 JOIN #ItemsIds e on oi.OutgoingItemID = e.ItemId'
		        	                                                    ELSE 
		        	                                                         N'
										 join #HeadersIds h on h.headerid = o.outgoingid'
		        	                                               END;
		END;
		ELSE
	
	IF (
	       @EntityName = 'ReturnStockReceiptItem'
	       OR @EntityName = 'ReturnStockReceipt'
	   )
	BEGIN
	    SET @Query = 
	        N'
						select ROW_NUMBER() OVER(ORDER BY [DATE] DESC) AS Row,oi.ReturnStockReceiptItemID ParentId,StuffID,StockID,[DATE],
							   FinancialPeriodID,-MainQuantity MainQuantity,-SubQuantity SubQuantity,p.*,sdtb.StockDocumentTypeID
						into ' + @SourceTemp
	        +
	        N'
						from stc.ReturnStockReceipt o 
						JOIN [STC].[StockDocumentTypeBaseEntity] sdtb ON o.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
						INNER JOIN stc.ReturnStockReceiptItem oi on o.ReturnStockReceiptID = oi.ReturnStockReceiptID
						LEFT JOIN(select ReturnStockReceiptItemID,TraceID,
								Case 
									When DLID IS NOT NULL THEN cast (DLID as nvarchar(max)) 
									When TraceItemID IS NOT NULL THEN cast (TraceItemID as nvarchar(max))
								else Value end Value
													  from stc.ReturnStockReceiptItemTrace ) x
											pivot 
											(
												 max(Value)
												for TraceID in ( ' + @Columns
	        + N')
											) p  on oi.ReturnStockReceiptItemID = p.ReturnStockReceiptItemID' + CASE 
	        		                                                                         WHEN @ID is NOT null THEN 
	        		                                                                              N'
										JOIN #ItemsIds e on oi.ReturnStockReceiptItemID = e.ItemId	'
	        		                                                                         ELSE 
	        		                                                                              '
										join #HeadersIds h on h.headerid = o.ReturnStockReceiptid'
	        		                                                                    END;
	END;
	ELSE

IF (
       @EntityName = 'ReturnedOutgoingItem'
       OR @EntityName = 'ReturnedOutgoing'
   )
BEGIN
    SET @Query = 
        N'
						select ROW_NUMBER() OVER(ORDER BY [DATE] DESC) AS Row,oi.ReturnedOutgoingItemID ParentID,StuffID,StockID,[DATE],
							   FinancialPeriodID,MainQuantity,SubQuantity,p.*,sdtb.StockDocumentTypeID
						into ' + @SourceTemp
        +
        N'
						from stc.ReturnedOutgoing o 
						JOIN [STC].[StockDocumentTypeBaseEntity] sdtb ON o.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
						INNER JOIN stc.ReturnedOutgoingItem oi on o.ReturnedOutgoingID = oi.ReturnedOutgoingID
						LEFT JOIN(select ReturnedOutgoingItemID,TraceID,Case When DLID IS NOT NULL THEN cast (DLID as nvarchar(max))
													When TraceItemID IS NOT NULL THEN cast (TraceItemID as nvarchar(max))
											else Value end Value
													  from stc.ReturnedOutgoingItemTrace ) x
											pivot 
											(
												 max(Value)
												for TraceID in ( ' + @Columns
        + N')
											) p  on oi.ReturnedOutgoingItemID = p.ReturnedOutgoingItemID'
        + CASE 
               WHEN @ID is NOT null THEN N' JOIN #ItemsIds e on oi.ReturnedOutgoingItemID = e.ItemId '
               ELSE ' join #HeadersIds h on h.headerid = o.ReturnedOutgoingid'
          END;
END;
		ELSE 
IF (
       @EntityName = 'StockReceiptItem'
       OR @EntityName = 'StockReceipt'
   )
BEGIN
    SET @Query = 
        N'
						select ROW_NUMBER() OVER(ORDER BY [DATE] DESC) AS Row,
							   oi.StockReceiptItemID ParentID,
							   StuffID,
							   StockID,
							   [Date],
							   FinancialPeriodID,
							   MainQuantity,
							   SubQuantity,
							   p.*,
							   sdtb.StockDocumentTypeID
						into ' + @SourceTemp
        +
        N'
						from stc.StockReceipt o 
						JOIN [STC].[StockDocumentTypeBaseEntity] sdtb
							ON o.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
						INNER JOIN stc.StockReceiptItem oi on o.StockReceiptID = oi.StockReceiptID
						LEFT JOIN(select StockReceiptItemID,TraceID,Case When DLID IS NOT NULL THEN cast (DLID as nvarchar(max))
													When TraceItemID IS NOT NULL THEN cast (TraceItemID as nvarchar(max))
											 else Value end Value
													  from stc.StockReceiptItemTrace ) x
											pivot 
											(
												 max(Value)
												for TraceID in ( ' + @Columns
        + N')
											) p on oi.StockReceiptItemID = p.StockReceiptItemID' + CASE 
        			                                                            WHEN @ID is NOT null THEN 
        			                                                                 N' JOIN #ItemsIds e on oi.StockReceiptItemID = e.ItemId'
        			                                                            ELSE 
        			                                                                 N'
										 join #HeadersIds h on h.headerid = o.StockReceiptID '
        			                                                       END;
END;
		ELSE 
IF (@EntityName = 'PosInvoice')
BEGIN
    SET @Query = 
        N'SELECT ROW_NUMBER() OVER ( ORDER BY [Date] DESC ) AS Row ,
							oi.PosInvoiceItemID ParentID ,
							StuffID ,
							StockID ,
							[Date] ,
							FinancialPeriodID ,
							case when o.IsReturnInvoice = 1 then oi.MainQuantity else -oi.MainQuantity End MainQuantity ,
							case when o.IsReturnInvoice = 1 then oi.SubQuantity else -oi.SubQuantity End SubQuantity ,
							p.* ,
							null AS StockDocumentTypeID 
					INTO    ' + @SourceTemp
        +
        N'
					FROM    POS.PosInvoice o
							INNER JOIN POS.PosInvoiceItem oi ON oi.PosInvoiceID = o.PosInvoiceID
							LEFT JOIN ( SELECT
											PosInvoiceItemID ,
											TraceID ,
											CASE
												WHEN DlID IS NOT NULL THEN CAST (DlID AS NVARCHAR(MAX))
												WHEN TraceItemID IS NOT NULL THEN CAST (TraceItemID AS NVARCHAR(MAX))
												ELSE Value
											END Value
										FROM POS.PosInvoiceItemTrace
										) x PIVOT ( MAX(Value) FOR TraceID IN ( ' + @Columns
        + N' ) ) p ON p.PosInvoiceItemID = oi.PosInvoiceItemID' + CASE 
                                                                       WHEN @ID is NOT null THEN 
                                                                            N' JOIN #ItemsIds e on oi.PosInvoiceItemID = e.ItemId'
                                                                       ELSE 
                                                                            N'
				  join #HeadersIds h on h.headerid = o.PosInvoiceID '
                                                                  END;
END;
	
EXECUTE (@Query);
		
DECLARE @stuffIds NVARCHAR(MAX);

SET @Query = N'
			SELECT @stuffIds = STUFF(
			(
				SELECT '','' + CAST(StuffID AS NVARCHAR(10))
				FROM ' + @SourceTemp
    + N'
				FOR XML PATH(''''), TYPE
			).value(''.'', ''NVARCHAR(MAX)''),
			1   ,
			1   ,
			'''')
			';
		
EXEC sp_executesql @Query,
     N'@stuffIds NVARCHAR(MAX) OUT',
     @stuffIds = @stuffIds OUTPUT;

CREATE TABLE #vwStuff
(
	stuffid     INT,
	Title       NVARCHAR(MAX),
	Code        NVARCHAR(256)
)

SET @Query = 
    N'SELECT TOP 1
							   @StockID = t.StockID,
							   @Date = t.[DATE],
							   @FinancialPeriodID = t.FinancialPeriodID,
							   @StockDocumentTypeID = t.StockDocumentTypeID,
							   @branchId = s.BranchID
						FROM ' + @SourceTemp + N' AS t
							JOIN STF.Stock AS s
								ON s.StockID = t.StockID';

EXEC sp_executesql @Query,
     N'@StockID				INT OUT, 
							 @Date					DATE OUT, 
							 @FinancialPeriodID		INT OUT,
							 @StockDocumentTypeID	INT OUT,
							 @branchId				INT OUT ',
     @StockID = @StockID OUTPUT,
     @Date = @Date OUTPUT,
     @FinancialPeriodID = @FinancialPeriodID OUTPUT,
     @StockDocumentTypeID = @StockDocumentTypeID OUTPUT,
     @branchId = @branchId OUTPUT;

	END
SET @Query = N'insert  into #vwStuff select stuffid,Title,Code
		from stf.vwstuff where stuffid in (' + @stuffIds + N')'

EXEC (@Query)
--- CheckPursuiteGroup
BEGIN
	IF EXISTS(
	       SELECT 1
	       FROM   stf.PursuitGroup AS pg
	   )
	BEGIN
	    CREATE TABLE #vwStuffStock_ForPursuiteGroup
	    (
	    	StuffID     INT,
	    	StockID     INT
	    )
	    
	    SET @Query = 
	        N'
		Insert into #vwStuffStock_ForPursuiteGroup
		select StuffID,StockID
		 FROM stf.vwStuffStock_ForPursuiteGroup AS vssfpg'
	    
	    EXEC (@Query)
	    
	    
	    
	    
	    SET @Query = 
	        N'
		INSERT INTO #error ([Message], IsDetail)
		SELECT DISTINCT
		       REPLACE(s.Title, ''%'', ''''),
		       1
		FROM #vwStuff AS s
		     JOIN ' + @SourceTemp +
	        N' pt
		          ON s.StuffID = pt.StuffID
		     LEFT JOIN #vwStuffStock_ForPursuiteGroup vfpg
		          ON s.StuffID = vfpg.StuffID
		         AND pt.StockID = ISNULL(vfpg.StockID, ' + CAST(@StockID AS NVARCHAR(20)) +
	        N')
		WHERE vfpg.StuffID IS NULL;
		';
	    
	    EXEC sp_executesql @Query;
	    
	    IF EXISTS (
	           SELECT 1
	           FROM   #error
	       )
	    BEGIN
	        INSERT INTO #error values('InvalidStockForPursuiteGroup', 0);
	        
	        EXEC (N'Insert into  ' + @ErrorTable + N' select [Message] ,IsDetail   from #Error')
	        EXEC (N'Select * from ' + @ErrorTable)
	        RETURN;
	    END;
	END
END
	--------Control IF Stock Has Been Closed
IF @ControlType IN (0, 3)
   AND EXISTS (
           SELECT *
           FROM   stc.StockClosePeriod
           WHERE  StockID = @StockID
                  AND DATE >= @Date
                  AND @RecountingInvetoryID is null
                  AND @InventoryEditionID is null
       )
BEGIN
    INSERT INTO #error values('به دلیل بسته بودن انبار انجام این عملیات مجاز نیست.', 0);
    
     EXEC (N'Insert into  ' + @ErrorTable + N' select [Message] ,IsDetail   from #Error')
    EXEC (N'Select * from ' + @ErrorTable)
    RETURN;
END;

--------Price Change or Stock Reconciliation Control In case of Stock has been Closed
IF (@ControlType = 1 OR @ControlType = 2)
BEGIN
    DECLARE @StockClosingStatus TINYINT;
    SELECT @StockClosingStatus = sco.[Status]
    FROM   STC.StockClosingOperation sco
    WHERE  sco.StockID = @StockID
           AND sco.FinancialPeriodID = @FinancialPeriodID;
    
    IF @StockClosingStatus = 2
    BEGIN
        INSERT INTO #error values('STC_SpFinalStuffInventory_2', 0);
        
        EXEC (N'select * into ' + @ErrorTable + N' from #Error')
        EXEC (N'Select * from ' + @ErrorTable)
        RETURN;
    END;
    
    IF @StockClosingStatus = 1
       AND @ControlType = 2
    BEGIN
        INSERT INTO #error values('STC_SpFinalStuffInventory_1', 0);
        
       EXEC (N'Insert into  ' + @ErrorTable + N' select [Message] ,IsDetail   from #Error')
        EXEC (N'Select * from ' + @ErrorTable)
        RETURN;
    END;
END;

	--------------- Check Whether This Record Have Pricing Or Not
IF @ControlType = 1
BEGIN
    SELECT @ConditionalInnerJoin = 'inner join ' + @SourceTemp
           +
           ' source on source.stuffid = pi.stuffid 
										AND (pi.StockID is null or source.StockID = pi.StockID)
										AND pi.LastPricingDate >= source.[DATE]'
           + STUFF(
               (
                   SELECT ' AND (source.' + QUOTENAME(TraceID) + ' is null or piv.' + QUOTENAME(TraceID) + '= source.'
                          + QUOTENAME(TraceID) + ')'
                   FROM   STF.Trace
                   WHERE  CheckInventory = 1
                          AND PricingBase = 1
                   ORDER BY
                          TraceID
                          FOR XML PATH(''),
                          TYPE
               ).value('.', 'NVARCHAR(MAX)'),
               1,
               1,
               ''
           );
    
    IF (@ConditionalInnerJoin IS NULL)
        SET @ConditionalInnerJoin = 'inner join ' + @SourceTemp
            +
            ' source on source.stuffid = pi.stuffid 
										AND (pi.StockID is null or source.StockID = pi.StockID)
										AND pi.LastPricingDate >= source.[DATE]';
    
    SET @Query = N'SELECT  pi.PricingItemID,
						pi.StuffID
						into ' + @PricingTemp
        +
        N'
						 from stc.PricingItem pi 
						left join 
						(select PricingItemID,TraceID,Case When DLID IS NOT NULL THEN cast (DLID as nvarchar(max)) 
													When TraceItemID IS NOT NULL THEN cast (TraceItemID as nvarchar(max))
													else Value end Value
						from stc.PricingItemTrace )x
							pivot
							( max(Value)
								for TraceID in ( ' + @Columns
        + N')
							) piv on piv.PricingItemID = pi.PricingItemID
											
							  ' + @ConditionalInnerJoin;
    
    EXECUTE sp_executesql @Query;
    
    DECLARE @hasPricing BIT = 0;
    
    SET @Query = N'IF EXISTS(SELECT PricingItemID FROM ' + @PricingTemp + N') SET @hasPricing = 1';
    
    EXEC sp_executesql @Query,
         N'@hasPricing BIT OUT',
         @hasPricing = @hasPricing OUTPUT;
    
    IF @hasPricing = 1
    BEGIN
        SET @Query = 
            N'
			INSERT INTO #error ([Message], IsDetail)
			SELECT DISTINCT
				   REPLACE(s.Title, ''%'', '''') AS [Message],
				   1 AS IsDetail
			FROM #vwStuff AS s
				 JOIN ' + @PricingTemp + N' pt
					  ON s.StuffID = pt.StuffID;
			';
        
        EXEC sp_executesql @Query;
        
        IF EXISTS (
               SELECT 1
               FROM   #error
           )
        BEGIN
            INSERT INTO #error values('STC_SpClearFinalStuffInventoryFromDeletedEntity_1', 0);
            
            EXEC (N'Insert into  ' + @ErrorTable + N' select [Message] ,IsDetail   from #Error')
            EXEC (N'Select * from ' + @ErrorTable)
            RETURN;
        END;
    END;
END;

	--------------- Check Whether This Record Have Recounting Or Not
IF @ControlType IN (0, 2, 3)
BEGIN
    DECLARE @recontingInv TABLE
    (
    	RecountingInventoryTagID INT NOT NULL,
    	StuffID INT NOT NULL
    );
    
    SET @Query = 
        N'
		SELECT	a.RecountingInventoryTagID,
				a.StuffID
		FROM
		(
			SELECT t.RecountingInventoryTagID,
				   ti.StuffID
			FROM STC.RecountingInventoryTag t
				JOIN STC.RecountingInventoryTagItem ti
					ON ti.RecountingInventoryTagID = t.RecountingInventoryTagID
				JOIN STC.RecountingInventoryPeriod rip
					ON t.RecountingInventoryPeriodID = rip.RecountingInventoryPeriodID
				JOIN ' + @SourceTemp
        +
        N' AS st
					ON st.StuffID = ti.StuffID
					   AND st.FinancialPeriodID = rip.FinancialPeriodID
					   AND rip.StockID = st.StockID
					   AND rip.[Date] >= st.[Date]
			WHERE t.Status = 1
			UNION ALL
			SELECT a.InventoryEditionID,
				   st.StuffID
			FROM STC.InventoryEdition a
				JOIN STC.InventoryEditionItem b
					ON a.InventoryEditionID = b.InventoryEditionID
				JOIN ' + @SourceTemp
        +
        N' AS st
					ON st.StuffID = b.StuffID
					   AND st.FinancialPeriodID = a.FinancialPeriodID
					   AND a.StockID = st.StockID
					   AND a.[Date] >= st.[Date]
			WHERE a.Status = 1
			and (' + CAST(@InventoryEditionID as NVARCHAR(250)) + N' is null or a.InventoryEditionID <> ' + CAST(@InventoryEditionID as NVARCHAR(250))
        + N')
		) A;
		';
    
    INSERT INTO @recontingInv
    EXEC (@Query);
    
    IF EXISTS
       (
           SELECT RecountingInventoryTagID
           FROM   @recontingInv
       )
    BEGIN
        INSERT INTO #error([Message], IsDetail)
        SELECT DISTINCT
               N'# ' + REPLACE(s.Title, '%', '') AS [Message],
               0                   AS IsDetail
        FROM   #VWStuff s
               JOIN @recontingInv  AS pt
                    ON  s.StuffID = pt.StuffID;
        
        IF EXISTS (
               SELECT 1
               FROM   #error
           )
        BEGIN
            INSERT INTO #error values('Messages.ThereIsRecountingInventory', 0);
            
             EXEC (N'Insert into  ' + @ErrorTable + N' select [Message] ,IsDetail   from #Error')
            EXEC (N'Select * from ' + @ErrorTable)
            RETURN;
        END;
    END
END

   --------Check Negative 
IF EXISTS (
       SELECT NegativeInventoryChecking
       FROM   STF.Stock AS s
       WHERE  s.StockID = @StockID
              AND s.NegativeInventoryChecking = 1
   )
    SET @NegativeInventoryMustBeChecked = 1;

IF @NegativeInventoryMustBeChecked = 1
   AND (
           (@EntityName = 'StockReceipt' AND @IsDeleteOperation = 1)
           OR (@EntityName = 'StockReceiptItem')
           OR (@EntityName = 'Outgoing' AND @IsDeleteOperation = 0)
           OR (@EntityName = 'OutgoingItem' AND @IsDeleteOperation = 0)
           OR (
                  @EntityName = 'ReturnStockReceipt'
                  AND @IsDeleteOperation = 0
              )
           OR (
                  @EntityName = 'ReturnStockReceiptItem'
                  AND @IsDeleteOperation = 0
              )
           OR (
                  @EntityName = 'ReturnedOutgoing'
                  AND @IsDeleteOperation = 1
              )
           OR (
                  @EntityName = 'ReturnedOutgoingItem'
                  AND @IsDeleteOperation = 1
              )
           OR (@EntityName = 'PosInvoice')
       )
BEGIN
    SET @ActionsNegativeMustbeChecked = 1
END

IF @HasReserve = 1
   AND (
           (@EntityName = 'StockReceipt' AND @IsDeleteOperation = 1)
           OR (
                  @EntityName = 'StockReceiptItem'
                  AND @IsDeleteOperation = 1
              )
           OR (@EntityName = 'Outgoing' AND @IsDeleteOperation = 0)
           OR (@EntityName = 'OutgoingItem' AND @IsDeleteOperation = 0)
           OR (
                  @EntityName = 'ReturnStockReceipt'
                  AND @IsDeleteOperation = 0
              )
           OR (
                  @EntityName = 'ReturnStockReceiptItem'
                  AND @IsDeleteOperation = 0
              )
           OR (
                  @EntityName = 'ReturnedOutgoing'
                  AND @IsDeleteOperation = 1
              )
           OR (
                  @EntityName = 'ReturnedOutgoingItem'
                  AND @IsDeleteOperation = 1
              )
           OR (@EntityName = 'PosInvoice')
       )
BEGIN
    SET @ReseveMustBeChecked = 1
END
	
IF @HasReserve = 2
   AND @EntityName IN ('Outgoing', 'OutgoingItem')
   AND @IsDeleteOperation = 0
BEGIN
    SET @ReseveMustBeChecked = 1
END
	


IF @ControlType IN (0, 2)
   AND (
           @ActionsNegativeMustbeChecked = 1
           OR @ReseveMustBeChecked = 1
       )
BEGIN
    SELECT @ColumnsForCreateTable = STUFF(
               (
                   SELECT ',' + QUOTENAME(TraceID) + ' NVARCHAR(256)'
                   FROM   STF.Trace
                   WHERE  CheckInventory = 1
                   ORDER BY
                          TraceID
                          FOR XML PATH(''),
                          TYPE
               ).value('.', 'NVARCHAR(MAX)'),
               1,
               1,
               ''
           );
    
    IF (@ColumnsForCreateTable IS NULL)
    BEGIN
        SET @ColumnsForCreateTable = N'[-1] NVARCHAR(256)';
    END
    
    SET @Query = N'create table ' + @TemporaryTableName1
        + N'
						(	
							StockID int,
							StuffID int,
							' + @ColumnsForCreateTable +
        N',
							MainTemporaryQuantity Decimal(30,4),
							SubTemporaryQuantity Decimal(30,4)
						) ';
    
    EXEC (@Query);
    
    IF @ReseveMustBeChecked = 1
    BEGIN
        SET @StockToFetchInventory = Null
    END
    ELSE
    BEGIN
        SET @StockToFetchInventory = @StockID
    END
    
    DECLARE @LastDate DATE
    SELECT @LastDate = MAX(DATE)
    FROM   (
               SELECT MAX(DATE) DATE
               FROM   stc.Outgoing
               WHERE  (StockID = @StockID OR @StockID is null)
               UNION all
               SELECT MAX(DATE) DATE
               FROM   stc.StockReceipt
               WHERE  (StockID = @StockID OR @StockID is null)
               UNION all 
               SELECT MAX(DATE) DATE
               FROM   stc.ReturnedOutgoing
               WHERE  (StockID = @StockID OR @StockID is null)
               UNION all
               SELECT MAX(DATE)
               FROM   stc.ReturnStockReceipt
               WHERE  (StockID = @StockID OR @StockID is null)
               UNION all 
               SELECT MAX(pi1.Date)
               FROM   pos.PosInvoice pi1
                      JOIN pos.StationShift ss
                           ON  pi1.StateShiftID = ss.StationID
                      JOIN pos.Station s
                           ON  ss.StationID = s.StationID
               WHERE  (s.StockID = @StockID OR @StockID is null)
           ) a
    
    IF @LastDate is null
    BEGIN
        SET @LastDate = @Date
    END
    
    
    
    
    EXEC stc.spGetInventoryInDate
         @StuffId = @stuffIds,
         @stockID = @StockToFetchInventory,
         @ToDate = @Date,
         @FinalTable = @TableName1
    
    SET @Query = N'select @Date Date,StockID,StuffID,' + @Columns +
        N',Sum(MainQuantity) MainQuantity,sum(SubQuantity) SubQuantity
			into ' + @SrcTable
        + N' from ' + @TableName1 + N' group by StuffID,StockID,' + @Columns
        
    
    EXEC sp_executesql @Query,
         N' @Date Date',
         @Date = @Date
    
    IF @LastDate > @Date
    BEGIN
        SET @NextDayOfDate = DATEADD(DAY, 1, @Date)
        
        EXEC [STC].RptReviewDataSource
             @ReviewType = 1,	---1 Quantity   -----2 Amount
             @FromDate = @NextDayOfDate,
             @ToDate = @LastDate,
             @TableName = @InventoryToEndDateTable,
             @SelectedStocks = @StockToFetchInventory,
             @SelectedDl = NULL,
             @SelectedStuffTrace = NULL,
             @SelectedStuffAccountGroup = NULL,
             @SelectedStuffGroup = NULL,
             @SelectedStuff = @stuffIds,
             @SelectedStockDocumentType = NULL,
             @IsTraceTab = 1,
             @Parameter = 'Stuff',
             @StartDateFinancialPeriodID = @StartDateFinancialPeriodID,
             @HasGroupByDate = 1
        
        SET @Query = N'insert into ' + @SrcTable + N' select Date,StockID,ID StuffID,' + @Columns +
            N' ,Sum(MainQuantity) MainQuantity,sum(SubQuantity) SubQuantity
						from ' + @InventoryToEndDateTable + N' group by Date, ID,StockID,' + @Columns
        
        EXEC sp_executesql @Query,
             N' @Date Date',
             @Date = @Date
    END
    
    DECLARE @joinCondition NVARCHAR(MAX);
    
    SELECT @joinCondition = STUFF(
               (
                   SELECT '  AND ISNULL(T.' + QUOTENAME(TraceID) + ',0)= ISNULL(s.' + QUOTENAME(TraceID) + ',0) '
                   FROM   STF.Trace
                   WHERE  CheckInventory = 1
                   ORDER BY
                          TraceID
                          FOR XML PATH(''),
                          TYPE
               ).value('.', 'NVARCHAR(MAX)'),
               1,
               1,
               ''
           );
    
    IF (@joinCondition IS NULL)
        SET @joinCondition = N'';
    
    IF @IsDeleteOperation = 1
    BEGIN
    	
    	
        SET @Query = 
            N'Update t
							set
								  MainQuantity = t.MainQuantity - s.MainQuantity,
								  SubQuantity = t.SubQuantity - s.SubQuantity 
							from ' + @SrcTable + N' as t' +
            N' join ' + @SourceTemp
            + N' s on s.StockID = t.StockID
							and s.StuffID = t.StuffID
							and s.Date = t.Date' + @joinCondition
        
        EXECUTE (@Query);
    END
    

    
    SET @Query = N'select Stockid,StuffID, Date,sum(MainQuantity) over(partition by StockID,StuffID,' + @Columns +
        N' order by Date) MainInLine,
		sum(SubQuantity) over(partition by StockID,StuffID,' + @Columns + N' order by Date) SubInLine,
		' + @Columns + N'  into ' + @TableName2 + N' from ' + @SrcTable
    
    EXEC (@Query)
    
    SET @Query = N'insert into ' + @TemporaryTableName1
        + N' exec [STC].[TemporarySummary] @stuffIds, @StockID';
    
    EXEC sp_executesql @Query,
         N'@stuffIds NVARCHAR(MAX), 
							@StockID INT',
         @stuffIds = @stuffIds,
         @StockID = @StockID;
    
    SELECT @Columns = STUFF(
               (
                   SELECT ',t.' + QUOTENAME(TraceID)
                   FROM   STF.Trace
                   WHERE  CheckInventory = 1
                   ORDER BY
                          TraceID
                          FOR XML PATH(''),
                          TYPE
               ).value('.', 'NVARCHAR(MAX)'),
               1,
               1,
               ''
           );
    
    IF (@Columns IS NULL)
        SET @Columns = N't.[-1]';
    
    -- NegativeInventoryMustBeChecked 
    IF @NegativeInventoryMustBeChecked = 1
       AND @ControlType <> 3
    BEGIN
        SET @Query = 
            N'
							INSERT INTO #error ([Message], IsDetail)
							SELECT DISTINCT
								    REPLACE(s.Code + ''-'' + s.Title + '' - '' + ' + CASE WHEN @ColumnsForMessage ='' then '''-1''' else @ColumnsForMessage end +
            N',
										''%'',
										''''
								   ) AS [Message],
								   1 AS IsDetail
							FROM ' + @TableName2 +
            N' AS r
								 JOIN #vwStuff s
									  ON r.StuffID = s.StuffID
							WHERE MainInLine < 0
							  AND StockID = @StockID;
							  ';
        
        SET @ParmDefinition = N'@StockID int';
        EXECUTE sp_executesql @Query,
             @ParmDefinition,
             @StockID = @StockID;
        
        IF EXISTS (
               SELECT 1
               FROM   #error
           )
        BEGIN
            INSERT INTO #error values('Messages.STC_SpFinalStuffInventory_3', 0);
            
             EXEC (N'Insert into  ' + @ErrorTable + N' select [Message] ,IsDetail   from #Error')
            EXEC (N'Select * from ' + @ErrorTable)
            RETURN;
        END;
        
        SET @Query = 
            N'
							INSERT INTO #error ([Message], IsDetail)
							SELECT DISTINCT
								   REPLACE(st.Title, ''%'', '''') AS [Message],
								   0 AS IsDetail
							FROM ' + @TableName2 + N' AS t
								 JOIN ' + @TemporaryTableName1 + N' s
									  ON s.StuffID = t.StuffID '
            + @joinCondition +
            N'
								 JOIN #vwStuff st
									  ON st.StuffID = t.StuffID
							WHERE	t.MainInLine < s.MainTemporaryQuantity
								OR	t.SubInLine < s.SubTemporaryQuantity
								AND t.StockID = @StockID;
							';
        
        EXECUTE sp_executesql @Query,
             N'@StockID int',
             @StockID = @StockID;			
        
        IF EXISTS (
               SELECT 1
               FROM   #error
           )
        BEGIN
            INSERT INTO #error values('SomeStuffsTemporarilyRemovedFromWarehouse', 1);
             EXEC (N'Insert into  ' + @ErrorTable + N' select [Message] ,IsDetail   from #Error')
            EXEC (N'Select * from ' + @ErrorTable)
            
            RETURN;
        END;
        
        ----- Control MinQuantity
        BEGIN
        	CREATE TABLE #minControlStuffs
        	(
        		StuffID         INT,
        		MinContorol     BIT,
        		ControlType     TINYINT,
        		MinValue        DECIMAL(30, 4)
        	);
        	
        	
        	SET @Query = 
        	    N'
		insert into #minControlStuffs
		SELECT sd.StuffID,
			   sd.MinContorol,
			   sd.ControlType,
			   sd.MinValue
		FROM ' + @SourceTemp + N' s
			JOIN STF.StuffDetail AS sd
				ON s.StuffID = sd.StuffID';
        	
        	EXEC (@Query);
        	
        	
        	IF EXISTS
        	   (
        	       SELECT 1
        	       FROM   #minControlStuffs AS mcs
        	       WHERE  mcs.MinContorol = 1
        	              AND (
        	                      mcs.ControlType = 1
        	                      OR (mcs.ControlType = 0 AND @Confirmed = 3)
        	                  )
        	   )
        	   AND (
        	           (
        	               @IsDeleteOperation = 0
        	               AND (
        	                       @EntityName = 'OutgoingItem'
        	                       OR @EntityName = 'ReturnStockReceiptItem'
        	                   )
        	           )
        	           OR (
        	                  @IsDeleteOperation = 1
        	                  AND (
        	                          @EntityName = 'StockReceiptItem'
        	                          OR @EntityName = 'ReturnedOutgoingItem'
        	                      )
        	              )
        	       )
        	BEGIN
        	    SET @Query = 
        	        N'
							INSERT INTO #error ([Message], IsDetail)
							SELECT DISTINCT
								   REPLACE(s.Title, ''%'', '''') AS [Message],
								   1 AS IsDetail
							FROM ' + @TableName2 +
        	        N' AS r
								 JOIN #minControlStuffs ms
									  ON r.StuffID = ms.StuffID
								 JOIN #vwStuff s
									  ON r.StuffID = s.StuffID
							WHERE r.MainInLine < ms.MinValue;
				';
        	    
        	    EXEC sp_executesql @Query;		
        	    
        	    IF EXISTS (
        	           SELECT 1
        	           FROM   #error
        	       )
        	    BEGIN
        	        INSERT INTO #error values('STC_SpFinalStuffInventory_4', 0);
        	        
        	        EXEC (N'Insert into  ' + @ErrorTable + N' select [Message] ,IsDetail   from #Error')
        	        EXEC (N'Select * from ' + @ErrorTable)
        	        RETURN;
        	    END;
        	END;
        	
        	IF EXISTS
        	   (
        	       SELECT 1
        	       FROM   #minControlStuffs AS mcs
        	       WHERE  mcs.MinContorol = 1
        	              AND mcs.ControlType = 0
        	              AND @Confirmed = 1
        	              AND (
        	                      (
        	                          @IsDeleteOperation = 0
        	                          AND (
        	                                  @EntityName = 'OutgoingItem'
        	                                  OR @EntityName = 'ReturnStockReceiptItem'
        	                              )
        	                      )
        	                      OR (
        	                             @IsDeleteOperation = 1
        	                             AND (
        	                                     @EntityName = 'StockReceiptItem'
        	                                     OR @EntityName = 'ReturnedOutgoingItem'
        	                                 )
        	                         )
        	                  )
        	   )
        	BEGIN
        	    SET @Query = N'if EXISTS (select * from ' + @TableName2
        	        +
        	        N' as r
						join	#minControlStuffs     mcs         on r.StuffID = mcs.StuffID
						WHERE mcs.MinContorol = 1
						AND mcs.ControlType = 0
						AND @Confirmed = 1
						AND
						(
							(
								@IsDeleteOperation = 0
								AND
								(
									@EntityName = ''OutgoingItem''
									OR @EntityName = ''ReturnStockReceiptItem''
								)
							)
							OR
							(
								@IsDeleteOperation = 1
								AND
								(
									@EntityName = ''StockReceiptItem''
									OR @EntityName = ''ReturnedOutgoingItem''
								)
							)
						)
						and r.maininline < mcs.MinValue
						 )
					BEGIN
						set @pError = 1	
														
					END';
        	    
        	    SET @ParmDefinition = 
        	        N'@Confirmed tinyint,@IsDeleteOperation bit,@EntityName varchar(75),@pError bit OUTPUT';
        	    EXECUTE sp_executesql @Query,
        	         @ParmDefinition,
        	         @Confirmed = @Confirmed,
        	         @IsDeleteOperation = @IsDeleteOperation,
        	         @EntityName = @EntityName,
        	         @pError = @Error OUTPUT;
        	    IF @Error = 1
        	    BEGIN
        	        INSERT INTO #error values('ItIsNotConfirmed', 0);
        	        
        	         EXEC (N'Insert into  ' + @ErrorTable + N' select [Message] ,IsDetail   from #Error')
        	        EXEC (N'Select * from ' + @ErrorTable)
        	        RETURN;
        	    END;
        	END;
        END;
    END;
END;
	----------------   Sale Inventory Check  -------------------------

IF @ReseveMustBeChecked = 1
BEGIN
    IF NOT EXISTS
       (
           SELECT 1
           FROM   STC.OutgoingItem   AS oi
                  JOIN STC.Outgoing  AS o
                       ON  o.OutgoingID = oi.OutgoingID
                  JOIN [STC].[StockDocumentTypeBaseEntity] sdtb
                       ON  o.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
                  JOIN STF.Stock     AS s
                       ON  s.StockID = o.StockID
                  JOIN STF.Stock     AS s2
                       ON  s2.StockID = o.DeliverStockID
                  JOIN STC.StockDocumentType AS sdt
                       ON  sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
                  JOIN #ItemsIds i
                       ON  i.ItemId = oi.OutgoingItemID
           WHERE  sdt.DocumentType = 4
                  AND s.BranchID = s2.BranchID
       )
    BEGIN
        DECLARE @reserveBaseForm     NVARCHAR(100),
                @checkReserved       BIT = 1;
        SELECT @reserveBaseForm = ConfigValue
        FROM   cfg.Configuration
        WHERE  ConfigKey = 'BaseDocumentForReserve'
        
        SET @Query = N'if EXISTS(  SELECT * FROM STC.OutgoingItem AS oi
							LEFT JOIN [SLE].[' + @reserveBaseForm
            +
            N'_OutGoing] re on re.OutgoingItemID = oi.OutgoingItemID
							JOIN #ItemsIds AS i ON i.ItemId = oi.OutgoingItemID
						WHERE re.' + @reserveBaseForm + N'ItemID IS not NULL)
						SET @checkReserved = 0
						';
        
        EXEC sp_executesql @Query,
             N'@checkReserved BIT OUT',
             @checkReserved = @checkReserved OUTPUT;
        
        
        
        IF @checkReserved = 0
        BEGIN
            SET @ReseveMustBeChecked = 0
        END
        
        IF @ReseveMustBeChecked = 1
        BEGIN
            SELECT StuffID,
                   SUM(Non) Reserved
            INTO   #ReservedStuffs
            FROM   cfg.vwReservedStuffs
            GROUP BY
                   StuffID
            
            SET @Query = 
                N'
								INSERT INTO #error ([Message], IsDetail)
								SELECT DISTINCT
									   REPLACE(s.Title, ''%'', '''') AS [Message],
									   1 AS IsDetail
								FROM
								(
									SELECT t.StuffID,
										   SUM(t.MainQuantity) AS MainQuantity
									FROM ' + @SrcTable +
                N' AS t
									GROUP BY t.StuffID
								) AS i
									 JOIN #ReservedStuffs rs
										  ON rs.StuffID = i.StuffID
									 JOIN #vwStuff s
										  ON i.StuffID = s.StuffID
								WHERE (i.MainQuantity - ISNULL(rs.Reserved, 0)) < 0;
								';
            
            EXEC sp_executesql @Query;
    IF EXISTS (
            SELECT 1
            FROM   #error
        )
			BEGIN
			    INSERT INTO #error values('STC_SpFinalStuffInventory_4', 0);
			            
			    EXEC (N'Insert into  ' + @ErrorTable + N' select [Message] ,IsDetail   from #Error')
			    EXEC (N'Select * from ' + @ErrorTable)
			    RETURN;
			END;
			
		
    END;
    END;
    END; 
    	SELECT * FROM #error AS e           
    END;
