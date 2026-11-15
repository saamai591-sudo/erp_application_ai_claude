CREATE     PROC HRM.spFoodOrderBatchAction
(
    @ServingPlaceID INT,
    @PartyID  INT = NULL,
    @FoodID INT = NULL,
    @Date DATE
)
AS 
----

DELETE 
FROM   foi
       FROM hrm.FoodOrder AS fo
       JOIN hrm.FoodOrderItem AS foi
            ON  foi.FoodOrderID = fo.FoodOrderID
WHERE  DATE = @Date
       AND fo.ServingPlaceID = @ServingPlaceID
       AND (foi.PartyID = @PartyID OR @PartyID IS NULL)
       AND (foi.FoodID = @FoodID OR @FoodID IS NULL)


---------Delete Orders That Has No Item
DELETE 
FROM   fo FROM hrm.FoodOrder AS fo
       LEFT JOIN hrm.FoodOrderItem AS foi
            ON  foi.FoodOrderID = fo.FoodOrderID
WHERE  foi.FoodOrderItemID IS NULL
       AND fo.[Date] = @Date






