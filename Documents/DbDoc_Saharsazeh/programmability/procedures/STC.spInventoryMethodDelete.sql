
CREATE PROC [STC].[spInventoryMethodDelete] 
    @InventoryMethodID int,@Version int
AS 
	SET NOCOUNT ON 

	
	if @Version=(Select [Version] from [STC].[InventoryMethod]
	where [InventoryMethodID] = @InventoryMethodID)
	begin	



		DELETE
		FROM   [STC].[InventoryMethod]
		WHERE  [InventoryMethodID] = @InventoryMethodID

	end
	else
	begin
	
	RAISERROR (N'Delete_%s_%d.', -- Message text.
		16, -- Severity,
		10, -- State,
		N'InventoryMethod', -- First argument.
		@InventoryMethodID); -- Second argument.)
	end

