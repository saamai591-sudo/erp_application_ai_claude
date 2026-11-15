CREATE PROC [HRM].[SpEmploymentRequestUpdate]
    @EmploymentRequestID INT,
    @Number INT,
    @Date DATETIME,
    @OrganizationUnitID INT,
    @JobID INT,
    @RequiredQuantity INT,
    @Status TINYINT,
    @LastEditor INT,
    @LastEditionDate DATETIME,
    @Version INT
--WITH ENCRYPTION
AS
    SET NOCOUNT ON;

    IF @Version <>
    (
        SELECT [Version]
        FROM [HRM].[EmploymentRequest]
        WHERE [EmploymentRequestID] = @EmploymentRequestID
    )
    BEGIN
        RAISERROR('Version mismatch...', 16, 10);
        RETURN;
    END;

    SET @Version = @Version + 1;

    UPDATE [HRM].[EmploymentRequest]
    SET [Number] = @Number,
        [Date] = @Date,
        [OrganizationUnitID] = @OrganizationUnitID,
        [JobID] = @JobID,
        [RequiredQuantity] = @RequiredQuantity,
        [Status] = @Status,
        [LastEditor] = @LastEditor,
        [LastEditionDate] = @LastEditionDate,
        [Version] = @Version
    WHERE [EmploymentRequestID] = @EmploymentRequestID;

    -- Begin Return Select <- do not remove
    SELECT  [Version],
            [Number]
    FROM [HRM].[EmploymentRequest]
    WHERE [EmploymentRequestID] = @EmploymentRequestID;
    -- End Return Select <- do not remove
