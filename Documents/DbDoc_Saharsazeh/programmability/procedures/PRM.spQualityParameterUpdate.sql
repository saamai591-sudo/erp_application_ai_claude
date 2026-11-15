

CREATE   PROC [PRM].[spQualityParameterUpdate]
    @QualityParameterID INT,
    @Code INT,
    @Title NVARCHAR(256),
    @Title2 NVARCHAR(256),
    @Type TINYINT,
    @AcceptableQuantity DECIMAL(30, 4) = NULL,
    @LastEditor INT,
    @LastEditionDate DATETIME,
    @Version INT
AS
SET NOCOUNT ON;

IF @Version =
(
    SELECT [Version]
    FROM [PRM].[QualityParameter]
    WHERE [QualityParameterID] = @QualityParameterID
)
BEGIN

    SET @Version = @Version + 1;

    UPDATE [PRM].[QualityParameter]
    SET [Code] = @Code,
        [Title] = @Title,
        [Title2] = @Title2,
        [Type] = @Type,
        [AcceptableQuantity] = @AcceptableQuantity,
        [LastEditor] = @LastEditor,
        [LastEditionDate] = @LastEditionDate,
        [Version] = @Version
    WHERE [QualityParameterID] = @QualityParameterID;

    -- Begin Return Select <- do not remove
    SELECT [Version]
    FROM [PRM].[QualityParameter]
    WHERE [QualityParameterID] = @QualityParameterID;
-- End Return Select <- do not remove

END;
