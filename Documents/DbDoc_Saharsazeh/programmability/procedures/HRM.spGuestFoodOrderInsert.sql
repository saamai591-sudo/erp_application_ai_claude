
CREATE   PROC [HRM].[spGuestFoodOrderInsert]
    @Date date,
	@ServingPlaceID int,
	@FoodID int,
    @Quantity int,
	@Amount decimal(30, 4),
    @Creator int,	
    @CreationDate datetime
AS 
	SET NOCOUNT ON 
	SET XACT_ABORT ON  

	INSERT INTO [HRM].[GuestFoodOrder] ([Date], ServingPlaceID, FoodID, Quantity, Amount, [Version], [Creator], [CreationDate], [LastEditor], [LastEditionDate])
	SELECT @Date, @ServingPlaceID, @FoodID, @Quantity, @Amount, 0, @Creator, @CreationDate, @Creator, @CreationDate
	
	-- Begin Return Select <- do not remove
	SELECT GuestFoodOrderID, [Version]
	FROM   [HRM].GuestFoodOrder
	WHERE  GuestFoodOrderID = SCOPE_IDENTITY()
	-- End Return Select <- do not remove

