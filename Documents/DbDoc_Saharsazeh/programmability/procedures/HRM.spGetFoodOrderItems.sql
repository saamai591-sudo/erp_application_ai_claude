CREATE PROC [HRM].[spGetFoodOrderItems]
    @ServingPlaceId INT,
    @Date DATE,
    @Type TINYINT,
    @FoodOrderID INT 
AS
BEGIN
    DECLARE @Culture VARCHAR(25),
            @CultureNo TINYINT;

    SET @Culture = CFG.GetuserCulture();

    SELECT @CultureNo = CultureNo
    FROM CFG.CultureInfo
    WHERE Culture = @Culture;

    SELECT p.PartyID,
           d.Code PartyCode,
           CAST(CASE
                    WHEN p.[Type] = 1
                         OR p.[Type] = 2 THEN
                        p.Title
                    WHEN p.[Type] = 0 THEN
                        p.Title + ' ' + p.LastName
                END AS NVARCHAR(512)) AS PartyName
    INTO #parties
    FROM CFG.Party p
        LEFT JOIN ACC.DL d
            ON d.DLID = p.DlID;

    SELECT *
    INTO #FoodPlanItems
    FROM
    (
        SELECT ROW_NUMBER() OVER (PARTITION BY fpi.FoodID, fpi.PartyID ORDER BY fp.DATE DESC) rno,
               fp.FoodPlanID,
               fpi.FoodID,
               fpi.PartyID
        FROM HRM.FoodPlanItem fpi
            JOIN HRM.FoodPlan fp
                ON fpi.FoodPlanID = fp.FoodPlanID
        WHERE fp.ServingPlaceID = @ServingPlaceId
              AND fp.DATE = @Date
    ) x
    WHERE x.rno = 1;

    SELECT i.FoodOrderItemID,
           i.FoodOrderID,
           i.FoodID,
           i.Quantity,
           i.Amount,
           i.PartyID,
           i.Version,
           i.Creator,
           i.CreationDate,
           i.Description,
           i.Description2
    INTO #FoodOrders
    FROM HRM.FoodOrderItem i        
    WHERE i.FoodOrderID = @FoodOrderID;

    SELECT @Type AS Type,
           @Date AS Date,
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
               WHEN @CultureNo = 2 THEN
                   ft.Title2
               ELSE
                   ft.Title
           END AS FoodTypeTitle,
           cast(0 as BIT) HasOrderLimit,
           ft.NeededPlan
    INTO #res
    FROM HRM.Food f
        JOIN HRM.FoodType ft
            ON f.FoodTypeID = ft.FoodTypeID;

		SELECT r.Type,
           r.Date,
           r.ServingPlaceID,
           r.FoodID,
           r.FoodTypeID,
           r.FoodTitle,
           r.FoodTypeTitle,
           r.HasOrderLimit,
           r.NeededPlan,
           fo.FoodOrderID,
		   fo.FoodOrderItemID,
           CASE
               WHEN fo.FoodOrderItemID IS NOT NULL THEN
                   fo.PartyID
               WHEN fo.FoodOrderItemID IS NULL
                    AND p.FoodPlanID IS NOT NULL THEN
                   p.PartyID
               ELSE
                   NULL
           END AS PartyID,
           CASE
               WHEN fo.FoodOrderItemID IS NOT NULL THEN
                   fo.Quantity
               ELSE
                   NULL
           END AS Quantity,
           CASE
               WHEN fo.FoodOrderItemID IS NOT NULL THEN
                   fo.Amount / fo.Quantity
               WHEN fo.FoodOrderItemID IS NULL
                    AND lfp.FoodID IS NOT NULL THEN
                   lfp.Amount
               ELSE
                   NULL
           END AS FoodPrice,
           CASE
               WHEN fo.FoodOrderItemID IS NOT NULL THEN
                   fo.Amount
               ELSE
                   NULL
           END AS Amount,
		   fo.[Version],
           CAST(CASE
                    WHEN fo.FoodOrderItemID IS NOT NULL THEN
                        1
                    ELSE
                        0
                END AS BIT) AS Selected,
           fo.Creator,
           fo.CreationDate,
           fo.[Description],
           fo.Description2
		INTO #res2
		FROM #res r
			LEFT JOIN #FoodPlanItems p
				ON r.FoodID = p.FoodID
			LEFT JOIN
			(
				SELECT *
				FROM
				(
					SELECT ROW_NUMBER() OVER (PARTITION BY p.FoodID, p.PartyID ORDER BY p.Date DESC) rno,
						   p.FoodID,
						   p.PartyID,
						   p.Amount
					FROM HRM.FoodPrice p
						JOIN HRM.Food f
							ON p.FoodID = f.FoodID
						JOIN HRM.FoodType t
							ON f.FoodTypeID = t.FoodTypeID
							   AND t.NeededPlan = 1
					WHERE p.ServingPlaceID = @ServingPlaceId
						  AND p.Date <= @Date
				) T
			) lfp
				ON r.FoodID = lfp.FoodID
				AND lfp.PartyID = p.PartyID
				AND lfp.rno = 1                      
		LEFT JOIN #FoodOrders fo
            ON r.FoodID = fo.FoodID and 
			(r.NeededPlan = 0 or p.PartyID = fo.PartyID)
		where r.NeededPlan = 0 or p.FoodPlanID IS NOT NULL

		select t.Type,
			t.Date,
            t.ServingPlaceID,
            t.FoodID,
            t.FoodTypeID,
            t.FoodTitle,
            t.FoodTypeTitle,
            t.HasOrderLimit,
            t.NeededPlan,
			ISNULL(t.FoodOrderItemID, 0) AS FoodOrderItemID,
            ISNULL(t.FoodOrderID, 0) AS FoodOrderID,
            t.PartyID,
            t.Quantity,
            t.FoodPrice,
            t.Amount,
			ISNULL(t.[Version], 0) AS [Version],
            t.Selected,
            t.Creator,
            t.CreationDate,
            CASE
                WHEN pa.PartyID IS NOT NULL THEN
                    pa.PartyCode
                ELSE
                    NULL
            END AS PartyCode,
            CASE
                WHEN pa.PartyID IS NOT NULL THEN
                    pa.PartyName
                ELSE
                    NULL
            END AS PartyName,
            t.Description,
            t.Description2
		from #res2 t
		LEFT JOIN #parties pa on t.PartyID = pa.PartyID
END
