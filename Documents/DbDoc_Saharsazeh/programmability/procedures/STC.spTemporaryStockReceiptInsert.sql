-------------------------------------------------------------------------------------
CREATE   PROC [STC].[spTemporaryStockReceiptInsert]
    @StockDocumentTypeBaseEntityID INT ,
    @Number INT ,
    @Date DATE ,
    @StockID INT ,
    @DeliverDlID BIGINT ,
    @Creator INT ,
    @CreationDate DATETIME ,
    @LastEditor INT ,
    @LastEditionDate DATETIME ,
    @FinancialPeriodID INT
AS
BEGIN
    SET NOCOUNT ON; 

    DECLARE @StartNum INT = NULL ,
        @EndNum INT = NULL ,
        @Stock BIT = 0 ,
        @DocumentNumID INT ,
		@StockDocumentTypeID INT,
        @DocumentNumTypeID INT ,
        @Message NVARCHAR(MAX);

    SELECT  @DocumentNumTypeID = DocumentNumTypeID
    FROM    [CFG].[DocumentNumType]
    WHERE   EngName = 'TemporaryStockReceipt';
			
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
	
    IF ( @Number = 0
         OR @Number IS NULL
       )
        BEGIN
		
            SET @Number = ISNULL(( SELECT   MAX(Number) + 1
                                   FROM     [STC].[TemporaryStockReceipt]
                                   WHERE    FinancialPeriodID = @FinancialPeriodID
                                            AND ( @Stock = 0
                                                  OR StockID = @StockID
                                                )
                                 ), @StartNum);
        END;
    ELSE
        BEGIN
            IF ( EXISTS ( SELECT   1
                          FROM      [STC].[TemporaryStockReceipt]
                          WHERE     FinancialPeriodID = @FinancialPeriodID
                                    AND ( @Stock = 0
                                          OR StockID = @StockID
                                        )
                                    AND Number = @Number ) )
                BEGIN
			
                    SELECT  @Message = 'NumberIsDuplicate'
                  
			
                    RAISERROR(@Message,16,12);
                    RETURN 0;
                END;
        END;
	
    IF ( @Number >= @StartNum
         AND ( @EndNum IS NULL
               OR @Number <= @EndNum
             )
       )
        BEGIN
	
            INSERT  INTO [STC].[TemporaryStockReceipt]
                    ( [StockDocumentTypeBaseEntityID] ,
                      [Number] ,
                      [Date] ,
                      [StockID] ,
                      [DeliverDlID] ,
                      [Version] ,
                      [Creator] ,
                      [CreationDate] ,
                      [LastEditor] ,
                      [LastEditionDate] ,
                      [FinancialPeriodID]
                    )
                    SELECT  @StockDocumentTypeBaseEntityID ,
                            @Number ,
                            @Date ,
                            @StockID ,
                            @DeliverDlID ,
                            0 ,
                            @Creator ,
                            @CreationDate ,
                            @LastEditor ,
                            @LastEditionDate ,
                            @FinancialPeriodID;
	
	-- Begin Return Select <- do not remove
            SELECT  [TemporaryStockReceiptID] ,
                    [Version] ,
                    [Number] 
            FROM    [STC].[TemporaryStockReceipt]
            WHERE   [TemporaryStockReceiptID] = SCOPE_IDENTITY();
	-- End Return Select <- do not remove
            
        END;   

END;
