CREATE   PROC [PRM].[spProductionFormulaItemInsert]
    @ProductionFormulaID int,
	@RowIndex smallint,
    @Title nvarchar(250),
    @Title2 nvarchar(250),
	@EffectiveDate date,
	@IsActive bit,
	@IsMain bit,
    @Creator int,
    @CreationDate datetime
--WITH ENCRYPTION 
AS 
BEGIN 
	SET NOCOUNT ON

	INSERT INTO PRM.ProductionFormulaItem (ProductionFormulaID, RowIndex, Title, Title2, EffectiveDate,
		 IsActive, IsMain, Creator, CreationDate, LastEditor, LastEditionDate, [Version])
	SELECT @ProductionFormulaID, @RowIndex, @Title, @Title2,@EffectiveDate,
		 @IsActive, @IsMain, @Creator, @CreationDate, @Creator, @CreationDate, 0
	
	-- Begin Return Select <- do not remove
	SELECT ProductionFormulaItemID,[Version]
	FROM   PRM.ProductionFormulaItem
	WHERE  ProductionFormulaItemID = SCOPE_IDENTITY()
	-- End Return Select <- do not remove
END
