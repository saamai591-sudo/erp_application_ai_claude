CREATE  VIEW Pay.vwPayrollAccConfiguration
as
select *
from (
SELECT ROW_NUMBER() OVER(
           PARTITION BY b.EndDate,
                    b.PayrollAccGroupID,b.ParameterID,b.BalanceType ORDER BY b.LastDate DESC
       ) rno,b.*
FROM   (
           SELECT cm.CalendarMonthID,cm.EndDate,a.EndDate AS LastDate,
                  a.PayrollAccGroupID,
                  a.ParameterID,
                  a.SlID,
                  a.BalanceType,
                  a.CalculationTypeID,
                  a.[Description],
                  a.IsShareable,
                  a.ShareBaseDlTypeId                  
           FROM   hrm.CalendarMonth  AS cm
                  JOIN (
                           SELECT pvs.*,p.CalculationTypeID,pag.IsShareable,pag.ShareBaseDlTypeId,
                                  cm2.EndDate
                           FROM   pay.PayrollAccConfiguration  AS pvs
                           JOIN pay.Parameter AS p ON p.ParameterID = pvs.ParameterID
                           JOIN pay.PayrollAccGroup AS pag ON pag.PayrollAccGroupID = pvs.PayrollAccGroupID
                                  JOIN hrm.CalendarMonth AS cm2
                                       ON  cm2.CalendarMonthID = pvs.CalendarMonthID
                       ) a
                       ON  cm.EndDate >= a.EndDate
         
       ) b
)c where c.rno = 1
