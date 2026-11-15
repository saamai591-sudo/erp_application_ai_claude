CREATE
VIEW hrm.vwPersonelEmploymenType
	AS 
	SELECT b.PersonelID,b.CalendarMonthID,b.EmploymentTypeID,b.LastDate 
	
FROM   (
           SELECT ROW_NUMBER() OVER(
                      PARTITION BY src.PersonelID,   cm.CalendarMonthID ORDER BY src.LastDate DESC,src.AgreementDate DESC
                  )                     rno,cm.CalendarMonthID,
                  src.*
           FROM   hrm.CalendarMonth  AS cm
                  JOIN (
                           SELECT a.PersonelID,
                                  a.EmploymentTypeID,
                                  cm2.EndDate LastDate,
                                   CASE 
                                                WHEN c.ConfigValue = 'True' THEN a.ConfirmDate
                                                ELSE a.IssueDate
                                           END AgreementDate
                           FROM    hrm.Agreement AS a
                                  JOIN cfg.Configuration c
                                       ON  c.ConfigKey = 'AgreementNeedConfirm'
                                  JOIN hrm.CalendarMonth AS cm2
                                       ON  CASE 
                                                WHEN c.ConfigValue = 'True' THEN a.ConfirmDate
                                                ELSE a.IssueDate
                                           END BETWEEN cm2.StartDate AND cm2.EndDate
                       ) src
                       ON  cm.EndDate >= src.LastDate
       ) b
WHERE  b.rno = 1
