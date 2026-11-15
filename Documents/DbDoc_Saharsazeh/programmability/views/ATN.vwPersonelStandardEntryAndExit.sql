
---------------------------------------------------------
CREATE   view ATN.vwPersonelStandardEntryAndExit
as
with vas
as (SELECT * FROM atn.vwAttendanceShift AS vas),
vpsid as 
(SELECT * FROM atn.vwPersonelShiftInDate AS vpsid2)

SELECT
	v.AttendanceShiftID,
	v.Code,
	v.Title,
	v.AttendanceShiftItemID,
	v.RowIndex,
	v.[Day],
	v.EndDay,
	v.StartingLimitHour,
	v.ShiftStartingHour,
	v.StartHour,
	v.EndHour,
	v.EndingLimitHour,
	v.ShiftEndingHour,
	v.StartDate,
	v.EndDate,
	v.VacancyDuration,
	v.DayType,
	vp.PersonelID
FROM
	vas AS v
	join vpsid  vp on  vp.AttendanceShiftID = v.AttendanceShiftID and v.StartDate = vp.[Date]
