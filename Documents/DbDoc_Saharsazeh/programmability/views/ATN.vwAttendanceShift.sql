-------------------------------------
 CREATE   view [ATN].vwAttendanceShift
 as
SELECT sh.AttendanceShiftID,
       sh.Code,
       sh.Title,
       asi.AttendanceShiftItemID,
       asi.RowIndex,
       asi.[Day],
       asi.EndDay,
       DATEDIFF(Minute, '1970-01-01', dd.[Date])  + (asi.StartHour - asi.EarlyEntryAllowed) StartingLimitHour,
       DATEDIFF(Minute, '1970-01-01', dd.[Date]) + asi.StartHour  ShiftStartingHour,       
       asi.StartHour,
       asi.EndHour,
       DATEDIFF(
           Minute,
           '1970-01-01',
           DATEADD(DAY, asi.EndDay - asi.StartDay, dd.[Date])
       )  + (asi.EndHour + asi.LateExitAllowed) EndingLimitHour,
       DATEDIFF(
           Minute,
           '1970-01-01',
           DATEADD(DAY, asi.EndDay - asi.StartDay, dd.[Date])
       )  + asi.EndHour ShiftEndingHour,
       dd.[Date]                        StartDate,
       DATEADD(DAY, asi.EndDay - asi.StartDay, dd.[Date]) EndDate,
       asi.VacancyDuration,
       asi.DayType,
       CASE WHEN asi.DayType IN (1,2) then 0 else 1 END IsWorkingDay
FROM   atn.AttendanceShift           AS sh
       JOIN atn.AttendanceShiftItem  AS asi
            ON  asi.AttendanceShiftID = sh.AttendanceShiftID
       JOIN cfg.DimDate              AS dd
            ON  dd.[Date] >= sh.StartDate
            AND CASE 
                     WHEN (DATEDIFF(DAY, sh.StartDate, dd.[Date])+1)%sh.ShiftPeriod = 0 THEN sh.ShiftPeriod
                     ELSE (DATEDIFF(DAY, sh.StartDate, dd.[Date])+1)%sh.ShiftPeriod
                END = asi.StartDay


