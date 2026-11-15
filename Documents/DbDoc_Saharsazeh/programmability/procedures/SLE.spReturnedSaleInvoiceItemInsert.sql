-------------------------------------
CREATE   PROC [SLE].[spReturnedSaleInvoiceItemInsert]
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
    @Creator INT ,
    @CreationDate DATETIME
--WITH ENCRYPTION
AS
BEGIN
    SET NOCOUNT ON; 

	
        IF ( SELECT [Date]
             FROM   SLE.ReturnedSaleInvoice i
             WHERE  i.ReturnedSaleInvoiceID = @ReturnedSaleInvoiceID
           ) <= ( SELECT    MAX(EndDate)
                  FROM      CFG.Vat v
                )
            BEGIN
                RAISERROR('VatHasPublished',16,12);
				RETURN
            END;
		 
	
        INSERT  INTO [SLE].[ReturnedSaleInvoiceItem]
                ( [ReturnedSaleInvoiceID] ,
                  [RowIndex] ,
                  [SaleModelID] ,
                  [ReturnedOutgoingItemID] ,
                  [StuffID] ,
                  [MainQuantity] ,
                  [SubQuantity] ,
                  [Fee] ,
                  [Price] ,
                  [Discount] ,
                  [Tax] ,
                  [Duty] ,
                  [NetPrice] ,
                  [PricedFromBase] ,
                  [Description] ,
                  [Description2] ,
                  [ReturnedSaleJustificationItemID] ,
                  [InvoiceItemID] ,
                  [Version] ,
                  [Creator] ,
                  [CreationDate] ,
                  [LastEditor] ,
                  [LastEditionDate]
                )
                SELECT  @ReturnedSaleInvoiceID ,
                        @RowIndex ,
                        @SaleModelID ,
                        @ReturnedOutgoingItemID ,
                        @StuffID ,
                        @MainQuantity ,
                        @SubQuantity ,
                        @Fee ,
                        @Price ,
                        @Discount ,
                        @Tax ,
                        @Duty ,
                        @NetPrice ,
                        @PricedFromBase ,
                        @Description ,
                        @Description2 ,
                        @ReturnedSaleJustificationItemID ,
                        @InvoiceItemID ,
                        0 ,
                        @Creator ,
                        @CreationDate ,
                        @Creator ,
                        @CreationDate;
	
				
	-- Begin Return Select <- do not remove
        SELECT  [ReturnedSaleInvoiceItemID] ,
                [ReturnedSaleInvoiceID] ,
                [RowIndex] ,
                [SaleModelID] ,
                [ReturnedOutgoingItemID] ,
                [StuffID] ,
                [MainQuantity] ,
                [SubQuantity] ,
                [Fee] ,
                [Price] ,
                [Discount] ,
                [Tax] ,
                [Duty] ,
                [NetPrice] ,
                [PricedFromBase] ,
                [Description] ,
                [Description2] ,
                [ReturnedSaleJustificationItemID] ,
                [InvoiceItemID] ,
                [Version] ,
                [Creator] ,
                [CreationDate] ,
                [LastEditor] ,
                [LastEditionDate]
        FROM    [SLE].[ReturnedSaleInvoiceItem]
        WHERE   [ReturnedSaleInvoiceItemID] = SCOPE_IDENTITY();
	-- End Return Select <- do not remove

    END
