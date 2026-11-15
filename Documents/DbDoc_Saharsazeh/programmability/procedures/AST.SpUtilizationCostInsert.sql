------------------------------------
CREATE   PROC [AST].[SpUtilizationCostInsert] 
    @CreationID int,
	@BaseType TINYINT,
    @PurchaseInvoiceItemID int = NULL,
    @OutgoingItemID int = NULL,
    @StuffID int,
	@MainQuantity DECIMAL(36, 10),
	@SubQuantity DECIMAL(36, 10),
    @Price decimal(30, 4),
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime 

--WITH ENCRYPTION 
	 AS 
SET NOCOUNT ON 

	declare @FinancialPeriod int

	select @FinancialPeriod = FinancialPeriodID from ast.Creation where CreationID = @CreationID

	if exists (
	select * from ast.AssetClosingOperation 
	where FinancialPeriodID = @FinancialPeriod)	
		RAISERROR('به دلیل بسته بودن سیستم دارایی ثابت، انجام این عملیات مجاز نیست.', 16, 10)

	INSERT INTO [AST].[UtilizationCost] ([CreationID], [BaseType], [PurchaseInvoiceItemID], [OutgoingItemID], [StuffID], [MainQuantity], [SubQuantity], [Price], [Version], [Creator], [CreationDate], [LastEditor], [LastEditionDate])
	SELECT @CreationID, @BaseType, @PurchaseInvoiceItemID, @OutgoingItemID, @StuffID, @MainQuantity, @SubQuantity, @Price, 0, @Creator, @CreationDate, @LastEditor, @LastEditionDate
	
	-- Begin Return Select <- do not remove
	SELECT [UtilizationCostID], [Version]
	FROM   [AST].[UtilizationCost]
	WHERE  [UtilizationCostID] = SCOPE_IDENTITY()
	-- End Return Select <- do not remove
	
	IF (@PurchaseInvoiceItemID IS NOT NULL)
	BEGIN
		DECLARE @Num int = null

		SELECT @Num = p.Number
        FROM VND.PurchaseInvoiceItem i
        JOIN VND.PurchaseInvoice p ON p.PurchaseInvoiceID = i.PurchaseInvoiceID
        JOIN VND.PurchaseInvoice_PriceRemains pr ON i.PurchaseInvoiceItemID = pr.PurchaseInvoiceItemID
        WHERE i.PurchaseInvoiceItemID = @PurchaseInvoiceItemID and pr.Non < 0

		IF (@Num is not null)
		BEGIN
			RAISERROR('مانده مستهلک نشده فاکتور خرید شماره (%d) منفی خواهد شد.',16,12,@Num)
		END
	END
