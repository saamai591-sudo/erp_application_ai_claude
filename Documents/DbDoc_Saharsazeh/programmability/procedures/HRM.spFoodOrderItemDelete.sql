CREATE   PROC [HRM].[spFoodOrderItemDelete]
    @FoodOrderItemID INT,
    @Version INT
AS
BEGIN 
    SET NOCOUNT ON;

	declare @EntityVersion int, @Type tinyint, @Date date

	select @Type = o.Type,
		   @Date = o.Date,
		   @EntityVersion = i.Version	
	from HRM.FoodOrderItem i
	join HRM.FoodOrder o on i.FoodOrderID = o.FoodOrderID
	where FoodOrderItemID = @FoodOrderItemID

	if (@Type = 1 and @Date < Convert(varchar(10), GETDATE(), 120))
	begin
		RAISERROR('WelfareManagement.Messages.PastHistoryFood', 16, 12);
		return
	end

    IF (@EntityVersion = @Version)
    BEGIN
        DELETE FROM [HRM].[FoodOrderItem]
        WHERE [FoodOrderItemID] = @FoodOrderItemID;
    END;
    ELSE
    BEGIN
        RAISERROR(   N'Delete_%s_%d.', -- Message text.
                     16,               -- Severity,
                     10,               -- State,
                     N'FoodOrderItem', -- First argument.
                     @FoodOrderItemID
                 ); -- Second argument.
    END;
END
