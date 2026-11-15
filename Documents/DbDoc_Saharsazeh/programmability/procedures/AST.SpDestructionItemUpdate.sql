CREATE   PROC [AST].[SpDestructionItemUpdate] 
    @DestructionItemID int,
    @DestructionID int,
    @AssetID int,
    @Version int,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime
--WITH ENCRYPTION
AS 
SET NOCOUNT ON
	if @Version <> (Select [Version] from [AST].[DestructionItem]
				where [DestructionItemID] = @DestructionItemID)
	begin
		RAISERROR('Version mismatch...', 16 , 10)
		return
	end
	
	declare @plaque varchar(250),
			@DepreciationMethod tinyint,
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

	UPDATE [AST].[DestructionItem]
	SET    [DestructionID] = @DestructionID, [AssetID] = @AssetID, [Version] = @Version, [Creator] = @Creator, [CreationDate] = @CreationDate, [LastEditor] = @LastEditor, [LastEditionDate] = @LastEditionDate
	WHERE  [DestructionItemID] = @DestructionItemID
	
	-- Begin Return Select <- do not remove
	SELECT [Version]
	FROM   [AST].[DestructionItem]
	WHERE  [DestructionItemID] = @DestructionItemID	
	-- End Return Select <- do not remove
