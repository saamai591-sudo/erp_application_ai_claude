CREATE   PROC [AST].[SpDeployPlaceInsert]
    @ParentID int = NULL,	
    @Code varchar(MAX),
    @Title nvarchar(250),
    @Title2 nvarchar(250),
    @Creator int,
    @CreationDate datetime

--WITH ENCRYPTION 
AS 
	SET NOCOUNT ON 

	IF EXISTS (SELECT * FROM AST.DeployPlace d WHERE d.ParentID = @ParentID and d.Code = @Code)
	BEGIN
		RAISERROR('زیر شاخه های یک گروه، نمی توانند کد تکراری داشته باشند.',16,12)
	END
	
	INSERT INTO [AST].[DeployPlace] ([ParentID], [Code], [Title], [Title2], [Version], [Creator], [CreationDate], [LastEditor], [LastEditionDate])
	SELECT @ParentID, @Code, @Title, @Title2, 0, @Creator, @CreationDate, @Creator, @CreationDate
	
	-- Begin Return Select <- do not remove
	SELECT [DeployPlaceID], [Version]
	FROM   [AST].[DeployPlace]
	WHERE  [DeployPlaceID] = SCOPE_IDENTITY()
	-- End Return Select <- do not remove
