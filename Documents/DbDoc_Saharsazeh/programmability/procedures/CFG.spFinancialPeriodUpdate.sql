CREATE   PROC [CFG].[spFinancialPeriodUpdate] 
    @FinancialPeriodID int,
	@Version int,
    @Title nvarchar(256),
    @Title2 nvarchar(256),
    @StartDate datetime,
    @EndDate datetime,
   
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime
--WITH ENCRYPTION
AS 
	SET NOCOUNT ON 
	
	
	if @Version <> (Select [Version] from [CFG].[FinancialPeriod]
	where [FinancialPeriodID] = @FinancialPeriodID)
		RAISERROR('Version mismatch...', 16 , 10)

		UPDATE [CFG].[FinancialPeriod]
		SET     [Title] = @Title, 
				[Title2] = @Title2, 
				[StartDate] = @StartDate, 
				[EndDate] = @EndDate, 
				[Version] = @Version + 1,
				[LastEditor] = @LastEditor, 
				[LastEditionDate] = @LastEditionDate
		WHERE  [FinancialPeriodID] = @FinancialPeriodID
		
		-- Begin Return Select <- do not remove
	SELECT @Version + 1	
		-- End Return Select <- do not remove
