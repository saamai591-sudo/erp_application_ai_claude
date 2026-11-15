
---------------------------------------------------------
CREATE   PROC [CFG].[spInternalAuditInsert]
    @OrderNo INT ,
    @Title NVARCHAR(256) ,
    @Title2 NVARCHAR(256) ,
    @SaturnDataSourceID INT ,
    @EngName NVARCHAR(256) = NULL ,
    @Creator INT ,
    @CreationDate DATETIME ,
    @LastEditor INT ,
    @LastEditionDate DATETIME
AS
    SET NOCOUNT ON;

    IF EXISTS (   SELECT 1
                  FROM   CFG.InternalAudit AS ia
                  WHERE  ia.OrderNo = @OrderNo )
        BEGIN
            RAISERROR(N'BaseDataProvider.OrderNoIsDuplicate', 16, 12);
            RETURN;
        END;

    IF EXISTS (   SELECT 1
                  FROM   CFG.InternalAudit AS ia
                  WHERE  ia.Title = @Title )
        BEGIN
            RAISERROR(N'Title_Duplicated', 16, 12);
            RETURN;
        END;
		
    IF EXISTS (   SELECT 1
                  FROM   CFG.InternalAudit AS ia
                  WHERE  ia.Title2 = @Title2 )
        BEGIN
            RAISERROR(N'Title2_Duplicated', 16, 12);
            RETURN;
        END;

    INSERT INTO [CFG].[InternalAudit] ( [OrderNo] ,
                                        [Title] ,
                                        [Title2] ,
                                        [SaturnDataSourceID] ,
                                        [EngName] ,
                                        [Creator] ,
                                        [CreationDate] ,
                                        [LastEditor] ,
                                        [LastEditionDate] ,
                                        [Version] )
                SELECT @OrderNo ,
                       @Title ,
                       @Title2 ,
                       @SaturnDataSourceID ,
                       @EngName ,
                       @Creator ,
                       @CreationDate ,
                       @LastEditor ,
                       @LastEditionDate ,
                       0;

    -- Begin Return Select <- do not remove
    SELECT [InternalAuditID] ,
           [Version]
    FROM   [CFG].[InternalAudit]
    WHERE  [InternalAuditID] = SCOPE_IDENTITY();
-- End Return Select <- do not remove
