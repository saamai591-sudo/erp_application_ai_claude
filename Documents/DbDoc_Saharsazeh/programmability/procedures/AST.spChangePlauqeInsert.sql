CREATE PROC [AST].[spChangePlauqeInsert] 
    @AssetID int,
    @Date date,
    @OldPlauqe nvarchar(500),
    @NewPlauqe nvarchar(500),
    @Creator int,
    @CreationDate datetime

--WITH ENCRYPTION
AS 
	SET NOCOUNT ON 
	SET XACT_ABORT ON  
	
	declare @PlaqueLength int
	select @PlaqueLength = cast(f.ConfigValue as int) from CFG.Configuration f
	where f.ConfigKey = 'PlaqueLength'

	if (LEN(@NewPlauqe) > @PlaqueLength)
		raiserror('طول پلاک نمی تواند بیشتر از (%d)رقم باشد.',16,12,@PlaqueLength)
	if (LEN(@NewPlauqe) < @PlaqueLength)
	set @NewPlauqe = REPLACE(STR(@NewPlauqe,@PlaqueLength) , ' ', 0)  

	if exists (select AssetID from ast.Asset where Plaque = @NewPlauqe)
		raiserror('پلاک وارد شده تکراری است.',16,12)
	
	INSERT INTO [AST].[ChangePlauqe] ([AssetID], [Date], [OldPlauqe], [NewPlauqe], [Version], [Creator], [CreationDate], [LastEditor], [LastEditionDate])
	SELECT @AssetID, @Date, @OldPlauqe, @NewPlauqe, 0, @Creator, @CreationDate, @Creator, @CreationDate
	
	-- Begin Return Select <- do not remove
	SELECT	[ChangePlauqeID],
			[Version], 
			[NewPlauqe]
	FROM   [AST].[ChangePlauqe]
	WHERE  [ChangePlauqeID] = SCOPE_IDENTITY()
	-- End Return Select <- do not remove
   
	update ast.Asset
	set Plaque = @NewPlauqe
	where AssetID = @AssetID
