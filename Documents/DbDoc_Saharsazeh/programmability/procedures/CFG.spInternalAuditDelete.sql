
CREATE   PROC [CFG].[spInternalAuditDelete]
    @InternalAuditID INT ,
    @Version INT
AS
    SET NOCOUNT ON;


    IF @Version = (   SELECT [Version]
                      FROM   [CFG].[InternalAudit]
                      WHERE  [InternalAuditID] = @InternalAuditID )
        BEGIN



            DELETE FROM [CFG].[InternalAudit]
            WHERE [InternalAuditID] = @InternalAuditID;

        END;
    ELSE
        BEGIN

            RAISERROR(N'Delete_%s_%d.' , -- Message text.
                      16 ,               -- Severity,
                      10 ,               -- State,
                      N'InternalAudit' , -- First argument.
                      @InternalAuditID); -- Second argument.)
        END;
