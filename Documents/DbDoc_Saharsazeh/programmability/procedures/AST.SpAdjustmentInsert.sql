CREATE   PROC [AST].[SpAdjustmentInsert] 
    @FinancialPeriodID int,
    @Number int,
    @Date date,
    @Description nvarchar(1050) = NULL,
    @Description2 nvarchar(1050) = NULL,
    @PreVoucherID int = NULL,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime,
	@BranchID int 
--WITH ENCRYPTION
AS 
	SET NOCOUNT ON 
	
	if (@Number is null) or @Number =0
    set @Number =isnull((select MAX(a.Number) from AST.Adjustment a where a.FinancialPeriodID = @FinancialPeriodID),0) + 1

	
	INSERT INTO [AST].[Adjustment] ([FinancialPeriodID], [Number], [Date], [Description], [Description2], [PreVoucherID], [Version], [Creator], [CreationDate], [LastEditor], [LastEditionDate], [BranchID])
	SELECT @FinancialPeriodID, @Number, @Date, @Description, @Description2, @PreVoucherID, 0, @Creator, @CreationDate, @LastEditor, @LastEditionDate, @BranchID
	
	-- Begin Return Select <- do not remove
	SELECT [AdjustmentID], [Version], [Number]
	FROM   [AST].[Adjustment]
	WHERE  [AdjustmentID] = SCOPE_IDENTITY()
	-- End Return Select <- do not remove
