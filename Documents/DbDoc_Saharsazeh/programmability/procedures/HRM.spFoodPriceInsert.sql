CREATE   PROC [HRM].[spFoodPriceInsert]
    @Date Date,
	@ServingPlaceID int,
	@FoodID int,
	@Amount decimal(30, 4),
	@PartyID bigint,
    @Creator int,
    @CreationDate datetime
AS 
BEGIN 	
	if exists (select 1 from HRM.FoodPrice f
			where f.[Date] = @Date and f.PartyID = @PartyID and f.FoodID = @FoodID)
	begin
		raiserror('WelfareManagement.Messages.DuplicateFoodPrice', 16, 12)
		return
	end

	INSERT INTO [HRM].FoodPrice (Date, ServingPlaceID, FoodID, Amount, PartyID, [Version], [Creator], [CreationDate], [LastEditor], [LastEditionDate])
	SELECT @Date, @ServingPlaceID, @FoodID, @Amount, @PartyID, 0, @Creator, @CreationDate, @Creator, @CreationDate
	
	-- Begin Return Select <- do not remove
	SELECT FoodPriceID, [Version]
	FROM   [HRM].FoodPrice
	WHERE  FoodPriceID = SCOPE_IDENTITY()
	-- End Return Select <- do not remove
END
