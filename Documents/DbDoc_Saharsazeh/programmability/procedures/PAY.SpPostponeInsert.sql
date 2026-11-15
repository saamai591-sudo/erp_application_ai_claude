CREATE   PROC [PAY].[SpPostponeInsert] 
    @Number int,
    @Date date,
    @StartCalendarMonthID int,
    @EndCalendarMonthID int,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime
--WITH ENCRYPTION 
AS 
	SET NOCOUNT ON

	if (@Number is null) or @Number = 0
		set @Number = isnull((select MAX(p.Number) from PAY.Postpone p),0) + 1

	INSERT INTO [PAY].[Postpone] ([Number], [Date], [StartCalendarMonthID], [EndCalendarMonthID], [Version], [Creator], [CreationDate], [LastEditor], [LastEditionDate])
	SELECT @Number, @Date, @StartCalendarMonthID, @EndCalendarMonthID, 0, @Creator, @CreationDate, @LastEditor, @LastEditionDate
	
	-- Begin Return Select <- do not remove
	SELECT	[PostponeID], 
			[Version],
			[Number]
	FROM   [PAY].[Postpone]
	WHERE  [PostponeID] = SCOPE_IDENTITY()
	-- End Return Select <- do not remove
