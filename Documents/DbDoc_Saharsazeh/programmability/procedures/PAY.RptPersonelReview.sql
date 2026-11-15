
CREATE   PROCEDURE [PAY].[RptPersonelReview]
(
    @FromCalendarMonthId     INT,
    @ToCalendarMonthId       INT,
    @CalcTypeID              VARCHAR(128) = '1',
    @SelectedParameter       VARCHAR(MAX) = NULL
)

--WITH ENCRYPTION
AS
	DECLARE @StartDate     DATE,
	        @EndDate       DATE
	
		DECLARE @Culture varchar(25),
		@CultureNo tinyint

	set @Culture = CFG.GetuserCulture() 

	select @CultureNo = CultureNo
	from CFG.CultureInfo 
	where Culture = @Culture
	
	SELECT rfcst.[value] AS CalcTypeId INTO #calcTypes FROM cfg.R_FnCommaStr2Table(@CalcTypeID) AS rfcst
	
	SELECT @StartDate = cm.StartDate
	FROM   HRM.CalendarMonth cm
	WHERE  cm.CalendarMonthID = @FromCalendarMonthId
	
	SELECT @EndDate = cm.EndDate
	FROM   HRM.CalendarMonth cm
	WHERE  cm.CalendarMonthID = @ToCalendarMonthId
	
	
	SELECT cm.CalendarMonthID
	INTO                         #CalcMonth
	FROM   hrm.CalendarMonth     cm
	WHERE  cm.StartDate >= @StartDate
	       AND cm.StartDate < @EndDate
	
	
	CREATE TABLE #SElPersonel
	(
		PersonelID INT
	)
	
	IF @SelectedParameter IS NULL
	    INSERT INTO #SElPersonel
	    SELECT DISTINCT cp.PersonelID
	    FROM   pay.CalculationPersonel cp
	   
	           INNER JOIN #CalcMonth
	                ON  #CalcMonth.CalendarMonthID = cp.CalendarMonthID
	    WHERE  (cp.CalculationTypeID IN (SELECT CalcTypeId FROM #calcTypes ))
	ELSE
	    INSERT INTO #SElPersonel
	    SELECT DISTINCT cr.PersonelID
	    FROM   pay.CalculationResult cr
	           INNER JOIN PAY.CalculationPersonel AS cp
	                ON  cp.CalculationPersonelID = cr.CalculationPersonelID
	           INNER JOIN #CalcMonth
	                ON  #CalcMonth.CalendarMonthID = cp.CalendarMonthID
	    WHERE  (cp.CalculationTypeID IN (SELECT CalcTypeId FROM #calcTypes ))
	           AND cr.[Value] <> 0
	           AND (
	                   @SelectedParameter IS NULL
	                   OR cr.ParameterID IN (SELECT VALUE
	                                         FROM   cfg.R_FnCommaStr2Table(@SelectedParameter) 
	                                                rfcst)
	               )
	
	
	CREATE TABLE #ValidPersonel
	(
		PersonelID INT
	)
	
	
	INSERT INTO #ValidPersonel
	EXEC Hrm.GetValidPersonelWithBranchAccess @EndDate
	
	DELETE #SElPersonel
	WHERE  PersonelID NOT IN (SELECT personelId
	                          FROM   #ValidPersonel)
	
	
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
        WHERE cm.EndDate <=  @EndDate
    ) T
    WHERE T.Rno = 1;

	
	
	SELECT T.PersonelID,
	       T.EmploymentTypeID,
	       T.EmploymentType,
	       CostCenter,
	       WorkPlace,
	       JobTitle,
	       BranchCode,
	       BranchTitle
	INTO         #validAgg
	FROM   (
	           SELECT a.*,
	                  case when @CultureNo = 1 then et.Title  else et.Title2 end  AS EmploymentType,
	                  case when @CultureNo = 1 then cc.Title  else cc.Title2 end  AS CostCenter,
	                  case when @CultureNo = 1 then wp.Title  else wp.Title2 end    AS WorkPlace,
	                  case when @CultureNo = 1 then j.Title  else j.Title2 end    AS Jobtitle,
	                  b.Code    AS BranchCode,
	                  case when @CultureNo = 1 then b.Title  else b.Title2 end    AS BranchTitle,
	                  ROW_NUMBER() OVER(PARTITION BY a.PersonelID ORDER BY a.IssueDate DESC) AS 
	                  Rno
	           FROM   hrm.Agreement a
	                  INNER JOIN #SElPersonel
	                       ON  a.PersonelID = #SElPersonel.PersonelID
	                  INNER JOIN hrm.EmploymentType et
	                       ON  et.EmploymentTypeID = a.EmploymentTypeID
	                  INNER JOIN cfg.CostCenter cc
	                       ON  cc.CostCenterID = a.CostCenterID
	                  INNER JOIN hrm.WorkPlace wp
	                       ON  wp.WorkPlaceID = a.WorkPlaceID
	                  INNER JOIN cfg.Branch AS b
	                       ON  b.BranchID = a.BranchID
	                  LEFT JOIN HRM.[Job] AS j
	                       ON  j.JobID = a.JobID
	           WHERE  a.IssueDate <= @EndDate
	               
	       )     T
	WHERE  Rno = 1
	
	
	SELECT p.PersonelID,
	       p.Code    AS PersonelCode,
	       case when @CultureNo = 1 then p2.Title  else p2.Title2 end    AS PersonelName,
	       case when @CultureNo = 1 then p2.LastName  else p2.LastName2 end  LastName,
	       a.WorkPlace,
	       a.CostCenter,
	       a.JobTitle,
	          BranchCode,
	       BranchTitle,
	       a.EmploymentType,
           CASE @cultureNo
               WHEN 2 THEN
                   pag.Title2
               ELSE
                   pag.Title
           END AS AccGroupTitle
	FROM   Hrm.Personel p
	       INNER JOIN #validAgg a
	            ON  a.PersonelID = p.PersonelID
	       INNER JOIN Hrm.EmploymentType et
	            ON  et.EmploymentTypeID = a.EmploymentTypeID
	       INNER JOIN CFG.Party p2
	            ON  p2.PartyID = p.PartyID
			LEFT JOIN #lastVoucherSetting AS pvs
				ON pvs.PersonelID = p.PersonelID
			LEFT JOIN PAY.PayrollAccGroup AS pag
				ON pag.PayrollAccGroupID = pvs.PayrollAccGroupID
