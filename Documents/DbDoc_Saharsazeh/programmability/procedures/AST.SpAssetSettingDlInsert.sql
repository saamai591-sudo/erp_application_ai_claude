CREATE PROC [AST].[SpAssetSettingDlInsert] 
    @AssetSettingID int,
    @DlTypeID int,
    @DlID bigint,
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
	
	if exists (select AssetID from ast.Asset where HeadAssetID = @AssetID)
	begin

	INSERT INTO [AST].[AssetSettingDl] ([AssetSettingID], [DlTypeID], [DlID], [Version], [Creator], [CreationDate], [LastEditor], [LastEditionDate])
	SELECT ASS.AssetSettingID, @DlTypeID, @DlID, 0, @Creator, @CreationDate, @LastEditor, @LastEditionDate
		from ast.Asset a
		join ast.AssetSetting ass on a.AssetID = ass.AssetID
		where HeadAssetID = @AssetID
		AND ASS.ParentID IS NOT NULL
		and ass.AssetSettingID not in (select isnull(ParentID,0) from ast.AssetSetting)
	END
		
	INSERT INTO [AST].[AssetSettingDl] ([AssetSettingID], [DlTypeID], [DlID], [Version], [Creator], [CreationDate], [LastEditor], [LastEditionDate])
	SELECT @AssetSettingID, @DlTypeID, @DlID, 0, @Creator, @CreationDate, @LastEditor, @LastEditionDate
	
	-- Begin Return Select <- do not remove
	SELECT [AssetSettingDlID], [Version]
	FROM   [AST].[AssetSettingDl]
	WHERE  [AssetSettingDlID] = SCOPE_IDENTITY()
	-- End Return Select <- do not remove
