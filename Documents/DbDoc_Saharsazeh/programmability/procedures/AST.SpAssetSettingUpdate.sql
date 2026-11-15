CREATE    PROC [AST].[SpAssetSettingUpdate]
    @AssetSettingID int,
    @Date date,
    @Responsible bigint = NULL,
    @Deliverer bigint = NULL,
    @DeployPlaceID int = NULL,
    @Status tinyint,
    @Version int,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime,
	@RowIndex int
--WITH ENCRYPTION 
AS 
	SET NOCOUNT ON 
	declare @PreVersion int,@AssetID int

	Select @PreVersion = [Version] ,@AssetID = AssetID
	from [AST].[AssetSetting]
	where [AssetSettingID] = @AssetSettingID

	if @Version <> @PreVersion
	RAISERROR('Version mismatch...', 16 , 10)

	set @Version = @Version +1 

		UPDATE [AST].[AssetSetting]
		SET    [Date] = @Date, 
			   [Responsible] = @Responsible, 
			   [Deliverer] = @Deliverer, 
			   [DeployPlaceID] = @DeployPlaceID, 
			   [Status] = @Status, 
			   [Version] = @Version, 
			   [LastEditor] = @LastEditor, 
			   [LastEditionDate] = @LastEditionDate,
			   RowIndex = @RowIndex
		WHERE  [AssetSettingID] = @AssetSettingID

	if exists (select AssetID from ast.Asset where HeadAssetID = @AssetID)
	begin
		update ass
			SET    [Date] = @Date, 
				   [Responsible] = @Responsible, 
				   [Deliverer] = @Deliverer, 
				   [DeployPlaceID] = @DeployPlaceID, 
				   [Status] = @Status, 
				   [Version] = @Version, 
				   [LastEditor] = @LastEditor, 
				   [LastEditionDate] = @LastEditionDate
		from ast.Asset a
		join ast.AssetSetting ass on a.AssetID = ass.AssetID
		where HeadAssetID = @AssetID
		and ass.ParentID is not null
		and ass.AssetSettingID not in (select isnull(ParentID,0) from ast.AssetSetting)
		
	end

	-- Begin Return Select <- do not remove
	SELECT [Version]
	FROM   [AST].[AssetSetting]
	WHERE  [AssetSettingID] = @AssetSettingID	
	-- End Return Select <- do not remove
