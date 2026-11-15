-------------------------------------
CREATE   PROC [SLE].spQuotationItemInsert
    @QuotationID INT ,
    @RowIndex SMALLINT ,
    @SaleModelID SMALLINT ,
    @StuffID INT ,
    @MainQuantity DECIMAL(36, 10) ,
    @SubQuantity DECIMAL(36,10) ,
    @Fee DECIMAL(36,10) ,
    @Price DECIMAL(36,10) ,
    @Discount DECIMAL(36,10) ,
    @Tax DECIMAL(36, 10) ,
    @Duty DECIMAL(36,10) ,
    @NetPrice DECIMAL(36, 10) ,
    @Description NVARCHAR(250) ,
    @Description2 NVARCHAR(250) ,
    @OrderItemID INT ,
    @JustificationItemID INT ,
    @PricedFromBase BIT ,
    @Creator INT ,
    @CreationDate DATETIME ,
    @LastEditor INT ,
    @LastEditionDate DATETIME
--WITH ENCRYPTION
AS
BEGIN
    SET NOCOUNT ON;
        INSERT INTO [SLE].[QuotationItem] ( [QuotationID] ,
                                            [RowIndex] ,
                                            [SaleModelID] ,
                                            [StuffID] ,
                                            [MainQuantity] ,
                                            [SubQuantity] ,
                                            [Fee] ,
                                            [Price] ,
                                            [Discount] ,
                                            [Tax] ,
                                            [Duty] ,
                                            [NetPrice] ,
                                            [Description] ,
                                            [Description2] ,
                                            [OrderItemID] ,
                                            [JustificationItemID] ,
                                            [PricedFromBase] ,
                                            [Version] ,
                                            [Creator] ,
                                            [CreationDate] ,
                                            [LastEditor] ,
                                            [LastEditionDate] )
                    SELECT @QuotationID ,
                           @RowIndex ,
                           @SaleModelID ,
                           @StuffID ,
                           @MainQuantity ,
                           @SubQuantity ,
                           @Fee ,
                           @Price ,
                           @Discount ,
                           @Tax ,
                           @Duty ,
                           @NetPrice ,
                           @Description ,
                           @Description2 ,
                           @OrderItemID ,
                           @JustificationItemID ,
                           @PricedFromBase,
                           0 ,
                           @Creator ,
                           @CreationDate ,
                           @LastEditor ,
                           @LastEditionDate;

        -- Begin Return Select <- do not remove
        SELECT [QuotationItemID] ,
               [Version] 
        FROM   [SLE].[QuotationItem]
        WHERE  [QuotationItemID] = SCOPE_IDENTITY();
    -- End Return Select <- do not remove
END 
