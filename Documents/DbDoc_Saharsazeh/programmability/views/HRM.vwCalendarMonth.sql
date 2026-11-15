CREATE   VIEW [HRM].[vwCalendarMonth]
AS

SELECT CAST(c.[Year] AS NVARCHAR(4)) + '-' + CAST(cm.MonthNumber AS NVARCHAR(2)) YearMonth,
       c.CalendarID,
       cm.CalendarMonthID,
       c.[Year],
       cm.MonthNumber,
       cm.MonthName,
       cm.StartDate,
       cm.EndDate,
       c.WorkHours,
       cm.StandardDays,
       cm.PermittedDays,
       cm.StandardHours,
       cm.PermittedHours
FROM   hrm.Calendar            AS c
       JOIN hrm.CalendarMonth  AS cm
            ON  cm.CalendarID = c.CalendarID