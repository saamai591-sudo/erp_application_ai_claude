---------------------------------------------------------------------------------------------------------
CREATE    PROC ATN.spPersonnelShiftAssignmentItemUpdate
	@PersonnelShiftAssignmentItemID int,
	@RowIndex smallint,
	@Date DATETIME,
	@AttendanceShiftID int,
	@PersonelID int,
	@Version int,
	@LastEditor int,
	@LastEditionDate datetime
AS 
SET NOCOUNT ON 
	IF @Version <>
	(
		SELECT [Version]
		FROM [ATN].PersonnelShiftAssignmentItem 
		WHERE PersonnelShiftAssignmentItemID = @PersonnelShiftAssignmentItemID
	)
	begin
		RAISERROR('Version mismatch...', 16, 10);
	end 
	
	if exists (select 1 from ATN.PersonnelShiftAssignmentItem i
			   where i.AttendanceShiftID = @AttendanceShiftID and i.Date = @Date and i.PersonelID = @PersonelID and
				i.PersonnelShiftAssignmentItemID <> @PersonnelShiftAssignmentItemID
	 )
	begin
		RAISERROR('AttendanceManagement.Messages.UniquenessOfDayAndPersonelAndShift', 16, 12)
		return
	end      

	UPDATE [ATN].PersonnelShiftAssignmentItem
	SET    RowIndex = @RowIndex,
		   [Date]=@Date,
		   AttendanceShiftID = @AttendanceShiftID,
		   PersonelID = @PersonelID, 
		   [Version] = @Version + 1, 
		   [LastEditor] = @LastEditor, 
		   [LastEditionDate] = @LastEditionDate
	WHERE  PersonnelShiftAssignmentItemID = @PersonnelShiftAssignmentItemID
	
	-- Begin Return Select <- do not remove
	SELECT [Version]
	FROM   ATN.PersonnelShiftAssignmentItem
	WHERE  PersonnelShiftAssignmentItemID = @PersonnelShiftAssignmentItemID;
