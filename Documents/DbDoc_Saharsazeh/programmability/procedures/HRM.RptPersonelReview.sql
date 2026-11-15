CREATE     PROCEDURE [HRM].[RptPersonelReview]
--WITH ENCRYPTION
AS 

	DECLARE @Culture varchar(25),
		@CultureNo tinyint

	set @Culture = CFG.GetuserCulture() 

	select @CultureNo = CultureNo
	from CFG.CultureInfo 
	where Culture = @Culture
	  
	SELECT T.PersonelID,
	       T.EmploymentTypeID,
	       T.EmploymentStatus,
	       T.EmploymentType,
	       T.CostCenter,
	       T.WorkPlace,
		   T.JobTitle,
		   T.OccupationGradeTitle
	       INTO     #validAgg
	FROM   (
	           SELECT a.*,
					  case when @CultureNo = 1 then et.Title
	                       when @CultureNo = 2 then et.Title2
	                  end as EmploymentType,	                  
					  case when @CultureNo = 1 then es.Title
	                       when @CultureNo = 2 then es.Title2
	                  end as EmploymentStatus,	                  
					  case when @CultureNo = 1 then cc.Title
	                       when @CultureNo = 2 then cc.Title2
	                  end as CostCenter,	                  
					  case when @CultureNo = 1 then wp.Title
	                       when @CultureNo = 2 then wp.Title2
	                  end as WorkPlace,	                  
					  case when @CultureNo = 1 then j.Title
	                       when @CultureNo = 2 then j.Title2
	                  end as Jobtitle,
					  case when @CultureNo = 1 then og.Title
	                       when @CultureNo = 2 then og.Title2
	                  end as OccupationGradeTitle,
	                  ROW_NUMBER() OVER(PARTITION BY a.PersonelID ORDER BY a.IssueDate DESC) AS Rno
	           FROM   hrm.Agreement a
	                  INNER JOIN hrm.Personel AS p
	                       ON  a.PersonelID = p.PersonelID
	                  INNER JOIN hrm.EmploymentType et
	                       ON  et.EmploymentTypeID = a.EmploymentTypeID
	                  INNER JOIN cfg.CostCenter cc
	                       ON  cc.CostCenterID = a.CostCenterID
	                  INNER JOIN hrm.WorkPlace wp
	                       ON  wp.WorkPlaceID = a.WorkPlaceID
	                  LEFT JOIN HRM.[Job] AS j
							ON j.JobID = a.JobID
	                  LEFT JOIN hrm.OccupationGrade AS og
							ON og.OccupationGradeID = a.OccupationGradeID
	                       LEFT JOIN hrm.EmploymentStatus AS es
	        ON es.EmploymentStatusID = a.EmploymentStatusID
	           WHERE  a.IssueDate <= GETDATE()	                  
	       )        T
	WHERE  Rno = 1
		
    SELECT T.PersonelVoucherSettingID,
           T.PersonelID,
           T.PayrollAccGroupID,
           T.MissionOrganizationDlId
    INTO #lastVoucherSetting
    FROM
    (
        SELECT pvs.*,
               ROW_NUMBER() OVER (PARTITION BY pvs.PersonelID ORDER BY cm.StartDate DESC) AS Rno
        FROM PAY.PersonelVoucherSetting AS pvs
            INNER JOIN HRM.CalendarMonth AS cm
                ON cm.CalendarMonthID = pvs.CalendarMonthID
        WHERE cm.EndDate <=  GETDATE()
    ) T
    WHERE T.Rno = 1;

	SELECT p.PersonelID,
	       p.Code    AS PersonelCode,
		   case when @CultureNo = 1 then p2.Title
	           when @CultureNo = 2 then p2.Title2
	      end as PersonelName,
		   case when @CultureNo = 1 then p2.LastName
	           when @CultureNo = 2 then p2.LastName2
	      end as LastName,
	       a.WorkPlace,
	       a.CostCenter,
	       a.JobTitle,
	       a.EmploymentStatus,
	       a.EmploymentType,a.
	       OccupationGradeTitle,
           CASE @cultureNo
               WHEN 2 THEN
                   pag.Title2
               ELSE
                   pag.Title
           END AS AccGroupTitle
	FROM   Hrm.Personel p
	       INNER JOIN #validAgg a
	            ON  a.PersonelID = p.PersonelID
			LEFT JOIN #lastVoucherSetting AS pvs
				ON pvs.PersonelID = p.PersonelID
			LEFT JOIN PAY.PayrollAccGroup AS pag
				ON pag.PayrollAccGroupID = pvs.PayrollAccGroupID
	       INNER JOIN Hrm.EmploymentType et
	            ON  et.EmploymentTypeID = a.EmploymentTypeID
	       INNER JOIN CFG.Party p2
	            ON  p2.PartyID = p.PartyID
