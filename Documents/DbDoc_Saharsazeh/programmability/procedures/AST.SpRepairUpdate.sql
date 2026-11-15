CREATE   PROC [AST].[SpRepairUpdate] 
    @RepairID int,
    @Type tinyint,
    @AssetID int,
    @Number int,
    @Date date,
    @Description nvarchar(1050) = NULL,
    @Description2 nvarchar(1050) = NULL,
    @FinancialPeriodID int,
    @PreVoucherID int = NULL,
    @Version int,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime
--WITH ENCRYPTION
AS 
SET NOCOUNT ON 

	if @Version <> (Select [Version] from [AST].[Repair]
				where [RepairID] = @RepairID)
	begin
		RAISERROR('Version mismatch...', 16 , 10)
		return
	end
	
	if (@Number is null) or @Number =0
    set @Number =isnull((select MAX(r.Number) from AST.Repair r where r.FinancialPeriodID = @FinancialPeriodID),0) + 1

	set @Version = @Version +1 

	UPDATE [AST].[Repair]
	SET     [Type] =     @Type ,
			[AssetID] = @AssetID, 
			[Number] = @Number, 
			[Date] = @Date, 
			[Description] = @Description, 
			[Description2] = @Description2, 
			[FinancialPeriodID] = @FinancialPeriodID, 
			[PreVoucherID] = @PreVoucherID, 
			[Version] = @Version, 
			[LastEditor] = @LastEditor, 
			[LastEditionDate] = @LastEditionDate
	WHERE  [RepairID] = @RepairID
	
	-- Begin Return Select <- do not remove
	SELECT [Version], 
			[Number]
	FROM   [AST].[Repair]
	WHERE  [RepairID] = @RepairID	
	-- End Return Select <- do not remove
