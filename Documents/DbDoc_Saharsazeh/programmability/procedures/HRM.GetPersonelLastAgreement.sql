
-------------------------------------
CREATE   PROCEDURE [HRM].[GetPersonelLastAgreement]
(
    @personelID INT,
    @BranchID INT,
    @ExecuteDate DATETIME
)

--WITH ENCRYPTION
AS
BEGIN
    DECLARE @AggID INT;

    DECLARE @oldStatus INT;
    SELECT TOP (1)
           @oldStatus = cps.STATUS
    FROM HRM.ChangePersonelStatus AS cps
    WHERE cps.PersonelID = @personelID
          AND cps.ChangeDate <= @ExecuteDate
    ORDER BY cps.IssueDate DESC;


    IF @oldStatus = 3
    BEGIN
        SELECT @AggID = -10;
    END;
    ELSE
    BEGIN
        SELECT TOP (1)
               @AggID = a.AgreementID
        FROM HRM.Agreement a
        WHERE a.PersonelID = @personelID
        ORDER BY a.IssueDate DESC;
    END;

    SELECT TOP (1)
           @AggID = a.AgreementID
    FROM HRM.Agreement a
    WHERE a.PersonelID = @personelID
    ORDER BY a.IssueDate DESC;

    SELECT a.*,
           og.Title AS OccupationGradeTitle,
           pg.Title AS PayrollGroupTitle,
           pb.Title AS PayrollBaseTitle,
           p.FlowChartID AS FlowChartID,
           fc.Title AS FlowChartTitle,
           et.Title AS EmploymentTypeTitle,
           es.Title AS EmploymentStatusTitle,
           wp.Title AS WorkPlaceTitle,
           cc.Title AS CostCenterTitle,
           p2.Title AS PositionTitle,
           p2.Code AS PositionCode,
           j.Title AS JobTitle
    FROM HRM.Agreement a
        LEFT JOIN HRM.OccupationGrade og
            ON og.OccupationGradeID = a.OccupationGradeID
        LEFT JOIN HRM.PayrollGroup pg
            ON pg.PayrollGroupID = a.PayrollGroupID
        LEFT JOIN HRM.PayrollBase pb
            ON pb.PayrollBaseID = a.PayrollBaseID
        LEFT JOIN HRM.Position AS p
            ON p.PositionID = a.PositionID
        LEFT JOIN HRM.FlowChart AS fc
            ON fc.FlowChartID = p.FlowChartID
        LEFT JOIN HRM.EmploymentType AS et
            ON et.EmploymentTypeID = a.EmploymentTypeID
        LEFT JOIN HRM.EmploymentStatus AS es
            ON es.EmploymentStatusID = a.EmploymentStatusID
        LEFT JOIN HRM.WorkPlace AS wp
            ON wp.WorkPlaceID = a.WorkPlaceID
        LEFT JOIN CFG.CostCenter AS cc
            ON cc.CostCenterID = a.CostCenterID
        LEFT JOIN HRM.Position AS p2
            ON p2.PositionID = a.PositionID
        LEFT JOIN HRM.[Job] AS j
            ON j.JobID = a.JobID
    WHERE a.AgreementID = @AggID;

    SELECT ao.*,
           oi.OrganizationID,
           p.Title AS PartyName,
           o.Title AS OrganizationTitle,
           ttt.Title AS TaxTableTypeTitle
    FROM HRM.AgreementOrganization ao
        JOIN HRM.OrganizationItem oi
            ON oi.OrganizationItemID = ao.OrganizationItemID
        JOIN CFG.Branch AS b
            ON b.CompanyID = oi.CompanyID
        JOIN HRM.Organization AS o
            ON o.OrganizationID = oi.OrganizationID
        LEFT JOIN CFG.Party p
            ON p.PartyID = oi.PartyID
        LEFT JOIN HRM.TaxTableType ttt
            ON ttt.TaxTableTypeID = ao.TaxTableTypeID
    WHERE ao.AgreementID = @AggID
          AND b.BranchID = @BranchID;

    SELECT ap.*,
           p.Title AS ParameterName
    FROM HRM.AgreementParameter ap
        INNER JOIN PAY.Parameter AS p
            ON p.ParameterID = ap.ParameterID
    WHERE ap.AgreementID = @AggID;

    SELECT *
    FROM HRM.AgreementBaseValue AS abv
    WHERE abv.AgreementID = @AggID;


END;
