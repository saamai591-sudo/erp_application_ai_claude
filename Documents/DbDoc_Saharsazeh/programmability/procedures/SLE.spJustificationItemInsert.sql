CREATE     PROC [SLE].[spJustificationItemInsert]
    @JustificationID INT ,
    @RowIndex SMALLINT ,
    @SaleModelID SMALLINT ,
    @StuffID INT ,
    @MainQuantity DECIMAL(30, 4) ,
    @SubQuantity DECIMAL(30, 4) ,
    @Fee DECIMAL(30, 4) ,
    @Price DECIMAL(30, 4) ,
    @Discount DECIMAL(30, 4) ,
    @NetPrice DECIMAL(30, 4) ,
    @Description NVARCHAR(250) ,
    @Description2 NVARCHAR(250) ,
    @OrderItemID INT ,
    @Creator INT ,
    @CreationDate DATETIME ,
    @LastEditor INT ,
    @LastEditionDate DATETIME
--WITH ENCRYPTION
AS
BEGIN
    SET NOCOUNT ON;

        INSERT INTO [SLE].[JustificationItem] ( [JustificationID] ,
                                                [RowIndex] ,
                                                [SaleModelID] ,
                                                [StuffID] ,
                                                [MainQuantity] ,
                                                [SubQuantity] ,
                                                [Fee] ,
                                                [Price] ,
                                                [Discount] ,
                                                [NetPrice] ,
                                                [Description] ,
                                                [Description2] ,
                                                [OrderItemID] ,
                                                [Version] ,
                                                [Creator] ,
                                                [CreationDate] ,
                                                [LastEditor] ,
                                                [LastEditionDate] )
                    SELECT @JustificationID ,
                           @RowIndex ,
                           @SaleModelID ,
                           @StuffID ,
                           @MainQuantity ,
                           @SubQuantity ,
                           @Fee ,
                           @Price ,
                           @Discount ,
                           @NetPrice ,
                           @Description ,
                           @Description2 ,
                           @OrderItemID ,
                           0 ,
                           @Creator ,
                           @CreationDate ,
                           @LastEditor ,
                           @LastEditionDate;

        -- Begin Return Select <- do not remove
        SELECT [JustificationItemID] ,
               [Version] 
        FROM   [SLE].[JustificationItem]
        WHERE  [JustificationItemID] = SCOPE_IDENTITY();
    -- End Return Select <- do not remove
END
