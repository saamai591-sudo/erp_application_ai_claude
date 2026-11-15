
/************************************************************
 * Code formatted by SoftTree SQL Assistant © v6.3.153
 * Time: 07/23/2015 11:53:33 ق.ظ
 ************************************************************/

CREATE PROCEDURE [HRM].[CalcConfirmationCeil](@PersonelId INT, @ConfirmationTypeId INT, @IssueDate Date)
--with encryption
AS
	DECLARE @NeedConfirm           BIT,
	        @EmploymentTypeID      INT,
	        @agreementTypeID       INT,
	        @AgreementId           INT,
	        @PayrollGroupID        INT,
	        @payrollBaseId         INT,
	        @occupationGradeID     INT,
	        @JobId                 INT,
	        @ConfirmationFormID  INT
	        
	        
	        
	    SELECT @ConfirmationFormID=ct.ConfirmationFormID
	        FROM  hrm.ConfirmationType ct
	    WHERE ct.ConfirmationTypeID=@ConfirmationTypeId
	
	
	
	SELECT @EmploymentTypeID = t.EmploymentTypeID,
	       @agreementTypeID       = t.AgreementTypeID,
	       @AgreementId           = t.AgreementID,
	       @occupationGradeID     = t.OccupationGradeID,
	       @PayrollGroupID        = t.PayrollGroupID,
	       @payrollBaseId         = t.PayrollBaseID
	FROM   (
	           SELECT *,
	                  ROW_NUMBER() OVER(ORDER BY a.IssueDate DESC) AS Rno
	           FROM   hrm.Agreement a
	           WHERE  a.PersonelID = @PersonelId
	                  AND a.IssueDate <= @IssueDate
	                  AND a.ExecuteDate <= @IssueDate
	                   AND (@NeedConfirm = 0 OR (a.ConfirmDate IS NOT NULL
						AND a.ConfirmDate<=@IssueDate
	                  ))
	                 
	       )T
	WHERE  T.Rno = 1
	
	
	SELECT @NeedConfirm = ConfigValue
	FROM   cfg.Configuration c
	WHERE  c.ConfigKey = 'AgreementNeedConfirm'
	
	
	
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
	       AND ati.PaymentSystemID = @EmploymentTypeID
	       AND InterpretationType IN (3)
	
	
	SELECT pscm.ConfirmationFormID*-1 AS ParameterId,
	       psf.PaymentSystemFormulaID,
	       psf.SQLExpression,
	       psf.SQLCondition
	       INTO #SelParameterFormula
	FROM  
	
	(
		SELECT Hrm.PaymentSystemCalculationMethod.*,ROW_NUMBER() OVER (ORDER BY cm.StartDate desc) Rno FROM 
		Hrm.PaymentSystemCalculationMethod
		INNER JOIN HRM.CalendarMonth cm ON cm.CalendarMonthID = Hrm.PaymentSystemCalculationMethod.EfficientCalendarMonthID
		WHERE cm.StartDate<=@IssueDate
		AND  ConfirmationFormID=@ConfirmationFormID
	) pscm
	           INNER JOIN HRM.PaymentSystemFormula psf
	            ON  psf.PaymentSystemCalculationMethodID = pscm.PaymentSystemCalculationMethodID
	WHERE pscm.Rno=1
	
	
	IF @@ROWCOUNT=0
	BEGIN
		
		SELECT NULL
		return
	END
	
	
	CREATE TABLE #Calc
	(
		PersonelID               INT,
		AgreementID              INT,
		ParameterId              INT,
		ParameterValueTypeId     INT,
		VALUE                    DECIMAL(18, 4)
	)
	
	
	
	INSERT INTO #Calc
	SELECT @personelId,
	       NULL,
	       @ConfirmationFormID*-1,
	       7,
	       NULL
	
	
	--جنسيت
	INSERT INTO #Calc
	SELECT @personelId,
	       NULL,
	       10009,
	       5,
	       (
	           SELECT p.Sex
	           FROM   hrm.Personel p
	           WHERE  p.PersonelID = @personelId
	       )
	
	
	
	--تاهل
	INSERT INTO #Calc
	SELECT @personelId,
	       NULL,
	       10001,
	       5,
	       (
	           SELECT p.MarriageStatus
	           FROM   hrm.Personel p
	           WHERE  p.PersonelID = @personelId
	       )
	
	
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
	           WHERE  ap.ExecuteDate <= @ISSueDate
	                   AND (@NeedConfirm = 0 OR (a.ConfirmDate IS NOT NULL
						AND a.ConfirmDate<=@IssueDate
	                  ))
	                  AND a.IssueDate <= @IssueDate
	                 
	       )        T
	WHERE  T.Rno = 1
	

	
	INSERT INTO #Calc
	SELECT PersonelID,
	       AgreementID,
	       ParameterID,
	       7,
	       Amount
	FROM   #lastAggreement
	
	
	
	INSERT INTO #Calc
	SELECT @PERsonelId,
	       NULL,
	       abv.BaseValueID,
	       8,
	       abv.[Value]
	FROM   hrm.AgreementBaseValue abv
	WHERE  abv.AgreementID = @AgreementId
	
	
	INSERT INTO #Calc
	SELECT @PERsonelId,
	       NULL,
	       10009,
	       5,
	       VALUE
	FROM   hrm.PayrollGroup pg
	WHERE  pg.PayrollGroupID = @PayrollGroupID
	
	
	INSERT INTO #Calc
	SELECT @PERsonelId,
	       NULL,
	       10010,
	       5,
	       VALUE
	FROM   hrm.PayrollBase pg
	WHERE  pg.PayrollBaseID = @payrollBaseId
	
	
	INSERT INTO #Calc
	SELECT @PERsonelId,
	       NULL,
	       10011,
	       5,
	       VALUE
	FROM   hrm.OccupationGrade pg
	WHERE  pg.OccupationGradeID = @occupationGradeID
	
	
	
	INSERT INTO #Calc
	SELECT @personelId,
	       NULL,
	       bvd.BaseValueID,
	       8,
	       bvd.[Value]
	FROM   hrm.BaseValueData bvd
	WHERE  bvd.PaymentSystemID = @PaymentSystemID
	       AND (bvd.GroupID IS NULL OR bvd.GroupID = @PayrollGroupID)
	       AND (bvd.BaseID IS NULL OR bvd.BaseID = @payrollBaseId)
	       AND (
	               bvd.OccupationGradeID IS NULL
	               OR bvd.OccupationGradeID = @occupationGradeID
	           )
	       AND (bvd.JobID IS NULL OR bvd.GroupID = @JobId)
	       AND (bvd.PersonelID IS NULL OR bvd.GroupID = @PersonelId)
	
	
	
	
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
	       END
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
	       )
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
	       )
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
	        @SqlCondition     NVARCHAR(MAX)
	
	
	
	
	
	   SET @paramId=@ConfirmationFormID*-1 
	
	    
	    DECLARE R CURSOR  
	    FOR
	        SELECT *
	        FROM   #SelParameterFormula
	        WHERE  ParameterId = @paramId
	    
	    OPEN R
	    
	    
	    
	    
	    FETCH NEXT FROM R
	    INTO @paramId,@FormulaID,@SQlExpr,@SqlCondition
	    
	    
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
	        
	        
	        SET @Q = 'Update #calc Set Value=Round(' +
	            @SQlExpr
	            + ',' + @DECimalNumber +
	            ') ';
	        
	        IF @usedParameters IS NOT NULL
	            SET @Q = @Q + 'from #calc '
	        
	        IF @USEDParameters IS NOT NULL
	            SET @Q = @Q + @JOINparameter
	        
	        SET @Q = @Q +
	            ' where ParameterValueTypeId=7 AND ParameterID=' + CAST(@paramId AS VARCHAR(10))
	        
	        IF (@SqlCondition IS NOT NULL)
	            SET @Q = @Q + ' AND (' + REPLACE(@SqlCondition, '@personelID', 'personelID') 
	                + ')'
	        
	        
	        PRINT @Q
	        EXEC (@Q)
	        
	        FETCH NEXT FROM R
	        INTO @paramId,@FormulaID,@SQlExpr,@SqlCondition
	    END
	    
	    
	    CLOSE R
	    DEALLOCATE R
	    

	
	SELECT [VALUE]            AS VALUE
	FROM   #Calc
	WHERE  ParameterId = @ConfirmationFormID*-1
