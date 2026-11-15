-------------------------------------
CREATE   PROC [STC].spReturnConterventionRecountingInventory
(
    @RecountingInventoryID INT = NULL,
    @InventoryEditionID INT = NULL
)
--WITH ENCRYPTION 
AS
BEGIN

    SET NOCOUNT ON;



        DECLARE @RecountingInventoryTagID INT,
                @StockReceiptID INT,
                @OutgoingID INT,
                @Message NVARCHAR(MAX),
                @StockID INT,
                @Date DATE, 
                @FinalStuffInventoryErrors NVARCHAR(MAX),@FinalStuffInventoryErrors1 NVARCHAR(MAX)
        set @FinalStuffInventoryErrors = cfg.getTempTableName(1)
        set @FinalStuffInventoryErrors1 = cfg.getTempTableName(1);
	
        CREATE TABLE  #error  (
        [Message] NVARCHAR(MAX) ,
        IsDetail BIT )

        IF @RecountingInventoryID IS NOT NULL
        BEGIN

        
            SELECT @RecountingInventoryTagID = ri.RecountingInventoryTagID,
                   @StockReceiptID = ri.StockReceiptID,
                   @OutgoingID = ri.OutgoingID,
                   @StockID = rip.StockID,
                   @Date = rip.Date
            FROM STC.RecountingInventory ri
                JOIN STC.RecountingInventoryTag rit
                    ON ri.RecountingInventoryTagID = rit.RecountingInventoryTagID
                JOIN STC.RecountingInventoryPeriod rip
                    ON rit.RecountingInventoryPeriodID = rip.RecountingInventoryPeriodID 
            WHERE ri.RecountingInventoryID = @RecountingInventoryID;
        END;

        IF @InventoryEditionID IS NOT NULL
        BEGIN
            SELECT @StockReceiptID = rit.StockReceiptID,
                   @OutgoingID = rit.OutgoingID,
                   @StockID = rit.StockID,
                   @Date = rit.Date
            FROM STC.InventoryEdition AS rit
            WHERE rit.InventoryEditionID = @InventoryEditionID;
        END;

        IF (
               @RecountingInventoryID IS NOT NULL
               AND EXISTS
        (
            SELECT 1
            FROM STC.RecountingInventoryTag rit
            JOIN STC.RecountingInventoryPeriod rip
                ON rit.RecountingInventoryPeriodID = rip.RecountingInventoryPeriodID 
            WHERE rip.StockID = @StockID
                  AND rip.[Date] > @Date
                  AND Status = 1
        )
           )
           OR
           (
               @InventoryEditionID IS NOT NULL
               AND EXISTS
        (
            SELECT 1
            FROM STC.InventoryEdition AS ie
            WHERE ie.Date > @Date
                  AND ie.StockID = @StockID
                  AND ie.Status = 1
        )
           )
        BEGIN
            SET @Message = N'برای این انبار در تاریخهای بعدی عملیات مغایرت گیری انجام شده است.';
			INSERT INTO #error values(@Message,0);

				SELECT * FROM #error
				RETURN;
        END;

        IF (@StockReceiptID IS NOT NULL AND @StockReceiptID <> 0)
        BEGIN
            IF
            (
                SELECT PreVoucherID
                FROM STC.StockReceipt
                WHERE StockReceiptID = @StockReceiptID
            ) IS NOT NULL
			Begin
			SET @Message = N'STC_spReturnConterventionRecountingInventory_1';
				INSERT INTO #error values(@Message,0);
				SELECT * FROM #error
				RETURN;
			END
			
   if @StockReceiptID is not null
			begin 
				
				

			declare @CastedStockReceiptID nvarchar(MAX)
			set  @CastedStockReceiptID = cast(@StockReceiptID as nvarchar(MAX))
		
            exec [STC].SpFinalStuffInventory 
			@ID					= Null,
			@EntityName			= 'StockReceipt',
			@Confirmed			= 2,
			@IsDeleteOperation  = 1,
			@HeaderIDs			= @CastedStockReceiptID,
			@ControlType		= 0,
			@RecountingInvetoryID = @RecountingInventoryID,
			@InventoryEditionID = @InventoryEditionID ,
			@ErrorTable = @FinalStuffInventoryErrors
			
			
			
						
			EXEC (N'insert into #error select * from '+@FinalStuffInventoryErrors)		

			IF EXISTS(SELECT 1 FROM #error)
			BEGIN
				SELECT * FROM #error
				RETURN 
			END 

			end
        END;


        IF (@OutgoingID IS NOT NULL AND @OutgoingID <> 0)
        BEGIN
            


            IF
            (
                SELECT PreVoucherID FROM STC.Outgoing WHERE OutgoingID = @OutgoingID
            ) IS NOT NULL
			Begin
				SET @Message = N'STC_spReturnConterventionRecountingInventory_2';
                INSERT INTO #error values(@Message,0);
				
				SELECT * FROM #error
				RETURN;
			END

IF @OutgoingID is not null
		begin 

					declare @CastedOutgoingID nvarchar(MAX)
			set @CastedOutgoingID = cast(@OutgoingID as nvarchar(MAX))

		
			exec [STC].SpFinalStuffInventory 
			@ID					= Null,
			@EntityName			= 'Outgoing',
			@Confirmed			= 2,
			@IsDeleteOperation  = 1,
			@HeaderIDs			= @CastedOutgoingID,
			@ControlType		= 0,
			@RecountingInvetoryID = @RecountingInventoryID,
			@InventoryEditionID = @InventoryEditionID ,
            @ErrorTable = @FinalStuffInventoryErrors1
					
			EXEC (N'insert into #error select * from '+@FinalStuffInventoryErrors1)		

			IF EXISTS(SELECT 1 FROM #error)
			BEGIN
				SELECT * FROM #error
				RETURN 
			END 

					
		end
   END;

        IF @RecountingInventoryID IS NOT NULL
        BEGIN		
            UPDATE STC.RecountingInventory
            SET StockReceiptID = NULL,
                OutgoingID = NULL,
                [Status] = 0
            WHERE RecountingInventoryID = @RecountingInventoryID;

            UPDATE STC.RecountingInventoryTag
            SET [Status] = 2
            WHERE RecountingInventoryTagID = @RecountingInventoryTagID;

        END;

        IF @InventoryEditionID IS NOT NULL
        BEGIN

            UPDATE STC.InventoryEdition
            SET StockReceiptID = NULL,
                OutgoingID = NULL,
                [Status] = 0
            WHERE InventoryEditionID = @InventoryEditionID;

        END;
		DELETE FROM STC.Outgoing
		WHERE OutgoingID = @OutgoingID;
					
        DELETE FROM STC.StockReceipt
        WHERE StockReceiptID = @StockReceiptID;
				
		SELECT * FROM #error
   
				
	
END;

