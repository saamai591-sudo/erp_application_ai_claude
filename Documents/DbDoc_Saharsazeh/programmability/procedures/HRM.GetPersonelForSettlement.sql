
-------------------------------------------------------------------------------------------------------------------------
CREATE   PROCEDURE HRM.GetPersonelForSettlement
(@CalendarMonthID INT)
--WITH ENCRYPTION
AS
DECLARE @UserId INT;
SET @UserId = cfg.GetuserID();

DECLARE @StartDate DATE,
        @EndDate DATE;
        
 SELECT *  into #vwCompanyAccess
  FROM cfg.vwCompanyAccess AS vca
 
        

SELECT @StartDate = DATEADD(dd, 1, cm.StartDate),
       @EndDate = DATEADD(dd, 1, cm.EndDate)
FROM hrm.CalendarMonth AS cm
WHERE cm.CalendarMonthID = @CalendarMonthID;

SELECT p.PersonelID,
       p.PartyID,
       Code,
       (pa.Title + ' ' + ISNULL(pa.LastName, '')) AS FullName
FROM hrm.Personel AS p
    INNER JOIN CFG.Party pa  ON p.PartyID = pa.PartyID
    Inner JOIN #vwCompanyAccess AS vca on vca.CompanyID = p.CompanyID
       
    LEFT JOIN
    (
        SELECT ROW_NUMBER() OVER (PARTITION BY a.PersonelID ORDER BY a.IssueDate DESC) AS Rno,
               a.BranchID,
               a.PersonelID
        FROM hrm.Agreement AS a
    ) Agg
        ON Agg.PersonelID = p.PersonelID
           AND Agg.Rno = 1
    INNER JOIN cfg.vwBranchAccess AS vba
        ON vba.BranchID = Agg.BranchID
WHERE EXISTS
(
    SELECT 1
    FROM HRM.ChangePersonelStatus AS cps
    WHERE cps.[STATUS] = 3
          AND cps.PersonelID = p.PersonelID
          AND cps.ChangeDate
          BETWEEN @StartDate AND @EndDate
)
      AND NOT EXISTS
(
    SELECT *
    FROM pay.CalculationPersonel AS s
    WHERE s.PersonelID = p.PersonelID
          AND s.CalendarMonthID = @CalendarMonthID
          AND s.CalculationTypeID =
          (
              SELECT CalculationTypeID
              FROM PAY.CalculationType
              WHERE EngName = 'Settlement'
          )
);
