
CREATE PROC [HRM].[spGetGuestFoodOrderItems]
    @ServingPlaceId INT,
    @Date DATE,
    @Creator INT
AS
BEGIN

    DECLARE @UserID INT,
            @Culture VARCHAR(25),
            @CultureNo TINYINT;

    SET @UserID = CFG.GetuserID();
    SET @Culture = CFG.GetuserCulture();

    SELECT @CultureNo = CultureNo
    FROM CFG.CultureInfo
    WHERE Culture = @Culture;

    IF OBJECT_ID('tempdb..#LatestFood') IS NOT NULL
        DROP TABLE #LatestFood;

    SELECT *
    INTO #LatestFood
    FROM
    (
        SELECT ROW_NUMBER() OVER (PARTITION BY p.FoodID ORDER BY p.Date DESC) rno,
               p.FoodID,
               p.[Date],
               p.Amount
        FROM HRM.FoodPrice p
    ) T
    WHERE T.rno = 1;

    SELECT @Date AS Date,
           @ServingPlaceId AS ServingPlaceID,
           f.FoodID,
           f.FoodTypeID,
           CASE
               WHEN @CultureNo = 2 THEN
                   f.Title2
               ELSE
                   f.Title
           END AS FoodTitle,
           CASE
               WHEN g.GuestFoodOrderID IS NOT NULL THEN
                   g.GuestFoodOrderID
               ELSE
                   -1000
           END AS GuestFoodOrderID,
           CASE
               WHEN g.GuestFoodOrderID IS NOT NULL THEN
                   g.Quantity
               ELSE
                   NULL
           END AS Quantity,
           CASE
               WHEN g.GuestFoodOrderID IS NOT NULL THEN
                   g.Amount / g.Quantity
               WHEN g.GuestFoodOrderID IS NULL
                    AND lf.FoodID IS NOT NULL THEN
                   lf.Amount
               ELSE
                   NULL
           END AS FoodPrice,
           CASE
               WHEN g.GuestFoodOrderID IS NOT NULL THEN
                   g.Amount
               ELSE
                   NULL
           END AS Amount,
           CASE
               WHEN g.GuestFoodOrderID IS NOT NULL THEN
                   g.[Version]
               ELSE
                   0
           END AS [Version],
           CAST(CASE
                    WHEN g.GuestFoodOrderID IS NOT NULL THEN
                        1
                    ELSE
                        0
                END AS BIT) AS Selected
    FROM HRM.Food f
        JOIN HRM.FoodType t
            ON f.FoodTypeID = t.FoodTypeID
        LEFT JOIN
        (
            SELECT fpi.FoodID,
                   fp.ServingPlaceID,
                   fp.DATE
            FROM HRM.FoodPlan AS fp
                JOIN HRM.FoodPlanItem AS fpi
                    ON fpi.FoodPlanID = fp.FoodPlanID
        ) p
            ON f.FoodID = p.FoodID
               AND p.ServingPlaceID = @ServingPlaceId
               AND p.DATE = @Date
        LEFT JOIN HRM.GuestFoodOrder g
            ON f.FoodID = g.FoodID
               AND g.ServingPlaceID = @ServingPlaceId
               AND g.[Date] = @Date
               AND g.Creator = @Creator
        LEFT JOIN #LatestFood lf
            ON f.FoodID = lf.FoodID
               AND lf.Date <= @Date
    WHERE t.NeededPlan = 0
          OR
          (
              t.NeededPlan = 1
              AND p.FoodPlanID IS NOT NULL
          );

    IF OBJECT_ID('tempdb..#LatestFood') IS NOT NULL
        DROP TABLE #LatestFood;

END;

