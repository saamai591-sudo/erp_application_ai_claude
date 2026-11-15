---------------------------------------------------------------------------------------------------------
CREATE    PROC [FIN].RPT_ResourcesConsumption_Detail
(
    @FromDate DATE,
    @ToDate DATE,
    @SelectedBranches VARCHAR(1024) = NULL,
    @SelectedSubjects VARCHAR(1024) = NULL,
    @SelectedDls VARCHAR(1024) = NULL
)
--WITH ENCRYPTION
AS
BEGIN

    DECLARE @Query VARCHAR(MAX)

    DECLARE @DateType VARCHAR(10),
            @DateFormat VARCHAR(10),
            @UserID INT,
            @Culture VARCHAR(10),
            @CultureNo TINYINT;
            
            
            
    SELECT VALUE BranchID
    INTO   #SelectedBranch
    FROM   CFG.R_FnCommaStr2Table(@SelectedBranches)
                
    SELECT *
    INTO   #vwBranchAccess
    FROM   cfg.vwBranchAccess AS vba
                
    SELECT vba.* 
    INTO   #BranchAccess
    FROM   #vwBranchAccess AS vba
            left JOIN #SelectedBranch AS sb
                ON  vba.BranchID = sb.BranchID
    WHERE  (@SelectedBranches is NULL OR sb.BranchID is NOT NULL)         

    SET @UserID = CFG.GetuserID();
    SET @Culture = CFG.GetuserCulture();

    SELECT @CultureNo = CultureNo
    FROM CFG.CultureInfo
    WHERE Culture = @Culture;

    SELECT @DateType = us.SettingValue
    FROM CFG.UserSetting us
    WHERE us.SettingKey = 'Date_Type'
          AND us.UserID = @UserID;

    IF @DateType IS NULL
        SET @DateType = CASE @Culture
                            WHEN 'fa' THEN
                                0
                            WHEN 'en' THEN
                                1
                            WHEN 'ar' THEN
                                2
                        END;

    SELECT @DateFormat = us.SettingValue
    FROM CFG.UserSetting us
    WHERE us.SettingKey = 'Date_Format'
          AND us.UserID = @UserID;

    IF @DateFormat IS NULL
        SET @DateFormat = 'YY/MM/DD';

    DROP TABLE IF EXISTS #FilteredDlTypes;

    CREATE TABLE #FilteredDlTypes
    (
        DlTypeID INT,
        DlID INT
    );

    IF (@SelectedDls IS NOT NULL AND @SelectedDls <> '')
    BEGIN

        SELECT @SelectedDls
            = STUFF(
        (
            SELECT ',' + [CFG].[GetStringPartBySpliter](value, 1, '#') + '#'
                   + REPLACE(
                                [CFG].[GetStringPartBySpliter](value, 2, '#'),
                                ',',
                                ',' + [CFG].[GetStringPartBySpliter](value, 1, '#') + '#'
                            )
            FROM [CFG].[Split](@SelectedDls, '|')
            FOR XML PATH(''), TYPE
        ).value('.', 'NVARCHAR(MAX)'),
        1   ,
        1   ,
        ''
                   );

        INSERT INTO #FilteredDlTypes
        SELECT [CFG].[GetStringPartBySpliter](value, 1, '#'),
               [CFG].[GetStringPartBySpliter](value, 2, '#')
        FROM [CFG].[Split](@SelectedDls, ',');

    END;

    DROP TABLE IF EXISTS #Selected_Subjects;

    SELECT [CFG].[GetStringPartBySpliter](value, 1, '*') Position,
           [CFG].[GetStringPartBySpliter](value, 2, '*') value
    INTO #Selected_Subjects
    FROM CFG.Split(@SelectedSubjects, '|');


    DROP TABLE IF EXISTS #RPT_ResourcesConsumption_Main;

    CREATE TABLE #RPT_ResourcesConsumption_Main
    (
        ID INT NOT NULL IDENTITY(1, 1),
        [DocumentType] NVARCHAR(250),
        [DocumentID] INT,
        [DocumentEngName] NVARCHAR(250),
        [Date] DATE,
        [Date_Date] NVARCHAR(250),
        [Amount] DECIMAL(30, 4),
        [Currency] NVARCHAR(250),
        [Subject] NVARCHAR(250),
        DlCode NVARCHAR(250),
        DlTitle NVARCHAR(1024),
        BranchCode INT,
        BranchTitle NVARCHAR(1024),
        BankOrCashTitle NVARCHAR(1024),
        AffectedInVat BIT,
        [Description] NVARCHAR(MAX),
        Description2 NVARCHAR(MAX)
    );


    /*زمانیکه هیچ منبع یا مصرف خاصی انتخاب نشود.*/
    IF @SelectedSubjects IS NULL
        INSERT INTO #RPT_ResourcesConsumption_Main
        (
            [DocumentType],
            [DocumentID],
            [DocumentEngName],
            [Date],
            [Date_Date],
            [Amount],
            [Currency],
            [Subject],
            DlCode,
            DlTitle,
            BranchCode,
            BranchTitle,
            BankOrCashTitle,
            AffectedInVat,
            [Description],
            [Description2]
        )
        SELECT CASE DocumentType
                   WHEN 'Cheque' THEN
                       N'چک'
                   WHEN 'ReceivedBankDraft' THEN
                       N'واریز'
                   WHEN 'PaymentBankDraft' THEN
                       N'برداشت'
                   WHEN 'Cash' THEN
                       N'نقد'
                   WHEN 'FromCustomers' THEN
                       N'فروشگاه'
                   WHEN 'Change' THEN
                       N'تبدیل ارز'
                   WHEN 'PettyCashCost' THEN
                       N'صورتخلاصه تنخواه'
                   WHEN 'DebitCreditNote' THEN
                       N'اعلامیه بدهکار بستانکار'
                   WHEN 'Wage' THEN
                       N'کارمزد'
               END,
               VW.DocumentID,
               VW.DocumentEngName,
               VW.[Date],
               CFG.GetCLRSaturnDate(VW.Date, @DateFormat, 0, @DateType),
               Amount,
               CASE
                   WHEN @CultureNo = 1 THEN
                       C.Title
                   WHEN @CultureNo = 2 THEN
                       C.Title2
               END AS Currency,
               CASE
                   WHEN SubjectTypeID IS NOT NULL THEN
                       SubjectTitle
                   WHEN DocumentType = 'FromCustomers' THEN
                       N'فروشگاه'
                   WHEN DocumentType = 'Change' THEN
                       N'تبدیل ارز'
				   when DocumentType = 'Wage' THEN
					   N'کارمزد'
               END,
               DlCode,
               CASE
                   WHEN @CultureNo = 1 THEN
                       DlTitle
                   WHEN @CultureNo = 2 THEN
                       DlTitle2
               END AS DlTitle,
               B.Code,
               CASE
                   WHEN @CultureNo = 1 THEN
                       B.Title
                   WHEN @CultureNo = 2 THEN
                       B.Title2
               END,
               CASE
                   WHEN @CultureNo = 1 THEN
                       BankOrCashTitle
                   WHEN @CultureNo = 2 THEN
                       BankOrCashTitle2
               END AS BankOrCashTitle,
               0 AS AffectedInVat,
               VW.Description,
               VW.Description2
        FROM FIN.VWResourcesConsumption VW
            left JOIN CFG.Currency C
                ON C.CurrencyID = VW.CurrencyID
            left JOIN CFG.Branch B
                ON B.BranchID = VW.BranchID
            left JOIN CFG.vwFinancialPeriodAccess AS vfpa
                ON vfpa.FinancialPeriodID = VW.FinancialPeriodID
        WHERE Date BETWEEN @FromDate AND @ToDate
              AND vw.BranchID IN (SELECT ba.BranchID FROM #BranchAccess ba);

    /*زمانیکه دریافت از مشتریان انتخاب شود.*/
    IF EXISTS (SELECT * FROM #Selected_Subjects WHERE Position = 1)
    BEGIN

        INSERT INTO #RPT_ResourcesConsumption_Main
        (
            [DocumentType],
            [DocumentID],
            [DocumentEngName],
            [Date],
            [Date_Date],
            [Amount],
            [Currency],
            [Subject],
            DlCode,
            DlTitle,
            BranchCode,
            BranchTitle,
            BankOrCashTitle,
            AffectedInVat,
            [Description],
            [Description2]
        )
        SELECT CASE DocumentType
                   WHEN 'Cheque' THEN
                       N'چک'
                   WHEN 'ReceivedBankDraft' THEN
                       N'واریز'
                   WHEN 'PaymentBankDraft' THEN
                       N'برداشت'
                   WHEN 'Cash' THEN
                       N'نقد'
                   WHEN 'FromCustomers' THEN
                       N'فروشگاه'
                   WHEN 'Change' THEN
                       N'تبدیل ارز'
                   WHEN 'PettyCashCost' THEN
                       N'صورتخلاصه تنخواه'
                   WHEN 'DebitCreditNote' THEN
                       N'اعلامیه بدهکار بستانکار'
                   WHEN 'Wage' THEN
                       N'کارمزد'
               END,
               VW.DocumentID,
               VW.DocumentEngName,
               VW.[Date],
               CFG.GetCLRSaturnDate(VW.Date, @DateFormat, 0, @DateType),
               Amount,
               CASE
                   WHEN @CultureNo = 1 THEN
                       C.Title
                   WHEN @CultureNo = 2 THEN
                       C.Title2
               END AS Currency,
               CASE
                   WHEN SubjectTypeID IS NOT NULL THEN
                       SubjectTitle
                   WHEN DocumentType = 'FromCustomers' THEN
                       N'فروشگاه'
               END,
               DlCode,
               CASE
                   WHEN @CultureNo = 1 THEN
                       DlTitle
                   WHEN @CultureNo = 2 THEN
                       DlTitle2
               END AS DlTitle,
               B.Code,
               CASE
                   WHEN @CultureNo = 1 THEN
                       B.Title
                   WHEN @CultureNo = 2 THEN
                       B.Title2
               END,
               CASE
                   WHEN @CultureNo = 1 THEN
                       BankOrCashTitle
                   WHEN @CultureNo = 2 THEN
                       BankOrCashTitle2
               END AS BankOrCashTitle,
               0 AS AffectedInVat,
			   VW.Description,
			   VW.Description2
        FROM FIN.VWResourcesConsumption VW
            JOIN CFG.Currency C
                ON C.CurrencyID = VW.CurrencyID
            JOIN CFG.Branch B
                ON B.BranchID = VW.BranchID
            JOIN CFG.vwFinancialPeriodAccess AS vfpa
                ON vfpa.FinancialPeriodID = VW.FinancialPeriodID
        WHERE Date
              BETWEEN @FromDate AND @ToDate
             AND vw.BranchID IN (SELECT ba.BranchID FROM #BranchAccess ba)
              AND
              (
                  (DocumentType = 'FromCustomers')
                  OR
                  (
                      VW.Type = 'Receive'
                      AND SubjectType IN ( 1, 2 )
                  )
              );
    END;


    /*زمانیکه ردیفی از سایر منابع انتخاب شود*/
    IF EXISTS (SELECT * FROM #Selected_Subjects WHERE Position = 2)
    BEGIN



        INSERT INTO #RPT_ResourcesConsumption_Main
        (
            [DocumentType],
            [DocumentID],
            [DocumentEngName],
            [Date],
            [Date_Date],
            [Amount],
            [Currency],
            [Subject],
            DlCode,
            DlTitle,
            BranchCode,
            BranchTitle,
            BankOrCashTitle,
            AffectedInVat,
            [Description],
            [Description2]
        )
        SELECT CASE DocumentType
                   WHEN 'Cheque' THEN
                       N'چک'
                   WHEN 'ReceivedBankDraft' THEN
                       N'واریز'
                   WHEN 'PaymentBankDraft' THEN
                       N'برداشت'
                   WHEN 'Cash' THEN
                       N'نقد'
                   WHEN 'FromCustomers' THEN
                       N'فروشگاه'
                   WHEN 'Change' THEN
                       N'تبدیل ارز'
                   WHEN 'PettyCashCost' THEN
                       N'صورتخلاصه تنخواه'
                   WHEN 'DebitCreditNote' THEN
                       N'اعلامیه بدهکار بستانکار'
                   WHEN 'Wage' THEN
                       N'کارمزد'
               END,
               VW.DocumentID,
               VW.DocumentEngName,
               VW.[Date],
               CFG.GetCLRSaturnDate(VW.Date, @DateFormat, 0, @DateType),
               Amount,
               CASE
                   WHEN @CultureNo = 1 THEN
                       C.Title
                   WHEN @CultureNo = 2 THEN
                       C.Title2
               END AS Currency,
               CASE
                   WHEN @CultureNo = 1 THEN
                       SubjectTitle
                   WHEN @CultureNo = 2 THEN
                       SubjectTitle2
               END AS SubjectTitle,
               DlCode,
               CASE
                   WHEN @CultureNo = 1 THEN
                       DlTitle
                   WHEN @CultureNo = 2 THEN
                       DlTitle2
               END AS DlTitle,
               B.Code,
               CASE
                   WHEN @CultureNo = 1 THEN
                       B.Title
                   WHEN @CultureNo = 2 THEN
                       B.Title2
               END,
               CASE
                   WHEN @CultureNo = 1 THEN
                       BankOrCashTitle
                   WHEN @CultureNo = 2 THEN
                       BankOrCashTitle2
               END AS BankOrCashTitle,
               0 AS AffectedInVat,
			   VW.Description,
			   VW.Description2
        FROM FIN.VWResourcesConsumption VW
            JOIN CFG.Currency C
                ON C.CurrencyID = VW.CurrencyID
            JOIN CFG.Branch B
                ON B.BranchID = VW.BranchID
            JOIN CFG.vwFinancialPeriodAccess AS vfpa
                ON vfpa.FinancialPeriodID = VW.FinancialPeriodID
        WHERE Date
              BETWEEN @FromDate AND @ToDate
              AND vw.BranchID IN (SELECT ba.BranchID FROM #BranchAccess ba)
              AND VW.Type = 'Receive'
              AND SubjectType NOT IN ( 1, 2 )
              AND SubjectTypeID IN
                  (
					SELECT value
					FROM #Selected_Subjects
					WHERE Position = 2
                  );
    END;


    /*زمانیکه تبدیل ارز دریافتی انتخاب شود*/
    IF EXISTS (SELECT * FROM #Selected_Subjects WHERE Position = 3)
        INSERT INTO #RPT_ResourcesConsumption_Main
        (
            [DocumentType],
            [DocumentID],
            [DocumentEngName],
            [Date],
            [Date_Date],
            [Amount],
            [Currency],
            [Subject],
            DlCode,
            DlTitle,
            BranchCode,
            BranchTitle,
            BankOrCashTitle,
            AffectedInVat,
            [Description],
            [Description2]
        )
        SELECT CASE DocumentType
                   WHEN 'Cheque' THEN
                       N'چک'
                   WHEN 'ReceivedBankDraft' THEN
                       N'واریز'
                   WHEN 'PaymentBankDraft' THEN
                       N'برداشت'
                   WHEN 'Cash' THEN
                       N'نقد'
                   WHEN 'FromCustomers' THEN
                       N'فروشگاه'
                   WHEN 'Change' THEN
                       N'تبدیل ارز'
                   WHEN 'PettyCashCost' THEN
                       N'صورتخلاصه تنخواه'
                   WHEN 'DebitCreditNote' THEN
                       N'اعلامیه بدهکار بستانکار'
                   WHEN 'Wage' THEN
                       N'کارمزد'
               END,
               VW.DocumentID,
               VW.DocumentEngName,
               VW.[Date],
               CFG.GetCLRSaturnDate(VW.Date, @DateFormat, 0, @DateType),
               Amount,
               CASE
                   WHEN @CultureNo = 1 THEN
                       C.Title
                   WHEN @CultureNo = 2 THEN
                       C.Title2
               END AS Currency,
               'تبدیل ارز',
               DlCode,
               CASE
                   WHEN @CultureNo = 1 THEN
                       DlTitle
                   WHEN @CultureNo = 2 THEN
                       DlTitle2
               END AS DlTitle,
               B.Code,
               CASE
                   WHEN @CultureNo = 1 THEN
                       B.Title
                   WHEN @CultureNo = 2 THEN
                       B.Title2
               END,
               CASE
                   WHEN @CultureNo = 1 THEN
                       BankOrCashTitle
                   WHEN @CultureNo = 2 THEN
                       BankOrCashTitle2
               END AS BankOrCashTitle,
               0 AS AffectedInVat,
			   VW.Description,
			   VW.Description2
        FROM FIN.VWResourcesConsumption VW
            JOIN CFG.Currency C
                ON C.CurrencyID = VW.CurrencyID
            JOIN CFG.Branch B
                ON B.BranchID = VW.BranchID
            JOIN CFG.vwFinancialPeriodAccess AS vfpa
                ON vfpa.FinancialPeriodID = VW.FinancialPeriodID
        WHERE Date
              BETWEEN @FromDate AND @ToDate              
              AND vw.BranchID IN (SELECT ba.BranchID FROM #BranchAccess ba)
              AND DocumentType = 'Change'
              AND Amount > 0;


    /*زمانیکه پرداخت به تامین کننده انتخاب شود*/
    IF EXISTS (SELECT * FROM #Selected_Subjects WHERE Position = 4)
    BEGIN

        INSERT INTO #RPT_ResourcesConsumption_Main
        (
            [DocumentType],
            [DocumentID],
            [DocumentEngName],
            [Date],
            [Date_Date],
            [Amount],
            [Currency],
            [Subject],
            DlCode,
            DlTitle,
            BranchCode,
            BranchTitle,
            BankOrCashTitle,
            AffectedInVat,
            [Description],
            [Description2]
        )
        SELECT CASE DocumentType
                   WHEN 'Cheque' THEN
                       N'چک'
                   WHEN 'ReceivedBankDraft' THEN
                       N'واریز'
                   WHEN 'PaymentBankDraft' THEN
                       N'برداشت'
                   WHEN 'Cash' THEN
                       N'نقد'
                   WHEN 'FromCustomers' THEN
                       N'فروشگاه'
                   WHEN 'Change' THEN
                       N'تبدیل ارز'
                   WHEN 'PettyCashCost' THEN
                       N'صورتخلاصه تنخواه'
                   WHEN 'DebitCreditNote' THEN
                       N'اعلامیه بدهکار بستانکار'
                   WHEN 'Wage' THEN
                       N'کارمزد'
               END,
               VW.DocumentID,
               VW.DocumentEngName,
               VW.[Date],
               CFG.GetCLRSaturnDate(VW.Date, @DateFormat, 0, @DateType),
               Amount,
               CASE
                   WHEN @CultureNo = 1 THEN
                       C.Title
                   WHEN @CultureNo = 2 THEN
                       C.Title2
               END AS Currency,
               CASE
                   WHEN @CultureNo = 1 THEN
                       SubjectTitle
                   WHEN @CultureNo = 2 THEN
                       SubjectTitle2
               END AS SubjectTitle,
               DlCode,
               CASE
                   WHEN @CultureNo = 1 THEN
                       DlTitle
                   WHEN @CultureNo = 2 THEN
                       DlTitle2
               END AS DlTitle,
               B.Code,
               CASE
                   WHEN @CultureNo = 1 THEN
                       B.Title
                   WHEN @CultureNo = 2 THEN
                       B.Title2
               END,
               CASE
                   WHEN @CultureNo = 1 THEN
                       BankOrCashTitle
                   WHEN @CultureNo = 2 THEN
                       BankOrCashTitle2
               END AS BankOrCashTitle,
               0 AS AffectedInVat,
			   VW.Description,
			   VW.Description2
        FROM FIN.VWResourcesConsumption VW
            JOIN CFG.Currency C
                ON C.CurrencyID = VW.CurrencyID
            JOIN CFG.Branch B
                ON B.BranchID = VW.BranchID
            JOIN CFG.vwFinancialPeriodAccess AS vfpa
                ON vfpa.FinancialPeriodID = VW.FinancialPeriodID
        WHERE SubjectType IN ( 1, 10 )
              AND Date
              BETWEEN @FromDate AND @ToDate              
              AND vw.BranchID IN (SELECT ba.BranchID FROM #BranchAccess ba)
              AND VW.Type = 'Payment';
    END;


    /*زمانیکه ردیفی از سایر مصارف انتخاب شود*/
    IF EXISTS (SELECT * FROM #Selected_Subjects WHERE Position = 5)
    BEGIN


        INSERT INTO #RPT_ResourcesConsumption_Main
        (
            [DocumentType],
            [DocumentID],
            [DocumentEngName],
            [Date],
            [Date_Date],
            [Amount],
            [Currency],
            [Subject],
            DlCode,
            DlTitle,
            BranchCode,
            BranchTitle,
            BankOrCashTitle,
            AffectedInVat,
            [Description],
            [Description2]
        )
        SELECT CASE DocumentType
                   WHEN 'Cheque' THEN
                       N'چک'
                   WHEN 'ReceivedBankDraft' THEN
                       N'واریز'
                   WHEN 'PaymentBankDraft' THEN
                       N'برداشت'
                   WHEN 'Cash' THEN
                       N'نقد'
                   WHEN 'FromCustomers' THEN
                       N'فروشگاه'
                   WHEN 'Change' THEN
                       N'تبدیل ارز'
                   WHEN 'PettyCashCost' THEN
                       N'صورتخلاصه تنخواه'
                   WHEN 'DebitCreditNote' THEN
                       N'اعلامیه بدهکار بستانکار'
                   WHEN 'Wage' THEN
                       N'کارمزد'
               END,
               VW.DocumentID,
               VW.DocumentEngName,
               VW.[Date],
               CFG.GetCLRSaturnDate(VW.Date, @DateFormat, 0, @DateType),
               Amount,
               CASE
                   WHEN @CultureNo = 1 THEN
                       C.Title
                   WHEN @CultureNo = 2 THEN
                       C.Title2
               END AS Currency,
               CASE
                   WHEN @CultureNo = 1 THEN
                       SubjectTitle
                   WHEN @CultureNo = 2 THEN
                       SubjectTitle2
               END AS SubjectTitle,
               DlCode,
               CASE
                   WHEN @CultureNo = 1 THEN
                       DlTitle
                   WHEN @CultureNo = 2 THEN
                       DlTitle2
               END AS DlTitle,
               B.Code,
               CASE
                   WHEN @CultureNo = 1 THEN
                       B.Title
                   WHEN @CultureNo = 2 THEN
                       B.Title2
               END,
               CASE
                   WHEN @CultureNo = 1 THEN
                       BankOrCashTitle
                   WHEN @CultureNo = 2 THEN
                       BankOrCashTitle2
               END AS BankOrCashTitle,
               0 AS AffectedInVat,
			   VW.Description,
			   VW.Description2
        FROM FIN.VWResourcesConsumption VW
            JOIN CFG.Currency C
                ON C.CurrencyID = VW.CurrencyID
            JOIN CFG.Branch B
                ON B.BranchID = VW.BranchID
            JOIN CFG.vwFinancialPeriodAccess AS vfpa
                ON vfpa.FinancialPeriodID = VW.FinancialPeriodID
        WHERE SubjectType NOT IN ( 1, 10 )
              AND Date
              BETWEEN @FromDate AND @ToDate              
              AND vw.BranchID IN (SELECT ba.BranchID FROM #BranchAccess ba)
              AND VW.Type = 'Payment'
              AND SubjectTypeID IN
                  (
					SELECT value
					FROM #Selected_Subjects
					WHERE Position = 5
                  );
    END;


    /*زمانیکه تبدیل ارز پرداختی انتخاب شود*/
    IF EXISTS (SELECT * FROM #Selected_Subjects WHERE Position = 6)
        INSERT INTO #RPT_ResourcesConsumption_Main
        (
            [DocumentType],
            [DocumentID],
            [DocumentEngName],
            [Date],
            [Date_Date],
            [Amount],
            [Currency],
            [Subject],
            DlCode,
            DlTitle,
            BranchCode,
            BranchTitle,
            BankOrCashTitle,
            AffectedInVat,
            [Description],
            [Description2]
        )
        SELECT CASE DocumentType
                   WHEN 'Cheque' THEN
                       N'چک'
                   WHEN 'ReceivedBankDraft' THEN
                       N'واریز'
                   WHEN 'PaymentBankDraft' THEN
                       N'برداشت'
                   WHEN 'Cash' THEN
                       N'نقد'
                   WHEN 'FromCustomers' THEN
                       N'فروشگاه'
                   WHEN 'Change' THEN
                       N'تبدیل ارز'
                   WHEN 'PettyCashCost' THEN
                       N'صورتخلاصه تنخواه'
                   WHEN 'DebitCreditNote' THEN
                       N'اعلامیه بدهکار بستانکار'
                   WHEN 'Wage' THEN
                       N'کارمزد'
               END,
               VW.DocumentID,
               VW.DocumentEngName,
               VW.[Date],
               CFG.GetCLRSaturnDate(VW.Date, @DateFormat, 0, @DateType),
               Amount,
               CASE
                   WHEN @CultureNo = 1 THEN
                       C.Title
                   WHEN @CultureNo = 2 THEN
                       C.Title2
               END AS Currency,
               N'تبدیل ارز',
               DlCode,
               CASE
                   WHEN @CultureNo = 1 THEN
                       DlTitle
                   WHEN @CultureNo = 2 THEN
                       DlTitle2
               END AS DlTitle,
               B.Code,
               CASE
                   WHEN @CultureNo = 1 THEN
                       B.Title
                   WHEN @CultureNo = 2 THEN
                       B.Title2
               END,
               CASE
                   WHEN @CultureNo = 1 THEN
                       BankOrCashTitle
                   WHEN @CultureNo = 2 THEN
                       BankOrCashTitle2
               END AS BankOrCashTitle,
               0 AS AffectedInVat,
			   VW.Description,
			   VW.Description2
        FROM FIN.VWResourcesConsumption VW
            JOIN CFG.Currency C
                ON C.CurrencyID = VW.CurrencyID
            JOIN CFG.Branch B
                ON B.BranchID = VW.BranchID
            JOIN CFG.vwFinancialPeriodAccess AS vfpa
                ON vfpa.FinancialPeriodID = VW.FinancialPeriodID
        WHERE VW.Date
              BETWEEN @FromDate AND @ToDate              
              AND vw.BranchID IN (SELECT ba.BranchID FROM #BranchAccess ba)
              AND DocumentType = 'Change'
              AND Amount < 0;

    /*زمانیکه کارمزد انتخاب شود*/
    IF EXISTS (SELECT * FROM #Selected_Subjects WHERE Position = 7)
        INSERT INTO #RPT_ResourcesConsumption_Main
        (
            [DocumentType],
            [DocumentID],
            [DocumentEngName],
            [Date],
            [Date_Date],
            [Amount],
            [Currency],
            [Subject],
            DlCode,
            DlTitle,
            BranchCode,
            BranchTitle,
            BankOrCashTitle,
            AffectedInVat,
            [Description],
            [Description2]
        )
        SELECT CASE DocumentType
                   WHEN 'Cheque' THEN
                       N'چک'
                   WHEN 'ReceivedBankDraft' THEN
                       N'واریز'
                   WHEN 'PaymentBankDraft' THEN
                       N'برداشت'
                   WHEN 'Cash' THEN
                       N'نقد'
                   WHEN 'FromCustomers' THEN
                       N'فروشگاه'
                   WHEN 'Change' THEN
                       N'تبدیل ارز'
                   WHEN 'PettyCashCost' THEN
                       N'صورتخلاصه تنخواه'
                   WHEN 'DebitCreditNote' THEN
                       N'اعلامیه بدهکار بستانکار'
                   WHEN 'Wage' THEN
                       N'کارمزد'
               END,
               VW.DocumentID,
               VW.DocumentEngName,
               VW.[Date],
               CFG.GetCLRSaturnDate(VW.Date, @DateFormat, 0, @DateType),
               Amount,
               CASE
                   WHEN @CultureNo = 1 THEN
                       C.Title
                   WHEN @CultureNo = 2 THEN
                       C.Title2
               END AS Currency,
               N'کارمزد',
               DlCode,
               CASE
                   WHEN @CultureNo = 1 THEN
                       DlTitle
                   WHEN @CultureNo = 2 THEN
                       DlTitle2
               END AS DlTitle,
               B.Code,
               CASE
                   WHEN @CultureNo = 1 THEN
                       B.Title
                   WHEN @CultureNo = 2 THEN
                       B.Title2
               END,
               CASE
                   WHEN @CultureNo = 1 THEN
                       BankOrCashTitle
                   WHEN @CultureNo = 2 THEN
                       BankOrCashTitle2
               END AS BankOrCashTitle,
               0 AS AffectedInVat,
			   VW.Description,
			   VW.Description2
        FROM FIN.VWResourcesConsumption VW
            JOIN CFG.Currency C
                ON C.CurrencyID = VW.CurrencyID
            JOIN CFG.Branch B
                ON B.BranchID = VW.BranchID
            JOIN CFG.vwFinancialPeriodAccess AS vfpa
                ON vfpa.FinancialPeriodID = VW.FinancialPeriodID
        WHERE VW.Date BETWEEN @FromDate AND @ToDate              
              AND vw.BranchID IN (SELECT ba.BranchID FROM #BranchAccess ba)
              AND DocumentType = 'Wage'

    SELECT ID,
           DocumentType,
           DocumentID,
           DocumentEngName,
           Date,
           Date_Date,
           Amount,
           Currency,
           Subject,
           DlCode,
           DlTitle,
           BranchCode,
           BranchTitle,
           BankOrCashTitle,
           AffectedInVat,
           case when @CultureNo = 2 then [Description2] else [Description] END AS [Description] 
    FROM #RPT_ResourcesConsumption_Main;
END;
