CREATE   PROC [HRM].[spFoodPlanItemInsert]
    @FoodPlanID int,
	@FoodID int,
	@PartyID bigint,
    @Creator int,
    @CreationDate datetime
--WITH ENCRYPTION 
AS 
BEGIN
	SET NOCOUNT ON 

    declare @Date date, @ServingPlaceID int

	select @Date = DATE, 
	       @ServingPlaceID = ServingPlaceID 
	from HRM.FoodPlan f 
	where FoodPlanID = @FoodPlanID

	if exists (select 1 from HRM.FoodPlanItem fpi
	           join HRM.FoodPlan fp on fpi.FoodPlanID = fp.FoodPlanID
	           where fp.ServingPlaceID = @ServingPlaceID and fp.DATE = @DATE and fpi.FoodID = @FoodID and
			   fpi.PartyID = @PartyID
	 )
	begin
		RAISERROR('WelfareManagement.Messages.duplicateFoodAndDateAndRestaurant', 16, 12)
		return
	end

	INSERT INTO HRM.FoodPlanItem (FoodPlanID, FoodID, PartyID,
		 [Version], [Creator], [CreationDate], [LastEditor], [LastEditionDate])
	SELECT @FoodPlanID, @FoodID, @PartyID,
		 0, @Creator, @CreationDate, @Creator, @CreationDate
	
	-- Begin Return Select <- do not remove
	SELECT FoodPlanItemID, [Version]
	FROM   HRM.FoodPlanItem
	WHERE  FoodPlanItemID = SCOPE_IDENTITY()
	-- End Return Select <- do not remove
END
