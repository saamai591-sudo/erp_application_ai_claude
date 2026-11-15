CREATE   PROC [HRM].[spFoodPriceUpdate]
    @FoodPriceID int,
    @Date Date,
	@ServingPlaceID int,
	@FoodID int,
	@Amount decimal(30, 4),
	@PartyID bigint,
    @Version int,
    @LastEditor int,
    @LastEditionDate datetime
AS 
    IF @Version <>
    (
        SELECT [Version]
        FROM [HRM].FoodPrice 
        WHERE FoodPriceID = @FoodPriceID
    )
	begin
		RAISERROR('Version mismatch...', 16, 10);
		return
	end        

	if exists (select * from HRM.FoodPrice f
			where f.[Date] = @Date and f.PartyID = @PartyID and f.FoodID = @FoodID and
				f.FoodPriceID <> @FoodPriceID)
	begin
		raiserror('WelfareManagement.Messages.DuplicateFoodPrice', 16, 12)
		return
	end

	UPDATE [HRM].FoodPrice
	SET    Date = @Date, 
	       ServingPlaceID = @ServingPlaceID, 
		   FoodID = @FoodID,
		   Amount = @Amount,
		   PartyID = @PartyID,
	       [Version] = @Version + 1, 
		   [LastEditor] = @LastEditor, 
		   [LastEditionDate] = @LastEditionDate
	WHERE  FoodPriceID = @FoodPriceID
	
	-- Begin Return Select <- do not remove
	SELECT [Version]
	FROM   [HRM].FoodPrice
	WHERE  FoodPriceID = @FoodPriceID
	-- End Return Select <- do not remove
