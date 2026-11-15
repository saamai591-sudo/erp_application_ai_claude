CREATE   PROC [HRM].[spFoodPlanItemUpdate]
    @FoodPlanItemID int,
	@FoodPlanID int,
	@FoodID int,
	@PartyID bigint,
    @Version int,
    @LastEditor int,
    @LastEditionDate datetime
--WITH ENCRYPTION 
AS 
	SET NOCOUNT ON 
	declare @Date date, @ServingPlaceID int

	select @Date = DATE, 
	       @ServingPlaceID = ServingPlaceID 
	from HRM.FoodPlan f 
	where FoodPlanID = @FoodPlanID

	if exists (select 1 from HRM.FoodPlanItem fpi
	           join HRM.FoodPlan fp on fpi.FoodPlanID = fp.FoodPlanID
	           where fp.ServingPlaceID = @ServingPlaceID and fp.DATE = @DATE and fpi.FoodID = @FoodID and
			   fpi.PartyID = @PartyID and
			   fpi.FoodPlanItemID <> @FoodPlanItemID
	 )
	begin
		RAISERROR('WelfareManagement.Messages.duplicateFoodAndDateAndRestaurant', 16, 12)
		return
	end

	if exists (select 1 from HRM.FoodPlanItem fpi
	    join HRM.FoodPlan fp on fpi.FoodPlanID = fp.FoodPlanID
	    join (select f.Date, f.ServingPlaceID, foi.FoodID from HRM.FoodOrder f
		JOIN HRM.FoodOrderItem AS foi ON foi.FoodOrderID = f.FoodOrderID) fo 
			 on fp.DATE = fo.Date and fp.ServingPlaceID = fo.ServingPlaceID and fpi.FoodID = fo.FoodID
		where fpi.FoodPlanItemID = @FoodPlanItemID)
	begin
		RAISERROR('WelfareManagement.Messages.NotEditableBecauseOfFlowFood',16,12)
		return
	end

    IF @Version <>
    (
        SELECT [Version]
        FROM HRM.FoodPlanItem
        WHERE FoodPlanItemID = @FoodPlanItemID
    )
	begin
		RAISERROR('Version mismatch...', 16, 10);
	end       	 

	UPDATE HRM.FoodPlanItem
	SET    FoodID = @FoodID,
	       PartyID = @PartyID,
	       [Version] = @Version + 1, 
		   [LastEditor] = @LastEditor, 
		   [LastEditionDate] = @LastEditionDate
	WHERE  FoodPlanItemID = @FoodPlanItemID
	
	-- Begin Return Select <- do not remove
	SELECT [Version]
	FROM   HRM.FoodPlanItem
	WHERE  FoodPlanItemID = @FoodPlanItemID
	-- End Return Select <- do not remove
