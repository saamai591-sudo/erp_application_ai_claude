

CREATE   PROC [PRM].[spQualityParameterItemUpdate]
    @QualityParameterItemID INT,
    @QualityParameterID INT,
    @RowIndex SMALLINT,
    @Quantity DECIMAL(30, 4),
    @Passed BIT,
    @LastEditor INT,
    @LastEditionDate DATETIME,
    @Version INT
AS
SET NOCOUNT ON;

IF @Version =
(
    SELECT [Version]
    FROM [PRM].[QualityParameterItem]
    WHERE [QualityParameterItemID] = @QualityParameterItemID
)
BEGIN

    SET @Version = @Version + 1;

    UPDATE [PRM].[QualityParameterItem]
    SET [QualityParameterID] = @QualityParameterID,
        [RowIndex] = @RowIndex,
        [Quantity] = @Quantity,
        [Passed] = @Passed,
        [LastEditor] = @LastEditor,
        [LastEditionDate] = @LastEditionDate,
        [Version] = @Version
    WHERE [QualityParameterItemID] = @QualityParameterItemID;

    -- Begin Return Select <- do not remove
    SELECT [Version]
    FROM [PRM].[QualityParameterItem]
    WHERE [QualityParameterItemID] = @QualityParameterItemID;
-- End Return Select <- do not remove

END;
