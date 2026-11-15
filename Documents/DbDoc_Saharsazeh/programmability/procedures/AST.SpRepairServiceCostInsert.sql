CREATE   PROC [AST].[SpRepairServiceCostInsert] 
    @RepairID int,
    @PurchaseInvoiceItemID int = NULL,
    @StuffID int,
    @SlID int,
    @Price decimal(30, 4),
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime 
--WITH ENCRYPTION
AS 
SET NOCOUNT ON 

	INSERT INTO [AST].[RepairServiceCost] ([RepairID], [PurchaseInvoiceItemID], [StuffID], [SlID], [Price], [Version], [Creator], [CreationDate], [LastEditor], [LastEditionDate])
	SELECT @RepairID, @PurchaseInvoiceItemID, @StuffID, @SlID, @Price, 0, @Creator, @CreationDate, @LastEditor, @LastEditionDate
	
	-- Begin Return Select <- do not remove
	SELECT [RepairServiceCostID], [Version]
	FROM   [AST].[RepairServiceCost]
	WHERE  [RepairServiceCostID] = SCOPE_IDENTITY()
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
