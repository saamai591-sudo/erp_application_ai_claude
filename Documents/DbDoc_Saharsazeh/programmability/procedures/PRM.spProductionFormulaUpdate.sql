CREATE PROC [PRM].[spProductionFormulaUpdate]
    @ProductionFormulaID INT,
    @StuffID INT = NULL,
    @Quantity DECIMAL(30, 4),
    @Type TINYINT,
    @BomGroupID INT = NULL,
    @LastEditor INT,
    @LastEditionDate DATETIME,
    @Version INT
--WITH ENCRYPTION
AS
SET NOCOUNT ON;

    IF @Version =
    (
        SELECT [Version]
        FROM PRM.ProductionFormula
        WHERE ProductionFormulaID = @ProductionFormulaID
    )
    BEGIN

        SET @Version = @Version + 1;

        UPDATE PRM.ProductionFormula
        SET StuffID = @StuffID,
            Quantity = @Quantity,
            [Type] = @Type,
            [BomGroupID] = @BomGroupID,
            LastEditor = @LastEditor,
            LastEditionDate = @LastEditionDate,
            [Version] = @Version
        WHERE ProductionFormulaID = @ProductionFormulaID;

        -- Begin Return Select <- do not remove
        SELECT [Version]
        FROM PRM.ProductionFormula
        WHERE ProductionFormulaID = @ProductionFormulaID;
    -- End Return Select <- do not remove

    END;
    ELSE
        RAISERROR('Version mismatch...', 16, 10);
