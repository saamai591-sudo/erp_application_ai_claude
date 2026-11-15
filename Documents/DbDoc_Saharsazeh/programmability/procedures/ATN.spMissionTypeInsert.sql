CREATE     PROC [ATN].[spMissionTypeInsert]    
    @Code int,
    @Title nvarchar(256),
    @Title2 nvarchar(256),
    @Creator int,
    @CreationDate datetime,
	@RequestTypeID int
--WITH ENCRYPTION 
AS 
	if (@Code is null or @Code = 0)
	begin
		set @Code = isnull((select MAX(Code) from ATN.MissionType),0) + 1
	end

	INSERT INTO ATN.MissionType (Code, Title, Title2, Creator, CreationDate, LastEditor, LastEditionDate, [Version],RequestTypeID)
	SELECT @Code, @Title, @Title2, @Creator, @CreationDate, @Creator, @CreationDate, 0,@RequestTypeID
	
	-- Begin Return Select <- do not remove
	SELECT MissionTypeID, [Version], Code
	FROM   ATN.MissionType
	WHERE  MissionTypeID = SCOPE_IDENTITY()
	-- End Return Select <- do not remove
