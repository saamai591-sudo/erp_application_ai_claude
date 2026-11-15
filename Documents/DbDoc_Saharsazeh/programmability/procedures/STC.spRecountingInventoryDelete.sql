CREATE PROC [STC].[spRecountingInventoryDelete] 
    @RecountingInventoryID int,
	@Version int
	--WITH ENCRYPTION 
AS 
BEGIN
	SET NOCOUNT ON 
	 
	if @Version=(Select [Version] from [STC].[RecountingInventory]
	where [RecountingInventoryID] = @RecountingInventoryID)
	begin	

		DECLARE @State INT
		SELECT @State= rit.[Status] FROM stc.RecountingInventory ri
		INNER JOIN stc.RecountingInventoryTag rit ON rit.RecountingInventoryTagID = ri.RecountingInventoryTagID
		WHERE ri.RecountingInventoryID=@RecountingInventoryID

		IF @State=1
		BEGIN		
			DECLARE @Message NVARCHAR(MAX)
			RAISERROR('STC_spRecountingInventoryDelete_1',16,12)
			return
		END

		DELETE
		FROM   [STC].[RecountingInventory]
		WHERE  [RecountingInventoryID] = @RecountingInventoryID
	END
	ELSE
	BEGIN
		RAISERROR (N'Delete_%s_%d.', -- Message text.
			16, -- Severity,
			10, -- State,
			N'RecountingInventory', -- First argument.
			@RecountingInventoryID); -- Second argument.)
	END
END
