---------------------------------------------------------------------------------------------------------
CREATE   PROC ATN.spPersonnelShiftAssignmentItemInsert
	@RowIndex smallint,
	@Date DATETIME,
	@AttendanceShiftID int,
	@PersonelID int,
	@Creator int,
	@CreationDate datetime
--WITH ENCRYPTION 
AS 
	SET NOCOUNT ON 

	if exists (select 1 from ATN.PersonnelShiftAssignmentItem i	           
			   where i.AttendanceShiftID = @AttendanceShiftID and i.Date = @Date and i.PersonelID = @PersonelID
	 )
	begin
		RAISERROR('AttendanceManagement.Messages.UniquenessOfDayAndPersonelAndShift', 16, 12)
		return
	end

	INSERT INTO ATN.PersonnelShiftAssignmentItem (RowIndex,[Date], AttendanceShiftID, PersonelID, [Version], [Creator], [CreationDate], [LastEditor], [LastEditionDate])
	SELECT @RowIndex, @Date, @AttendanceShiftID, @PersonelID, 0, @Creator, @CreationDate, @Creator, @CreationDate
	
	-- Begin Return Select <- do not remove
	SELECT PersonnelShiftAssignmentItemID, [Version]
	FROM   ATN.PersonnelShiftAssignmentItem
	WHERE  PersonnelShiftAssignmentItemID = SCOPE_IDENTITY();
