
--------------------------------------------
CREATE   PROC [STC].SpStockReceiptItemInsert
	@StockReceiptID INT,
	@RowIndex SMALLINT,
	@OutgoingItemID INT = NULL,
	@PurchaseInvoiceItemID INT = NULL,
	@StuffID INT,
	@MainQuantity DECIMAL(36, 10),
	@SubQuantity DECIMAL(36, 10) = NULL,
	@Fee DECIMAL(36, 10),
	@Price DECIMAL(36, 10),
	@EstimatedFee DECIMAL(36, 10),
	@EstimatedPrice DECIMAL(36, 10),
	@ShareOfCosts DECIMAL(36, 10),
	@NetPrice DECIMAL(36, 10),
	@Description NVARCHAR(256) = NULL,
	@Description2 NVARCHAR(256) = NULL,
	@Creator INT,
	@CreationDate DATETIME,
	@ProposalItemID INT = NULL,
	@JustificationInputItemID INT = NULL,
	@PurchaseRequestItemID INT = NULL,
	@PurchaseContractItemID INT = NULL,
	@DeliveryJustificationItemID INT = NULL,
	@ClearanceItemID INT = NULL,
	@ConvertSpecificationID INT = NULL,
	@ContractSubjectID INT = NULL,
	@ProductionPlanningItemID INT = NULL,
	@ProductionStatisticItemID INT = NULL

--WITH ENCRYPTION
AS
SET NOCOUNT ON;
BEGIN


	DECLARE @Message NVARCHAR(MAX),
			@userCulture NVARCHAR(20);

	SET @userCulture = CFG.GetuserCulture();

	IF EXISTS
	(
		SELECT PreVoucherID
		FROM STC.StockReceipt
		WHERE StockReceiptID = @StockReceiptID AND PreVoucherID IS NOT NULL
	)
	BEGIN
		RAISERROR('رسید مورد نظر در حسابداری انبار دارای گردش است.', 16, 12);
		RETURN 0;
	END;

	IF (@OutgoingItemID IS NOT NULL)
	BEGIN

		SELECT @Message = lsv.Value
		FROM CFG.LocalizationSQLMessage ls
			JOIN CFG.LocalizationSQLMessageValue lsv
				ON lsv.LocalizationSQLMessageID = ls.LocalizationSQLMessageID
		WHERE ls.SQLMessageCode = 'MinusOutgoing'
			  AND lsv.Culture = @userCulture;

		IF EXISTS
		(
			SELECT MainQuantity
			FROM [STC].[OutgoingItem]
			WHERE OutgoingItemID = @OutgoingItemID
				  AND MainQuantity < @MainQuantity
		)
		BEGIN
			DECLARE @Stuff_Code NVARCHAR(256);

			SELECT @Stuff_Code = Code
			FROM [STF].[Stuff]
			WHERE StuffID = @StuffID;

			SET @Message = REPLACE(@Message, '{0}', @Stuff_Code);

			RAISERROR(@Message, 16, 12);
			RETURN 0;
		END;
	END;

	DECLARE @StockReceiptItemID INT;

	INSERT INTO [STC].[StockReceiptItem]
	(
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
		[LastEditionDate],
		[ProposalItemID],
		[JustificationInputItemID],
		[PurchaseRequestItemID],
		[PurchaseContractItemID],
		[DeliveryJustificationItemID],
		[ClearanceItemID],
		ConvertSpecificationID,
		ContractSubjectID,
		ProductionPlanningItemID,
		ProductionStatisticItemID
	)
	SELECT @StockReceiptID,
		   @RowIndex,
		   @OutgoingItemID,
		   @PurchaseInvoiceItemID,
		   @StuffID,
		   @MainQuantity,
		   @SubQuantity,
		   @Fee,
		   @Price,
		   @EstimatedFee,
		   @EstimatedPrice,
		   @ShareOfCosts,
		   @Description,
		   @Description2,
		   0,
		   @Creator,
		   @CreationDate,
		   @Creator,
		   @CreationDate,
		   @ProposalItemID,
		   @JustificationInputItemID,
		   @PurchaseRequestItemID,
		   @PurchaseContractItemID,
		   @DeliveryJustificationItemID,
		   @ClearanceItemID,
		   @ConvertSpecificationID,
		   @ContractSubjectID,
		   @ProductionPlanningItemID,
		   @ProductionStatisticItemID;

	SET @StockReceiptItemID = SCOPE_IDENTITY();

	IF EXISTS
	(
		SELECT 1
		FROM VND.PurchaseInvoice_Remains
		WHERE PurchaseInvoiceItemID = @PurchaseInvoiceItemID
			  AND DoMainQuantity > MainQuantity
	)
	BEGIN
		RAISERROR(N'مانده رسید نشده فاکتور نمی تواند منفی باشد', 16, 12);
	END;

	-- Begin Return Select <- do not remove
	SELECT [StockReceiptItemID],
		   [Version],
		   [NetPrice]
	FROM [STC].[StockReceiptItem]
	WHERE [StockReceiptItemID] = @StockReceiptItemID;
-- End Return Select <- do not remove

END;
