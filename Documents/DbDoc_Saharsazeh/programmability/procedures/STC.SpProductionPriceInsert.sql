CREATE PROC [STC].[SpProductionPriceInsert] 
    @FinancialPeriodID int,
    @FromDate date,
    @ToDate date,
    @Number int,
    @DlID bigint,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime 
--WITH ENCRYPTION
AS 
BEGIN
	SET NOCOUNT ON 
	
	DECLARE @Count int,
			@LatestNumber int	
					
	IF(@Number = 0)
	BEGIN
		select @Count = COUNT(*) from [STC].[ProductionPrice] r
		WHERE r.FinancialPeriodID = @FinancialPeriodID
		if (@Count = 0)
		 set @Number = 1
		else 
		begin
			select @LatestNumber = MAX(Number) from [STC].[ProductionPrice] r 
			WHERE r.FinancialPeriodID = @FinancialPeriodID
			set @Number = @LatestNumber + 1 
		end
	END
	
	IF EXISTS (SELECT r.Number FROM [STC].[ProductionPrice] r WHERE Number = @Number AND r.FinancialPeriodID = @FinancialPeriodID)	
	BEGIN
		RAISERROR('شماره تکراری می باشد.',16,12)
		RETURN 0;
	END
	
	INSERT INTO [STC].[ProductionPrice] ([FinancialPeriodID], [FromDate],[ToDate], [Number], [DlID], [Version], [Creator], [CreationDate], [LastEditor], [LastEditionDate])
	SELECT @FinancialPeriodID, @FromDate,@ToDate, @Number, @DlID, 0, @Creator, @CreationDate, @LastEditor, @LastEditionDate
	
	-- Begin Return Select <- do not remove
	SELECT [ProductionPriceID], 
			[Version],
			[Number]
	FROM   [STC].[ProductionPrice]
	WHERE  [ProductionPriceID] = SCOPE_IDENTITY()
	-- End Return Select <- do not remove
END
