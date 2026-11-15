
CREATE     VIEW [PAY].[PayrollAccConfigurationCalendarMonth]
as
select * from (
SELECT ROW_NUMBER() OVER(
           PARTITION BY b.EndDate,
           b.PayrollAccGroupID,
           b.ParameterID,
           b.BalanceType ORDER BY b.LastDate DESC
       ) rno,b.*
FROM   (
           SELECT cm.CalendarMonthID,cm.EndDate,
                  a.PayrollAccGroupID,
                  a.ParameterID,
                  a.SlID,
                  a.BalanceType,
                  a.[Description],
                  a.Description2,
                  a.EndDate             LastDate,
				  PayrollAccConfigurationID,
				  a.IsActive
           FROM   hrm.CalendarMonth  AS cm
                  JOIN (
                           SELECT pac.*,
                                  cm2.EndDate
                           FROM   pay.PayrollAccConfiguration AS pac
                                  JOIN hrm.CalendarMonth AS cm2
                                       ON  cm2.CalendarMonthID = pac.CalendarMonthID
                       ) a
                       ON  cm.EndDate >= a.EndDate
       ) b
)c where c.rno = 1 



