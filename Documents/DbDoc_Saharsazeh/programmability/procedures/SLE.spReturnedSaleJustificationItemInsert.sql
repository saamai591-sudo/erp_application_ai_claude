CREATE     PROC [SLE].[spReturnedSaleJustificationItemInsert]
    @ReturnedSaleJustificationID INT ,
    @RowIndex SMALLINT ,
    @StuffID INT ,
    @MainQuantity DECIMAL(30, 4) ,
    @SubQuantity DECIMAL(30, 4) ,
    @Description NVARCHAR(250) ,
    @Description2 NVARCHAR(250) ,
    @Creator INT ,
    @CreationDate DATETIME ,
    @LastEditor INT ,
    @LastEditionDate DATETIME ,
    @InvoiceItemID INT ,
    @Fee DECIMAL(30, 4) ,
    @Price DECIMAL(30, 4) ,
    @Discount DECIMAL(30, 4) ,
    @Tax DECIMAL(30, 4) ,
    @Duty DECIMAL(30, 4) ,
    @NetPrice DECIMAL(30, 4)
--WITH ENCRYPTION
AS
    SET NOCOUNT ON;

    INSERT INTO [SLE].[ReturnedSaleJustificationItem] ( [ReturnedSaleJustificationID] ,
                                                        [RowIndex] ,
                                                        [StuffID] ,
                                                        [MainQuantity] ,
                                                        [SubQuantity] ,
                                                        [Description] ,
                                                        [Description2] ,
                                                        [Version] ,
                                                        [Creator] ,
                                                        [CreationDate] ,
                                                        [LastEditor] ,
                                                        [LastEditionDate] ,
                                                        [InvoiceItemID] ,
                                                        [Fee] ,
                                                        [Price] ,
                                                        [Discount] ,
                                                        [Tax] ,
                                                        [Duty] ,
                                                        [NetPrice] )
                SELECT @ReturnedSaleJustificationID ,
                       @RowIndex ,
                       @StuffID ,
                       @MainQuantity ,
                       @SubQuantity ,
                       @Description ,
                       @Description2 ,
                       0 ,
                       @Creator ,
                       @CreationDate ,
                       @LastEditor ,
                       @LastEditionDate ,
                       @InvoiceItemID ,
                       @Fee ,
                       @Price ,
                       @Discount ,
                       @Tax ,
                       @Duty ,
                       @NetPrice;

    -- Begin Return Select <- do not remove
    SELECT [ReturnedSaleJustificationItemID] ,
           [Version]
    FROM   [SLE].[ReturnedSaleJustificationItem]
    WHERE  [ReturnedSaleJustificationItemID] = SCOPE_IDENTITY();
-- End Return Select <- do not remove
