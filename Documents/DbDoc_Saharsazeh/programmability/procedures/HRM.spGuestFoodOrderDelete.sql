
CREATE   PROC [HRM].[spGuestFoodOrderDelete] 
    @GuestFoodOrderID int,
	@Version int
AS 
	SET NOCOUNT ON 
	SET XACT_ABORT ON  
	
IF @Version =
(
    SELECT [Version]
    FROM [HRM].GuestFoodOrder
    WHERE GuestFoodOrderID = @GuestFoodOrderID
)
BEGIN
	DELETE
	FROM   [HRM].GuestFoodOrder
	WHERE  GuestFoodOrderID = @GuestFoodOrderID

END;
ELSE
BEGIN

    RAISERROR(   N'Delete_%s_%d.',      -- Message text.
                 16,                    -- Severity,
                 10,                    -- State,
                 N'GuestFoodOrder', -- First argument.
                 @GuestFoodOrderID
             ); -- Second argument.

END;



