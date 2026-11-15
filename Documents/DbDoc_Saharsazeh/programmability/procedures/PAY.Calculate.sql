
---------------------------------------------------------
CREATE   PROCEDURE PAY.Calculate
(
    @CalendarMonthID           INT,
	@calcTypeId TINYINT,
    @SelectedPersonnelID     NVARCHAR(MAX),
    @calcBackPay             BIT = 0,
    @userID                  INT = -1,
    @IsCalcBackPay           BIT = 0,
    @BaseCalendarMonthID       INT = NULL
)
--WITH ENCRYPTION
WITH RECOMPILE
AS
	SET NOCOUNT ON

	DECLARE @MinuteInHour DECIMAL(30, 10)
	
	SET @MinuteInHour = 60.0000000000
	
	DECLARE @Used30ForAverageCalc BIT
	SET @Used30ForAverageCalc = 0
	
	DECLARE @EfficientMonth INT,
	        @BaseEfficientMonth INT,
	        @calculationDate DATE,
	        @baseCalculationDate DATE,
	        @calculationStartDate DATE,
	        @baseCalculationStartDate DATE,
	        @calcYear INT,	        
	        @CurretMonthDays INT,
	        @decimalNumber VARCHAR(10),
			@MonthLen DECIMAL(18, 5),
	        @YearLen DECIMAL(18, 5),
	        @MonOrder DECIMAL(18, 5),
	        @MonthHours DECIMAL(18, 5),
	        @WorkHours DECIMAL(18, 10),
	        @PMonthLen DECIMAL(18, 5),
	        @PMonthHours DECIMAL(18, 5),
			@NeedConfirm BIT,
			@Q NVARCHAR(MAX),
			@QCondition NVARCHAR(MAX),
			@FormulaID INT,
			@ParameterID INT,
			@OrganizationID INT,
			@ReCalcable BIT
	
	SELECT @NeedConfirm = ConfigValue
	FROM   cfg.Configuration c
	WHERE  c.ConfigKey = 'AgreementNeedConfirm'
	
	SELECT VALUE
	INTO   #selPersonel
	FROM   cfg.R_FnCommaStr2Table(@SelectedPersonnelID) rfcst
	
	SELECT oi.OrganizationID,ao.* INTO #AgreementOrganization
	FROM HRM.AgreementOrganization  AS ao
	JOIN HRM.OrganizationItem AS oi ON oi.OrganizationItemID = ao.OrganizationItemID
	
	SELECT @decimalNumber = c.PrecisionCount
	FROM   cfg.Currency c
	WHERE  c.CurrencyID = -1
	
	DECLARE @error NVARCHAR(MAX)

	SELECT @EfficientMonth           = @CalendarMonthID,
	       @calculationDate          = cm.EndDate,
	       @calculationStartDate     = cm.StartDate,
	       @calcYear                 = cm.CalendarID,
	       @CurretMonthDays          = cm.StandardDays
	FROM   Hrm.CalendarMonth cm
	WHERE  cm.CalendarMonthID = @CalendarMonthID
	
	IF NOT EXISTS (
	       SELECT 1
	       FROM   pay.CalculationType AS ct
	              INNER JOIN PAY.Parameter AS p
	                   ON  p.CalculationTypeID = ct.CalculationTypeID
	       WHERE  p.CalculationTypeID = @calcTypeId
	              AND p.ReCalcable = 1
	   )
	BEGIN
	    SET @calcBackPay = 0
	END
	
	IF @BaseCalendarMonthID IS NULL
	BEGIN
	    SET @baseCalculationStartDate = @calculationStartDate
	    SET @baseCalculationDate = @calculationDate
	    SET @BaseEfficientMonth = @EfficientMonth
	END
	ELSE
	    SELECT @baseCalculationDate = cm.EndDate,
	           @baseCalculationStartDate     = cm.StartDate,
	           @BaseEfficientMonth           = cm.CalendarMonthID
	    FROM   Hrm.CalendarMonth cm
	    WHERE  cm.CalendarMonthID = @BaseCalendarMonthID
	
	SELECT a.PersonelID,
	       a.EmploymentTypeID,
	       a.AgreementID
	INTO   #SelPersonnel
	FROM   cfg.R_FnCommaStr2Table(@SelectedPersonnelID) rfcst
	       INNER JOIN (
	                SELECT *,
	                       ROW_NUMBER() OVER(PARTITION BY a.PersonelID ORDER BY a.IssueDate DESC) AS Rno
	                FROM   HRM.Agreement a
	                WHERE  a.ExecuteDate <= @calculationDate
	                       AND (a.IssueDate <= @baseCalculationDate)
	                       AND (
	                               @NeedConfirm = 0
	                               OR (
	                                      a.ConfirmDate IS NOT NULL
	                                      AND a.ConfirmDate <= @baseCalculationDate
	                                  )
	                           )
	            ) a
	            ON  a.PersonelID = rfcst.Value
	WHERE  a.Rno = 1	
	
	SELECT PersonelID,
	       T.AgreementID,
	       T.ExecuteDate,
		   T.IssueDate,
		   IIF(T.StatusType = 3,DATEADD(DAY,-1, ExecuteDate) , null) as [ExpireDate] ,
		   T.EmploymentTypeID
	INTO   #lastOnlyAggreement
	FROM   (
	           SELECT a.*,ps.StatusType,
	                  ROW_NUMBER() OVER(PARTITION BY a.PersonelID ORDER BY a.IssueDate DESC) AS Rno
	           FROM   HRM.Agreement a
	                  INNER JOIN #SelPersonnel
	                       ON  #SelPersonnel.PersonelID = a.PersonelID
	                  INNER JOIN hrm.AgreementType AS at ON at.AgreementTypeID = a.AgreementTypeID
	                  INNER JOIN hrm.PersonelStatus AS ps ON ps.PersonelStatusID = at.PrePersonelStatusID     
	           WHERE  a.ExecuteDate <= @calculationDate
	                  AND (
	                          @NeedConfirm = 0
	                          OR (
	                                 a.ConfirmDate IS NOT NULL
	                                 AND a.ConfirmDate <= @baseCalculationDate
	                             )
	                      )
	                  AND a.IssueDate <= @baseCalculationDate
	       ) T
	WHERE  T.Rno = 1	
	
	SELECT PersonelID,
	       T.AgreementID,
	       T.ExecuteDate,
	       T.ParameterID,
	       T.Amount
	INTO   #lastAggreement
	FROM   (
	           SELECT a.*,
	                  ap.ParameterID,
	                  ROW_NUMBER() OVER(
	                      PARTITION BY a.PersonelID,
	                      ap.ParameterID ORDER BY a.IssueDate DESC
	                  ) AS Rno,
	                  ap.Amount
	           FROM   HRM.Agreement a
	                  INNER JOIN HRM.AgreementParameter ap
	                       ON  ap.AgreementID = a.AgreementID
	                  INNER JOIN #SelPersonnel
	                       ON  #SelPersonnel.PersonelID = a.PersonelID
	           WHERE  ap.ExecuteDate <= @calculationDate
	                  AND (
	                          @NeedConfirm = 0
	                          OR (
	                                 a.ConfirmDate IS NOT NULL
	                                 AND a.ConfirmDate <= @baseCalculationDate
	                             )
	                      )
	                  AND a.IssueDate <= @baseCalculationDate
	       ) T
	WHERE  T.Rno = 1
		
	IF @calcBackPay = 1--اگر قرار است محاسبه معوقه انجام شود
	BEGIN    
	    SELECT T.PersonelID,
	           MIN(T.ExecuteDate)  AS ExecuteDate,
	           CAST(0 AS INT)      AS CalendarMonthID
	    INTO   #BackPayInfo2
	    FROM   (
	               SELECT a.PersonelID,
	                      a.ExecuteDate
	               FROM   hrm.Agreement a
	                      INNER JOIN #selPersonel p
	                           ON  p.value = a.PersonelID
	               WHERE  (
	                          @NeedConfirm = 1
	                          OR a.IssueDate BETWEEN @calculationStartDate AND @calculationDate
	                      )
	                      AND a.ExecuteDate < @calculationStartDate
	                      AND (
	                              @NeedConfirm = 0
	                              OR (
	                                     a.ConfirmDate IS NOT NULL
	                                     AND a.ConfirmDate BETWEEN @calculationStartDate AND @calculationDate
	                                 )
	                          )
	               UNION
	               SELECT pmd.PersonnelID,
	                      cm.StartDate
	               FROM   pay.ParameterMonthlyData pmd
	                      INNER JOIN #selPersonel per
	                           ON  per.value = pmd.PersonnelID
	                      INNER JOIN hrm.CalendarMonth cm
	                           ON  cm.CalendarMonthID = pmd.CalendarMonthID
	                      INNER JOIN pay.Parameter p
	                           ON  p.ParameterID = pmd.ParameterID
	               WHERE  pmd.IssueCalendarMonthID = @BaseEfficientMonth
	                      AND pmd.CalendarMonthID <> @BaseEfficientMonth
	                      AND (p.ReCalcable = 1 OR p.CategoryID = 1)
					union
					select a.PersonelID,
							m.StartDate
					from   #lastOnlyAggreement a
						  INNER join pay.CalculationMethod cm 
							   ON a.EmploymentTypeID = cm.EmploymentTypeID
						  INNER join hrm.CalendarMonth m
								on m.CalendarMonthID = cm.EfficientCalendarMonthID
					where GenerateCalendarMonthID = @CalendarMonthID
					and EfficientCalendarMonthID <> GenerateCalendarMonthID
					GROUP BY a.PersonelID,
							m.StartDate
				
	           ) T
	    GROUP BY
	           T.PersonelID
	    
	
	    UPDATE #BackPayInfo2
	    SET    CalendarMonthID = cm.CalendarMonthID
	    FROM   #BackpayInfo2
	    INNER JOIN hrm.CalendarMonth cm
	        ON  #BackpayInfo2.ExecuteDate BETWEEN cm.StartDate AND cm.EndDate
	    INNER JOIN Pay.CalculationPersonel c
	        ON  c.CalendarMonthID = cm.CalendarMonthID
			and c.PersonelID = #BackPayInfo2.PersonelID
	    WHERE  c.CalculationTypeID = @calcTypeId
	    
	    
	    
	    SELECT #BackPayInfo2.PersonelID,
	           cm.StartDate AS ExecuteDate,
	           cm.CalendarMonthID
	    INTO   #BackPayInfo
	    FROM   #BackPayInfo2
	    INNER JOIN hrm.CalendarMonth cm
			ON  cm.EndDate >= #BackPayInfo2.ExecuteDate
	        AND cm.StartDate < @baseCalculationStartDate

		
	    
	    DECLARE @BackpayPersonelID       VARCHAR(MAX),
	            @BakPayCalendarMonthID     INT,
	            @ExecDate                DATETIME
	    
	    
	    DECLARE R2 CURSOR 
	    FOR
	        SELECT DISTINCT ExecuteDate,
	               CalendarMonthID
	        FROM   #BackPayInfo
	        ORDER BY
	               ExecuteDate
	    
	    OPEN R2
	    
	    FETCH NEXT FROM R2
	    INTO @ExecDate,@BakPayCalendarMonthID
	    
	    
	    WHILE @@FETCH_STATUS = 0
	    BEGIN
	        SET @BackpayPersonelID = ''
	        
	        SELECT @BackpayPersonelID = @BackpayPersonelID + ',' + CAST(PersonelID AS VARCHAR(20))
	        FROM   #BackPayInfo
	        WHERE  CalendarMonthID = @BakPayCalendarMonthID
	        
        
	        SET @BackpayPersonelID = SUBSTRING(@BackpayPersonelID, 2, LEN(@BackpayPersonelID) -1)
	        
        
	        EXEC Pay.Calculate 
				 @BakPayCalendarMonthID,
				 @calcTypeId,
	             @BackpayPersonelID,
	             0,
	             @userID,
	             1,
	             @CalendarMonthID
	        

			   
	        INSERT INTO #CalculationBackPayResult
	          (
	            [CalculationPersonelID],
	            [BackPayCalculationPersonelID],
	            ParameterID,
	            ParameterValueTypeID,
	            [Value],
	            EmployMentTypeID
	          )
	        SELECT cp.CalculationPersonelID,
	               cp2.CalculationPersonelID,
	               crt.ParameterID,
	               crt.ParameterValueTypeID,
	               crt.[Value],
	               crt.EmploymentTypeID
	        FROM   pay.CalculationResult_temp crt
	        INNER JOIN pay.Parameter p
	            ON  p.ParameterID = crt.ParameterID
			INNER JOIN pay.CalculationPersonel cp
				on cp.CalculationPersonelID = crt.CalculationPersonelID 
			INNER JOIN pay.CalculationPersonel cp2
				on  cp2.CalendarMonthID = @BakPayCalendarMonthID 
				and cp2.PersonelID = crt.PersonelID
				and cp2.CalculationTypeID = p.CalculationTypeID
	        WHERE  crt.[Value] IS NOT NULL
	               AND crt.ParameterID IS NOT NULL
	               AND crt.ParameterValueTypeID = 7



	        FETCH NEXT FROM R2
	        INTO @ExecDate,@BakPayCalendarMonthID
	    END
	    
	    CLOSE R2
	    DEALLOCATE R2
	    

	END
	
	TRUNCATE TABLE Pay.CalculationResult_temp
	
	DECLARE @CalendarId INT
	
	SELECT @CalendarId = c.CalendarID,
	       @MonthLen        = cm.StandardDays,
	       @MonthHours      = CAST(cm.StandardHours AS DECIMAL(30, 10)) / @MinuteInHour,	--SATURNNEW-2916
	       @PMonthLen       = cm.PermittedDays,	--	SATURNNEW-2916
	       @PMonthHours     = CAST(cm.PermittedHours AS DECIMAL(30, 10)) / @MinuteInHour,
	       @WorkHours       = c.WorkHours
	FROM   hrm.CalendarMonth cm
	       INNER JOIN HRM.Calendar c
	            ON  c.CalendarID = cm.CalendarID
	WHERE  cm.CalendarMonthID = @EfficientMonth
	
	SELECT @YearLen = SUM(cm.StandardDays)
	FROM   hrm.CalendarMonth AS cm
	WHERE  cm.CalendarID = @CalendarId
	
	SELECT @MonOrder = T.RNo
	FROM   (
	           SELECT *,
	                  ROW_NUMBER() OVER(ORDER BY cm.StartDate) AS RNo
	           FROM   hrm.CalendarMonth cm
	           WHERE  cm.CalendarID = @calcYear
	       )T
	WHERE  T.CalendarMonthID = @EfficientMonth
	
	--پارامتر ها مستقل از نوع محاسبه انتخاب مي شوند
	SELECT CalculationMethodID,
	       ParameterID,
	       EmploymentTypeID,
	       T.FormulaId,
	       OrganizationID,
	       T.IsInsuranceable,
	       T.IsTaxable,
	       T.CategoryID,
	       T.ParameterTypeID,
	       T.SystemName
	INTO   #SelParameter2
	FROM   (
	           SELECT p.OrganizationID,
	                  cm.*,
	                  p.CategoryID,
	                  p.ParameterTypeID,
	                  p.SystemName,
	                  f.FormulaID,
	                  ROW_NUMBER() OVER(
	                      PARTITION BY cm.ParameterID,
	                      cm.EmploymentTypeID ORDER BY cm2.StartDate DESC
	                  ) AS Rno
	           FROM   Pay.CalculationMethod cm
	                  INNER JOIN Hrm.CalendarMonth cm2
	                       ON  cm2.CalendarMonthID = cm.EfficientCalendarMonthID
	                  INNER JOIN PAY.Parameter p
	                       ON  p.ParameterID = cm.ParameterID
	                  LEFT JOIN Pay.Formula f
	                       ON  f.CalculationMethodID = cm.CalculationMethodID
	                  INNER JOIN #SelPersonnel
	                       ON  #SelPersonnel.EmploymentTypeID = cm.EmploymentTypeID
	                       AND p.CategoryID <> 7
	           WHERE  cm2.StartDate <= @calculationDate
	                  AND cm.EmploymentTypeID IN (SELECT EmploymentTypeID
	                                              FROM   #SelPersonnel)
	       ) T
	WHERE  Rno = 1
	
	--درج پارامتر هاي مربوط به وام
	INSERT INTO #SelParameter2
	SELECT -1,
	       ParameterID,
	       et.EmploymentTypeID,
	       NULL,
	       NULL,
	       0,
	       0,
	       7,
	       ParameterTypeID,
	       SystemName
	FROM   pay.Parameter p
	       CROSS JOIN hrm.EmploymentType et
	WHERE  p.CategoryID = 7
	       AND NOT EXISTS (
	               SELECT #SelParameter2.ParameterID
	               FROM   #SelParameter2
	               WHERE  #SelParameter2.ParameterID = p.ParameterID
	           )
	
	TRUNCATE TABLE pay.CalculationAggregateParameter
	
	INSERT INTO pay.CalculationAggregateParameter
	  (
	    CalculationAggregateExpressionID,
	    ParameterID,
	    ParameterValueTypeID,
	    EmploymentTypeID
	  )
	SELECT e.CalculationAggregateExpressionID,
	       p.ParameterID,
	       T.value  AS ParameterValueTypeID,
	       p.EmploymentTypeID
	FROM   pay.CalculationAggregateExpression e
	       INNER JOIN #SelParameter2 p
	            ON  (e.IsTaxable IS NULL OR p.IsTaxable = e.IsTaxable)
	            AND (
	                    e.IsInsuranceable IS NULL
	                    OR p.IsInsuranceable = e.IsInsuranceable
	                )
	            AND (
	                    e.CategoryItems IS NULL
	                    OR ',' + e.CategoryItems LIKE '%,' + CAST(p.CategoryID AS VARCHAR(10))
	                       + '%'
	                )
	            AND (
	                    e.ParameterTypeItems IS NULL
	                    OR ',' + e.ParameterTypeItems LIKE '%,' + CAST(p.ParameterTypeID AS VARCHAR(10))
	                       + '%'
	                )
	       OUTER APPLY (
	    SELECT VALUE
	    FROM   cfg.R_FnCommaStr2Table(e.ParameterValueTypeItems) rfcst
	)                  T
	WHERE  NOT (P.SystemName IS NOT NULL AND p.SystemName LIKE 'NS_%')
	
	--انتخاب پارامتر هاي مربوط به نوع محاسبه انتخاب شده
	SELECT CalculationMethodID,
	       ParameterID,
	       EmploymentTypeID,
	       T.FormulaId,
	       OrganizationID,
		   t.IsActive
	INTO   #SelParameter
	FROM   (
	           SELECT p.OrganizationID,
	                  cm.*,
	                  f.FormulaID,
	                  ROW_NUMBER() OVER(
	                      PARTITION BY cm.ParameterID,
	                      cm.EmploymentTypeID ORDER BY cm2.StartDate DESC
	                  ) AS Rno
	           FROM   Pay.CalculationMethod cm
	                  INNER JOIN Hrm.CalendarMonth cm2
	                       ON  cm2.CalendarMonthID = cm.EfficientCalendarMonthID
	                  LEFT JOIN Pay.Formula f
	                       ON  f.CalculationMethodID = cm.CalculationMethodID
	                  INNER JOIN #SelPersonnel
	                       ON  #SelPersonnel.EmploymentTypeID = cm.EmploymentTypeID
	                  INNER JOIN PAY.Parameter p
	                       ON  p.ParameterID = cm.ParameterID
	           WHERE  p.CalculationTypeID = @calcTypeId
	                  AND cm2.StartDate <= @calculationDate
	                  AND cm.EmploymentTypeID IN (SELECT EmploymentTypeID
	                                              FROM   #SelPersonnel)
	       ) T
	WHERE  Rno = 1
	
	DECLARE @ErrParameter          NVARCHAR(512),
	        @ErrEmploymentType     NVARCHAR(512)
	
	SELECT @ErrParameter = p.Title,
	       @ErrEmploymentType = et.Title
	FROM   #SelParameter cm
	       INNER JOIN pay.Parameter p
	            ON  p.ParameterID = cm.ParameterID
	       INNER JOIN Hrm.EmploymentType et
	            ON  et.EmploymentTypeID = cm.EmploymentTypeID
	       INNER JOIN pay.FormulaParameter fp
	            ON  fp.FormulaID = cm.FormulaId
	WHERE  fp.ParameterValueTypeID <> 19
	       AND fp.ParameterID IS NOT NULL
	       AND NOT EXISTS
	           (
	               SELECT *
	               FROM   #SelParameter2 cm2
	               WHERE  cm2.EmploymentTypeID = cm.EmploymentTypeID
	                      AND cm2.ParameterID = fp.ParameterID
	           )
	
	IF (@ErrParameter IS NOT NULL)
	BEGIN
	    SET @error = 'E_' + ' ايراد در فرمول ' +
	        @ErrParameter + ' براي نوع استخدام  '
	        + @ErrEmploymentType
	    
	    RAISERROR (
	        @error,	-- Message text.
	        16,	-- Severity,
	        1,	-- State,
	        NULL,	-- First argument.
	        NULL
	    ); -- Second argument.
	END
	
	CREATE TABLE #Calc
	(
		[PersonelID]               [int] NOT NULL,
		[ParameterID]              [int] NULL,
		[ParameterValueTypeID]     [int] NOT NULL,
		[Value]                    [decimal](30, 10) NULL
	)
	
	--Transfer Manual Parameters
	DECLARE @karkardId INT

	SELECT @karkardId = p.ParameterID
	FROM   pay.Parameter p
	WHERE  p.SystemName = 'Karkard'
	
	IF @IsCalcBackPay = 0
	BEGIN
	    INSERT INTO #Calc
	    SELECT PAY.ParameterMonthlyData.PersonnelID,
	           PAY.ParameterMonthlyData.ParameterID,
	           7,
	           SUM(
	               CASE 
	                    WHEN p.DataEntryType = 2 THEN CAST([Value] AS DECIMAL(30, 10)) / 60.0000000000
	                    WHEN p.DataEntryType = 3 THEN CAST([Value] / (@WorkHours) AS DECIMAL(30, 10))
	                    ELSE CAST([Value] AS DECIMAL(30, 10))
	               END
	           )
	    FROM   PAY.ParameterMonthlyData
	           INNER JOIN #SelPersonnel
	                ON  #SelPersonnel.PersonelID = PAY.ParameterMonthlyData.PersonnelID
	           INNER JOIN pay.Parameter p
	                ON  p.ParameterID = PAY.ParameterMonthlyData.ParameterID
	           LEFT JOIN #SelParameter
	                ON  #SelParameter.ParameterID = PAY.ParameterMonthlyData.ParameterID
	                AND #SelParameter.EmploymentTypeID = #SelPersonnel.EmploymentTypeID
	    WHERE  PAY.ParameterMonthlyData.CalendarMonthID = @EfficientMonth
	           AND PAY.ParameterMonthlyData.IssueCalendarMonthID = @EfficientMonth
	           AND (
	                   #SelParameter.ParameterID IS NOT NULL
	                   OR P.ParameterID IN (SELECT fp.ParameterID
	                                        FROM   pay.FormulaParameter fp
	                                               INNER JOIN pay.Formula f
	                                                    ON  f.FormulaID = fp.FormulaID
	                                               INNER JOIN #SelParameter p
	                                                    ON  p.CalculationMethodID = f.CalculationMethodID
	                                        WHERE  fp.ParameterValueTypeID = 7)
	                   OR p.ParameterID = @karkardId
	               )
	    GROUP BY
	           PAY.ParameterMonthlyData.PersonnelID,
	           PAY.ParameterMonthlyData.ParameterID
	END
	ELSE
	BEGIN
	    ----------------------
	    
	    SELECT cm.CalendarMonthID
	    INTO   #AfterMonths
	    FROM   hrm.CalendarMonth AS cm
	    WHERE  cm.StartDate > @calculationStartDate
	           AND cm.StartDate <= @baseCalculationStartDate
	    

	    
	    INSERT INTO #Calc
	    SELECT PAY.ParameterMonthlyData.PersonnelID,
	           PAY.ParameterMonthlyData.ParameterID,
	           7,
	           SUM(
	               CASE 
	                    WHEN p.DataEntryType = 2 THEN CAST([Value] AS DECIMAL(30, 10)) / @MinuteInHour
	                    WHEN p.DataEntryType = 3 THEN CAST([Value] AS DECIMAL(30, 10)) / (@WorkHours)
	                    ELSE CAST([Value] AS DECIMAL(30, 10))
	               END
	           )
	    FROM   PAY.ParameterMonthlyData
	           INNER JOIN #SelPersonnel
	                ON  #SelPersonnel.PersonelID = PAY.ParameterMonthlyData.PersonnelID
	           INNER JOIN pay.Parameter p
	                ON  p.ParameterID = PAY.ParameterMonthlyData.ParameterID
	           LEFT JOIN #SelParameter
	                ON  #SelParameter.ParameterID = PAY.ParameterMonthlyData.ParameterID
	                AND #SelParameter.EmploymentTypeID = #SelPersonnel.EmploymentTypeID
	    WHERE  PAY.ParameterMonthlyData.CalendarMonthID = @EfficientMonth
	           AND PAY.ParameterMonthlyData.IssueCalendarMonthID = @EfficientMonth
	           AND (
	                   #SelParameter.ParameterID IS NOT NULL
	                   OR P.ParameterID IN (SELECT fp.ParameterID
	                                        FROM   pay.FormulaParameter fp
	                                               INNER JOIN pay.Formula f
	                                                    ON  f.FormulaID = fp.FormulaID
	                                               INNER JOIN #SelParameter p
	                                                    ON  p.CalculationMethodID = f.CalculationMethodID
	                                        WHERE  fp.ParameterValueTypeID = 7)
	                   OR p.ParameterID = @karkardId
	               )
	           AND NOT EXISTS (
	                   SELECT 1
	                   FROM   pay.ParameterMonthlyData pmd
	                   WHERE  pmd.ParameterID = PAY.ParameterMonthlyData.ParameterID
	                          AND pmd.PersonnelID = PAY.ParameterMonthlyData.PersonnelID
	                          AND pmd.IssueCalendarMonthID IN (SELECT CalenDarMonthID
	                                                           FROM   #AfterMonths)
	                          AND pmd.CalendarMonthID = @EfficientMonth
	               )
	    GROUP BY
	           PAY.ParameterMonthlyData.PersonnelID,
	           PAY.ParameterMonthlyData.ParameterID
	    
	

	    INSERT INTO #Calc
	    SELECT PersonnelID,
	           ParameterID,
	           7,
	           SUM([Value])
	    FROM   (
	               SELECT PAY.ParameterMonthlyData.PersonnelID,
	                      PAY.ParameterMonthlyData.ParameterID,
	                      7    AS ItemType,
	                      CASE 
	                           WHEN p.DataEntryType = 2 THEN CAST([Value] AS DECIMAL(30, 10)) / @MinuteInHour
	                           WHEN p.DataEntryType = 3 THEN CAST([Value] AS DECIMAL(30, 10)) / (@WorkHours)
	                           ELSE CAST([Value] AS DECIMAL(30, 10))
	                      END  AS [Value],
	                      ROW_NUMBER() OVER(
	                          PARTITION BY PAY.ParameterMonthlyData.PersonnelID,
	                          PAY.ParameterMonthlyData.ParameterID
	                          ORDER BY cm.startDate DESC
	                      )    AS Rno
	               FROM   PAY.ParameterMonthlyData
	                      INNER JOIN #SelPersonnel
	                           ON  #SelPersonnel.PersonelID = PAY.ParameterMonthlyData.PersonnelID
	                      INNER JOIN pay.Parameter p
	                           ON  p.ParameterID = PAY.ParameterMonthlyData.ParameterID
	                      INNER JOIN Hrm.CalendarMonth cm
	                           ON  cm.CalendarMonthID = PAY.ParameterMonthlyData.IssueCalendarMonthID
	                      LEFT JOIN #SelParameter
	                           ON  #SelParameter.ParameterID = PAY.ParameterMonthlyData.ParameterID
	                           AND #SelParameter.EmploymentTypeID = #SelPersonnel.EmploymentTypeID
	               WHERE  PAY.ParameterMonthlyData.CalendarMonthID = @EfficientMonth
	                      AND PAY.ParameterMonthlyData.IssueCalendarMonthID IN (SELECT CalenDarMonthID
	                                                                            FROM   #AfterMonths)-- @BaseEfficientMonth
	                      AND (
	                              #SelParameter.ParameterID IS NOT NULL
	                              OR P.ParameterID IN (SELECT fp.ParameterID
	                                                   FROM   pay.FormulaParameter fp
	                                                          INNER JOIN pay.Formula f
	                                                               ON  f.FormulaID = fp.FormulaID
	                                                          INNER JOIN #SelParameter p
	                                                               ON  p.CalculationMethodID = f.CalculationMethodID
	                                                   WHERE  fp.ParameterValueTypeID = 7)
	                              OR p.ParameterID = @karkardId
	                          )
	           )T
	    WHERE  Rno = 1
	    GROUP BY
	           PersonnelID,
	           ParameterID
	END
	
	--درج مقادير ثابت
	INSERT INTO #Calc
	SELECT pcd.PersonnelID,
	       pcd.ParameterID,
	       7,
	       CASE 
	            WHEN p.DataEntryType = 2 THEN CAST([Value] AS DECIMAL(30, 10)) / @MinuteInHour
	            WHEN p.DataEntryType = 3 THEN CAST([Value] AS DECIMAL(30, 10)) / (@WorkHours)
	            ELSE CAST([Value] AS DECIMAL(30, 10))
	       END
	FROM   (
	           SELECT PAY.ParameterConstantData.*,
	                  ROW_NUMBER() OVER(
	                      PARTITION BY PersonnelID,
	                      ParameterID ORDER BY StartDate DESC
	                  ) AS RNO
	           FROM   PAY.ParameterConstantData
	                  INNER JOIN HRM.CalendarMonth cm
	                       ON  cm.CalendarMonthID = PAY.ParameterConstantData.CalendarMonthID
	           WHERE  cm.StartDate <= @calculationStartDate
	       ) pcd
	       INNER JOIN #SelPersonnel
	            ON  #SelPersonnel.PersonelID = pcd.PersonnelID
	       INNER JOIN pay.Parameter p
	            ON  p.ParameterID = pcd.ParameterID
	       LEFT JOIN #SelParameter
	            ON  #SelParameter.ParameterID = pcd.ParameterID
	            AND #SelParameter.EmploymentTypeID = #SelPersonnel.EmploymentTypeID
	WHERE  PCD.RNO = 1
	       AND (
	               #SelParameter.ParameterID IS NOT NULL
	               OR P.ParameterID IN (SELECT fp.ParameterID
	                                    FROM   pay.FormulaParameter fp
	                                           INNER JOIN pay.Formula f
	                                                ON  f.FormulaID = fp.FormulaID
	                                           INNER JOIN #SelParameter p
	                                                ON  p.CalculationMethodID = f.CalculationMethodID
	                                    WHERE  fp.ParameterValueTypeID = 7)
	           )

	--درج مقادير استقرار
	INSERT INTO #Calc
	SELECT e.PersonnelID,
	       e.ParameterID,
	       13,
	       CASE 
	            WHEN p.DataEntryType = 2 THEN CAST([Value] AS DECIMAL(30, 10)) / 60.0000000000
	            WHEN p.DataEntryType = 3 THEN CAST([Value] / (@WorkHours) AS DECIMAL(30, 10))
	            ELSE CAST([Value] AS DECIMAL(30, 10))
	       END
	       --e.[Value]
	FROM   Pay.Establishment e
	       INNER JOIN #SelPersonnel
	            ON  #SelPersonnel.PersonelID = e.PersonnelID
	       INNER JOIN PAY.Parameter AS p
	            ON  p.ParameterID = e.ParameterID
	                -- INNER JOIN #SelParameter
	                --    ON  #SelParameter.ParameterID = e.ParameterID
	                --     AND #SelParameter.EmploymentTypeID = #SelPersonnel.EmploymentTypeID
	WHERE  e.CalendarMonthID = @EfficientMonth
	       AND e.ParameterID IN (SELECT fp.ParameterID
	                             FROM   pay.FormulaParameter fp
	                                    INNER JOIN pay.Formula f
	                                         ON  f.FormulaID = fp.FormulaID
	                                    INNER JOIN #SelParameter p
	                                         ON  p.CalculationMethodID = f.CalculationMethodID
	                             WHERE  fp.ParameterValueTypeID = 13)

	--1--آخرين مقدار در قرارداد
	INSERT INTO #Calc
	SELECT #lastAggreement.PersonelID,
	       #lastAggreement.ParameterID,
	       1,
	       Amount
	FROM   #lastAggreement	       
	       INNER JOIN #SelPersonnel
	            ON  #SelPersonnel.PersonelID = #lastAggreement.PersonelID
	WHERE  #lastAggreement.ParameterID IN (SELECT fp.ParameterID
	                                       FROM   pay.FormulaParameter fp
	                                              INNER JOIN pay.Formula f
	                                                   ON  f.FormulaID = fp.FormulaID
	                                              INNER JOIN #SelParameter p
	                                                   ON  p.CalculationMethodID = f.CalculationMethodID
	                                       WHERE  fp.ParameterValueTypeID = 1)
	
	CREATE TABLE #StartAgreementType
	(
		Id INT
	)
	
	INSERT INTO #StartAgreementType
	EXEC Hrm.GetStartAgreementType 
	
	SELECT T.PersonelID,
	       T.IssueDate,
		   T.ExecuteDate,
	       T.EmploymentDate
	INTO   #Start
	FROM   (
	           SELECT a.PersonelID,
	                  a.IssueDate,
	                  a.ExecuteDate,
	                  a.EmploymentDate,
	                  ROW_NUMBER() OVER(PARTITION BY a.PersonelID ORDER BY a.IssueDate DESC) AS Rno
	           FROM   HRM.Agreement a
	                  INNER JOIN #selPersonel
	                       ON  #selPersonel.value = a.PersonelID
	           WHERE  (
	                      @NeedConfirm = 0
	                      OR (
	                             a.ConfirmDate IS NOT NULL
	                             AND a.ConfirmDate <= @baseCalculationDate
	                         )
	                  )
	                  AND a.ExecuteDate <= @calculationDate
	                  AND (@IsCalcBackPay = 1 OR a.IssueDate <= @calculationDate)
	                  AND a.AgreementTypeID IN (SELECT id
	                                            FROM   #StartAgreementType)
	       ) T
	WHERE  T.Rno = 1

	--2--ميانگين در قرارداد
	SELECT A.*
	INTO   #Agreements
	FROM   (
	           SELECT PersonelID,
	                  T.AgreementID,
	                  ExecuteDate,
	                  0  AS daylen,
	                  T.ParameterID,
	                  T.Amount,
	                  T.AgreementTypeID,
	                  T.EmploymentDate
	           FROM   (
	                      SELECT a.PersonelID,
	                             a.AgreementTypeID,
	                             a.EmploymentDate,
	                             ap.*,
	                             ROW_NUMBER() OVER(
	                                 PARTITION BY a.PersonelID,
	                                 ap.ParameterID ORDER BY a.IssueDate DESC
	                             ) AS Rno
	                      FROM   HRM.Agreement a
	                             INNER JOIN HRM.AgreementParameter ap
	                                  ON  ap.AgreementID = a.AgreementID
	                             INNER JOIN #selPersonel
	                                  ON  #selPersonel.value = a.PersonelID
	                      WHERE  (
	                                 @NeedConfirm = 0
	                                 OR (
	                                        a.ConfirmDate IS NOT NULL
	                                        AND a.ConfirmDate <= @baseCalculationDate
	                                    )
	                             )
	                             AND ap.ExecuteDate <= @calculationStartDate
	                             AND (a.IssueDate <= @baseCalculationDate)
	                  )     T
	           WHERE  T.Rno = 1
	           UNION
	           SELECT a.PersonelID,
	                  a.AgreementID,
	                  ap.ExecuteDate,
	                  0 AS daylen,
	                  ap.ParameterID,
	                  ap.Amount,
	                  a.AgreementTypeID,
	                  a.EmploymentDate
	           FROM   HRM.Agreement a
	                  INNER JOIN HRM.AgreementParameter ap
	                       ON  ap.AgreementID = a.AgreementID
	                  INNER JOIN #selPersonel
	                       ON  #selPersonel.value = a.PersonelID
	           WHERE  (a.IssueDate <= @baseCalculationDate)
	                  AND NOT EXISTS (
	                          SELECT *
	                          FROM   hrm.Agreement a2
	                                 INNER JOIN HRM.AgreementParameter ap2
	                                      ON  ap2.AgreementID = a2.AgreementID
	                          WHERE  a2.PersonelID = a.PersonelID
	                                 AND ap2.ParameterID = ap.ParameterID
	                                 AND (
	                                         @NeedConfirm = 0
	                                         OR (
	                                                a2.ConfirmDate IS NOT NULL
	                                                AND a2.ConfirmDate <= @baseCalculationDate
	                                            )
	                                     )
	                                 AND (a2.IssueDate <= @baseCalculationDate)
	                                 AND ap2.ExecuteDate <= ap.ExecuteDate
	                                 AND a2.IssueDate >= a.IssueDate
	                                 AND a2.AgreementID <> a.AgreementID
	                      )
	                  AND (
	                          @NeedConfirm = 0
	                          OR (
	                                 a.ConfirmDate IS NOT NULL
	                                 AND a.ConfirmDate <= @baseCalculationDate
	                             )
	                      )
	                  AND ap.ExecuteDate > @calculationStartDate
	                  AND ap.ExecuteDate <= @calculationDate
	       ) A
	       INNER JOIN #Start
	            ON  #Start.PersonelId = A.personelID
	            AND A.ExecuteDate >= #Start.EmploymentDate

	select  a.PersonelID,
			CASE WHEN s.EmploymentDate >= isnull(c.IssueDate,ao.AssignmentDate) THEN  s.EmploymentDate ELSE isnull(c.IssueDate,ao.AssignmentDate) end IssueDate,
			isnull(a.[ExpireDate],@calculationDate) calculationDate ,
			OrganizationID,
			OrganizationItemID,
			ao.TaxTableTypeID
	into #Reset
	from #AgreementOrganization ao
	join #lastOnlyAggreement a on a.AgreementID = ao.AgreementID
	join #Start s on s.PersonelID = a.PersonelID
	outer apply
	(
	select top 1 oa_a.IssueDate
	from hrm.Agreement oa_a
	join #AgreementOrganization oa_ao
		on oa_a.AgreementID = oa_ao.AgreementID
	where oa_a.PersonelID = a.PersonelID
		and oa_ao.OrganizationID = ao.OrganizationID
		and oa_a.IssueDate < a.IssueDate
		AND ( oa_ao.OrganizationItemID <> ao.OrganizationItemID OR oa_ao.TaxTableTypeID <> ao.TaxTableTypeID)
	order by oa_a.IssueDate desc
	) b
	outer apply
	(
	select top 1 oa_cm.StartDate IssueDate
	from hrm.Agreement oa_a
	join #AgreementOrganization oa_ao
		on oa_a.AgreementID = oa_ao.AgreementID
	join hrm.CalendarMonth oa_cm 
		on oa_a.IssueDate between oa_cm.StartDate and oa_cm.EndDate
	where oa_a.PersonelID = a.PersonelID
		and oa_ao.OrganizationID = ao.OrganizationID
		and oa_a.IssueDate > b.IssueDate
		and oa_ao.OrganizationItemID = ao.OrganizationItemID
	order by oa_a.IssueDate 
	) c
	
	SELECT ao.AgreementID,
	       ao.OrganizationID,
	       PersonelID,
	       ao.TaxTableTypeID
	INTO   #AggOrgan
	FROM   #AgreementOrganization ao
	       INNER JOIN #lastOnlyAggreement a
	            ON  a.AgreementID = ao.AgreementID

	--درج جدول ماليات مربوطه
	INSERT INTO [PAY].[CalculationResult_temp]
           ([PersonelID]
           ,[ParameterID]
           ,[ParameterValueTypeID]
           ,[Value]
           ,[EmploymentTypeID]
           ,[LoanID]
           ,[ParameterFullID]
           ,[CalculationPersonelID])
	SELECT a.PersonelID,
	       0,
	       51,
	       TaxTableID,
	       0,
	       NULL,
	       51,
		   cp.CalculationPersonelID
	FROM   #AggOrgan
	       INNER JOIN hrm.Agreement a
	            ON  a.AgreementID = #AggOrgan.AgreementID
	       INNER JOIN (
	                SELECT tt.*,
	                       ROW_NUMBER() OVER(PARTITION BY tt.TaxTableTypeID ORDER BY cm.StartDate DESC) AS RNO
	                FROM   hrm.TaxTable tt
	                       INNER JOIN HRM.CalendarMonth cm
	                            ON  cm.CalendarMonthID = tt.CalendarMonthID
	                WHERE  cm.StartDate <= @calculationStartDate
	            )TaxTables
	            ON  TaxTables.TaxTableTypeID = #AggOrgan.TaxTableTypeID
	            AND TaxTables.RNO = 1
			 INNER JOIN pay.CalculationPersonel cp
				on cp.CalendarMonthID = @BaseCalendarMonthID
				and cp.CalculationTypeID = @calcTypeId
				and cp.PersonelID = a.PersonelID
	WHERE  TaxTableID IS NOT NULL
	
	DECLARE @ADD30Day       DATE,
	        @Additional     INT
	
	IF @Used30ForAverageCalc = 1
	    SET @Additional = 0
	ELSE
	    SET @Additional = 1
	
	IF @Used30ForAverageCalc = 1
	    SET @ADD30Day = DATEADD(DAY, 30, @calculationStartDate)
	ELSE
	    SET @ADD30Day = @calculationDate

	UPDATE #Agreements
	SET    daylen = DATEDIFF(
	           DAY,
	           CASE 
	                WHEN ExecuteDate < @calculationStartDate THEN @calculationStartDate
	                WHEN ExecuteDate > @calculationStartDate
	           AND ExecuteDate = EmploymentDate THEN @calculationStartDate
	               ELSE ExecuteDate
	               END,
	           ISNULL(
	               (
	                   SELECT TOP 1 CASE 
	                                     WHEN @Used30ForAverageCalc = 1 THEN ExecuteDate
	                                     ELSE DATEADD(Y, -1, ExecuteDate)
	                                END
	                   FROM   #Agreements A
	                   WHERE  A.PersonelID = #Agreements.PersonelID
	                          AND A.ParameterID = #Agreements.ParameterID
	                          AND A.ExecuteDate > #Agreements.ExecuteDate
	                   ORDER BY
	                          A.ExecuteDate
	               ),
	               @ADD30Day
	           )
	       ) + @Additional
	
	INSERT INTO #Calc
	SELECT #Agreements.PersonelID,
	       #Agreements.ParameterID,
	       2,
	       SUM(Amount * Daylen) / CASE 
	                                   WHEN @Used30ForAverageCalc = 1 THEN 30
	                                   ELSE @MonthLen
	                              END
	FROM   #Agreements
	       INNER JOIN #SelPersonnel
	            ON  #SelPersonnel.PersonelID = #Agreements.PersonelID
	WHERE  #Agreements.ParameterID IN (SELECT fp.ParameterID
	                                   FROM   pay.FormulaParameter fp
	                                          INNER JOIN pay.Formula f
	                                               ON  f.FormulaID = fp.FormulaID
	                                          INNER JOIN #SelParameter p
	                                               ON  p.CalculationMethodID = f.CalculationMethodID
	                                   WHERE  fp.ParameterValueTypeID = 2)
	GROUP BY
	       #Agreements.PersonelID,
	       #Agreements.ParameterID
	
	-- از انواع محاسبه ديگر اضافه شدن مقادير مورد نياز ار محاسبه حقوق همين ماه
	INSERT INTO #Calc
	SELECT c.PersonelID,
	       P.ParameterID,
	       7,
	       cr.[Value]
	FROM   pay.CalculationResult cr
	       INNER JOIN pay.CalculationPersonel c
	            ON  c.CalculationPersonelID = cr.CalculationPersonelID
	       INNER JOIN #selPersonnel
	            ON  c.PersonelID = #selPersonnel.PersonelID
	       INNER JOIN pay.Parameter p
	            ON  p.ParameterID = cr.ParameterID
	WHERE  c.CalendarMonthID = @EfficientMonth
	       AND cr.ParameterValueTypeID = 7
	       AND p.ParameterTypeID NOT IN (1, 7)
	       AND cr.ParameterID IN (SELECT p.ParameterID
	                              FROM   #SelParameter
	                                     INNER JOIN pay.Formula AS f
	                                          ON  #SelParameter.CalculationMethodID = f.CalculationMethodID
	                                     INNER JOIN pay.FormulaParameter fp
	                                          ON  fp.FormulaID = f.FormulaID
	                                     INNER JOIN pay.Parameter p
	                                          ON  p.ParameterID = fp.ParameterID
	                              WHERE  P.CalculationTypeID <> @calcTypeId
	                                     AND fp.ParameterValueTypeID = 7)
	
	INSERT INTO #Calc
	SELECT c.PersonelID,
	       P.ParameterID,
	       16,
	       cr.[Value]
	FROM   pay.CalculationResult cr
	       INNER JOIN pay.CalculationPersonel c
	            ON  c.CalculationPersonelID = cr.CalculationPersonelID
	       INNER JOIN #selPersonnel
	            ON  c.PersonelID = #selPersonnel.PersonelID
	       INNER JOIN pay.Parameter p
	            ON  p.ParameterID = cr.ParameterID
	WHERE  c.CalendarMonthID = @EfficientMonth
	       AND cr.ParameterValueTypeID = 16
	       AND p.ParameterTypeID NOT IN (1, 7)
	       AND cr.ParameterID IN (SELECT p.ParameterID
	                              FROM   #SelParameter
	                                     INNER JOIN pay.FormulaParameter fp
	                                          ON  fp.FormulaID = #SelParameter.FormulaID
	                                     INNER JOIN pay.Parameter p
	                                          ON  p.ParameterID = fp.ParameterID
	                              WHERE  P.CalculationTypeID <> @calcTypeId
	                                     AND fp.ParameterValueTypeID = 16)
	
	--ماه قبل--5
	declare @PreviousCalendarMonthEndDate Date

	select top 1 @PreviousCalendarMonthEndDate =  EndDate
	from hrm.CalendarMonth
	where StartDate < @calculationStartDate
	order by StartDate desc
	
	SELECT PersonelID,
	       T.AgreementID,
	       T.ExecuteDate
	INTO   #AgreementOfPreviousMonth
	FROM   (
	           SELECT a.*,
	                  ROW_NUMBER() OVER(PARTITION BY a.PersonelID ORDER BY a.IssueDate DESC) AS Rno
	           FROM   HRM.Agreement a
	                  INNER JOIN #SelPersonnel
	                       ON  #SelPersonnel.PersonelID = a.PersonelID
	           WHERE  (
	                          @NeedConfirm = 0
	                          OR (
	                                 a.ConfirmDate IS NOT NULL
	                                 AND a.ConfirmDate <= @PreviousCalendarMonthEndDate
	                             )
	                      )
	                  AND a.IssueDate <= @PreviousCalendarMonthEndDate
	       ) T
	WHERE  T.Rno = 1
	
	DECLARE @LastMonthId INT	
	
	SELECT CalculationPersonelID,
	       PersonelID,
	       CalculationTypeID,
		   CalendarMonthID
	INTO   #Start2
	FROM   (
	           SELECT cp.CalculationPersonelID,
	                  cp.PersonelID,
	                  cm.CalendarMonthID,
	                  cp.CalculationTypeID,
	                  ROW_NUMBER() OVER(
	                      PARTITION BY cp.PersonelID,
	                      cp.CalculationTypeID ORDER BY cm.StartDate DESC
	                  ) AS Rno
	           FROM   PAY.CalculationPersonel cp
	                  INNER JOIN HRM.CalendarMonth cm
	                       ON  cm.CalendarMonthID = cp.CalendarMonthID
	                  INNER JOIN #Start
	                       ON  #Start.PersonelID = cp.PersonelID
	                       AND #Start.IssueDate <= cm.EndDate
	           WHERE  cm.StartDate < @calculationStartDate 
	       ) T
	WHERE  T.Rno = 1
	
	INSERT INTO #Calc
	SELECT #Start2.PersonelID,
	       cr.ParameterID,
	       5,
	       cr.[Value]
	FROM   pay.CalculationResult cr
	       INNER JOIN #Start2
	            ON #Start2.CalculationPersonelID = cr.CalculationPersonelID
	       INNER JOIN pay.Parameter p 
				on p.ParameterID = cr.ParameterID
	       INNER JOIN #lastOnlyAggreement a
				on a.PersonelID = #Start2.PersonelID
	       INNER JOIN #AgreementOfPreviousMonth b
				on b.PersonelID = #Start2.PersonelID
			left join #AgreementOrganization ao1 on ao1.AgreementID = a.AgreementID and ao1.OrganizationID = p.OrganizationID
			left join #AgreementOrganization ao2 on ao2.AgreementID = b.AgreementID and ao2.OrganizationID = p.OrganizationID
	WHERE  cr.ParameterValueTypeID = 7
	       AND cr.ParameterID IN (SELECT fp.ParameterID
	                              FROM   pay.FormulaParameter fp
	                                     INNER JOIN pay.Formula f
	                                          ON  f.FormulaID = fp.FormulaID
	                                     INNER JOIN #SelParameter p
	                                          ON  p.CalculationMethodID = f.CalculationMethodID
	                              WHERE  fp.ParameterValueTypeID = 5)
			and (ao1.AgreementID is null or ao1.OrganizationItemID = ao2.OrganizationItemID)

	--   3 سال تا ماه
	SELECT cm.CalendarMonthID
	INTO   #YearCalc
	FROM   Hrm.CalendarMonth cm
	WHERE  cm.CalendarID = @calcYear
	       AND cm.CalendarMonthID <> @EFFicientMonth
	       AND cm.StartDate < @calculationStartDate
	
	SELECT DISTINCT fp.ParameterID
	INTO   #Param_3
	FROM   pay.FormulaParameter fp
	       INNER JOIN pay.Formula f
	            ON  f.FormulaID = fp.FormulaID
	       INNER JOIN #SelParameter p
	            ON  p.CalculationMethodID = f.CalculationMethodID
	WHERE  fp.ParameterValueTypeID = 3
	
	INSERT INTO #Calc
	SELECT PersonelID,
	       ParameterID,
	       3,
	       SUM([Value])
	FROM   (
	           SELECT c.PersonelID,
	                  cr.ParameterID,
	                  VALUE
	           FROM   pay.CalculationResult cr
	                  INNER JOIN pay.CalculationPersonel AS c
	                       ON  c.CalculationPersonelID = cr.CalculationPersonelID
	                  INNER JOIN hrm.CalendarMonth AS cm
	                       ON  cm.CalendarMonthID = c.CalendarMonthID
	                  INNER JOIN #YearCalc
	                       ON  #YearCalc.CalendarMonthID = cm.CalendarMonthID
	                  INNER JOIN #SelPersonnel
	                       ON  #SelPersonnel.PersonelID = c.PersonelID
	                  INNER JOIN #start
	                       ON  #start.personelId = c.PersonelID
	                  INNER JOIN #Param_3
	                       ON  #Param_3.ParameterID = cr.ParameterID
					  join pay.Parameter on Parameter.ParameterID = cr.ParameterID
					  left join #Reset on Parameter.OrganizationID = #Reset.OrganizationID and #Reset.PersonelID = c.PersonelID and cm.EndDate >= #Reset.IssueDate					  
	           WHERE  cr.ParameterValueTypeID IN (7,16)
	                  AND cm.EndDate >= #start.EmploymentDate
	                  AND cm.EndDate <= @calculationDate
					  and(Parameter.OrganizationID is null or #Reset.OrganizationID is not null)
	           UNION ALL
	           
	           SELECT c.PersonelID,
	                  cr.ParameterID,
	                  cr.BackPayValue
	           FROM   pay.CalculationBackPayResult cr
	                  INNER JOIN pay.CalculationPersonel AS c
	                       ON  c.CalculationPersonelID = cr.CalculationPersonelID
	                  INNER JOIN hrm.CalendarMonth AS cm
	                       ON  cm.CalendarMonthID = c.CalendarMonthID
	                  INNER JOIN #YearCalc
	                       ON  #YearCalc.CalendarMonthID = cm.CalendarMonthID
	                  INNER JOIN #SelPersonnel
	                       ON  #SelPersonnel.PersonelID = c.PersonelID
	                  INNER JOIN #start
	                       ON  #start.personelId = c.PersonelID
	                  INNER JOIN #Param_3
	                       ON  #Param_3.ParameterID = cr.ParameterID
	           WHERE  cm.EndDate >= #start.EmploymentDate
	                  AND cm.EndDate <= @calculationDate
	           UNION ALL
	           SELECT Establish.PersonnelID,
	                  Establish.ParameterID,
	                  ISNULL(
	                      CASE 
	                           WHEN Establish.DataEntryType = 2 THEN CAST(Establish.[Value] AS DECIMAL(30, 10)) / 
	                                60.0000000000
	                           WHEN Establish.DataEntryType = 3 THEN CAST(Establish.[Value] / (@WorkHours) AS DECIMAL(30, 10))
	                           ELSE CAST(Establish.[Value] AS DECIMAL(30, 10))
	                      END,
	                      0
	                  )
	           FROM   (
	                      SELECT e.*,
	                             p.DataEntryType
	                      FROM   pay.Establishment e
	                             INNER JOIN #Param_3
	                                  ON  #Param_3.ParameterID = e.ParameterID
	                             INNER JOIN hrm.CalendarMonth AS cm
	                                  ON  cm.CalendarMonthID = e.CalendarMonthID
	                             INNER JOIN PAY.Parameter AS p
	                                  ON  p.ParameterID = e.ParameterID
	                             INNER JOIN #start
	                                  ON  #start.personelId = e.PersonnelID
	                      WHERE  e.CalendarMonthID <> @EfficientMonth
	                             AND cm.StartDate < @calculationStartDate
	                             AND cm.CalendarID = @calcYear
	                             AND cm.EndDate >= #start.EmploymentDate
	                  )Establish
	                  INNER JOIN #SelPersonnel
	                       ON  #SelPersonnel.PersonelID = Establish.PersonnelID
	       )T
	GROUP BY
	       T.PersonelID,
	       T.ParameterID
	
	--تا بحال   4
	INSERT INTO #Calc
	SELECT PersonelID,
	       ParameterID,
	       4,
	       SUM([Value])
	FROM   (
	           SELECT c.PersonelID,
	                  cr.ParameterID,
	                  cr.[Value]
	           FROM   pay.CalculationResult cr
	                  INNER JOIN pay.CalculationPersonel c
	                       ON  c.CalculationPersonelID = cr.CalculationPersonelID
	                  INNER JOIN #SelPersonnel
	                       ON  #SelPersonnel.PersonelID = c.PersonelID
	                  INNER JOIN #start
	                       ON  #start.personelId = c.PersonelID
	                  INNER JOIN HRM.CalendarMonth cm
	                       ON  cm.CalendarMonthID = c.CalendarMonthID
					  join pay.Parameter on Parameter.ParameterID = cr.ParameterID
					  left join #Reset on Parameter.OrganizationID = #Reset.OrganizationID and #Reset.PersonelID = c.PersonelID and cm.EndDate >= #Reset.IssueDate	
	           WHERE  c.CalendarMonthID <> @EFFicientMonth
	                  AND cm.StartDate < @calculationStartDate
	                  AND cm.EndDate >= #start.EmploymentDate
	                  AND cr.ParameterValueTypeID  IN (7,16)
	                  AND cr.ParameterID IN (SELECT fp.ParameterID
	                                         FROM   pay.FormulaParameter fp
	                                                INNER JOIN pay.Formula f
	                                                     ON  f.FormulaID = fp.FormulaID
	                                                INNER JOIN #SelParameter p
	                                                     ON  p.CalculationMethodID = f.CalculationMethodID
	                                         WHERE  fp.ParameterValueTypeID = 4)
					  and(Parameter.OrganizationID is null or #Reset.OrganizationID is not null)
	           UNION ALL
	           
	           SELECT c.PersonelID,
	                  cr.ParameterID,
	                  cr.BackPayValue
	           FROM   pay.CalculationBackPayResult cr
	                  INNER JOIN pay.CalculationPersonel AS c
	                       ON  c.CalculationPersonelID = cr.CalculationPersonelID
	                  INNER JOIN #SelPersonnel
	                       ON  #SelPersonnel.PersonelID = c.PersonelID
	                  INNER JOIN #start
	                       ON  #start.personelId = c.PersonelID
	                  INNER JOIN hrm.CalendarMonth AS cm
	                       ON  cm.CalendarMonthID = c.CalendarMonthID
	                  INNER JOIN hrm.CalendarMonth AS cm2
	                       ON  cm2.CalendarMonthID = c.CalendarMonthID
	           WHERE  cm.StartDate <= @calculationStartDate
	                  AND cm2.EndDate >= #start.EmploymentDate
	                  AND cr.ParameterID IN (SELECT fp.ParameterID
	                                         FROM   pay.FormulaParameter fp
	                                                INNER JOIN pay.Formula f
	                                                     ON  f.FormulaID = fp.FormulaID
	                                                INNER JOIN #SelParameter p
	                                                     ON  p.CalculationMethodID = f.CalculationMethodID
	                                         WHERE  fp.ParameterValueTypeID = 4)
	           UNION ALL

	           SELECT Establish.PersonnelID,
	                  Establish.ParameterID,
	                  ISNULL(Establish.[Value], 0)
	           FROM   (
	                      SELECT e.ParameterID,
	                             e.PersonnelID,
	                             e.CalendarMonthID,
	                             CASE 
	                                  WHEN p.DataEntryType = 2 THEN CAST([Value] AS DECIMAL(30, 10)) / 60.0000000000
	                                  WHEN p.DataEntryType = 3 THEN CAST([Value] / (@WorkHours) AS DECIMAL(30, 10))
	                                  ELSE CAST([Value] AS DECIMAL(30, 10))
	                             END AS [Value]
	                      FROM   pay.Establishment e
	                             INNER JOIN hrm.CalendarMonth AS cm
	                                  ON  cm.CalendarMonthID = e.CalendarMonthID
	                             INNER JOIN PAY.Parameter AS p
	                                  ON  p.ParameterID = e.ParameterID
	                             INNER JOIN #start
	                                  ON  #start.personelId = e.PersonnelID
	                      WHERE  e.CalendarMonthID <> @EfficientMonth
	                             AND cm.StartDate < @calculationStartDate
	                             AND cm.EndDate >= #start.EmploymentDate
	                  )Establish
	                  INNER JOIN #SelPersonnel
	                       ON  #SelPersonnel.PersonelID = Establish.PersonnelID
	           WHERE  Establish.ParameterID IN (SELECT fp.ParameterID
	                                            FROM   pay.FormulaParameter fp
	                                                   INNER JOIN pay.Formula f
	                                                        ON  f.FormulaID = fp.FormulaID
	                                                   INNER JOIN #SelParameter 
	                                                        p
	                                                        ON  p.CalculationMethodID = f.CalculationMethodID
	                                            WHERE  fp.ParameterValueTypeID = 4)
	       )T
	GROUP BY
	       T.PersonelID,
	       T.ParameterID
	
	DECLARE @YearStartDate DATE
	
	SELECT TOP 1 @YearStartDate = StartDate
	FROM   hrm.calendarMonth
	WHERE  CalenDarId = @calcYear
	ORDER BY
	       StartDate 
	
	--تعداد ماههاي مالياتي
	INSERT INTO #Calc
	SELECT #SelPersonnel.PersonelID,
	       0,
	       21,
	       COUNT(*)
	FROM   #SelPersonnel
		 join #Reset on #Reset.PersonelID =  #SelPersonnel.PersonelId and #Reset.TaxTableTypeID is not null
	       INNER JOIN (
	                SELECT *
	                FROM   hrm.CalendarMonth AS cm
	                WHERE  cm.CalendarID = @calcYear
	                       AND cm.StartDate <= @calculationStartDate
	            ) c
	            ON  c.EndDate >= CASE 
	                                  WHEN #Reset.IssueDate > @YearStartDate THEN #Reset.IssueDate
	                                  ELSE @YearStartDate
	                             END 
	WHERE  EXISTS
	       (
	           SELECT fp.ParameterID
	           FROM   pay.FormulaParameter fp
	                  INNER JOIN pay.Formula f
	                       ON  f.FormulaID = fp.FormulaID
	                  INNER JOIN #SelParameter p
	                       ON  p.CalculationMethodID = f.CalculationMethodID
	           WHERE  fp.ParameterValueTypeID = 21
	       )
	GROUP BY
	       #SelPersonnel.PersonelID
	
	--تعداد روزهاي مالياتي
	INSERT INTO #Calc
	SELECT #SelPersonnel.PersonelID,
	       0,
	       20,
	       CASE 
	            WHEN #Reset.IssueDate > @YearStartDate THEN DATEDIFF(dd, #Reset.IssueDate, #Reset.calculationDate) + 
	                 1
	            ELSE DATEDIFF(dd, @YearStartDate, #Reset.calculationDate) + 1
	       END
	FROM   #SelPersonnel
		 join #Reset on #Reset.PersonelID =  #SelPersonnel.PersonelId and #Reset.TaxTableTypeID is not null
	WHERE  EXISTS
	       (
	           SELECT fp.ParameterID
	           FROM   pay.FormulaParameter fp
	                  INNER JOIN pay.Formula f
	                       ON  f.FormulaID = fp.FormulaID
	                  INNER JOIN #SelParameter p
	                       ON  p.CalculationMethodID = f.CalculationMethodID
	           WHERE  fp.ParameterValueTypeID = 20
	       )
	
	--8	تعداد ماههاي محاسبه شده
	INSERT INTO #Calc
	SELECT cp.PersonelID,
	       0,
	       8,
	       COUNT(DISTINCT cp.CalculationPersonelID) + 1
	FROM   pay.CalculationPersonel cp
	       INNER JOIN pay.CalculationPersonel c
	            ON  c.CalculationPersonelID = cp.CalculationPersonelID
	       INNER JOIN HRM.CalendarMonth cm
	            ON  cm.CalendarMonthID = c.CalendarMonthID
	       INNER JOIN #SelPersonnel
	            ON  #SelPersonnel.PersonelID = cp.PersonelID
	WHERE  cm.CalendarMonthID <> @EfficientMonth
	       AND cm.CalendarID = @calcYear
	       AND c.CalculationTypeID = 1
	       AND EXISTS
	           (
	               SELECT fp.ParameterID
	               FROM   pay.FormulaParameter fp
	                      INNER JOIN pay.Formula f
	                           ON  f.FormulaID = fp.FormulaID
	                      INNER JOIN #SelParameter p
	                           ON  p.CalculationMethodID = f.CalculationMethodID
	               WHERE  fp.ParameterValueTypeID = 8
	           )
	GROUP BY
	       cp.PersonelID
	
	--براي افرادي که اولين محاسبه است
	INSERT INTO #Calc
	SELECT #SelPersonnel.PersonelID,
	       0,
	       8,
	       1
	FROM   #SelPersonnel
	WHERE  EXISTS
	       (
	           SELECT fp.ParameterID
	           FROM   pay.FormulaParameter fp
	                  INNER JOIN pay.Formula f
	                       ON  f.FormulaID = fp.FormulaID
	                  INNER JOIN #SelParameter p
	                       ON  p.CalculationMethodID = f.CalculationMethodID
	           WHERE  fp.ParameterValueTypeID = 8
	       )
	       AND NOT EXISTS
	           (
	               SELECT *
	               FROM   #calc
	               WHERE  PersonelID = #SelPersonnel.PersonelID
	                      AND ParameterValueTypeID = 8
	                      AND ParameterId = 0
	           )

	--9	تعداد روزهاي کارکرد
	INSERT INTO #Calc
	SELECT c.PersonelID,
	       0,
	       9,
	       SUM(cr.VALUE)
	FROM   pay.CalculationResult cr
	       INNER JOIN pay.CalculationPersonel c
	            ON  c.CalculationPersonelID = cr.CalculationPersonelID
	       INNER JOIN #SelPersonnel
	            ON  #SelPersonnel.PersonelID = c.PersonelID
	       INNER JOIN HRM.CalendarMonth cm
	            ON  cm.CalendarMonthID = c.CalendarMonthID
	WHERE  cm.CalendarID = @calcYear
	       AND c.CalculationTypeID = 1
	       AND cm.CalendarMonthID <> @EfficientMonth
	       AND cr.ParameterID = @karkardId
	       AND EXISTS
	           (
	               SELECT fp.ParameterID
	               FROM   pay.FormulaParameter fp
	                      INNER JOIN pay.Formula f
	                           ON  f.FormulaID = fp.FormulaID
	                      INNER JOIN #SelParameter p
	                           ON  p.CalculationMethodID = f.CalculationMethodID
	               WHERE  fp.ParameterValueTypeID = 9
	           )
	GROUP BY
	       c.PersonelID
	
	--براي افرادي که اولين محاسبه است
	INSERT INTO #Calc
	SELECT #SelPersonnel.PersonelID,
	       0,
	       9,
	       0
	FROM   #SelPersonnel
	WHERE  EXISTS
	       (
	           SELECT fp.ParameterID
	           FROM   pay.FormulaParameter fp
	                  INNER JOIN pay.Formula f
	                       ON  f.FormulaID = fp.FormulaID
	                  INNER JOIN #SelParameter p
	                       ON  p.CalculationMethodID = f.CalculationMethodID
	           WHERE  fp.ParameterValueTypeID = 9
	       )
	       AND NOT EXISTS
	           (
	               SELECT *
	               FROM   #calc
	               WHERE  PersonelID = #SelPersonnel.PersonelID
	                      AND ParameterValueTypeID = 9
	                      AND ParameterId = 0
	           )
	
	UPDATE #Calc
	SET    [Value] = #Calc.[Value] + cr.[Value]
	FROM   #Calc
	       INNER JOIN #calc cr
	            ON  #calc.PersonelID = cr.PersonelID
	WHERE  #Calc.ParameterValueTypeID = 9
	       AND cr.ParameterID = @karkardId
	
	--10	روزهاي ماههاي محاسبه شده--------------------------------------------------------------
	INSERT INTO #Calc
	SELECT #Reset.PersonelID,
	       0,
	       10,
	       SUM(cm.StandardDays)
	FROM   Hrm.CalendarMonth cm
	       INNER JOIN #Reset
	            ON  cm.EndDate >= #Reset.IssueDate
	            AND cm.StartDate <@calculationStartDate
				and #Reset.TaxTableTypeID is not null
	WHERE  cm.CalendarID = @calcYear
	       AND cm.CalendarMonthID <> @EfficientMonth
	       AND EXISTS
	           (
	               SELECT fp.ParameterID
	               FROM   pay.FormulaParameter fp
	                      INNER JOIN pay.Formula f
	                           ON  f.FormulaID = fp.FormulaID
	                      INNER JOIN #SelParameter p
	                           ON  p.CalculationMethodID = f.CalculationMethodID
	               WHERE  fp.ParameterValueTypeID = 10
	           )
	GROUP BY
	       #Reset.PersonelID
	
	--براي افرادي که اولين محاسبه است
	INSERT INTO #Calc
	SELECT #SelPersonnel.PersonelID,
	       0,
	       10,
	       0
	FROM   #SelPersonnel
	WHERE  EXISTS
	       (
	           SELECT fp.ParameterID
	           FROM   pay.FormulaParameter fp
	                  INNER JOIN pay.Formula f
	                       ON  f.FormulaID = fp.FormulaID
	                  INNER JOIN #SelParameter p
	                       ON  p.CalculationMethodID = f.CalculationMethodID
	           WHERE  fp.ParameterValueTypeID = 10
	       )
	       AND NOT EXISTS
	           (
	               SELECT *
	               FROM   #calc
	               WHERE  PersonelID = #SelPersonnel.PersonelID
	                      AND ParameterValueTypeID = 10
	                      AND ParameterId = 0
	           )
	
	UPDATE #calc
	SET    VALUE = VALUE + @CurretMonthDays
	WHERE  ParameterValueTypeID = 10
	
 --ماه تولد
	INSERT INTO #Calc
	SELECT p.PersonelID,
	       0,
	       18,
	       SUBSTRING(Cfg.GetCLRSaturnDate(p.Birthday, 'YY/MM/DD', 0, 0), 4, 2)
	FROM   #SelPersonnel
	       INNER JOIN hrm.Personel p
	            ON  p.PersonelID = #SelPersonnel.PersonelID
	WHERE  p.Birthday IS NOT NULL
	       AND EXISTS
	           (
	               SELECT fp.ParameterID
	               FROM   pay.FormulaParameter fp
	                      INNER JOIN pay.Formula f
	                           ON  f.FormulaID = fp.FormulaID
	                      INNER JOIN #SelParameter p
	                           ON  p.CalculationMethodID = f.CalculationMethodID
	               WHERE  fp.ParameterValueTypeID = 18
	           )
	
	 --SettlementMonth
	INSERT INTO #Calc
	SELECT a.PersonelID,
	       0,
	       25,
	       CAST(SUBSTRING(Cfg.GetCLRSaturnDate(a.ExecuteDate, 'YY/MM/DD', 0, 0), 4, 2) AS INT)
	FROM   #SelPersonnel
	       INNER JOIN hrm.Agreement AS a
	            ON  a.PersonelID = #SelPersonnel.PersonelID 
	       INNER JOIN hrm.ChangePersonelStatus AS cps ON cps.AgreementID = a.AgreementID AND cps.[STATUS]=3 
	       AND cps.ChangeDate BETWEEN  @calculationStartDate AND DATEADD (DAY,1,@calculationDate)
	       
	  --Employed Years and Days
	  DECLARE @TableName1 NVARCHAR(1000)
	  SET @TableName1 = cfg.getTempTableName(1)
	  
EXEC pay.spCalculationFixedData
	@calculationDate = @calculationDate,
	@TableName = @TableName1,
	@SelectedPersonel = @SelectedPersonnelID,
	@NeedConfirm = @NeedConfirm
	
	SET @Q=N'
	INSERT INTO #Calc
	SELECT PersonelID,
	       0,
	       ParameterValueType,
	       Value
	FROM   '+@TableName1
	
	EXEC (@Q)

	exec('DROP TABLE IF EXISTS ' + @TableName1)

	--روال محاسبه
	--1 محاسبه به ترتيب انواع استخدام صورت مي گيرد  يعني اول تمامي فرمولهاي نوع استخدام الف بعد فرمولهاي نوع استخدام ب و ..
	--2-  به ازا هر نوع اسخدام
	----  فرمولهايي محاسبه مي شود که به هيج  پارامتر محاسباتي ديگري وابسته نيستند
	---------  سپس فرمولهايي محاسبه مي شود که به هيچ پارامر محاسباتي ديگري وابسته نيستند و يا لاينکه در مراحل قبل آن پارامتر هاي محاسباتي محاسبه شده اند
	---------  و به همين طريق تا همه فرمولها محاسبه شوند
	--درج مقادير محاسباتي  يعني مقاديري که بايد محاسبه شوند
	INSERT INTO #Calc
	SELECT cr.PersonelID,
	       p.ParameterID,
	       7,
	       NULL
	FROM   #SelParameter
	       INNER JOIN pay.Parameter p
	            ON  p.ParameterID = #SelParameter.ParameterID
	       INNER  JOIN #SelPersonnel cr
	            ON  cr.EmploymentTypeID = #SelParameter.EmploymentTypeID
	WHERE  #SelParameter.FormulaId IS NOT NULL-- p.ParameterTypeID = 5
	
	INSERT INTO pay.CalculationResult_temp
	SELECT #calc.PersonelID,
	       ParameterID,
	       ParameterValueTypeID,
	       VALUE,
	       EmploymentTypeID,
	       NULL,
	       CAST(ParameterID AS DECIMAL(18, 0)) * 1000000 + CAST(ParameterValueTypeID AS DECIMAL(18, 0)),
		   cp.CalculationPersonelID
	FROM   #Calc
	        INNER JOIN #selPersonnel
	            ON  #Calc.PersonelID = #selPersonnel.PersonelID
			INNER JOIN pay.CalculationPersonel cp
				on cp.CalendarMonthID = @BaseCalendarMonthID
				and cp.CalculationTypeID = @calcTypeId
				and #Calc.PersonelID = cp.PersonelID
		
	IF @IsCalcBackPay = 0
	   AND @calcBackPay = 1
	BEGIN
	    UPDATE cbp
	    SET    BackPayValue = cbp.[Value] - ISNULL(cr.[Value], 0) - ISNULL(crBack.BackPayValue, 0)
	    FROM   #CalculationBackPayResult cbp
	           LEFT JOIN pay.CalculationResult cr
	                ON  cr.CalculationPersonelID = cbp.[BackPayCalculationPersonelID]
	                AND cr.ParameterID = cbp.ParameterID
	                AND cr.ParameterValueTypeID = 7
	           LEFT JOIN (
	                    SELECT a.BackPayCalculationPersonelID,
	                           a.ParameterID,
	                           SUM(a.BackPayValue) AS BackPayValue
	                    FROM   pay.CalculationBackPayResult a
						join pay.CalculationPersonel b on a.CalculationPersonelID = b.CalculationPersonelID
	                    WHERE  a.ParameterValueTypeID = 7
	                           AND b.CalendarMonthID <> @BaseCalendarMonthID
	                    GROUP BY
	                           a.BackPayCalculationPersonelID,
	                           a.ParameterID
	                ) crBack
	                ON  crBack.BackPayCalculationPersonelID = cbp.[BackPayCalculationPersonelID]
	                AND crBack.ParameterID = cbp.ParameterID
	    
	    INSERT INTO Pay.CalculationResult_temp
	      ( PersonelID,
	        ParameterID,
	        ParameterValueTypeID,
	        [Value],
	        EmploymentTypeID,
	        LoanID,
	        ParameterFullID,
			CalculationPersonelID
	      )
	    SELECT PersonelID,
	           P.ParameterID,
	           16,--معوقه
	           SUM(BackPayVALUE),
	           MAX(EmploymentTypeID),
	           NULL,
	           CAST(P.ParameterID AS DECIMAL(18, 0)) * 1000000 + CAST(16 AS DECIMAL(18, 0)),
			   cp.CalculationPersonelID
	    FROM   #CalculationBackPayResult cbp
	           INNER JOIN pay.Parameter p
	                ON  p.ParameterID = cbp.ParameterID
			   INNER JOIN pay.CalculationPersonel cp
				on cp.CalculationPersonelID = cbp.CalculationPersonelID
	    WHERE  BackPayVALUE <> 0
	           AND p.ReCalcable = 1
	           AND p.CalculationTypeID = @calcTypeId
	    GROUP BY
	           cp.PersonelID,
	           p.ParameterID,
			   cp.CalculationPersonelID
	END

	DECLARE @CalcLoan BIT
	
	IF @calcTypeId = 1
	    SET @CalcLoan = 1
	ELSE
	    SET @CalcLoan = 0
	
	IF @CalcLoan = 1
	   AND @IsCalcBackPay = 0
	BEGIN
	    SELECT *
	    INTO   #Loan
	    FROM   (
	               SELECT l.LoanID,
	                      l.ParentID,
	                      l.CalendarMonthID,
	                      l.BaseParentID,
	                      l.InstallmentAmount,
	                      l.TotalAmount,
	                      l.PersonelID,
	                      l.ParameterID,
	                      l.RoundPayment,
	                      l.TotalRound,
	                      ROW_NUMBER() OVER(
	                          PARTITION BY BaseParentID ORDER BY cm.StartDate 
	                          DESC,
	                          l.LastEditionDate DESC
	                      ) AS Rno
	               FROM   pay.Loan l
	                      INNER JOIN #selPersonel
	                           ON  #selPersonel.value = l.PersonelID
	                      INNER JOIN hrm.CalendarMonth cm
	                           ON  cm.CalendarMonthID = l.CalendarMonthID
						 inner join #Start s on s.PersonelID = l.PersonelID 
	               WHERE  cm.StartDate <= @calculationStartDate
				  

	           ) T
	    WHERE  T.Rno = 1 
	    
	    DELETE #loan
	    FROM   #loan
	           INNER JOIN pay.PostponedLoan pl
	                ON  pl.LoanID = #loan.LoanID
	           INNER JOIN pay.PostPone pp
	                ON  pp.PostPoneID = pl.PostponeID
	           INNER JOIN Hrm.CalendarMonth cm
	                ON  cm.CalendarMonthID = pp.StartCalendarMonthID
	           INNER JOIN hrm.CalendarMonth cm2
	                ON  cm2.CalendarMonthID = pp.EndCalendarMonthID
	    WHERE  @calculationDate BETWEEN cm.StartDate AND cm2.EndDate
	    
		SELECT l.BaseParentID,
	           SUM(cr.[Value]) AS VALUE
	    INTO   #payedLoan
	    FROM   Pay.CalculationResult cr
	           INNER JOIN #Loan l
	                ON  l.BaseParentID = cr.LoanID
	    WHERE  cr.ParameterValueTypeID = 7
	    GROUP BY
	           l.BaseParentID
	    --درج مقدار قسط
	    INSERT INTO pay.CalculationResult_temp
	    SELECT l.PersonelID,
	           ParameterID,
	           7,
	           CASE RoundPayment
	                WHEN 1 THEN CASE 
	                                 WHEN ISNULL(#payedLoan.Value, 0) = 0 THEN l.InstallmentAmount
	                                      + l.TotalRound
	                                 ELSE CASE 
	                                           WHEN l.InstallmentAmount <
	                                                TotalAmount -ISNULL(#payedLoan.Value, 0) THEN l.InstallmentAmount
	                                           ELSE TotalAmount -ISNULL(#payedLoan.Value, 0)
	                                      END
	                            END
	                WHEN 2 THEN CASE 
	                                 WHEN 2 * l.InstallmentAmount <
	                                      TotalAmount -ISNULL(#payedLoan.Value, 0) THEN l.InstallmentAmount
	                                 ELSE TotalAmount -ISNULL(#payedLoan.Value, 0)
	                            END
	                ELSE CASE 
	                          WHEN l.InstallmentAmount <
	                               TotalAmount -ISNULL(#payedLoan.Value, 0) THEN l.InstallmentAmount
	                          ELSE TotalAmount -ISNULL(#payedLoan.Value, 0)
	                     END
	           END,
	           EmploymentTypeID,
	           l.BaseParentID,
	           CAST(ParameterID AS DECIMAL(18, 0)) * 1000000 + CAST(7 AS DECIMAL(18, 0)),
			   cp.CalculationPersonelID
	    FROM   #loan l
	           INNER JOIN #selPersonnel
	                ON  l.PersonelID = #selPersonnel.PersonelID
			   INNER JOIN  pay.CalculationPersonel cp	
				on cp.CalendarMonthID = @BaseCalendarMonthID and cp.CalculationTypeID = @calcTypeId and cp.PersonelID = #selPersonnel.PersonelID
	           LEFT JOIN #payedLoan
	                ON  l.BaseParentID = #payedLoan.BaseParentID
	    WHERE  ISNULL(#payedLoan.Value, 0) < TotalAmount
	    --درج مانده قسط
	    INSERT INTO pay.CalculationResult_temp
	    SELECT l.PersonelID,
	           l.ParameterID,
	           14,
	           TotalAmount -ISNULL(#payedLoan.Value, 0) -pay.CalculationResult_temp.[Value],
	           #selPersonnel.EmploymentTypeID,
	           l.BaseParentID,
	           CAST(l.ParameterID AS DECIMAL(18, 0)) * 1000000 + CAST(14 AS DECIMAL(18, 0)),
			   cp.CalculationPersonelID
	    FROM   #loan l
	           INNER JOIN #selPersonnel
	                ON  l.PersonelID = #selPersonnel.PersonelID
	           INNER JOIN pay.CalculationResult_temp
	                ON  pay.CalculationResult_temp.PersonelID = l.PersonelID
	                AND pay.CalculationResult_temp.ParameterID = l.ParameterId
	                AND pay.CalculationResult_temp.LoanID = l.BaseParentID
	           LEFT JOIN #payedLoan
	                ON  l.BaseParentID = #payedLoan.BaseParentID
			   INNER JOIN  pay.CalculationPersonel cp	
				on cp.CalendarMonthID = @BaseCalendarMonthID and cp.CalculationTypeID = @calcTypeId and cp.PersonelID = #selPersonnel.PersonelID
	    WHERE  ISNULL(#payedLoan.Value, 0) + pay.CalculationResult_temp.[Value] 
	           < TotalAmount
	END 
		    
	    --درج هزینه کارکنان
		select cri.PersonelID,sc.ParameterID,sum(cri.ConfirmedAmount) Cost
		into #StaffCost
		from [HRM].[CostRegistration] cr
		join [HRM].[CostRegistrationItem] cri on cr.CostRegistrationID = cri.CostRegistrationID
		join [HRM].[StaffCost] sc on sc.StaffCostID = cri.StaffCostID
		where sc.ParameterID is not null
		and cr.ConfirmDate between @calculationStartDate and @calculationDate
		group by cri.PersonelID,sc.ParameterID

	    INSERT INTO pay.CalculationResult_temp
	    SELECT sc.PersonelID,
	           sc.ParameterID,
	           7,
	           sc.Cost,
	           #selPersonnel.EmploymentTypeID,
	           null,
	           CAST(sc.ParameterID AS DECIMAL(18, 0)) * 1000000 + CAST(14 AS DECIMAL(18, 0)),
			   cp.CalculationPersonelID
	    FROM   #selPersonnel
		INNER JOIN  pay.CalculationPersonel cp	
				on cp.CalendarMonthID = @BaseCalendarMonthID 
				and cp.CalculationTypeID = @calcTypeId 
				and cp.PersonelID = #selPersonnel.PersonelID
		INNER JOIN  #StaffCost sc on sc.PersonelID  = #selPersonnel.PersonelID		

	CREATE TABLE #AggDependency
	(
		AggId                    INT,
		ParamId                  INT,
		parameterValueTypeId     INT
	)
	
	SELECT DISTINCT CalculationAggregateFunctionID
	INTO   #AGG
	FROM   #SelParameter
	       INNER JOIN pay.FormulaParameter fp
	            ON  fp.FormulaID = #SelParameter.FormulaID
	WHERE  fp.CalculationAggregateFunctionID IS NOT NULL
	
	DECLARE EmployCur CURSOR 
	FOR
	    SELECT DISTINCT EmploymentTypeID
	    FROM   #SelPersonnel
	
	OPEN EmployCur
	
	DECLARE @CurrentEmploy INT
	
	FETCH NEXT FROM EmployCur
	INTO @CurrentEmploy
	
	CREATE TABLE #calcParameter
	(
		Id                   INT,
		EmploymentTypeID     INT
	)
	
	CREATE TABLE #MustCalc
	(
		SQLExpression      NVARCHAR(MAX),
		SQLCondition       NVARCHAR(MAX),
		ParameterID        INT,
		OrganizationID     INT,
		FormulaID          INT,
		ReCalcable         BIT
	)
	
	INSERT INTO #calcParameter
	SELECT ParameterId,
	       EmploymentTypeID
	FROM   #SelParameter
	WHERE  ForMulaId IS NULL
	
	WHILE @@FETCH_STATUS = 0
	BEGIN
	    DELETE #AggDependency
	    
	    DECLARE AGG CURSOR 
	    FOR
	        SELECT *
	        FROM   #AGG
	    
	    OPEN AGG
	    
	    DECLARE @AGGId INT
	    FETCH NEXT FROM AGG
	    INTO @AGGId
	    
	    WHILE @@FETCH_STATUS = 0
	    BEGIN
	        DECLARE @CategoryItems          VARCHAR(50),
	                @ParameterTypeItems     VARCHAR(50),
	                @IsTaxable              BIT,
	                @IsInsuranceable        BIT,
	                @ParameterValueTypeItems VARCHAR(50)
	        
	        SELECT @CategoryItems = cae.CategoryItems,
	               @ParameterTypeItems     = cae.ParameterTypeItems,
	               @IsTaxable              = cae.IsTaxable,
	               @IsInsuranceable        = cae.IsInsuranceable,
	               @ParameterValueTypeItems = cae.ParameterValueTypeItems
	        FROM   pay.CalculationAggregateExpression cae
	        WHERE  cae.CalculationAggregateExpressionID = @AGGId
	        	        
	        INSERT INTO #AggDependency
	        SELECT @AGGId,
	               p.ParameterID,
	               T.[VALUE]
	        FROM   #SelParameter2 p -- PAY.Parameter p
	               
	               OUTER APPLY (
	            SELECT VALUE
	            FROM   cfg.R_FnCommaStr2Table(@ParameterValueTypeItems) rfcst
	        )T
	        WHERE  P.EmploymentTypeID = @CurrentEmploy
	               AND (@IsTaxable IS NULL OR p.IsTaxable = @IsTaxable)
	               AND (
	                       @IsInsuranceable IS NULL
	                       OR p.IsInsuranceable = @IsInsuranceable
	                   )
	               AND (
	                       @CategoryItems IS NULL
	                       OR p.CategoryID IN (SELECT VALUE
	                                           FROM   cfg.R_FnCommaStr2Table(@CategoryItems))
	                   )
	               AND (
	                       @ParameterTypeItems IS NULL
	                       OR p.ParameterTypeID IN (SELECT VALUE
	                                                FROM   cfg.R_FnCommaStr2Table(@ParameterTypeItems))
	                   )
	               AND T.[VALUE] = 7
	        
	        FETCH NEXT FROM AGG
	        INTO @AGGId
	    END
	    
	    CLOSE AGG
	    DEALLOCATE AGG

	    IF OBJECT_ID('tempdb..#AllParameter') IS NOT NULL
	        DROP TABLE #AllParameter
	    
	    SELECT DISTINCT ParameterId,
	           OrganizationID
	    INTO   #AllParameter
	    FROM   #SelParameter
	    WHERE  EmploymentTypeID = @CurrentEmploy
	           AND FormulaID IS NOT NULL
   
	    WHILE (
	              SELECT COUNT(*)
	              FROM   #AllParameter
	          ) <> 0
	    BEGIN
	        
        
	       update F
		   SET F.Expression = 0,F.SQLExpression = 0
		   FROM   pay.Formula F
	               INNER JOIN #SelParameter cm
	                    ON  cm.CalculationMethodID = F.CalculationMethodID
	        AND cm.isactive = 0

	        TRUNCATE TABLE #MustCalc
	        
	        INSERT INTO #MustCalc
	        SELECT SQLExpression,
	               pay.Formula.SQLCondition,
	               cm.ParameterID,
	               #AllParameter.OrganizationID,
	               pay.Formula.FormulaID,
	               p.ReCalcable
	        FROM   pay.Formula
	               INNER JOIN #SelParameter cm
	                    ON  cm.CalculationMethodID = pay.Formula.CalculationMethodID
	               INNER JOIN #AllParameter
	                    ON  #AllParameter.ParameterId = cm.ParameterID
	               INNER JOIN pay.Parameter p
	                    ON  p.ParameterID = cm.ParameterID
	        WHERE  cm.EmploymentTypeID = @CurrentEmploy
	               AND NOT EXISTS
	                   (
	                       SELECT fp.FormulaParameterID
	                       FROM   pay.FormulaParameter fp
	                              INNER JOIN pay.Parameter p
	                                   ON  p.ParameterID = fp.ParameterID
	                       WHERE  p.CalculationTypeID = @calcTypeId
	                              AND fp.FormulaID = pay.Formula.FormulaID
	                              AND (
	                                      fp.ParameterID 
	                                      NOT IN (SELECT id
	                                              FROM   #calcParameter
	                                              WHERE  EmploymentTypeID = @CurrentEmploy)
	                                  )
	                              AND (fp.ParameterValueTypeID = 7 OR fp.ParameterValueTypeID = 6)
	                   )
	               AND NOT EXISTS
	                   (
	                       SELECT fp.FormulaParameterID
	                       FROM   pay.FormulaParameter fp
	                              INNER JOIN #AggDependency
	                                   ON  #AggDependency.AggId = fp.CalculationAggregateFunctionID
	                              INNER JOIN #SelParameter
	                                   ON  #SelParameter.ParameterId = #AggDependency.ParamID
	                                   AND #SelParameter.EmploymentTypeId = @CurrentEmploy
	                              INNER JOIN pay.Parameter p
	                                   ON  p.ParameterID = #AggDependency.ParamID
	                       WHERE  NOT (p.SystemName IS NOT NULL AND p.SystemName LIKE 'NS_%')
	                              AND p.CalculationTypeID = @calcTypeId
	                              AND #SelParameter.FormulaId IS NOT NULL
	                              AND #SelParameter.EmploymentTypeID = @CurrentEmploy
	                              AND fp.FormulaID = pay.Formula.FormulaID
	                              AND fp.CalculationAggregateFunctionID IS NOT NULL
	                              AND #AggDependency.ParamID NOT IN (SELECT id
																	  FROM   #calcParameter
																	  WHERE  EmploymentTypeID = @CurrentEmploy)
	                   )
	        

	        DELETE 
	        FROM   #MustCalc
	        WHERE  ParameterID IN (SELECT cm.ParameterID
	                               FROM   pay.Formula f
	                                      INNER JOIN #SelParameter cm
	                                           ON  cm.CalculationMethodID = f.CalculationMethodID
	                                      INNER JOIN #MustCalc M
	                                           ON  m.ParameterID = cm.ParameterID
	                               WHERE  cm.EmploymentTypeID = @CurrentEmploy
	                                      AND f.FormulaID NOT IN (SELECT ISNULL(M3.FormulaID, 0)
	                                                              FROM   #MustCalc 
	                                                                     M3))

	        DECLARE R CURSOR 
	        FOR
	            SELECT SQLExpression,
	                   SQLCondition,
	                   ParameterID,
	                   ISNULL(OrganizationID, -1),
	                   ReCalcable,
	                   FormulaID
	            FROM   #MustCalc
	            ORDER BY
	                   ParameterID
	        
	        OPEN R
	        
	        FETCH NEXT FROM R
	        INTO @Q,@QCondition, @ParameterID,@OrganizationID,@ReCalcable,@FormulaID                                  
	        
	        WHILE @@FETCH_STATUS = 0
	        BEGIN
	            
	            DECLARE @DataEntryType INT
	            
	            SELECT @DataEntryType = p.DataEntryType
	            FROM   pay.Parameter p
	            WHERE  p.ParameterID = @ParameterID
	            
	            IF @IsCalcBackPay = 1
	               AND @ReCalcable = 0
	            BEGIN

	                UPDATE Pay.CalculationResult_temp
	                SET    VALUE = cr.[Value]
	                FROM   Pay.CalculationResult_temp t
	                       INNER JOIN 
						   (
						   select b.PersonelID,a.ParameterID,a.Value
						   from pay.CalculationResult a
						   join pay.CalculationPersonel b	
								on a.CalculationPersonelID = b.CalculationPersonelID
							where b.CalendarMonthID = @CalendarMonthID
							 AND b.CalculationTypeID = @calcTypeId
							 AND a.ParameterValueTypeID = 7
						   )cr
	                            ON  cr.PersonelID = t.PersonelID
	                            AND cr.ParameterID = t.ParameterID
	                           
	                WHERE  t.ParameterValueTypeID = 7
	                       AND t.EmploymentTypeID = @CurrentEmploy
	                       AND t.ParameterID = @ParameterID
	            END
	            ELSE
	            BEGIN

	                DECLARE @usedParameters VARCHAR(MAX),
	                        @usedAggregate VARCHAR(MAX),
	                        @usedSelectParameters VARCHAR(MAX),
	                        @usedSelectAggregate VARCHAR(MAX),
	                        @joinParameter VARCHAR(MAX),
	                        @JoinAggregate VARCHAR(MAX)
	                
	                SELECT @usedAggregate = STUFF(
	                           (
	                               SELECT ',' + QUOTENAME(CAST(fp.CalculationAggregateFunctionID AS VARCHAR(1024)))
	                               FROM   pay.FormulaParameter fp
	                               WHERE  fp.FormulaID = @FormulaID
	                                      AND fp.CalculationAggregateFunctionID 
	                                          IS NOT NULL
	                                          FOR XML PATH(''),
	                                          TYPE
	                           ).value('.', 'NVARCHAR(MAX)'),
	                           1,
	                           1,
	                           ''
	                       )
	                
	                SELECT @usedParameters = STUFF(
	                           (
	                               SELECT CASE 
	                                           WHEN fp.ParameterValueTypeID = 6 THEN CASE 
	                                                                                      WHEN (
	                                                                                               SELECT COUNT(*)
	                                                                                               FROM   
	                                                                                                      pay.FormulaParameter 
	                                                                                                      fp20
	                                                                                               WHERE  fp20.FormulaID = 
	                                                                                                      @FormulaID
	                                                                                                      AND 
	                                                                                                          fp20.ParameterID = 
	                                                                                                          fp.ParameterID
	                                                                                                      AND 
	                                                                                                          fp20.ParameterValueTypeID = 
	                                                                                                          7
	                                                                                           )
	                                                                                           =
	                                                                                           0 THEN ',' 
	                                                                                           +
	                                                                                           QUOTENAME(
	                                                                                               CAST(
	                                                                                                   CAST(ISNULL(fp.ParameterID, 0) AS DECIMAL(18, 0))
	                                                                                                   *
	                                                                                                   1000000 
	                                                                                                   +
	                                                                                                   CAST(7 AS DECIMAL(18, 0)) 
	                                                                                                   AS 
	                                                                                                   VARCHAR(1024)
	                                                                                               )
	                                                                                           )
	                                                                                           +
	                                                                                           ',[51]'
	                                                                                      ELSE ',[51]'
	                                                                                 END
	                                           ELSE ',' + QUOTENAME(
	                                                    CAST(
	                                                        CAST(ISNULL(fp.ParameterID, 0) AS DECIMAL(18, 0))
	                                                        * 1000000 +
	                                                        CAST(fp.ParameterValueTypeID AS DECIMAL(18, 0)) 
	                                                        AS VARCHAR(1024)
	                                                    )
	                                                )
	                                      END
	                               FROM   pay.FormulaParameter fp
	                               WHERE  fp.FormulaID = @FormulaID
	                                      AND ParameterValueTypeID NOT IN (SELECT pvt.ParameterValueTypeID
	                                                                       FROM   pay.ParameterValueType 
	                                                                              pvt
	                                                                       WHERE  pvt.[Type] = 3)
	                                      AND (
	                                              fp.ParameterID IS NOT NULL
	                                              OR fp.ParameterValueTypeID IS 
	                                                 NOT NULL
	                                          )
	                                          FOR XML PATH(''),
	                                          TYPE
	                           ).value('.', 'NVARCHAR(MAX)'),
	                           1,
	                           1,
	                           ''
	                       )
	                
	                
	                SELECT @usedSelectAggregate = STUFF(
	                           (
	                               SELECT ',' + QUOTENAME(CAST(fp.CalculationAggregateFunctionID AS VARCHAR(1024)))
	                                      + ' as ' + QUOTENAME(
	                                          'A' + CAST(fp.CalculationAggregateFunctionID AS VARCHAR(1024))
	                                      )
	                               FROM   pay.FormulaParameter fp
	                               WHERE  fp.FormulaID = @FormulaID
	                                      AND fp.CalculationAggregateFunctionID 
	                                          IS NOT NULL
	                                          FOR XML PATH(''),
	                                          TYPE
	                           ).value('.', 'NVARCHAR(MAX)'),
	                           1,
	                           1,
	                           ''
	                       )
	                
	                SELECT @usedSelectParameters = STUFF(
	                           (
	                               SELECT CASE 
	                                           WHEN fp.ParameterValueTypeID = 6 THEN ',[PAY].[GetTaxTableItem](' 
	                                                +
	                                                QUOTENAME(
	                                                    CAST(
	                                                        CAST(ISNULL(fp.ParameterID, 0) AS DECIMAL(18, 0))
	                                                        * 1000000 +
	                                                        CAST(7 AS DECIMAL(18, 0)) 
	                                                        AS VARCHAR(1024)
	                                                    )
	                                                ) + ',[51]) as ' + QUOTENAME(
	                                                    'P' +
	                                                    CAST(
	                                                        CAST(ISNULL(fp.ParameterID, 0) AS DECIMAL(18, 0))
	                                                        * 1000000 +
	                                                        CAST(fp.ParameterValueTypeID AS DECIMAL(18, 0)) 
	                                                        AS VARCHAR(1024)
	                                                    )
	                                                )
	                                           ELSE ',' + QUOTENAME(
	                                                    CAST(
	                                                        CAST(ISNULL(fp.ParameterID, 0) AS DECIMAL(18, 0))
	                                                        * 1000000 +
	                                                        CAST(fp.ParameterValueTypeID AS DECIMAL(18, 0)) 
	                                                        AS VARCHAR(1024)
	                                                    )
	                                                ) + ' as ' + QUOTENAME(
	                                                    'P' +
	                                                    CAST(
	                                                        CAST(ISNULL(fp.ParameterID, 0) AS DECIMAL(18, 0))
	                                                        * 1000000 +
	                                                        CAST(fp.ParameterValueTypeID AS DECIMAL(18, 0)) 
	                                                        AS VARCHAR(1024)
	                                                    )
	                                                )
	                                      END
	                               FROM   pay.FormulaParameter fp
	                               WHERE  fp.FormulaID = @FormulaID
	                                      AND ParameterValueTypeID NOT IN (SELECT pvt.ParameterValueTypeID
	                                                                       FROM   pay.ParameterValueType 
	                                                                              pvt
	                                                                       WHERE  pvt.[Type] = 3)
	                                      AND (
	                                              fp.ParameterID IS NOT NULL
	                                              OR fp.ParameterValueTypeID IS 
	                                                 NOT NULL
	                                          )
	                                          FOR XML PATH(''),
	                                          TYPE
	                           ).value('.', 'NVARCHAR(MAX)'),
	                           1,
	                           1,
	                           ''
	                       )
	                
	                IF @usedParameters IS NOT NULL
	                    SET @joinParameter = ' Left JOIN (
							 SELECT PersonelID,' + @usedSelectParameters +
	                        '
							FROM  (SELECT PersonelID, ParameterFullID, [Value]
							 from pay.CalculationResult_temp) t20
							 PIVOT(SUM(Value)
							FOR ParameterFullID IN(' + @usedParameters +
	                        ')
							) AS PivotSales
							)T
							ON T.PersonelID=Pay.CalculationResult_temp.PersonelID'	

	                IF @usedAggregate IS NOT NULL
	                    SET @JoinAggregate = ' Left JOIN (
							 SELECT PersonelID,' + @usedSelectAggregate +
	                        '
							FROM  (SELECT PAY.CalculationResult_temp.personelID,cap.CalculationAggregateExpressionID,PAY.CalculationResult_temp.[Value]
							FROM   PAY.CalculationResult_temp
										   INNER JOIN pay.CalculationAggregateParameter cap
												ON  cap.ParameterID = PAY.CalculationResult_temp.ParameterID
												AND cap.ParameterValueTypeID = PAY.CalculationResult_temp.ParameterValueTypeID
												AND cap.EmploymentTypeID = PAY.CalculationResult_temp.EmploymentTypeID
										    INNER JOIN Pay.Parameter P
										    on p.ParameterID=cap.ParameterID
							       where p.CalculationTypeID=' + CAST(@calcTypeId AS VARCHAR(100)) 
	                        +
	                        '
							) t10
						  PIVOT(SUM(Value)
						  FOR CalculationAggregateExpressionID IN(' + @usedAggregate
	                        +
	                        ')
						  ) AS PivotSales
							)T2
							ON T2.PersonelID=Pay.CalculationResult_temp.PersonelID'			  
	                
	                SET @Q = 'Update Pay.CalculationResult_temp Set Value=Round(' +
	                    @Q
	                    + ',' + CASE 
	                                 WHEN @DataEntryType = 0 THEN @decimalNumber
	                                 ELSE '10'
	                            END +
	                    ') ';
	                
	                IF @usedAggregate IS NOT NULL
	                   OR @usedParameters IS NOT NULL
	                    SET @Q = @Q + 'from Pay.CalculationResult_temp'
	                
	                IF @usedAggregate IS NOT NULL
	                    SET @Q = @Q + @JoinAggregate

	                IF @USEDParameters IS NOT NULL
	                    SET @Q = @Q + @JOINparameter
	                
					SET @Q = @Q +
	                    ' where ParameterValueTypeId=7 AND ParameterID=' + CAST(@ParameterID AS VARCHAR(10))
	                    + ' And EmploymentTypeId=' + + CAST(@CurrentEmploy AS VARCHAR(10))
	                    + ' AND (' + CAST(@OrganizationID AS VARCHAR(10)) +
	                    '=-1 OR Exists (select * from #AggOrgan
	                  where  #AggOrgan.PersonelID=Pay.CalculationResult_temp.personelID AND  OrganizationID='
	                    + CAST(@OrganizationID AS VARCHAR(10)) + ' ) )'
	                
	                IF (@QCondition IS NOT NULL)
	                    SET @Q = @Q + ' AND (' + REPLACE(@QCondition, '@personelID', 'personelID') 
	                        + ')'
	                
	                SET @Q = REPLACE(@Q, '[P11]', CAST(@MonthLen AS VARCHAR(512)))
	                SET @Q = REPLACE(@Q, '[P22]', CAST(@YearLen AS VARCHAR(512)))
	                SET @Q = REPLACE(@Q, '[P12]', CAST(@MonOrder AS VARCHAR(512)))
	                SET @Q = REPLACE(@Q, '[P17]', CAST(@MonthHours AS VARCHAR(512)))
	                SET @Q = REPLACE(@Q, '[P24]', CAST(@PMonthLen AS VARCHAR(512)))
	                SET @Q = REPLACE(@Q, '[P23]', CAST(@PMonthHours AS VARCHAR(512)))

	                BEGIN TRY
	                	EXEC (@Q)

	                END TRY
	                BEGIN CATCH
	                	--ROLLBACK
	                	DECLARE @ErrorSeverity INT,
	                	        @ErrorMessage2 NVARCHAR(MAX),
	                	        @ErrorState INT
	                	
	                	SET @ErrorSeverity = ERROR_SEVERITY()
	                	SET @ErrorMessage2 = ERROR_MESSAGE()
	                	SET @ErrorState = ERROR_STATE()
	                	
	                	SET @error = 'E_' + ' بروز خطا در محاسبه عامل ' + (
	                	        SELECT p.Title
	                	        FROM   pay.Parameter p
	                	        WHERE  p.ParameterID = @ParameterID
	                	    ) + ' براي نوع استخدام  '
	                	    + (
	                	        SELECT title
	                	        FROM   hrm.EmploymentType et
	                	        WHERE  et.EmploymentTypeID = @CurrentEmploy
	                	    ) +
	                	    @ErrorMessage2
	                	
	                	RAISERROR (
	                	    @error,	-- Message text.
	                	    @ErrorSeverity,	-- Severity,
	                	    @ErrorState,	-- State,
	                	    NULL,	-- First argument.
	                	    NULL
	                	); -- Second argument.
	                	
	                	RETURN
	                END CATCH
	            END      
	            
  
	            INSERT INTO #calcParameter
	            SELECT @ParameterID,
	                   @CurrentEmploy
	            
	            DELETE #AllParameter
	            WHERE  ParameterId = @ParameterID
	            
            
	            FETCH NEXT FROM R
	            INTO @Q,@QCondition, @ParameterID,@OrganizationID,@ReCalcable,@FormulaID
	        END

	        CLOSE R
	        DEALLOCATE R
	    END
	    
	    FETCH NEXT FROM EmployCur
	    INTO @CurrentEmploy
	END
		
	CLOSE EmployCur
	DEALLOCATE EmployCur
	
	---حذف ردیفهای مربوط به روش محاسبه های غیر فعال شده
		DELETE FROM crt FROM pay.CalculationResult_temp AS crt
	JOIN #selParameter sp ON crt.ParameterID = sp.parameterid AND crt.EmploymentTypeID = sp.EmploymentTypeID
	WHERE sp.IsActive = 0;
