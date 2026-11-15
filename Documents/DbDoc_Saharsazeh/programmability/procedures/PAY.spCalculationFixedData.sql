
CREATE    PROC Pay.spCalculationFixedData
(
    @calculationDate DATE,
    @TableName NVARCHAR(100),
    @SelectedPersonel NVARCHAR(MAX),
    @NeedConfirm BIT
)
AS 

DECLARE @CalendarID INT,@Query NVARCHAR(MAX)

SELECT @CalendarID = cm.CalendarID
FROM hrm.CalendarMonth AS cm
WHERE cm.EndDate = @calculationDate

SET @Query = N'CREATE TABLE ' + @TableName +
    N'  
(
PersonelID int,
ParameterValueType int,
Value int)'

EXEC (@Query)

SELECT VALUE AS PersonelID
INTO   #SelectedPersonel
FROM   cfg.R_FnCommaStr2Table(@SelectedPersonel) rfcst

SELECT 
t.PersonelID,
t.AgreementID,
t.ExecuteDate,
t.EmploymentDate
into #LastA
FROM   (
           SELECT a.*,
                  ROW_NUMBER() OVER(
                      PARTITION BY a.PersonelID ORDER BY a.IssueDate DESC
                  ) AS Rno
           FROM   HRM.Agreement a
                  INNER JOIN #SelectedPersonel sp
                       ON  sp.PersonelID = a.PersonelID
           WHERE  CASE 
                       WHEN @NeedConfirm = 0 THEN a.IssueDate
                       ELSE a.ConfirmDate
                  END <= @calculationDate
       ) t
WHERE  t.Rno = 1

SELECT * FROM #LastA AS la

SELECT a.PersonelID,
       a.ExecuteDate               LeaveStartDate,
       ou.ExecuteDate              LeaveEndDate,
       m.StartDate                 MonthStartDate,
       m.EndDate                   MonthEndDate,
       DATEDIFF(
           DAY,
           CASE 
                WHEN a.ExecuteDate between m.StartDate
                     AND m.EndDate THEN a.ExecuteDate
                    ELSE m.StartDate
               END,
           CASE 
                WHEN ou.ExecuteDate between m.StartDate
                     AND m.EndDate THEN ou.ExecuteDate
                    ELSE DATEADD(DAY,1,m.EndDate)
               END
       ) MonthSickLeaveDays,
       m.CalendarID,
       m.MonthName
       into #LeaveData
FROM   hrm.Agreement            AS a
join #LastA AS la on a.PersonelID = la.PersonelID and a.EmploymentDate = la.EmploymentDate
       JOIN hrm.AgreementType   AS at
            ON  at.AgreementTypeID = a.AgreementTypeID
            AND (CASE WHEN 0 = 0 THEN a.IssueDate ELSE a.ConfirmDate END) is NOT null
       JOIN hrm.PersonelStatus  AS ps
            ON  ps.PersonelStatusID = at.PrePersonelStatusID
            AND ps.StatusType = 0
       outer APPLY (
    SELECT top 1 a2.ExecuteDate,
           a2.IssueDate,
           a2.PersonelID,
           a2.ConfirmDate,
           a2.AgreementID
    FROM   hrm.Agreement            AS a2
           JOIN hrm.AgreementType   AS at2
                ON  at2.AgreementTypeID = a2.AgreementTypeID
           JOIN hrm.PersonelStatus  AS ps2
                ON  ps2.PersonelStatusID = at2.PrePersonelStatusID
                AND ps2.StatusType = 5
                AND (CASE WHEN 0 = 0 THEN a2.IssueDate ELSE a2.ConfirmDate END) is NOT null
    WHERE  a2.PersonelID = a.PersonelID
           AND a2.ExecuteDate > a.ExecuteDate
           AND ISNULL(a2.ConfirmDate, a2.IssueDate) > ISNULL(a.ConfirmDate, a.IssueDate)
    ORDER BY
           a.ExecuteDate,
           ISNULL(a2.ConfirmDate, a2.IssueDate)
) ou

       JOIN hrm.CalendarMonth   AS m
            ON  a.ExecuteDate <= m.EndDate
            AND m.StartDate <= ISNULL(ou.ExecuteDate, @calculationDate) 
WHERE m.EndDate <=   @calculationDate   

SELECT * FROM #LeaveData

SET @Query = N'insert into ' + @TableName + 
    N'
  
(PersonelID ,
ParameterValueType ,Value)



SELECT sp.PersonelID,
	   26,
       DATEDIFF(DAY, la.EmploymentDate,@calculationDate  ) +1
       
           FROM #SelectedPersonel sp
           JOIN #LastA AS la ON sp.PersonelID = la.PersonelID
           
           union all
           
           SELECT sp.PersonelID,
           27,
           CAST(cfg.GetCLRSaturnDate(@calculationDate,''yyyy'',0,0) AS INT)-
       CAST(cfg.GetCLRSaturnDate(la.EmploymentDate,''yyyy'',0,0) AS INT)+1
           
           FROM #SelectedPersonel sp
           JOIN #LastA AS la ON sp.PersonelID = la.PersonelID
         union all
          select PersonelID,28,sum(MonthSickLeaveDays) from #LeaveData           
WHERE MonthEndDate = @calculationDate
          group by PersonelID
    union all
          select PersonelID,29,sum(MonthSickLeaveDays) from #LeaveData  
          WHERE calendarID = @CalendarID
          group by PersonelID
     union all
          select PersonelID,30,sum(MonthSickLeaveDays) from #LeaveData
           group by PersonelID
               '

EXEC sp_executesql @query,
     N'
						@calculationDate date,
						@CalendarID int
					  ',
     @calculationDate = @calculationDate ,
     @CalendarID = @CalendarID
