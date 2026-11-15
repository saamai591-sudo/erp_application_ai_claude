CREATE      PROC [VND].[spReturnInvoiceItemInsert]
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
    @Creator int,
    @CreationDate datetime

	--WITH ENCRYPTION
AS 
	SET NOCOUNT ON 
		
		IF (SELECT [date] 
			FROM vnd.ReturnInvoice	 
			WHERE ReturnInvoiceID	 = @ReturnInvoiceID) <= 
			(SELECT Max(EndDate) FROM cfg.Vat v )
		BEGIN
			RAISERROR('VatHasPublished',16,12)
			return
			 --RAISERROR('تغيير اطلاعات بعد از صدور ارزش افزوده مجاز نيست.', 16 , 12)
		END
		
	INSERT INTO [VND].[ReturnInvoiceItem] ([ReturnInvoiceID], [PurchaseInvoiceItemID], ReturnStockReceiptItemID, [RowIndex], [StuffID], [MainQuantity], [SubQuantity], [Fee], [Price],[Discount], [Tax], [Duty], [Net], [Description], [Description2], [Creator], [CreationDate], [LastEditor], [LastEditionDate], [Version])
	SELECT @ReturnInvoiceID, @PurchaseInvoiceItemID, @ReturnStockReceiptItemID, @RowIndex,@StuffID, @MainQuantity, @SubQuantity, @Fee, @Price,@Discount, @Tax, @Duty, @Net, @Description, @Description2, @Creator, @CreationDate, @Creator, @CreationDate, 0
	
	-- Begin Return Select <- do not remove
	SELECT	[ReturnInvoiceItemID], 
			[Version]
	FROM   [VND].[ReturnInvoiceItem]
	WHERE  [ReturnInvoiceItemID] = SCOPE_IDENTITY()
	-- End Return Select <- do not remove
