CREATE    PROC [AST].[SpAssetSettingInsert]
    @AssetID int,
    @ParentID int = NULL,
    @Date date,
    @Responsible bigint = NULL,
    @Deliverer bigint = NULL,
    @DeployPlaceID int = NULL,
    @Status tinyint,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime ,
	@ChangePositionID int,
	@RowIndex int

--WITH ENCRYPTION 
AS 
	SET NOCOUNT ON 

	if exists (select AssetID from ast.Asset where HeadAssetID = @AssetID)
	begin
		INSERT INTO [AST].[AssetSetting] ([AssetID], [ParentID], [Date], [Responsible], [Deliverer], [DeployPlaceID], [Status], [Version], [Creator], [CreationDate], [LastEditor], [LastEditionDate])
		SELECT a.AssetID, ass.AssetSettingID, @Date, @Responsible, @Deliverer, @DeployPlaceID, @Status, 0, @Creator, @CreationDate, @LastEditor, @LastEditionDate
		from ast.Asset a
		join ast.AssetSetting ass on a.AssetID = ass.AssetID
		where HeadAssetID = @AssetID
		and ass.AssetSettingID not in (select isnull(ParentID,0) from ast.AssetSetting)
	end
	
	INSERT INTO [AST].[AssetSetting] ([AssetID], [ParentID], [Date], [Responsible], [Deliverer], [DeployPlaceID], [Status], [Version], [Creator], [CreationDate], [LastEditor], [LastEditionDate],[ChangePositionID],[RowIndex])
	SELECT @AssetID, @ParentID, @Date, @Responsible, @Deliverer, @DeployPlaceID, @Status, 0, @Creator, @CreationDate, @LastEditor, @LastEditionDate,@ChangePositionID,@RowIndex
	
	-- Begin Return Select <- do not remove
	SELECT [AssetSettingID], [Version]
	FROM   [AST].[AssetSetting]
	WHERE  [AssetSettingID] = SCOPE_IDENTITY()
	-- End Return Select <- do not remove
