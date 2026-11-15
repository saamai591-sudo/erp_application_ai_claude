CREATE     PROC [SLE].[spJustificationItemUpdate]
    @JustificationItemID INT ,
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
    @Version INT ,
    @Creator INT ,
    @CreationDate DATETIME ,
    @LastEditor INT ,
    @LastEditionDate DATETIME
--WITH ENCRYPTION
AS
    SET NOCOUNT ON;

        DECLARE @PreviousMainQuantity DECIMAL(30, 4) ,
                @PreviousSubQuantity DECIMAL(30, 4) ,
                @PreVersion INT ,
                @PreOrderItemID INT ,
                @PreNetPrice DECIMAL(30, 4) ,
                @Message NVARCHAR(MAX) ,
                @StuffCode NVARCHAR(256);

        SELECT @PreVersion = [Version] ,
               @PreviousMainQuantity = [MainQuantity] ,
               @PreviousSubQuantity = [SubQuantity] ,
               @PreOrderItemID = OrderItemID ,
               @PreNetPrice = NetPrice
        FROM   [SLE].[JustificationItem]
        WHERE  [JustificationItemID] = @JustificationItemID;

        IF @Version <> @PreVersion
            RAISERROR('Version mismatch...', 16, 10);

        -- Start Update
        IF ( @MainQuantity <> @PreviousMainQuantity )
            BEGIN
                IF ( SELECT SLE.JustificationItemHasFlow(@JustificationItemID)) = 1
                    BEGIN
                        SELECT @Message = 'MainQuantityIsNotEditable'
                        RAISERROR(@Message, 16, 12);
                    END;

                UPDATE [SLE].[JustificationItem]
                SET    [MainQuantity] = @MainQuantity
                WHERE  [JustificationItemID] = @JustificationItemID;
            END;

        IF ISNULL(@SubQuantity, 0) <> ISNULL(@PreviousSubQuantity, 0)
            BEGIN
                IF ( SELECT SLE.JustificationItemHasFlow(@JustificationItemID)) = 1
                    BEGIN
                        SELECT @Message = 'SubQuantityIsNotEditable'
                        RAISERROR(@Message, 16, 12);
                    END;

                UPDATE [SLE].[JustificationItem]
                SET    [SubQuantity] = @SubQuantity
                WHERE  [JustificationItemID] = @JustificationItemID;
            END;

        IF @NetPrice <> @PreNetPrice
            BEGIN
                IF ( SELECT SLE.JustificationItemHasFlow(@JustificationItemID)) = 1
                    BEGIN
                        SELECT @Message = 'PricesAreNotEditable'
                        RAISERROR(@Message, 16, 12);
                    END;

                UPDATE [SLE].[JustificationItem]
                SET    [NetPrice] = @NetPrice
                WHERE  [JustificationItemID] = @JustificationItemID;
            END;

        UPDATE [SLE].[JustificationItem]
        SET    [RowIndex] = @RowIndex ,
               [SaleModelID] = @SaleModelID ,
               [StuffID] = @StuffID ,
               [Fee] = @Fee ,
               [Price] = @Price ,
               [Discount] = @Discount ,
               [Description] = @Description ,
               [Description2] = @Description2 ,
               [OrderItemID] = @OrderItemID ,
               [Version] = @Version + 1 ,
               [LastEditor] = @LastEditor ,
               [LastEditionDate] = @LastEditionDate
        WHERE  [JustificationItemID] = @JustificationItemID;
        -- End Update	

        -- Begin Return Select <- do not remove
        SELECT  [Version] 
        FROM   [SLE].[JustificationItem]
        WHERE  [JustificationItemID] = @JustificationItemID;
    -- End Return Select <- do not remove
