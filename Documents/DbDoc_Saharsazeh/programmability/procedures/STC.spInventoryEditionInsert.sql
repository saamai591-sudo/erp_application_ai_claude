CREATE PROC [STC].[spInventoryEditionInsert]
    @FinancialPeriodID INT,
    @Number INT,
    @Date DATE,
    @StockID INT,
    @Description2 NVARCHAR(256) = NULL,
    @Description NVARCHAR(256) = NULL,
    @StockReceiptID INT = NULL,
    @OutgoingID INT = NULL,
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
         
	)
	BEGIN
		RAISERROR(N'StockManager.InventoryEditionStockIssue', 16, 12);
		RETURN 0;
	END;
	SET @Number = ISNULL(
				  (
					  SELECT MAX(ie.Number)
					  FROM [STC].[InventoryEdition] AS ie
					  WHERE @FinancialPeriodID = @FinancialPeriodID
				  ),
				  0
						) + 1;

	INSERT INTO [STC].[InventoryEdition]
	(
		[FinancialPeriodID],
		[Number],
		[Date],
		[StockID],
		[Description2],
		[Description],
		[StockReceiptID],
		[OutgoingID],
		[Version],
		[Creator],
		[CreationDate],
		[LastEditor],
		[LastEditionDate]
	)
	SELECT @FinancialPeriodID,
		   @Number,
		   @Date,
		   @StockID,
		   @Description2,
		   @Description,
		   @StockReceiptID,
		   @OutgoingID,
		   0,
		   @Creator,
		   @CreationDate,
		   @LastEditor,
		   @LastEditionDate;

	-- Begin Return Select <- do not remove
	SELECT [InventoryEditionID],
		   [Version],
		   [Number]
	FROM [STC].[InventoryEdition]
	WHERE [InventoryEditionID] = SCOPE_IDENTITY();
	-- End Return Select <- do not remove
END
