
CREATE   PROC [ATN].[spAttendanceChangeRequestUpdate]
    @AttendanceChangeRequestID int,
    @Number int,
    @Date date,
	@PersonelID int,
	@EntryHour decimal(18,0),
	@ExitHour decimal(18,0),
	@Description nvarchar(512),
	@ReviewerID int,
	@ReviewDate datetime,
    @Version int,
    @LastEditor int,
    @LastEditionDate datetime
AS 
    IF @Version <>
    (
        SELECT [Version]
        FROM [ATN].AttendanceChangeRequest 
        WHERE AttendanceChangeRequestID = @AttendanceChangeRequestID
    )
	begin
		RAISERROR('Version mismatch...', 16, 10);
		return
	end   
	
	if exists (select * from ATN.AttendanceChangeRequest a
			where a.[Date] = @Date and a.PersonelID = @PersonelID and
				a.AttendanceChangeRequestID <> @AttendanceChangeRequestID)
	begin
		raiserror('AttendanceManagement.Messages.DuplicateAttendanceChangeRequest', 16, 12)
		return
	end  
	
	if (@Number is null or @Number = 0)
		set @Number = isnull((select MAX(Number) from ATN.AttendanceChangeRequest),0) + 1		

	UPDATE [ATN].AttendanceChangeRequest
	SET    Number = @Number,
	       [Date] = @Date, 
		   PersonelID = @PersonelID,
		   EntryHour = @EntryHour,
		   ExitHour = @ExitHour,
		   Description = @Description,
		   [ReviewerID] = @ReviewerID, 
		   [ReviewDate] = @ReviewDate,
	       [Version] = @Version + 1, 
		   [LastEditor] = @LastEditor, 
		   [LastEditionDate] = @LastEditionDate
	WHERE  AttendanceChangeRequestID = @AttendanceChangeRequestID
	
	-- Begin Return Select <- do not remove
	SELECT Number, [Version]
	FROM   ATN.AttendanceChangeRequest
	WHERE  AttendanceChangeRequestID = @AttendanceChangeRequestID;
	-- End Return Select <- do not remove
