--------------------------------------end of spTemporaryStockReceiptInsert-----------------------------------------------
CREATE   PROC [STC].[spTemporaryStockReceiptUpdate]
    @TemporaryStockReceiptID INT ,
    @StockDocumentTypeBaseEntityID INT ,
    @Number INT ,
    @Date DATE ,
    @StockID INT ,
    @DeliverDlID BIGINT ,
    @Version INT ,
    @Creator INT ,
    @CreationDate DATETIME ,
    @LastEditor INT ,
    @LastEditionDate DATETIME ,
    @FinancialPeriodID INT
AS
    SET NOCOUNT ON; 


    IF @Version = ( SELECT  [Version]
                    FROM    [STC].[TemporaryStockReceipt]
                    WHERE   [TemporaryStockReceiptID] = @TemporaryStockReceiptID
                  )
        BEGIN	

            SET @Version = @Version + 1; 


            DECLARE @StartNum INT = NULL ,
                @EndNum INT = NULL ,
                @Stock BIT = 0 ,
                @DocumentNumID INT ,
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
                                                          OR StockID = @StockID)
                                         ), @StartNum);
                END;
            ELSE
                BEGIN
                    IF ( EXISTS ( SELECT    *
                                  FROM      [STC].[TemporaryStockReceipt]
                                  WHERE     FinancialPeriodID = @FinancialPeriodID
                                            AND ( @Stock = 0
                                                  OR StockID = @StockID
                                                )
												AND TemporaryStockReceiptID <> @TemporaryStockReceiptID
                                            AND Number = @Number ) )
                        BEGIN
			
                            SELECT  @Message = 'NumberIsDuplicate'
                            RAISERROR(@Message,16,12);
                            RETURN;
                        END;
                END;
	
            IF ( @Number >= @StartNum
                 AND ( @EndNum IS NULL
                       OR @Number <= @EndNum
                     )
               )
                BEGIN
                    UPDATE  [STC].[TemporaryStockReceipt]
                    SET     StockDocumentTypeBaseEntityID = @StockDocumentTypeBaseEntityID ,
                            [Number] = @Number ,
                            [Date] = @Date ,
                            [StockID] = @StockID ,
                            [DeliverDlID] = @DeliverDlID ,
                            [Version] = @Version ,
                            [Creator] = @Creator ,
                            [CreationDate] = @CreationDate ,
                            [LastEditor] = @LastEditor ,
                            [LastEditionDate] = @LastEditionDate ,
                            FinancialPeriodID = @FinancialPeriodID
                    WHERE   [TemporaryStockReceiptID] = @TemporaryStockReceiptID;
	
		-- Begin Return Select <- do not remove
         SELECT  [Version] 
         FROM    [STC].[TemporaryStockReceipt]
         WHERE   [TemporaryStockReceiptID] = @TemporaryStockReceiptID;	
		-- End Return Select <- do not remove

                END; 
        END;
