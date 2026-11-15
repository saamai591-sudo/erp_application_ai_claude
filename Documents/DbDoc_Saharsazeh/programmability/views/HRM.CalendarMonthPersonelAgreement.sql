



/************************************************************
 * Code formatted by SoftTree SQL Assistant © v9.2.349
 * Time: 4/21/2018 2:43:50 PM
 ************************************************************/

CREATE VIEW [HRM].[CalendarMonthPersonelAgreement]
AS 



SELECT T2.PersonelID,
       T2.CalendarMonthID,
       T2.AgreementID
FROM   (
           SELECT *,
                  ROW_NUMBER() OVER(
                      PARTITION BY T.PersonelID,
                      T.CalendarMonthID
                      ORDER BY T.IssueDate DESC
                  )  AS Rno
           FROM   (
                      SELECT a.AgreementID,
                             a.IssueDate,
                             a.PersonelID,
                             cm.CalendarMonthID
                      FROM   hrm.CalendarMonth AS cm
                             INNER JOIN HRM.Calendar AS c
                                  ON  c.CalendarID = cm.CalendarID
                             LEFT JOIN (
                                      SELECT *
                                      FROM   hrm.Agreement
                                    
                                  ) AS a
                                  ON  a.IssueDate <= cm.EndDate
                                  AND a.ExecuteDate <= Cm.EndDate
                  )     T
       )T2
WHERE T2.Rno=1
AND T2.PersonelID IS NOT null
