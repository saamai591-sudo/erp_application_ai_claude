-------------------------------------
CREATE   PROC [AST].[SpAssetCategoryInsert] 
    @ParentID int = NULL,
    @Level tinyint,
	@ParentCode varchar(50),
    @Code varchar(10),
    @Title nvarchar(250),
    @Title2 nvarchar(250),
    @Creator int,
    @CreationDate datetime

--WITH ENCRYPTION 
AS 
	SET NOCOUNT ON 

	IF EXISTS (SELECT * FROM AST.AssetCategory a WHERE a.ParentID = @ParentID and a.Code = @Code)
	BEGIN
		RAISERROR('زیر شاخه های یک گروه نمی توانند کد تکراری داشته باشند.',16,12)
	END  
	
	SELECT @ParentCode = ISNULL(a.ParentCode,'') + a.Code FROM AST.AssetCategory a WHERE a.AssetCategoryID = @ParentID
	
	
	INSERT INTO [AST].[AssetCategory] ([ParentID], [Level], [ParentCode],[Code], [Title], [Title2], [Version], [Creator], [CreationDate], [LastEditor], [LastEditionDate])
	SELECT @ParentID, @Level,@ParentCode, @Code, @Title, @Title2, 0, @Creator, @CreationDate, @Creator, @CreationDate
	
	-- Begin Return Select <- do not remove
	SELECT [AssetCategoryID], [Version],[ParentCode]
	FROM   [AST].[AssetCategory]
	WHERE  [AssetCategoryID] = SCOPE_IDENTITY()
	-- End Return Select <- do not remove
