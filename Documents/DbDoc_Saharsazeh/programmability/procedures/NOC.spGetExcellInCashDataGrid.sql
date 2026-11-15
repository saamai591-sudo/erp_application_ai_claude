------------------------------------- END #7071

------------------------------------- START #7069
CREATE    PROC NOC.spGetExcellInCashDataGrid
(@AnalysingID INT)
--WITH ENCRYPTION
AS
BEGIN
    DECLARE @EndDate DATE,
            @user INT,
            @FirstEndDate DATE,
            @Culture VARCHAR(5),
            @PaymentReceipt NVARCHAR(25),
            @DebitCreditNote NVARCHAR(25),
            @PettyCashCost NVARCHAR(25),
            @BasePrecision INT,
            @ReportagePeriodID INT;

    SET @user = CFG.GetuserID();
    SET @Culture = CFG.GetuserCulture();
    SET @BasePrecision = CFG.GetBaseCurrencyPrecision();

    DECLARE @UserID INT,
            @DateType VARCHAR(10),
            @DateFormat VARCHAR(10),
            @CultureNo TINYINT;

    SELECT @CultureNo = CultureNo
    FROM CFG.CultureInfo
    WHERE Culture = @Culture;

    SELECT @DateType = us.SettingValue
    FROM CFG.UserSetting us
    WHERE us.SettingKey = 'Date_Type'
          AND us.UserID = @UserID;

    IF @DateType IS NULL
        SET @DateType = CASE CFG.GetuserCulture()
                            WHEN 'fa' THEN
                                0
                            WHEN 'en' THEN
                                1
                            WHEN 'ar' THEN
                                2
                        END;

    SELECT @DateFormat = UPPER(us.SettingValue)
    FROM CFG.UserSetting us
    WHERE us.SettingKey = 'Date_Format'
          AND us.UserID = @UserID;

    IF @DateFormat IS NULL
        SET @DateFormat = 'YY/MM/DD';

    SELECT @PaymentReceipt = LV.Value
    FROM CFG.LocalizeEnum L
        JOIN CFG.LocalizeEnumValue LV
            ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE L.Enum = 'DocumentNumTypes'
          AND L.Item = 'PaymentReceipt'
          AND LV.Culture = @Culture;

    SELECT @DebitCreditNote = LV.Value
    FROM CFG.LocalizeEnum L
        JOIN CFG.LocalizeEnumValue LV
            ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE L.Enum = 'DocumentNumTypes'
          AND L.Item = 'DebitCreditNote'
          AND LV.Culture = @Culture;

    SELECT @PettyCashCost = LV.Value
    FROM CFG.LocalizeEnum L
        JOIN CFG.LocalizeEnumValue LV
            ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE L.Enum = 'DocumentNumTypes'
          AND L.Item = 'PettyCashCost'
          AND LV.Culture = @Culture;

    SELECT @EndDate = r.EndDate,
           @ReportagePeriodID = r.ReportagePeriodID
    FROM NOC.Analysing a
        JOIN NOC.ReportagePeriod r
            ON a.ReportagePeriodID = r.ReportagePeriodID
    WHERE a.AnalysingID = @AnalysingID;

    SELECT TOP 1
           @FirstEndDate = EndDate
    FROM NOC.ReportagePeriod
    ORDER BY EndDate;

    DECLARE @PayrollDividedOnPersonell BIT;

    SELECT @PayrollDividedOnPersonell = ISNULL(ConfigValue, 0)
    FROM NOC.NIOCSetting
    WHERE ConfigKey = 'PayrollDividedOnPersonell';

    SELECT b.CashAnalysingID,
           b.AnalysingID,
           c.CashDataCollectionID,
           c.VoucherID,
           CASE
               WHEN c.PaymentSubjectID IS NOT NULL THEN
                   d.ReferenceNumber
               WHEN c.DebitCreditNoteItemID IS NOT NULL THEN
                   e.ReferenceNumber
               WHEN c.PettyCashCostItemID IS NOT NULL THEN
                   f.ReferenceNumber
               WHEN c.PurchaseInvoicePrePaymentID IS NOT NULL THEN
                   vip.ReferenceNumber
               WHEN c.ConfirmStatementPrePaymentID IS NOT NULL THEN
                   csi.ReferenceNumber
               WHEN c.ReceiveSubjectID IS NOT NULL THEN
                   rr.ReferenceNumber
               WHEN c.ConfirmStatementItemID IS NOT NULL THEN
                   ddcs.ReferenceNumber
           END Number,
           CASE
               WHEN c.PaymentSubjectID IS NOT NULL THEN
                   d.VoucherDate
               WHEN c.DebitCreditNoteItemID IS NOT NULL THEN
                   e.VoucherDate
               WHEN c.PettyCashCostItemID IS NOT NULL THEN
                   f.VoucherDate
               WHEN c.PurchaseInvoicePrePaymentID IS NOT NULL THEN
                   vip.VoucherDate
               WHEN c.ConfirmStatementPrePaymentID IS NOT NULL THEN
                   csi.VoucherDate
               WHEN c.ReceiveSubjectID IS NOT NULL THEN
                   rr.VoucherDate
               WHEN c.ConfirmStatementItemID IS NOT NULL THEN
                   ddcs.VoucherDate
           END VoucherDate,
           b.EffectiveDate Date,
           b.DlID,
           CASE
               WHEN c.PaymentSubjectID IS NOT NULL THEN
                   d.Description
               WHEN c.DebitCreditNoteItemID IS NOT NULL THEN
                   e.Description
               WHEN c.PettyCashCostItemID IS NOT NULL THEN
                   f.Description
               WHEN c.PurchaseInvoicePrePaymentID IS NOT NULL THEN
                   vip.Description
               WHEN c.ConfirmStatementPrePaymentID IS NOT NULL THEN
                   csi.Description
               WHEN c.ReceiveSubjectID IS NOT NULL THEN
                   rr.Description
               WHEN c.ConfirmStatementItemID IS NOT NULL THEN
                   ddcs.Description
           END Description,
           CASE b.[Status]
               WHEN 1 THEN
                   N'گزارش در دوره جاری'
               WHEN 2 THEN
                   N'انتقال به دوره بعد'
               WHEN 3 THEN
                   N'عدم گزارش'
           END Status,
           b.ReportCurrencyRate
	       INTO #TMP1
    FROM NOC.Analysing a
    JOIN NOC.CashAnalysing b
        ON a.AnalysingID = b.AnalysingID
    JOIN NOC.CashDataCollection c
        ON b.CashDataCollectionID = c.CashDataCollectionID
    LEFT JOIN NOC.VwPaymentReceipt d
        ON d.PaymentSubjectID = c.PaymentSubjectID
    LEFT JOIN NOC.VwDebitCreditNote e
        ON e.DebitCreditNoteItemID = c.DebitCreditNoteItemID
    LEFT JOIN NOC.VwPettyCashCost f
        ON f.PettyCashCostItemID = c.PettyCashCostItemID
    LEFT JOIN NOC.VWPurchaseInvoicePrePayment vip
        ON vip.PurchaseInvoicePrePaymentID = c.PurchaseInvoicePrePaymentID
    LEFT JOIN NOC.VwConfirmStatementItem csi
        ON csi.ConfirmStatementPrePaymentID = c.ConfirmStatementPrePaymentID
    LEFT JOIN NOC.VwReceiveReceipt rr
        ON rr.ReceiveSubjectID = c.ReceiveSubjectID
    left join NOC.VwDepreciatedDeductionInConfirmStatement ddcs
	    on ddcs.ConfirmStatementItemID = c.ConfirmStatementItemID
    WHERE a.AnalysingID = @AnalysingID
          AND b.Status = 1
	      and c.CalculationResultID is null

	declare @StaffDL int 

	select @StaffDL = ConfigValue
	from noc.NIOCSetting
	where ConfigKey = 'StaffDL'

    SELECT ad.ReferenceNumber Number,
           ad.VoucherDate,
           b.EffectiveDate Date,
           @StaffDL DlID,
           CASE b.[Status]
               WHEN 1 THEN
                   N'گزارش در دوره جاری'
               WHEN 2 THEN
                   N'انتقال به دوره بعد'
               WHEN 3 THEN
                   N'عدم گزارش'
           END Status,
           min(b.ReportCurrencyRate) ReportCurrencyRate,
	       sum(CASE
               WHEN i.BaseCurrencyAmount > 0 THEN
                   abs(i.BaseCurrencyAmount)
               ELSE
                   0
			    END) Debit,
	       sum(CASE
               WHEN i.BaseCurrencyAmount < 0 THEN
                   abs(i.BaseCurrencyAmount)
               ELSE
                   0
			    END) Credit,
           sum(CASE
               WHEN i.Amount > 0 THEN
                   i.Amount
               ELSE
                   0
           END) DollarDebit,
           sum(CASE
               WHEN i.Amount < 0 THEN
                   ABS(i.Amount)
               ELSE
                   0
           END) DollarCredit,
	       SlID
	       INTO #TMP2
    FROM NOC.Analysing a
    JOIN NOC.CashAnalysing b
        ON a.AnalysingID = b.AnalysingID
    JOIN NOC.CashDataCollection c
        ON b.CashDataCollectionID = c.CashDataCollectionID
    JOIN [NOC].[FnAdvanceDepreciation]() ad
        ON ad.CalculationResultID =c.CalculationResultID
    JOIN NOC.CashAnalysingItem i
        ON b.CashAnalysingID = i.CashAnalysingID
    WHERE a.AnalysingID = @AnalysingID
          AND b.Status = 1
    group by ad.ReferenceNumber,ad.VoucherDate,b.EffectiveDate,b.[Status],SlID

    select VoucherItemID,dl.DlID,dl.Code,dl.Title
    into #Party
    from acc.AccountLevelVoucherItem alvi
    join acc.dl 
    on dl.DLID = alvi.DlID
    and dl.DlTypeID = 28  

    SELECT t.Number AS N'شماره',
           CFG.GetCLRSaturnDate(t.Date, @DateFormat, 0, @DateType) AS N'تاریخ',
           vw.SlCode AS N'کد معین',
           vw.SlTitle AS N'عنوان معین',
           CASE
               WHEN i.BaseCurrencyAmount > 0 THEN
                   i.BaseCurrencyAmount
               ELSE
                   0
           END AS 'بدهکار(ریال)',
           CASE
               WHEN i.BaseCurrencyAmount < 0 THEN
                   ABS(i.BaseCurrencyAmount)
               ELSE
                   0
           END AS 'بستانکار(ریال)',
           ReportCurrencyRate AS N'نرخ ارز' ,
           CASE
               WHEN i.Amount > 0 THEN
                   i.Amount
               ELSE
                   0
           END 'بدهکار(دلار)',
           CASE
               WHEN i.Amount < 0 THEN
                   ABS(i.Amount)
               ELSE
                   0
           END 'بستانکار(دلار)',
           d.Code AS N'کد تفضیل',
           d.Title AS N'عنوان تفضیل',
           t.Description AS N'توضیحات'
    FROM #TMP1 t
        JOIN ACC.DL d
            ON d.DLID = t.DlID
        JOIN NOC.CashAnalysingItem i
            ON t.CashAnalysingID = i.CashAnalysingID
        JOIN ACC.vwaccounts vw
            ON vw.slid = i.SlID
    UNION ALL

    SELECT t.Number,
           CFG.GetCLRSaturnDate(t.Date, @DateFormat, 0, @DateType) Date,
           vw.SlCode,
           vw.SlTitle,
           Debit AS 'بدهکار(ریال)',
           Credit AS 'بستانکار(ریال)',
           ReportCurrencyRate CurrencyRate,
           DollarDebit 'بدهکار(دلار)',
           DollarCredit 'بستانکار(دلار)',
           d.Code DLCode,
           d.Title DLTitle,
           null
    FROM #TMP2 t
        JOIN ACC.DL d
            ON d.DLID = t.DlID
        JOIN ACC.vwaccounts vw
            ON vw.slid = t.SlID
    UNION ALL
    SELECT ReferenceNumber,
           CFG.GetCLRSaturnDate(ToDate, @DateFormat, 0, @DateType) Date,
           SlCode,
           SlTitle,
           BaseCurrencyDebit AS 'بدهکار(ریال)',
           BaseCurrencyCredit AS 'بستانکار(ریال)',
           CurrencyRate,
           Debit 'بدهکار(دلار)',
           Credit 'بستانکار(دلار)',
           d.Code DLCode,
           d.Title DLTitle,
           NULL
    FROM NOC.CashFounding a
        JOIN ACC.vwaccounts vw
            ON vw.slid = a.SlID
        JOIN ACC.DL d
            ON d.DLID = a.DLID
	    left join 
	    (
	    select b.EntityID,c.ReferenceNumber,c.Date VoucherDate
	    from cfg.EntityCustomeField a
	    join cfg.EntityCustomeFieldData b
		    on a.EntityCustomeFieldID = b.EntityCustomeFieldID
	    join acc.Voucher c
		    on c.voucherid = b.LookupDataItemID
	    where a.EntityName = 'CashFounding'
	    and a.FieldName = 'ReferenceNumber1'
	    ) ecf1 on ecf1.EntityID = a.CashFoundingID
    WHERE ReportagePeriodID = @ReportagePeriodID
    UNION ALL
    SELECT ReferenceNumber,
           CFG.GetCLRSaturnDate(m.Date, @DateFormat, 0, @DateType) Date,
           SlCode,
           SlTitle,
		    case when BaseCurrencyDebitCash - BaseCurrencyCreditCash > 0 
			    then 0
			    else BaseCurrencyDebitCash - BaseCurrencyCreditCash end AS 'بدهکار(ریال)',
		    case when BaseCurrencyDebitCash - BaseCurrencyCreditCash > 0 
			    then  (BaseCurrencyDebitCash - BaseCurrencyCreditCash)
			    else 0 end AS 'بستانکار(ریال)',
           m.ReportCurrencyRate CurrencyRate,
		    case when ReportCurrencyDebitCash - ReportCurrencyCreditCash > 0 
			    then 0
			    else ReportCurrencyDebitCash - ReportCurrencyCreditCash end AS 'بدهکار(دلار)',
		    case when ReportCurrencyDebitCash - ReportCurrencyCreditCash > 0 
			    then  (ReportCurrencyDebitCash - ReportCurrencyCreditCash)
			    else 0 end AS 'بستانکار(دلار)',
           dl.Code DLCode,
           dl.Title DLTitle,
           m.Description
    from noc.Modification m
    join
    (
    select ModificationID,
	    sum(BaseCurrencyDebitCash) BaseCurrencyDebitCash,
	    sum(BaseCurrencyCreditCash) BaseCurrencyCreditCash,
	    sum(ReportCurrencyDebitCash) ReportCurrencyDebitCash,
	    sum(ReportCurrencyCreditCash) ReportCurrencyCreditCash
    from noc.ModifiedTopic
    group by ModificationID
    having sum(BaseCurrencyDebitCash) <> 0 or sum(BaseCurrencyCreditCash) <> 0
    ) mt
    on mt.ModificationID = m.ModificationID
    left join #Party dl
	    on dl.VoucherItemID = m.VoucherItemID
    left join acc.VWVoucherPrevoucher vp 
	    on vp.PreVoucherID = m.PreVoucherID
    JOIN ACC.vwaccounts vw
        ON vw.slid = m.SlID
    where  ReportagePeriodID = @ReportagePeriodID

    UNION ALL

    SELECT ReferenceNumber,
           CFG.GetCLRSaturnDate(m.Date, @DateFormat, 0, @DateType) Date,
           SlCode,
           SlTitle,
           BaseCurrencyDebitCash AS 'بدهکار(ریال)',
           BaseCurrencyCreditCash AS 'بستانکار(ریال)',
           m.ReportCurrencyRate  CurrencyRate,
           ReportCurrencyDebitCash 'بدهکار(دلار)',
           ReportCurrencyCreditCash 'بستانکار(دلار)',
           dl.Code DLCode,
           dl.Title DLTitle,
           m.Description
    from noc.ModifiedTopic mt
    join noc.Modification m
	    on mt.ModificationID = m.ModificationID
    left join #Party dl
	    on dl.VoucherItemID = m.VoucherItemID
    left join acc.VWVoucherPrevoucher vp 
	    on vp.PreVoucherID = m.PreVoucherID
    JOIN ACC.vwaccounts vw
        ON vw.slid = m.SlID
    where  ReportagePeriodID = @ReportagePeriodID
    and ToBeReported = 1
    and (mt.BaseCurrencyDebitCash <> 0 or mt.BaseCurrencyCreditCash <> 0);
END
