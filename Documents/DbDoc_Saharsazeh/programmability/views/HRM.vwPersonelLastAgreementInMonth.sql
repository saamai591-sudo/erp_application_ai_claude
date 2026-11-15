
CREATE   VIEW HRM.vwPersonelLastAgreementInMonth
as
WITH CTE1 as (
		 SELECT *
		 FROM   cfg.Configuration AS c
		 WHERE  c.ConfigKey = 'AgreementNeedConfirm'
	 ),
	 Cte2 as (
		 SELECT cm2.CalendarMonthID,
				ROW_NUMBER() OVER(
					PARTITION BY a.PersonelID,cm2.CalendarMonthID ORDER BY CASE 
															WHEN c.ConfigValue = 'false' THEN a.IssueDate
															ELSE a.ConfirmDate
													   END desc
				)                          rno,
				a.AgreementID
		 FROM   hrm.Agreement           AS a
		 cross JOIN CTE1         AS c
				JOIN hrm.CalendarMonth  AS cm
					 ON  CASE WHEN c.ConfigValue = 'false' THEN a.IssueDate
															ELSE a.ConfirmDate
													   END  between cm.StartDate and cm.EndDate
				
				JOIN hrm.CalendarMonth  AS cm2
					 ON  cm2.EndDate >= cm.EndDate
	 ) 
	 ,cte3 as(
		SELECT cfg.GetuserCulture() UserCulture),
		cte4 as( SELECT * FROM cfg.CultureInfo AS ci 
		join cte3 c3 on ci.Culture = c3.UserCulture)
	
SELECT 
a.IssueDate,a.ExecuteDate,a.PersonelID,a.EmploymentDate,a.EmploymentTypeID,a.WorkPlaceID,
	   a.CostCenterID, a.PositionID, a.JobID, a.BranchID, a.OrganizationUnitID,
	   a.IsManagerToOrganizationUnit,cte2.CalendarMonthID,cm.StartDate,cm.EndDate,cm.AttendanceStartDate,cm.AttendanceEndDate,
	   CASE WHEN c4.CultureNo = 1 then cc.Title else cc.Title2 END CostCenterTitle,
	   CASE WHEN c4.CultureNo = 1 then et.Title else et.Title2 END EmploymentTypeTitle,
	   CASE WHEN c4.CultureNo = 1 then p.Title else p.Title2 END PositionTitle,
	   CASE WHEN c4.CultureNo = 1 then ou.Title else ou.Title2 END OrganizationUnitTitle,
	   CASE WHEN c4.CultureNo = 1 then wp.Title else wp.Title2 END WorkPlaceTitle
	   
FROM   cte2
join hrm.Agreement AS a on cte2.AgreementID = a.AgreementID
join cfg.CostCenter AS cc on a.CostCenterID = cc.CostCenterID
join hrm.EmploymentType AS et on et.EmploymentTypeID = a.EmploymentTypeID
left join hrm.Position AS p on p.PositionID = a.PositionID
left join cfg.OrganizationUnit AS ou on ou.OrganizationUnitID = a.OrganizationUnitID
join hrm.WorkPlace AS wp on wp.WorkPlaceID = a.WorkPlaceID
join hrm.CalendarMonth AS cm on cte2.CalendarMonthID = cm.CalendarMonthID
cross join cte4 c4
WHERE  rno = 1
