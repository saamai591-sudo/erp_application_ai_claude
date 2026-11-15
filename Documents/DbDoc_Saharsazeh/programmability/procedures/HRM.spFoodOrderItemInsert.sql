CREATE   PROC HRM.spFoodOrderItemInsert
    @FoodOrderID INT,
    @FoodID INT,
    @PartyID INT,
    @Quantity INT,
    @Amount DECIMAL(30, 4),
    @Creator INT,
    @CreationDate DATETIME,
    @Description NVARCHAR(500),
    @Description2 NVARCHAR(500)
AS
BEGIN
    SET NOCOUNT ON;


    INSERT HRM.FoodOrderItem
    (
        FoodOrderID,
        FoodID,
        PartyID,
        Quantity,
        Amount,
        Version,
        Creator,
        CreationDate,
        LastEditor,
        LastEditionDate,
        Description,
        Description2
    )
    SELECT @FoodOrderID,
           @FoodID,
           @PartyID,
           @Quantity,
           @Amount,
           0,
           @Creator,
           @CreationDate,
           @Creator,
           @CreationDate,
           @Description,
           @Description2;

    -- Begin Return Select <- do not remove
    SELECT [FoodOrderItemID],
           [Version]
    FROM [HRM].FoodOrderItem
    WHERE [FoodOrderItemID] = SCOPE_IDENTITY();
-- End Return Select <- do not remove
END;
