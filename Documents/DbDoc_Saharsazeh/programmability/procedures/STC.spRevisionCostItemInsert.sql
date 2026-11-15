CREATE PROC [STC].[spRevisionCostItemInsert] 
    @RevisionCostID int,
    @StockReceiptItemID int,
    @ReturnedOutgoingItemID int,
    @RevisionFee decimal(30, 4),
    @RevisionPrice decimal(30, 4),
    @Deference decimal(30, 4),
    @Description nvarchar(256),
    @Description2 nvarchar(256),
    @Creator int,
    @CreationDate datetime,
    @ReturnStockReceiptItemID int,
    @OutgoingItemID int,
    @PosInvoiceItemID int,
    @PosReturnInvoiceItemID int
--WITH ENCRYPTION 
AS 
BEGIN
	SET NOCOUNT ON 
	DECLARE @LastDate  DATETIME = NULL, 
			@CurrentItemDate  DATETIME = NULL
	
	IF (@StockReceiptItemID IS NOT NULL )
	BEGIN
		SELECT top(1) @LastDate = Date From [STC].[RevisionCost] 
						 WHERE RevisionCostID IN (SELECT RevisionCostID
												  FROM   [STC].[RevisionCostItem]
												  WHERE StockReceiptItemID = @StockReceiptItemID)
						ORDER BY Date DESC
	END
	ELSE IF (@ReturnedOutgoingItemID IS NOT NULL )
	BEGIN
		SELECT top(1) @LastDate = Date From [STC].[RevisionCost] 
						 WHERE RevisionCostID IN (SELECT RevisionCostID
												  FROM   [STC].[RevisionCostItem]
												  WHERE ReturnedOutgoingItemID = @ReturnedOutgoingItemID)
						ORDER BY Date DESC
	END
	
	SET @CurrentItemDate = (SELECT Date From [STC].[RevisionCost] 
								WHERE RevisionCostID = @RevisionCostID) 
								
	IF (@LastDate IS NOT NULL AND @LastDate >= @CurrentItemDate)
	BEGIN		
		DECLARE @Message NVARCHAR(MAX)
		SELECT @Message = 'STC_spRevisionCostItemInsert_1'
		RAISERROR(@Message,16,12)
		return
	END
	
	INSERT INTO [STC].[RevisionCostItem] ([RevisionCostID], [StockReceiptItemID], [ReturnedOutgoingItemID], [RevisionFee], [RevisionPrice], [Deference], [Description], [Description2],   [Version], [Creator], [CreationDate], [LastEditor], [LastEditionDate],[ReturnStockReceiptItemID],[OutgoingItemID])
	SELECT @RevisionCostID, @StockReceiptItemID, @ReturnedOutgoingItemID, @RevisionFee, @RevisionPrice, @Deference, @Description, @Description2, 0, @Creator, @CreationDate, @Creator, @CreationDate,@ReturnStockReceiptItemID,@OutgoingItemID
	
	-- Begin Return Select <- do not remove
	SELECT	[RevisionCostItemID],
			[Version]
	FROM   [STC].[RevisionCostItem]
	WHERE  [RevisionCostItemID] = SCOPE_IDENTITY()
	-- End Return Select <- do not remove
END
