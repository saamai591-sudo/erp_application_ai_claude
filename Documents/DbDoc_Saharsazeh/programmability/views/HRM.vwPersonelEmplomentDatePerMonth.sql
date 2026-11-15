
----------------Start of #NoTask
CREATE   VIEW HRM.vwPersonelEmplomentDatePerMonth
as
 with EmploymentDatePerPersonel
 as ( SELECT a.PersonelID,
                                  a.EmploymentDate
                           FROM   hrm.Agreement AS a
                           GROUP BY
                                  a.PersonelID,
                                  a.EmploymentDate
 ),cte2
 as (
 	SELECT a.PersonelID,a.ExecuteDate FROM hrm.Agreement AS a
 	join hrm.AgreementType AS at on at.AgreementTypeID = a.AgreementTypeID
 	WHERE at.PrePersonelStatusID = 5)
 	
 	
  
SELECT a.PersonelID,
                  a.CalendarMonthID,
                  a.StartDate,
                  a.EndDate,
                  a.AttendanceStartDate,
                  a.AttendanceEndDate,
                  a.EmploymentDate,
                  DATEADD(DAY,-1,cte2.ExecuteDate) as PersonelEndDate
FROM   (
           SELECT ROW_NUMBER() OVER(
                      PARTITION BY emp.PersonelID,
                      cm.CalendarMonthID ORDER BY emp.EmploymentDate desc
                  )                     rno,
                  emp.PersonelID,
                  cm.CalendarMonthID,
                  cm.StartDate,
                  cm.EndDate,
                  cm.AttendanceStartDate,
                  cm.AttendanceEndDate,
                  emp.EmploymentDate
           FROM   hrm.CalendarMonth  AS cm
                  JOIN EmploymentDatePerPersonel emp
                       ON  cm.AttendanceEndDate >= emp.EmploymentDate
       ) a
       left join cte2 on a.PersonelID = cte2.PersonelID and cte2.ExecuteDate <= a.AttendanceEndDate and cte2.ExecuteDate >a.EmploymentDate
WHERE  a.rno = 1
and (cte2.ExecuteDate is null or cte2.ExecuteDate between a.AttendanceStartDate and a.AttendanceEndDate)
