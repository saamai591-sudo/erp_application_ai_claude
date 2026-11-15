CREATE   PROC [AST].[SpAdjustmentUpdate] 
    @AdjustmentID int,
    @FinancialPeriodID int,
    @Number int,
    @Date date,
    @Description nvarchar(1050) = NULL,
    @Description2 nvarchar(1050) = NULL,
    @PreVoucherID int = NULL,
    @Version int,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime,
	@BranchID int
--WITH ENCRYPTION
AS 
SET NOCOUNT ON 

	if @Version <> (Select [Version] from [AST].[Adjustment]
				where [AdjustmentID] = @AdjustmentID)
	begin
		RAISERROR('Version mismatch...', 16 , 10)
		return
	end

	set @Version = @Version +1 

	UPDATE [AST].[Adjustment]
	SET		[FinancialPeriodID] = @FinancialPeriodID, 
			[Number] = @Number, 
			[Date] = @Date,
			[Description] = @Description, 
			[Description2] = @Description2,
			[PreVoucherID] = @PreVoucherID, 
			[Version] = @Version,
			[Creator] = @Creator, 
			[CreationDate] = @CreationDate,
			[LastEditor] = @LastEditor,
			[LastEditionDate] = @LastEditionDate, 
			[BranchID] = @BranchID
	WHERE  [AdjustmentID] = @AdjustmentID
	
	-- Begin Return Select <- do not remove
	SELECT  [Version], 
			[Number]
	FROM   [AST].[Adjustment]
	WHERE  [AdjustmentID] = @AdjustmentID	
	-- End Return Select <- do not remove
