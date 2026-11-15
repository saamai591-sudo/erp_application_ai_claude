CREATE   PROC  [ATN].spVacancyCardex

(@VacancyTable NVARCHAR(MAX))

as 

         SELECT * into #AttendanceShift
         FROM   atn.vwAttendanceShift AS vas
     

         SELECT *
         INTO   #PersonelShiftInDate
         FROM   atn.vwPersonelShiftInDate AS vpsid
         
         
         SELECT *
         INTO   #PersonelVacancyTypeInMonth
         FROM   atn.vwPersonelVacancyTypeInMonth AS vpvtim
         
         
         SELECT *
         INTO   #PersonelEmplomentDatePerMonth
         FROM   hrm.vwPersonelEmplomentDatePerMonth AS vpedpm 
     
     
--LeaveRequest

DECLARE @Qyery NVARCHAR(MAX)

set @Qyery = N'
Create table '+@VacancyTable+N'
(

VacancyNatureID int,
PersonelID int,
Date Date,
AddedVacancy int,
DeductedVacancy int,
Document Nvarchar(250),
DocumentID int,
EmploymentDate Date)
'
EXEC (@Qyery)





SELECT 
vn.VacancyNatureID,
lr.PersonelID,
       dd.[Date],
      CAST( 0  as INT)                                AS AddedVacancy,
      CAST( (
           CASE 
                WHEN lr.StartHour is NOT NULL THEN lr.EndHour - lr.StartHour
                WHEN ac.AttendanceCalendarID is NOT NULL THEN CASE 
                            WHEN ISNULL(ac.DayType, 0) IN (1, 2) THEN 0
                            WHEN ISNULL(ac.DayType, 0) = 3 and vn.BalanceTiming = 2 then 1  --- For daily vacancy
                            WHEN ISNULL(ac.DayType, 0) = 3  AND ac.StartHour is NOT NULL
                                AND ac.EndHour is Null THEN vas.EndHour - 
                                    ac.StartHour
                                WHEN ISNULL(ac.DayType, 0) = 3
                                AND ac.EndHour is NOT NULL
                                AND ac.StartHour is NULL THEN ac.EndHour - 
                                    vas.StartHour
                                WHEN ISNULL(ac.DayType, 0) = 3
                                AND ac.EndHour is NOT NULL
                                AND ac.StartHour is NOT NULL THEN ac.EndHour - 
                                    ac.StartHour
                            END
                    WHEN vas.DayType IN (1, 2) THEN 0
                    when vas.DayType = 3 and vn.BalanceTiming = 2 then 1
                    WHEN vas.DayType = 3 and vn.BalanceTiming = 1 THEN vas.VacancyDuration
               END
       )   as INT)                                 DeductedVacancy,
       'LeaveRequest' Document,
       lr.LeaveRequestID                 AS DocumentID,
       vpedm.EmploymentDate
       into #VacancyCarderx
FROM   atn.LeaveRequest                  AS lr
join atn.RequestType AS rt on rt.RequestTypeID = lr.RequestTypeID
join #PersonelVacancyTypeInMonth vpvtim on
lr.PersonelID = vpvtim.PersonelID and rt.VacancyNatureID = vpvtim.VacancyNatureID
and lr.StartDate between vpvtim.AttendanceStartDate and vpvtim. AttendanceEndDate
	JOIN atn.VacancyNature            AS vn
		ON  vn.VacancyNatureID = rt.VacancyNatureID
	JOIN cfg.DimDate                  AS dd
		ON  dd.[Date] between lr.StartDate and ISNULL(lr.EndDate, lr.StartDate)
	JOIN #AttendanceShift            AS vas
		ON  dd.[Date] = vas.StartDate
	JOIN #PersonelShiftInDate        AS vpsid
		ON  vpsid.AttendanceShiftID = vas.AttendanceShiftID
		AND vpsid.[Date] = vas.StartDate
		AND vpsid.PersonelID = lr.PersonelID
	left JOIN atn.AttendanceCalendar  AS ac
		ON  vas.StartDate = ac.[Date]
		AND vas.AttendanceShiftID = ac.AttendanceShiftID
join #PersonelEmplomentDatePerMonth vpedm on lr.PersonelID = vpedm.PersonelID 
and dd.[Date] between vpedm.AttendanceStartDate and vpedm.AttendanceEndDate		
WHERE  lr.[Status] <> 3 

UNION ALL

---VacancyEstablishment
SELECT ve.VacancyNatureID ,
		ve.PersonelID,
       cm.AttendanceStartDate,
       CAST(CASE when ve.ValueType = 1 then  ve.[Value] else 0 END as INT),       
       CAST(CASE when ve.ValueType = 2 then  ve.[Value] else 0 END as INT),
       'VacancyEstablishment',
       ve.VacancyEstablishmentID  AS DocumentID,
       vpedpm.EmploymentDate
FROM   atn.VacancyEstablishment   AS ve
       JOIN hrm.CalendarMonth     AS cm
            ON  ve.CalendarMonthID = cm.CalendarMonthID
      join #PersonelEmplomentDatePerMonth vpedpm on ve.PersonelID = vpedpm.PersonelID 
and ve.CalendarMonthID = vpedpm. CalendarMonthID    
            
UNION ALL

--- AssignableValue	
	SELECT
	vpvtim.VacancyNatureID,
	vpvtim.PersonelID,
	CASE WHEN vpvtim.AccrueTime IN(3,1) then cm.AttendanceStartDate else cm.AttendanceEndDate End,
	CAST(CASE WHEN vpvtim.AccrueTime = 3 then 
		
		CASE WHEN vpedpm.EmploymentDate between cm.AttendanceStartDate and cm.AttendanceEndDate
		or cm.MonthNumber = 1
		then vpvtim.AssignableValue else 0 
		end
		
		 else
	CAST(vpvtim.AssignableValue as DECIMAL(36,10)) *
	CAST( CASE 
              WHEN vpvtim.AssignDependency = 1 THEN DATEDIFF(DAY, cm.StartDate, cm.EndDate) +1
              WHEN vpvtim.AssignDependency = 3 THEN DATEDIFF(
                       DAY,
                       CASE 
                            WHEN vpedpm.EmploymentDate <= cm.StartDate THEN cm.StartDate
                            ELSE vpedpm.EmploymentDate
                       END,
                       CASE WHEN vpedpm.PersonelEndDate <=cm.AttendanceEndDate then  vpedpm.PersonelEndDate else  cm.AttendanceEndDate END 
                   ) +1 
         END  as DECIMAL(36,10)) /CAST(DATEDIFF(DAY,cm.StartDate,cm.EndDate)+1 as DECIMAL(36,10)) End as INT) AS Vacancy,0,'AssignableValue',Null
         ,vpedpm.EmploymentDate
	
	FROM   hrm.CalendarMonth             AS cm
	JOIN #PersonelVacancyTypeInMonth AS vpvtim on cm.CalendarMonthID = vpvtim.CalendarMonthID 
	join #PersonelEmplomentDatePerMonth vpedpm on cm.CalendarMonthID = vpedpm.CalendarMonthID and vpedpm.PersonelID = vpvtim.PersonelID
	WHERE cm.AttendanceStartDate <=CAST (GETDATE() as DATE)       
UNION ALL 

--- VacancyEdition
SELECT 
ve.VacancyNatureID,
ve.PersonelID,
       cm.AttendanceStartDate,
       CAST(CASE 
            WHEN ve.ValueType = 2 THEN ve.[Value]
            ELSE 0
       END as INT),
      CAST( CASE 
            WHEN ve.ValueType = 1 THEN 1 * ve.[Value]
            ELSE 0
       END as INT),
       'VacancyEdition',
       ve.VacancyEditionID
        ,vpedpm.EmploymentDate
FROM   atn.VacancyEdition      AS ve
       JOIN hrm.CalendarMonth  AS cm
            ON  cm.CalendarMonthID = ve.CalendarMonthID
       JOIN #PersonelEmplomentDatePerMonth vpedpm
            ON  ve.PersonelID = vpedpm.PersonelID
            AND ve.CalendarMonthID = vpedpm. CalendarMonthID    
            

			set @Qyery = N'insert into '+@VacancyTable+N'
			             select *  from #VacancyCarderx'

                           exec (@Qyery)
			
