

/************************************************************
 * Code formatted by SoftTree SQL Assistant © v9.2.349
 * Time: 4/22/2018 8:35:27 AM
 ************************************************************/

CREATE VIEW [APS].[DimCalendarMonth]
AS 


SELECT cm.CalendarMonthID,
       c.[Year],
       cm.MonthNumber,
       cm.MonthName,
       cm.MonthName + ' '+ CAST(c.[Year] AS VARCHAR(10)) AS Title,
       c.[Year]*10000+cm.MonthNumber AS OrderID 
FROM   hrm.CalendarMonth        AS cm
       INNER JOIN HRM.Calendar  AS c
            ON  c.CalendarID = cm.CalendarID
