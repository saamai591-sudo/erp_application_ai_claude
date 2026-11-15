
------------------------------------- START #8006
CREATE   PROCEDURE FIN.GetReceiveReceipt
    (
        @Id INT
    )
--WITH ENCRYPTION
AS
    DECLARE @UserID INT ,
            @Initial NVARCHAR(100) ,
            @Submit NVARCHAR(100) ,
            @PreVoucher NVARCHAR(100) ,
            @Voucher NVARCHAR(100) ,
            @Culture VARCHAR(25),
			@CultureNo tinyint;

    SET @UserID = CFG.GetuserID();
    SET @Culture = CFG.GetuserCulture();

	select @CultureNo = CultureNo
	from CFG.CultureInfo 
	where Culture = @Culture

    SELECT @Submit = LV.Value
    FROM   CFG.LocalizeEnum L
           JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE  L.Enum = 'Statuses'
           AND L.Item = 'Submit'
           AND LV.Culture = @Culture;

    SELECT @Voucher = LV.Value
    FROM   CFG.LocalizeEnum L
           JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE  L.Enum = 'PreVoucherStatuses'
           AND L.Item = 'Voucher'
           AND LV.Culture = @Culture;

    SELECT @PreVoucher = LV.Value
    FROM   CFG.LocalizeEnum L
           JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE  L.Enum = 'PreVoucherStatuses'
           AND L.Item = 'PreVoucher'
           AND LV.Culture = @Culture;

    SELECT @Initial = LV.Value
    FROM   CFG.LocalizeEnum L
           JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE  L.Enum = 'StatusOfReceipt'
           AND L.Item = 'Initial'
           AND LV.Culture = @Culture;

    DECLARE @BaseCurrencyPrecision INT;
    SET @BaseCurrencyPrecision = CFG.GetBaseCurrencyPrecision();

    SELECT   i.ReceiveReceiptID ,
             SUM(i.ReceiptAmountInBaseCurrency) ReceiptAmountInBaseCurrency
    INTO     #items
    FROM     (   SELECT a.ReceiveReceiptID ,
                        CASE WHEN c.IsBaseCurrencyBasis = 0 THEN
                                 ROUND(
                                     a.Amount * a.CurrencyRate / c.ExchangeUnit ,
                                     @BaseCurrencyPrecision)
                             WHEN c.IsBaseCurrencyBasis = 1 THEN
                                 ROUND(
                                     a.Amount * c.ExchangeUnit / a.CurrencyRate ,
                                     @BaseCurrencyPrecision)
                        END AS ReceiptAmountInBaseCurrency
                 FROM   (   SELECT ReceiveReceiptID ,
                                   CurrencyID ,
                                   CurrencyRate ,
                                   Amount
                            FROM   FIN.ReceivedBankDraft
                            UNION ALL
                            SELECT ReceiveReceiptID ,
                                   CurrencyID ,
                                   CurrencyRate ,
                                   Amount
                            FROM   FIN.ReceivedCheqe
                            UNION ALL
                            SELECT ReceiveReceiptID ,
                                   CurrencyID ,
                                   CurrencyRate ,
                                   Amount
                            FROM   FIN.ReceivedCash ) a
                        JOIN CFG.Currency c ON a.CurrencyID = c.CurrencyID ) i
    GROUP BY i.ReceiveReceiptID;
	
	select p.PartyID,
	       p.DlID,
		   p.IsCustomer,
		   p.IsVendor,
	       d.Code PartyCode,
           CAST(CASE WHEN p.[Type] = 1
                          OR p.[Type] = 2 THEN p.Title
                     WHEN p.[Type] = 0 THEN p.Title + ' ' + p.LastName
                END AS NVARCHAR(512)) AS PartyName ,
			CAST(CASE WHEN p.[Type] = 1
                        OR p.[Type] = 2 THEN p.Title2
                    WHEN p.[Type] = 0 THEN p.Title2 + ' ' + p.LastName2
            END AS NVARCHAR(512)) AS PartyName2
	into #Parties
	from CFG.Party p
	left join ACC.DL d on p.DlID = d.DLID;
	
SELECT * INTO #vwBranchAccess
FROM cfg.vwBranchAccess AS vba

SELECT r.ReceiveReceiptID ,
        r.FinancialPeriodID ,
        r.BranchID ,
        r.Number ,
        r.Date ,
        r.PartyID ,
		p.DlID as PayerDlID,
		p.IsCustomer as PartyIsCustomer,
		p.IsVendor as PartyIsVendor,
        p.PartyCode ,
		case @CultureNo
			when 1 then p.PartyName
			when 2 then p.PartyName2
		end as PartyName,
        r.Description ,
        r.Description2 ,
        r.PreVoucherID ,
        r.Status ,
        r.DeliverChequeID,
        r.Version ,
        r.Creator ,
        r.CreationDate ,
        CAST(CASE WHEN su.CardReaderSettlementID IS NOT NULL THEN 1
                    ELSE 0
            END AS BIT) IssuedFromCardReaderSettlement ,
        v.VoucherID ,
        CAST(CASE WHEN r.[Status] = 1 THEN @Initial
                    WHEN v.VoucherID IS NOT NULL THEN @Voucher
                    WHEN r.PreVoucherID IS NOT NULL THEN @PreVoucher
                    ELSE @Submit
            END AS NVARCHAR(512)) AS StatusString ,
        i.ReceiptAmountInBaseCurrency
FROM   FIN.ReceiveReceipt r
        JOIN (   SELECT TOP 1 rs.ReceiveReceiptID ,
                        rs.CardReaderSettlementID
                FROM   FIN.ReceiveSubject AS rs WHERE rs.ReceiveReceiptID =  @Id) AS su ON su.ReceiveReceiptID = r.ReceiveReceiptID
        JOIN #Parties p ON r.PartyID = p.PartyID
        LEFT JOIN (   SELECT   PrevoucherID ,
                                VoucherID
                        FROM     ACC.VoucherPrevoucher
                        GROUP BY PrevoucherID ,
                                VoucherID ) vp ON r.PreVoucherID = vp.PrevoucherID
        LEFT JOIN ACC.Voucher v ON vp.VoucherID = v.VoucherID
        JOIN #items i ON r.ReceiveReceiptID = i.ReceiveReceiptID
        INNER JOIN #vwBranchAccess AS vba ON vba.BranchID = r.BranchID
WHERE  r.ReceiveReceiptID = @Id;
