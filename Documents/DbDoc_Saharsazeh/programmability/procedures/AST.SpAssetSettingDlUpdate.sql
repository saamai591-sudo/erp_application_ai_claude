CREATE PROC [AST].[SpAssetSettingDlUpdate] 
    @AssetSettingDlID int,
    @AssetSettingID int,
    @DlTypeID int,
    @DlID bigint,
    @Version int,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime

--WITH ENCRYPTION 
AS 
	SET NOCOUNT ON 
	DECLARE @AssetID INT

	select @AssetID = a.AssetID from ast.Asset A
	JOIN AST.AssetSetting B ON A.AssetID = B.AssetID
	where AssetSettingID = @AssetSettingID

	UPDATE [AST].[AssetSettingDl]
	SET    [DlTypeID] = @DlTypeID, 
			[DlID] = @DlID, 
			[Version] = @Version + 1, 
			[LastEditor] = @LastEditor, 
			[LastEditionDate] = @LastEditionDate
	WHERE  [AssetSettingDlID] = @AssetSettingDlID

	if exists (select AssetID from ast.Asset where HeadAssetID = @AssetID)
	begin
		UPDATE asd
		SET    [DlTypeID] = @DlTypeID, 
			   [DlID] = @DlID, 
			   [Version] = @Version + 1, 
			   [LastEditor] = @LastEditor, 
			   [LastEditionDate] = @LastEditionDate
		from ast.Asset a
		join ast.AssetSetting ass on a.AssetID = ass.AssetID
		join ast.AssetSettingDl asd on asd.AssetSettingID = ass.AssetSettingID
		where HeadAssetID = @AssetID
		AND ASS.ParentID IS NOT NULL
		and ass.AssetSettingID not in (select isnull(ParentID,0) from ast.AssetSetting)
	end
	
	-- Begin Return Select <- do not remove
	SELECT [Version]
	FROM   [AST].[AssetSettingDl]
	WHERE  [AssetSettingDlID] = @AssetSettingDlID	
	-- End Return Select <- do not remove
