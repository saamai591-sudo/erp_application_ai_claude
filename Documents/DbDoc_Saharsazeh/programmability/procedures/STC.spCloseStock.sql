
------------------------------------- END #7057
CREATE   PROC [STC].spCloseStock
    @FinancialPeriodID INT,
    @StockID INT,
    @Status TINYINT --- 1 for quantity Closing  2 for Amount Closing
--WITH ENCRYPTION 
AS
BEGIN

    SET NOCOUNT ON;
    BEGIN TRY
        DECLARE @StartDate DATETIME = NULL,
                @NextFinancialPeriod INT = NULL,
                @StockReceiptID INT = NULL,
                @Columns AS NVARCHAR(MAX),
                @SelectListColumns AS NVARCHAR(MAX),
                @Query AS NVARCHAR(MAX),
                @ParmDefinition NVARCHAR(MAX),
                @JoinCondition AS NVARCHAR(MAX),
                @Creator INT,
                @Now DATETIME,
                @MaxID INT,
                @ItemID INT,
				@ItemIDs VARCHAR(MAX),
                @Stock NVARCHAR(MAX),
                @TableName NVARCHAR(250),
                @TableName1 NVARCHAR(250),
                @TableName2 NVARCHAR(250),
                @TableName3 NVARCHAR(250),
                @TableName4 NVARCHAR(250),
                @PrecionCount INT,
                @ColumnsInCreateTable NVARCHAR(MAX),
				@EndDate DATETIME,
				@StockDocumentTypeBaseEntityID int ,
				@DeliverDlID int,
				@ReturnStockReceiptID int,
				@StartNum INT = NULL ,
				@EndNum INT = NULL ,
				@ResetBasedOnType BIT = 0 ,
				@ResetBasedOnStock BIT = 0 ,
				@DocumentNumID INT ,
				@DocumentNumTypeID INT,
				@Number int,
				@ErrorMessage NVARCHAR(4000),
				@ErrorSeverity INT,
				@ErrorState INT,
				@TracesJoin nvarchar(MAX);
        
        SET @TableName = CFG.getTempTableName(1);
        SET @TableName1 = CFG.getTempTableName(1);
        SET @TableName2 = CFG.getTempTableName(1);
        SET @TableName3 = CFG.getTempTableName(1);
        SET @TableName4 = CFG.getTempTableName(1);
        SET @PrecionCount = CFG.GetBaseCurrencyPrecision();

		SET @Creator = [CFG].[GetuserID]();
        SET @Now = GETDATE();
		select @EndDate = EndDate,@StartDate = StartDate
		from cfg.FinancialPeriod
		where FinancialPeriodID = @FinancialPeriodID

        DROP TABLE IF EXISTS ##FinalPrice;
        DROP TABLE IF EXISTS ##StockReceiptItemTemp;
        DROP TABLE IF EXISTS ##ItemTemp;
        DROP TABLE IF EXISTS ##diff;
        DROP TABLE IF EXISTS ##diff2;

       

        SELECT @Columns = STUFF(
        (
            SELECT DISTINCT
                    ',' + QUOTENAME(TraceID)
            FROM STF.Trace
            WHERE (case when @Status = 1 then CheckInventory  else PricingBase end)= 1
            FOR XML PATH(''), TYPE
        ).value('.', 'NVARCHAR(MAX)'),1   ,1   ,'');

        IF (@Columns IS NULL)
            SET @Columns = N'[-1]';

			select @TracesJoin =  STUFF(
(
    SELECT DISTINCT
            ' And isnull(a.' + QUOTENAME(TraceID) + ',-1)=isnull(b.' + QUOTENAME(TraceID)+N',-1)'
    FROM STF.Trace
    WHERE (case when @Status = 1 then CheckInventory  else PricingBase end) = 1
    FOR XML PATH(''), TYPE
).value('.', 'NVARCHAR(MAX)'),1   ,1   ,'');
      IF (@TracesJoin IS NULL)
          SET @TracesJoin = N'And 0 = 0';


exec [STC].RptReviewDataSource
	@ReviewType =     @Status , ---1 Quantity   -----2 Amount
    @FromDate  = @StartDate,
    @ToDate = @EndDate,
    @TableName =@TableName,
    @SelectedStocks = @StockID,
    @SelectedDl = NULL,
    @SelectedStuffTrace  = NULL,
    @SelectedStuffAccountGroup  = NULL,
    @SelectedStuffGroup  = NULL,
    @SelectedStuff  = NULL,
    @SelectedStockDocumentType  = NULL,
    @IsTraceTab  = 1,
    @Parameter ='Stuff',
    @StartDateFinancialPeriodID  = NULL,
	@HasGroupByDate  = 0

    		DECLARE @TableAmount NVARCHAR(MAX)
		set @TableAmount = cfg.getTempTableName(1)
		
		
		
        SET @Query = N' select
							ID as StuffID,
							'+@Columns+',
							sum(MainQuantity)  MainQuantity,
							ROW_NUMBER() OVER (PARTITION BY  ID,'+@Columns+N' ORDER BY ID,'+@Columns+N') Rno,
							sum(SubQuantity)  SubQuantity,
							Sum(Price) Price,
							cast(0 as decimal(36,10)) Fee
							into ' + @TableName1 + '
						from '+@TableName+' a
						group by ID,'+ @Columns	+'
						having sum(MainQuantity) > 0'


		exec (@Query);
		
if @Status = 2
		begin

 set @Query = N'SELECT StuffID,'+@Columns+N',MainQuantity,SubQuantity,Price,sum(a.Price) OVER(PARTITION BY a.StuffID,'+@Columns+N') SumPrice,
 sum(a.MainQuantity) OVER(PARTITION BY a.StuffID,'+@Columns+N') SumQuantity
 into '+@TableAmount+N' from '+@TableName1+N' a '
  EXEC (@Query)   

  
 ----Update All Rows 

SET @Query = N'					   
UPDATE a
set a.Price = Round(b.SumPrice*a.MainQuantity/b.SumQuantity,@PrecionCount)
,Fee = round( Round(b.SumPrice*a.MainQuantity/b.SumQuantity,@PrecionCount)/a.MainQuantity,10)
FROM '+@TableName1+N' a
join '+@TableAmount+N' b on a.StuffID = b.StuffID  '+@TracesJoin


EXECUTE sp_executesql @Query ,N'@PrecionCount int '
,@PrecionCount = @PrecionCount

---Get Sum Updated Rows

 DECLARE @UpdatedTableSum NVARCHAR(MAX)     
set @UpdatedTableSum = cfg.getTempTableName(1)     
set @Query = N'SELECT StuffID,'+@Columns+N',SUM(MainQuantity) MainQuantity,SUM(SubQuantity) SubQuantity,SUM(Price) Price into '+@UpdatedTableSum+N'
                       from '+@TableName1 +N'    a					   
                    WHERE rno <> 1  
					group by a.StuffID,'+@Columns+N''    

  EXEC (@Query)     

     
 ---- Update RowNumber 1
 
 SET @Query = N'					   
UPDATE a
set a.Price = b.SumPrice - c.Price,
Fee =  (b.SumPrice - c.Price)/a.MainQuantity
FROM '+@TableName1+N' a
join '+@TableAmount+N' b on a.StuffID = b.StuffID  '+@TracesJoin+N' And a.Rno = 1
join '+@UpdatedTableSum+N' c on b.StuffID = c.StuffID '+@TracesJoin

EXEC (@Query)

End

        SET @StartDate =
        (
            SELECT MIN(StartDate)
            FROM CFG.FinancialPeriod
            WHERE StartDate >
            (
                SELECT EndDate
                FROM CFG.FinancialPeriod
                WHERE FinancialPeriodID = @FinancialPeriodID
            )
        );

        SET @NextFinancialPeriod =
        (
            SELECT FinancialPeriodID
            FROM CFG.FinancialPeriod
            WHERE StartDate = @StartDate
        );

        SELECT @Stock = Title
        FROM STF.Stock
        WHERE StockID = @StockID;
            
		DROP TABLE IF EXISTS ItemTemp;

        CREATE TABLE ItemTemp
        (
            [ItemTempID] INT,
            [StockReceiptID] INT,
            [RowIndex] INT,
            [StuffID] INT,
            [MainQuantity] DECIMAL(30, 10),
            [SubQuantity] DECIMAL(30, 10),
            [Fee] DECIMAL(36, 10),
            [Price] DECIMAL(36,10),
            StockReceiptItem INT
                CONSTRAINT [PK_ItemTemp]
                PRIMARY KEY CLUSTERED ([ItemTempID])
                WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON,
                      ALLOW_PAGE_LOCKS = ON
                     ) ON [PRIMARY]
        ) ON [PRIMARY];

        DECLARE @InsertedStockReceipt TABLE
        (
            StockReceiptID INT,
            Number INT,
            [Version] INT
        );
        IF (@Status = 1) -- QuantityClosing
        BEGIN

            SET @MaxID = ISNULL(
                         (
                             SELECT MAX(StockReceiptItemID) FROM [STC].StockReceiptItem
                         ),
                         0);

            SET @Query = N'	select  row_number() over(order by Stuffid) + @pMaxID ID,StuffID,' + @Columns + N',MainQuantity,SubQuantity
							into ' + @TableName2 + N' 
							from  ' + @TableName1 ;

            EXECUTE sp_executesql @Query,
                                  N'@pMaxID int',
                                  @pMaxID = @MaxID;


            SET @Query = N'INSERT INTO ItemTemp
							(
								ItemTempID,
								RowIndex,
								StuffID,
								MainQuantity,
								SubQuantity
							)
							SELECT 
								ID,
								ROW_NUMBER() OVER(ORDER BY Stuffid),
								[StuffID],
								MainQuantity,	
								SubQuantity				
							from ' + @TableName2;

            EXECUTE sp_executesql @Query;

			SET @Query = N'
			select ID,TraceID,Value into ' + @TableName3 + N'  from
			( select ID,' + @Columns + N' from ' + @TableName2
                  + N'
			)x
			UNPIVOT
			(
			Value For TraceID  IN (' + @Columns + N')
			)A
			';
            EXEC (@Query);

            set @StockDocumentTypeBaseEntityId = null;
            IF EXISTS (SELECT RowIndex FROM ItemTemp it WHERE it.MainQuantity > 0)
            BEGIN
                SELECT @StockDocumentTypeBaseEntityId = sdtb.StockDocumentTypeBaseEntityID
                FROM STC.StockDocumentType sdt
                JOIN [STC].[StockDocumentTypeBaseEntity] sdtb 
                    ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
                WHERE sdt.DocumentType = 7
                      AND sdt.[Type] = 1;



                INSERT INTO @InsertedStockReceipt
                EXEC [STC].[spStockReceiptInsert] @AutoGenerated = 1,
                                                  @StockDocumentTypeBaseEntityID = @StockDocumentTypeBaseEntityID,
                                                  @StockID = @StockID,
                                                  @DeliverDlID = NULL,
                                                  @DeliverStockID = NULL,
                                                  @Number = 0,
                                                  @Date = @StartDate,
                                                  @TotalInvoicePrice = 0,
                                                  @TotalEstimatedPrice = 0,
                                                  @TotalCosts = 0,
                                                  @TotalNetPrice = 0,
                                                  @PreVoucherID = NULL,
                                                  @OutgoingID = NULL,
                                                  @Creator = @Creator,
                                                  @CreationDate = @Now,
                                                  @LastEditor = @Creator,
                                                  @LastEditionDate = @Now,
                                                  @FinancialPeriodID = @NextFinancialPeriod;
                SET @StockReceiptID =
                (
                    SELECT StockReceiptID FROM @InsertedStockReceipt
                );

				
               
                SET IDENTITY_INSERT [STC].StockReceiptItem ON;
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
                SELECT ItemTempID,
                       @StockReceiptID,
                       RowIndex,
                       NULL,
                       NULL,
                       StuffID,
                       MainQuantity,
                       SubQuantity,
                       0,
                       0,
                       0,
                       0,
                       0,
                       NULL,
                       NULL,
                       0,
                       @Creator,
                       @Now,
                       @Creator,
                       @Now
                FROM ItemTemp;
                SET IDENTITY_INSERT [STC].StockReceiptItem OFF;

                UPDATE STC.StockReceipt
                SET TotalCosts =
                    (
                        SELECT SUM(ShareOfCosts)
                        FROM STC.StockReceiptItem
                        WHERE StockReceiptID = @StockReceiptID
                    ),
                    TotalInvoicePrice =
                    (
                        SELECT SUM(Price)
                        FROM STC.StockReceiptItem
                        WHERE StockReceiptID = @StockReceiptID
                    ),
                    TotalNetPrice =
                    (
                        SELECT SUM(NetPrice)
                        FROM STC.StockReceiptItem
                        WHERE StockReceiptID = @StockReceiptID
                    ),
                    TotalEstimatedPrice =
                    (
                        SELECT SUM(EstimatedPrice)
                        FROM STC.StockReceiptItem
                        WHERE StockReceiptID = @StockReceiptID
                    )
                WHERE StockReceiptID = @StockReceiptID;
                
				SET @Query = N'INSERT INTO [STC].[StockReceiptItemTrace]
									   ([StockReceiptItemID]
									   ,[TraceID]
									   ,[DlID]
									   ,[Value]
									   ,[Version]
									   ,[Creator]
									   ,[CreationDate]
									   ,[LastEditor]
									   ,[LastEditionDate]
									   ,[TraceItemID] )
								select [ID]
									   ,temp.[TraceID]
									   ,Case when T.AccountLevelTypeID = 1 then Value Else Null End
									   ,Case when T.AccountLevelTypeID <> 1 AND T.AccountLevelTypeID <> 6 then Value Else Null End
									   , 0
									   ,@pCreator
									   ,GETDATE()
									   ,@pCreator
									   ,GETDATE()
									   ,Case when T.AccountLevelTypeID =6 then Value Else Null End
								from  ' + @TableName3 + N'  temp
								join stf.Trace T on T.TraceID = temp.TraceID';

                SET @ParmDefinition = N'@pCreator int';
                EXECUTE sp_executesql @Query, @ParmDefinition, @pCreator = @Creator;
            END;

            INSERT INTO [STC].[StockClosingOperation]
            (
                [FinancialPeriodID],
                [StockID],
                [Status],
                [Version],
                [Creator],
                [CreationDate],
                [LastEditor],
                [LastEditionDate]
            )
            SELECT @FinancialPeriodID,
                   @StockID,
                   @Status,
                   0,
                   @Creator,
                   @Now,
                   @Creator,
                   @Now;
        END;
        IF (@Status = 2) -- AmountClosing
        BEGIN

            DECLARE @LastStatus TINYINT;
            SET @LastStatus =
            (
                SELECT [Status]
                FROM [STC].[StockClosingOperation]
                WHERE [FinancialPeriodID] = @FinancialPeriodID
                      AND StockID = @StockID
            );

            IF @LastStatus = 1
            BEGIN


                SET @Query
                    = N'select StuffID,' + @Columns + N',MainQuantity,SubQuantity,Price,Fee
								into ##FinalPrice
						from ' + @TableName1 
						
                EXECUTE sp_executesql @Query,
                                      N'@pStockID int',
                                      @pStockID = @StockID;

				declare @Message nvarchar(max)

				if exists (select 1 from ##FinalPrice where MainQuantity = 0 and price <> 0)
				begin

					SELECT @Message = STUFF((SELECT DISTINCT ',' + QUOTENAME(s.Code)
						FROM   ##FinalPrice p
						join stf.vwstuff s on s.StuffID = p.StuffID
						where MainQuantity = 0 and price <> 0			 
								   FOR XML PATH(''),TYPE).value('.', 'NVARCHAR(MAX)'),1,1,'')		   	

					set @Message = ' کاردکس کالاهای زیر دارای اشکال است.'+char(13)+char(10)+@Message

					raiserror(@Message,16,13)
				end

                    SET @StockReceiptID =
                    (
                        SELECT sr.StockReceiptID
                        FROM STC.StockReceipt sr
                        JOIN [STC].[StockDocumentTypeBaseEntity] sdtb
                            ON sr.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
                        JOIN STC.StockDocumentType sdt
                            ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
                        WHERE FinancialPeriodID = @NextFinancialPeriod
                              AND AutoGenerated = 1
                              AND sr.StockID = @StockID
                              AND sdt.[DocumentType] = 7
                    );
                    SET @Query
                        = N'select * 
					into ##StockReceiptItemTemp
					from (
					select s.StockReceiptID,f.StockReceiptItemID,f.RowIndex ,f.StuffID,
						MainQuantity,SubQuantity,p.*
							from stc.StockReceipt s 
							join stc.StockReceiptItem f  on s.StockReceiptID = f.StockReceiptID
							left join 
						(
							select StockReceiptItemID as QRIID,TraceID,Case 
								When DLID IS NOT NULL THEN cast (DLID as nvarchar(max)) 
								When TraceItemID IS NOT NULL THEN cast (TraceItemID as nvarchar(max)) 
							else Value end Value
							from stc.StockReceiptItemTrace
						) x
						pivot 
						(
								max(Value)
							for TraceID in (' + @Columns
                          + N')
						) p 
					on f.StockReceiptItemID = p.QRIID
					WHERE s.StockReceiptID = @pStockReceiptID 
						)A ';
                    SET @ParmDefinition = N'@pStockReceiptID int';

                    EXECUTE sp_executesql @Query,
                                          @ParmDefinition,
                                          @pStockReceiptID = @StockReceiptID;

                SET @JoinCondition
                    = STUFF(
                               (
                                   SELECT DISTINCT
                                          ' AND isnull(f.' + QUOTENAME(TraceID) + ','''') = isnull(p.'
                                          + QUOTENAME(TraceID) + ','''')'
                                   FROM STF.Trace
                                   WHERE pricingbase = 1
                                   FOR XML PATH(''), TYPE
                               ).value('.', 'NVARCHAR(MAX)'),
                               1,
                               1,
                               ''
                           );

                IF @JoinCondition IS NULL
                    SET @JoinCondition = N'';

                SELECT @SelectListColumns = STUFF(
                (
                    SELECT DISTINCT
                           ',f.' + QUOTENAME(TraceID)
                    FROM STF.Trace
                    WHERE PricingBase = 1
                    FOR XML PATH(''), TYPE
                ).value('.', 'NVARCHAR(MAX)'),
                1   ,
                0   ,
                ''
                                                 );
                IF (@SelectListColumns IS NULL)
                    SET @SelectListColumns = N'';

                SET @Query
                    = N'SELECT 
							StockReceiptItemID,
							f.[StuffID],
							p.price
							' + @SelectListColumns
                      + N'	into ##ItemTemp
						from ##StockReceiptItemTemp f
						JOIN ##FinalPrice p ON p.StuffID = f.StuffID ' + @JoinCondition;

                SET @ParmDefinition = N'@pMaxID INT,@pPrecionCount int';

                EXECUTE sp_executesql @Query,
                                      @ParmDefinition,
                                      @pMaxID = @MaxID,
                                      @pPrecionCount = @PrecionCount;

                UPDATE s
                SET Fee = t.Price / s.MainQuantity,
                    Price = t.Price
                FROM STC.StockReceiptItem s
                    JOIN ##ItemTemp t
                        ON s.StockReceiptItemID = t.StockReceiptItemID;
                WITH temp
                AS (SELECT StockReceiptID,
                           SUM(Price) AS Debit
                    FROM STC.StockReceiptItem
                    WHERE StockReceiptID = @StockReceiptID
                    GROUP BY StockReceiptID)
                UPDATE v
                SET TotalInvoicePrice = vi.Debit,
                    TotalNetPrice = vi.Debit,
                    TotalCosts =
                    (
                        SELECT SUM(ShareOfCosts)
                        FROM STC.StockReceiptItem
                        WHERE StockReceiptID = vi.StockReceiptID
                    ),
                    TotalEstimatedPrice =
                    (
                        SELECT SUM(EstimatedPrice)
                        FROM STC.StockReceiptItem
                        WHERE StockReceiptID = vi.StockReceiptID
                    )
                FROM STC.StockReceipt v
                    JOIN temp vi
                        ON v.StockReceiptID = vi.StockReceiptID;

                    UPDATE [STC].[StockClosingOperation]
                    SET [Status] = 2
                    WHERE FinancialPeriodID = @FinancialPeriodID
                          AND StockID = @StockID;
            END;
        END;
        
		DROP TABLE IF EXISTS ##FinalPrice;
        DROP TABLE IF EXISTS ##StockReceiptItemTemp;
        DROP TABLE IF EXISTS ##ItemTemp;
        DROP TABLE IF EXISTS ItemTemp;
    END TRY
    BEGIN CATCH
        SELECT @ErrorMessage = ERROR_MESSAGE(),
               @ErrorSeverity = ERROR_SEVERITY(),
               @ErrorState = ERROR_STATE();

        DROP TABLE IF EXISTS ##FinalPrice;
        DROP TABLE IF EXISTS ##StockReceiptItemTemp;
        DROP TABLE IF EXISTS ##ItemTemp;
        DROP TABLE IF EXISTS ItemTemp;

        RAISERROR(   @ErrorMessage,  -- Message text.
                     @ErrorSeverity, -- Severity.
                     @ErrorState     -- State.
                 );

    END CATCH;
END;
