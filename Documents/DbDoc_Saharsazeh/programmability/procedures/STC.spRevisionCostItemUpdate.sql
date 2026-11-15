CREATE PROC [STC].[spRevisionCostItemUpdate] 
    @RevisionCostItemID int,
    @RevisionCostID int,
    @StockReceiptItemID int,
    @ReturnedOutgoingItemID int,
    @RevisionFee decimal(30, 4),
    @RevisionPrice decimal(30, 4),
    @Deference decimal(30, 4),
    @Description nvarchar(256),
    @Description2 nvarchar(256),
    @Version int,
    @LastEditor int,
    @LastEditionDate datetime,
    @ReturnStockReceiptItemID int,
    @OutgoingItemID INT,
    @PosInvoiceItemID int,
    @PosReturnInvoiceItemID int
	--WITH ENCRYPTION 
AS 
BEGIN
	SET NOCOUNT ON 

	DECLARE @PrePrevoucher INT
	
	SELECT @PrePrevoucher = PreVoucherID
	FROM stc.RevisionCost rc
	WHERE rc.RevisionCostID = @RevisionCostID
	
	if @Version <> (Select [Version] from [STC].[RevisionCostItem]
	where [RevisionCostItemID] = @RevisionCostItemID)
	or @PrePrevoucher is not null	
	begin
		RAISERROR('Version mismatch...', 16 , 10)	
		return
	end

		DECLARE @LastDate  DATETIME = NULL, 
				@CurrentItemDate  DATETIME = NULL				
	
		IF (@StockReceiptItemID IS NOT NULL AND @StockReceiptItemID <> 0)
		BEGIN
			
			SELECT top(1) @LastDate = Date From [STC].[RevisionCost] 
							 WHERE RevisionCostID IN (SELECT RevisionCostID
													  FROM   [STC].[RevisionCostItem]
													  WHERE StockReceiptItemID = @StockReceiptItemID 
													  AND RevisionCostID <> @RevisionCostID)
							ORDER BY Date DESC
		END
		ELSE IF (@ReturnedOutgoingItemID IS NOT NULL AND @ReturnedOutgoingItemID <> 0)
		BEGIN
			SELECT top(1) @LastDate = Date From [STC].[RevisionCost] 
							 WHERE RevisionCostID IN (SELECT RevisionCostID
													  FROM   [STC].[RevisionCostItem]
													  WHERE ReturnedOutgoingItemID = @ReturnedOutgoingItemID 
													  AND RevisionCostID <> @RevisionCostID)
							ORDER BY Date DESC
		END
		
		SET @CurrentItemDate = (SELECT Date From [STC].[RevisionCost] 
									WHERE RevisionCostID = @RevisionCostID) 
									
		IF (@LastDate IS NOT NULL AND @LastDate > @CurrentItemDate)
		BEGIN
			DECLARE @Message NVARCHAR(MAX)
			SELECT @Message ='STC_spRevisionCostItemInsert_1'
			RAISERROR(@Message,16,12)			
			return
		END

		UPDATE [STC].[RevisionCostItem]
		SET     StockReceiptItemID = @StockReceiptItemID, 
				ReturnedOutgoingItemID = @ReturnedOutgoingItemID, 
				[RevisionFee] = @RevisionFee, 
				[RevisionPrice] = @RevisionPrice, 
				[Deference] = @Deference, 
				[Description] = @Description, 
				[Description2] = @Description2,  
				[Version] = @Version + 1,
				[LastEditor] = @LastEditor, 
				[LastEditionDate] = @LastEditionDate,
				[ReturnStockReceiptItemID] = @ReturnStockReceiptItemID , 
				[OutgoingItemID]= @OutgoingItemID
		WHERE  [RevisionCostItemID] = @RevisionCostItemID
	
		-- Begin Return Select <- do not remove
		SELECT  [Version] 
        FROM   [STC].[RevisionCostItem]
		WHERE  [RevisionCostItemID] = @RevisionCostItemID	
		-- End Return Select <- do not remove
END
