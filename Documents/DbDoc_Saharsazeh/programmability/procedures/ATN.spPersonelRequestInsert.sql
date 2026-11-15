CREATE     PROC [ATN].[spPersonelRequestInsert]   
	@PersonelID int,
    @Number int, 
	@Date date,
	@RequestTypeID int,
	@StartDate date,
	@EndDate date,
	@StartHour decimal(18,0),
	@EndHour decimal(18,0),
	@Description nvarchar(max),
	@Description2 nvarchar(max),
	@Status tinyint,
    @Creator int,
    @CreationDate datetime
--WITH ENCRYPTION 
AS 
	SET NOCOUNT ON

	IF(@Number = 0 OR @Number IS NULL)
	SET @Number =ISNULL((SELECT MAX(Number) + 1
                      FROM ATN.PersonelRequest
					     ),1)   

	INSERT INTO ATN.PersonelRequest (Number, Date, RequestTypeID, StartDate, EndDate, StartHour, EndHour, PersonelID,
		[Description], Description2, [Status], Creator, CreationDate, LastEditor, LastEditionDate, [Version])
	SELECT  @Number, @Date, @RequestTypeID, @StartDate, @EndDate, @StartHour, @EndHour, @PersonelID,
		@Description, @Description2, @Status, @Creator, @CreationDate, @Creator, @CreationDate, 0
	
	-- Begin Return Select <- do not remove
	SELECT PersonelRequestID, [Version], Number
	FROM   ATN.PersonelRequest
	WHERE  PersonelRequestID = SCOPE_IDENTITY()
	-- End Return Select <- do not remove
