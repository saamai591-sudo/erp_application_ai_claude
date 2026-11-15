
CREATE    PROC Atn.spGetRequestDuration
(
	@PersonelID INT,
	@StartDate DATE,
	@EndDate DATE,
	@StartHour DECIMAL(18, 0),
	@EndHour DECIMAL(18, 0),
	@Duration DECIMAL(18, 0) OUTPUT
)
AS 

IF @EndDate IS NULL 
BEGIN
	SET @EndDate = @StartDate
END
	
SELECT @Duration = SUM(CASE  WHEN @StartHour is NOT NULL THEN @EndHour - @StartHour
			 WHEN ac.AttendanceCalendarID is NOT NULL THEN CASE 
			 WHEN ISNULL(ac.DayType, 0) <> 3 THEN 0
			 WHEN ISNULL(ac.DayType, 0) = 3 and ac.StartHour is NOT 
				 NULL and ac.EndHour is NULL THEN vas.EndHour - 
				 ac.StartHour
			 WHEN ISNULL(ac.DayType, 0) = 3 and ac.EndHour is NOT NULL 
				 and ac.StartHour is NULL THEN ac.EndHour - 
				 vas.StartHour
			 WHEN ISNULL(ac.DayType, 0) = 3 and ac.StartHour is NOT 
				NULL and ac.EndHour is NOT NULL THEN ac.EndHour - 
				ac.StartHour
				
				  END
			 WHEN vas.DayType <> 3 then   0 --ÑæÒ Û?Ñ ˜ÇÑ?
			 WHEN vas.DayType = 3 -- ÑæÒ ˜ÇÑ?
				THEN	  vas.VacancyDuration
	   END)
FROM   cfg.DimDate                       AS dd
	   JOIN atn.vwAttendanceShift        AS vas
			ON  dd.[Date] = vas.StartDate
	   JOIN atn.vwPersonelShiftInDate    AS vpsid
			ON  vpsid.AttendanceShiftID = vas.AttendanceShiftID
			AND vpsid.PersonelID = @PersonelID
			AND vpsid.[Date] = vas.StartDate
	   left JOIN atn.AttendanceCalendar  AS ac
			ON  vas.StartDate = ac.[Date]
			AND vas.AttendanceShiftID = ac.AttendanceShiftID
WHERE  dd.[Date] between @StartDate and @EndDate;
