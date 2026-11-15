
CREATE    PROC [AST].[SpRevaluationItemInsert] 
    @RevaluationID int,
    @AssetID int,
    @Value decimal(30, 4),
    @LifeTime int = NULL,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime,
	@SalvageValue decimal(30, 4),
	@BookValue decimal(30, 4),
	@FairValue decimal(30, 4)
--WITH ENCRYPTION
AS 
	SET NOCOUNT ON 
	
	declare @FinancialPeriod int,@Date date,@plaque varchar(250)

	select @FinancialPeriod = FinancialPeriodID,	@Date = date
	from ast.Revaluation where RevaluationID = @RevaluationID





	INSERT INTO [AST].[RevaluationItem] ([RevaluationID], [AssetID], [Value], [LifeTime], [Version], [Creator], [CreationDate], [LastEditor], [LastEditionDate], 
	[SalvageValue], [BookValue], [FairValue])
	SELECT @RevaluationID, @AssetID, @Value, @LifeTime, 0, @Creator, @CreationDate, @LastEditor, @LastEditionDate, @SalvageValue, @BookValue, @FairValue
	
	-- Begin Return Select <- do not remove
	SELECT [RevaluationItemID], [Version]
	FROM   [AST].[RevaluationItem]
	WHERE  [RevaluationItemID] = SCOPE_IDENTITY()
	-- End Return Select <- do not remove

