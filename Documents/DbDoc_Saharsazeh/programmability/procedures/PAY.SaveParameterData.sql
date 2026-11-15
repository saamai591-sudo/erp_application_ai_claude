
--------------------------------------
CREATE    PROCEDURE [PAY].SaveParameterData
(
    @CalendarMonthId          INT,
    @IssueCalendarMonthID     INT,
    @Changes                  VARCHAR(MAX),
    @UserName                 NVARCHAR(512)
)
--WITH ENCRYPTION
AS
	IF @Changes IS NULL
	   OR @Changes = ''
	    RETURN 
	
	
	DECLARE @CurretMonthDays       INT,
	        @StartDate             DATE,
	        @EndDate               DATE,
	        @CurrentMonthHours     INT
	
	SELECT @CurretMonthDays = cm.StandardDays,
	       @StartDate             = cm.StartDate,
	       @EndDate               = cm.EndDate,
	       @CurrentMonthHours     = cm.PermittedHours
	FROM   Hrm.CalendarMonth cm
	WHERE  cm.CalendarMonthID = @CalendarMonthId
	
	
	
	
	SELECT *
	INTO   #T
	FROM   cfg.R_FnCommaStr2Table(@changes) rfcst
	
	

	
	DECLARE @UserId INT
	
	SELECT @UserId = u.UserID
	FROM   cfg.[User] u
	WHERE  u.Username = @UserName
	
	SELECT CAST(cfg.GetStringPartBySpliter(VALUE, 1, '#') AS INT) AS PersonelId,
	       CAST(cfg.GetStringPartBySpliter(VALUE, 2, '#') AS INT) AS ParameterId,
	       CAST(
	           cfg.GetStringPartBySpliter(VALUE, 3, '#') AS DECIMAL(30, 4)
	       ) AS VALUE,
	       CAST(cfg.GetStringPartBySpliter(VALUE, 4, '#') AS INT) AS DocumentId,
	       CAST(cfg.GetStringPartBySpliter(VALUE, 5, '#') AS INT) AS ItemType
	INTO   #T2
	FROM   #T
	
	
	DECLARE @CalculationTypeId INT
	
	
	SELECT TOP 1 @CalculationTypeId = p.CalculationTypeID
	FROM   pay.Parameter AS p
	       INNER JOIN #T2
	            ON  p.ParameterID = #T2.ParameterId
	
	DECLARE @error NVARCHAR(1024) 
	
	
	SELECT *	
	INTO #vwPersonelEmploymenType
	 FROM hrm.vwPersonelEmploymenType AS vpet
	WHERE vpet.CalendarMonthID = @IssueCalendarMonthID
	
	SELECT * INTO #DisabledParameters
	FROM (
	SELECT ROW_NUMBER() OVER (PARTITION BY cm.EmploymentTypeID,cm.ParameterID ORDER BY cm2.EndDate) rno,cm.IsActive,cm.ParameterID,cm.EmploymentTypeID,cm2.CalendarMonthID,cm2.EndDate
	 FROM pay.CalculationMethod AS cm
	JOIN hrm.CalendarMonth AS cm2 ON cm2.CalendarMonthID = cm.EfficientCalendarMonthID
	WHERE cm2.EndDate<=@EndDate
	) a WHERE a.rno = 1 AND a.IsActive = 0
	
	
	
	-- check if Parameter is disabled
	SET @error = Null
	       SELECT @error =  N'عامل '+p.Title +N' برای نوع استخدام '+ et.Title
	       FROM   #T2 t
	              INNER JOIN #vwPersonelEmploymenType AS vpet
	                   ON  t.PersonelID = vpet.PersonelID
	              INNER JOIN pay.Parameter AS p ON t.ParameterID = p.ParameterID	              
	              INNER JOIN hrm.EmploymentType AS et ON vpet.EmploymentTypeID = et.EmploymentTypeID   
	              LEFT JOIN #DisabledParameters dp ON vpet.EmploymentTypeID = dp.EmploymentTypeID AND t.ParameterID = dp.ParameterID
	              
	       WHERE dp.ParameterID IS NOT NULL
	       GROUP BY et.Title,p.Title
	   
	   IF @error IS NOT NULL
	   
	   
	BEGIN
	    SET @error = 'E_' +  @error+ N' غیر فعال شده است. ' 
	    
	    RAISERROR (
	        @error,	-- Message text.
	        16,	-- Severity,
	        1,	-- State,
	        NULL,	-- First argument.
	        NULL
	    ); -- Second argument.
	    RETURN
	END
	
	--------Check if calculation exists
		IF EXISTS (
	       SELECT 1
	       FROM   #T2
	              INNER JOIN (
	                       SELECT DISTINCT cp.PersonelID
	                       FROM    pay.CalculationPersonel cp
						   join hrm.CalendarMonth cm on cp.CalendarMonthID = cm.CalendarMonthID
						   join hrm.Personel p on cp.PersonelID = p.PersonelID
	                       WHERE  cm.EndDate >=@EndDate
	                              AND cp.CalculationTypeID = @CalculationTypeId
	                   ) calc
	                   ON  calc.PersonelID = #T2.PersonelID
	   )
	BEGIN
	    SET @error = 'E_' +  'برای برخی از افراد در ماه انتخاب شده یا ماههای بعد محاسبه انجام شده است ' 
	    
	    RAISERROR (
	        @error,	-- Message text.
	        16,	-- Severity,
	        1,	-- State,
	        NULL,	-- First argument.
	        NULL
	    ); -- Second argument.
	    RETURN
	END
	
	
	
	
	
	
	--SATURNNEW-3401
	DECLARE @decimalNumber INT
	
	SELECT @decimalNumber = c.PrecisionCount
	FROM   cfg.Currency c
	WHERE  c.CurrencyID = -1
	
	
	UPDATE #T2
	SET    [VALUE] = ROUND([VALUE], @decimalNumber)
	FROM   #T2
	       INNER JOIN Pay.Parameter AS p
	            ON  p.ParameterID = #t2.ParameterID
	WHERE  p.DataEntryType = 0
	
	--END SATURNNEW-3401
	
	DECLARE @NeedConfirm BIT
	
	SELECT @NeedConfirm = ConfigValue
	FROM   cfg.Configuration c
	WHERE  c.ConfigKey = 'AgreementNeedConfirm'
	
	
	DECLARE @PersonelID VARCHAR(20)
	
	
	SELECT p.ParameterID,
	       p.DataEntryType
	INTO   #Karkard
	FROM   pay.Parameter p
	WHERE  p.SystemName = 'Karkard'
	
	
	
	
	CREATE TABLE #Mabna
	(
		id             INT IDENTITY,
		PersonelID     INT,
		StartDate      DATETIME,
		EndDate        DATETIME,
		IssueDate      DATETIME,
		AllowLen       DECIMAL(18, 5),
		IsManfi        INT
	) 
		
	INSERT INTO #Mabna
	SELECT cps.PersonelID,
	       cps.ChangeDate,
	       NULL,
	       IssueDate,
	       0,
	       CASE 
	            WHEN cps.[Status] IN (0, 1, 3, 6) THEN 0
	            ELSE 1
	       END
	       --DATEDIFF(dd,@StartDate , cps.ChangeDate)
	FROM   hrm.ChangePersonelStatus cps
	       INNER JOIN #T2
	            ON  #T2.PersonelId = cps.PersonelID
	       INNER JOIN #Karkard
	            ON  #Karkard.parameterId = #t2.parameterID
	WHERE  cps.ChangeDate BETWEEN @StartDate AND @EndDate
	
	
	
	
	INSERT INTO #Mabna
	SELECT DISTINCT m.PersonelID,
	       @StartDate,
	       NULL,
	       GETDATE(),
	       0,
	       1
	FROM   #Mabna AS m
	       INNER JOIN (
	                SELECT *,
	                       ROW_NUMBER() OVER(
	                           PARTITION BY PersonelID ORDER BY ChangeDate DESC,
	                           IssueDate DESC
	                       ) AS Rno
	                FROM   hrm.ChangePersonelStatus
	                WHERE  IssueDate <= @EndDate
	                       AND ChangeDate <= @StartDate
	            ) csp
	            ON  csp.PersonelID = m.PersonelID
	            AND csp.Rno = 1
	            AND csp.[STATUS] NOT IN (0, 1, 3, 6)
	
	
	UPDATE #Mabna
	SET    EndDate = ISNULL(
	           (
	               SELECT TOP 1      StartDate
	               FROM   #mabna     t
	               WHERE  t.PersonelID = #Mabna.PersonelID
	                      AND (
	                              t.StartDate > #mabna.StartDate
	                              OR (
	                                     t.StartDate = #mabna.StartDate
	                                     AND t.IssueDate > #mabna.IssueDate
	                                 )
	                          )
	                      AND t.Id <> #mabna.ID
	               ORDER BY
	                      t.StartDate
	           ),
	           DATEADD(dd, 1, @EndDate)
	       )
	
	
	
	
	
	
	UPDATE #Mabna
	SET    AllowLen = DATEDIFF(D, StartDate, EndDate) --+ 1
	
	
	
	
	
	
	
	
	SELECT @PersonelID = p2.Code
	FROM   #T2
	       INNER JOIN hrm.Personel p2
	            ON  p2.PersonelID = #T2.PersonelId
	       INNER JOIN #Karkard
	            ON  #karkard.ParameterId = #t2.ParameterId
	WHERE  VALUE IS NOT NULL
	       AND (
	               (
	                   #karkard.DataEntryType = 1
	                   AND CAST(VALUE AS bigint) > @CurretMonthDays
	               )
	               OR (
	                      #karkard.DataEntryType = 2
	                      AND CAST(VALUE AS bigint) > @CurrentMonthHours
	                  )
	           )
	
	
	
	
	IF @PersonelID IS NOT NULL
	BEGIN
	    SET @error = 'E_' + ' کارکرد مربوط به پرسنل ' +
	        @PersonelID + ' معتبر نمي باشد  '
	    
	    
	    RAISERROR (
	        @error,	-- Message text.
	        16,	-- Severity,
	        1,	-- State,
	        NULL,	-- First argument.
	        NULL
	    ); -- Second argument.
	    RETURN
	END
	
	
	
	
	
	
	
	SELECT @PersonelID = p2.Code
	FROM   #T2
	       INNER JOIN hrm.Personel p2
	            ON  p2.PersonelID = #T2.PersonelId
	       INNER JOIN (
	                SELECT PersonelID,
	                       SUM(AllowLen * IsManfi) AS AllowLen
	                FROM   #Mabna
	                GROUP BY
	                       PersonelID
	            )Mabna
	            ON  Mabna.PersonelID = p2.PersonelID
	       INNER JOIN #Karkard
	            ON  #karkard.ParameterId = #t2.ParameterId
	WHERE  VALUE IS NOT NULL
	       AND (
	               (
	                   #karkard.DataEntryType = 1
	                   AND CAST(VALUE AS bigint) > Mabna.AllowLen
	               )
	               OR (
	                      #karkard.DataEntryType = 2
	                      AND CAST(VALUE AS bigint) > (Mabna.AllowLen * @CurrentMonthHours)
	                          / @CurretMonthDays
	                  )
	           )
	
	
	
	
	IF @PersonelID IS NOT NULL
	BEGIN
	    SET @error = 'E_' + ' کارکرد مربوط به پرسنل ' +
	        @PersonelID + ' معتبر نمي باشد  '
	    
	    
	    RAISERROR (
	        @error,	-- Message text.
	        16,	-- Severity,
	        1,	-- State,
	        NULL,	-- First argument.
	        NULL
	    ); -- Second argument.
	    RETURN
	END
	
	
	
	
	DECLARE @IndexName      VARCHAR(128),
	        @IndexQuery     NVARCHAR(2048)
	
	SET @IndexName = cfg.getTempTableName(0)
	
	SET @IndexQuery = '
	CREATE UNIQUE NONCLUSTERED INDEX ' + @IndexName +
	    ' ON #T2
(
	[PersonelId] ASC,
	[ParameterId] ASC,
	[DocumentId],
	[ItemType]
	
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, 
SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF,
 DROP_EXISTING = OFF, ONLINE = OFF,
  ALLOW_ROW_LOCKS = ON, 
  ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
'
	
	
	EXEC (@IndexQuery)
	
	
	
	
	UPDATE Pay.ParameterMonthlyData
	SET    [Value] = #t2.value,
	       Pay.ParameterMonthlyData.LastEditor = @UserId,
	       Pay.ParameterMonthlyData.LastEditionDate = GETDATE()
	FROM   Pay.ParameterMonthlyData
	       INNER JOIN #T2
	            ON  Pay.ParameterMonthlyData.PersonnelID = #t2.PersonelId
	            AND Pay.ParameterMonthlyData.ParameterID = #t2.ParameterId
	            AND IsNull(#t2.DocumentId,-1) =ISNULL( CASE 
	                                      WHEN #t2.ItemType = 1 THEN PaymentSubjectID
	                                      WHEN #t2.ItemType = 2 THEN DebitCreditNoteItemID
	                                      WHEN #t2.ItemType = 3 THEN DocumentId
	                                      ELSE -1
	                                 END,-1)
	WHERE  Pay.ParameterMonthlyData.CalendarMonthID = @CalendarMonthId
	       AND Pay.ParameterMonthlyData.IssueCalendarMonthID = @IssueCalendarMonthID
	       AND #T2.Value <> CAST(-1 AS DECIMAL(30, 4))
	
	
	
	INSERT INTO Pay.ParameterMonthlyData
	  (
	    ParameterID,
	    PersonnelID,
	    CalendarMonthID,
	    IssueCalendarMonthID,
	    [Value],
	    Version,
	    Creator,
	    CreationDate,
	    LastEditor,
	    LastEditionDate,
	    PaymentSubjectID,
	    DebitCreditNoteItemID,
	    PettyCashCostItemID
	  )
	SELECT #t2.ParameterId,
	       #t2.PersonelId,
	       @CalendarMonthId,
	       @IssueCalendarMonthID,
	       #t2.value,
	       1,
	       @UserId,
	       GETDATE(),
	       @UserId,
	       GETDATE(),
	       CASE 
	            WHEN ItemType = 1 THEN DocumentId
	            ELSE NULL
	       END,
	       CASE 
	            WHEN ItemType = 2 THEN DocumentId
	            ELSE NULL
	       END,
	       CASE 
	            WHEN ItemType = 3 THEN DocumentId
	            ELSE NULL
	       END
	FROM   #T2
	WHERE  #T2.Value <> CAST(-1 AS DECIMAL(30, 4))
	       AND NOT EXISTS (
	               SELECT ParameterMonthlyDataID
	               FROM   Pay.ParameterMonthlyData
	               WHERE  CalendarMonthID = @CalendarMonthId
	                      AND IssueCalendarMonthID = @IssueCalendarMonthID
	                      AND PersonnelID = #t2.PersonelId
	                      AND ParameterID = #t2.ParameterId
	           )
	
	
	
	
	
	
	DELETE Pay.ParameterMonthlyData
	FROM   Pay.ParameterMonthlyData
	       INNER JOIN #T2
	            ON  Pay.ParameterMonthlyData.PersonnelID = #t2.PersonelId
	            AND Pay.ParameterMonthlyData.ParameterID = #t2.ParameterId
	             AND IsNull(#t2.DocumentId,-1) =ISNULL( CASE 
	                                      WHEN #t2.ItemType = 1 THEN PaymentSubjectID
	                                      WHEN #t2.ItemType = 2 THEN DebitCreditNoteItemID
	                                      WHEN #t2.ItemType = 3 THEN DocumentId
	                                      ELSE -1
	                                 END,-1)
	WHERE  Pay.ParameterMonthlyData.CalendarMonthID = @CalendarMonthId
	       AND IssueCalendarMonthID = @IssueCalendarMonthID
	       AND #T2.Value = CAST(-1 AS DECIMAL(30, 4))
	
	
	
	IF EXISTS (
	       SELECT 1
	       FROM   Pay.vwPersonelDebit AS vpd
	              INNER JOIN Pay.Parameter AS p
	                   ON  p.PaymentTypeID = vpd.PaymentTypeID
	              INNER JOIN hrm.Personel AS p2
	                   ON  p2.PartyID = vpd.PartyID
	              INNER JOIN #T2
	                   ON  #T2.ParameterId = p.ParameterID
	                   AND #T2.PersonelId = p2.PersonelID
	       WHERE  vpd.RemainValue < 0
	   )
	BEGIN
	    SET @error = N'E_' + 'مانده برای برخی منفی می شود ' 
	    
	    RAISERROR (
	        @error,	-- Message text.
	        16,	-- Severity,
	        1,	-- State,
	        NULL,	-- First argument.
	        NULL
	    ); -- Second argument.
	    RETURN
	END
