CREATE PROC [FOS].[spBillOfLadingItemDelete] 
    @BillOfLadingItemID int,@Version int
AS 
	SET NOCOUNT ON 

	
	if @Version=(Select [Version] from [FOS].[BillOfLadingItem]
	where [BillOfLadingItemID] = @BillOfLadingItemID)
	begin	



		DELETE
		FROM   [FOS].[BillOfLadingItem]
		WHERE  [BillOfLadingItemID] = @BillOfLadingItemID

	end
	else
	begin
	
	RAISERROR (N'Delete_%s_%d.', -- Message text.
		16, -- Severity,
		10, -- State,
		N'BillOfLadingItem', -- First argument.
		@BillOfLadingItemID); -- Second argument.)
	end
