CREATE     PROC [ATN].[spRequestTypeInsert]    
    @Code int,
    @Title nvarchar(256),
    @Title2 nvarchar(256),
	@Type tinyint,
	@Timing tinyint,
    @Creator int,
    @CreationDate datetime
--WITH ENCRYPTION 
AS 
	SET NOCOUNT ON
	if (@Code is null or @Code = 0)
	begin
		set @Code = isnull((select MAX(Code) from ATN.RequestType),0) + 1
	end

	INSERT INTO ATN.RequestType (Code, Title, Title2, [Type], Timing, Creator, CreationDate, LastEditor, LastEditionDate, [Version])
	SELECT @Code, @Title, @Title2, @Type, @Timing, @Creator, @CreationDate, @Creator, @CreationDate, 0
	
	-- Begin Return Select <- do not remove
	SELECT RequestTypeID, [Version], Code
	FROM   ATN.RequestType
	WHERE  RequestTypeID = SCOPE_IDENTITY()
	-- End Return Select <- do not remove
