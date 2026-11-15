CREATE     PROC [WMS].[spPackingInsert]
    @FinancialPeriodID int,
    @Number int,
    @Date date,
	@StockID int,
	@PackingTypeID int,
	@PackingIdentity nvarchar(100),	
    @Creator int,
    @CreationDate datetime
--WITH ENCRYPTION 
AS 
BEGIN
	SET NOCOUNT ON
	
	if (@Number is null or @Number = 0)
		set @Number =isnull((select MAX(Number) from WMS.Packing where FinancialPeriodID = @FinancialPeriodID),0) + 1

	INSERT INTO WMS.Packing(FinancialPeriodID, Number, Date, StockID,
		PackingTypeID, PackingIdentity, Creator, CreationDate, LastEditor, LastEditionDate, [Version])
	SELECT @FinancialPeriodID, @Number, @Date, @StockID,
		@PackingTypeID, @PackingIdentity, @Creator, @CreationDate, @Creator, @CreationDate, 0
	
	-- Begin Return Select <- do not remove
	SELECT PackingID,
			[Version],
		Number
	FROM   WMS.Packing
	WHERE  PackingID = SCOPE_IDENTITY()
	-- End Return Select <- do not remove
END
