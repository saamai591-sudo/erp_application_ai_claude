
--------------------------------------
CREATE   PROCEDURE ATN.spGetPersonnelForAttendanceCalculation
(
	@CalendarMonthId int,
	@calculationDate Date = NULL
)
--WITH ENCRYPTION
AS
	DECLARE @calculationStartDate     DATE,
	        @calcYear                 INT,
	        @userId                   INT
	
	
	SET @userId = Cfg.GetuserID()
	
	DECLARE @NeedConfirm BIT
	
	SELECT @NeedConfirm = ConfigValue
	FROM   cfg.Configuration c
	WHERE  c.ConfigKey = 'AgreementNeedConfirm'
	
	IF(@calculationDate <> NULL)
	BEGIN
		SELECT @calculationStartDate = cm.AttendanceStartDate
		FROM   Hrm.CalendarMonth cm
		WHERE  cm.CalendarMonthID = @CalendarMonthId
	END
	ELSE
	BEGIN
		SELECT @calculationDate = cm.AttendanceEndDate, @calculationStartDate = cm.AttendanceStartDate
		FROM   Hrm.CalendarMonth cm
		WHERE  cm.CalendarMonthID = @CalendarMonthId
	END
	
	SELECT ROW_NUMBER() OVER (PARTITION BY psai.PersonelID ORDER BY psai.[Date] desc) rno,psai.PersonelID
	INTO #PersonelShiftAssignment
	FROM atn.PersonnelShiftAssignmentItem AS psai
	WHERE psai.[Date]<=@calculationDate
	
	SELECT PersonelID,
	       T.AgreementID,
	       T.ExecuteDate,
	       T.WorkPlaceID,
	       T.BranchID,
	       T.EmploymentTypeID,
	       T.CostCenterID,
	       T.AgreementTypeID,
	       T.[ExpireDate]
	INTO   #lastAggreement
	FROM   (
	           SELECT *,
	                  ROW_NUMBER() OVER(PARTITION BY a.PersonelID ORDER BY a.IssueDate DESC) AS Rno
	           FROM   HRM.Agreement a
	           WHERE  a.ExecuteDate <= @calculationDate
	                  AND (
	                          @NeedConfirm = 0
	                          OR (
	                                 a.ConfirmDate IS NOT NULL
	                                 AND a.ConfirmDate <= @calculationDate
	                             )
	                      )
	                  
	                  AND a.IssueDate <= @calculationDate
	                 
	       ) T
	WHERE  T.Rno = 1
	AND (
	                          T.[ExpireDate] IS NULL
	                          OR T.[ExpireDate] > @calculationStartDate
	                      )
	
	DECLARE @DateType       INT,
	        @DATEFORMAT     VARCHAR(50)
	
	
	SELECT @DateType = us.SettingValue
	FROM   cfg.UserSetting us
	WHERE  us.SettingKey = 'Date_Type'
	       AND us.UserID = cfg.GetuserID()
	
	IF @DateType IS NULL
	    SET @DateType = CASE cfg.GetuserCulture()
	                         WHEN 'fa' THEN 0
	                         WHEN 'en' THEN 1
	                         WHEN 'ar' THEN 2
	                    END
	
	SELECT @DateFormat = us.SettingValue
	FROM   cfg.UserSetting us
	WHERE  us.SettingKey = 'Date_Format'
	       AND us.UserID = cfg.GetuserID()
	
	IF @DateFormat IS NULL
	    SET @DATEFORMAT = 'YY/MM/DD'  
	    
	    		    
	  SELECT * INTO #vwBranchAccess
	  FROM cfg.vwBranchAccess AS vba

	
	
	
	SELECT *
	INTO   #TT1
	FROM   (
	           SELECT *,
	                  ROW_NUMBER() OVER(PARTITION BY cps.PersonelID ORDER BY cps.IssueDate DESC) AS Rno
	           FROM   hrm.ChangePersonelStatus cps
	           WHERE  cps.ChangeDate <= @calculationStartDate
	                  AND cps.IssueDate <= @calculationDate
	       )T1
	WHERE  Rno = 1
	
	SELECT *
	INTO   #TT2
	FROM   (
	           SELECT *,
	                  ROW_NUMBER() OVER(PARTITION BY cps.PersonelID ORDER BY cps.IssueDate DESC) AS Rno
	           FROM   hrm.ChangePersonelStatus cps
	           WHERE  cps.ChangeDate <= @calculationDate
	                  AND cps.IssueDate <= @calculationDate
	       )T1
	WHERE  Rno = 1
	
	SELECT *
	INTO   #TInside
	FROM   (
	           SELECT cps.PersonelID,
	                  COUNT(*) AS cnt
	           FROM   hrm.ChangePersonelStatus cps
	           WHERE  cps.ChangeDate <= @calculationDate
	                  AND cps.ChangeDate >= @calculationStartDate
	                  AND cps.IssueDate <= @calculationDate
	                  AND cps.[STATUS] = 5
	           GROUP BY
	                  cps.PersonelID
	       )T1
	
	
	SELECT cp.PersonelID,
	        cp.CalculationDate
			INTO #T2
	FROM    ATN.AttendanceCalculationPersonnel AS  cp
	WHERE  cp.CalendarMonthID = @CalendarMonthId
	        

	    SELECT p.PersonelID,
	           p.Code,
	           p2.Title              AS FirstName,
	           p2.LastName,
	           p.FatherName,
	           et.Title              AS EmploymentTypeTitle,
	           CAST(CASE WHEN T2.PersonelID IS NULL THEN 0 ELSE 1 END AS BIT) AS IsCalc,
	           cfg.GetCLRSaturnDate(
	               #lastAggreement.ExecuteDate,
	               UPPER(@DateFormat),
	               0,
	               @DateType
	           )                     AS AggregateDate,
	           cfg.GetCLRSaturnDate(T2.CalculationDate, UPPER(@DateFormat), 1, @DateType) AS CalculationDate,
	           cc.Title              AS CostCenterTitle,
	           wp.Title              AS WpTitle,
	           b.Code                AS BranchCode,
	           b.Title               AS BranchTitle
	    FROM   hrm.Personel p
	    INNER JOIN #PersonelShiftAssignment psa ON p.PersonelID = psa.PersonelID	
	     INNER JOIN #lastAggreement
	                ON  #lastAggreement.PersonelId = p.PersonelID
	           INNER JOIN hrm.EmploymentType et
	                ON  et.EmploymentTypeID = #lastAggreement.EmploymentTypeID
	           LEFT JOIN cfg.Branch  AS b
	                ON  b.BranchID = #lastAggreement.BranchID
	           LEFT JOIN #TT1 T
	                ON  T.PersonelID = p.PersonelID
	           LEFT JOIN #TT2 TEnd
	                ON  TEnd.PersonelID = p.PersonelID
	           LEFT JOIN #TInside TInside
	                ON  TInside.PersonelID = p.PersonelID
	           LEFT JOIN #T2 T2
	                ON  t2.PersonelID = p.PersonelID	         
	           INNER JOIN cfg.CostCenter cc
	                ON  cc.CostCenterID = #lastAggreement.CostCenterID
	           INNER JOIN hrm.WorkPlace wp
	                ON  wp.WorkPlaceID = #lastAggreement.WorkPlaceID
	           INNER JOIN Cfg.Party p2
	                ON  p2.PartyID = p.PartyID
	                INNER JOIN #vwBranchAccess AS vba ON #lastAggreement.BranchId=vba.BranchID
	    WHERE psa.rno = 1 AND   (TEnd.[Status] = 5 OR T.[Status] = 5 OR Tinside.cnt <> 0)
	    ORDER BY p.Code;
