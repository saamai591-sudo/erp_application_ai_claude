------------------------------------- 
CREATE   VIEW atn.vwPersonelVacancyTypeInMonth
as

WITH cte as(
         SELECT ROW_NUMBER() OVER(
                    PARTITION BY vtai.PersonelID,
                    vt.VacancyNatureID,
                    cm2.CalendarMonthID ORDER BY cm.EndDate desc
                )                          rno,
                vtai.PersonelID,
                cm2.CalendarMonthID,
                cm2.AttendanceStartDate,
                cm2.AttendanceEndDate,
                vtai.VacancyTypeID,vt.VacancyNatureID,
                vt.Title,
                vt.AssignableValue,
                vti.AllowToNegativeUse,
                vti.NegativeLimit,
                vn.AccrueTime,
                vn.TransferBalance,
                vt.AssignDependency                
         FROM   atn.VacancyTypeAssignmentItem AS vtai
                JOIN atn.VacancyType    AS vt
                     ON  vt.VacancyTypeID = vtai.VacancyTypeID
                JOIN atn.VacancyTypeItem AS vti
                     ON  vti.VacancyTypeID = vt.VacancyTypeID
                join atn.VacancyNature AS vn on vn.VacancyNatureID = vt.VacancyNatureID     
                JOIN hrm.CalendarMonth  AS cm
                     ON  cm.CalendarMonthID = vtai.CalendarMonthID
                JOIN hrm.CalendarMonth  AS cm2
                     ON  cm2.AttendanceEndDate >= cm.AttendanceEndDate
     )

SELECT 
 c.PersonelID,
 c.CalendarMonthID,
 c.AttendanceStartDate,
 c.AttendanceEndDate,
 c.VacancyTypeID,c.VacancyNatureID,
 c.Title,
 c.AssignableValue,
 c.AllowToNegativeUse,
 c.NegativeLimit,
 c.AccrueTime,
 c.TransferBalance,
 c.AssignDependency                
FROM   cte AS c
WHERE  c.rno = 1

