CREATE   PROC [AST].[SpRepairInsert] 
    @Type tinyint,
	@AssetID int,
	@Number int,
    @Date date,
    @Description nvarchar(1050) = NULL,
    @Description2 nvarchar(1050) = NULL,
    @FinancialPeriodID int,
    @PreVoucherID int = NULL,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime 
--WITH ENCRYPTION
AS 
	SET NOCOUNT ON 

	if (@Number is null) or @Number =0
    set @Number =isnull((select MAX(r.Number) from AST.Repair r where r.FinancialPeriodID = @FinancialPeriodID),0) + 1
	
	INSERT INTO [AST].[Repair] ([Type],[AssetID], [Number], [Date], [Description], [Description2], [FinancialPeriodID], [PreVoucherID], [Version], [Creator], [CreationDate], [LastEditor], [LastEditionDate])
	SELECT @Type,@AssetID, @Number, @Date, @Description, @Description2, @FinancialPeriodID, @PreVoucherID, 0, @Creator, @CreationDate, @LastEditor, @LastEditionDate
	
	-- Begin Return Select <- do not remove
	SELECT [RepairID], [Version],  [Number]
	FROM   [AST].[Repair]
	WHERE  [RepairID] = SCOPE_IDENTITY()
	-- End Return Select <- do not remove
