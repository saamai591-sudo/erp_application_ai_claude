-------------------------------------
CREATE   PROC [AST].[SpAssetCategoryUpdate] 
    @AssetCategoryID int,
    @ParentID int = NULL,
    @Level tinyint,    
	@ParentCode varchar(50),
    @Code varchar(10),
    @Title nvarchar(250),
    @Title2 nvarchar(250),
    @Version int,
    @LastEditor int,
    @LastEditionDate datetime

--WITH ENCRYPTION 
	 AS 
SET NOCOUNT ON 
	if @Version <> (Select [Version] from [AST].[AssetCategory]
				where [AssetCategoryID] = @AssetCategoryID)
	RAISERROR('Version mismatch...', 16 , 10)
		
	IF EXISTS (SELECT * FROM AST.AssetCategory a WHERE a.ParentID = @ParentID and a.Code = @Code
	AND a.AssetCategoryID <> @AssetCategoryID)
	BEGIN
		RAISERROR('زیر شاخه های یک گروه نمی توانند کد تکراری داشته باشند.',16,12)
	END	

	set @Version = @Version +1 

		UPDATE [AST].[AssetCategory]
		SET     [ParentID] = @ParentID, 
				[Level] = @Level, 
				[ParentCode] = @ParentCode,
				[Code] = @Code, 
				[Title] = @Title, 
				[Title2] = @Title2, 
				[Version] = @Version, 
				[LastEditor] = @LastEditor, 
				[LastEditionDate] = @LastEditionDate
		WHERE  [AssetCategoryID] = @AssetCategoryID
	
		-- Begin Return Select <- do not remove
		SELECT  [Version], 
				[ParentCode]
		FROM   [AST].[AssetCategory]
		WHERE  [AssetCategoryID] = @AssetCategoryID	
		-- End Return Select <- do not remove
