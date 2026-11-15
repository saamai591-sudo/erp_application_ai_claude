CREATE   PROC [STC].[spInventoryEditionUpdate]
    @InventoryEditionID INT,
    @FinancialPeriodID INT,
    @Number INT,
    @Date DATE,
    @StockID INT,
    @Description2 NVARCHAR(256) = NULL,
    @Description NVARCHAR(256) = NULL,
    @StockReceiptID INT = NULL,
    @OutgoingID INT = NULL,
    @Version INT,
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME
AS
BEGIN
	SET NOCOUNT ON;

	IF EXISTS
	(
		SELECT 1
		FROM STC.InventoryEdition AS ie
		WHERE ie.Date = @Date
			  AND ie.FinancialPeriodID = @FinancialPeriodID
			  AND ie.StockID = @StockID
			  AND ie.InventoryEditionID <> @InventoryEditionID
	)
	BEGIN
		RAISERROR(N'StockManager.InventoryEditionStockIssue', 16, 12);
		RETURN 0;
	END;

	IF @Version =
	(
		SELECT [Version]
		FROM [STC].[InventoryEdition]
		WHERE [InventoryEditionID] = @InventoryEditionID
	)
	BEGIN

		SET @Version = @Version + 1;

		UPDATE [STC].[InventoryEdition]
		SET [FinancialPeriodID] = @FinancialPeriodID,
			[Number] = @Number,
			[Date] = @Date,
			[StockID] = @StockID,
			[Description2] = @Description2,
			[Description] = @Description,
			[StockReceiptID] = @StockReceiptID,
			[OutgoingID] = @OutgoingID,
			[Version] = @Version,
			[Creator] = @Creator,
			[CreationDate] = @CreationDate,
			[LastEditor] = @LastEditor,
			[LastEditionDate] = @LastEditionDate
		WHERE [InventoryEditionID] = @InventoryEditionID;

		-- Begin Return Select <- do not remove
		SELECT  [Version],
				[Number]
		FROM [STC].[InventoryEdition]
		WHERE [InventoryEditionID] = @InventoryEditionID;
	-- End Return Select <- do not remove

	END;
END
