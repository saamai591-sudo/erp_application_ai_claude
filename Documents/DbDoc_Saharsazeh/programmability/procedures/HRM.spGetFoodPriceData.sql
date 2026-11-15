
create   PROC HRM.spGetFoodPriceData
    @ServingPlaceId int,
    @Date date
AS
BEGIN

	select *
    FROM
	(
		SELECT ROW_NUMBER() OVER (PARTITION BY p.FoodID, p.PartyID ORDER BY p.Date DESC) rno,
		        p.FoodPriceID,
				p.FoodID,
				p.PartyID,
				p.Amount
		FROM HRM.FoodPrice p
		join HRM.Food f on p.FoodID = f.FoodID
		join HRM.FoodType t on f.FoodTypeID = t.FoodTypeID
		where p.ServingPlaceID = 17 and p.Date <= GETDATE() and t.NeededPlan = 0
	) x where x.rno = 1

END
