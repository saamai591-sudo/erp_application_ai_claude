CREATE   PROCEDURE [HRM].CalcAgreement(
    @agreementID           INT,
    @agreementTypeID       INT,
    @personelId            INT,
    @PayrollGroupID        INT,
    @payrollBaseId         INT,
    @occupationGradeID     INT,
    @JobId                 INT,
    @EmploymentTypeID      INT,
    @issueDate             Date,
    @ExecDate              Date,
    @ParameterValues       VARCHAR(MAX) = NULL,
    @BaseValueValues       VARCHAR(MAX) = NULL
)
--with encryption
AS
	DECLARE @NeedConfirm BIT
	
	SELECT @NeedConfirm = ConfigValue
	FROM   cfg.Configuration c
	WHERE  c.ConfigKey = 'AgreementNeedConfirm'
	
	DECLARE @JobGroupId INT
	
	
	SELECT @JobGroupId=j.[group] FROM hrm.[Job] AS j
	WHERE j.JobID=@JobId
	
	DECLARE @PaymentSystemID     INT,
	        @decimalNumber       VARCHAR(10)
	
	SELECT @decimalNumber = c.PrecisionCount
	FROM   cfg.Currency c
	WHERE  c.CurrencyID = -1
	
	
	
	SELECT @PaymentSystemID = PaymentSystemID
	FROM   hrm.EmploymentType et
	WHERE  et.EmploymentTypeID = @EmploymentTypeID
	
	CREATE TABLE #selPersonel
	(
		PersonelID INT
	)
	
	INSERT INTO #selPersonel
	SELECT @personelId
	
	
	SELECT ati.ParameterID
	       INTO #ValuableParam
	FROM   hrm.AgreementTypeInterpretation ati
	WHERE  ati.AgreementTypeID = @agreementTypeID
	       AND ati.PaymentSystemID = @PaymentSystemID
	       AND InterpretationType IN (3)
	
	
	SELECT ati.ParameterID,InterpretationType
	       INTO #SElParam
	FROM   hrm.AgreementTypeInterpretation ati
	WHERE  ati.AgreementTypeID = @agreementTypeID
	       AND ati.PaymentSystemID = @PaymentSystemID
	       AND InterpretationType IN (0,1, 2)
	
	
	
	            
	
	SELECT pscm.ParameterID,
	       psf.PaymentSystemFormulaID,
	       psf.SQLExpression,
	       psf.SQLCondition,
	       #SElParam.InterpretationType
	       INTO #SelParameterFormula
	FROM   #SElParam
	       INNER JOIN (
	                SELECT Hrm.PaymentSystemCalculationMethod.*,
	                       ROW_NUMBER() OVER(PARTITION BY parameterId ORDER BY cm.StartDate DESC) Rno
	                FROM   Hrm.PaymentSystemCalculationMethod
	                       INNER JOIN HRM.CalendarMonth cm
	                            ON  cm.CalendarMonthID = Hrm.PaymentSystemCalculationMethod.EfficientCalendarMonthID
	                WHERE  cm.StartDate <= @ExecDate
	                       AND Hrm.PaymentSystemCalculationMethod.ParameterID IS 
	                           NOT NULL
	                       AND Hrm.PaymentSystemCalculationMethod.PaymentSystemID = 
	                           @PaymentSystemID
	            ) pscm
	            ON  pscm.ParameterID = #SElParam.ParameterID
	            AND pscm.Rno = 1
	       INNER JOIN HRM.PaymentSystemFormula psf
	            ON  psf.PaymentSystemCalculationMethodID = pscm.PaymentSystemCalculationMethodID
	
	

	
	CREATE TABLE #Calc
	(
		PersonelID               INT,
		AgreementID              INT,
		ParameterId              INT,
		ParameterValueTypeId     INT,
		VALUE                    DECIMAL(18, 4),
		DataEntryType		     tinyint
	)
	
	
	
	INSERT INTO #Calc
	SELECT @personelId,
	       NULL,
	       ParameterID,
	       7,
	       NULL,
	       null
	FROM   #SElParam
	

	
	
	--جنسيت
	INSERT INTO #Calc
	SELECT @personelId,
	       NULL,
	       10020,
	       5,
	       (
	           SELECT p.Sex
	           FROM   hrm.Personel p
	           WHERE  p.PersonelID = @personelId
	       )
	,NUll
	
	--تعداد اولاد
	INSERT INTO #Calc
	SELECT @personelId,
	       NULL,
	       10002,
	       5,
	       (
	           SELECT COUNT(*)
	           FROM   hrm.[Relative] AS r
	           WHERE  r.PersonelID = @personelId
	           AND r.Relation=0
	       ),
	       NUll
	       
	
	       
	--تعداد اولاد تحت تکفل
	INSERT INTO #Calc
	SELECT @personelId,
	       NULL,
	       10003,
	       5,
	       (
	           SELECT COUNT(*)
	           FROM   hrm.[Relative] AS r
	           WHERE  r.PersonelID = @personelId
	            and (@ExecDate >=r.SponsorshipStartDate or r.SponsorshipStartDate is NULL)
	           AND r.Relation=0
	       ),NUll
	       
	  	       
--تعداد افراد تحت تکفل
	INSERT INTO #Calc
	SELECT @personelId,
	       NULL,
	       10004,
	       5,
	       (
	           SELECT COUNT(*)
	           FROM   hrm.[Relative] AS r
	           WHERE  r.PersonelID = @personelId
	            AND @ExecDate >= r.SponsorshipStartDate 
	        AND (@ExecDate<= r.SponsorshipEndDate OR r.SponsorshipEndDate IS null)
	          
	       )	,NUll   
	   
	
	               
	--تاهل
	INSERT INTO #Calc
	SELECT @personelId,
	       NULL,
	       10001,
	       5,
	       (
	           SELECT top 1 p.MarriageStatus
	           FROM   hrm.PersonelMarriageStatus  p
	           WHERE  p.PersonelID = @personelId
	           AND p.ApplyDate<=@ExecDate
	           ORDER BY p.ApplyDate  desc
	       ),NUll
	
	
	SELECT PersonelID,
	       T.AgreementID,
	       T.ExecuteDate,
	       T.ParameterID,
	       T.Amount
	       INTO     #lastAggreement
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
	                  INNER JOIN #selPersonel
	                       ON  #selPersonel.PersonelID = a.PersonelID
	           WHERE  ap.ExecuteDate <= @ExecDate
	     --               AND (@NeedConfirm = 0 OR (a.ConfirmDate IS NOT NULL
						--AND a.ConfirmDate<=@IssueDate
	     --             ))
	                  AND a.IssueDate < @IssueDate
	                
	       )        T
	WHERE  T.Rno = 1
	
	
	
	INSERT INTO #Calc
	SELECT PersonelID,
	       AgreementID,
	       ParameterID,
	       6,
	       Amount,NUll
	FROM   #lastAggreement
	

	
	
	CREATE TABLE #paramValues
	(
		ParameterID INT,
		VALUE DECIMAL(18,5)
	)
	
	
	CREATE TABLE #baseValueValues
	(
		ParameterID INT,
		VALUE DECIMAL(18,5)
	)
	
	
	if @ParameterValues IS NOT null
		INSERT INTO #paramValues
		SELECT cfg.GetStringPartBySpliter(rfcst.[value], 1, '#') AS ParameterID,
			   Replace(cfg.GetStringPartBySpliter(rfcst.[value], 2, '#'),'/','.') AS VALUE
	       
		FROM   cfg.R_FnCommaStr2Table(@ParameterValues) rfcst
		
	IF @agreementID<>0 AND @ParameterValues IS NULL
		INSERT INTO #paramValues
		SELECT ap.ParameterID, ap.Amount FROM hrm.AgreementParameter AS ap
		WHERE ap.AgreementID=@agreementID
	
	
	
	IF @BaseValueValues IS NOT null
		INSERT INTO #baseValueValues
		SELECT cfg.GetStringPartBySpliter(rfcst.[value], 1, '#') AS ParameterID,
			   Replace(cfg.GetStringPartBySpliter(rfcst.[value], 2, '#'),'/','.') AS VALUE
		FROM   cfg.R_FnCommaStr2Table(@BaseValueValues) rfcst
		
		
	IF @agreementID<>0 AND @BaseValueValues IS null
	INSERT INTO #baseValueValues
		SELECT ap.BaseValueID, ap.[Value] FROM hrm.AgreementBaseValue  AS ap
		WHERE ap.AgreementID=@agreementID
	
	

	
	
	INSERT INTO #Calc
	SELECT @PERsonelId,
	       NULL,
	       #paramValues.ParameterID,
	       7,
	       VALUE,NUll
	FROM   #paramValues
	       INNER JOIN #ValuableParam
	            ON  #ValuableParam.ParameterId = #paramValues.ParameterID
	
	

	
	
	INSERT INTO #Calc
	SELECT @PERsonelId,
	       NULL,
	       ParameterID,
	       8,
	       VALUE,NUll
	FROM   #baseValueValues
	
	--ايثارگري
	
	
	INSERT INTO #Calc
	SELECT @personelId,NULL,10030+pd.DedicationType
	,5,SUM(DATEDIFF(day,pd.FromDate,pd.ToDate)+1),NUll
	 FROM hrm.PersonelDedication AS pd
	INNER JOIN #selPersonel
	ON #selPersonel.PersonelID = pd.PersonelID
	WHERE pd.DedicationType <>4
	AND pd.ApplyDate<=@ExecDate
	GROUP BY pd.PersonelID,pd.DedicationType
	
	
	
	
	--جانبازي
	INSERT INTO #Calc
	SELECT @personelId,NULL,10030+4
	,5,MAX(pd.Amount),NUll
	 FROM hrm.PersonelDedication AS pd
	INNER JOIN #selPersonel
	ON #selPersonel.PersonelID = pd.PersonelID
	WHERE pd.DedicationType =4
		AND pd.ApplyDate<=@ExecDate
	GROUP BY pd.PersonelID
	
	
	
	
	--مقدار گروه
	INSERT INTO #Calc
	SELECT @PERsonelId,
	       NULL,
	       10009,
	       5,
	       VALUE,NUll
	FROM   hrm.PayrollGroup pg
	WHERE  pg.PayrollGroupID = @PayrollGroupID
	
	
	--مقدار پايه
	INSERT INTO #Calc
	SELECT @PERsonelId,
	       NULL,
	       10010,
	       5,
	       VALUE,NUll
	FROM   hrm.PayrollBase pg
	WHERE  pg.PayrollBaseID = @payrollBaseId
	
	--مقدار رتبه
	INSERT INTO #Calc
	SELECT @PERsonelId,
	       NULL,
	       10011,
	       5,
	       VALUE,NUll
	FROM   hrm.OccupationGrade pg
	WHERE  pg.OccupationGradeID = @occupationGradeID
	
	
	
	INSERT INTO #Calc
	SELECT @personelId,
	       NULL,
	       BaseValueID,
	       8,
	       [Value],NUll
	FROM   (
	           SELECT *,
	                  ROW_NUMBER() OVER(PARTITION BY BaseValueID ORDER BY bvd.IssueDate DESC) Rno
	           FROM   hrm.BaseValueData bvd
	           WHERE  bvd.ApplyDate <= @ExecDate
				      AND bvd.IssueDate<=@issueDate
	                  AND bvd.PaymentSystemID = @PaymentSystemID
	                  AND (bvd.GroupID IS NULL OR bvd.GroupID = @PayrollGroupID)
	                  AND (bvd.BaseID IS NULL OR bvd.BaseID = @payrollBaseId)
	                  AND (
	                          bvd.OccupationGradeID IS NULL
	                          OR bvd.OccupationGradeID = @occupationGradeID
	                      )
	                  AND (bvd.JobID IS NULL OR bvd.JobID = @JobId)
	                  AND (bvd.PersonelID IS NULL OR bvd.PersonelID = @PersonelId)
	                AND (bvd.JobGroupID IS NULL OR bvd.JobGroupID = @JobGroupId)
	       )T
	WHERE  T.Rno = 1
	

	
	--درج اطلاعات کارکرد
	DECLARE @calendarMonthID     INT,
	        @calcYear            INT,
	        @WorkHours           DECIMAL(18, 5)
	
	SELECT @calendarMonthID = cm.CalendarMonthID,
	       @calcYear      = c.[Year],
	       @WorkHours     = c.WorkHours
	FROM   hrm.CalendarMonth cm
	       INNER JOIN HRM.Calendar c
	            ON  c.CalendarID = cm.CalendarID
	WHERE  @issueDate BETWEEN cm.StartDate AND cm.EndDate
	
	
	SELECT psfp.ParameterID,
	       psfp.ParameterValueTypeID
	       
	       INTO #karkardParameter
	FROM   #SelParameterFormula
	       INNER JOIN hrm.PaymentSystemFormulaParameter psfp
	            ON  psfp.PaymentSystemFormulaID = #SelParameterFormula.PaymentSystemFormulaID
	       INNER JOIN pay.Parameter p
	            ON  p.ParameterID = psfp.ParameterID
	WHERE  p.CategoryID = 1
	
	
	
	INSERT INTO #Calc
	SELECT @PERsonelId,
	       NULL,
	       pmd.ParameterID,
	       7,
	       CASE 
	            WHEN p.DataEntryType = 2 THEN [Value] / 60.00
	            WHEN p.DataEntryType = 3 THEN [Value] / (@WorkHours)
	            ELSE [Value]
	       END,NUll
	FROM   pay.ParameterMonthlyData pmd
	       INNER JOIN #karkardParameter
	            ON  #karkardParameter.ParameterId = pmd.ParameterID
	       INNER JOIN PAY.Parameter p
	            ON  p.ParameterID = pmd.ParameterID
	WHERE  pmd.CalendarMonthID = @calendarMonthID
	       AND ParameterValueTypeID = 7
	       AND pmd.PersonnelID = @personelId
	
	
	
	INSERT INTO #Calc
	SELECT @PERsonelId,
	       NULL,
	       pmd.ParameterID,
	       9,
	       SUM(
	           CASE 
	                WHEN p.DataEntryType = 2 THEN [Value] / 60.00
	                WHEN p.DataEntryType = 3 THEN [Value] / (@WorkHours)
	                ELSE [Value]
	           END
	       ),NUll
	FROM   pay.ParameterMonthlyData pmd
	       INNER JOIN #karkardParameter
	            ON  #karkardParameter.ParameterId = pmd.ParameterID
	       INNER JOIN HRM.CalendarMonth cm
	            ON  cm.CalendarMonthID = pmd.CalendarMonthID
	       INNER JOIN HRM.Calendar c
	            ON  c.CalendarID = cm.CalendarID
	       INNER JOIN PAY.Parameter p
	            ON  p.ParameterID = pmd.ParameterID
	WHERE  c.[Year] = @calcYear
	       AND cm.StartDate <= @issueDate
	       AND ParameterValueTypeID = 9
	       AND pmd.PersonnelID = @personelId
	GROUP BY
	       pmd.ParameterID
	
	INSERT INTO #Calc
	SELECT @PERsonelId,
	       NULL,
	       pmd.ParameterID,
	       10,
	       SUM(
	           CASE 
	                WHEN p.DataEntryType = 2 THEN [Value] / 60.00
	                WHEN p.DataEntryType = 3 THEN [Value] / (@WorkHours)
	                ELSE [Value]
	           END
	       ),NUll
	FROM   pay.ParameterMonthlyData pmd
	       INNER JOIN #karkardParameter
	            ON  #karkardParameter.ParameterId = pmd.ParameterID
	       INNER JOIN HRM.CalendarMonth cm
	            ON  cm.CalendarMonthID = pmd.CalendarMonthID
	       INNER JOIN HRM.Calendar c
	            ON  c.CalendarID = cm.CalendarID
	       INNER JOIN PAY.Parameter p
	            ON  p.ParameterID = pmd.ParameterID
	WHERE  cm.StartDate <= @issueDate
	       AND ParameterValueTypeID = 10
	       AND pmd.PersonnelID = @personelId
	GROUP BY
	       pmd.ParameterID
	
	
	
	
	
	------------------------------------------
	ALTER TABLE #Calc
	ADD ParameterFullId DECIMAL(18, 0)
	
		
	UPDATE #Calc
	SET    ParameterFullId = CAST(ParameterID AS DECIMAL(18, 0)) * 1000000 +
	       CAST(ParameterValueTypeID AS DECIMAL(18, 0))
	       
	       
	UPDATE #Calc
	SET    DataEntryType=p.DataEntryType
	FROM  #Calc
	INNER JOIN pay.Parameter AS p
	ON p.ParameterID=#Calc.ParameterId
	
	
	UPDATE #calc
	SET [VALUE] = (SELECT TOP 1 VALUE FROM #calc c2
	where c2.ParameterId=#calc.ParameterId AND c2.ParameterValueTypeId=6)
	FROM #calc 
	INNER JOIN #SelParam
	ON #calc.ParameterId=#SelParam.Parameterid
	WHERE  InterpretationType=0
	AND ParameterValueTypeId=7 
	
	
	SELECT #SelParameterFormula.ParameterID AS Orig,
	       psfp.ParameterID AS dep
	       INTO #Dep
	FROM   #SelParameterFormula
	       INNER JOIN hrm.PaymentSystemFormulaParameter psfp
	            ON  psfp.PaymentSystemFormulaID = #SelParameterFormula.PaymentSystemFormulaID
	WHERE  psfp.ParameterValueTypeID = 7
	       AND psfp.ParameterID IN (SELECT parameterID
	                                FROM   #SelParameterFormula)
	
	
	DECLARE @paramId          INT,
	        @FormulaID        INT,
	        @SQlExpr          NVARCHAR(MAX),
	        @SqlCondition     NVARCHAR(MAX),
	        @interpretaionType int
	
	

	
	WHILE (
	          SELECT COUNT(*)
	          FROM   #SelParameterFormula
	      ) <> 0
	BEGIN
	    SELECT @paramId = ParameterID
	    FROM   #SelParameterFormula
	    WHERE  NOT EXISTS (
	               SELECT *
	               FROM   #DEP
	               WHERE  Orig = #SelParameterFormula.ParameterID
	                      AND EXISTS 
	                          (
	                              SELECT *
	                              FROM   #SelParameterFormula d
	                              WHERE  d.ParameterId = #DEP.Dep
	                          )
	           )
	    
	    
	    
	    DECLARE R CURSOR  
	    FOR
	        SELECT *
	        FROM   #SelParameterFormula
	        WHERE  ParameterId = @paramId
	    
	    OPEN R
	    
	    
	    
	    
	    FETCH NEXT FROM R
	    INTO @paramId,@FormulaID,@SQlExpr,@SqlCondition,@interpretaionType
	    
	    
	    WHILE @@FETCH_STATUS = 0
	    BEGIN
	        DECLARE @usedParameters     VARCHAR(MAX),
	                @Q                  NVARCHAR(MAX),
	                @usedSelectParameters VARCHAR(MAX),
	                @joinParameter      VARCHAR(MAX)
	        
	        
	        
	        SELECT @usedParameters = STUFF(
	                   (
	                       SELECT CASE 
	                                   WHEN fp.ParameterValueTypeID = 611 THEN CASE 
	                                                                                WHEN (
	                                                                                         SELECT 
	                                                                                                COUNT(*)
	                                                                                         FROM   
	                                                                                                pay.FormulaParameter 
	                                                                                                fp20
	                                                                                         WHERE  
	                                                                                                fp20.FormulaID = 
	                                                                                                @FormulaID
	                                                                                                AND 
	                                                                                                    fp20.ParameterID = 
	                                                                                                    fp.ParameterID
	                                                                                                AND 
	                                                                                                    fp20.ParameterValueTypeID = 
	                                                                                                    7
	                                                                                     )
	                                                                                     =
	                                                                                     0 THEN 
	                                                                                     ',' 
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
	                                                                                ELSE 
	                                                                                     ',[51]'
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
	                       FROM   hrm.PaymentSystemFormulaParameter fp
	                       WHERE  fp.PaymentSystemFormulaID = @FormulaID
	                              AND (
	                                      fp.ParameterID IS NOT NULL
	                                      OR fp.ParameterValueTypeID IS NOT NULL
	                                  )
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
	                                   WHEN fp.ParameterValueTypeID = 611 THEN 
	                                        ',[PAY].[GetTaxTableItem](' +
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
	                       FROM   hrm.PaymentSystemFormulaParameter fp
	                       WHERE  fp.PaymentSystemFormulaID = @FormulaID
	                              AND (
	                                      fp.ParameterID IS NOT NULL
	                                      OR fp.ParameterValueTypeID IS NOT NULL
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
							 from #calc) t20
							 PIVOT(SUM(Value)
							FOR ParameterFullID IN(' + @usedParameters +
	                ')
							) AS PivotSales
							)T
							ON T.PersonelID=#calc.PersonelID'	
	        
	       
	        SET @Q = 'Update #calc Set Value=Case When #calc.DataEntryType=0 then  Round(' +
	            @SQlExpr
	            + ',' + @decimalNumber +
	            ')  Else '+@SQlExpr+' END ';
	        
	        IF @usedParameters IS NOT NULL
	            SET @Q = @Q + 'from #calc '
	        
	        IF @USEDParameters IS NOT NULL
	            SET @Q = @Q + @JOINparameter
	        
	        SET @Q = @Q +
	            ' where ParameterValueTypeId=7 AND ParameterID=' + CAST(@paramId AS VARCHAR(10))
	        
	        IF (@SqlCondition IS NOT NULL)
	            SET @Q = @Q + ' AND (' + REPLACE(@SqlCondition, '@personelID', 'personelID') 
	                + ')'
	        
	   --      IF @paramId=21106
				--PRINT  @Q
				
				
	       -- PRINT @Q
	        IF @interpretaionType<>0
				EXEC (@Q)
	        
	        FETCH NEXT FROM R
	        INTO @paramId,@FormulaID,@SQlExpr,@SqlCondition,@interpretaionType
	    END
	    
	    
	    CLOSE R
	    DEALLOCATE R
	    
	    DELETE #SelParameterFormula
	    WHERE  ParameterID = @paramId
	END
	SELECT #Calc.ParameterId  AS [Key],
	       [VALUE]            AS VALUE
	FROM   #Calc
	       INNER JOIN #SelParam
	            ON  #selParam.parameterId = #Calc.ParameterId
	WHERE  ParameterValueTypeId = 7
	
