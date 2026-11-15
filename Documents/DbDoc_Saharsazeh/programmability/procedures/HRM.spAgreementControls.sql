
CREATE    PROC hrm.spAgreementControls
(	
	@AgreementID INT = NULL,
	@Type INT,
	@BranchID INT,
	@IssueDate DATE,
	@ExecuteDate DATE,
	@PersonelID INT,
	@AgreementTypeID INT,
	@ConfirmDate DATE = NULL) ---@Type: 1 Insert  2 Update 3 Delete
AS

DECLARE @NeedConfirm								BIT ,
		@AggTypeNeedConfirm							BIT,
		@IssueDateMonthID							INT,
		@EstablishmentCalendarMonthID				INT,
		@LastExecuteDate							DATE,
		@IssueDateMonthStartDate					DateTime,
		@ExecuteDateMonthStartDate					DATETIME,
		@IsRecalcable								BIT,
		@UserID										INT

SELECT  @NeedConfirm = ConfigValue
FROM    CFG.Configuration c
WHERE   c.ConfigKey = 'AgreementNeedConfirm';


SELECT @AggTypeNeedConfirm = at.NeedConfirmation
FROM   hrm.AgreementType AS at
WHERE  at.AgreementTypeID = @AgreementTypeID;

SELECT @IssueDateMonthID = cm.CalendarMonthID,@IssueDateMonthStartDate=cm.StartDate
FROM   hrm.CalendarMonth cm
WHERE  @IssueDate BETWEEN cm.StartDate AND cm.EndDate;

		
	   
SELECT @EstablishmentCalendarMonthID = con.ConfigValue
FROM   cfg.Configuration con
WHERE  con.ConfigKey = 'CalendarMonth';  


SELECT @IssueDateMonthID = cm.CalendarMonthID,
		@IssueDateMonthStartDate=cm.StartDate
FROM   hrm.CalendarMonth cm
WHERE  @IssueDate BETWEEN cm.StartDate AND cm.EndDate


SELECT @ExecuteDateMonthStartDate=cm.StartDate
FROM   hrm.CalendarMonth cm
WHERE @ExecuteDate BETWEEN cm.StartDate AND cm.EndDate;


SELECT @IssueDateMonthID = cm.CalendarMonthID,@IssueDateMonthStartDate=cm.StartDate
FROM   hrm.CalendarMonth cm
WHERE  @IssueDate BETWEEN cm.StartDate AND cm.EndDate;


select @IsRecalcable=LicenceValue from CFG.LicenceInfo
where LicenceKey='ReCalcable';

SET @UserID = cfg.GetuserID()

--Control 1

IF @Type IN (1, 2,3)
BEGIN
	SET @UserID = cfg.GetuserID()
	
	IF @UserID <> -1
	   AND NOT EXISTS (
			   SELECT 1
			   FROM   cfg.vwBranchAccess AS vba
			   WHERE  vba.BranchID = @BranchID
		   )
	BEGIN
		RAISERROR('شما به شعبه مورد نظر دسترسي نداريد.', 16, 12)
		RETURN;
	END
END;

---Control 2

IF @Type IN (1, 2)
BEGIN
	IF NOT EXISTS (
		   SELECT 1
		   FROM   hrm.CalendarMonth AS cm
		   WHERE  @IssueDate BETWEEN cm.StartDate AND cm.EndDate
	   )
	BEGIN
		RAISERROR('در تاریخ مورد نظر شما تقویم کاری تعریف نشده است.', 16, 12)
		RETURN;
	END
END;

-- Control 3

IF @Type IN (1, 2)
BEGIN
	IF NOT EXISTS (
		   SELECT 1
		   FROM   hrm.CalendarMonth AS cm
		   WHERE  @executeDate BETWEEN cm.StartDate AND cm.EndDate
	   )
	BEGIN
		RAISERROR(
			'در تاریخ اجرای تعریف شده، تقویم کاری تعریف نشده است.',
			16,
			12
		)
		RETURN;
	END
END

-- Control 4

IF @Type IN (1, 2)
BEGIN		
IF (
	   SELECT ca.startdate
	   FROM   hrm.CalendarMonth ca
	   WHERE  ca.CalendarMonthID = @EstablishmentCalendarMonthID
   ) > @IssueDate
   OR (
		  SELECT ca.startdate
		  FROM   hrm.CalendarMonth ca
		  WHERE  ca.CalendarMonthID = @EstablishmentCalendarMonthID
	  ) > @ExecuteDate
BEGIN
	RAISERROR(
		'به قبل از تاريخ استقرار نمي توان قراردادي صادر يا اجرا نمود.',
		16,
		12
	)
	RETURN;
END
END

-- Control 5

IF @Type IN (1,2)
BEGIN
	
if @ExecuteDateMonthStartDate<@IssueDateMonthStartDate
AND @IsRecalcable=0
begin
 RAISERROR(
		'امکان ثبت قرارداد به صورت معوقه نمی باشد.',
		16,
		12
	)
	RETURN;
END
END

-- Control 6

IF @Type IN (1,2,3)
BEGIN
	
IF (@NeedConfirm = 0 OR @AggTypeNeedConfirm = 0)
   AND EXISTS(
		   SELECT cp.CalculationPersonelID
		   FROM   PAY.CalculationPersonel cp
				  INNER JOIN PAY.CalculationType ct
					   ON  ct.CalculationTypeID = cp.CalculationTypeID
		   WHERE  ct.PayTimeType = 0
				  AND cp.PersonelID = @PersonelID
				  AND cp.CalendarMonthID = @IssueDateMonthID
	   )
BEGIN
	RAISERROR(
		'براي شخص مورد نظر در ماه انتخاب شده محاسبه انجام شده است.',
		16,
		12
	)
	RETURN;
END
	
END	

-- Control 7
	
  IF @Type IN (1,2,3)
  BEGIN
		  
IF EXISTS (
	   SELECT 1
	   FROM   hrm.Agreement AS a
	   WHERE  (
				  (
					  a.IssueDate >= @IssueDate
					  AND @Type IN (1, 2)
					  AND (@AgreementID IS NULL OR a.AgreementID <> @AgreementID)
				  )
				  OR (a.IssueDate > @IssueDate AND @Type = 3)
			  )
			  AND a.PersonelID = @PersonelID
   )
	   BEGIN
		

	RAISERROR(
		'براي شخص مورد نظر در تاريخ بزرگتر يا برابر تاريخ صدور انتخاب شده،  قرارداد صادر شده است.',
		16,
		12
	)
	RETURN
	   END
	   END;

  -- Control 8

IF @Type IN (1,2)
BEGIN
	
SELECT TOP 1 @LastExecuteDate = ExecuteDate
FROM   HRM.Agreement
WHERE  AgreementTypeID     = 0
	   AND PersonelID      = @PersonelID
	   and AgreementID <> @AgreementID
ORDER BY
	   ExecuteDate DESC

IF @LastExecuteDate IS NOT NULL
   AND @IssueDate < @LastExecuteDate
BEGIN
	RAISERROR(
		'تاريخ صدور نمي تواند کوچکتر از تاريخ اجراي آخرين قرارداد استخدام فرد باشد.',
		16,
		12
	)
	RETURN;
END
END
	
	-------------validate AgreementType 

-- Control 9
IF @Type IN (1,2)
BEGIN
	
SELECT ps.StatusType
INTO   #ValidTypes
FROM   hrm.AgreementTypePrePersonelStatus AS atpps
	   INNER JOIN HRM.PersonelStatus AS ps
			ON  ps.PersonelStatusID = atpps.PersonelStatusID
WHERE  atpps.AgreementTypeID = @AgreementTypeID
	
IF NOT EXISTS (
	   SELECT 1
	   FROM   (
				  SELECT p.PersonelID,
						 [Status],
						 p.Code,
						 p.PartyID
				  FROM   hrm.Personel AS p
						 LEFT JOIN (
								  SELECT hrm.ChangePersonelStatus.PersonelID,
										 hrm.ChangePersonelStatus.[Status],
										 ROW_NUMBER() OVER(PARTITION BY PersonelID ORDER BY IssueDate DESC) AS Rno
								  FROM   hrm.ChangePersonelStatus
								  WHERE  PersonelID = @PersonelID
										 AND ((@Type = 1 AND  ChangeDate <= @ExecuteDate  ) OR (@Type = 2 AND AgreementID <> @AgreementID AND ChangeDate <= @ExecuteDate ))
							  )T
							  ON  p.PersonelID = T.PersonelID
				  WHERE  ISNULL(Rno, 1) = 1
			  )C
			  INNER JOIN #ValidTypes
				   ON  #ValidTypes.StatusType = ISNULL(c.Status, 100)
   )
BEGIN
	RAISERROR(
		'با توجه به وضعيت شخص نوع حکم انتخاب شده معتبر نمي باشد.',
		16,
		12
	)
	RETURN;
END	  
END    
	
DECLARE @issueStart     DATE,
		@execStart      DATE
	
SELECT @issueStart = cm.StartDate
FROM   hrm.CalendarMonth AS cm
WHERE  @IssueDate BETWEEN cm.StartDate AND cm.EndDate
	
	
SELECT @execStart = cm.StartDate
FROM   hrm.CalendarMonth AS cm
WHERE  @ExecuteDate BETWEEN cm.StartDate AND cm.EndDate
	

DECLARE @oldStatus INT
SELECT TOP 1 @oldStatus = [Status]
FROM   hrm.ChangePersonelStatus AS cps
WHERE  cps.PersonelID = @PersonelID
	   AND cps.ChangeDate <= @ExecuteDate
	   and cps.AgreementID <> @AgreementID
ORDER BY
	   cps.IssueDate DESC
		   
DECLARE @newStatus INT
SELECT @newStatus = ps.StatusType
FROM   hrm.AgreementType              AS at
	   INNER JOIN HRM.PersonelStatus  AS ps
			ON  ps.PersonelStatusID = at.PrePersonelStatusID
WHERE  at.AgreementTypeID = @AgreementTypeID  
		
-- Control 10	
IF @Type IN (1,2)
begin
IF @execStart < @issueStart
BEGIN
	IF @newStatus <> ISNULL(@oldStatus, 100)
	   AND NOT(@oldStatus IS NULL OR @oldStatus = 3 OR @oldStatus =6)
	BEGIN
		RAISERROR('امکان صدور اين نوع حکم به صورت معوقه نمي باشد.', 16, 12)
		RETURN;
	END
END
END

DECLARE @ChangeBranchNeedLeavingWork VARCHAR(10)

SELECT @ChangeBranchNeedLeavingWork=ConfigValue
FROM cfg.Configuration AS c
WHERE c.ConfigKey='ChangeBranchNeedLeavingWork'

--Control 11
IF @Type IN (2)
begin
IF @ChangeBranchNeedLeavingWork<>'false'
AND
 @oldStatus <> 3
   AND @oldStatus <> 100
BEGIN	
	DECLARE @OldBranchId INT
	
	SELECT TOP 1 @OldBranchId = BranchID
	FROM   hrm.Agreement AS a
	WHERE  a.PersonelID = @PersonelID
		   AND a.IssueDate < @IssueDate
	ORDER BY
		   a.IssueDate DESC
	
	IF @OldBranchId <> @BranchID
	BEGIN
		RAISERROR('امکان تغيير شعبه در اين قرارداد نمي باشد.', 16, 12)
		RETURN;
	END
END
END		

DECLARE @ISEmplymentType     BIT,
		@IsEndType           BIT
 
SET @ISEmplymentType = 0
SET @IsEndType = 0
 
SELECT @ISEmplymentType = vat.IsStart,
	   @IsEndType = vat.isEnd
FROM   hrm.vwAgreementType AS vat
WHERE  vat.AgreementTypeID = @AgreementTypeID
 

--Control 12
	
 --SATURNNEW-3978
 IF @Type IN (1,2)
BEGIN
	
IF @ISEmplymentType = 1
BEGIN
	IF EXISTS (
		   SELECT 1
		   FROM   hrm.Agreement AS a
				  INNER JOIN hrm.vwAgreementType AS vat
					   ON  vat.AgreementTypeID = a.AgreementTypeID
		   WHERE  a.PersonelID = @PersonelID
				  AND a.ExecuteDate = @ExecuteDate
				  AND vat.isEnd = 1
				  AND a.BranchID=@BranchID
	   )
	BEGIN
		RAISERROR(
			'تاریخ اجرای قرارداد استخدام و پایان خدمت نمی تواند در یک روز باشد.',
			16,
			12
		)
		RETURN;
		END
	END
END 

--Control 13
 
 IF @Type IN (1,2)
 BEGIN
	
IF @ISEndType = 1
BEGIN
	IF EXISTS (
		   SELECT 1
		   FROM   hrm.Agreement AS a
				  INNER JOIN hrm.vwAgreementType AS vat
					   ON  vat.AgreementTypeID = a.AgreementTypeID
		   WHERE  a.PersonelID = @PersonelID
				  AND a.ExecuteDate = @ExecuteDate
				  AND vat.IsStart = 1
	   )
	BEGIN
		RAISERROR(
			'تاریخ اجرای قرارداد استخدام و پایان خدمت نمی تواند در یک روز باشد.',
			16,
			12
		)
		RETURN;
	END
END 
 END
 
 
 --Control 14
 IF @Type IN (1,2)
 BEGIN
 ---
IF @ISEmplymentType = 1
   OR @IsEndType = 1
BEGIN
	--کنترل کارکرد
	
	SELECT p.ParameterID,
		   p.DataEntryType
	INTO   #Karkard
	FROM   pay.Parameter p
	WHERE  p.SystemName = 'Karkard'
	
	
	DECLARE @CalendarMonthId       INT,
			@StartDate             DATE,
			@EndDate               DATE,
			@CurrentMonthHours     INT
	
	SELECT @CalendarMonthId = cm.CalendarMonthID,
		   @StartDate             = cm.StartDate,
		   @EndDate               = cm.EndDate,
		   @CurrentMonthHours     = cm.PermittedHours
	FROM   hrm.CalendarMonth AS cm
	WHERE  @ExecuteDate BETWEEN cm.StartDate AND cm.EndDate
	
	SELECT pmd.[Value],
		   p.DataEntryType
	INTO   #karkardValue
	FROM   pay.ParameterMonthlyData AS pmd
		   INNER JOIN PAY.Parameter AS p
				ON  p.ParameterID = pmd.ParameterID
		   INNER JOIN hrm.CalendarMonth AS cm
				ON  cm.CalendarMonthID = pmd.CalendarMonthID
		   INNER JOIN hrm.CalendarMonth AS cm2
				ON  cm2.CalendarMonthID = pmd.IssueCalendarMonthID
	WHERE  p.SystemName = 'Karkard'
		   AND pmd.PersonnelID = @PersonelID
		   AND cm.CalendarMonthID = @CalendarMonthId
		   AND cm2.CalendarMonthID = @CalendarMonthId
	
	
	DECLARE @ALLOWlen DECIMAL(18, 5)
	
	IF @ISEmplymentType = 1
		SET @ALLOWlen = DATEDIFF(dd, @ExecuteDate, @EndDate)+1
	ELSE
		SET @ALLOWlen = DATEDIFF(dd, @STARtDate, @ExecuteDate)+1
	   
	IF @Type IN (1,2)
	BEGIN
		
		
	
	IF EXISTS(
		   SELECT 1
		   FROM   #karkardValue
		   WHERE  (
					  (
						  #karkardValue.DataEntryType = 1
						  AND CAST(VALUE AS INT) > @ALLoWlen
					  )
					  OR (
							 #karkardValue.DataEntryType = 2
							 AND CAST(VALUE AS INT) > @ALLoWlen * @CurrentMonthHours
						 )
				  )
	   )
	BEGIN
		RAISERROR(
			'با توجه به کارکرد وارد شده صدور اين قرارداد مجاز نمي باشد.',
			16,
			12
		)
		RETURN;
	END
	END
	END 
	
	--Control 15
	
	IF @Type IN (1,2)
	BEGIN
		
	
	IF @IsEndType=1
	BEGIN
		
		IF EXISTS (
			SELECT 1 FROM pay.ParameterMonthlyData AS pmd
			INNER JOIN HRM.CalendarMonth AS cm
					  ON cm.CalendarMonthID = pmd.CalendarMonthID
			WHERE pmd.PersonnelID=@PersonelID
			AND cm.StartDate>@StartDate	
		) OR  EXISTS
		(
			SELECT 1 FROM pay.ParameterConstantData  AS pmd
			INNER JOIN HRM.CalendarMonth AS cm
					  ON cm.CalendarMonthID = pmd.CalendarMonthID
			WHERE pmd.PersonnelID=@PersonelID
			AND cm.StartDate>@StartDate	
		)
		OR  EXISTS
		(
			SELECT 1 FROM pay.PersonelVoucherSetting   AS pmd
			INNER JOIN HRM.CalendarMonth AS cm
					  ON cm.CalendarMonthID = pmd.CalendarMonthID
			WHERE pmd.PersonelID=@PersonelID
			AND cm.StartDate>@StartDate	
		)
		 BEGIN
		RAISERROR(
			'با توجه به اطلاعات وارد شده در ماههای آتی، صدور اين قرارداد مجاز نمي باشد.',
			16,
			12
		)
		RETURN;
	END
		
	END
	END
 END
 
--Control 16

IF @Type IN (1,2)
BEGIN
	
	
IF @IsEndType = 1
BEGIN
	IF EXISTS(
		   SELECT 1
		   FROM   pay.CalculationPersonel AS cp
				  INNER JOIN hrm.CalendarMonth AS cm
					   ON  cm.CalendarMonthID = cp.CalendarMonthID
		   WHERE  (@IssueDate <= cm.StartDate OR @ExecuteDate <= cm.StartDate)
				  AND cp.PersonelID = @PersonelID
	   )
	BEGIN
		RAISERROR(
			'به دليل انجام محاسبات در ماه مورد نظر امکان صدور اين نوع قرارداد نمي باشد.',
			16,
			12
		)
		RETURN;
	END
END
END

--Control 17
IF (@Type= 2 OR @Type = 3)
BEGIN
	IF @ConfirmDate IS NOT NULL
	   AND @AggTypeNeedConfirm = 1
	BEGIN
		RAISERROR('امکان ويرايش قرارداد تاييد شده نمي باشد.', 16, 12);
		RETURN;
	END;


END    ;
	
-- Control 18    
	IF @Type IN (2,3)
	BEGIN
		DECLARE @SettlementCalculationTypeID INT 
		SELECT @SettlementCalculationTypeID = ct.CalculationTypeID FROM pay.CalculationType AS ct
		WHERE ct.EngName = 'Settlement'
		
		
		 IF EXISTS (
		   SELECT 1
		   FROM   HRM.AgreementType
				  INNER JOIN HRM.PersonelStatus
					   ON  PersonelStatus.PersonelStatusID = AgreementType.PrePersonelStatusID
		   WHERE  StatusType IN (3)
		   AND @AgreementTypeID=AgreementTypeID
	   )
	BEGIN
		IF EXISTS (
			   SELECT 1
			   FROM   PAY.CalculationPersonel
					  INNER JOIN HRM.CalendarMonth
						   ON  CalendarMonth.CalendarMonthID = CalculationPersonel.CalendarMonthID
			   WHERE  PersonelID = @PersonelID
			   AND CalculationTypeID = @SettlementCalculationTypeID
					  AND @ExecuteDate BETWEEN StartDate
						  AND DATEADD(dd, 1, EndDate)
		   )
		BEGIN
			RAISERROR(
				'به دليل تسویه حساب  براي اين شخص امکان ویرایش قرارداد نمي باشد.',
				16,
				12
			);
			
			RETURN;
		END;
	END;
	END
-- Control 19    
	IF @Type = 2
	BEGIN
			
	IF (@AggTypeNeedConfirm = 0 AND @NeedConfirm = 1)
		SET @ConfirmDate = @IssueDate;
	
	IF @ConfirmDate IS NOT NULL
	   AND @IssueDate > @ConfirmDate
	BEGIN
		RAISERROR('تاريخ تاييد نمي تواند کوچکتر از تاريخ صدور باشد.', 16, 12);
		RETURN;
	END; 
	END
 -- Control 20   
	IF @Type = 3
	BEGIN
		 IF EXISTS (  --نوع قرار داد استخدام است
		SELECT  1
		FROM    HRM.AgreementType AS at
				INNER JOIN HRM.PersonelStatus AS ps ON ps.PersonelStatusID = at.PrePersonelStatusID
				INNER JOIN HRM.AgreementTypePrePersonelStatus AS atpps ON atpps.AgreementTypeID = at.AgreementTypeID
				INNER JOIN HRM.PersonelStatus AS ps2 ON ps2.PersonelStatusID = atpps.PersonelStatusID
		WHERE   ps.StatusType = 5
				AND ps2.StatusType = 100
				AND at.AgreementTypeID = @AgreementTypeID )
		BEGIN
			IF EXISTS ( SELECT  1
						FROM    PAY.ParameterMonthlyData AS pmd
								INNER JOIN HRM.CalendarMonth AS cm ON cm.CalendarMonthID = pmd.CalendarMonthID
						WHERE   pmd.PersonnelID = @PersonelID
								AND cm.EndDate >= @IssueDate )
				OR EXISTS ( SELECT  1
							FROM    PAY.Establishment AS pmd
									INNER JOIN HRM.CalendarMonth AS cm ON cm.CalendarMonthID = pmd.CalendarMonthID
							WHERE   pmd.PersonnelID = @PersonelID
									AND cm.EndDate >= @IssueDate )
				OR EXISTS ( SELECT  1
							FROM    PAY.ParameterConstantData AS pmd
									INNER JOIN HRM.CalendarMonth AS cm ON cm.CalendarMonthID = pmd.CalendarMonthID
							WHERE   pmd.PersonnelID = @PersonelID
									AND cm.EndDate >= @IssueDate )
				OR EXISTS ( SELECT  1
							FROM    PAY.Loan AS pmd
									INNER JOIN HRM.CalendarMonth AS cm ON cm.CalendarMonthID = pmd.CalendarMonthID
							WHERE   pmd.PersonelID = @PersonelID
									AND cm.EndDate >= @IssueDate )
				BEGIN
					RAISERROR(
			'به دليل ثبت اطلاعات براي اين شخص امکان حذف قرارداد نمي باشد.',
			16,
			12
		);
					RETURN;
		
				END;
	
		END;
	END;
