-------------------------------------
CREATE   PROC [SLE].spQuotationItemUpdate
    @QuotationItemID INT,
    @QuotationID INT,
    @RowIndex SMALLINT,
    @SaleModelID SMALLINT,
    @StuffID INT,
    @MainQuantity DECIMAL(36, 10),
    @SubQuantity DECIMAL(36, 10),
    @Fee DECIMAL(36, 10),
    @Price DECIMAL(36, 10),
    @Discount DECIMAL(36, 10),
    @Tax DECIMAL(36, 10),
    @Duty DECIMAL(36, 10),
    @NetPrice DECIMAL(36, 10),
    @Description NVARCHAR(250),
    @Description2 NVARCHAR(250),
    @OrderItemID INT,
    @JustificationItemID INT,   
    @PricedFromBase BIT,   
    @Version INT,
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME

--WITH ENCRYPTION 
	 AS 
SET NOCOUNT ON 
	DECLARE @PreviousMainQuantity       DECIMAL(36, 10),
	        @PreviousSubQuantity        DECIMAL(36, 10),
	        @PreVersion                 INT,
	        @PreJustificationItemID     INT,
	        @PrePricedFromBase			BIT,
	        @PreOrderItemID             INT,
	        @PreRowIndex                SMALLINT,
	        @PreSaleModelID             INT,
	        @PreStuffID                 INT,
	        @PreFee                     DECIMAL(36, 10),
	        @PrePrice                   DECIMAL(36, 10),
	        @PreTax                     DECIMAL(36, 10),
	        @PreDuty                    DECIMAL(36, 10),
	        @PreNet                     DECIMAL(36, 10),
	        @PreDiscount                DECIMAL(36, 10),
	        @PreDescription             NVARCHAR(250),
	        @PreDescription2            NVARCHAR(250),
	        @PreLastEditor              INT,
	        @PreLastEditionDate         DATETIME,
	        @Message                    NVARCHAR(MAX)
	
	SELECT @PreVersion = [Version],
	       @PreviousMainQuantity       = [MainQuantity],
	       @PreviousSubQuantity        = [SubQuantity],
	       @PreJustificationItemID     = JustificationItemID,
	       @PrePricedFromBase		   = PricedFromBase,
	       @PreOrderItemID             = OrderItemID,
	       @PreRowIndex                = RowIndex,
	       @PreSaleModelID             = SaleModelID,
	       @PreStuffID                 = StuffID,
	       @PreFee                     = Fee,
	       @PrePrice                   = Price,
	       @PreTax                     = Tax,
	       @PreDuty                    = Duty,
	       @PreNet                     = NetPrice,
	       @PreDiscount                = Discount,
	       @PreDescription             = [Description],
	       @PreDescription2            = @PreDescription2,
	       @PreLastEditor              = LastEditor,
	       @PreLastEditionDate         = LastEditionDate
	FROM   [SLE].[QuotationItem]
	WHERE  [QuotationItemID]           = @QuotationItemID	
	
	IF @Version <> @PreVersion
	    RAISERROR('Version mismatch...', 16, 10)
	
	-- Start Update	
	IF @RowIndex <> @PreRowIndex
	    UPDATE [SLE].[QuotationItem]
	    SET    [RowIndex] = @RowIndex
	    WHERE  [QuotationItemID] = @QuotationItemID
	
	IF @SaleModelID <> @PreSaleModelID
	    UPDATE [SLE].[QuotationItem]
	    SET    [SaleModelID] = @SaleModelID
	    WHERE  [QuotationItemID] = @QuotationItemID
	
	IF @StuffID <> @PreStuffID
	    UPDATE [SLE].[QuotationItem]
	    SET    [StuffID] = @StuffID
	    WHERE  [QuotationItemID] = @QuotationItemID
	
	IF @MainQuantity <> @PreviousMainQuantity
	BEGIN
	    IF (
	           SELECT sle.QuotationItemHasFlow(@QuotationItemID)
	       ) = 1
	    BEGIN
	        SELECT @Message = 'MainQuantityIsNotEditable'
	        RAISERROR(@Message, 16, 12)
	    END
	    
	    UPDATE [SLE].[QuotationItem]
	    SET    [MainQuantity] = @MainQuantity
	    WHERE  [QuotationItemID] = @QuotationItemID
	END
	
	IF ISNULL(@SubQuantity, 0) <> ISNULL(@PreviousSubQuantity, 0)
	BEGIN
	    IF (
	           SELECT sle.QuotationItemHasFlow(@QuotationItemID)
	       ) = 1
	    BEGIN
	        SELECT @Message =  'SubQuantityIsNotEditable'
	        RAISERROR(@Message, 16, 12)
	    END
	    
	    UPDATE [SLE].[QuotationItem]
	    SET    [SubQuantity] = @SubQuantity
	    WHERE  [QuotationItemID] = @QuotationItemID
	END
		
	IF @Fee <> @PreFee
	    UPDATE [SLE].[QuotationItem]
	    SET    [Fee] = @Fee
	    WHERE  [QuotationItemID] = @QuotationItemID
	
	IF @Price <> @PrePrice
	    UPDATE [SLE].[QuotationItem]
	    SET    [Price] = @Price
	    WHERE  [QuotationItemID] = @QuotationItemID
	
	IF @Discount <> @PreDiscount
	    UPDATE [SLE].[QuotationItem]
	    SET    [Discount] = @Discount
	    WHERE  [QuotationItemID] = @QuotationItemID
	
	IF @Tax <> @PreTax
	    UPDATE [SLE].[QuotationItem]
	    SET    [Tax] = @Tax
	    WHERE  [QuotationItemID] = @QuotationItemID
	
	IF @Duty <> @PreDuty
	    UPDATE [SLE].[QuotationItem]
	    SET    [Duty] = @Duty
	    WHERE  [QuotationItemID] = @QuotationItemID
	
	IF @NetPrice <> @PreNet
	BEGIN
	    IF EXISTS (
	           SELECT QuotationItemID
	           FROM   SLE.InvoiceItem
	           WHERE  QuotationItemID = @QuotationItemID
	       )
	    BEGIN
	        SELECT @Message =  'PricesAreNotEditable'
	        RAISERROR(@Message, 16, 12)
	    END
	    
	    UPDATE [SLE].[QuotationItem]
	    SET    [NetPrice]            = @NetPrice
	    WHERE  [QuotationItemID]     = @QuotationItemID
	END
	
	IF ISNULL(@Description, '') <> ISNULL(@PreDescription, '')
	    UPDATE [SLE].[QuotationItem]
	    SET    [Description] = @Description
	    WHERE  [QuotationItemID] = @QuotationItemID
	
	IF ISNULL(@Description2, '') <> ISNULL(@PreDescription2, '')
	    UPDATE [SLE].[QuotationItem]
	    SET    [Description2] = @Description2
	    WHERE  [QuotationItemID] = @QuotationItemID
	
	IF ISNULL(@OrderItemID, 0) <> ISNULL(@PreOrderItemID, 0)
	    UPDATE [SLE].[QuotationItem]
	    SET    [OrderItemID] = @OrderItemID
	    WHERE  [QuotationItemID] = @QuotationItemID
	
	IF ISNULL(@JustificationItemID, 0) <> ISNULL(@PreJustificationItemID, 0)
	    UPDATE [SLE].[QuotationItem]
	    SET    [JustificationItemID] = @JustificationItemID
	    WHERE  [QuotationItemID] = @QuotationItemID

	IF ISNULL(@PricedFromBase, 0) <> ISNULL(@PrePricedFromBase, 0)
	UPDATE [SLE].[QuotationItem]
	SET    [PricedFromBase] = @PricedFromBase
	WHERE  [QuotationItemID] = @QuotationItemID
	
	UPDATE [SLE].[QuotationItem]
	SET    [Version] = [Version] + 1
	WHERE  [QuotationItemID] = @QuotationItemID
	
	IF @LastEditor < @PreLastEditor
	    UPDATE [SLE].[QuotationItem]
	    SET    [LastEditor] = @LastEditor
	    WHERE  [QuotationItemID] = @QuotationItemID
	
	IF @LastEditionDate <> @PreLastEditionDate
	    UPDATE [SLE].[QuotationItem]
	    SET    [LastEditionDate] = @LastEditionDate
	    WHERE  [QuotationItemID] = @QuotationItemID
	-- End Update	
	
	-- Begin Return Select <- do not remove
	SELECT  [Version] 
	FROM   [SLE].[QuotationItem]
	WHERE  [QuotationItemID] = @QuotationItemID 
	       -- End Return Select <- do not remove
