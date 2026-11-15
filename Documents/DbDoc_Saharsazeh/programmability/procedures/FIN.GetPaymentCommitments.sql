-------------------------------------
CREATE   PROCEDURE [FIN].GetPaymentCommitments (@FinancialPeriodId INT = NULL,
@paymentCommitmentID INT = NULL)
--WITH ENCRYPTION
AS
        DECLARE @UserID INT
               ,@Initial NVARCHAR(100)
               ,@Submit NVARCHAR(100)
               ,@PreVoucher NVARCHAR(100)
               ,@Voucher NVARCHAR(100)
               ,@Culture VARCHAR(25)
               ,@DateType TINYINT
               ,@DateFormat VARCHAR(10)
               ,@CultureNo TINYINT

        SET @UserID = cfg.GetuserID()
        SET @Culture = cfg.GetuserCulture()

        SELECT
                @CultureNo = CultureNo
        FROM CFG.CultureInfo
        WHERE Culture = @Culture

        SELECT
                @DateType = us.SettingValue
        FROM cfg.UserSetting us
        WHERE us.SettingKey = 'Date_Type'
        AND us.UserID = @UserID

        IF @DateType IS NULL
                SET @DateType =
                CASE @Culture
                        WHEN 'fa' THEN 0
                        WHEN 'en' THEN 1
                        WHEN 'ar' THEN 2
                END

        SELECT
                @DateFormat = us.SettingValue
        FROM cfg.UserSetting us
        WHERE us.SettingKey = 'Date_Format'
        AND us.UserID = @UserID

        IF @DateFormat IS NULL
                SET @DATEFORMAT = 'YY/MM/DD'

        SELECT
                @Submit = LV.Value
        FROM cfg.LocalizeEnum L
        JOIN cfg.LocalizeEnumValue LV
                ON L.LocalizeEnumID = LV.LocalizeEnumID
        WHERE L.Enum = 'Statuses'
        AND L.Item = 'Submit'
        AND LV.Culture = @Culture

        SELECT
                @Voucher = LV.Value
        FROM cfg.LocalizeEnum L
        JOIN cfg.LocalizeEnumValue LV
                ON L.LocalizeEnumID = LV.LocalizeEnumID
        WHERE L.Enum = 'PreVoucherStatuses'
        AND L.Item = 'Voucher'
        AND LV.Culture = @Culture

        SELECT
                @PreVoucher = LV.Value
        FROM cfg.LocalizeEnum L
        JOIN cfg.LocalizeEnumValue LV
                ON L.LocalizeEnumID = LV.LocalizeEnumID
        WHERE L.Enum = 'PreVoucherStatuses'
        AND L.Item = 'PreVoucher'
        AND LV.Culture = @Culture

        SELECT
                @Initial = LV.Value
        FROM cfg.LocalizeEnum L
        JOIN cfg.LocalizeEnumValue LV
                ON L.LocalizeEnumID = LV.LocalizeEnumID
        WHERE L.Enum = 'StatusOfReceipt'
        AND L.Item = 'Initial'
        AND LV.Culture = @Culture;

        SELECT
                * INTO #vwBranchAccess
        FROM cfg.vwBranchAccess AS vba;

        DECLARE @BaseCurrencyPrecision INT
        SET @BaseCurrencyPrecision = CFG.GetBaseCurrencyPrecision()

        SELECT
                i.PaymentCommitmentID
               ,SUM(i.AmountInBaseCurrency) AmountInBaseCurrency INTO #items
        FROM (SELECT
                        a.PaymentCommitmentID
                       ,CASE
                                WHEN c.IsBaseCurrencyBasis = 0 THEN ROUND(a.Amount * a.CurrencyRate / c.ExchangeUnit, @BaseCurrencyPrecision)
                                WHEN c.IsBaseCurrencyBasis = 1 THEN ROUND(a.Amount * c.ExchangeUnit / a.CurrencyRate, @BaseCurrencyPrecision)
                        END AS AmountInBaseCurrency
                FROM (SELECT
                                PaymentCommitmentID
                               ,CurrencyID
                               ,CurrencyRate
                               ,Amount
                        FROM FIN.PaymentCheqeCommitment
                        UNION ALL
                        SELECT
                                PaymentCommitmentID
                               ,CurrencyID
                               ,CurrencyRate
                               ,Amount
                        FROM FIN.PaymentPromissoryCommitment
                        UNION ALL
                        SELECT
                                PaymentCommitmentID
                               ,CurrencyID
                               ,CurrencyRate
                               ,Amount
                        FROM FIN.PaymentGuarantyCommitment) a
                JOIN CFG.Currency c
                        ON a.CurrencyID = c.CurrencyID) i
        GROUP BY i.PaymentCommitmentID

        SELECT
                p.PaymentCommitmentID
               ,p.FinancialPeriodID
               ,p.BranchID
               ,b.Code BranchCode
               ,p.BaseType
               ,CASE @CultureNo
                        WHEN 1 THEN b.Title
                        WHEN 2 THEN b.Title2
                END AS BranchName
               ,p.Number
               ,p.Date
               ,p.PartyID
               ,d.Code PartyCode
               ,CASE @CultureNo
                        WHEN 1 THEN d.Title
                        WHEN 2 THEN d.Title2
                END AS PartyName
               ,p.Description
               ,p.Description2
               ,p.PreVoucherID
               ,p.Status
               ,p.ContractID
               ,dl.Code ContractDlCode
               ,ct.Title ContractTitle
               ,p.TenderID
               ,CASE @CultureNo
                        WHEN 1 THEN t.Title
                        WHEN 2 THEN t.Title2
                END AS TenderTitle
               ,p.PaymentRequestID
               ,pr.Number RequestNumber
               ,p.Version
               ,p.Creator
               ,p.CreationDate
               ,p.LastEditor
               ,p.LastEditionDate
               ,CFG.GetCLRSaturnDate(p.[Date], @DateFormat, 0, @DateType) PersianDate
               ,CFG.GetCLRSaturnDate(p.CreationDate, @DateFormat, 1, @DateType) CreateDateString
               ,CFG.GetCLRSaturnDate(p.LastEditionDate, @DateFormat, 1, @DateType) EditionDateString
               ,u.[Name] CreatorUserName
               ,u2.[Name] EditorName
               ,vp.VoucherID
               ,v.ReferenceNumber VoucherNumber
               ,CFG.GetCLRSaturnDate(v.Date, @DateFormat, 0, @DateType) VoucherDate
               ,CAST(CASE
                        WHEN p.[Status] = 1 THEN @Initial
                        WHEN vp.VoucherID IS NOT NULL THEN @Voucher
                        WHEN p.PreVoucherID IS NOT NULL THEN @PreVoucher
                        ELSE @Submit
                END AS NVARCHAR(512)) AS StatusString
               ,i.AmountInBaseCurrency

        FROM FIN.PaymentCommitment p
        JOIN CFG.Branch b
                ON p.BranchID = b.BranchID
        JOIN CFG.Party pa
                ON p.PartyID = pa.PartyID
        LEFT JOIN ACC.DL d
                ON pa.DlID = d.DLID
        LEFT JOIN CNT.Contract ct
                ON p.ContractID = ct.ContractID
        LEFT JOIN ACC.DL dl
                ON ct.DLID = dl.DLID
        LEFT JOIN VND.Tender t
                ON p.TenderID = t.TenderID
        LEFT JOIN REQ.PaymentRequest pr
                ON p.PaymentRequestID = pr.PaymentRequestID
        JOIN CFG.[User] u
                ON u.UserID = p.Creator
        JOIN CFG.[User] u2
                ON u2.UserID = p.LastEditor
        LEFT JOIN (SELECT
                        PrevoucherID
                       ,VoucherID
                FROM ACC.VoucherPrevoucher
                GROUP BY PrevoucherID
                        ,VoucherID) vp
                ON p.PreVoucherID = vp.PrevoucherID
        LEFT JOIN ACC.Voucher v
                ON vp.VoucherID = v.VoucherID
        JOIN #items i
                ON p.PaymentCommitmentID = i.PaymentCommitmentID
        JOIN #vwBranchAccess AS vba
                ON vba.BranchID = p.BranchID
        WHERE ((@FinancialPeriodId IS NOT NULL
        AND p.FinancialPeriodID = @FinancialPeriodId)
        OR (@paymentCommitmentID IS NOT NULL
        AND p.PaymentCommitmentID = @paymentCommitmentID))
