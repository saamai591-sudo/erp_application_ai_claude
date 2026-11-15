

CREATE   PROC [PRM].[spQualityControlInsert]
    @ProductionStatisticID INT,
    @ReviewedQuantity DECIMAL(30, 4),
    @QualityParameterID INT,
    @ParameterValue DECIMAL(30, 4),
    @Creator INT,
    @CreationDate DATETIME
AS
SET NOCOUNT ON;

INSERT INTO [PRM].[QualityControl]
(
    [ProductionStatisticID],
    [ReviewedQuantity],
    [QualityParameterID],
    [ParameterValue],
    [Creator],
    [CreationDate],
    [LastEditor],
    [LastEditionDate],
    [Version]
)
SELECT @ProductionStatisticID,
       @ReviewedQuantity,
       @QualityParameterID,
       @ParameterValue,
       @Creator,
       @CreationDate,
       @Creator,
       @CreationDate,
       0;

-- Begin Return Select <- do not remove
SELECT [QualityControlID],
       [ProductionStatisticID],
       [ReviewedQuantity],
       [QualityParameterID],
       [ParameterValue],
       [Creator],
       [CreationDate],
       [LastEditor],
       [LastEditionDate],
       [Version]
FROM [PRM].[QualityControl]
WHERE [QualityControlID] = SCOPE_IDENTITY();
-- End Return Select <- do not remove

