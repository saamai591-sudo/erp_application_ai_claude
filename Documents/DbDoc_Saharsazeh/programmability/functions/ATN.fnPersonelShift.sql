
CREATE   FUNCTION ATN.fnPersonelShift(@PersonelID INT = Null)
RETURNS Table
as 
Return

SELECT a.PersonelID,
       a.PersonnelShiftAssignmentItemID,
       a.AttendanceShiftID,
       a.[Date]                        ShiftAssignDate,
       ISNULL(DATEADD(DAY,-1,b.[Date]), (SELECT MAX(cm.AttendanceEndDate) FROM hrm.CalendarMonth AS cm))     ShiftAssignEndDate
FROM   (
           SELECT ROW_NUMBER() OVER(PARTITION BY psai.PersonelID ORDER BY psai.[Date]) rno,
                  psai.PersonnelShiftAssignmentItemID,
                  psai.RowIndex,
                  psai.PersonelID,
                  psai.AttendanceShiftID,
                  psai.[Date]
           FROM   atn.PersonnelShiftAssignmentItem AS psai
           WHERE (@PersonelID is null or psai.PersonelID = @PersonelID)
       ) a
       left JOIN (
                SELECT ROW_NUMBER() OVER(PARTITION BY psai.PersonelID ORDER BY psai.[Date]) rno,
                       psai.PersonnelShiftAssignmentItemID,
                       psai.RowIndex,
                       psai.PersonelID,
                       psai.AttendanceShiftID,
                       psai.[Date]
                FROM   atn.PersonnelShiftAssignmentItem AS psai
                WHERE (@PersonelID is null or psai.PersonelID = @PersonelID)
            ) b
            ON  a.PersonelID = b.PersonelID
            AND a.rno = b.rno -1
