CREATE     PROC [ATN].[spRequestTypeUpdate]
    @RequestTypeID int,  	
	@Code int,
    @Title nvarchar(256),
    @Title2 nvarchar(256),
	@Type tinyint,
	@Timing tinyint,
    @LastEditor int,
    @LastEditionDate datetime,
    @Version int
--WITH ENCRYPTION
AS 
	if @Version=(Select [Version] from ATN.RequestType
	where RequestTypeID = @RequestTypeID)
	BEGIN	

		if (@Code is null or @Code = 0)
		BEGIN
			set @Code = isnull((select MAX(Code) from ATN.RequestType),0) + 1
		END

		UPDATE ATN.RequestType
		SET    Code = @Code,
				Title = @Title, 
				Title2 = @Title2, 
				Type = @Type,
				Timing = @Timing,
				LastEditor = @LastEditor, 
				LastEditionDate = @LastEditionDate, 
				[Version] = @Version + 1
		WHERE  RequestTypeID = @RequestTypeID
	
		-- Begin Return Select <- do not remove
		SELECT [Version], Code
		FROM   ATN.RequestType
		WHERE  RequestTypeID = @RequestTypeID	
		-- End Return Select <- do not remove
	END
	ELSE  
	BEGIN
		RAISERROR('Version mismatch...', 16 , 10)
	END
