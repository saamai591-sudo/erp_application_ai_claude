CREATE PROC [CTM].[spShoppingCartDelete] 
    @ShoppingCartID int,@Version int
AS 
	SET NOCOUNT ON 

	
	if @Version=(Select [Version] from [CTM].[ShoppingCart]
	where [ShoppingCartID] = @ShoppingCartID)
	begin	



		DELETE
		FROM   [CTM].[ShoppingCart]
		WHERE  [ShoppingCartID] = @ShoppingCartID

	end
	else
	begin
	
	RAISERROR (N'Delete_%s_%d.', -- Message text.
		16, -- Severity,
		10, -- State,
		N'ShoppingCart', -- First argument.
		@ShoppingCartID); -- Second argument.)
	end
