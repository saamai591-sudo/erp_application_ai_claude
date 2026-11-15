
-------------------------------------
CREATE   PROC PRM.spProductionFormulaItemMaterialInsert  
    @ProductionFormulaItemID int,
	@RowIndex smallint,
    @StuffID int,
	@BomGroupID int,
    @Quantity decimal(36, 10),
	@Type TINYINT,
	@CostStructureID int,
	@NeedAnalysis bit,
    @Creator int,
    @CreationDate datetime,
	@CompletionPercentage tinyint
--WITH ENCRYPTION 
AS 
BEGIN 
	SET NOCOUNT ON

	INSERT INTO PRM.ProductionFormulaItemMaterial (ProductionFormulaItemID,BomGroupID,[Type],
		 RowIndex, StuffID, Quantity, CostStructureID,NeedAnalysis, Creator, CreationDate, LastEditor, LastEditionDate, [Version],[CompletionPercentage])
	SELECT @ProductionFormulaItemID,@BomGroupID,@Type,@RowIndex, @StuffID, @Quantity, @CostStructureID,@NeedAnalysis,
		@Creator, @CreationDate, @Creator, @CreationDate, 0,@CompletionPercentage
	
	-- Begin Return Select <- do not remove
	SELECT ProductionFormulaItemMaterialID,[Version]
	FROM   PRM.ProductionFormulaItemMaterial
	WHERE  ProductionFormulaItemMaterialID = SCOPE_IDENTITY()
	-- End Return Select <- do not remove
END
