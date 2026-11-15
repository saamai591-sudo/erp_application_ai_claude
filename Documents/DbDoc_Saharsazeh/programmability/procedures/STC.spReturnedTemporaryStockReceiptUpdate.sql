
--------------------------------------------------------------------------------------------------------------
CREATE   PROC [STC].[spReturnedTemporaryStockReceiptUpdate] 
    @ReturnedTemporaryStockReceiptID int,
    @StockDocumentTypeBaseEntityID INT ,
    @Number int,
    @Date date,
    @StockID int,
    @DeliverDlID bigint,
    @LastEditionDate datetime,
    @Version int,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @FinancialPeriodID INT
    --WITH ENCRYPTION
AS 
BEGIN
	SET NOCOUNT ON 

	if @Version=(Select [Version] from [STC].[ReturnedTemporaryStockReceipt]
	where [ReturnedTemporaryStockReceiptID] = @ReturnedTemporaryStockReceiptID)
	begin	
            DECLARE @StartNum INT = NULL ,
                @EndNum INT = NULL ,
                @Stock BIT = 0 ,
                @ResetType BIT = 0 ,
                @StockDocumentTypeID int,
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
                    IF ( EXISTS ( SELECT    *
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
												AND ReturnedTemporaryStockReceiptID <> @ReturnedTemporaryStockReceiptID
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
		    set @Version = @Version +1 

		    UPDATE [STC].[ReturnedTemporaryStockReceipt]
		    SET     [StockDocumentTypeBaseEntityID] = @StockDocumentTypeBaseEntityID, 
                    [Number] = @Number,
                    [Date] = @Date, 
                    [StockID] = @StockID, 
                    [DeliverDlID] = @DeliverDlID, 
                    [LastEditionDate] = @LastEditionDate, 
                    [Version] = @Version, 
                    [Creator] = @Creator, 
                    [CreationDate] = @CreationDate, 
                    [LastEditor] = @LastEditor,
                    [FinancialPeriodID] = @FinancialPeriodID
		    WHERE  [ReturnedTemporaryStockReceiptID] = @ReturnedTemporaryStockReceiptID
	
		    -- Begin Return Select <- do not remove
		    SELECT  [Version] ,
                    [Number]
            FROM   [STC].[ReturnedTemporaryStockReceipt]
		    WHERE  [ReturnedTemporaryStockReceiptID] = @ReturnedTemporaryStockReceiptID	
		    -- End Return Select <- do not remove
		END
        
	end 
END;
