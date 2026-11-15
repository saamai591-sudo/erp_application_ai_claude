CREATE   PROC [AST].[SpRepairServiceCostUpdate] 
    @RepairServiceCostID INT,
    @RepairID INT,
    @PurchaseInvoiceItemID INT = NULL,
    @StuffID INT,
    @SlID INT,
    @Price DECIMAL(30, 4),
    @Version INT,
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME
--WITH ENCRYPTION
AS 
SET NOCOUNT ON 

	IF @Version <> (
	       SELECT [Version]
	       FROM   [AST].[RepairServiceCost]
	       WHERE  [RepairServiceCostID] = @RepairServiceCostID
	   )
	    RAISERROR('Version mismatch...', 16, 10)
	
	DECLARE @FinancialPeriod INT
	
	SELECT @FinancialPeriod = FinancialPeriodID
	FROM   ast.Repair
	WHERE  RepairID = @RepairID
	
	SET @Version = @Version + 1 
	
	UPDATE [AST].[RepairServiceCost]
	SET    [RepairID] = @RepairID,
	       [PurchaseInvoiceItemID] = @PurchaseInvoiceItemID,
	       [StuffID] = @StuffID,
	       [SlID] = @SlID,
	       [Price] = @Price,
	       [Version] = @Version,
	       [Creator] = @Creator,
	       [CreationDate] = @CreationDate,
	       [LastEditor] = @LastEditor,
	       [LastEditionDate] = @LastEditionDate
	WHERE  [RepairServiceCostID] = @RepairServiceCostID
	
	IF (@PurchaseInvoiceItemID IS NOT NULL)
	BEGIN
	    DECLARE @Num INT = NULL
	    
	    SELECT @Num = p.Number
	    FROM   VND.PurchaseInvoiceItem i
	           JOIN VND.PurchaseInvoice p
	                ON  p.PurchaseInvoiceID = i.PurchaseInvoiceID
	           JOIN VND.PurchaseInvoice_PriceRemains pr
	                ON  i.PurchaseInvoiceItemID = pr.PurchaseInvoiceItemID
	    WHERE  i.PurchaseInvoiceItemID = @PurchaseInvoiceItemID
	           AND pr.Non < 0
	    
	    IF (@Num IS NOT NULL)
	    BEGIN
	        RAISERROR(
	            'ãÇäÏå ãÓÊåá˜ äÔÏå ÝÇ˜ÊæÑ ÎÑíÏ ÔãÇÑå (%d) ãäÝí ÎæÇåÏ ÔÏ.',
	            16,
	            12,
	            @Num
	        )
	    END


	END

	-- Begin Return Select <- do not remove
	SELECT [Version]
	FROM   [AST].[RepairServiceCost]
	WHERE  [RepairServiceCostID] = @RepairServiceCostID 
	-- End Return Select <- do not remove
