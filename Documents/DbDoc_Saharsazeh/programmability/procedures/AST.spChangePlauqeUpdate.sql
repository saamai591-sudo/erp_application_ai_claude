CREATE PROC [AST].[spChangePlauqeUpdate] 
    @ChangePlauqeID int,
    @AssetID int,
    @Date date,
    @OldPlauqe nvarchar(500),
    @NewPlauqe nvarchar(500),
    @Version int,
    @LastEditor int,
    @LastEditionDate datetime

--WITH ENCRYPTION

AS 
	SET NOCOUNT ON 
	SET XACT_ABORT ON  

	if @Version <> (Select [Version] from [AST].[ChangePlauqe]
	where [ChangePlauqeID] = @ChangePlauqeID)
	begin
		RAISERROR('Version mismatch...', 16 , 10)
		return
	end

	set @Version = @Version +1 

	UPDATE [AST].[ChangePlauqe]
	SET     [AssetID] = @AssetID, 
			[Date] = @Date, 
			[OldPlauqe] = @OldPlauqe, 
			[NewPlauqe] = @NewPlauqe, 
			[Version] = @Version, 
			[LastEditor] = @LastEditor, 
			[LastEditionDate] = @LastEditionDate
	WHERE  [ChangePlauqeID] = @ChangePlauqeID
	
	-- Begin Return Select <- do not remove
	SELECT	[Version], 
			[NewPlauqe]
	FROM   [AST].[ChangePlauqe]
	WHERE  [ChangePlauqeID] = @ChangePlauqeID	
	-- End Return Select <- do not remove
