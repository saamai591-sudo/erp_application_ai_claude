------------------------------------
CREATE   PROC [AST].[SpUtilizationCostUpdate] 
    @UtilizationCostID int,
    @CreationID int,
	@BaseType TINYINT,
    @PurchaseInvoiceItemID int = NULL,
    @OutgoingItemID int = NULL,
    @StuffID int,
	@MainQuantity DECIMAL(36, 10),
	@SubQuantity DECIMAL(36, 10),
    @Price decimal(30, 4),
    @Version int,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime

--WITH ENCRYPTION 
	 AS 
SET NOCOUNT ON 

	if @Version <> (Select [Version] from [AST].[UtilizationCost]
				where [UtilizationCostID] = @UtilizationCostID)
	RAISERROR('Version mismatch...', 16 , 10)

	declare @FinancialPeriod int

	select @FinancialPeriod = FinancialPeriodID from ast.Creation where CreationID = @CreationID

	if exists (
		select * from ast.AssetClosingOperation 
		where FinancialPeriodID = @FinancialPeriod)	
			RAISERROR('به دلیل بسته بودن سیستم دارایی ثابت، انجام این عملیات مجاز نیست.', 16, 10)


	set @Version = @Version +1 

		UPDATE [AST].[UtilizationCost]
		SET    [CreationID] = @CreationID,
			   [BaseType] = @BaseType,
			   [PurchaseInvoiceItemID] = @PurchaseInvoiceItemID, 
			   [OutgoingItemID] = @OutgoingItemID, 
			   [StuffID] = @StuffID, 
			   [MainQuantity] = @MainQuantity,
			   [SubQuantity] = @SubQuantity,
			   [Price] = @Price, 
			   [Version] = @Version, 
			   [Creator] = @Creator, 
			   [CreationDate] = @CreationDate, 
			   [LastEditor] = @LastEditor, 
			   [LastEditionDate] = @LastEditionDate
		WHERE  [UtilizationCostID] = @UtilizationCostID
	
	
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
	
	-- Begin Return Select <- do not remove
	SELECT [Version]
	FROM   [AST].[UtilizationCost]
	WHERE  [UtilizationCostID] = @UtilizationCostID	
	-- End Return Select <- do not remove
