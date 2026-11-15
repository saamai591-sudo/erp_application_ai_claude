
-------------------------------------
CREATE     PROC [STC].spConterventionRecountingInventory
(
    @RecountingInventoryID INT = NULL,
    @InventoryEditionID INT = NULL,
    @UserName NVARCHAR(255),
    @type TINYINT,
    @StockReceiptID INT OUTPUT,
    @OutgoingID INT OUTPUT
)

--WITH ENCRYPTION 
WITH RECOMPILE
     AS

BEGIN
	SET NOCOUNT ON;
	
	DECLARE @FinalStuffInventoryErrors      NVARCHAR(MAX)
	
	SET @FinalStuffInventoryErrors = cfg.getTempTableName(1)
	CREATE TABLE #error
	(
		[Message]     NVARCHAR(MAX),
		IsDetail      BIT
	)

	BEGIN
		INSERT INTO #error
		SELECT 'ReountingInventoryPreviouslyConfirmed',
		       0
		FROM   stc.RecountingInventory AS ri
		WHERE  ri.RecountingInventoryID = @RecountingInventoryID
		       AND ri.[Status] = 1
		UNION ALL
		SELECT 'ReountingInventoryPreviouslyConfirmed',
		       0
		FROM   stc.InventoryEdition AS ie
		WHERE  ie.InventoryEditionID = @InventoryEditionID
		       AND ie.[Status] = 1
		
		IF EXISTS(
		       SELECT 1
		       FROM   #error AS e
		   )
		BEGIN
		    SELECT *
		    FROM   #error
		    
		    RETURN;
		END
	END
	
	
	DECLARE @RecountingInventoryTagID     INT,
	        @CountingTurns                TINYINT,
	        @StockID                      INT,
	        @Creator                      INT,
	        @Date                         DATETIME,
	        @FinancialPeriodID            INT,
	        @Query                        NVARCHAR(MAX),
	        @Columns                      NVARCHAR(MAX),
	        @ColumnsInSelect			  NVARCHAR(MAX),
	        @ColumnsInCreateTable		  NVARCHAR(MAX),
	        @ConditionalInnerJoin         NVARCHAR(MAX),
	        @Params                       NVARCHAR(MAX),
	        @CurrentDate                  DATETIME,
	        @TableName                    NVARCHAR(250),
	        @existNegativeStuff           BIT = 0;
	
	SET @CurrentDate = GETDATE();
	
	SELECT @Creator = UserID
	FROM   CFG.[User]
	WHERE  Username = @UserName;
	
	IF @RecountingInventoryID IS NOT NULL
	BEGIN
	    SELECT @RecountingInventoryTagID = ri.RecountingInventoryTagID,
	           @StockReceiptID     = ri.StockReceiptID,
	           @OutgoingID         = ri.OutgoingID
	    FROM   STC.RecountingInventory AS ri
	           JOIN STC.RecountingInventoryTag AS rit
	                ON  rit.RecountingInventoryTagID = ri.RecountingInventoryTagID
	    WHERE  ri.RecountingInventoryID = @RecountingInventoryID;
	    
	    SELECT @CountingTurns = i.CountingTurns,
	           @StockID               = rip.StockID,
	           @Date                  = rip.[Date],
	           @FinancialPeriodID     = rip.FinancialPeriodID
	    FROM   STC.RecountingInventoryTag r
	           JOIN STC.RecountingInventoryPeriod rip
	                ON  r.RecountingInventoryPeriodID = rip.RecountingInventoryPeriodID
	           JOIN STC.InventoryMethod i
	                ON  i.InventoryMethodID = rip.InventoryMethodID
	    WHERE  r.RecountingInventoryTagID = @RecountingInventoryTagID;
	END;
	
	IF @InventoryEditionID IS NOT NULL 
	BEGIN
	    SELECT @StockReceiptID = StockReceiptID,
	           @OutgoingID            = OutgoingID,
	           @FinancialPeriodID     = ie.FinancialPeriodID,
	           @StockID               = ie.StockID,
	           @Date                  = ie.[Date]
	    FROM   STC.InventoryEdition AS ie
	    WHERE  ie.InventoryEditionID = @InventoryEditionID;
	END;
	
	DECLARE @LastCloseDate DATE
	SELECT @LastCloseDate = MAX(DATE)
	FROM   stc.StockClosePeriod AS scp
	WHERE  scp.StockID = @StockID
	
	IF @LastCloseDate is null
	   OR @LastCloseDate < @Date
	BEGIN
	    INSERT INTO #error values(N'این انبار تا تاریخ انبارگردانی باید تایید شده باشد.', 0);
	    
	    SELECT *
	    FROM   #error
	    
	    RETURN;
	END
	
	IF (@OutgoingID IS NULL AND @StockReceiptID IS NULL)
	BEGIN
	    SET @TableName = CFG.getTempTableName(1);
	    
	    
	    
	    SELECT @ColumnsInCreateTable = STUFF(
	               (
	                   SELECT DISTINCT
	                          ',' + QUOTENAME(TraceID) + ' NVARCHAR(256)'
	                   FROM   STF.Trace
	                   WHERE  CheckInventory = 1
	                          FOR XML PATH(''), TYPE
	               ).value('.', 'NVARCHAR(MAX)'),
	               1,
	               1,
	               ''
	           );
	    
	    IF (@ColumnsInCreateTable IS NULL)
	        SET @ColumnsInCreateTable = N'[-1] NVARCHAR(256)';
	  
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
	        
	  	    SELECT @ColumnsInSelect = STUFF(
	               (
	                   SELECT DISTINCT
	                          ',source.' + QUOTENAME(TraceID)
	                   FROM   STF.Trace
	                   WHERE  CheckInventory = 1
	                          FOR XML PATH(''), TYPE
	               ).value('.', 'NVARCHAR(MAX)'),
	               1,
	               1,
	               ''
	           );
	    
	    IF (@ColumnsInSelect IS NULL)
	        SET @ColumnsInSelect = N'source.[-1]';      
	    
	     EXEC stc.spGetInventoryInDate
	         @StuffId = Null,
	         @stockID = @stockid,
	         @ToDate = @date,
	         @FinalTable = @TableName
				
DECLARE @StockDocumentTypeBaseEntityID     INT,
        @QuantityReceiptItemID             INT,
        @ids                               NVARCHAR(MAX),
        @OutgoingItemID                    INT;;

SELECT @ConditionalInnerJoin = STUFF(
           (
               SELECT DISTINCT
                      ' AND (source.' + QUOTENAME(TraceID) + ' is null or target.' + QUOTENAME(TraceID) + '= source.'
                      + QUOTENAME(TraceID) + ')'
               FROM   STF.Trace
               WHERE  CheckInventory = 1
                      FOR XML PATH(''), TYPE
           ).value('.', 'NVARCHAR(MAX)'),
           1,
           1,
           ''
       );

IF (@ConditionalInnerJoin IS NULL)
    SET @ConditionalInnerJoin = N'';


DECLARE @OutgoingTemp TABLE
(
	[OutgoingID] INT,
	[Number] INT,
	[Version] INT
);

DECLARE @StockTemp TABLE
(
	[StockReceiptID] INT,
	[Number] INT,
	[Version] INT
);

DECLARE @RecountedItems NVARCHAR(MAX)
set @RecountedItems = cfg.getTempTableName(1)
set @Query = N'Create table '+@RecountedItems
+N'(
	RecountingInventoryTagItemID int,InventoryEditionItemID int,StuffID int,MainQuantity decimal(36,10),SubQuantity  decimal(36,10),'+@ColumnsInCreateTable+N')'

	EXEC (@Query)
	

IF @RecountingInventoryID IS NOT NULL
BEGIN
    
    SET @Query = N'   
    insert into ' + @RecountedItems+N'
					select oi.RecountingInventoryTagItemid,null InventoryEditionItemID,StuffID,MainQuantity,SubQuantity,'+@Columns +N'
				
       
					from stc.RecountingInventoryItem o 
					INNER JOIN stc.RecountingInventoryTagItem oi on o.RecountingInventoryTagItemid = oi.RecountingInventoryTagItemid
					LEFT JOIN(select RecountingInventoryTagItemid id,TraceID,
								Case 
									When DLID IS NOT NULL THEN cast (DLID as nvarchar(max)) 
									When TraceItemID IS NOT NULL THEN cast (TraceItemID as nvarchar(max)) 
									else Value 
								end Value
								from stc.RecountingInventoryTagItemTrace ) x
					pivot 
					(
						max(Value)
						for TraceID in ( ' + @Columns
        + 
        N')
					) p on oi.RecountingInventoryTagItemid = p.id
					WHERE o.RecountingInventoryID = @pRecountingInventoryID
					AND o.[Type] = @pCountingTurns';
    
    SET @Params = N'@pRecountingInventoryID int,@pCountingTurns int';
    
    EXECUTE sp_executesql @Query,
         @Params,
         @pRecountingInventoryID = @RecountingInventoryID,
         @pCountingTurns = @CountingTurns;
END;     
  ---------Recounted Stuffs must conterventioned       
IF @InventoryEditionID IS NOT NULL
and @type = 1
BEGIN
        
    
    SET @Query = 
        N' insert into  ' + @RecountedItems+N'
					SELECT	Null RecountingInventoryTagItemid,
					 o.InventoryEditionItemID,
							o.StuffID,
							o.MainQuantity,
							o.SubQuantity,
							'+@Columns+N'
					FROM STC.InventoryEditionItem AS o
					LEFT JOIN
					(
						SELECT ieit.InventoryEditionItemID id,
							   TraceID,
							   CASE
								   WHEN DlID IS NOT NULL THEN
									   CAST(DlID AS NVARCHAR(MAX))
								   WHEN TraceItemID IS NOT NULL THEN
									   CAST(TraceItemID AS NVARCHAR(MAX))
								   ELSE
									   Value
							   END Value
						FROM STC.InventoryEditionItemTrace AS ieit
					) x
					PIVOT
					(
						MAX(x.[Value])
						FOR x.TraceID IN ( ' + @Columns
        + 
        N')
					) p
						ON o.InventoryEditionItemID = p.id
					WHERE o.InventoryEditionID = @pInventoryEditionID ';
    
    SET @Params = N'@pInventoryEditionID int';
    
    EXECUTE sp_executesql @Query,
         @Params,
         @pInventoryEditionID = @InventoryEditionID;
  END  


 ---------All Stuffs in stock must conterventioned  
 IF @InventoryEditionID IS NOT NULL
and @type = 2
BEGIN
        
    
    SET @Query = 
        N' insert into  ' + @RecountedItems+N'
					SELECT	Null RecountingInventoryTagItemid,
					 o.InventoryEditionItemID,
							o.StuffID,
							o.MainQuantity,
							o.SubQuantity,
							'+@Columns+N'
					FROM STC.InventoryEditionItem AS o
					LEFT JOIN
					(
						SELECT ieit.InventoryEditionItemID id,
							   TraceID,
							   CASE
								   WHEN DlID IS NOT NULL THEN
									   CAST(DlID AS NVARCHAR(MAX))
								   WHEN TraceItemID IS NOT NULL THEN
									   CAST(TraceItemID AS NVARCHAR(MAX))
								   ELSE
									   Value
							   END Value
						FROM STC.InventoryEditionItemTrace AS ieit
					) x
					PIVOT
					(
						MAX(x.[Value])
						FOR x.TraceID IN ( ' + @Columns
        + 
        N')
					) p
						ON o.InventoryEditionItemID = p.id
					WHERE o.InventoryEditionID = @pInventoryEditionID ';
    
    SET @Params = N'@pInventoryEditionID int';
    

    
    EXECUTE sp_executesql @Query,
         @Params,
         @pInventoryEditionID = @InventoryEditionID;
         
       
     set @Query = N'insert into  ' + @RecountedItems+N'
					SELECT	Null RecountingInventoryTagItemid,
					 @pInventoryEditionID,
							source.StuffID,
							case when target.StuffId is null then 0 else target.MainQuantity End,
							case when target.StuffId is null then 0 else target.SubQuantity End,
							'+@ColumnsInSelect+N'  
					from '+@TableName+N' source
					left join '+@RecountedItems+N' target on 
					source.StuffID = target.StuffID  '+@ConditionalInnerJoin  +N'
					where target.StuffID is null'
         
          SET @Params = N'@pInventoryEditionID int';

    EXECUTE sp_executesql @Query,
         @Params,
         @pInventoryEditionID = @InventoryEditionID;
         
  END   

   
     SELECT @ConditionalInnerJoin = STUFF(
               (
                   SELECT DISTINCT
                          ' AND  isnull(target.' + QUOTENAME(TraceID) + ',-1)= isnull(source.'
                          + QUOTENAME(TraceID) + ',-1)'
                   FROM   STF.Trace
                   WHERE  CheckInventory = 1
                          FOR XML PATH(''), TYPE
               ).value('.', 'NVARCHAR(MAX)'),
               1,
               1,
               ''
           );
    
    IF (@ConditionalInnerJoin IS NULL)
        SET @ConditionalInnerJoin = N'';
    
    
CREATE TABLE #DifferedInventoryTemp
(
    ID                       INT,
    StuffID                  INT,
    RecountedMainQuantity    DECIMAL(36, 10),
    RecountedSubQuantity     DECIMAL(36, 10),
    InventoryMainQuantity    DECIMAL(36, 10),
    InventorySubQuantity     DECIMAL(36, 10)
);



SET @Query = N'ALTER TABLE #DifferedInventoryTemp ADD ' + @ColumnsInCreateTable;
EXEC (@Query);

    
    SET @Query = 
        N'insert into #DifferedInventoryTemp
				select row_Number() over (partition by case when source.MainQuantity> isnull(target.MainQuantity,0) then 1
				else 0 end
				 order by source.StuffID),
				source.StuffID,source.MainQuantity,source.SubQuantity,isnull(target.MainQuantity,0),isnull(target.SubQuantity,0),'+@ColumnsInSelect+N'
					from ' + @RecountedItems + N' source
					left join ' + @TableName + ' target on source.stuffid = target.stuffid
					' + @ConditionalInnerJoin + N'
					where source.MainQuantity <> isnull(target.MainQuantity,0)';
		

    EXEC (@Query)
 
     
if exists(
           SELECT 1
           FROM   #DifferedInventoryTemp  a
                  JOIN stf.[Stuff]      AS s
                       ON  a.StuffID = s.StuffID
                  JOIN stf.StuffDetail  AS sd
                       ON  sd.StuffID = s.StuffID
           WHERE  sd.IsStuffSerializable  = 1
       )
    BEGIN
        INSERT INTO #error values(N'SerilizedStuffsCantDiffer', 0);
        
        SELECT *
        FROM   #error
        
        RETURN;
    END;                                      
    

    -- StockReceipt:
 
 
    IF EXISTS (
           SELECT 1
           FROM   #DifferedInventoryTemp
           WHERE RecountedMainQuantity > InventoryMainQuantity
       )
    BEGIN
        SELECT @StockDocumentTypeBaseEntityID = StockDocumentTypeBaseEntityID
        FROM   STC.StockDocumentTypeBaseEntity sdtb
               JOIN stc.StockDocumentType sdt
                    ON  sdtb.StockDocumentTypeID = sdt.StockDocumentTypeID
        WHERE  sdt.Type = 1
               AND sdt.DocumentType = 6;
               
               
        
        INSERT INTO @StockTemp
        EXEC [STC].[spStockReceiptInsert] @AutoGenerated = 1,
             @StockDocumentTypeBaseEntityID = @StockDocumentTypeBaseEntityID,
             @StockID = @StockID,
             @DeliverDlID = NULL,
             @DeliverStockID = NULL,
             @Number = 0,
             @Date = @Date,
             @TotalInvoicePrice = 0,
             @TotalEstimatedPrice = 0,
             @TotalCosts = 0,
             @TotalNetPrice = 0,
             @PreVoucherID = NULL,
             @OutgoingID = NULL,
             @Creator = @Creator,
             @CreationDate = @CurrentDate,
             @LastEditor = @Creator,
             @LastEditionDate = @CurrentDate,
             @FinancialPeriodID = @FinancialPeriodID;
        
        SELECT @StockReceiptID = [StockReceiptID]
        FROM   @StockTemp;
        
        
        
        SET @QuantityReceiptItemID = ISNULL(
                (
                    SELECT MAX(StockReceiptItemID)
                    FROM   [STC].StockReceiptItem
                ),
                0
            );
            
             SET @OutgoingItemID = ISNULL(
                (
                    SELECT MAX(OutgoingItemID)
                    FROM   [STC].OutgoingItem
                ),
                0
            );
            
            
        
        UPDATE #DifferedInventoryTemp
         SET    ID = CASE WHEN RecountedMainQuantity>InventoryMainQuantity then  ID + @QuantityReceiptItemID
         else ID + @OutgoingItemID end;
        
        SET IDENTITY_INSERT [STC].[StockReceiptItem] ON;
        INSERT INTO [STC].[StockReceiptItem]
               (
                   [StockReceiptItemID],
                   [StockReceiptID],
                   [RowIndex],
                   [OutgoingItemID],
                   [PurchaseInvoiceItemID],
                   [StuffID],
                   [MainQuantity],
                   [SubQuantity],
                   [Fee],
                   [Price],
                   [EstimatedFee],
                   [EstimatedPrice],
                   [ShareOfCosts],
                   [Description],
                   [Description2],
                   [Version],
                   [Creator],
                   [CreationDate],
                   [LastEditor],
                   [LastEditionDate]
               )
        SELECT ID,
               @StockReceiptID,
               ROW_NUMBER() OVER(ORDER BY StuffID),
               NULL,
               NULL,
               StuffID,
               RecountedMainQuantity - InventoryMainQuantity,
               RecountedSubQuantity - InventorySubQuantity,
               0,
               0,
               0,
               0,
               0,
               NULL,
               NULL,
               0,
               @Creator,
               @CurrentDate,
               @Creator,
               @CurrentDate
        FROM #DifferedInventoryTemp As t
        WHERE t.RecountedMainQuantity>ISNULL(t.InventoryMainQuantity,0)
        SET IDENTITY_INSERT [STC].[StockReceiptItem] OFF;
        
        
        
CREATE TABLE #UnpivotedDifferedInventoryTemp
(
    ID           INT,
    TraceID      INT,
    [VALUE]      NVARCHAR(MAX)
);
SET @Query = 
    N'
INSERT INTO #UnpivotedDifferedInventoryTemp( ID,TraceID,[Value])
SELECT    u.ID,u.TraceID,u.[Value] FROM
(
    SELECT
        ID,
        ' + @Columns + N'
    FROM #DifferedInventoryTemp
) s UNPIVOT
(
    [Value]
    FOR TraceID IN (' + @Columns + N')
) AS u
WHERE u.[Value] IS NOT NULL;
';
EXEC sp_executesql @Query;
        

        
        INSERT INTO [STC].[StockReceiptItemTrace]
               (
                   [StockReceiptItemID],
                   [TraceID],
                   [DlID],
                   [Value],
                   [Version],
                   [Creator],
                   [CreationDate],
                   [LastEditor],
                   [LastEditionDate],
                   TraceItemID
               )
        SELECT udit.ID,
               udit.[TraceID],
               CASE WHEN t.AccountLevelTypeID = 1 then udit.[VALUE] else null END,
               CASE WHEN t.AccountLevelTypeID NOT IN (1,6) then udit.[VALUE] else null end,
               0,
               @Creator,
               GETDATE(),
               @Creator,
               GETDATE(),
               CASE WHEN t.AccountLevelTypeID = 6 then udit.[VALUE] else null END
        FROM #UnpivotedDifferedInventoryTemp AS udit
        join #DifferedInventoryTemp AS dit on dit.ID = udit.ID
        join stf.Trace AS t on t.TraceID = udit.TraceID
        WHERE dit.RecountedMainQuantity>ISNULL(dit.InventoryMainQuantity,0)
        

     
    -- Outgoing	
    IF EXISTS (
           SELECT 1
           FROM   #DifferedInventoryTemp
           WHERE RecountedMainQuantity < ISNULL(InventoryMainQuantity,0)
       )
    BEGIN
        SELECT @StockDocumentTypeBaseEntityId = sdtb.StockDocumentTypeBaseEntityID
        FROM   STC.StockDocumentType sdt
               JOIN [STC].[StockDocumentTypeBaseEntity] sdtb
                    ON  sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
        WHERE  sdt.Type = 2
               AND sdt.DocumentType = 7;
        
        INSERT INTO @OutgoingTemp
        EXEC [STC].[spOutgoingInsert] @AutoGenerated = 1,
             @StockDocumentTypeBaseEntityID = @StockDocumentTypeBaseEntityID,
             @Number = NULL,
             @Date = @Date,
             @StockID = @StockID,
             @DeliverDlID = NULL,
             @DeliverStockID = NULL,
             @FinancialPeriodID = @FinancialPeriodID,
             @PreVoucherID = NULL,
             @Creator = @Creator,
             @CreationDate = @CurrentDate,
             @TotalPrice = 0;
        
        SELECT @OutgoingID = [OutgoingID]
        FROM   @OutgoingTemp;
        
       
        
        
        SET IDENTITY_INSERT [STC].OutgoingItem ON;
        
        INSERT INTO [STC].[OutgoingItem]
               (
                   [OutgoingItemID],
                   [OutgoingID],
                   [RowIndex],
                   [JustificationItemID],
                   [QuotationItemID],
                   [InvoiceItemID],
                   [RemittanceItemID],
                   [StuffRequestItemID],
                   [StuffID],
                   [MainQuantity],
                   [SubQuantity],
                   [Fee],
                   [Price],
                   [Description],
                   [Description2],
                   [Version],
                   [Creator],
                   [CreationDate],
                   [LastEditor],
                   [LastEditionDate]
               )
        SELECT ID,
               @OutgoingID,
               ROW_NUMBER() OVER(ORDER BY StuffID),
               NULL,
               NULL,
               NULL,
               NULL,
               NULL,
               StuffID,
               InventoryMainQuantity - RecountedMainQuantity,
               InventorySubQuantity - RecountedSubQuantity,
               0,
               0,
               NULL,
               NULL,
               0,
               @Creator,
               @CurrentDate,
               @Creator,
               @CurrentDate
        FROM   #DifferedInventoryTemp t
          
        WHERE t.RecountedMainQuantity<ISNULL(t.InventoryMainQuantity,0);
       
        
        SET IDENTITY_INSERT [STC].OutgoingItem OFF;
        
        INSERT INTO [STC].[OutgoingItemTrace]
               (
                   [OutgoingItemID],
                   [TraceID],
                   [DlID],
                   [Value],
                   [Version],
                   [Creator],
                   [CreationDate],
                   [LastEditor],
                   [LastEditionDate],
                   TraceItemID
               )
               
        SELECT udit.ID,
               udit.[TraceID],
               CASE WHEN t.AccountLevelTypeID = 1 then udit.[VALUE] else null END,
               CASE WHEN t.AccountLevelTypeID NOT IN (1,6) then udit.[VALUE] else null end,
               0,
               @Creator,
               GETDATE(),
               @Creator,
               GETDATE(),
               CASE WHEN t.AccountLevelTypeID = 6 then udit.[VALUE] else null END
        FROM #UnpivotedDifferedInventoryTemp AS udit
        join #DifferedInventoryTemp AS dit on dit.ID = udit.ID
        join stf.Trace AS t on t.TraceID = udit.TraceID
        WHERE dit.RecountedMainQuantity < ISNULL(dit.InventoryMainQuantity,0)
        
        DECLARE @itemIds NVARCHAR(MAX);
        
        SELECT @itemIds = STUFF(
                   (
                       SELECT ',' + CAST(ID AS NVARCHAR(20))
                       FROM #DifferedInventoryTemp AS dit
                        WHERE dit.RecountedMainQuantity < ISNULL(dit.InventoryMainQuantity,0)
                              FOR XML PATH(''),
                              TYPE
                   ).value('.', 'nvarchar(max)'),
                   1,
                   1,
                   ''
               );
        
        EXEC STC.SpFinalStuffInventory 
             @ID = NULL,
             @EntityName = 'OutgoingItem',
             @Confirmed = 2,
             @IsDeleteOperation = 0,
             @HeaderIDs = @OutgoingID,
             @ControlType = 0,
             @RecountingInvetoryID = @RecountingInventoryID,
             @InventoryEditionID = @InventoryEditionID,
             @ErrorTable = @FinalStuffInventoryErrors;
        
        EXEC (
                 N'insert into #error select * from ' + @FinalStuffInventoryErrors
             )			
        
        IF EXISTS(
               SELECT 1
               FROM   #error
           )
        BEGIN
            SELECT *
            FROM   #error
            
            RETURN
        END
    END;
    
    UPDATE STC.RecountingInventoryTag
    SET    [Status]                     = 1
    WHERE  RecountingInventoryTagID     = @RecountingInventoryTagID;
    
    UPDATE STC.RecountingInventory
    SET    StockReceiptID            = @StockReceiptID,
           OutgoingID                = @OutgoingID,
           [Status]                  = 1
    WHERE  RecountingInventoryID     = @RecountingInventoryID;

 
	 
	 
    UPDATE STC.InventoryEdition
    SET    StockReceiptID         = @StockReceiptID,
           OutgoingID             = @OutgoingID,
           [Status]               = 1
    WHERE  InventoryEditionID     = @InventoryEditionID;
            END;
            	
SELECT *
FROM   #error

        END;
END;	 
