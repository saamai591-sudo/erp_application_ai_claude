
---------------------------------------------------------
CREATE   PROC ATN.spVacancyTypeAssignmentItemInsert
	@RowIndex SMALLINT,
	@CalendarMonthID INT,
	@VacancyTypeID INT,
	@PersonelID INT,
	@Creator INT,
	@CreationDate DATETIME
--WITH ENCRYPTION 
AS 
	SET NOCOUNT ON 

	IF EXISTS (SELECT 1 FROM ATN.VacancyTypeAssignmentItem i	           
			   WHERE i.VacancyTypeID = @VacancyTypeID AND i.CalendarMonthID = @CalendarMonthID AND i.PersonelID = @PersonelID)
	BEGIN
		RAISERROR('AttendanceManagement.Messages.UniquenessOfMonthAndPersonelAndVacancyType', 16, 12)
		RETURN
	END

	INSERT INTO ATN.VacancyTypeAssignmentItem (RowIndex,[CalendarMonthID], VacancyTypeID, PersonelID, [Version], [Creator], [CreationDate], [LastEditor], [LastEditionDate])
	SELECT @RowIndex, @CalendarMonthID, @VacancyTypeID, @PersonelID, 0, @Creator, @CreationDate, @Creator, @CreationDate
	
	-- Begin Return Select <- do not remove
	SELECT VacancyTypeAssignmentItemID, [Version]
	FROM   ATN.VacancyTypeAssignmentItem
	WHERE  VacancyTypeAssignmentItemID = SCOPE_IDENTITY();
