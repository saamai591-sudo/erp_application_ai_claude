CREATE     PROC [WMS].[spPhysicalLocationInsert]
    @FinancialPeriodID int,
    @Number int,
    @Date date,
	@Type tinyint,
	@Contents tinyint,
	@StockID int,
	@SourceWarehouseSpaceDesignID int,
	@WarehouseSpaceDesignID int,
    @Creator int,
    @CreationDate datetime
--WITH ENCRYPTION 
AS 
BEGIN
	SET NOCOUNT ON
	
	if (@Number is null or @Number = 0)
		set @Number =isnull((select MAX(Number) from WMS.PhysicalLocation where FinancialPeriodID = @FinancialPeriodID),0) + 1

	INSERT INTO WMS.PhysicalLocation(FinancialPeriodID, Number, Date, Type, Contents, StockID,
		SourceWarehouseSpaceDesignID, WarehouseSpaceDesignID, Creator, CreationDate, LastEditor, LastEditionDate, [Version])
	SELECT @FinancialPeriodID, @Number, @Date, @Type, @Contents, @StockID,
		@SourceWarehouseSpaceDesignID, @WarehouseSpaceDesignID, @Creator, @CreationDate, @Creator, @CreationDate, 0
	
	-- Begin Return Select <- do not remove
	SELECT PhysicalLocationID, [Version], Number
	FROM   WMS.PhysicalLocation
	WHERE  PhysicalLocationID = SCOPE_IDENTITY()
	-- End Return Select <- do not remove
END
