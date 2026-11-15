
CREATE   PROC ATN.spVacancyReviewPersonelRemian
(
    @FromMonth INT,
    @ToMonth INT,
    @CurrentPersonelID INT= null,
    @Source TINYINT = 1
)
AS 
BEGIN
	DECLARE 
			@StartDate     DATE,
			@EndDate       DATE
	
	SELECT @StartDate = cm.StartDate
	FROM   hrm.CalendarMonth AS cm
	WHERE  cm.CalendarMonthID = @FromMonth
	
	SELECT @EndDate = cm.EndDate
	FROM   hrm.CalendarMonth AS cm
	WHERE  cm.CalendarMonthID = @ToMonth
	
	DROP TABLE 
	IF EXISTS #Item
		CREATE TABLE #Item
		(
			PersonelID          INT,
			VacancyNatureID     INT,
			FirstRemain         DECIMAL(36, 10),
			AssignableValue     DECIMAL(36, 10),
			VacancyEdition      DECIMAL(36, 10),
			UsedVacancy         DECIMAL(36, 10),
			EndRemain			DECIMAL(36, 10)
		)
	
	print sysdatetime()
	
	SELECT vpsid.PersonelID into #ActivePersonel
	 FROM hrm.vwPersonelStatusInDate AS vpsid
	WHERE vpsid.[STATUS]<> 3	and	vpsid.[DATE] between @StartDate and @EndDate
	GROUP BY vpsid.PersonelID
	

	
	INSERT INTO #Item(
		PersonelID      ,
		VacancyNatureID ,
		FirstRemain     ,
		AssignableValue ,
		VacancyEdition  ,
		UsedVacancy     ,
		EndRemain		)
	SELECT vvc.PersonelID,
		   vvc.VacancyNatureID,
		   SUM(
			   CASE 
					WHEN vvc.[Date] < @StartDate
						 OR (
								vvc.[Document] = 'VacancyEstablishment'
								AND vvc.[Date] <= @EndDate
							) THEN vvc.AddedVacancy - vvc.DeductedVacancy
					   ELSE 0
				  END
		   )                       FirstRemain,
		   SUM(
			   CASE 
					WHEN vvc.[Document] = 'AssignableValue'
						 AND vvc.[Date] between @StartDate
						 AND @EndDate THEN vvc.AddedVacancy
						ELSE 0
				   END
		   )                    AssignableValue,
		   SUM(
			   CASE 
					WHEN vvc.[Document] = 'VacancyEdition'
						 AND vvc.[Date] between @StartDate
						 AND @EndDate THEN vvc.AddedVacancy - vvc.DeductedVacancy
						ELSE 0
				   END
		   )                    VacancyEdition,
				  SUM(
			   CASE 
					WHEN vvc.[Document] = 'LeaveRequest'
						 AND vvc.[Date] between @StartDate
						 AND @EndDate THEN vvc.DeductedVacancy
						ELSE 0
				   END
		   )                    UsedVacancy, 0 as EndRemain
	FROM   atn.vwVacancyCardex  AS vvc
	GROUP BY
		   vvc.PersonelID,
		   vvc.VacancyNatureID
		   OPTION(RECOMPILE)
		   print sysdatetime()
		   
	  UPDATE      #Item
	  set EndRemain = ISNULL(FirstRemain,0) + ISNULL(AssignableValue,0)+ISNULL(VacancyEdition,0)-ISNULL(UsedVacancy,0)
		   
		   
	 SELECT * into #vwCompanyAccess
	 FROM cfg.vwCompanyAccess AS vca     
		   
	
	SELECT *
	INTO   #vwPersonelLastAgreementInMonth
	FROM   hrm.vwPersonelLastAgreementInMonth AS vplaim
	WHERE  vplaim.CalendarMonthID = @ToMonth
		   OPTION(RECOMPILE)
		   
	SELECT * into #vwPersonel
	FROM hrm.vwPersonel AS vp
	
	
	SELECT * into #PersonelAccess
	FROM (
	SELECT PersonelID
	FROM   atn.vwPersonelManager AS vpm
	WHERE  @CurrentPersonelID  is null or vpm.ManagerID = @CurrentPersonelID
	GROUP BY    vpm.PersonelID
	UNION ALL
	SELECT @CurrentPersonelID) a
	GROUP BY PersonelID
		   
		   print sysdatetime()
	
	SELECT i.PersonelID,
	i.VacancyNatureID,
			p.PersonelCode ,
		   cc.Title                    CostCenter1,
		   cc.Title2                   CostCenter2,
		   wp.Title                    WorkPlace1,
		   wp.Title2                   WorkPlace2,
		   et.Title                    EmploymentType1,
		   et.Title2                   EmploymentType2,
		   vn.Title                    VacancyNature1,
		   vn.Title2                   VacancyNature2,
		   p.FullName1,
		   p.FullName2,
		  cfg.ConvertToHourMinute( i.FirstRemain) FirstRemain,
		   cfg.ConvertToHourMinute (i.AssignableValue) AssignableValue,
		  cfg.ConvertToHourMinute( i.VacancyEdition) VacancyEdition,
		   cfg.ConvertToHourMinute (i.UsedVacancy) UsedVacancy ,
		   cfg.ConvertToHourMinute (i.EndRemain) EndRemain
	FROM   #Item                    AS i
		   JOIN #vwPersonelLastAgreementInMonth AS vplaim
				ON  vplaim.PersonelID = i.PersonelID
		   JOIN cfg.CostCenter      AS cc
				ON  cc.CostCenterID = vplaim.CostCenterID
		   JOIN hrm.WorkPlace       AS wp
				ON  vplaim.WorkPlaceID = wp.WorkPlaceID
		   JOIN hrm.EmploymentType  AS et
				ON  vplaim.EmploymentTypeID = et.EmploymentTypeID
		   JOIN atn.VacancyNature   AS vn
				ON  i.VacancyNatureID = vn.VacancyNatureID
		   JOIN #vwPersonel        AS p
				ON  I.PersonelID = p.PersonelID
			join #ActivePersonel ap on p.PersonelID = ap.PersonelID	
		   join #vwCompanyAccess vca on p.CompanyID = vca.CompanyID
		   left join #PersonelAccess AS pa on p.PersonelID = pa.PersonelID
	WHERE @Source = 1 or pa.PersonelID is NOT NULL
END;
