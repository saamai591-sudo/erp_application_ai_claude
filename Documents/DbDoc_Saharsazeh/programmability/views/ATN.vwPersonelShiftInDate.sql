
------------Start of #NoTask
CREATE     VIEW ATN.vwPersonelShiftInDate
 as
SELECT a.AttendanceShiftID,
       a.PersonnelShiftAssignmentItemID,
       a.PersonelID,
       a.[Date]
FROM   (
           SELECT ROW_NUMBER() OVER(
                      PARTITION BY psai.PersonelID,
                      dd.[Date] ORDER BY psai.[Date] desc
                  )                    rno,
                  psai.AttendanceShiftID,
                  psai.PersonnelShiftAssignmentItemID,
                  psai.PersonelID,
                  dd.[Date]
           FROM  atn.PersonnelShiftAssignmentItem AS psai
                  JOIN cfg.DimDate  AS dd
                       ON  dd.[Date] >= psai.[Date]
                   join hrm.CalendarMonth AS cm on dd.[Date] between cm.AttendanceStartDate and cm.AttendanceEndDate    
       ) a
WHERE  rno = 1
