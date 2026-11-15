CREATE PROC [HRM].[spOrganizationItemUpdate]
    @OrganizationItemID INT,
    @OrganizationID INT,
    @PartyID BIGINT,
    @FileNumber NVARCHAR(100),
    @AgreementRow NVARCHAR(100),
    @Employer NVARCHAR(512),
    @Address NVARCHAR(2048),
    @Version INT,
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME,
    @CompanyID INT
--WITH ENCRYPTION 
AS
BEGIN

    SET NOCOUNT ON;
    IF @Version =
    (
        SELECT [Version]
        FROM [HRM].[OrganizationItem]
        WHERE [OrganizationItemID] = @OrganizationItemID
    )
    BEGIN

        IF EXISTS
        (
            SELECT 1
            FROM HRM.OrganizationItem AS i
            WHERE i.OrganizationItemID <> @OrganizationItemID
                  AND i.PartyID = @PartyID
                  AND i.OrganizationID = @OrganizationID
                  AND i.FileNumber = @FileNumber
                  AND @AgreementRow = i.AgreementRow
        )
        BEGIN
            RAISERROR('اطلاعات وارد شده تکراري مي باشد.', 16, 12);
            RETURN 0;
        END;

        UPDATE [HRM].[OrganizationItem]
        SET [OrganizationID] = @OrganizationID,
            [PartyID] = @PartyID,
            [FileNumber] = @FileNumber,
            [AgreementRow] = @AgreementRow,
            Employer = @Employer,
            [Address] = @Address,
            [Version] = @Version,
            [Creator] = @Creator,
            [CreationDate] = @CreationDate,
            [LastEditor] = @LastEditor,
            [LastEditionDate] = @LastEditionDate,
            [CompanyID] = @CompanyID
        WHERE [OrganizationItemID] = @OrganizationItemID;

        -- Begin Return Select <- do not remove
        SELECT  [Version]
		FROM [HRM].[OrganizationItem]
        WHERE [OrganizationItemID] = @OrganizationItemID;
    -- End Return Select <- do not remove
    END;
END;
