CREATE   PROC [HRM].[spAgreementOrganizationUpdate]
    @AgreementOrganizationID INT,
    @AgreementID INT,
    @OrganizationItemID INT,
    @TaxTableTypeID INT,
    @AssignmentDate DATE,
    @Version INT,
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME
--WITH ENCRYPTION 
AS
    SET NOCOUNT ON;

    IF @Version <>
    (
        SELECT [Version]
        FROM [HRM].[AgreementOrganization]
        WHERE [AgreementOrganizationID] = @AgreementOrganizationID
    )
    BEGIN
        RAISERROR('Version mismatch...', 16, 10);
        RETURN;
    END;

    UPDATE [HRM].[AgreementOrganization]
    SET [AgreementID] = @AgreementID,
        [OrganizationItemID] = @OrganizationItemID,
        [TaxTableTypeID] = @TaxTableTypeID,
        [AssignmentDate] = @AssignmentDate,
        [Version] = @Version + 1,
        [LastEditor] = @LastEditor,
        [LastEditionDate] = @LastEditionDate
    WHERE [AgreementOrganizationID] = @AgreementOrganizationID;

    -- Begin Return Select <- do not remove
    SELECT  [Version]
    FROM [HRM].[AgreementOrganization]
    WHERE [AgreementOrganizationID] = @AgreementOrganizationID;
    -- End Return Select <- do not remove
