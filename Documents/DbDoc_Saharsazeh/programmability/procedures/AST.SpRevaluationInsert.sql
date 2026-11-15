
CREATE    PROC [AST].[SpRevaluationInsert] 
    @FinancialPeriodID int,
    @Number int,
    @Date date,
    @Description nvarchar(MAX) = NULL,
    @Description2 nvarchar(MAX) = NULL,
    @PrevoucherID int = NULL,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime,
	@BranchID int,
	@Status TINYINT
--WITH ENCRYPTION
AS 
BEGIN
    SET NOCOUNT ON 

	declare @Count int,@LatestNumber int
	
	select @Count = COUNT(*) from AST.Revaluation c where c.FinancialPeriodID = @FinancialPeriodID
	if (@Count = 0)
	 set @Number = 1
    else 
    begin
        select @LatestNumber = MAX(c.Number) from AST.Revaluation c where c.FinancialPeriodID = @FinancialPeriodID
        set @Number = @LatestNumber + 1 
    end 
	
	INSERT INTO [AST].[Revaluation] ([FinancialPeriodID], [Number], [Date], [Description], [Description2], [PrevoucherID], [Version], [Creator], [CreationDate], [LastEditor], [LastEditionDate], [BranchID], [Status])
	SELECT @FinancialPeriodID, @Number, @Date, @Description, @Description2, @PrevoucherID, 0, @Creator, @CreationDate, @LastEditor, @LastEditionDate, @BranchID, @Status
	
	-- Begin Return Select <- do not remove
	SELECT [RevaluationID], [Version], [Number]
	FROM   [AST].[Revaluation]
	WHERE  [RevaluationID] = SCOPE_IDENTITY()
	-- End Return Select <- do not remove
END

