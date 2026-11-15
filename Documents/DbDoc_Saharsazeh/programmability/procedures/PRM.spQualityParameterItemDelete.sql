


CREATE   PROC [PRM].[spQualityParameterItemDelete]
    @QualityParameterItemID INT,
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

    DELETE FROM [PRM].[QualityParameterItem]
    WHERE [QualityParameterItemID] = @QualityParameterItemID;

END;
ELSE
BEGIN

    RAISERROR(   N'Delete_%s_%d.',        -- Message text.
                 16,                      -- Severity,
                 10,                      -- State,
                 N'QualityParameterItem', -- First argument.
                 @QualityParameterItemID
             ); -- Second argument.)
END;

