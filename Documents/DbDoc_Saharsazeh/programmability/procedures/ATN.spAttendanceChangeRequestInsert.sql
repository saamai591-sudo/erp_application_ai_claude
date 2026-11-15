
CREATE   PROC [ATN].[spAttendanceChangeRequestInsert]
    @Number int,
    @Date date,
	@PersonelID int,
	@EntryHour decimal(18,0),
	@ExitHour decimal(18,0),
	@Description nvarchar(512),
	@ReviewerID int,
	@ReviewDate datetime,
    @Creator int,
    @CreationDate datetime
--WITH ENCRYPTION 
AS 
	if exists (select * from ATN.AttendanceChangeRequest a
			where a.[Date] = @Date and a.PersonelID = @PersonelID)
	begin
		raiserror('AttendanceManagement.Messages.DuplicateAttendanceChangeRequest', 16, 12)
		return
	end

	if (@Number is null or @Number = 0)
		set @Number = isnull((select MAX(Number) from ATN.AttendanceChangeRequest),0) + 1

	INSERT INTO ATN.AttendanceChangeRequest (Number, [Date],  PersonelID, EntryHour, ExitHour, [Description], 
		 [ReviewerID], [ReviewDate],
		 [Version], [Creator], [CreationDate], [LastEditor], [LastEditionDate])
	SELECT @Number, @Date,  @PersonelID, @EntryHour, @ExitHour,
		@Description, @ReviewerID, @ReviewDate, 0, @Creator, @CreationDate, @Creator, @CreationDate
	
	-- Begin Return Select <- do not remove
	SELECT AttendanceChangeRequestID, [Version], Number
	FROM   ATN.AttendanceChangeRequest
	WHERE  AttendanceChangeRequestID = SCOPE_IDENTITY();
	-- End Return Select <- do not remove
