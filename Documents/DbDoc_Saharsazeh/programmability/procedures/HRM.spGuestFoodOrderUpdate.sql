
CREATE   PROC [HRM].[spGuestFoodOrderUpdate]
    @GuestFoodOrderID int,
    @Date date,
	@ServingPlaceID int,
	@FoodID int,
    @Quantity int,
	@Amount decimal(30, 4),
    @Version int,
    @LastEditor int,
    @LastEditionDate datetime
AS 
	SET NOCOUNT ON 
	SET XACT_ABORT ON  	

    IF @Version <>
    (
        SELECT [Version]
        FROM [HRM].GuestFoodOrder 
        WHERE GuestFoodOrderID = @GuestFoodOrderID
    )
	begin
		RAISERROR('Version mismatch...', 16, 10);
	end        

	UPDATE [HRM].GuestFoodOrder
	SET    [Date] = @Date,
	       ServingPlaceID = @ServingPlaceID,
	       FoodID = @FoodID,
	       Quantity = @Quantity, 
		   Amount = @Amount,
	       [Version] = @Version + 1, 
		   [LastEditor] = @LastEditor, 
		   [LastEditionDate] = @LastEditionDate
	WHERE  GuestFoodOrderID = @GuestFoodOrderID
	
	-- Begin Return Select <- do not remove
	SELECT  [Version]
	FROM   [HRM].GuestFoodOrder
	WHERE  GuestFoodOrderID = @GuestFoodOrderID
	-- End Return Select <- do not remove
