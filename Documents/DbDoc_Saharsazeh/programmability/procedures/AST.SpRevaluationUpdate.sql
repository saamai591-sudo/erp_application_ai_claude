
CREATE    PROC [AST].[SpRevaluationUpdate] 
    @RevaluationID int,
    @FinancialPeriodID int,
    @Number int,
    @Date date,
    @Description nvarchar(MAX) = NULL,
    @Description2 nvarchar(MAX) = NULL,
    @PrevoucherID int = NULL,
    @Version int,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime,
	@BranchID int,
	@Status TINYINT
--WITH ENCRYPTION
AS 

	SET NOCOUNT ON 
	if @Version <> (Select [Version] from [AST].[Revaluation]
				where [RevaluationID] = @RevaluationID)
	begin
		RAISERROR('Version mismatch...', 16 , 10)
		return
	end

	set @Version = @Version +1 

		UPDATE [AST].[Revaluation]
		SET    [FinancialPeriodID] = @FinancialPeriodID, [Number] = @Number, [Date] = @Date, [Description] = @Description, [Description2] = @Description2, [PrevoucherID] = @PrevoucherID, [Version] = @Version, [Creator] = @Creator, [CreationDate] = @CreationDate, [LastEditor] = @LastEditor, [LastEditionDate] = @LastEditionDate, [BranchID] = @BranchID,
		[Status] = @Status
		WHERE  [RevaluationID] = @RevaluationID
	
		-- Begin Return Select <- do not remove
		SELECT  [Version], 
				[Number] 
		FROM   [AST].[Revaluation]
		WHERE  [RevaluationID] = @RevaluationID	
		-- End Return Select <- do not remove

