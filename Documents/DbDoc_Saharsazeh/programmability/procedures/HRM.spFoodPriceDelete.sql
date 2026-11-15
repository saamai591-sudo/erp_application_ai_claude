
CREATE   PROC [HRM].[spFoodPriceDelete]
    @FoodPriceID INT,
    @Version INT
AS
SET NOCOUNT ON;
SET XACT_ABORT ON;

IF @Version =
(
    SELECT [Version] FROM [HRM].FoodPrice WHERE FoodPriceID = @FoodPriceID
)
BEGIN
    DELETE FROM [HRM].FoodPrice
    WHERE FoodPriceID = @FoodPriceID;

END;
ELSE
BEGIN

    RAISERROR(   N'Delete_%s_%d.', -- Message text.
                 16,               -- Severity,
                 10,               -- State,
                 N'FoodPrice',     -- First argument.
                 @FoodPriceID
             ); -- Second argument.

END;



