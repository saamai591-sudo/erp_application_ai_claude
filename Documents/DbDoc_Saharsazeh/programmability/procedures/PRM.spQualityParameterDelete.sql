


CREATE   PROC [PRM].[spQualityParameterDelete]
    @QualityParameterID INT,
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

    DELETE FROM [PRM].[QualityParameter]
    WHERE [QualityParameterID] = @QualityParameterID;

END;
ELSE
BEGIN

    RAISERROR(   N'Delete_%s_%d.',    -- Message text.
                 16,                  -- Severity,
                 10,                  -- State,
                 N'QualityParameter', -- First argument.
                 @QualityParameterID
             ); -- Second argument.)
END;

