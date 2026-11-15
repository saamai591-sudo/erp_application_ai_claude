CREATE PROC [HRM].[SpCalendarInsert] 
    @Year smallint,
    @WorkHours decimal(18, 0),
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime
--WITH ENCRYPTION 
AS 
BEGIN
	SET NOCOUNT ON
	
	IF EXISTS (SELECT 1 FROM HRM.Calendar c WHERE c.[Year] = @Year)
	BEGIN
		RAISERROR('سال نمی تواند تکراری باشد.',16,12)
	END  
	
	INSERT INTO [HRM].[Calendar] ([Year], [WorkHours], [Version], [Creator], [CreationDate], [LastEditor], [LastEditionDate])
	SELECT @Year, @WorkHours, 0, @Creator, @CreationDate, @LastEditor, @LastEditionDate
	
	-- Begin Return Select <- do not remove
	SELECT	[CalendarID],
			[Version]
	FROM   [HRM].[Calendar]
	WHERE  [CalendarID] = SCOPE_IDENTITY()
	-- End Return Select <- do not remove
END
