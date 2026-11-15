
Create VIEW [HRM].[CalendarMonthPersonelStatusAtAnyDay]
AS 

SELECT T2.PersonelID,
       T2.CalendarMonthID,
       5  AS [STATUS]
FROM   (
           SELECT p.PersonelID,
                  cm.CalendarMonthID
           FROM   hrm.CalendarMonth AS cm
                  INNER JOIN HRM.Calendar AS c
                       ON  c.CalendarID = cm.CalendarID
                  CROSS JOIN hrm.Personel AS p
           WHERE  EXISTS (
                      SELECT 1
                      FROM   hrm.ChangePersonelStatus AS cps
                      WHERE  cps.PersonelID = p.PersonelID
                             AND cps.[STATUS] <> 3
                             AND cps.ChangeDate BETWEEN StartDate AND EndDate
                  )
                  OR  (
                          SELECT TOP 1 [Status]
                          FROM   hrm.ChangePersonelStatus AS cps
                          WHERE  cps.ChangeDate <= cm.StartDate
                                 AND cps.PersonelID = p.PersonelID
                          ORDER BY
                                 cps.ChangeDate DESC
                      ) <> 3
       )     T2
