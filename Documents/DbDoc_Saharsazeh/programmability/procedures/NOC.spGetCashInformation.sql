
CREATE   PROC NOC.spGetCashInformation
(
	@AnalysingID INT
)
--WITH ENCRYPTION
AS
BEGIN
	DECLARE @EndDate	DATE,
			@user INT,
			@PreviousPeriod INT,
			@Culture VARCHAR(5),
			@PaymentReceipt NVARCHAR(25),
			@DebitCreditNote NVARCHAR(25),
			@PettyCashCost NVARCHAR(25),
			@BasePrecision INT,
			@DateType TINYINT,
            @DateFormat VARCHAR(10),
			@CultureNo         TINYINT

	SET @user = cfg.GetuserID()
	SET @Culture = cfg.GetuserCulture()
	SET @BasePrecision = cfg.GetBaseCurrencyPrecision()

	SELECT @CultureNo =ISNULL( CultureNo,1)
	FROM   CFG.CultureInfo
	WHERE  Culture = @Culture

	SELECT  @DateType = us.SettingValue
    FROM    CFG.UserSetting us
    WHERE   us.SettingKey = 'Date_Type'
            AND us.UserID = @user
	
    IF @DateType IS NULL
        SET @DateType = CASE CFG.GetuserCulture()
                            WHEN 'fa' THEN 0
                            WHEN 'en' THEN 1
                            WHEN 'ar' THEN 2
                        END
	
    SELECT  @DateFormat = us.SettingValue
    FROM    CFG.UserSetting us
    WHERE   us.SettingKey = 'Date_Format'
            AND us.UserID = @user
	
    IF @DateFormat IS NULL
        SET @DateFormat = 'YY/MM/DD'

	SELECT  @PaymentReceipt = LV.Value
    FROM    CFG.LocalizeEnum L
        JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE   L.Enum = 'DocumentNumTypes'
        AND L.Item = 'PaymentReceipt'
        AND LV.Culture = @Culture;

	SELECT  @DebitCreditNote = LV.Value
    FROM    CFG.LocalizeEnum L
        JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE   L.Enum = 'DocumentNumTypes'
        AND L.Item = 'DebitCreditNote'
        AND LV.Culture = @Culture;

	SELECT  @PettyCashCost = LV.Value
    FROM    CFG.LocalizeEnum L
        JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE   L.Enum = 'DocumentNumTypes'
        AND L.Item = 'PettyCashCost'
        AND LV.Culture = @Culture;

	SELECT  @EndDate = r.enddate
	FROM NOC.Analysing a
		 JOIN NOC.ReportagePeriod r ON a.ReportagePeriodID = r.ReportagePeriodID
	WHERE a.AnalysingID = @AnalysingID

	SELECT TOP 1 @PreviousPeriod = ReportagePeriodID
	FROM NOC.ReportagePeriod
	WHERE EndDate < @EndDate
	ORDER BY EndDate DESC

	SELECT  b.CashAnalysingID,
		    b.AnalysingID,
			c.CashDataCollectionID,	
			c.VoucherID,
			c.CalculationResultID,
			V.ReferenceNumber Number,
			V.Date VoucherDate,
			b.EffectiveDate,
			i.Amount,
			i.BaseCurrencyAmount,
			b.DlID,
			b.Status,
			b.Version,
			b.Creator,
			b.CreationDate,
			b.ReportCurrencyRate,
			b.RowIndex,
			b.ContractID
	INTO #TMP
	FROM noc.Analysing a
		JOIN noc.CashAnalysing b ON a.AnalysingID = b.AnalysingID
		JOIN noc.CashDataCollection c ON b.CashDataCollectionID = c.CashDataCollectionID
		JOIN acc.Voucher v ON v.VoucherID = c.VoucherID
		JOIN
		(
			SELECT CashAnalysingID,sum(Amount) Amount,SUM(BaseCurrencyAmount) BaseCurrencyAmount
			FROM  noc.CashAnalysingItem
			GROUP BY CashAnalysingID
		) i ON i.CashAnalysingID = b.CashAnalysingID
	WHERE a.AnalysingID = @AnalysingID

	SELECT  t.CashAnalysingID,
				t.RowIndex,
				t.AnalysingID,
				t.CashDataCollectionID,
				t.CalculationResultID,
				t.VoucherID ,
				t.Number,				
				CFG.GetCLRSaturnDate(t.VoucherDate, @DateFormat, 0, @DateType) VoucherDate,
				CFG.GetCLRSaturnDate(t.EffectiveDate, 'YYYY-MM-DD', 0, 1) EffectiveDate,
				d.Code DLCode,
				case when @CultureNo = 1 then d.Title else d.Title2 end DLTitle,
				ReportCurrencyRate CurrencyRate,
				Amount,
				BaseCurrencyAmount,
				t.Status,
				t.Version,
				t.Creator,
				t.CreationDate,
				t.ContractID,
				cd.Code AS ContractDlCode,
				CASE WHEN @CultureNo = 1 
					THEN cd.Title 
					ELSE cd.Title2 
				END ContractDlTitle
		FROM #TMP t
			LEFT JOIN ACC.DL d
				ON d.DLID = t.DLID
			LEFT JOIN CNT.[Contract] c
				ON c.ContractID = t.ContractID
			LEFT JOIN ACC.DL cd
				ON cd.DLID = c.DLID
		ORDER BY t.[RowIndex]
END
