CREATE   PROC [AST].[SpSalvageDelete] 
    @SalvageID int,@Version int
--WITH ENCRYPTION
AS 
SET NOCOUNT ON 
	declare @PreVersion int,
			@PreVoucherID int

	Select  @PreVersion = [Version],
			@PreVoucherID = PreVoucherID 
		from [AST].[Salvage]
	where [SalvageID] = @SalvageID

	if @PreVoucherID is not null
	BEGIN
        RAISERROR('UnableToDeletePrevoucher',16,12)
		RETURN
	END


	if @Version=@PreVersion
	begin	


		DECLARE @ItemID int,@ItemVersion int,@assetid int
		
		DECLARE db_cursor CURSOR FOR
		select SalvageItemID , Version,AssetID
		from ast.SalvageItem
		WHERE  SalvageID = @SalvageID
				
		OPEN db_cursor   
		FETCH NEXT FROM db_cursor INTO @ItemID,@ItemVersion,@assetid

		WHILE @@FETCH_STATUS = 0   
		BEGIN  
		
		exec ast.SpSalvageItemDelete @ItemID,@ItemVersion

		update ast.Asset
		set Status = 1
		where AssetID = @assetid

		
		FETCH NEXT FROM db_cursor INTO @ItemID,@ItemVersion ,@assetid
		END   

		CLOSE db_cursor   
		DEALLOCATE db_cursor


		
		DELETE
		FROM   [AST].[Salvage]
		WHERE  [SalvageID] = @SalvageID
		
	end
	else
	begin
	
	RAISERROR (N'Delete_%s_%d.', -- Message text.
		16, -- Severity,
		10, -- State,
		N'Salvage', -- First argument.
		@SalvageID); -- Second argument.)
	end
