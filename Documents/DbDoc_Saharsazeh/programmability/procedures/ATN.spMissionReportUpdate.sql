
CREATE   PROC ATN.spMissionReportUpdate
    @MissionReportID int,	
	@Number int,
	@Date date,
	@MissionRequestID int,
	@MissionTypeID int,
	@StartDate date,
	@EndDate date,
	@Description nvarchar(max),
	@PersonelID int,
	@Status tinyint,
    @LastEditor int,
    @LastEditionDate datetime,
    @Version int
--WITH ENCRYPTION
AS 
	declare @PreVersion int

	select @PreVersion = [Version] 
	from ATN.MissionReport 
	where MissionReportID = @MissionReportID


	if (@Number is null or @Number = 0)
	begin
		set @Number = isnull((select MAX(Number) from ATN.MissionReport),0) + 1
	end

	if (@Version = @PreVersion)
	begin		

		UPDATE ATN.MissionReport
		SET    Number = @Number,
		       [Date] = @Date, 
			   MissionRequestID = @MissionRequestID, 
			   MissionTypeID = @MissionTypeID,
			   StartDate = @StartDate,
	           EndDate = @EndDate,
	           [Description] = @Description,
			   PersonelID = @PersonelID,
			   [Status] = @Status,
			   [Version] = @Version + 1,
			   LastEditor = @LastEditor, 
			   LastEditionDate = @LastEditionDate			   
		WHERE  MissionReportID = @MissionReportID
	
		-- Begin Return Select <- do not remove
		SELECT [Version], Number
		FROM   ATN.MissionReport
		WHERE  MissionReportID = @MissionReportID	
		-- End Return Select <- do not remove
	END
	else 
		RAISERROR('Version mismatch...', 16 , 10)

