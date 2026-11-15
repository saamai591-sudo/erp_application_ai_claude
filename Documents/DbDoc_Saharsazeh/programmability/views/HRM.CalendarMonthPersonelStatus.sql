
/************************************************************
 * Code formatted by SoftTree SQL Assistant © v9.2.349
 * Time: 4/21/2018 2:43:50 PM
 ************************************************************/

CREATE VIEW [HRM].[CalendarMonthPersonelStatus]
AS 

SELECT T2.PersonelID,
       T2.CalendarMonthID,
       T2.[STATUS]
FROM   (
           SELECT *,
                  ROW_NUMBER() OVER(
                      PARTITION BY T.PersonelID,
                      T.CalendarMonthID
                      ORDER BY T.ChangeDate DESC
                  )  AS Rno
           FROM   (
                      SELECT a.[STATUS],
                             a.ChangeDate,
                             a.PersonelID,
                             cm.CalendarMonthID
                      FROM   hrm.CalendarMonth AS cm
                             INNER JOIN HRM.Calendar AS c
                                  ON  c.CalendarID = cm.CalendarID
                             LEFT JOIN (
                                      SELECT *
                                      FROM   hrm.ChangePersonelStatus AS cps
                                  ) AS a
                                  ON  a.ChangeDate <= cm.EndDate
                  )     T
       )T2
WHERE  T2.Rno = 1
       AND T2.PersonelID IS NOT NULL
