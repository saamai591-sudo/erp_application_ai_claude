CREATE PROC [STC].[SpProductionPriceUpdate] 
    @ProductionPriceID int,
    @FinancialPeriodID int,
    @FromDate date,
    @ToDate date,
    @Number int,
    @DlID bigint,
    @Version int,
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
	
	IF EXISTS (SELECT r.Number FROM [STC].[ProductionPrice] r WHERE Number = @Number AND ProductionPriceID <> @ProductionPriceID AND r.FinancialPeriodID = @FinancialPeriodID)	
	BEGIN
		RAISERROR('شماره تکراری می باشد.',16,12)
		RETURN;
	END

	if @Version <> (Select [Version] from [STC].[ProductionPrice]
				where [ProductionPriceID] = @ProductionPriceID)
	RAISERROR('Version mismatch...', 16 , 10)

	set @Version = @Version +1 

	UPDATE [STC].[ProductionPrice]
	SET    [FinancialPeriodID] = @FinancialPeriodID, [FromDate] = @FromDate,[ToDate] = @ToDate, [Number] = @Number, [DlID] = @DlID, [Version] = @Version, [Creator] = @Creator, [CreationDate] = @CreationDate, [LastEditor] = @LastEditor, [LastEditionDate] = @LastEditionDate
	WHERE  [ProductionPriceID] = @ProductionPriceID
	
	-- Begin Return Select <- do not remove
	SELECT  [Version] , [Number]
    FROM   [STC].[ProductionPrice]
	WHERE  [ProductionPriceID] = @ProductionPriceID	
	-- End Return Select <- do not remove
END
