CREATE   PROC [HRM].[spAgreementOrganizationInsert]
    @AgreementID INT,
    @OrganizationItemID INT,
    @TaxTableTypeID INT,
    @AssignmentDate DATE,
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME
--WITH ENCRYPTION 
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @issuedate DATE,
            @PersonelID INT,
            @PreAgreementID INT,
            @Type TINYINT,
            @PreAssignmentDate DATE,
            @startdate DATE,
            @executeDate DATE;

    SELECT @issuedate = IssueDate,
           @PersonelID = PersonelID,
           @Type = AgreementTypeID,
           @executeDate = ExecuteDate
    FROM HRM.Agreement
    WHERE AgreementID = @AgreementID;

    SELECT @startdate = StartDate
    FROM HRM.CalendarMonth
    WHERE @issuedate
    BETWEEN StartDate AND EndDate;

    IF
    (
        SELECT vat.IsStart
        FROM HRM.vwAgreementType AS vat
        WHERE vat.AgreementTypeID = @Type
    ) = 0
    BEGIN
        SELECT TOP 1
               @PreAgreementID = AgreementID
        FROM HRM.Agreement
        WHERE PersonelID = @PersonelID
              AND AgreementID <> @AgreementID
        ORDER BY IssueDate DESC;

        SELECT @PreAssignmentDate = AssignmentDate
        FROM HRM.[AgreementOrganization]
        WHERE AgreementID = @PreAgreementID
              AND OrganizationItemID = @OrganizationItemID;

        IF @PreAssignmentDate IS NOT NULL
            SET @AssignmentDate = @PreAssignmentDate;
        ELSE
            SET @AssignmentDate = @startdate;
    END;

    IF @AssignmentDate IS NULL
    BEGIN
        RAISERROR('ابتدا  لازم است ماه تقویم کاری تعریف شود.', 16, 12);
        RETURN;
    END;

    INSERT INTO [HRM].[AgreementOrganization]
    (
        [AgreementID],
        [OrganizationItemID],
        [TaxTableTypeID],
        [AssignmentDate],
        [Version],
        [Creator],
        [CreationDate],
        [LastEditor],
        [LastEditionDate]
    )
    SELECT @AgreementID,
           @OrganizationItemID,
           @TaxTableTypeID,
           @AssignmentDate,
           0,
           @Creator,
           @CreationDate,
           @LastEditor,
           @LastEditionDate;

    -- Begin Return Select <- do not remove
    SELECT [AgreementOrganizationID],
           [Version]
    FROM [HRM].[AgreementOrganization]
    WHERE [AgreementOrganizationID] = SCOPE_IDENTITY();
-- End Return Select <- do not remove
END;
