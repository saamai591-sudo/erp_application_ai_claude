-------------------------------------
CREATE   PROC [SLE].[spReturnedSaleInvoiceItemUpdate]
    @ReturnedSaleInvoiceItemID INT ,
    @ReturnedSaleInvoiceID INT ,
    @RowIndex SMALLINT ,
    @SaleModelID SMALLINT ,
    @ReturnedOutgoingItemID INT ,
    @StuffID INT ,
    @MainQuantity DECIMAL(30, 4) ,
    @SubQuantity DECIMAL(30, 4) ,
    @Fee DECIMAL(30, 4) ,
    @Price DECIMAL(30, 4) ,
    @Discount DECIMAL(30, 4) ,
    @Tax DECIMAL(30, 4) ,
    @Duty DECIMAL(30, 4) ,
    @NetPrice DECIMAL(30, 4) ,
    @PricedFromBase BIT ,
    @Description NVARCHAR(250) ,
    @Description2 NVARCHAR(250) ,
    @ReturnedSaleJustificationItemID INT ,
    @InvoiceItemID INT ,
    @Version INT ,
    @LastEditor INT ,
    @LastEditionDate DATETIME
--WITH ENCRYPTION
AS
    SET NOCOUNT ON;
	
        DECLARE @PreviousMainQuantity DECIMAL(30, 4) ,
            @PreviousSubQuantity DECIMAL(30, 4) ,
            @PreInvoiceItemID INT ,
            @PreReturnedSaleJustificationItemID INT ,
            @PreVersion INT ,
            @PreDate DATE ,
            @PrePrevoucherID INT ,
            @Message NVARCHAR(MAX);
				
        SELECT  @PreDate = [Date] ,
                @PrePrevoucherID = PreVoucherID
        FROM    SLE.ReturnedSaleInvoice i
        WHERE   i.ReturnedSaleInvoiceID = @ReturnedSaleInvoiceID;
	
        IF @PreDate <= ( SELECT MAX(EndDate)
                         FROM   CFG.Vat v
                       )
            BEGIN
                RAISERROR('VatHasPublished',16,12);
            END;
        SELECT  @PreVersion = [Version] ,
                @PreviousMainQuantity = MainQuantity ,
                @PreviousSubQuantity = SubQuantity ,
                @PreInvoiceItemID = InvoiceItemID ,
                @PreReturnedSaleJustificationItemID = ReturnedSaleJustificationItemID
        FROM    [SLE].[ReturnedSaleInvoiceItem]
        WHERE   [ReturnedSaleInvoiceItemID] = @ReturnedSaleInvoiceItemID;		
	
        IF @Version <> @PreVersion
            OR @PrePrevoucherID IS NOT NULL
            RAISERROR('Version mismatch...', 16 , 10);	
				
	-- Start Update
        UPDATE  [SLE].[ReturnedSaleInvoiceItem]
        SET     [RowIndex] = @RowIndex ,
                [SaleModelID] = @SaleModelID ,
                [ReturnedOutgoingItemID] = @ReturnedOutgoingItemID ,
                [StuffID] = @StuffID ,
                [MainQuantity] = @MainQuantity ,
                [SubQuantity] = @SubQuantity ,
                [Fee] = @Fee ,
                [Price] = @Price ,
                [Discount] = @Discount ,
                [Tax] = @Tax ,
                [Duty] = @Duty ,
                [NetPrice] = @NetPrice ,
                [PricedFromBase] = @PricedFromBase ,
                [Description] = @Description ,
                [Description2] = @Description2 ,
                [ReturnedSaleJustificationItemID] = @ReturnedSaleJustificationItemID ,
                [InvoiceItemID] = @InvoiceItemID ,
                [Version] = @Version + 1 ,
                [LastEditor] = @LastEditor ,
                [LastEditionDate] = @LastEditionDate
        WHERE   [ReturnedSaleInvoiceItemID] = @ReturnedSaleInvoiceItemID;
	-- End Update	
	
		-- Begin Return Select <- do not remove
        SELECT   [Version] 
        FROM    [SLE].[ReturnedSaleInvoiceItem]
        WHERE   [ReturnedSaleInvoiceItemID] = @ReturnedSaleInvoiceItemID;	
	-- End Return Select <- do not remove
