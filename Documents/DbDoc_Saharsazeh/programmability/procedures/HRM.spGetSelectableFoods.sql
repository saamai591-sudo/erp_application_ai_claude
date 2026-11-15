
CREATE   PROC [HRM].[spGetSelectableFoods]
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

    SELECT fp.FoodPlanID,
           f.FoodTypeID,
           CASE
               WHEN @CultureNo = 2 THEN
                   f.Title2
               ELSE
                   f.Title
           END AS FoodTitle,
           CASE
               WHEN fo.FoodOrderID IS NOT NULL THEN
                   fo.FoodOrderID
               ELSE
                   NULL
           END AS FoodOrderID,
           CASE
               WHEN fo.FoodOrderID IS NOT NULL THEN
                   fo.[Version]
               ELSE
                   0
           END AS [Version],
           CAST(CASE
                    WHEN fo.FoodOrderID IS NOT NULL THEN
                        1
                    ELSE
                        0
                END AS BIT) AS Selected,
           CASE
               WHEN lf.FoodID IS NOT NULL THEN
                   lf.Amount
               ELSE
                   NULL
           END AS Amount
    FROM HRM.FoodPlan fp
        JOIN HRM.Food f
            ON fp.FoodID = f.FoodID
        LEFT JOIN HRM.FoodOrder fo
            ON fp.FoodPlanID = fo.FoodPlanID
               AND fp.Creator = @Creator
        LEFT JOIN #LatestFood lf
            ON f.FoodID = lf.FoodID
               AND lf.Date <= @Date
    WHERE fp.ServingPlaceID = @ServingPlaceId
          AND fp.DATE = @Date;

END;

