
CREATE   PROC ATN.spMissionReportInsert  
    @Number int,
	@Date date,
	@MissionRequestID int,
	@MissionTypeID int,
	@StartDate date,
	@EndDate date,
	@Description nvarchar(max),
	@PersonelID int,
	@Status tinyint,
    @Creator int,
    @CreationDate datetime
--WITH ENCRYPTION 
AS 
	if (@Number is null or @Number = 0)
	begin
		set @Number = isnull((select MAX(Number) from ATN.MissionReport),0) + 1
	end

	INSERT INTO ATN.MissionReport (Number, Date, MissionRequestID, MissionTypeID, StartDate, EndDate, Description,
		PersonelID, [Status], Creator, CreationDate, LastEditor, LastEditionDate, [Version])
	SELECT @Number, @Date, @MissionRequestID, @MissionTypeID, @StartDate, @EndDate, @Description,
		@PersonelID, @Status, @Creator, @CreationDate, @Creator, @CreationDate, 0
	
	-- Begin Return Select <- do not remove
	SELECT MissionReportID, [Version], Number
	FROM   ATN.MissionReport
	WHERE  MissionReportID = SCOPE_IDENTITY()
	-- End Return Select <- do not remove

