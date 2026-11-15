
---------------------------------------------------------------------
CREATE   PROCEDURE [PAY].[IssuePayrollVoucher]
(
    @CalendarMonthId       INT,
    @calcTypeId            INT,
    @Desc                  NVARCHAR(2048),
    @SubNumber             NVARCHAR(256) = NULL,
    @selectedPersonel      NVARCHAR(MAX),
    @FinancialPeriodID     INT,
    @UserName              NVARCHAR(1024),
    @Date                  DATE,
    @Number                INT,
    @BranchID              INT,
    @getData               BIT = 0,
    @DocumentTypeId        INT,
    @CalculationPersonelIDS NVARCHAR(MAX)
)
--WITH ENCRYPTION
AS
SET NOCOUNT ON 
	SET TRANSACTION ISOLATION LEVEL SERIALIZABLE
	
	DECLARE @calculationDate DATE,
	        @calculationStartDate DATE,
	        @calcYear INT,
	        @CalcYearTitle NVARCHAR(10),
	        @userId INT,
	        @Month NVARCHAR(1024),
	        @decimalNumber INT
	
	DECLARE @StartNum                  INT = NULL,
	        @EndNum                    INT = NULL,
	        @DailyNumber               INT,
	        @ReferenceNumber           INT,
	        @Message                   NVARCHAR(MAX),
	        @CurrentDate               DATETIME,
	        @DocumentNumID             INT,
	        @EndDate                   DATE,
	        @NeedConfirm               BIT,
	        @SettlementCalcType        INT,
	        @CalculationPersonelID     INT
	
	SELECT @NeedConfirm = ConfigValue
	FROM   cfg.Configuration c
	WHERE  c.ConfigKey = 'AgreementNeedConfirm'
	
	
	SELECT VALUE AS PersonelID
	INTO   #selectedPersonel
	FROM   cfg.R_FnCommaStr2Table(@selectedPersonel) rfcst
	CREATE TABLE #NotVoucherCalcType
	(
		CalculationPersonelID     INT,
		CalendarMonthID           INT,
		CalculationTypeID         INT,
		PersonelID                INT
	)
	
	
	----اگر سند تسویه باشد پیدا کردن نوع محاسباتهایی که باید سند  صادر شود
	
	SELECT @SettlementCalcType = ct.CalculationTypeID
	FROM   pay.CalculationType AS ct
	WHERE  ct.EngName = 'Settlement'	 
	

	IF @calcTypeId = @SettlementCalcType
	BEGIN
	    SELECT @CalculationPersonelID = cp.CalculationPersonelID
	    FROM   pay.CalculationPersonel AS cp
	           JOIN #selectedPersonel sp
	                ON  cp.PersonelID = sp.PersonelID
	    WHERE  cp.CalculationTypeID = @calcTypeId
	           AND cp.CalendarMonthID = @CalendarMonthId
	           
		
	  -- اگر یکی از انواع محاسبات قبلا پرداخت شده باشد باید سند آنها مجزا صادر شده باشد.
	  IF EXISTS (
	       SELECT cp.PersonelID
	       FROM   Pay.CalculationPersonel cp
	       JOIN pay.SettlementCalculation AS sc ON sc.CalculationPersonelID = cp.CalculationPersonelID
	       JOIN pay.CalculationPersonel AS cp2 ON sc.BaseCalculationPersonelID = cp2.CalculationPersonelID AND cp2.VoucherID  IS NULL
	        WHERE  sc.CalculationPersonelID = @CalculationPersonelID AND ISNULL(sc.Paid,0)<>0
	   )
	BEGIN
	    SELECT @Message = 'E_' +
	          N'براي انواع محاسباتی که قبلا پرداختی صورت گرفته باید سند آن از قسمت محاسبات صادر گردد.'
	    
	    RAISERROR(@Message, 16, 10)
	    RETURN
	END         
	           
	    
	    --درج محاسباتی که در تسویه شرکت کرده اندو سند صادر نشده اند
	    INSERT INTO #NotVoucherCalcType(CalculationPersonelID, CalendarMonthID, CalculationTypeID,PersonelID)
	    SELECT cp2.CalculationPersonelID,
	           cp2.CalendarMonthID,
	           cp2.CalculationTypeID,
	           cp2.PersonelID
	    FROM   pay.CalculationPersonel AS cp
	           JOIN pay.SettlementCalculation AS sc
	                ON  sc.CalculationPersonelID = cp.CalculationPersonelID
	           JOIN pay.CalculationPersonel AS cp2  
					ON sc.BaseCalculationPersonelID = cp2.CalculationPersonelID
	    WHERE  cp2.VoucherID IS NULL
	           --AND ISNULL(sc.[Value], 0) <> ISNULL(sc.Paid, 0)
	           AND cp.CalculationPersonelID = @CalculationPersonelID;
	           
			--درج نوع محاسبه تسویه
			INSERT INTO #NotVoucherCalcType(CalculationPersonelID, CalendarMonthID, CalculationTypeID,PersonelID)
			SELECT @CalculationPersonelID,@CalendarMonthId,@calcTypeId,PersonelID
			FROM #selectedPersonel;
	          
	END
	ELSE 
	BEGIN
		--- در صورتی که نوع تسویه نباشد درج منبع صدور سند 
		 INSERT INTO #NotVoucherCalcType
		 (CalculationPersonelID, 
		 CalendarMonthID, 
		 CalculationTypeID,PersonelID)
		 SELECT cp.CalculationPersonelID,cp.CalendarMonthID,cp.CalculationTypeID,cp.PersonelID
		   FROM #selectedPersonel sp
		 JOIN pay.CalculationPersonel AS cp ON cp.PersonelID = sp.PersonelID
		 WHERE cp.CalendarMonthID = @CalendarMonthId AND cp.CalculationTypeID = @calcTypeId 
	END

	
	
	
	SET @CurrentDate = GETDATE()
	
	IF @calcTypeId = @SettlementCalcType
	BEGIN
	    SELECT @BranchID = T.BranchID
	    FROM   (
	               SELECT A.*,
	                      p2.DlID,
	                      p.Code,
	                      ROW_NUMBER() OVER(PARTITION BY A.PersonelID ORDER BY A.IssueDate DESC) AS Rno,
	                      cc.DlID AS CostCenterDlId
	               FROM   HRM.Agreement A
	                      INNER JOIN HRM.Personel p
	                           ON  p.PersonelID = A.PersonelID
	                      JOIN #selectedPersonel sp
	                           ON  p.PersonelID = sp.personelID
	                      INNER JOIN CFG.Party p2
	                           ON  p2.PartyID = p.PartyID
	                      LEFT JOIN CFG.CostCenter AS cc
	                           ON  cc.CostCenterID = A.CostCenterID
	               WHERE  A.IssueDate <= @calculationDate
	                      AND (
	                              @NeedConfirm = 0
	                              OR (
	                                     A.ConfirmDate IS NOT NULL
	                                     AND A.ConfirmDate <= @calculationDate
	                                 )
	                          )
	           ) T
	    WHERE  T.Rno = 1;
	END
	
	
	SELECT @decimalNumber = c.PrecisionCount
	FROM   cfg.Currency c
	WHERE  c.CurrencyID = -1
	
	
	
	
	SELECT oi.OrganizationID,
	       ao.*
	INTO   #AgreementOrganization
	FROM   hrm.AgreementOrganization ao
	       JOIN hrm.OrganizationItem AS oi
	            ON  oi.OrganizationItemID = ao.OrganizationItemID
	
	IF @calcTypeId = 1
	    SELECT @Month = cm.[MonthName]
	    FROM   hrm.CalendarMonth cm
	    WHERE  cm.CalendarMonthID = @CalendarMonthId
	ELSE
	    SET @Month = ''  
	
	IF @calcTypeId = 1
	    SELECT @CalcYearTitle = c.[Year]
	    FROM   hrm.CalendarMonth cm
	           JOIN hrm.Calendar AS c
	                ON  c.CalendarID = cm.CalendarID
	    WHERE  cm.CalendarMonthID = @CalendarMonthId
	ELSE
	    SET @CalcYearTitle = ''     
	
	
	SELECT @userId = u.UserID
	FROM   cfg.[User] u
	WHERE  u.Username = @UserName
	
	SELECT @EndDate = EndDate
	FROM   hrm.CalendarMonth
	WHERE  CalendarMonthID = @CalendarMonthId
	
	SELECT @calculationDate = cm.EndDate,
	       @calculationStartDate     = cm.StartDate,
	       @calcYear                 = cm.CalendarID
	FROM   Hrm.CalendarMonth cm
	WHERE  cm.CalendarMonthID = @CalendarMonthId
	
	IF EXISTS (
	       SELECT cp.PersonelID
	       FROM   Pay.CalculationPersonel cp
	              INNER JOIN cfg.R_FnCommaStr2Table(@selectedPersonel) rfcst
	                   ON  rfcst.[value] =   cp.PersonelID
	       WHERE  cp.CalendarMonthID =		 @CalendarMonthId
	              AND cp.CalculationTypeID = @calcTypeId
	              AND cp.voucherid IS NOT NULL
	   )
	BEGIN
	    SELECT @Message = 'E_' +
	           'براي برخي از افراد انتخاب شده قبلا سند صادر شده است'
	    
	    RAISERROR(@Message, 16, 10)
	    RETURN
	END
	
	
	IF EXISTS (
	       SELECT 1
	       FROM   cfg.R_FnCommaStr2Table(@selectedPersonel) rfcst
	              LEFT JOIN (
	                       SELECT pvs.PersonelID
	                       FROM   Pay.PersonelVoucherSetting pvs
	                              INNER JOIN HRM.CalendarMonth AS cm
	                                   ON  cm.CalendarMonthID = pvs.CalendarMonthID
	                       WHERE  cm.StartDate <= @calculationStartDate
	                   ) AS pvs
	                   ON  rfcst.[value] = pvs.PersonelID
	       WHERE  pvs.PersonelID IS NULL
	   )
	BEGIN
	    IF @getData = 0
	    BEGIN
	        SELECT @Message = 'E_LEVEL_' +
	               'براي برخي از افراد تنظیمات سند حسابداری انجام نشده است'
	        
	        RAISERROR(@Message, 16, 10)
	    END
	    ELSE
	    BEGIN
	        SELECT p.Code  AS N'[کد]'
	        FROM   cfg.R_FnCommaStr2Table(@selectedPersonel) rfcst
	               LEFT JOIN (
	                        SELECT pvs.PersonelID
	                        FROM   Pay.PersonelVoucherSetting pvs
	                               INNER JOIN HRM.CalendarMonth AS cm
	                                    ON  cm.CalendarMonthID = pvs.CalendarMonthID
	                        WHERE  cm.StartDate <= @calculationStartDate
	                    )  AS pvs
	                    ON  rfcst.[value] = pvs.PersonelID
	               LEFT JOIN hrm.Personel AS p
	                    ON  p.PersonelID = rfcst.[value]
	        WHERE  pvs.PersonelID IS NULL
	    END
	    RETURN
	END
	IF @calcTypeId = @SettlementCalcType
	BEGIN
	SELECT @CalculationPersonelIDS = STUFF(
	           (
	               SELECT ' ,' + CAST(nvct.CalculationPersonelID AS NVARCHAR(250))
	               FROM #NotVoucherCalcType AS nvct	
	               WHERE nvct.CalculationTypeID <> @SettlementCalcType                      
	                      FOR XML PATH(''), TYPE
	           ).value('.', 'NVARCHAR(MAX)'),
	           1,
	           2,
	           ''
	       )
	END
	
	
	
	BEGIN TRY
		EXEC PAY.spTimeSheetControls
			 @CalculationPersonelIDS,
		     3,
		     @CalendarMonthId = @CalendarMonthId
	END TRY  
	BEGIN CATCH
		DECLARE @ErrorMessage NVARCHAR(4000)
		
		SELECT @ErrorMessage = 'E_' + ERROR_MESSAGE()
		
		
		RAISERROR (
		    @ErrorMessage,	-- Message text.
		    16,	-- Severity.
		    10 -- State.
		);
		RETURN;
	END CATCH
	
	IF @Date <= (
	       SELECT MAX(Voucher.Date)
	       FROM   ACC.Voucher
	       WHERE  Voucher.FinancialPeriodID = @FinancialPeriodID
				  AND Voucher.VoucherStatusID = 4
	   )
	BEGIN
	    RAISERROR(
	        'به تاریخ کوچکتر مساوی آخرین سند کل نمی توان سند حسابداری صادر کرد',
	        16,
	        12
	    );
	    --RAISERROR('سند حسابداري به تاريخ قبل از تاريخ آخرين سند تاييد شده نمي تواند صادر شود', 16,12)
	    RETURN;
	END;
	
	
	
	
	
	SELECT @StartNum = StartNum,
	       @EndNum                   = EndNum,
	       @DocumentNumID            = DocumentNumID
	FROM   cfg.DocumentNum
	WHERE  DocumentNumTypeID         = 1
	       AND FinancialPeriodID     = @FinancialPeriodID--سند حسابداري
	
	
	
	SELECT cp.PersonelID
	INTO   #selPersonel
	FROM   pay.CalculationPersonel cp
	       INNER JOIN cfg.R_FnCommaStr2Table(@selectedPersonel) rfcst
	            ON  rfcst.[value] = cp.PersonelID
	WHERE  cp.CalendarMonthID = @CalendarMonthId
	       AND cp.CalculationTypeID = @calcTypeId
	
	
	SELECT PersonelID,
	       Code,
	       T.AgreementID,
	       T.ExecuteDate,
	       T.WorkPlaceID,
	       T.EmploymentTypeID,
	       T.CostCenterID,
	       T.DlID,
	       T.BranchID
	INTO   #lastAggreement
	FROM   (
	           SELECT a.*,
	                  p2.DlID,
	                  p.Code,
	                  ROW_NUMBER() OVER(PARTITION BY a.PersonelID ORDER BY a.IssueDate DESC) AS Rno
	           FROM   HRM.Agreement a
	                  INNER JOIN #SelPersonel
	                       ON  a.PersonelID = #selPersonel.PersonelID
	                  INNER JOIN hrm.Personel p
	                       ON  p.PersonelID = a.PersonelID
	                  INNER JOIN CFG.Party p2
	                       ON  p2.PartyID = p.PartyID
	           WHERE  a.IssueDate <= @calculationDate
	                  AND (
	                          @NeedConfirm = 0
	                          OR (
	                                 a.ConfirmDate IS NOT NULL
	                                 AND a.ConfirmDate <= @calculationDate
	                             )
	                      )
	       ) T
	WHERE  T.Rno = 1
	
	

	SELECT PersonelVoucherSettingID,
	       PersonelID,
	       T.PayrollAccGroupID,
	       T.MissionOrganizationDlId
	INTO   #lastVoucherSetting
	FROM   (
	           SELECT pvs.*,
	                  ROW_NUMBER() OVER(PARTITION BY pvs.PersonelID ORDER BY cm.StartDate DESC) AS Rno
	           FROM   pay.PersonelVoucherSetting AS pvs
	                  INNER JOIN HRM.CalendarMonth AS cm
	                       ON  cm.CalendarMonthID = pvs.CalendarMonthID
	           WHERE  cm.EndDate <= @calculationDate
	       )T
	WHERE  Rno = 1
	
	
	IF (
	       SELECT COUNT(DISTINCT BranchID)
	       FROM   #lastAggreement
	   ) <> 1
	BEGIN
	    SELECT @Message = 'E_' + 'افراد انتخاب شده مربوط به يک شعبه نمي باشند' 
	    RAISERROR(@Message, 16, 10)
	    RETURN
	END
	
	SELECT TOP 1 @BranchID = BranchID
	FROM   #lastAggreement
	
	DECLARE @CompanyID INT
	SELECT @CompanyID = CompanyID
	FROM   cfg.Branch
	WHERE  BranchID = @BranchID
	
	IF @Number = 0
	    SET @Number = ISNULL(
	            (
	                SELECT MAX(Number) + 1
	                FROM   [ACC].[Voucher] v
	                       JOIN cfg.Branch b
	                            ON  v.BranchID = b.BranchID
	                WHERE  v.FinancialPeriodID = @FinancialPeriodID
	                       AND b.CompanyID = @CompanyID
	            ),
	            @StartNum
	        );
	
	
	IF (
	       @Number < @StartNum
	       OR (@EndNum IS NOT NULL AND @Number > @EndNum)
	   )
	BEGIN
	    SELECT @Message = N'E_InvalidNumberRange';
	    RAISERROR(@Message, 16, 10);
	    RETURN;
	END;	
	IF EXISTS (
	       SELECT 1
	       FROM   ACC.Voucher v
	              JOIN cfg.Branch b
	                   ON  v.BranchID = b.BranchID
	       WHERE  v.Number = @Number
	              AND v.FinancialPeriodID = @FinancialPeriodID
	              AND b.CompanyID = @CompanyID
	   )
	BEGIN
	    SET @Message = N'E_' + N'شماره تکراري مي باشد';
	    RAISERROR(@Message, 16, 10);
	    RETURN;
	END;
	
	
	SET @ReferenceNumber = ISNULL(
	        (
	            SELECT MAX(ReferenceNumber) + 1
	            FROM   [ACC].[Voucher] v
	                   JOIN cfg.Branch b
	                        ON  v.BranchID = b.BranchID
	            WHERE  v.FinancialPeriodID = @FinancialPeriodID
	                   AND b.CompanyID = @CompanyID
	        ),
	        0
	    ) ;
	
	
	SET @DailyNumber = ISNULL(
	        (
	            SELECT MAX(DailyNumber) + 1
	            FROM   [ACC].[Voucher]
	            WHERE  [Date] = @Date
	        ),
	        1
	    )	    
	
	DECLARE @Items NVARCHAR(MAX)
	SELECT @Items = STUFF(
	           (
	               SELECT ' ،' + CAST(Code AS NVARCHAR(250))
	               FROM   #lastAggreement
	                      LEFT JOIN #lastVoucherSetting
	                           ON  #lastVoucherSetting.PersonelId = #lastAggreement.PersonelId
	               WHERE  #lastVoucherSetting.PayrollAccGroupID IS NULL
	                      FOR XML PATH(''), TYPE
	           ).value('.', 'NVARCHAR(MAX)'),
	           1,
	           2,
	           ''
	       )
	
	
	IF @Items IS NOT NULL
	BEGIN
	    SELECT @Message = 'E_' +
	           'براي برخي از افراد انتخاب شده گروه حساب مشخص نشده است' + CHAR(13)
	           + CHAR(10) + @Items
	    
	    RAISERROR(@Message, 16, 10)
	    RETURN
	END
	
	
	SET @Items = NULL
	
	SELECT @Items = STUFF(
	           (
	               SELECT ' ،' + CAST(pag.Title AS NVARCHAR(250))
	               FROM   #lastAggreement
	                      INNER JOIN #lastVoucherSetting
	                           ON  #lastVoucherSetting.PersonelId = #lastAggreement.PersonelId
	                      INNER JOIN pay.PayrollAccGroup AS pag
	                           ON  pag.PayrollAccGroupID = #lastVoucherSetting.PayrollAccGroupID
	               WHERE  pag.PayrollAccGroupID NOT IN (SELECT pac.PayrollAccGroupID
	                                                    FROM   pay.PayrollAccConfiguration AS pac)
	                      FOR XML PATH(''), TYPE
	           ).value('.', 'NVARCHAR(MAX)'),
	           1,
	           2,
	           ''
	       )
	
	IF @Items IS NOT NULL
	BEGIN
	    SELECT @Message = 'E_' +
	           'براي برخي از گروه حسابها تنظیمات انجام نشده است ' + CHAR(13)
	           + CHAR(10) + @Items
	    
	    RAISERROR(@Message, 16, 10)
	    RETURN
	END

	IF @getData = 0
	BEGIN
	    INSERT INTO Acc.Voucher
	           (
	               BranchID,
	               FinancialPeriodID,
	               DocumentTypeID,
	               Number,
	               ReferenceNumber,
	               DailyNumber,
	               SubNumber,
	               DATE,
	               VoucherStatusID,
	               [Description],
	               Description2,
	               Creator,
	               CreationDate,
	               Version,
	               LastEditor,
	               LastEditionDate,
	               Total,
	               AutoGenerated
	           )
	    SELECT @BranchID,
	           @FinancialPeriodID,
	           @DocumentTypeId,
	           @Number,
	           @ReferenceNumber,
	           @DailyNumber,
	           @SubNumber,
	           @Date,
	           1,
	           @Desc,
	           @Desc,
	           @userId,
	           @CurrentDate,
	           1,
	           @userId,
	           @CurrentDate,
	           0,
	           1
	END
	DECLARE @VoucherID INT
	
	SET @VoucherID = SCOPE_IDENTITY()
	
	
	CREATE TABLE #tempVoucherItem
	(
		VoucherItemID                 INT IDENTITY,
		RowIndex                      INT,
		VoucherID                     INT,
		SlID                          INT,
		ParameterID                   INT,
		ShareDlID                     BIGINT,
		[Description]                 NVARCHAR(MAX),
		Description2                  NVARCHAR(MAX),
		Debit                         DECIMAL(30, 4),
		Credit                        DECIMAL(30, 4),
		CurrencyID                    INT,
		CurrencyRate                  DECIMAL(18, 4),
		CurrencyDebit                 DECIMAL(30, 4),
		CurrencyCredit                DECIMAL(30, 4),
		PersonelID                    INT,
		PayrollAccConfigurationID     INT,
		OrganizationItemID            INT
	)
	
	
	DECLARE @MaxVoucherItem DECIMAL
	
	SELECT @MaxVoucherItem = MAX(vi.VoucherItemID) + 1
	FROM   acc.VoucherItem vi
	
	SET @MaxVoucherItem = ISNULL(@MaxVoucherItem, 1)
	
	---- Items not in TimeSheetCalculationResult
	
	SELECT ROW_NUMBER() OVER(
	           PARTITION BY a1.PayrollAccGroupID,
	           a1.ParameterID,
	           a1.BalanceType ORDER BY b1.EndDate DESC
	       )                          rno,
	       a1.PayrollAccConfigurationID,
	       a1.IsActive,
	       a1.PayrollAccGroupID,
	       a1.ParameterID,
	       a1.SlID,
	       a1.BalanceType,
	       a1.[Description],
	       a1.Description2,
	       a1.CalendarMonthID
	INTO   #PAC
	FROM   pay.PayrollAccConfiguration a1
	       JOIN hrm.CalendarMonth  AS b1
	            ON  a1.CalendarMonthID = b1.CalendarMonthID
	WHERE  b1.EndDate <= @EndDate
	
	select tscr.PersonelID,tscr.ParameterID,tscr.SlID 
	into #TimeSheetPersonel
	from pay.TimeSheetCalculationResult tscr
	join pay.Parameter p on tscr.ParameterID = p.ParameterID
	JOIN #NotVoucherCalcType AS nvct ON tscr.CalculationPersonelID = nvct.CalculationPersonelID AND p.CalculationTypeID = nvct.CalculationTypeID
	join #selectedPersonel sp on tscr.PersonelID = sp.PersonelID
	where tscr.CalendarMonthID = @CalendarMonthId
	group by tscr.PersonelID,tscr.ParameterID,tscr.SlID 
	

	INSERT INTO #tempVoucherItem(
	           -- VoucherItemID,
	           RowIndex,
	           VoucherID,
	           SlID,
	           ParameterID,
	           ShareDlID,
	           [Description],
	           Description2,
	           Debit,
	           Credit,
	           CurrencyID,
	           CurrencyRate,
	           CurrencyDebit,
	           CurrencyCredit,
	           PersonelID,
	           PayrollAccConfigurationID,
	           OrganizationItemID
	       )
	SELECT --1,
	       1,
	       @VoucherID,
	       cr.SlID,
	       cr.ParameterID,
	       NULL,
	       cr.[Description] + ' ' + @Month + ' ' + @CalcYearTitle,
	       cr.Description2 + ' ' + @Month + ' ' + @CalcYearTitle,
	       CASE 
	            WHEN cr.BalanceType = 0 THEN CASE 
	                                               WHEN cr.[Value] >= 0 THEN cr.[Value]
	                                               ELSE 0
	                                          END
	            ELSE CASE 
	                      WHEN cr.[Value] >= 0 THEN 0
	                      ELSE cr.[Value] * -1
	                 END
	       END,
	       CASE 
	            WHEN cr.BalanceType = 1 THEN CASE 
	                                               WHEN cr.[Value] >= 0 THEN cr.[Value]
	                                               ELSE 0
	                                          END
	            ELSE CASE 
	                      WHEN cr.[Value] >= 0 THEN 0
	                      ELSE cr.[Value] * -1
	                 END
	       END,
	       -1,
	       1,
	       CASE 
	            WHEN cr.BalanceType = 0 THEN cr.[Value]
	            ELSE 0
	       END,
	       CASE 
	            WHEN cr.BalanceType = 1 THEN cr.[Value]
	            ELSE 0
	       END,
	       cr.PersonelID,
	       cr.PayrollAccConfigurationID,
	       cr.OrganizationItemID
	FROM    (
	                SELECT cp.PersonelID,
	                       cr.ParameterID,
	                       l.OrganizationItemID,
	                       SUM(cr.VALUE) AS VALUE,
						   max(pac.Description) Description,
						   max(pac.Description2) Description2,
						   pac.PayrollAccConfigurationID,
						   pac.BalanceType,
						   pac.SlID,
						   pac.IsActive
	                FROM   pay.CalculationResult cr
							JOIN #NotVoucherCalcType  AS cp ON  cr.CalculationPersonelID = cp.CalculationPersonelID
							join     #lastAggreement AGG on cp.PersonelID = agg.PersonelID
							INNER JOIN #lastVoucherSetting
							ON  #lastVoucherSetting.PersonelId = Agg.PersonelId
							INNER JOIN #PAC pac
							ON  pac.PayrollAccGroupID = #lastVoucherSetting.PayrollAccGroupID
							AND pac.rno = 1 and cr.ParameterID = pac.ParameterID
							LEFT JOIN #TimeSheetPersonel AS tscr
							ON  cr.ParameterID = tscr.ParameterID
							AND cp.PersonelID = tscr.PersonelID
							and pac.SlID = tscr.SlID
							LEFT JOIN Pay.Loan l
							ON  l.LoanID = cr.LoanID
							WHERE  cr.ParameterValueTypeID IN (7, 16)
							AND tscr.ParameterID IS NULL
							GROUP BY
							cp.PersonelID,
							cr.ParameterID,
							l.OrganizationItemID,
							pac.PayrollAccConfigurationID,
							pac.BalanceType,
							pac.SlID,
							pac.IsActive
	            ) cr
	WHERE  cr.[Value] <> 0
	       AND cr.IsActive = 1
	ORDER BY
	       cr.BalanceType DESC,
	       cr.SlID
	       
	   
	
	--- حذف خالص سایر انواع محاسبات در صورتی که برای نوع تسویه سند صادر می شود.
	
	IF @calcTypeId = @SettlementCalcType
	BEGIN
	DELETE FROM tvi FROM #tempVoucherItem AS tvi
	JOIN #NotVoucherCalcType nvct ON  tvi.PersonelID = nvct.PersonelID 
	JOIN pay.Parameter AS p ON p.ParameterID = tvi.ParameterID AND p.SystemName = 'khales' AND nvct.CalculationTypeID <>@SettlementCalcType
	JOIN pay.SettlementCalculation AS sc ON sc.CalculationPersonelID = @CalculationPersonelID
	JOIN PAY.CalculationPersonel cp on cp.CalculationPersonelID = sc.BaseCalculationPersonelID and  p.CalculationTypeID = cp.CalculationTypeID
	WHERE ISNULL(sc.[Value],0)<>ISNULL(sc.Paid,0)
	END
				

	----Items From TimeSheetCalcuationResult
	BEGIN
		INSERT INTO #tempVoucherItem(
		           -- VoucherItemID,
		           RowIndex,
		           VoucherID,
		           SlID,
		           ParameterID,
		           ShareDlID,
		           [Description],
		           Description2,
		           Debit,
		           Credit,
		           CurrencyID,
		           CurrencyRate,
		           CurrencyDebit,
		           CurrencyCredit,
		           PersonelID,
		           PayrollAccConfigurationID,
		           OrganizationItemID
		       )
		SELECT 1,
		       @VoucherID,
		       tscr.SlID,
		       tscr.ParameterID,
		       tscr.DlID,
		       pac.[Description] + ' ' + @Month + ' ' + @CalcYearTitle,
		       pac.Description2 + ' ' + @Month + ' ' + @CalcYearTitle,
		       CASE 
		            WHEN pac.BalanceType = 0 THEN CASE 
		                                               WHEN tscr.[Value] >= 0 THEN tscr.[Value]
		                                               ELSE 0
		                                          END
		            ELSE CASE 
		                      WHEN tscr.[Value] >= 0 THEN 0
		                      ELSE tscr.[Value] * -1
		                 END
		       END,
		       CASE 
		            WHEN pac.BalanceType = 1 THEN CASE 
		                                               WHEN tscr.[Value] >= 0 THEN tscr.[Value]
		                                               ELSE 0
		                                          END
		            ELSE CASE 
		                      WHEN tscr.[Value] >= 0 THEN 0
		                      ELSE tscr.[Value] * -1
		                 END
		       END,
		       -1,
		       1,
		       CASE 
		            WHEN pac.BalanceType = 0 THEN tscr.[Value]
		            ELSE 0
		       END,
		       CASE 
		            WHEN pac.BalanceType = 1 THEN tscr.[Value]
		            ELSE 0
		       END,
		       tscr.PersonelID,
		       pac.PayrollAccConfigurationID,
		       NULL
		FROM   pay.TimeSheetCalculationResult AS tscr
		join pay.Parameter prm on tscr.ParameterID = prm.ParameterID 
		       JOIN #NotVoucherCalcType AS sp
		            ON  sp.CalculationPersonelID = tscr.CalculationPersonelID
		       JOIN #lastVoucherSetting lvs
		            ON  tscr.PersonelID = lvs.PersonelID
		       JOIN #PAC pac
		            ON  lvs.PayrollAccGroupID = pac.PayrollAccGroupID
		            AND tscr.ParameterID = pac.ParameterID
					and pac.SlID = tscr.SlID
	END
	---End of timesheetcalculationresult

	--- درج مانده پرداخت نشده نوع محاسبه برای تسویه
	
	IF @calcTypeId = @SettlementCalcType
	BEGIN
		
INSERT INTO #tempVoucherItem
			(RowIndex,
			VoucherID,
			SlID,
			ParameterID,
			ShareDlID,
			[Description],
			Description2,
			Debit,
			Credit,
			CurrencyID,
			CurrencyRate,
			CurrencyDebit,
			CurrencyCredit,
			PersonelID,
			PayrollAccConfigurationID,
			OrganizationItemID)
SELECT 1,
@VoucherID,
       C.SlID,
       d.ParameterID,
       NULL,
       C.[Description],
       C.[Description],
       case when (VALUE - Paid)>0 then (VALUE - Paid) else 0 end,
       case when (VALUE - Paid)>0 then 0 else -(VALUE - Paid) end,
       -1,
       1,
       case when (VALUE - Paid)>0 then (VALUE - Paid) else 0 end,
       case when (VALUE - Paid)>0 then 0 else -(VALUE - Paid) end,
       s.PersonelID,
       C.PayrollAccConfigurationID,
       NULL
FROM PAY.SettlementCalculation A
    JOIN pay.CalculationPersonel AS s2
        ON s2.CalculationPersonelID = A.BaseCalculationPersonelID
    JOIN pay.CalculationPersonel AS s
        ON s.CalculationPersonelID = A.CalculationPersonelID
    JOIN pay.vwPersonelVoucherSetting AS vpvs
        ON s.PersonelID = vpvs.PersonelID
           AND s.CalendarMonthID = vpvs.CalendarMonthID
    JOIN [PAY].[PayrollAccConfigurationCalendarMonth] C
        ON C.CalendarMonthID = s.CalendarMonthID
           AND C.PayrollAccGroupID = vpvs.PayrollAccGroupID
    JOIN pay.Parameter d
        ON d.ParameterID = C.ParameterID
           AND s2.CalculationTypeID = d.CalculationTypeID
           AND SystemName = 'khales'		   
    left  JOIN #NotVoucherCalcType nvct
        ON nvct.CalculationTypeID = s2.CalculationTypeID 
WHERE A.CalculationPersonelID = @CalculationPersonelID
      AND VALUE <> Paid
      AND s2.VoucherID IS NOT NULL
	  and nvct.CalculationTypeID is null;
	  
	END
       
 --- 

	UPDATE #tempVoucherItem
	SET    Debit = ROUND(Debit, @decimalNumber),
	       Credit = ROUND(Credit, @decimalNumber)
	
	

	
	IF @getData = 0
	   AND (
	           SELECT SUM(Debit) -SUM(Credit)
	           FROM   #tempVoucherItem
	       ) <> 0
	BEGIN
	    SET @Message = 'E_' + 'Balance'
	    RAISERROR (@message, 16, 10);
	    RETURN
	END
	
	
	
	DECLARE @Index INT
	SET @Index = 0
	
	
	
	IF NOT EXISTS (
	       SELECT 1
	       FROM   #tempVoucherItem
	   )
	BEGIN
	    SET @Message = 'E_' + 'هیچ قلمی برای این سند ایجاد نمی شود'
	    RAISERROR (@message, 16, 10);
	    RETURN
	END
	
	
	--UPDATE #tempVoucherItem
	--SET    VoucherItemID = @Index,
	--       RowIndex = @Index,
	--       @Index = @Index + 1
	
	-----------------------------------------Merge
	
	SET IDENTITY_INSERT Acc.VoucherItem ON         
	
	
	
	CREATE TABLE #AccountLevelVoucherItem
	(
		VoucherItemID      INT,
		AccountLevelID     INT,
		DlID               INT
	)
	
	
	INSERT INTO #AccountLevelVoucherItem
	SELECT vi.VoucherItemID,
	       al.AccountLevelID,
	       --dt.Code,pacpt.PartyType,	 pac.ParameterID,pac.PayrollAccConfigurationID,ao.AgreementOrganizationID,
	       CASE 
	            WHEN dt.Code = 100 THEN NULL--حساب بانکي
	            WHEN dt.Code = 101 THEN NULL--صندوق
	            WHEN dt.Code = 102 THEN cc.DlID--مرکز هزينه
	            WHEN dt.Code = 103 THEN --طرف حساب
	                 (
	                     CASE 
	                          WHEN pacpt.PartyType = 0 THEN #lastAggreement.DLID --Personel
	                          WHEN pacpt.PartyType = 1 THEN CASE 
	                                                             WHEN p.CategoryID
	                                                                  = 7 THEN p7.DlID
	                                                             ELSE p2.DlID
	                                                        END --Organ
	                          WHEN pacpt.PartyType = 2 THEN #lastVoucherSetting.MissionOrganizationDlId --Mission Organ
	                          ELSE NULL
	                     END
	                 )
	            ELSE pvsd.DlID--
	       END
	       --,	NULL,@userId,@CurrentDate,@userId,@CurrentDate,1
	FROM   #tempVoucherItem vi
	       INNER JOIN acc.AccountLevelSL als
	            ON  als.SlID = vi.SlID
	       INNER JOIN acc.AccountLevel al
	            ON  al.AccountLevelID = als.AccountLevelID
	       INNER JOIN acc.DlType dt
	            ON  dt.DlTypeID = als.DlTypeID
	       INNER JOIN #lastAggreement
	            ON  #lastAggreement.PersonelID = vi.PersonelID
	       INNER JOIN #lastVoucherSetting
	            ON  #lastVoucherSetting.PersonelId = #lastAggreement.PersonelId
	       INNER JOIN pay.PayrollAccConfiguration pac
	            ON  pac.PayrollAccConfigurationID = vi.PayrollAccConfigurationID
	       INNER JOIN pay.PayrollAccGroup AS pag
	            ON  pac.PayrollAccGroupID = pag.PayrollAccGroupID
	            AND (
	                    pag.ShareBaseDlTypeId IS NULL
	                    OR dt.DlTypeID <> pag.ShareBaseDlTypeId
	                )
	       INNER JOIN pay.Parameter p
	            ON  p.ParameterID = pac.ParameterID
	       LEFT JOIN pay.PayrollAccConfigurationPartyType pacpt
	            ON  pacpt.PayrollAccConfigurationID = vi.PayrollAccConfigurationID
	            AND pacpt.AccountLevelID = al.AccountLevelID
	       LEFT JOIN #AgreementOrganization ao
	            ON  ao.OrganizationID = p.OrganizationID
	            AND ao.AgreementID = #lastAggreement.AgreementID
	       LEFT JOIN hrm.OrganizationItem oi7
	            ON  oi7.OrganizationItemID = vi.OrganizationItemID
	       LEFT JOIN cfg.Party p7
	            ON  p7.PartyID = oi7.PartyID
	       LEFT JOIN hrm.OrganizationItem oi
	            ON  oi.OrganizationItemID = ao.OrganizationItemID
	       LEFT JOIN CFG.Party p2
	            ON  p2.PartyID = oi.PartyID
	       LEFT JOIN cfg.CostCenter cc
	            ON  cc.CostCenterID = #lastAggreement.CostCenterID
	       LEFT JOIN pay.PersonelVoucherSettingDl AS pvsd
	            ON  pvsd.PersonelVoucherSettingID = #lastVoucherSetting.PersonelVoucherSettingID
	            AND pvsd.DlTypeID = dt.DlTypeID
	
	-----AccountLevel from TimeSheetCalculationResult
	INSERT INTO #AccountLevelVoucherItem
	SELECT vi.VoucherItemID,
	       als.AccountLevelID,
	       tscr.DlID
	FROM   #tempVoucherItem vi
	       INNER JOIN acc.AccountLevelSL als
	            ON  als.SlID = vi.SlID
	       INNER JOIN acc.AccountLevel al
	            ON  al.AccountLevelID = als.AccountLevelID
	       INNER JOIN acc.DlType dt
	            ON  dt.DlTypeID = als.DlTypeID
	       INNER JOIN #lastAggreement
	            ON  #lastAggreement.PersonelID = vi.PersonelID
	       INNER JOIN #lastVoucherSetting
	            ON  #lastVoucherSetting.PersonelId = #lastAggreement.PersonelId
	       INNER JOIN pay.PayrollAccConfiguration pac
	            ON  pac.PayrollAccConfigurationID = vi.PayrollAccConfigurationID
	       INNER JOIN pay.PayrollAccGroup AS pag
	            ON  pac.PayrollAccGroupID = pag.PayrollAccGroupID
	            AND dt.DlTypeID = pag.ShareBaseDlTypeId
	       INNER JOIN pay.TimeSheetCalculationResult AS tscr
	            ON  vi.PersonelID = tscr.PersonelID
	            AND tscr.CalendarMonthID = @CalendarMonthId
	            AND vi.SlID = tscr.SlID
	            AND vi.parameterid = tscr.ParameterID
	            AND vi.ShareDlID = tscr.DlID
	
	
	-----------------------------------
	IF @getData = 0
	BEGIN
	    SELECT @Items = STUFF(
	               (
	                   SELECT DISTINCT TOP 10 ' ،' + Title
	                   FROM   (
	                              SELECT pvial.VoucherItemID,
	                                     pvial.AccountLevelID,
	                                     CASE 
	                                          WHEN als.AccountLevelSLID IS NULL THEN 0
	                                          WHEN als.AccountLevelSLID IS NOT 
	                                               NULL
	                                               AND DLID IS NOT NULL THEN CAST(DLID AS VARCHAR(10))
	                                              WHEN als.AccountLevelSLID IS NOT NULL
	                                               AND DLID IS NULL THEN CAST(DLID AS VARCHAR(10))
	                                         END VALUE,
	                                         al.Title
	                                  FROM   #tempVoucherItem vi
	                                         INNER JOIN Acc.AccountLevelSL als
	                                              ON  als.SlID = vi.SlID
	                                         INNER JOIN Acc.AccountLevel al
	                                              ON  al.AccountLevelID = als.AccountLevelID
	                                              AND al.IsMandatory = 1
	                                         LEFT JOIN #AccountLevelVoucherItem pvial
	                                              ON  pvial.VoucherItemID = vi.VoucherItemID
	                                              AND pvial.AccountLevelID = als.AccountLevelID
	                          )T
	                   WHERE  VALUE IS NULL
	                          FOR XML PATH(''), TYPE
	               ).value('.', 'NVARCHAR(MAX)'),
	               1,
	               2,
	               ''
	           )
	    
	    IF (@Items IS NOT NULL)
	    BEGIN
	        --اطلاعات مربوط به سطوح کامل نيست.
	        SET @message = 'E_LEVEL_ACC_spIssueVoucher_8^' + CHAR(13) + CHAR(10)
	            + @Items
	        
	        RAISERROR (@message, 16, 10);
	        RETURN
	    END
	END
	ELSE
	BEGIN
	    SELECT T.SlId
	    INTO   #levelError
	    FROM   (
	               SELECT vi.SlID,
	                      pvial.VoucherItemID,
	                      pvial.AccountLevelID,
	                      CASE 
	                           WHEN als.AccountLevelSLID IS NULL THEN 0
	                           WHEN als.AccountLevelSLID IS NOT 
	                                NULL
	                                AND DLID IS NOT NULL THEN CAST(DLID AS VARCHAR(10))
	                               WHEN als.AccountLevelSLID IS NOT NULL
	                                AND DLID IS NULL THEN CAST(DLID AS VARCHAR(10))
	                          END VALUE
	                   FROM   #tempVoucherItem vi
	                          INNER JOIN Acc.AccountLevelSL als
	                               ON  als.SlID = vi.SlID
	                          INNER JOIN Acc.AccountLevel al
	                               ON  al.AccountLevelID = als.AccountLevelID
	                               AND al.IsMandatory = 1
	                          LEFT JOIN #AccountLevelVoucherItem pvial
	                               ON  pvial.VoucherItemID = vi.VoucherItemID
	                               AND pvial.AccountLevelID = als.AccountLevelID
	           )T
	    WHERE  VALUE IS NULL
	END
	
	
	-------------------------------------------
	
	
	DECLARE @Columns          VARCHAR(MAX),
	        @ColumnsTitle     NVARCHAR(MAX),
	        @JoinColumn       VARCHAR(MAX)
	
	
	IF @getData = 1
	BEGIN
	    SELECT @ColumnsTitle = STUFF(
	               (
	                   SELECT DISTINCT ', dl' + CAST(al.AccountLevelID AS VARCHAR(1024))
	                          + '.Title as ' + QUOTENAME(al2.Title)
	                   FROM   #AccountLevelVoucherItem al
	                          INNER JOIN acc.AccountLevel al2
	                               ON  al2.AccountLevelID = al.AccountLevelID
	                                   FOR XML PATH(''),
	                          TYPE
	               ).value('.', 'NVARCHAR(MAX)'),
	               1,
	               1,
	               ''
	           )
	    
	    IF @ColumnsTitle IS NULL
	        SET @ColumnsTitle = '[10000]'
	 	    
	    SELECT @JoinColumn = STUFF(
	               (
	                   SELECT DISTINCT ' Left join Acc.DL dl' + CAST(al.AccountLevelID AS VARCHAR(1024))
	                          + ' on  dl' + CAST(al.AccountLevelID AS VARCHAR(1024))
	                          + '.DlId=' + QUOTENAME(al.AccountLevelID)
	                   FROM   #AccountLevelVoucherItem al
	                          FOR XML PATH(''),
	                          TYPE
	               ).value('.', 'NVARCHAR(MAX)'),
	               1,
	               1,
	               ''
	           )
	    
	    IF @JoinColumn IS NULL
	        SET @JoinColumn = ''
	END
	
	SELECT @Columns = STUFF(
	           (
	               SELECT DISTINCT ',' + QUOTENAME(al.AccountLevelID)
	               FROM   #AccountLevelVoucherItem al
	                      FOR XML PATH(''),
	                      TYPE
	           ).value('.', 'NVARCHAR(MAX)'),
	           1,
	           1,
	           ''
	       )
	
	IF @Columns IS NULL
	    SET @Columns = '[10000]'
	
	DECLARE @SourceQuery NVARCHAR(MAX)
	
	
	
	IF OBJECT_ID('tempdb..##P') IS NOT NULL
	    DROP TABLE ##p
	
	
	
	SET @SourceQuery = 
	    ' select  cast(0 as int) as ID,  row_number() over(order by ISDebit desc ,SLID) as RowIndex, SLID,ISDebit,DESCRIPTION,
	    DESCRIPTION2,
	    Sum(Debit) as Debit,Sum(Credit) as Credit, 
	' + @Columns +
	    '  into ##P 
		from (	
	SELECT pvi.*,CASE WHEN pvi.Debit<>0 THEN 1 ELSE 0 END IsDebit,' + @Columns +
	    '
	FROM   #tempVoucherItem pvi
	       LEFT JOIN (
	                SELECT pvial.VoucherItemID,
	                       pvial.AccountLevelID,
	                       DlID
	                FROM #AccountLevelVoucherItem pvial
	            ) x
	            PIVOT(
	               MAX( DlID)
	                FOR AccountLevelID IN (' + @Columns +
	    ')
	            ) p
	            ON pvi.VoucherItemID=p.VoucherItemID
	
	)T
	
	Group BY SLID,ISDebit ,DESCRIPTION,DESCRIPTION2,' + @Columns + ' Order by ISDebit desc ,SLID'
	
	
	EXEC (@SourceQuery)
	
	
	
	SET @Index = 0
	
	UPDATE ##P
	SET    ID = @Index + @MaxVoucherItem,
	       RowIndex = @Index,
	       @Index = @Index + 1
	

	
	IF @getData = 1
	BEGIN
	    SELECT s.SlID,
	           s.Title,
	           acc.SlFullCode(s.SlID)  AS SlFullCode
	    INTO   #sls
	    FROM   acc.SL                  AS s
	    WHERE  s.IsMoeen = 1
	    
	    SET @SourceQuery = 
	        '
		
		SELECT s.Title AS SlTitle,s.SlFullCode, [Description],cast(case when  #levelError.Slid is null then null else 2 End as int) as SaturnColor,
	        Debit, Credit,' + @ColumnsTitle +
	        '
	  FROM ##P
	  INNER JOIN #sls s
	  ON s.SlID=##P.SlId 
	 
	 ' + @JoinColumn + '
	  left join #levelError
	  on #levelError.Slid=##P.SlId 
	 '
	    
	    EXEC (@SourceQuery)
	    
	    RETURN
	END
	
	
	INSERT INTO [ACC].[VoucherItem]
	       (
	           VoucherItemID,
	           [VoucherID],
	           [VoucherItemIndex],
	           [SlID],
	           [Description],
	           [Description2],
	           [Debit],
	           [Credit],
	           [CurrencyID],
	           [CurrencyRate],
	           [CurrencyDebit],
	           [CurrencyCredit],
	           [Creator],
	           [CreationDate],
	           [LastEditor],
	           [LastEditionDate],
	           [Version]
	       )
	SELECT ID,
	       @VoucherID,
	       RowIndex,
	       SlID,
	       [Description],
	       DESCRIPTION2,
	       Debit,
	       Credit,
	       -1,
	       1,
	       Debit,
	       Credit,
	       @userId,
	       @CurrentDate,
	       @userId,
	       @CurrentDate,
	       1
	FROM   ##P
	
	
	IF @@ROWCOUNT = 0
	BEGIN
	    SELECT @Message = 'E_' + 'سند داراي هيچ قلمي نمي باشد'
	    RAISERROR(@Message, 16, 10)
	    RETURN
	END
	
	
	
	SET @SourceQuery = 
	    '
	
		INSERT INTO Acc.AccountLevelVoucherItem
(VoucherItemID, AccountLevelID, DlID, [Value], Creator, CreationDate,
LastEditor, LastEditionDate, Version)

		SELECT ID,T.AccountLevelID,DlID,
	null,' + CAST(@userId AS VARCHAR(10)) + ',GETDATE(),' + CAST(@userId AS VARCHAR(10))
	    +
	    ',GETDATE(),1

		FROM   (
           SELECT *
           FROM   (
                      SELECT ' + @Columns +
	    ',ID
                      FROM   ##P
	    
                  )P UNPIVOT(DlID FOR AccountLevelID IN (' + @Columns +
	    ')) AS unpvt
       ) T
	'
	
	EXEC (@SourceQuery)	
	
	
	
	UPDATE a
	SET    VoucherID = @VoucherID
	FROM   pay.CalculationPersonel a
	       JOIN #selPersonel b
	            ON  a.PersonelID = b.PersonelID
	            AND a.CalculationTypeID = @calcTypeId
	            AND a.CalendarMonthID = @CalendarMonthId
	
	
	
	UPDATE acc.Voucher
	SET    Total = (
	           SELECT SUM(debit)
	           FROM   acc.VoucherItem vi
	           WHERE  vi.VoucherID = @VoucherID
	       )
	WHERE  VoucherID = @VoucherID
	
	EXEC ACC.ValidateVouchers @voucherIDs = @VoucherID,	-- nvarchar(max)
	     @currentFinancialPeriodID = @FinancialPeriodID,	-- int
	     @isDelete = 0,	-- bit
	     @voucherItemIds = DEFAULT -- nvarchar(max)


		 IF @calcTypeId = @SettlementCalcType
		 BEGIN
		 	 UPDATE cp
		 	 SET VoucherID = @VoucherID 
		 	  FROM 
		 	 #NotVoucherCalcType a
		 	 JOIN pay.CalculationPersonel AS cp ON a.CalculationPersonelID = cp.CalculationPersonelID
		 END;
