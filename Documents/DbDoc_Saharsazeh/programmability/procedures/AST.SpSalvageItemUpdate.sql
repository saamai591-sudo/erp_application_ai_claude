CREATE   PROC [AST].[SpSalvageItemUpdate] 
    @SalvageItemID int,
    @SalvageID int,
    @AssetID int,
	@Description nvarchar(1024) = NULL,
	@Description2 nvarchar(1024) = NULL,
    @Version int,
    @LastEditor int,
    @LastEditionDate datetime
--WITH ENCRYPTION
AS 
SET NOCOUNT ON 

	if @Version <> (Select [Version] from [AST].[SalvageItem]
				where [SalvageItemID] = @SalvageItemID)
	begin
		RAISERROR('Version mismatch...', 16 , 10)
		return
	end
	declare @plaque varchar(250),			
			@message nvarchar(max)

	if exists (select * from ast.SaleItem where AssetID = @AssetID)
	begin

		select @plaque = Plaque
		from ast.Asset 
		where AssetID = @AssetID

		set @message = 'پلاک  ' + @plaque + ' بعد از این عملیات به فروش رسیده بنابراین مجاز به انجام این عملیات نیستید.'
	
		RAISERROR(@message, 16, 12)
		return
	end

	set @Version = @Version +1 

	UPDATE [AST].[SalvageItem]
	SET     [AssetID] = @AssetID, 
			[Description] = @Description,
			[Description2] = @Description2,
			[Version] = @Version, 
			[LastEditor] = @LastEditor, 
			[LastEditionDate] = @LastEditionDate
	WHERE  [SalvageItemID] = @SalvageItemID
	
	-- Begin Return Select <- do not remove
	SELECT  [Version]
	FROM   [AST].[SalvageItem]
	WHERE  [SalvageItemID] = @SalvageItemID	
	-- End Return Select <- do not remove
