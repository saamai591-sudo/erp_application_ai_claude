
CREATE PROC [FOS].[spOrderPricingItemUpdate]
    @OrderPricingItemID int,   
	@OrderPricingID int,
    @ClearanceItemID int,
    @OrderPricingCostID int,
    @Share decimal(30, 4),  
    @LastEditor int,
    @LastEditionDate datetime,
    @Version int
--WITH ENCRYPTION
AS 
	SET NOCOUNT ON
	Select @Version = [Version] + 1 from FOS.OrderPricingItem
	where OrderPricingItemID = @OrderPricingItemID

	UPDATE FOS.OrderPricingItem
	SET    OrderPricingID = @OrderPricingID, 
			ClearanceItemID = @ClearanceItemID, 
			OrderPricingCostID = @OrderPricingCostID,
			Share = @Share, 
			LastEditor = @LastEditor, 
			LastEditionDate = @LastEditionDate, 
			[Version] = @Version
	WHERE  OrderPricingItemID = @OrderPricingItemID
	
	-- Begin Return Select <- do not remove
	SELECT [Version]
	FROM   FOS.OrderPricingItem
	WHERE  OrderPricingItemID = @OrderPricingItemID	
	-- End Return Select <- do not remove
