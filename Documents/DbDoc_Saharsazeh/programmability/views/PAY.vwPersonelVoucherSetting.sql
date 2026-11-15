
CREATE     VIEW Pay.vwPersonelVoucherSetting
as

with cte as (
		SELECT cfg.GetuserCulture() UserCulture),
		cte2 as( SELECT * FROM cfg.CultureInfo AS ci 
		join cte c on ci.Culture = c.UserCulture)


select c.*,CASE WHEN c2.CultureNo = 1 then pag.Title else pag.Title2 END PayrollAccGroupTitle from (
SELECT ROW_NUMBER() OVER(
		   PARTITION BY b.EndDate,
					b.PersonelID ORDER BY b.LastDate DESC
	   ) rno,b.*
FROM   (
		   SELECT cm.CalendarMonthID,cm.EndDate,a.EndDate AS LastDate,
				  a.PayrollAccGroupID,
				  a.PersonelID
		   FROM   hrm.CalendarMonth  AS cm
				  JOIN (
						   SELECT pvs.*,
								  cm2.EndDate
						   FROM   pay.PersonelVoucherSetting AS pvs
								  JOIN hrm.CalendarMonth AS cm2
									   ON  cm2.CalendarMonthID = pvs.CalendarMonthID
					   ) a
					   ON  cm.EndDate >= a.EndDate
		 
	   ) b
)c 
cross join cte2 c2
join pay.PayrollAccGroup AS pag on c.PayrollAccGroupID = pag.PayrollAccGroupID
where c.rno = 1 
