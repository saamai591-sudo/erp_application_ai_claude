CREATE   PROC [AST].[SpDeployPlaceUpdate]
    @DeployPlaceID int,
    @ParentID int = NULL,    
    @Code varchar(MAX),
    @Title nvarchar(250),
    @Title2 nvarchar(250),
    @Version int,
    @LastEditor int,
    @LastEditionDate datetime

--WITH ENCRYPTION 
	 AS 
SET NOCOUNT ON 

	if @Version <> (Select [Version] from [AST].[DeployPlace]
				where [DeployPlaceID] = @DeployPlaceID)
	RAISERROR('Version mismatch...', 16 , 10)
	
	   IF EXISTS (SELECT * FROM AST.DeployPlace d WHERE d.ParentID = @ParentID and d.Code = @Code
		AND d.DeployPlaceID <> @DeployPlaceID)
		BEGIN
			RAISERROR('زیر شاخه های یک گروه، نمی توانند کد تکراری داشته باشند.',16,12)
		END		

	set @Version = @Version +1 

	UPDATE [AST].[DeployPlace]
	SET    [ParentID] = @ParentID, 
			[Code] = @Code, 
			[Title] = @Title, 
			[Title2] = @Title2, 
			[Version] = @Version,
			[LastEditor] = @LastEditor, 
			[LastEditionDate] = @LastEditionDate
	WHERE  [DeployPlaceID] = @DeployPlaceID
	
	-- Begin Return Select <- do not remove
	SELECT [Version]
	FROM   [AST].[DeployPlace]
	WHERE  [DeployPlaceID] = @DeployPlaceID	
	-- End Return Select <- do not remove
