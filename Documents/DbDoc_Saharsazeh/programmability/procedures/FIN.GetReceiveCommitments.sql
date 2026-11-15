
------------------------------------- START #7341_1
CREATE   PROCEDURE [FIN].GetReceiveCommitments (@FinancialPeriodId INT = NULL,
@ReceiveCommitmentId INT = NULL)
--WITH ENCRYPTION
AS
BEGIN
        DECLARE @UserID INT
               ,@Initial NVARCHAR(100)
               ,@Submit NVARCHAR(100)
               ,@PreVoucher NVARCHAR(100)
               ,@Voucher NVARCHAR(100)
               ,@Culture VARCHAR(5)
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
                SET @DateFormat = 'YY/MM/DD'

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
        AND LV.Culture = @Culture

        DECLARE @BaseCurrencyPrecision INT
        SET @BaseCurrencyPrecision = CFG.GetBaseCurrencyPrecision();

        SELECT
                * INTO #vwBranchAccess
        FROM cfg.vwBranchAccess AS vba

        SELECT
                i.ReceiveCommitmentID
               ,SUM(i.AmountInBaseCurrency) AmountInBaseCurrency INTO #items
        FROM (SELECT
                        a.ReceiveCommitmentID
                       ,CASE
                                WHEN c.IsBaseCurrencyBasis = 0 THEN ROUND(a.Amount * a.CurrencyRate / c.ExchangeUnit, @BaseCurrencyPrecision)
                                WHEN c.IsBaseCurrencyBasis = 1 THEN ROUND(a.Amount * c.ExchangeUnit / a.CurrencyRate, @BaseCurrencyPrecision)
                        END AS AmountInBaseCurrency
                FROM (SELECT
                                ReceiveCommitmentID
                               ,CurrencyID
                               ,CurrencyRate
                               ,Amount
                        FROM FIN.ReceiveCheqeCommitment
                        UNION ALL
                        SELECT
                                ReceiveCommitmentID
                               ,CurrencyID
                               ,CurrencyRate
                               ,Amount
                        FROM FIN.ReceivePromissoryCommitment
                        UNION ALL
                        SELECT
                                ReceiveCommitmentID
                               ,CurrencyID
                               ,CurrencyRate
                               ,Amount
                        FROM FIN.ReceiveGuarantyCommitment) a
                JOIN CFG.Currency c
                        ON a.CurrencyID = c.CurrencyID) i
        GROUP BY i.ReceiveCommitmentID


        SELECT
                r.ReceiveCommitmentID
               ,r.BaseType
               ,r.FinancialPeriodID
               ,r.BranchID
               ,b.Code BranchCode
               ,CASE @CultureNo
                        WHEN 1 THEN b.Title
                        WHEN 2 THEN b.Title2
                END AS BranchName
               ,r.Number
               ,r.Date
               ,r.PartyID
               ,d.Code PartyCode
               ,CASE @CultureNo
                        WHEN 1 THEN d.Title
                        WHEN 2 THEN d.Title2
                END AS PartyName
               ,r.Description
               ,r.Description2
               ,r.PreVoucherID
               ,r.Status
               ,r.CashID
               ,dl.Code CashCode
               ,CASE @CultureNo
                        WHEN 1 THEN c.Title
                        WHEN 2 THEN c.Title2
                END AS CashName
               ,r.ContractID
               ,ct.Number ContractNumber
               ,ct.Title ContractTitle
               ,r.TenderParticipateID
               ,CASE @CultureNo
                        WHEN 1 THEN dtp.Title
                        WHEN 2 THEN dtp.Title2
                END AS ReceiveCommitmentPartyTitle
               ,tp.SecretariatNumber AS ReceiveCommitmentSecretariatNumber
               ,r.TenderID
               ,CASE @CultureNo
                        WHEN 1 THEN t.Title
                        WHEN 2 THEN t.Title2
                END AS TenderTitle
               ,r.PurchaseContractID
               ,pc.Number AS PurchaseContractNumber
               ,CASE @CultureNo
                        WHEN 1 THEN dpc.Title
                        WHEN 2 THEN dpc.Title2
                END AS PurchaseContractVendorTitle
               ,r.ReceiveRequestID
               ,rr.Number RequestNumber
               ,r.Version
               ,r.Creator
               ,r.CreationDate
               ,r.LastEditor
               ,r.LastEditionDate
               ,CFG.GetCLRSaturnDate(r.[Date], @DateFormat, 0, @DateType) PersianDate
               ,CFG.GetCLRSaturnDate(r.CreationDate, @DateFormat, 1, @DateType) CreateDateString
               ,CFG.GetCLRSaturnDate(r.LastEditionDate, @DateFormat, 1, @DateType) EditionDateString
               ,u.[Name] CreatorUserName
               ,u2.[Name] EditorName
               ,vp.VoucherID
               ,v.ReferenceNumber VoucherNumber
               ,CFG.GetCLRSaturnDate(v.Date, @DateFormat, 0, @DateType) VoucherDate
               ,CAST(CASE
                        WHEN r.[Status] = 1 THEN @Initial
                        WHEN vp.VoucherID IS NOT NULL THEN @Voucher
                        WHEN r.PreVoucherID IS NOT NULL THEN @PreVoucher
                        ELSE @Submit
                END AS NVARCHAR(512)) AS StatusString
               ,i.AmountInBaseCurrency

        FROM FIN.ReceiveCommitment r
        JOIN CFG.Branch b
                ON r.BranchID = b.BranchID
        JOIN CFG.Party p
                ON r.PartyID = p.PartyID
        LEFT JOIN ACC.dl d
                ON p.DlID = d.DLID
        JOIN CFG.Cash c
                ON r.CashID = c.CashID
        JOIN ACC.dl dl
                ON c.DlID = dl.DLID
        LEFT JOIN CNT.Contract ct
                ON r.ContractID = ct.ContractID
        LEFT JOIN vnd.TenderParticipate tp
                ON r.TenderParticipateID = tp.TenderParticipateID
        LEFT JOIN CFG.Party ptp
                ON tp.PartyID = ptp.PartyID
        LEFT JOIN acc.DL dtp
                ON dtp.DlID = ptp.DlID
        LEFT JOIN VND.PurchaseContract pc
                ON r.PurchaseContractID = pc.PurchaseContractID
        LEFT JOIN ACC.dl dpc
                ON pc.DlID = dpc.DLID
        LEFT JOIN ACC.dl dl2
                ON ct.DLID = dl2.DLID
        LEFT JOIN VND.Tender t
                ON r.TenderID = t.TenderID
        LEFT JOIN REQ.ReceiveRequest rr
                ON r.ReceiveRequestID = rr.ReceiveRequestID
        JOIN CFG.[user] u
                ON u.UserID = r.Creator
        JOIN CFG.[user] u2
                ON u2.UserID = r.LastEditor
        LEFT JOIN (SELECT
                        PrevoucherID
                       ,VoucherID
                FROM ACC.VoucherPrevoucher
                GROUP BY PrevoucherID
                        ,VoucherID) vp
                ON r.PreVoucherID = vp.PrevoucherID
        LEFT JOIN ACC.Voucher v
                ON vp.VoucherID = v.VoucherID
        JOIN #items i
                ON r.ReceiveCommitmentID = i.ReceiveCommitmentID
        INNER JOIN #vwBranchAccess AS vba
                ON vba.BranchID = r.BranchID
        WHERE ((@FinancialPeriodId IS NOT NULL
        AND r.FinancialPeriodID = @FinancialPeriodId)
        OR (@ReceiveCommitmentId IS NOT NULL
        AND r.ReceiveCommitmentID = @ReceiveCommitmentId))
END;
