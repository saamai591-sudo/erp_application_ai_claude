CREATE   PROCEDURE [HRM].[spFoodOrderItemUpdate]
(
    @FoodOrderItemID INT,
    @FoodOrderID INT,
    @FoodID INT,
    @PartyID INT,
    @Quantity INT,
    @Amount DECIMAL(30, 4),
    @LastEditor INT,
    @LastEditionDate DATETIME,
    @Version INT,
    @Description NVARCHAR(500),
    @Description2 NVARCHAR(500)
)
AS
BEGIN

    IF EXISTS
    (
        SELECT 1
        FROM HRM.FoodOrderItem
        WHERE [FoodOrderItemID] = @FoodOrderItemID
              AND [Version] = @Version
    )
    BEGIN

        UPDATE HRM.FoodOrderItem
        SET FoodOrderID = @FoodOrderID,
            FoodID = @FoodID,
            PartyID = @PartyID,
            Quantity = @Quantity,
            Amount = @Amount,
            LastEditor = @LastEditor,
            LastEditionDate = @LastEditionDate,
            [Version] = @Version + 1,
            [Description] = @Description,
            [Description2] = @Description2
        WHERE FoodOrderItemID = @FoodOrderItemID;


        SELECT foi.[Version]
        FROM HRM.FoodOrderItem AS foi
        WHERE FoodOrderItemID = @FoodOrderItemID;

    END;
    ELSE
    BEGIN
        RAISERROR('Version mismatch...', 16, 10);
    END;
END;
