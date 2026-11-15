  
CREATE   VIEW ATN.vwPersonelManager
AS
WITH cte AS (
    SELECT 
        1 as LEVEL,
        fc.Title,
        fc.FlowChartID,
        fc.FlowChartID as ParentID 
    FROM hrm.FlowChart AS fc

    UNION ALL

    SELECT 
        1 + c.Level,
        fc.Title,
        fc.FlowChartID,
        c.ParentID
    FROM cte AS c
    JOIN hrm.FlowChart AS fc ON c.FlowChartID = fc.ParentID
),
LastAgreement AS (
    SELECT 
        ROW_NUMBER() OVER (PARTITION BY PersonelID ORDER BY IssueDate DESC) AS rno,
        a.PositionID,
        a.PersonelID,
        a.OrganizationUnitID,
        a.IsManagerToOrganizationUnit
    FROM hrm.Agreement a
    WHERE a.IssueDate <= CAST(GETDATE() AS DATE)
)

SELECT 
    la.PersonelID,
  la2.PersonelID AS ManagerID
FROM cte
JOIN hrm.FlowChart fc ON cte.FlowChartID = fc.FlowChartID
JOIN hrm.Position p ON fc.FlowChartID = p.FlowChartID
JOIN LastAgreement la ON p.PositionID = la.PositionID 
AND la.rno = 1
JOIN hrm.Position p2 ON cte.ParentID = p2.FlowChartID
JOIN LastAgreement la2 ON p2.PositionID = la2.PositionID 
    AND la2.rno = 1 
    AND p2.IsManagerToFlowChart = 1
WHERE la.PersonelID<>la2.PersonelID

UNION ALL

SELECT 
    la.PersonelID,
    la2.PersonelID AS ManagerID
FROM LastAgreement la
JOIN cfg.OrganizationUnit AS ou 
    ON la.OrganizationUnitID = ou.OrganizationUnitID
    and la.rno = 1
JOIN LastAgreement la2 
    ON ou.OrganizationUnitID = la2.OrganizationUnitID 
    AND la2.IsManagerToOrganizationUnit = 1
    and la2.rno = 1;
