
CREATE    PROC [AST].[SpRevaluationItemUpdate] 
    @RevaluationItemID int,
    @RevaluationID int,
    @AssetID int,
    @Value decimal(30, 4),
    @LifeTime int = NULL,
    @Version int,
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

	if @Version <> (Select [Version] from [AST].[RevaluationItem]
				where [RevaluationItemID] = @RevaluationItemID)
				begin
	RAISERROR('Version mismatch...', 16 , 10)
	return
	end


	declare @FinancialPeriod int,@Date date,@plaque varchar(250)

select @FinancialPeriod = FinancialPeriodID,	@Date = date
from ast.Revaluation where RevaluationID = @RevaluationID

	

	set @Version = @Version +1 

		UPDATE [AST].[RevaluationItem]
		SET    [RevaluationID] = @RevaluationID, [AssetID] = @AssetID, [Value] = @Value, [LifeTime] = @LifeTime, [Version] = @Version, [Creator] = @Creator, [CreationDate] = @CreationDate, [LastEditor] = @LastEditor, [LastEditionDate] = @LastEditionDate,
			   [SalvageValue] = @SalvageValue, [BookValue] = @BookValue, [FairValue] = @FairValue
		WHERE  [RevaluationItemID] = @RevaluationItemID
	
		-- Begin Return Select <- do not remove
		SELECT  [Version]
		FROM   [AST].[RevaluationItem]
		WHERE  [RevaluationItemID] = @RevaluationItemID	
		-- End Return Select <- do not remove

