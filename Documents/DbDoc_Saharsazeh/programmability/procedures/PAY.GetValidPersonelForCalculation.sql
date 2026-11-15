               
CREATE   PROCEDURE [PAY].GetValidPersonelForCalculation
(
	@CalendarMonthId      INT,
	@CalcTypeId           INT = NULL,
	@selectedPersonel     VARCHAR(MAX) = NULL,
	@IsForTest            BIT = 0
)

--WITH ENCRYPTION
AS

BEGIN
	DECLARE @calculationDate DATE,
		@calculationStartDate DATE,
		@CultureNo TINYINT,
		@userId INT

	SELECT @CultureNo = ISNULL(CultureNo, 1)
	FROM   CFG.CultureInfo
	WHERE  Culture = CFG.GetuserCulture() 
	
	SET @userId = Cfg.GetuserID()

	---------- Start set localized enum string for Salary Calculation Status ----------
	DECLARE 
		@SalaryCalculationStatus_CalculatedAndNeedToApportion NVARCHAR(MAX),
		@SalaryCalculationStatus_Calculated NVARCHAR(MAX),
		@SalaryCalculationStatus_Apportioned NVARCHAR(MAX),
		@Culture VARCHAR(25);
	
	SET @Culture = CFG.GetuserCulture();

	SELECT @SalaryCalculationStatus_CalculatedAndNeedToApportion = lev.[Value]
	FROM cfg.LocalizeEnum le
	JOIN cfg.LocalizeEnumValue lev 
		ON lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE le.Enum = 'SalaryCalculationStatus' AND le.Item = 'CalculatedAndNeedToApportion' AND lev.Culture = @Culture
	
	SELECT @SalaryCalculationStatus_Calculated = lev.[Value]
		FROM cfg.LocalizeEnum le
		JOIN cfg.LocalizeEnumValue lev 
			ON lev.LocalizeEnumID = le.LocalizeEnumID
		WHERE le.Enum = 'SalaryCalculationStatus' AND le.Item = 'Calculated' AND lev.Culture = @Culture
	
	SELECT @SalaryCalculationStatus_Apportioned = lev.[Value]
		FROM cfg.LocalizeEnum le
		JOIN cfg.LocalizeEnumValue lev 
			ON lev.LocalizeEnumID = le.LocalizeEnumID
		WHERE le.Enum = 'SalaryCalculationStatus' AND le.Item = 'Apportioned' AND lev.Culture = @Culture
	---------- End set localized enum string for Salary Calculation Status ----------
	
	SELECT VALUE
	INTO   #SelPersonel
	FROM   cfg.R_FnCommaStr2Table(@selectedPersonel) rfcst
	
	DECLARE @NeedConfirm BIT
	
	SELECT @NeedConfirm = ConfigValue
	FROM   cfg.Configuration c
	WHERE  c.ConfigKey = 'AgreementNeedConfirm'
	
	
	SELECT @calculationDate = cm.EndDate,
		   @calculationStartDate     = cm.StartDate
	FROM   Hrm.CalendarMonth cm
	WHERE  cm.CalendarMonthID = @CalendarMonthId
	
	
	DECLARE @KhalesID INT
	
	SELECT @KhalesID = p.ParameterID
	FROM   pay.Parameter p
	WHERE  p.SystemName = 'Khales'
		   AND p.CalculationTypeID = @CalcTypeId
	
	
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
					  AND (
							  @selectedPersonel IS NULL
							  OR a.PersonelID IN (SELECT VALUE
												  FROM   #SelPersonel)
						  )
		   ) T
	WHERE  T.Rno = 1

	
	
	DECLARE @DateType       INT,
			@DATEFORMAT     VARCHAR(50)
	
	
	SELECT @DateType = us.SettingValue
	FROM   cfg.UserSetting us
	WHERE  us.SettingKey = 'Date_Type'
		   AND us.UserID = @userId
	
	IF @DateType IS NULL
		SET @DateType = CASE cfg.GetuserCulture()
							 WHEN 'fa' THEN 0
							 WHEN 'en' THEN 1
							 WHEN 'ar' THEN 2
						END
	
	SELECT @DateFormat = us.SettingValue
	FROM   cfg.UserSetting us
	WHERE  us.SettingKey = 'Date_Format'
		   AND us.UserID = @userId
	
	IF @DateFormat IS NULL
		SET @DATEFORMAT = 'YY/MM/DD'  
	
	
	
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
					  AND cps.[STATUS] IN(0,5)
			   GROUP BY
					  cps.PersonelID
		   )T1
	
	
	SELECT cp.PersonelID,
		   cp.FishVisibility,
		   v.Number
	INTO #T2
	FROM pay.CalculationPersonel cp
	LEFT JOIN ACC.Voucher v
		ON v.VoucherID = cp.VoucherID
	WHERE cp.CalendarMonthID = @CalendarMonthId
		  AND cp.CalculationTypeID = @CalcTypeId
			
			
	SELECT cp.PersonelID,
		   cr.[Value],
		   cp.FishVisibility,
		   cp.CalculationPersonelID
	INTO #T3
	FROM pay.CalculationPersonel cp
	INNER JOIN pay.CalculationResult cr
		ON cp.CalculationPersonelID = cr.CalculationPersonelID
	WHERE cp.CalendarMonthID = @CalendarMonthId
		  AND cp.CalculationTypeID = @CalcTypeId
		  AND cr.ParameterValueTypeID = 7
		  AND ((cr.ParameterID = @KhalesID))	   

	---------- Temp Tabloe for Apportioned Items ----------
	SELECT cp.PersonelID
	INTO #T4
	FROM PAY.TimeSheetCalculationPersonel AS tscp
	JOIN pay.CalculationPersonel AS cp ON cp.CalculationPersonelID = tscp.CalculationPersonelID
	WHERE cp.CalculationTypeID = @CalcTypeId and  cp.CalendarMonthID = @CalendarMonthId
	
	
	-------get Personel Last PayrollAccGroup
	
   SELECT		 pvs.PersonelID,
				 pag.Title,
				 pag.IsShareable, 
				 pag.PayrollAccGroupID,
				 pag.Title2,
				 ROW_NUMBER() OVER(PARTITION BY pvs.PersonelID ORDER BY cm.EndDate  DESC) AS RowNumber
		 INTO #LastPayrollAccGroup
			  FROM [PAY].[PayrollAccGroup] pag
			  JOIN PAY.PersonelVoucherSetting pvs on pag.PayrollAccGroupID = pvs.PayrollAccGroupID
			  JOIN hrm.CalendarMonth AS cm ON cm.CalendarMonthID = pvs.CalendarMonthID
			  WHERE cm.EndDate<=@calculationDate
	
	-----getData
	
	IF @IsForTest = 1
	BEGIN
		SELECT p.PersonelID
		FROM hrm.Personel p
		INNER JOIN #lastAggreement
			ON  #lastAggreement.PersonelId = p.PersonelID
		INNER JOIN hrm.EmploymentType et
			ON  et.EmploymentTypeID = #lastAggreement.EmploymentTypeID
		LEFT JOIN cfg.Branch AS b
			ON  b.BranchID = #lastAggreement.BranchID
		LEFT JOIN #TT1 T
			ON  T.PersonelID = p.PersonelID
		LEFT JOIN #TT2 TEnd
			ON  TEnd.PersonelID = p.PersonelID
		LEFT JOIN #TInside TInside
			ON  TInside.PersonelID = p.PersonelID
		LEFT JOIN #T2 T2
			ON  t2.PersonelID = p.PersonelID
		LEFT JOIN #T3 T3
			ON  t3.PersonelID = p.PersonelID
		INNER JOIN cfg.CostCenter cc
			ON  cc.CostCenterID = #lastAggreement.CostCenterID
		INNER JOIN hrm.WorkPlace wp
			ON  wp.WorkPlaceID = #lastAggreement.WorkPlaceID
		INNER JOIN Cfg.Party p2
			ON  p2.PartyID = p.PartyID
		INNER JOIN cfg.vwBranchAccess AS vba 
			ON #lastAggreement.BranchId=vba.BranchID
		WHERE  (TEnd.[Status] IN( 0,5) OR T.[Status] IN (0,5) OR Tinside.cnt <> 0)
	END
	ELSE		
	BEGIN
	   SELECT 
			   p.PersonelID,
			   p.Code,
			   CASE @CultureNo
						WHEN 1 THEN p2.Title + ' ' + p2.LastName
						WHEN 2 THEN p2.Title2 + ' ' + p2.LastName2
			   END AS Title,
			   p.FatherName,
			   CASE @CultureNo
						WHEN 1 THEN et.Title
						WHEN 2 THEN et.Title2
			   END AS EmploymentTypeTitle,
			   T3.[Value] AS Khales,
			   ISNULL(T3.FishVisibility,T2.FishVisibility) AS FishVisibility,
			   CASE @CultureNo
						WHEN 1 THEN cc.Title
						WHEN 2 THEN cc.Title2
			   END AS CostCenterTitle,			   
			   CASE @CultureNo
						WHEN 1 THEN wp.Title
						WHEN 2 THEN wp.Title2
			   END as WpTitle,
			   b.Code AS BranchCode,
			   CASE @CultureNo
						WHEN 1 THEN b.Title
						WHEN 2 THEN b.Title2
			   END as BranchTitle,
			   T2.Number AS VoucherNumer,
			   pvs.PayrollAccGroupID AS PayrollAccountGroupId,
			   CASE @CultureNo
						WHEN 1 THEN pvs.Title
						WHEN 2 THEN pvs.Title2
			   END as PayrollAccountGroupTitle,
			   CAST(CASE WHEN T2.PersonelID IS NULL THEN 0 ELSE 1 END AS BIT) AS IsCalc,
			   CASE
				   WHEN T2.PersonelID IS NULL
							THEN ''
				   WHEN pvs.PayrollAccGroupID IS NOT NULL
						AND pvs.IsShareable = 1
						AND T4.PersonelID IS NULL
							THEN @SalaryCalculationStatus_CalculatedAndNeedToApportion
				   WHEN pvs.IsShareable IS NULL OR pvs.IsShareable = 0
							THEN @SalaryCalculationStatus_Calculated
				   WHEN pvs.PayrollAccGroupID IS NOT NULL
						AND pvs.IsShareable = 1
						AND T4.PersonelID IS NOT NULL
							THEN @SalaryCalculationStatus_Apportioned
			   END AS [StatusStr],
			   CASE
				   WHEN T2.PersonelID IS NULL
							THEN 0
				   WHEN pvs.PayrollAccGroupID IS NOT NULL
						AND pvs.IsShareable = 1
						AND T4.PersonelID IS NULL
							THEN 1
				   WHEN pvs.IsShareable IS NULL OR pvs.IsShareable = 0
							THEN 2
				   WHEN pvs.PayrollAccGroupID IS NOT NULL
						AND pvs.IsShareable = 1
						AND T4.PersonelID IS NOT NULL
							THEN 3
			   END AS [Status],
			   T3.CalculationPersonelID
		FROM hrm.Personel p
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
		LEFT JOIN #T3 T3
			ON  t3.PersonelID = p.PersonelID
		LEFT JOIN #T4 T4
			ON T4.PersonelID = p.PersonelID
		INNER JOIN cfg.CostCenter cc
			ON  cc.CostCenterID = #lastAggreement.CostCenterID
		INNER JOIN hrm.WorkPlace wp
			ON  wp.WorkPlaceID = #lastAggreement.WorkPlaceID
		INNER JOIN Cfg.Party p2
			ON  p2.PartyID = p.PartyID
		INNER JOIN cfg.vwBranchAccess AS vba 
			ON #lastAggreement.BranchId=vba.BranchID
		LEFT JOIN #LastPayrollAccGroup pvs ON p.PersonelID = pvs.PersonelID AND pvs.RowNumber = 1 
		WHERE  (TEnd.[Status] IN( 0,5) OR T.[Status] IN (0,5) OR Tinside.cnt <> 0)
		ORDER BY p.Code
	END
END;
