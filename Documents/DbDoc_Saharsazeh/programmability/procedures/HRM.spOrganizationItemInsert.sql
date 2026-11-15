CREATE PROC [HRM].[spOrganizationItemInsert]
    @OrganizationID INT,
    @PartyID BIGINT,
    @FileNumber NVARCHAR(100),
    @AgreementRow NVARCHAR(100),
    @Employer NVARCHAR(512),
    @Address NVARCHAR(2048),
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME,
    @CompanyID INT
--WITH ENCRYPTION 
AS
    SET NOCOUNT ON;

    IF EXISTS
    (
        SELECT 1
        FROM HRM.OrganizationItem AS i
        WHERE i.PartyID = @PartyID
              AND i.OrganizationID = @OrganizationID
              AND i.FileNumber = @FileNumber
              AND @AgreementRow = i.AgreementRow
    )
    BEGIN
        RAISERROR('اطلاعات وارد شده تکراري مي باشد.', 16, 12);
        RETURN 0;
    END;

    INSERT INTO [HRM].[OrganizationItem]
    (
        [OrganizationID],
        [PartyID],
        [FileNumber],
        [AgreementRow],
        [Address],
        Employer,
        [Version],
        [Creator],
        [CreationDate],
        [LastEditor],
        [LastEditionDate],
        [CompanyID]
    )
    SELECT @OrganizationID,
           @PartyID,
           @FileNumber,
           @AgreementRow,
           @Address,
           @Employer,
           0,
           @Creator,
           @CreationDate,
           @LastEditor,
           @LastEditionDate,
           @CompanyID;

    -- Begin Return Select <- do not remove
    SELECT [OrganizationItemID],
           [Version]
    FROM [HRM].[OrganizationItem]
    WHERE [OrganizationItemID] = SCOPE_IDENTITY();
    -- End Return Select <- do not remove
