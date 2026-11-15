

CREATE   PROC [PRM].[spQualityControlUpdate]
    @QualityControlID INT,
    @ProductionStatisticID INT,
    @ReviewedQuantity DECIMAL(30, 4),
    @QualityParameterID INT,
    @ParameterValue DECIMAL(30, 4),
    @LastEditor INT,
    @LastEditionDate DATETIME,
    @Version INT
AS
SET NOCOUNT ON;

IF @Version =
(
    SELECT [Version]
    FROM [PRM].[QualityControl]
    WHERE [QualityControlID] = @QualityControlID
)
BEGIN

    SET @Version = @Version + 1;

    UPDATE [PRM].[QualityControl]
    SET [ProductionStatisticID] = @ProductionStatisticID,
        [ReviewedQuantity] = @ReviewedQuantity,
        [QualityParameterID] = @QualityParameterID,
        [ParameterValue] = @ParameterValue,
        [LastEditor] = @LastEditor,
        [LastEditionDate] = @LastEditionDate,
        [Version] = @Version
    WHERE [QualityControlID] = @QualityControlID;

    -- Begin Return Select <- do not remove
    SELECT [Version]
    FROM [PRM].[QualityControl]
    WHERE [QualityControlID] = @QualityControlID;
-- End Return Select <- do not remove

END;
