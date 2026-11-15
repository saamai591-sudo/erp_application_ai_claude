
--------------------------------------------------------------------------------------------------------------
CREATE   PROC [STC].[spReturnedTemporaryStockReceiptInsert] 
    @StockDocumentTypeBaseEntityID INT ,
    @Number int,
    @Date date,
    @StockID int,
    @DeliverDlID bigint,
    @LastEditionDate datetime,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @FinancialPeriodID int
AS 
BEGIN
	SET NOCOUNT ON 

	 DECLARE @StartNum INT = NULL ,
        @EndNum INT = NULL ,
        @Stock BIT = 0 ,
        @ResetType BIT = 0 ,
        @StockDocumentTypeID INT,
        @DocumentNumID INT ,
        @DocumentNumTypeID INT ,
        @Message NVARCHAR(MAX);
			
		
    SELECT  @DocumentNumTypeID = DocumentNumTypeID
    FROM    [CFG].[DocumentNumType]
    WHERE   EngName = 'ReturnedTemporaryStockReceipt';		


    SELECT  @StockDocumentTypeID = StockDocumentTypeID
    FROM    stc.StockDocumentTypeBaseEntity sdtb
	where sdtb.StockDocumentTypeBaseEntityID = @StockDocumentTypeBaseEntityID
			
    SELECT  @StartNum = StartNum ,
            @EndNum = EndNum ,
            @DocumentNumID = DocumentNumID
    FROM    CFG.DocumentNum
    WHERE   DocumentNumTypeID = @DocumentNumTypeID
            AND FinancialPeriodID = @FinancialPeriodID;


    IF EXISTS ( SELECT  1
                FROM    CFG.DocumentNumResetNumberBase
                WHERE   DocumentNumID = @DocumentNumID
                        AND DocumentNumResetNumberBaseTypeID = 3 )
        BEGIN
            SET @Stock = 1;
        END;
	
    IF ( EXISTS ( SELECT    1
                  FROM      CFG.DocumentNumResetNumberBase
                  WHERE     DocumentNumID = 217
                            AND DocumentNumResetNumberBaseTypeID = 2 ) )
        BEGIN
            SET @ResetType = 1;
        END;

    IF ( @Number = 0
         OR @Number IS NULL
       )
        BEGIN
		
            SET @Number = ISNULL(( SELECT   MAX(Number) + 1
                                   FROM     [STC].[ReturnedTemporaryStockReceipt] rtsr
                                   JOIN [STC].[StockDocumentTypeBaseEntity] sdtb
                                        ON rtsr.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
                                   WHERE    FinancialPeriodID = @FinancialPeriodID
                                            AND ( @Stock = 0
                                                  OR StockID = @StockID
                                                )
                                            AND ( @ResetType = 0
                                                  OR sdtb.StockDocumentTypeID = @StockDocumentTypeID
                                                )
                                 ), @StartNum);
        END;
    ELSE
        BEGIN
            IF ( EXISTS ( SELECT    1
                          FROM      [STC].[ReturnedTemporaryStockReceipt] rtsr
                          JOIN [STC].[StockDocumentTypeBaseEntity] sdtb
                                ON rtsr.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
                          WHERE     FinancialPeriodID = @FinancialPeriodID
                                    AND ( @Stock = 0
                                          OR StockID = @StockID
                                        )
                                    AND ( @ResetType = 0
                                          OR sdtb.[StockDocumentTypeID] = @StockDocumentTypeID
                                        )
                                    AND Number = @Number ) )
                BEGIN
			
                   
			
                    RAISERROR('NumberIsDuplicate',16,12);
                    RETURN 0;
                END;
        END;
	
    IF ( @Number >= @StartNum
         AND ( @EndNum IS NULL
               OR @Number <= @EndNum
             )
       )
        BEGIN

	        INSERT INTO [STC].[ReturnedTemporaryStockReceipt] ([StockDocumentTypeBaseEntityID], [Number], [Date], [StockID], [DeliverDlID], [LastEditionDate], [Version], [Creator], [CreationDate], [LastEditor], [FinancialPeriodID])
	        SELECT @StockDocumentTypeBaseEntityID, @Number, @Date, @StockID, @DeliverDlID, @LastEditionDate, 0, @Creator, @CreationDate, @LastEditor, @FinancialPeriodID
	
	        -- Begin Return Select <- do not remove
	        SELECT [ReturnedTemporaryStockReceiptID],
                    [Version],
                    [Number]
	        FROM   [STC].[ReturnedTemporaryStockReceipt]
	        WHERE  [ReturnedTemporaryStockReceiptID] = SCOPE_IDENTITY()
	        -- End Return Select <- do not remove
        END
END;
