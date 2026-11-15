
CREATE PROC [STF].[spTraceDocumentNumTypeDelete]
    @TraceDocumentNumTypeID INT ,
    @Version INT
AS
    SET NOCOUNT ON;


    IF @Version = (   SELECT [Version]
                      FROM   [STF].[TraceDocumentNumType]
                      WHERE  [TraceDocumentNumTypeID] = @TraceDocumentNumTypeID )
        BEGIN



            DELETE FROM [STF].[TraceDocumentNumType]
            WHERE [TraceDocumentNumTypeID] = @TraceDocumentNumTypeID;

        END;
    ELSE
        BEGIN

            RAISERROR(N'Delete_%s_%d.' ,        -- Message text.
                      16 ,                      -- Severity,
                      10 ,                      -- State,
                      N'TraceDocumentNumType' , -- First argument.
                      @TraceDocumentNumTypeID); -- Second argument.)
        END;
