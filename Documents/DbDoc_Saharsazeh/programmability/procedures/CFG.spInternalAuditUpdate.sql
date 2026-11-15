
CREATE   PROC [CFG].[spInternalAuditUpdate]
    @InternalAuditID INT ,
    @OrderNo INT ,
    @Title NVARCHAR(256) ,
    @Title2 NVARCHAR(256) ,
    @SaturnDataSourceID INT ,
    @EngName NVARCHAR(256) = NULL ,
    @Creator INT ,
    @CreationDate DATETIME ,
    @LastEditor INT ,
    @LastEditionDate DATETIME ,
    @Version INT
AS
    SET NOCOUNT ON;


    IF EXISTS (   SELECT 1
                  FROM   CFG.InternalAudit AS ia
                  WHERE  ia.OrderNo = @OrderNo
                         AND ia.InternalAuditID <> @InternalAuditID )
        BEGIN
            RAISERROR(N'BaseDataProvider.OrderNoIsDuplicate', 16, 12);
            RETURN;
        END;


    IF EXISTS (   SELECT 1
                  FROM   CFG.InternalAudit AS ia
                  WHERE  ia.Title = @Title
                         AND ia.InternalAuditID <> @InternalAuditID )
        BEGIN
            RAISERROR(N'Title_Duplicated', 16, 12);
            RETURN;
        END;

    IF EXISTS (   SELECT 1
                  FROM   CFG.InternalAudit AS ia
                  WHERE  ia.Title2 = @Title2
                         AND ia.InternalAuditID <> @InternalAuditID )
        BEGIN
            RAISERROR(N'Title2_Duplicated', 16, 12);
            RETURN;
        END;

    IF @Version = (   SELECT [Version]
                      FROM   [CFG].[InternalAudit]
                      WHERE  [InternalAuditID] = @InternalAuditID )
        BEGIN

            SET @Version = @Version + 1;

            UPDATE [CFG].[InternalAudit]
            SET    [OrderNo] = @OrderNo ,
                   [Title] = @Title ,
                   [Title2] = @Title2 ,
                   [SaturnDataSourceID] = @SaturnDataSourceID ,
                   [EngName] = @EngName ,
                   [Creator] = @Creator ,
                   [CreationDate] = @CreationDate ,
                   [LastEditor] = @LastEditor ,
                   [LastEditionDate] = @LastEditionDate ,
                   [Version] = @Version
            WHERE  [InternalAuditID] = @InternalAuditID;

            -- Begin Return Select <- do not remove
            SELECT  [Version]
            FROM   [CFG].[InternalAudit]
            WHERE  [InternalAuditID] = @InternalAuditID;
        -- End Return Select <- do not remove

        END;
