
-------------------------------------
Create   PROCEDURE [HRM].IssueAgreementBatch
(
    @AgreementTypeId           INT = NULL,
    @issueDate                 DATE,
    @ExecuteDate               DATE,
    @DESC                      NVARCHAR(2048),
    @personelIds               VARCHAR(MAX),
    @agreementBatchModelId     INT = NULL,
    @ExpireDate                DATE = NULL,
    @Parameters                NVARCHAR(MAX)
) --WITH ENCRYPTION
AS
	DECLARE @CalendarMonth        NVARCHAR(256),
	        @IssueDateMonthID     INT,
	        @UserId               INT,
	        @Query                NVARCHAR(MAX),
	        @NeedConfirm          BIT
	
	SET @UserId = cfg.GetuserID()
	
	SELECT @NeedConfirm = ConfigValue
	FROM   cfg.Configuration c
	WHERE  c.ConfigKey = 'AgreementNeedConfirm'
	
	
	
	SELECT @CalendarMonth = con.ConfigValue
	FROM   cfg.Configuration con
	WHERE  con.ConfigKey = 'CalendarMonth'
	
	
	SELECT @IssueDateMonthID = cm.CalendarMonthID
	FROM   hrm.CalendarMonth cm
	WHERE  @IssueDate BETWEEN cm.StartDate AND cm.EndDate
	
	DECLARE @PaymentSystemInstalled BIT
	SET @PaymentSystemInstalled = 1
	
	IF @agreementBatchModelId IS NOT NULL
	BEGIN
	    SET @PaymentSystemInstalled = 0
	    SELECT @AgreementTypeId = abm.AgreementTypeID
	    FROM   hrm.AgreementBatchModel AS abm
	    WHERE  abm.AgreementBatchModelID = @agreementBatchModelId
	END
	
	
	IF (
	       SELECT ca.startdate
	       FROM   hrm.CalendarMonth ca
	       WHERE  ca.CalendarMonthID = @CalendarMonth
	   ) > @IssueDate
	   OR (
	          SELECT ca.startdate
	          FROM   hrm.CalendarMonth ca
	          WHERE  ca.CalendarMonthID = @CalendarMonth
	      ) > @ExecuteDate
	BEGIN
	    RAISERROR(
	        'به قبل از تاريخ استقرار نمي توان قراردادي صادر يا اجرا نمود.',
	        16,
	        12
	    )
	    RETURN;
	END
	
	SELECT VALUE AS PersonelID
	INTO   #selPersonel
	FROM   cfg.R_FnCommaStr2Table(@personelIds) AS rfcst
	
	
	IF EXISTS(
	       SELECT cp.CalculationPersonelID
	       FROM   PAY.CalculationPersonel cp
	              INNER JOIN PAY.CalculationType ct
	                   ON  ct.CalculationTypeID = cp.CalculationTypeID
	              INNER JOIN #selPersonel
	                   ON  #selPersonel.PersonelId = cp.PersonelID
	       WHERE  ct.PayTimeType = 0
	              AND cp.CalendarMonthID = @IssueDateMonthID
	   )
	BEGIN
	    RAISERROR(
	        'براي برخي از افراد انتخاب شده  در ماه انتخاب شده محاسبه انجام شده است.',
	        16,
	        12
	    )
	    RETURN;
	END
	
	
	IF EXISTS (
	       SELECT 1
	       FROM   hrm.Agreement AS a
	              INNER JOIN #selPersonel
	                   ON  #selPersonel.PersonelId = a.PersonelID
	                   AND a.IssueDate = @issueDate
	   )
	BEGIN
	    RAISERROR(
	        'براي برخي از افراد انتخاب شده در تاريخ انتخاب شده، قبلا قرارداد صادر شده است.',
	        16,
	        12
	    )
	    RETURN;
	END

-----Parameters ---------------	
		SELECT
CFG.GetStringPart(value, 1) ParameterID,
			   CFG.GetStringPart(value, 2) ExecuteDate
			   INTO #Parameters
FROM
	cfg.[Split](@Parameters, '#')
	
	SELECT t.* 
	INTO   #LastEmploymentAgreement
	FROM   #selPersonel
	       INNER JOIN (
	                SELECT a.*,
	                       ROW_NUMBER() OVER(PARTITION BY a.PersonelID ORDER BY a.IssueDate DESC) AS Rno
	                FROM   hrm.Agreement AS a
	                       INNER JOIN #selPersonel
	                            ON  #selPersonel.PersonelId = a.PersonelID
	                WHERE  a.AgreementTypeID = 0
	            ) T
	            ON  T.Rno = 1
	            AND T.PersonelId = #selPersonel.PersonelId
	            AND T.ExecuteDate > @executeDate --SATURNNEW-3319
	
	SELECT *
	INTO   #lastAgg
	FROM   (
	           SELECT a.*,
	                  et.PaymentSystemID,
	                  j.[group] AS JobGroupId,
	                  ROW_NUMBER() OVER(PARTITION BY a.PersonelID ORDER BY a.IssueDate DESC) AS Rno
	           FROM   hrm.Agreement a
	                  INNER JOIN #selPersonel AS p
	                       ON  a.PersonelID = p.PersonelID
	                  INNER JOIN hrm.EmploymentType AS et
	                       ON  et.EmploymentTypeID = a.EmploymentTypeID
	                  LEFT JOIN hrm.[Job] AS j
	                       ON  j.JobID = a.JobID
	           WHERE  a.IssueDate <= @issueDate
	                  --به فرموده آقاي خسروي
	                  --AND (a.[ExpireDate] IS NULL OR a.[ExpireDate] >= GETDATE())
	       ) T
	WHERE  T.Rno = 1
	
	DECLARE @issueStart     DATE,
	        @execStart      DATE
	
	SELECT @issueStart = cm.StartDate
	FROM   hrm.CalendarMonth AS cm
	WHERE  @IssueDate BETWEEN cm.StartDate AND cm.EndDate
	
	SELECT @execStart = cm.StartDate
	FROM   hrm.CalendarMonth AS cm
	WHERE  @ExecuteDate BETWEEN cm.StartDate AND cm.EndDate
	
	DECLARE @newStatus INT
	SELECT @newStatus = ps.StatusType
	FROM   hrm.AgreementType              AS at
	       INNER JOIN HRM.PersonelStatus  AS ps
	            ON  ps.PersonelStatusID = at.PrePersonelStatusID
	WHERE  at.AgreementTypeID = @AgreementTypeID  
	
	SELECT T.PersonelID,
	       T.[Status]
	INTO   #oldStatus
	FROM   (
	           SELECT cps.PersonelID,
	                  cps.[STATUS],
	                  ROW_NUMBER() OVER(PARTITION BY cps.PersonelID ORDER BY cps.IssueDate DESC) AS Rno
	           FROM   hrm.ChangePersonelStatus AS cps
	                  INNER JOIN #selPersonel
	                       ON  #selPersonel.PersonelId = cps.PersonelID
	           WHERE  cps.ChangeDate <= @ExecuteDate
	       )T
	WHERE  T.rno = 1
	
	IF @execStart < @issueStart
	BEGIN
	    IF EXISTS (
	           SELECT 1
	           FROM   #oldStatus AS os
	           WHERE  @newStatus <> ISNULL([Status], 100)
	                  AND NOT([Status] IS NULL OR [Status] = 3 OR [Status] = 6)
	       )
	    BEGIN
	        RAISERROR('امکان صدور اين نوع حکم به صورت معوقه نمي باشد.', 16, 12)
	        RETURN;
	    END
	END
	
	SET TRANSACTION ISOLATION LEVEL REPEATABLE READ
	
	DECLARE @maxId INT
	
	SELECT @maxId = MAX(AgreementId)
	FROM   hrm.Agreement AS a
	
	
	DECLARE @maxNumber INT
	SELECT @maxNumber = MAX(number)
	FROM   hrm.Agreement AS a
	
	--------------Serial
	DECLARE @AgreementTypeFormID     TINYINT,
	        @Year                    INT
	
	SELECT @Year = cm.CalendarID
	FROM   hrm.CalendarMonth AS cm
	WHERE  @IssueDate BETWEEN cm.StartDate AND cm.EndDate
	
	SELECT @AgreementTypeFormID = at.AgreementTypeFormID
	FROM   hrm.AgreementType AS at
	WHERE  at.AgreementTypeID = @AgreementTypeID
	
	DECLARE @AgreementSerialStartNo      INT,
	        @AgreementSerialAgreementTypeForm BIT,
	        @AgreementSerialAgreementType BIT,
	        @AgreementSerialPersonel     BIT,
	        @AgreementSerialYear         BIT
	
	SELECT @AgreementSerialStartNo = ConfigValue
	FROM   cfg.Configuration c
	WHERE  c.ConfigKey = 'AgreementSerialStartNo'
	
	
	SELECT @AgreementSerialAgreementTypeForm = ConfigValue
	FROM   cfg.Configuration c
	WHERE  c.ConfigKey = 'AgreementSerialAgreementTypeForm'
	
	SELECT @AgreementSerialAgreementType = ConfigValue
	FROM   cfg.Configuration c
	WHERE  c.ConfigKey = 'AgreementSerialAgreementType'
	
	SELECT @AgreementSerialPersonel = ConfigValue
	FROM   cfg.Configuration c
	WHERE  c.ConfigKey = 'AgreementSerialPersonel'
	
	SELECT @AgreementSerialYear = ConfigValue
	FROM   cfg.Configuration c
	WHERE  c.ConfigKey = 'AgreementSerialYear'
	
	------------------------
	INSERT INTO Hrm.Agreement
	       (
	           -- AgreementID -- this column value is auto-generated
	           BranchId,
	           AgreementTypeID,
	           ConfirmDate,
	           PersonelID,
	           Number,
	           IssueDate,
	           ExecuteDate,
	           EmploymentDate,
	           [ExpireDate],
	           EmploymentTypeID,
	           EmploymentStatusID,
	           WorkPlaceID,
	           CostCenterID,
	           PositionID,
			   OrganizationUnitID,
			   IsManagerToOrganizationUnit,
	           JobID,
	           Specification,
	           Specification2,
	           ConfirmedBy,
	           PayrollGroupID,
	           PayrollBaseID,
	           OccupationGradeID,
	           ExperienceLen,
	           Serial,
	           Version,
	           Creator,
	           CreationDate,
	           LastEditor,
	           LastEditionDate
	       )
	SELECT a.BranchId,
	       @AgreementTypeId,
	       NULL,
	       a.PersonelID,
	       @maxNumber + ROW_NUMBER() OVER(ORDER BY a.PersonelId),
	       @issueDate,
	       CASE 
	            WHEN b.AgreementID IS NOT NULL THEN b.EXECUTEDate
	            ELSE @ExecuteDate
	       END,
	       a.EmploymentDate,
	       @ExpireDate,
	       a.EmploymentTypeID,
	       a.EmploymentStatusID,
	       a.WorkPlaceID,
	       a.CostCenterID,
	       a.PositionID,
		   a.OrganizationUnitID,
		   a.IsManagerToOrganizationUnit,
	       a.JobID,
	       @DESC,
	       @DESC,
	       NULL,
	       a.PayrollGroupID,
	       a.PayrollBaseID,
	       a.OccupationGradeID,
	       a.ExperienceLen + DATEDIFF(dd, a.ExecuteDate, @executeDate),
	       ISNULL(
	           (
	               SELECT MAX(serial) + 1
	               FROM   hrm.Agreement AS ab
	                      INNER JOIN hrm.AgreementType AS at
	                           ON  at.AgreementTypeID = ab.AgreementTypeID
	                      INNER JOIN hrm.CalendarMonth AS cm
	                           ON  ab.IssueDate BETWEEN cm.StartDate AND cm.EndDate
	               WHERE  (
	                          @AgreementSerialPersonel = 0
	                          OR ab.PersonelID = a.personelId
	                      )
	                      AND (
	                              @AgreementSerialAgreementTypeForm = 0
	                              OR ISNULL(at.AgreementTypeFormID, 255) = ISNULL(@AgreementTypeFormID, 255)
	                          )
	                      AND (
	                              @AgreementSerialAgreementType = 0
	                              OR ab.AgreementTypeID = @AgreementTypeID
	                          )
	                      AND (@AgreementSerialYear = 0 OR cm.CalendarID = @Year)
	           ),
	           @AgreementSerialStartNo
	       )  ,
	       1,
	       @USerId,
	       GETDATE(),
	       @USerId,
	       GETDATE()
	FROM   #lastAgg a
	       LEFT JOIN #LastEmploymentAgreement b
	            ON  a.PersonelID = b.PersonelID
	ORDER BY
	       a.PersonelId
	
	IF @PaymentSystemInstalled = 1
	BEGIN
	    INSERT INTO hrm.AgreementBaseValue
	           (
	               -- AgreementBaseValueID -- this column value is auto-generated
	               AgreementID,
	               BaseValueID,
	               [Value],
	               Creator,
	               CreationDate,
	               LastEditor,
	               LastEditionDate,
	               Version
	           )
	    SELECT a.AgreementID,
	           ao.BaseValueID,
	           ao.[Value],
	           @USerId,
	           GETDATE(),
	           @USerId,
	           GETDATE(),
	           1
	    FROM   hrm.Agreement AS a
	           INNER JOIN #lastAgg
	                ON  a.PersonelID = #lastAgg.PersonelID
	           INNER JOIN HRM.AgreementBaseValue AS ao
	                ON  ao.AgreementID = #lastAgg.AgreementID
	    WHERE  a.AgreementID > @maxId
	END
	
	INSERT INTO hrm.AgreementOrganization
	       (
	           -- AgreementOrganizationID -- this column value is auto-generated
	           AgreementID,
	           OrganizationItemID,
	           TaxTableTypeID,
	           AssignmentDate,
	           Version,
	           Creator,
	           CreationDate,
	           LastEditor,
	           LastEditionDate
	       )
	SELECT a.AgreementID,
	       ao.OrganizationItemID,
	       ao.TaxTableTypeID,
	       ao.AssignmentDate,
	       1,
	       @USerId,
	       GETDATE(),
	       @USerId,
	       GETDATE()
	FROM   hrm.Agreement AS a
	       INNER JOIN #lastAgg
	            ON  a.PersonelID = #lastAgg.PersonelID
	       INNER JOIN HRM.AgreementOrganization AS ao
	            ON  ao.AgreementID = #lastAgg.AgreementID
	WHERE  a.AgreementID > @maxId
	
	
	INSERT INTO hrm.AgreementParameter
	       (
	           -- AgreementParameterID -- this column value is auto-generated
	           [Type],
	           AgreementID,
	           ParameterID,
	           Amount,
	           ExecuteDate,
	           Version,
	           Creator,
	           CreationDate,
	           LastEditor,
	           LastEditionDate
	       )
	SELECT 1,
	       a.AgreementID,
	       ao.ParameterID,
	       0,
	       pr.ExecuteDate,
	       1,
	       @USerId,
	       GETDATE(),
	       @USerId,
	       GETDATE()
	FROM   hrm.Agreement AS a
	       INNER JOIN #lastAgg
	            ON  a.PersonelID = #lastAgg.PersonelID
	            
	       INNER JOIN (
	                SELECT ROW_NUMBER() OVER(
	                           PARTITION BY cm.EmploymentTypeID,
	                           p.ParameterID ORDER BY cm2.StartDate DESC
	                       )                 rno,
	                       p.ParameterID,
	                       cm.EmploymentTypeID
	                FROM   pay.Parameter  AS p
	                       JOIN pay.CalculationMethod AS cm
	                            ON  cm.ParameterID = p.ParameterID
	                            AND cm.IsActive = 1
	                       JOIN hrm.CalendarMonth AS cm2
	                            ON  cm2.CalendarMonthID = cm.EfficientCalendarMonthID
	                WHERE  p.ParameterTypeID = 4
	                       AND cm2.StartDate <= @ExecuteDate
	            ) ao
	            ON  a.EmploymentTypeID = ao.EmploymentTypeID
	            AND ao.rno = 1
	            JOIN #Parameters pr ON ao.ParameterID = pr.ParameterID
	WHERE  a.AgreementID > @maxId
	
	---------------------------------------941006
	
	IF @PaymentSystemInstalled = 1
	BEGIN
	    SELECT et.EmploymentTypeID,
	           pscm.ParameterID,
	           p.ExecuteDate
	    INTO   #MustParameter
	    FROM   hrm.EmploymentType  AS et
	           INNER JOIN HRM.PaymentSystem AS ps
	                ON  ps.PaymentSystemID = et.PaymentSystemID
	           INNER JOIN (
	                    SELECT PaymentSystemID,
	                           hrm.PaymentSystemCalculationMethod.ParameterID,
	                           ROW_NUMBER() OVER(
	                               PARTITION BY hrm.PaymentSystemCalculationMethod.ParameterID
	                               ORDER BY cm.StartDate DESC
	                           ) AS Rno
	                    FROM   hrm.PaymentSystemCalculationMethod
	                           INNER JOIN HRM.CalendarMonth AS cm
	                                ON  cm.CalendarMonthID = hrm.PaymentSystemCalculationMethod.EfficientCalendarMonthID
	                    WHERE  cm.StartDate <= @ExecuteDate
	                )              AS pscm
	                ON  pscm.PaymentSystemID = ps.PaymentSystemID
	                AND pscm.Rno = 1
	                INNER JOIN #Parameters p ON pscm.ParameterID = p.ParameterID
	    
	    INSERT INTO hrm.AgreementParameter
	           (
	               -- AgreementParameterID -- this column value is auto-generated
	               [Type],
	               AgreementID,
	               ParameterID,
	               Amount,
	               ExecuteDate,
	               Version,
	               Creator,
	               CreationDate,
	               LastEditor,
	               LastEditionDate
	           )
	    SELECT 1,
	           a.AgreementID,
	           mp.ParameterID,
	           0,
	           mp.ExecuteDate,
	           1,
	           @USerId,
	           GETDATE(),
	           @USerId,
	           GETDATE()
	    FROM   hrm.Agreement AS a
	           INNER JOIN #MustParameter mp
	                ON  a.EmploymentTypeID = mp.EmploymentTypeID
	    WHERE  a.AgreementID > @maxId
	           AND NOT EXISTS 
	               (
	                   SELECT 1
	                   FROM   hrm.AgreementParameter tt
	                   WHERE  tt.AgreementID = a.AgreementID
	                          AND tt.ParameterID = mp.ParameterID
	               )
	END
	---
	--UPDATE Agree
	------------------------------------------------------------------
	INSERT INTO hrm.AgreementTranscript
	       (
	           -- AgreementTranscriptID -- this column value is auto-generated
	           AgreementID,
	           AgreementTypeTranscriptID,
	           Creator,
	           CreationDate,
	           LastEditor,
	           LastEditionDate,
	           Version
	       )
	SELECT a.AgreementID,
	       att.AgreementTypeTranscriptID,
	       @USerId,
	       GETDATE(),
	       @USerId,
	       GETDATE(),
	       1
	FROM   hrm.Agreement AS a
	       INNER JOIN HRM.AgreementTypeTranscript AS att
	            ON  a.AgreementTypeID = att.AgreementTypeID
	WHERE  a.AgreementID > @maxId

	CREATE TABLE #Calc
	(
		PersonelID               INT,
		ParameterID              INT,
		ParameterValueTypeID     INT,
		VALUE                    DECIMAL(18, 4)
	)
	
	
	CREATE TABLE #SelParameterFormula
	(
		ParameterID            INT,
		FormulaID              INT,
		SQLExpression          NVARCHAR(MAX),
		SQLCondition           NVARCHAR(MAX),
		InterpretationType     INT,
		PaymentSystemID        INT
	)
	
	SELECT PersonelID,
	       T.AgreementID,
	       T.ExecuteDate,
	       T.ParameterID,
	       T.Amount
	INTO   #lastAggreementValue
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
	           WHERE  a.IssueDate < @IssueDate
	       ) T
	WHERE  T.Rno = 1
	
	
	--Last Agreement
	INSERT INTO #Calc
	SELECT personelID,
	       ParameterID,
	       6,
	       Amount
	FROM   #lastAggreementValue 
	
	--Value Agreement
	IF @PaymentSystemInstalled = 0
	BEGIN
	    INSERT INTO #Calc
	    SELECT #selPersonel.personelID,
	           T.ParameterID,
	           7,
	           0
	    FROM   (
	               SELECT p.ParameterID,
	                      ROW_NUMBER() OVER(PARTITION BY cm.ParameterID ORDER BY cm2.StartDate DESC) AS Rno
	               FROM   hrm.AgreementBatchModel AS abm
	                      INNER JOIN pay.CalculationMethod AS cm
	                           ON  cm.EmploymentTypeID = abm.EmploymentTypeID
	                      INNER JOIN PAY.Parameter AS p
	                           ON  p.ParameterID = cm.ParameterID
	                      INNER JOIN HRM.CalendarMonth AS cm2
	                           ON  cm2.CalendarMonthID = cm.EfficientCalendarMonthID
	               WHERE  cm2.StartDate <= @ExecuteDate
	                      AND p.ParameterTypeID = 4
	           )
	           T
	           CROSS JOIN #selPersonel
	    WHERE  T.Rno = 1
	    
	    
	    UPDATE #calc
	    SET    [VALUE] = T.Value
	    FROM   #calc
	           INNER JOIN #calc T
	                ON  T.PersonelID = #calc.PersonelID
	                AND T.ParameterID = #calc.ParameterID
	    WHERE  #calc.ParameterValueTypeID = 7
	           AND t.ParameterValueTypeID = 6
	           AND NOT EXISTS (
	                   SELECT 1
	                   FROM   hrm.AgreementBatchModelFormula AS abmf
	                   WHERE  abmf.AgreementBatchModelID = @agreementBatchModelId
	                          AND abmf.ParameterID = #calc.ParameterID
	               )
	END
	ELSE
	BEGIN
	    SELECT ati.ParameterID,
	           ati.PaymentSystemID
	    INTO   #ValuableParam
	    FROM   hrm.AgreementTypeInterpretation ati
	    WHERE  ati.AgreementTypeID = @agreementTypeID
	           AND InterpretationType IN (3)
	    
	    SELECT ati.ParameterID,
	           InterpretationType,
	           ati.PaymentSystemID
	    INTO   #SElParam
	    FROM   hrm.AgreementTypeInterpretation ati
	    WHERE  ati.AgreementTypeID = @agreementTypeID
	           AND InterpretationType IN (0, 1, 2)
	    
	    
	    INSERT INTO #Calc
	    SELECT #lastAgg.PersonelID,
	           ParameterID,
	           7,
	           NULL
	    FROM   #SElParam
	           INNER JOIN #lastAgg
	                ON  #lastAgg.PaymentSystemID = #SElParam.PaymentSystemID
	END
	
	--Employed Years and Days
	DECLARE @TableName1 NVARCHAR(1000)
	SET @TableName1 = cfg.getTempTableName(1)
	
	EXEC pay.spCalculationFixedData
	     @calculationDate = @ExecuteDate,
	     @TableName = @TableName1,
	     @SelectedPersonel = @personelIds,
	     @NeedConfirm = @NeedConfirm
	
	SET @Query = 
	    N'
	INSERT INTO #Calc
	SELECT PersonelID,
	       0,
	       ParameterValueType,
	       Value
	FROM   ' + @TableName1
	
	EXEC (@Query)
	
	

	exec('DROP TABLE IF EXISTS ' + @TableName1)

	
	--جنسيت
	INSERT INTO #Calc
	SELECT p.PersonelID,
	       10020,
	       5,
	       p.sex
	FROM   #selPersonel
	       INNER JOIN hrm.Personel AS p
	            ON  p.PersonelID = #selPersonel.PersonelID
	
	--تعداد اولاد
	INSERT INTO #Calc
	SELECT #selPersonel.PersonelID,
	       10002,
	       5,
	       (
	           SELECT COUNT(*)
	           FROM   hrm.[Relative] AS r
	           WHERE  r.PersonelID = #selPersonel.PersonelID
	                  AND r.Relation = 0
	       )
	FROM   #selPersonel 
	
	
	--تعداد اولاد تحت تکفل
	INSERT INTO #Calc
	SELECT #selPersonel.PersonelID,
	       10003,
	       5,
	       (
	           SELECT COUNT(*)
	           FROM   hrm.[Relative] AS r
	           WHERE  r.PersonelID = #selPersonel.PersonelID
	                  AND @ExecuteDate >= r.SponsorshipStartDate
	                  AND (
	                          @ExecuteDate <= r.SponsorshipEndDate
	                          OR r.SponsorshipEndDate IS NULL
	                      )
	                  AND r.Relation = 0
	       )
	FROM   #selPersonel 
	
	--تعداد افراد تحت تکفل
	INSERT INTO #Calc
	SELECT #selPersonel.PersonelID,
	       10004,
	       5,
	       (
	           SELECT COUNT(*)
	           FROM   hrm.[Relative] AS r
	           WHERE  r.PersonelID = #selPersonel.PersonelID
	                  AND @ExecuteDate >= r.SponsorshipStartDate
	                  AND (
	                          @ExecuteDate <= r.SponsorshipEndDate
	                          OR r.SponsorshipEndDate IS NULL
	                      )
	       )
	FROM   #selPersonel 
	
	--تاهل
	INSERT INTO #Calc
	SELECT #selPersonel.PersonelID,
	       10001,
	       5,
	       (
	           SELECT TOP 1 p.MarriageStatus
	           FROM   hrm.PersonelMarriageStatus p
	           WHERE  p.PersonelID = #selPersonel.PersonelID
	                  AND p.ApplyDate <= @ExecuteDate
	           ORDER BY
	                  p.ApplyDate DESC
	       )
	FROM   #selPersonel 
	
	
	--ايثارگري
	INSERT INTO #Calc
	SELECT pd.PersonelID,
	       10030 + pd.DedicationType,
	       5,
	       SUM(DATEDIFF(DAY, pd.FromDate, pd.ToDate) + 1)
	FROM   hrm.PersonelDedication AS pd
	       INNER JOIN #selPersonel
	            ON  #selPersonel.PersonelID = pd.PersonelID
	WHERE  pd.DedicationType <> 4
	       AND pd.ApplyDate <= @EXEcuteDate
	GROUP BY
	       pd.PersonelID,
	       pd.DedicationType
	
	--جانبازي
	INSERT INTO #Calc
	SELECT pd.PersonelID,
	       10030 + 4,
	       5,
	       MAX(pd.Amount)
	FROM   hrm.PersonelDedication AS pd
	       INNER JOIN #selPersonel
	            ON  #selPersonel.PersonelID = pd.PersonelID
	WHERE  pd.DedicationType = 4
	       AND pd.ApplyDate <= @EXEcuteDate
	GROUP BY
	       pd.PersonelID
	
	IF @PaymentSystemInstalled = 1
	BEGIN
	    --مقدار گروه
	    INSERT INTO #Calc
	    SELECT #LastAgg.PersonelID,
	           10009,
	           5,
	           VALUE
	    FROM   hrm.PayrollGroup pg
	           INNER JOIN #LastAgg
	                ON  #LastAgg.PayrollGroupID = pg.PayrollGroupID
	    
	    
	    --مقدار پايه
	    INSERT INTO #Calc
	    SELECT #LastAgg.PersonelID,
	           10010,
	           5,
	           VALUE
	    FROM   hrm.PayrollBase pg
	           INNER JOIN #LastAgg
	                ON  #LastAgg.PayrollBaseID = pg.PayrollBaseID
	    
	    --مقدار رتبه
	    INSERT INTO #Calc
	    SELECT #LastAgg.PersonelID,
	           10011,
	           5,
	           VALUE
	    FROM   hrm.OccupationGrade pg
	           INNER JOIN #LastAgg
	                ON  #LastAgg.OccupationGradeID = pg.OccupationGradeID
	    
	    INSERT INTO #Calc
	    SELECT T.PID,
	           BaseValueID,
	           8,
	           [Value]
	    FROM   (
	               SELECT bvd.*,
	                      #lastAgg.personelID AS PID,
	                      ROW_NUMBER() OVER(
	                          PARTITION BY BaseValueID,
	                          #lastAgg.PersonelId ORDER BY bvd.IssueDate DESC
	                      ) Rno
	               FROM   hrm.BaseValueData bvd
	                      INNER JOIN #lastAgg
	                           ON  #lastAgg.PaymentSystemID = bvd.PaymentSystemID
	                           AND (
	                                   bvd.GroupID IS NULL
	                                   OR bvd.GroupID = #lastAgg.PayrollGroupID
	                               )
	                           AND (bvd.BaseID IS NULL OR bvd.BaseID = #lastAgg.payrollBaseId)
	                           AND (
	                                   bvd.OccupationGradeID IS NULL
	                                   OR bvd.OccupationGradeID = #lastAgg.occupationGradeID
	                               )
	                           AND (bvd.JobID IS NULL OR bvd.JobID = #lastAgg.JobId)
	                           AND (
	                                   bvd.PersonelID IS NULL
	                                   OR bvd.PersonelID = #lastAgg.PersonelId
	                               )
	                           AND (
	                                   bvd.JobGroupID IS NULL
	                                   OR bvd.JobGroupID = #lastAgg.JobGroupId
	                               )
	               WHERE  bvd.ApplyDate <= @ExecuteDate
	                      AND bvd.IssueDate <= @issueDate
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
	    INTO   #karkardParameter
	    FROM   #SelParameterFormula
	           INNER JOIN hrm.PaymentSystemFormulaParameter psfp
	                ON  psfp.PaymentSystemFormulaID = #SelParameterFormula.FormulaID
	           INNER JOIN pay.Parameter p
	                ON  p.ParameterID = psfp.ParameterID
	    WHERE  p.CategoryID = 1
	    
	    
	    
	    INSERT INTO #Calc
	    SELECT pmd.PersonnelID,
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
	           INNER JOIN #lastAgg
	                ON  #lastAgg.personelID = pmd.PersonnelID
	    WHERE  pmd.CalendarMonthID = @calendarMonthID
	           AND ParameterValueTypeID = 7
	    
	    INSERT INTO #Calc
	    SELECT pmd.PersonnelID,
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
	           INNER JOIN #lastAgg
	                ON  #lastAgg.personelID = pmd.PersonnelID
	    WHERE  c.[Year] = @calcYear
	           AND cm.StartDate <= @issueDate
	           AND ParameterValueTypeID = 9
	    GROUP BY
	           pmd.ParameterID,
	           pmd.PersonnelID
	    
	    INSERT INTO #Calc
	    SELECT pmd.PersonnelID,
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
	           INNER JOIN #lastAgg
	                ON  #lastAgg.personelID = pmd.PersonnelID
	    WHERE  cm.StartDate <= @issueDate
	           AND ParameterValueTypeID = 10
	    GROUP BY
	           pmd.ParameterID,
	           pmd.PersonnelID
	END
	
	
	ALTER TABLE #Calc
	ADD ParameterFullId DECIMAL(18, 0)
	
	ALTER TABLE #Calc
	ADD DataEntryType TINYINT
	
	UPDATE #Calc
	SET    ParameterFullId = CAST(ParameterID AS DECIMAL(18, 0)) * 1000000 +
	       CAST(ParameterValueTypeID AS DECIMAL(18, 0))
	
	
	UPDATE #Calc
	SET    DataEntryType = p.DataEntryType
	FROM   #Calc
	       INNER JOIN pay.Parameter AS p
	            ON  p.ParameterID = #Calc.ParameterId
	
	
	------------Calc
	
	DECLARE @decimalNumber VARCHAR(10)
	
	SELECT @decimalNumber = c.PrecisionCount
	FROM   cfg.Currency c
	WHERE  c.CurrencyID = -1
	
	
	CREATE TABLE #Dep
	(
		Orig                INT,
		dep                 INT,
		PaymentSystemID     INT
	)
	
	
	IF @PaymentSystemInstalled = 1
	BEGIN
	    UPDATE #calc
	    SET    [VALUE] = (
	               SELECT TOP 1     VALUE
	               FROM   #calc     c2
	               WHERE  c2.ParameterId = #calc.ParameterId
	                      AND c2.PersonelID = #calc.PersonelID
	                      AND c2.ParameterValueTypeId = 6
	           )
	    FROM   #calc
	           INNER JOIN #lastAgg
	                ON  #lastAgg.PersonelID = #calc.PersonelID
	           INNER JOIN #SelParam
	                ON  #calc.ParameterId = #SelParam.Parameterid
	                AND #SelParam.PaymentSystemID = #lastAgg.PaymentSystemID
	    WHERE  InterpretationType = 0
	           AND ParameterValueTypeId = 7 
	    
	    
	    INSERT INTO #SelParameterFormula
	    SELECT pscm.ParameterID,
	           psf.PaymentSystemFormulaID,
	           psf.SQLExpression,
	           psf.SQLCondition,
	           #SElParam.InterpretationType,
	           pscm.PaymentSystemID
	    FROM   #SElParam
	           INNER JOIN (
	                    SELECT Hrm.PaymentSystemCalculationMethod.*,
	                           ROW_NUMBER() OVER(
	                               PARTITION BY parameterId,
	                               Hrm.PaymentSystemCalculationMethod.PaymentSystemID
	                               ORDER BY cm.StartDate DESC
	                           )           Rno
	                    FROM   Hrm.PaymentSystemCalculationMethod
	                           INNER JOIN HRM.CalendarMonth cm
	                                ON  cm.CalendarMonthID = Hrm.PaymentSystemCalculationMethod.EfficientCalendarMonthID
	                    WHERE  cm.StartDate <= @ExecuteDate
	                           AND Hrm.PaymentSystemCalculationMethod.ParameterID 
	                               IS 
	                               NOT     NULL
	                ) pscm
	                ON  pscm.ParameterID = #SElParam.ParameterID
	                AND pscm.Rno = 1
	           INNER JOIN HRM.PaymentSystemFormula psf
	                ON  psf.PaymentSystemCalculationMethodID = pscm.PaymentSystemCalculationMethodID
	    
	    INSERT INTO #Dep
	    SELECT #SelParameterFormula.ParameterID AS Orig,
	           psfp.ParameterID AS dep,
	           #SelParameterFormula.PaymentSystemID
	    FROM   #SelParameterFormula
	           INNER JOIN hrm.PaymentSystemFormulaParameter psfp
	                ON  psfp.PaymentSystemFormulaID = #SelParameterFormula.FormulaID
	    WHERE  psfp.ParameterValueTypeID = 7
	           AND psfp.ParameterID IN (SELECT parameterID
	                                    FROM   #SelParameterFormula)
	END
	ELSE
	BEGIN
	    INSERT INTO #SelParameterFormula
	    SELECT abmf.ParameterID,
	           abmf.AgreementBatchModelFormulaID,
	           abmf.SQLExpression,
	           abmf.SQLCondition,
	           0,
	           0
	    FROM   hrm.AgreementBatchModelFormula AS abmf
	    WHERE  abmf.AgreementBatchModelID = @agreementBatchModelId
	    
	    
	    
	    INSERT INTO #Dep
	    SELECT #SelParameterFormula.ParameterID AS Orig,
	           abmfp.ParameterID AS dep,
	           0
	    FROM   #SelParameterFormula
	           INNER JOIN hrm.AgreementBatchModelFormulaParameter AS abmfp
	                ON  abmfp.AgreementBatchModelFormulaID = #SelParameterFormula.FormulaID
	    WHERE  abmfp.ParameterValueTypeID = 7
	           AND abmfp.ParameterID IN (SELECT parameterID
	                                     FROM   #SelParameterFormula)
	END
	
	DECLARE @paramId          INT,
	        @FormulaID        INT,
	        @SQlExpr          NVARCHAR(MAX),
	        @SqlCondition     NVARCHAR(MAX)
	
	
	CREATE TABLE #paymentSystemIds
	(
		PaymentsystemID INT
	)
	
	IF @PaymentSystemInstalled = 1
	    INSERT INTO #paymentSystemIds
	    SELECT DISTINCT PaymentSystemID
	    FROM   #lastAgg
	ELSE
	    INSERT INTO #paymentSystemIds
	    SELECT -1
	
	DECLARE paymentSystemCur CURSOR 
	FOR
	    SELECT PaymentsystemID
	    FROM   #paymentSystemIds
	
	DECLARE @CurrentPaymentsystemID INT
	
	OPEN paymentSystemCur
	
	FETCH NEXT FROM paymentSystemCur
	INTO @CurrentPaymentsystemID
	
	WHILE @@FETCH_STATUS = 0
	BEGIN
	    WHILE (
	              SELECT COUNT(*)
	              FROM   #SelParameterFormula
	              WHERE  PaymentSystemID = @CurrentPaymentsystemID
	                     OR  @CurrentPaymentsystemID = -1
	          ) <> 0
	    BEGIN
	        SELECT @paramId = ParameterID
	        FROM   #SelParameterFormula
	        WHERE  (
	                   PaymentSystemID = @CurrentPaymentsystemID
	                   OR @CurrentPaymentsystemID = -1
	               )
	               AND NOT EXISTS (
	                       SELECT *
	                       FROM   #DEP
	                       WHERE  Orig = #SelParameterFormula.ParameterID
	                              AND (
	                                      PaymentSystemID = @CurrentPaymentsystemID
	                                      OR @CurrentPaymentsystemID = -1
	                                  )
	                              AND EXISTS 
	                                  (
	                                      SELECT 1
	                                      FROM   #SelParameterFormula d
	                                      WHERE  d.ParameterId = #DEP.Dep
	                                             AND (
	                                                     PaymentSystemID = @CurrentPaymentsystemID
	                                                     OR @CurrentPaymentsystemID
	                                                        = -1
	                                                 )
	                                  )
	                   )
	        
	        
	        DECLARE @interpretaionType INT
	        DECLARE R CURSOR 
	        FOR
	            SELECT ParameterID,
	                   FormulaID,
	                   SQLExpression,
	                   SQLCondition,
	                   InterpretationType
	            FROM   #SelParameterFormula
	            WHERE  ParameterId = @paramId
	                   AND (
	                           PaymentSystemID = @CurrentPaymentsystemID
	                           OR @CurrentPaymentsystemID = -1
	                       )
	        
	        OPEN R
	        
	        FETCH NEXT FROM R
	        INTO @paramId,
	           @FormulaID,
	           @SQlExpr,
	           @SqlCondition,
	           @interpretaionType
	    
	    
	    WHILE @@FETCH_STATUS = 0
	    BEGIN
	        DECLARE @usedParameters     VARCHAR(MAX),
	                @Q                  NVARCHAR(MAX),
	                @usedSelectParameters VARCHAR(MAX),
	                @joinParameter      VARCHAR(MAX)
	        
	        
	        IF @PaymentSystemInstalled = 0
	        BEGIN
	            SELECT @usedParameters = STUFF(
	                       (
	                           SELECT CASE 
	                                       WHEN fp.ParameterValueTypeID =
	                                            611 THEN CASE 
	                                                          WHEN (
	                                                                   SELECT COUNT(*)
	                                                                   FROM   pay.FormulaParameter 
	                                                                          fp20
	                                                                   WHERE  fp20.FormulaID = @FormulaID
	                                                                          AND fp20.ParameterID = fp.ParameterID
	                                                                          AND fp20.ParameterValueTypeID = 7
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
	                           FROM   hrm.AgreementBatchModelFormulaParameter 
	                                  fp
	                           WHERE  fp.AgreementBatchModelFormulaID = @FormulaID
	                                  AND (
	                                          fp.ParameterID IS NOT NULL
	                                          OR fp.ParameterValueTypeID IS 
	                                             NOT 
	                                             NULL
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
	                                       WHEN fp.ParameterValueTypeID =
	                                            611 THEN ',[PAY].[GetTaxTableItem](' 
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
	                           FROM   hrm.AgreementBatchModelFormulaParameter 
	                                  fp
	                           WHERE  fp.AgreementBatchModelFormulaID = @FormulaID
	                                  AND (
	                                          fp.ParameterID IS NOT NULL
	                                          OR fp.ParameterValueTypeID IS 
	                                             NOT 
	                                             NULL
	                                      )
	                                      FOR XML PATH(''),
	                                      TYPE
	                       ).value('.', 'NVARCHAR(MAX)'),
	                       1,
	                       1,
	                       ''
	                   )
	        END
	        ELSE
	        BEGIN
	            SELECT @usedParameters = STUFF(
	                       (
	                           SELECT CASE 
	                                       WHEN fp.ParameterValueTypeID =
	                                            611 THEN CASE 
	                                                          WHEN (
	                                                                   SELECT COUNT(*)
	                                                                   FROM   pay.FormulaParameter 
	                                                                          fp20
	                                                                   WHERE  fp20.FormulaID = @FormulaID
	                                                                          AND fp20.ParameterID = fp.ParameterID
	                                                                          AND fp20.ParameterValueTypeID = 7
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
	                           FROM   hrm.PaymentSystemFormulaParameter fp
	                           WHERE  fp.PaymentSystemFormulaID = @FormulaID
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
	            
	            SELECT @usedSelectParameters = STUFF(
	                       (
	                           SELECT CASE 
	                                       WHEN fp.ParameterValueTypeID =
	                                            611 THEN ',[PAY].[GetTaxTableItem](' 
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
	                           FROM   hrm.PaymentSystemFormulaParameter fp
	                           WHERE  fp.PaymentSystemFormulaID = @FormulaID
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
	        END
	        
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
	            + ',' + @DECimalNumber +
	            ')  Else ' + @SQlExpr + ' END ';
	        
	        
	        
	        IF @usedParameters IS NOT NULL
	            SET @Q = @Q +
	                'from #calc inner join #lastAgg on #lastAgg.PersonelID= #calc.PersonelID'
	        ELSE
	            SET @Q = @Q + 'from #calc inner join #lastAgg on #lastAgg.PersonelID= #calc.PersonelID'
	        
	        IF @USEDParameters IS NOT NULL
	            SET @Q = @Q + @JOINparameter
	        
	        SET @Q = @Q +
	            ' where ParameterValueTypeId=7 AND ParameterID=' + CAST(@paramId AS VARCHAR(10)) 
	            + ' AND ( PaymentSystemID=' + CAST(@CurrentPaymentsystemID AS VARCHAR(10)) 
	            + ' or ' + CAST(@CurrentPaymentsystemID AS VARCHAR(10)) +
	            '=-1)'
	        
	        IF (@SqlCondition IS NOT NULL)
	            SET @Q = @Q + ' AND (' + REPLACE(@SqlCondition, '@personelID', 'personelID') 
	                + ')'
	        
	        
	        PRINT @Q
	        
	        IF @interpretaionType <> 0
	           OR @CurrentPaymentsystemID = -1
	            EXEC (@Q)
	        
	        
	        FETCH NEXT FROM R
	        INTO @paramId,
	           @FormulaID,
	           @SQlExpr,
	           @SqlCondition,
	           @interpretaionType
	END
	
	CLOSE R
	DEALLOCATE R
	
	DELETE #SelParameterFormula
	WHERE  ParameterID = @paramId
	
	END
	
	FETCH NEXT FROM paymentSystemCur
	INTO @CurrentPaymentsystemID
	END
	
	CLOSE paymentSystemCur
	DEALLOCATE paymentSystemCur
	
	UPDATE hrm.AgreementParameter
	SET    Amount = ISNULL(#Calc.[VALUE], 0)
	FROM   hrm.AgreementParameter
	       INNER JOIN #Calc
	            ON  #Calc.ParameterID = hrm.AgreementParameter.ParameterID
	       INNER JOIN hrm.Agreement AS a
	            ON  #Calc.PersonelID = a.PersonelID
	            AND a.AgreementID = hrm.AgreementParameter.AgreementID
	WHERE  a.AgreementID > @maxId
	       AND #calc.ParameterValueTypeID = 7
	           --END
