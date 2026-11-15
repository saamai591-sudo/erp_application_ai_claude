
---------------------------------------------------------
CREATE   PROC ATN.spVacancyTypeAssignmentItemUpdate
	@VacancyTypeAssignmentItemID INT,
	@RowIndex SMALLINT,
	@CalendarMonthID INT,
	@VacancyTypeID INT,
	@PersonelID INT,
	@Version INT,
	@LastEditor INT,
	@LastEditionDate DATETIME
AS 
SET NOCOUNT ON 
	IF @Version <>
	(
		SELECT [Version]
		FROM [ATN].VacancyTypeAssignmentItem 
		WHERE VacancyTypeAssignmentItemID = @VacancyTypeAssignmentItemID
	)
	BEGIN
		RAISERROR('Version mismatch...', 16, 10);
	END 
	
	IF EXISTS (SELECT 1 FROM ATN.VacancyTypeAssignmentItem i
			   WHERE i.VacancyTypeID = @VacancyTypeID AND i.CalendarMonthID = @CalendarMonthID AND i.PersonelID = @PersonelID AND
				i.VacancyTypeAssignmentItemID <> @VacancyTypeAssignmentItemID
	 )
	BEGIN
		RAISERROR('AttendanceManagement.Messages.UniquenessOfMonthAndPersonelAndVacancyType', 16, 12)
		RETURN
	END      

	UPDATE [ATN].VacancyTypeAssignmentItem
	SET    RowIndex = @RowIndex,
		   [CalendarMonthID] = @CalendarMonthID,
		   VacancyTypeID = @VacancyTypeID,
		   PersonelID = @PersonelID, 
		   [Version] = @Version + 1, 
		   [LastEditor] = @LastEditor, 
		   [LastEditionDate] = @LastEditionDate
	WHERE  VacancyTypeAssignmentItemID = @VacancyTypeAssignmentItemID
	
	-- Begin Return Select <- do not remove
	SELECT [Version]
	FROM   ATN.VacancyTypeAssignmentItem
	WHERE  VacancyTypeAssignmentItemID = @VacancyTypeAssignmentItemID
