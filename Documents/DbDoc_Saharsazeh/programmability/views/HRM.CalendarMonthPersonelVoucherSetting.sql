


/************************************************************
 * Code formatted by SoftTree SQL Assistant © v9.2.349
 * Time: 4/21/2018 2:43:50 PM
 ************************************************************/

CREATE VIEW [HRM].[CalendarMonthPersonelVoucherSetting]
AS 

SELECT T2.PersonelID,
       T2.CalendarMonthID,
       T2.PersonelVoucherSettingID,
       T2.PayrollAccGroupID
FROM   (
           SELECT *,
                  ROW_NUMBER() OVER(
                      PARTITION BY T.PersonelID,
                      T.CalendarMonthID
                      ORDER BY T.EndDate DESC
                  )  AS Rno
           FROM   (
                      SELECT a.PersonelVoucherSettingID,
                             a.EndDate,
                             a.PersonelID,
                             cm.CalendarMonthID,
                             a.PayrollAccGroupID
                      FROM   hrm.CalendarMonth AS cm
                             INNER JOIN HRM.Calendar AS c
                                  ON  c.CalendarID = cm.CalendarID
                             LEFT JOIN (
                                      SELECT cps.*,
                                             cm2.EndDate
                                      FROM   pay.PersonelVoucherSetting AS cps
                                             INNER JOIN HRM.CalendarMonth AS cm2
                                                  ON  cm2.CalendarMonthID = cps.CalendarMonthID
                                  ) AS a
                                  ON  a.EndDate <= cm.EndDate
                  )     T
       )T2
WHERE  T2.Rno = 1
       AND T2.PersonelID IS NOT NULL
