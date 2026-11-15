
-------------------------------------
CREATE   PROC PRM.spProductionFormulaItemMaterialUpdate
    @ProductionFormulaItemMaterialID INT,
    @ProductionFormulaItemID INT,
    @RowIndex SMALLINT,
    @StuffID INT = NULL,
    @Quantity DECIMAL(36, 10),
    @Type TINYINT,
    @BomGroupID INT = NULL,
    @CostStructureID INT,
    @NeedAnalysis BIT,
    @LastEditor INT,
    @LastEditionDate DATETIME,
    @Version INT,
    @CompletionPercentage TINYINT
--WITH ENCRYPTION
AS
SET NOCOUNT ON;

    IF @Version =
    (
        SELECT [Version]
        FROM PRM.ProductionFormulaItemMaterial
        WHERE ProductionFormulaItemMaterialID = @ProductionFormulaItemMaterialID
    )
    BEGIN

        SET @Version = @Version + 1;

        UPDATE PRM.ProductionFormulaItemMaterial
        SET ProductionFormulaItemID = @ProductionFormulaItemID,
            RowIndex = @RowIndex,
            StuffID = @StuffID,
            BomGroupID = @BomGroupID,
            Quantity = @Quantity,
            [Type] = @Type,
            CostStructureID = @CostStructureID,
            LastEditor = @LastEditor,
            LastEditionDate = @LastEditionDate,
            [Version] = @Version,
            NeedAnalysis = @NeedAnalysis,
            [CompletionPercentage] = @CompletionPercentage
        WHERE ProductionFormulaItemMaterialID = @ProductionFormulaItemMaterialID;

        -- Begin Return Select <- do not remove
        SELECT [Version]
        FROM PRM.ProductionFormulaItemMaterial
        WHERE ProductionFormulaItemMaterialID = @ProductionFormulaItemMaterialID;
    -- End Return Select <- do not remove

    END;
    ELSE
        RAISERROR('Version mismatch...', 16, 10);
