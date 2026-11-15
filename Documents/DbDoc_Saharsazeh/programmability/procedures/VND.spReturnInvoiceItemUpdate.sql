CREATE      PROC [VND].[spReturnInvoiceItemUpdate]
    @ReturnInvoiceItemID int,
    @ReturnInvoiceID int,
    @PurchaseInvoiceItemID int,
	@ReturnStockReceiptItemID int,
    @RowIndex smallint,
    @StuffID int,
    @MainQuantity decimal(36,10),
    @SubQuantity decimal(36,10),
    @Fee decimal(36,10),
    @Price decimal(36,10),
	@Discount decimal(36,10),
    @Tax decimal(36,10),
    @Duty decimal(36,10),
    @Net decimal(36,10),
    @Description nvarchar(MAX),
    @Description2 nvarchar(MAX),
    @LastEditor int,
    @LastEditionDate datetime,
    @Version int

	--WITH ENCRYPTION
AS 
	SET NOCOUNT ON 

		IF (SELECT [date] 
			FROM vnd.ReturnInvoice	 
			WHERE ReturnInvoiceID	 = @ReturnInvoiceID) <= 
			(SELECT Max(EndDate) FROM cfg.Vat v )
		BEGIN
			RAISERROR('VatHasPublished',16,12)
			RETURN
			--RAISERROR('تغيير اطلاعات بعد از صدور ارزش افزوده مجاز نيست.', 16 , 12)
		END

	DECLARE @PreVersion INT,
			@PrePrevoucherid INT,
			@PrePurchaseInvoiceItemID INT

	Select  @PreVersion = rii.[Version],
			@PrePrevoucherid = ri.PreVoucherID,
			@PrePurchaseInvoiceItemID = rii.PurchaseInvoiceItemID
	from [VND].[ReturnInvoiceItem] rii
		 JOIN vnd.ReturnInvoice ri ON ri.ReturnInvoiceID = rii.ReturnInvoiceID
	where [ReturnInvoiceItemID] = @ReturnInvoiceItemID
	
	if @Version <> @PreVersion or @prePrevoucherID is not null
	RAISERROR('Version mismatch...', 16 , 10)
	
	UPDATE [VND].[ReturnInvoiceItem]
	SET		[PurchaseInvoiceItemID] = @PurchaseInvoiceItemID, 
			ReturnStockReceiptItemID = @ReturnStockReceiptItemID, 
			[RowIndex] = @RowIndex, 
			[StuffID] = @StuffID, 
			[MainQuantity] = @MainQuantity, 
			[SubQuantity] = @SubQuantity, 
			[Fee] = @Fee, 
			[Price] = @Price, 
			[Discount] = @Discount,
			[Tax] = @Tax, 
			[Duty] = @Duty, 
			[Net] = @Net, 
			[Description] = @Description, 
			[Description2] = @Description2, 
			[LastEditor] = @LastEditor, 
			[LastEditionDate] = @LastEditionDate, 
			[Version] = @Version + 1
	WHERE  [ReturnInvoiceItemID] = @ReturnInvoiceItemID
	
	
		-- Begin Return Select <- do not remove
	SELECT [Version]
	FROM   [VND].[ReturnInvoiceItem]
	WHERE  [ReturnInvoiceItemID] = @ReturnInvoiceItemID	
	-- End Return Select <- do not remove
