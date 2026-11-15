CREATE PROC [PRM].[spProductionFormulaInsert]
    @StuffID INT = NULL,
    @Quantity DECIMAL(30, 4),
    @Type TINYINT,
    @BomGroupID INT = NULL,
    @Creator INT,
    @CreationDate DATETIME
--WITH ENCRYPTION 
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO PRM.ProductionFormula
    (
        StuffID,
        Quantity,
        [Type],
        [BomGroupID],
        Creator,
        CreationDate,
        LastEditor,
        LastEditionDate,
        [Version]
    )
    SELECT @StuffID,
           @Quantity,
           @Type,
           @BomGroupID,
           @Creator,
           @CreationDate,
           @Creator,
           @CreationDate,
           0;

    -- Begin Return Select <- do not remove
    SELECT ProductionFormulaID,
           [Version]
    FROM PRM.ProductionFormula
    WHERE ProductionFormulaID = SCOPE_IDENTITY();
    -- End Return Select <- do not remove
END
