CREATE   PROC [FOS].[spLadingTypeUpdate] 
    @LadingTypeID int,
    @Code int,
    @Title nvarchar(250),
    @Title2 nvarchar(250),
    @SlID int,
    @Version int,
    @LastEditor int,
    @LastEditionDate datetime
AS 
	SET NOCOUNT ON 


	if @Version=(Select [Version] from [FOS].[LadingType]
	where [LadingTypeID] = @LadingTypeID)
	begin	

		set @Version = @Version +1 

		UPDATE [FOS].[LadingType]
		SET     [Code] = @Code, 
				[Title] = @Title, 
				[Title2] = @Title2, 
				[SlID] = @SlID, 
				[Version] = @Version, 
				[LastEditor] = @LastEditor, 
				[LastEditionDate] = @LastEditionDate
		WHERE  [LadingTypeID] = @LadingTypeID
	
		-- Begin Return Select <- do not remove
		SELECT [Version]
		FROM   [FOS].[LadingType]
		WHERE  [LadingTypeID] = @LadingTypeID	
		-- End Return Select <- do not remove

	end 
ELSE 
			RAISERROR('Version mismatch...', 16 , 10)
