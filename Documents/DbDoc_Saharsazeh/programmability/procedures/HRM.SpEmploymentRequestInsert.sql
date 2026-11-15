CREATE PROC [HRM].[SpEmploymentRequestInsert]
    @Number INT,
    @Date DATETIME,
    @OrganizationUnitID INT,
    @JobID INT,
    @RequiredQuantity INT,
    @Status TINYINT,
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME
--WITH ENCRYPTION
AS
    SET NOCOUNT ON;

    IF (@Number IS NULL OR @Number = 0)
    BEGIN
        SET @Number = ISNULL(
                      (
                          SELECT MAX(er.Number)FROM HRM.EmploymentRequest er
                      ),
                      0
                            ) + 1;
    END;

    INSERT INTO [HRM].[EmploymentRequest]
    (
        [Number],
        [Date],
        [OrganizationUnitID],
        [JobID],
        [RequiredQuantity],
        [Status],
        [Creator],
        [CreationDate],
        [LastEditor],
        [LastEditionDate],
        [Version]
    )
    SELECT @Number,
           @Date,
           @OrganizationUnitID,
           @JobID,
           @RequiredQuantity,
           @Status,
           @Creator,
           @CreationDate,
           @LastEditor,
           @LastEditionDate,
           0;

    -- Begin Return Select <- do not remove
    SELECT [EmploymentRequestID],
           [Version],
           [Number]
    FROM [HRM].[EmploymentRequest]
    WHERE [EmploymentRequestID] = SCOPE_IDENTITY();
    -- End Return Select <- do not remove
