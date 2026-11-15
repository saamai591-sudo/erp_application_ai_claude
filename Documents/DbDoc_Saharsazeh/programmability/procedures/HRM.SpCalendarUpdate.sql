CREATE PROC [HRM].[SpCalendarUpdate] 
    @CalendarID int,
    @Year smallint,
    @WorkHours decimal(18, 0),
    @Version int,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime
		--WITH ENCRYPTION 
AS 
	SET NOCOUNT ON 

	if @Version=(Select [Version] from [HRM].[Calendar]
	where [CalendarID] = @CalendarID)
	begin
	
	   IF EXISTS (SELECT * FROM HRM.Calendar c WHERE c.[Year] = @Year
		AND c.CalendarID <> @CalendarID)
		BEGIN
			RAISERROR('سال نمی تواند تکراری باشد.',16,12)
		END		

		UPDATE [HRM].[Calendar]
		SET    [Year] = @Year, [WorkHours] = @WorkHours, [Version] = @Version, [Creator] = @Creator, [CreationDate] = @CreationDate, [LastEditor] = @LastEditor, [LastEditionDate] = @LastEditionDate
		WHERE  [CalendarID] = @CalendarID
	
		-- Begin Return Select <- do not remove
		SELECT  [Version]
		FROM   [HRM].[Calendar]
		WHERE  [CalendarID] = @CalendarID	
		-- End Return Select <- do not remove
	end
