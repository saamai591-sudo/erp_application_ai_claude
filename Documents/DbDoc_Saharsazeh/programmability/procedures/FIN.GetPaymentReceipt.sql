
CREATE   PROCEDURE [FIN].[GetPaymentReceipt]
(@Id INT)
--WITH ENCRYPTION
AS
DECLARE @UserID INT,
        @Initial NVARCHAR(100),
        @Submit NVARCHAR(100),
        @PreVoucher NVARCHAR(100),
        @Voucher NVARCHAR(100),
        @Culture VARCHAR(25),
        @CultureNo TINYINT;

SET @UserID = cfg.GetuserID();
SET @Culture = cfg.GetuserCulture();

SELECT @CultureNo = CultureNo
FROM CFG.CultureInfo
WHERE Culture = @Culture;

SELECT @Submit = LV.Value
FROM cfg.LocalizeEnum L
    JOIN cfg.LocalizeEnumValue LV
        ON L.LocalizeEnumID = LV.LocalizeEnumID
WHERE L.Enum = 'Statuses'
      AND L.Item = 'Submit'
      AND LV.Culture = @Culture;

SELECT @Voucher = LV.Value
FROM cfg.LocalizeEnum L
    JOIN cfg.LocalizeEnumValue LV
        ON L.LocalizeEnumID = LV.LocalizeEnumID
WHERE L.Enum = 'PreVoucherStatuses'
      AND L.Item = 'Voucher'
      AND LV.Culture = @Culture;

SELECT @PreVoucher = LV.Value
FROM cfg.LocalizeEnum L
    JOIN cfg.LocalizeEnumValue LV
        ON L.LocalizeEnumID = LV.LocalizeEnumID
WHERE L.Enum = 'PreVoucherStatuses'
      AND L.Item = 'PreVoucher'
      AND LV.Culture = @Culture;

SELECT @Initial = LV.Value
FROM cfg.LocalizeEnum L
    JOIN cfg.LocalizeEnumValue LV
        ON L.LocalizeEnumID = LV.LocalizeEnumID
WHERE L.Enum = 'StatusOfReceipt'
      AND L.Item = 'Initial'
      AND LV.Culture = @Culture;

SELECT * INTO #vwBranchAccess
FROM cfg.vwBranchAccess AS vba

DECLARE @BaseCurrencyPrecision INT;
SET @BaseCurrencyPrecision = CFG.GetBaseCurrencyPrecision();

SELECT i.PaymentReceiptID,
       SUM(i.PaymentAmountInBaseCurrency) PaymentAmountInBaseCurrency
INTO #items
FROM
(
    SELECT a.PaymentReceiptID,
           CASE
               WHEN c.IsBaseCurrencyBasis = 0 THEN
                   ROUND(a.Amount * a.CurrencyRate / c.ExchangeUnit, @BaseCurrencyPrecision)
               WHEN c.IsBaseCurrencyBasis = 1 THEN
                   ROUND(a.Amount * c.ExchangeUnit / a.CurrencyRate, @BaseCurrencyPrecision)
           END AS PaymentAmountInBaseCurrency
    FROM
    (
        SELECT PaymentReceiptID,
               CurrencyID,
               CurrencyRate,
               Amount
        FROM FIN.PaymentBankDraft
        UNION ALL
        SELECT PaymentReceiptID,
               CurrencyID,
               CurrencyRate,
               Amount
        FROM FIN.PaymentCheqe
        UNION ALL
        SELECT PaymentReceiptID,
               c.CurrencyID,
               c.CurrencyRate,
               c.Amount
        FROM FIN.PaymentOtherCheqe o
            JOIN FIN.ReceivedCheqe c
                ON o.ReceivedCheqeID = c.ReceivedCheqeID
        UNION ALL
        SELECT PaymentReceiptID,
               CurrencyID,
               CurrencyRate,
               Amount
        FROM FIN.PaymentCash
    ) a
        JOIN CFG.Currency c
            ON a.CurrencyID = c.CurrencyID
) i
GROUP BY i.PaymentReceiptID;


SELECT p.PartyID,
       d.Code PartyCode,
       CAST(CASE
                WHEN p.[Type] = 1
                     OR p.[Type] = 2 THEN
                    p.Title
                WHEN p.[Type] = 0 THEN
                    p.Title + ' ' + p.LastName
            END AS NVARCHAR(512)) AS PartyName,
       CAST(CASE
                WHEN p.[Type] = 1
                     OR p.[Type] = 2 THEN
                    p.Title2
                WHEN p.[Type] = 0 THEN
                    p.Title2 + ' ' + p.LastName2
            END AS NVARCHAR(512)) AS PartyName2
INTO #Parties
FROM CFG.Party p
    LEFT JOIN ACC.DL d
        ON p.DlID = d.DLID;


SELECT p.PaymentReceiptID,
       p.FinancialPeriodID,
       p.BranchID,
       p.Number,
       p.Date,
       p.PartyID,
       pa.PartyCode,
       CASE @CultureNo
           WHEN 1 THEN
               pa.PartyName
           WHEN 2 THEN
               pa.PartyName2
       END AS PartyName,
       p.Description,
       p.Description2,
       p.PreVoucherID,
       p.Status,
       p.PaymentRequestID,
       p.PaymentOrderID,
       pr.Number RequestNumber,
       p.Version,
       p.Creator,
       p.CreationDate,
       v.VoucherID,
       CAST( CASE
            WHEN EXISTS (SELECT 1 FROM FIN.PaymentCheqe AS pc WHERE pc.PaymentReceiptID = @Id) THEN 1
            WHEN EXISTS (SELECT 1 FROM FIN.PaymentBankDraft AS pbd WHERE pbd.PaymentReceiptID = @Id) THEN 2
            ELSE 0
       END AS TINYINT) AS [Type],
       CAST(CASE
                WHEN p.[Status] = 1 THEN
                    @Initial
                WHEN v.VoucherID IS NOT NULL THEN
                    @Voucher
                WHEN p.PreVoucherID IS NOT NULL THEN
                    @PreVoucher
                ELSE
                    @Submit
            END AS NVARCHAR(512)) AS StatusString,
       i.PaymentAmountInBaseCurrency,
       po.Number as PaymentOrderNumber,
       PS.ConfirmPurchaseInvoiceID
FROM FIN.PaymentReceipt p
JOIN FIN.PaymentSubject PS ON P.PaymentReceiptID = PS.PaymentReceiptID
    JOIN #Parties pa
        ON p.PartyID = pa.PartyID
    LEFT JOIN REQ.PaymentRequest pr
        ON p.PaymentRequestID = pr.PaymentRequestID
    LEFT JOIN
    (
        SELECT PrevoucherID,
               VoucherID
        FROM ACC.VoucherPrevoucher
        GROUP BY PrevoucherID,
                 VoucherID
    ) vp
        ON vp.PrevoucherID = p.PreVoucherID
    LEFT JOIN ACC.Voucher v
        ON v.VoucherID = vp.VoucherID
    JOIN #items i
        ON p.PaymentReceiptID = i.PaymentReceiptID
    INNER JOIN #vwBranchAccess AS vba
        ON vba.BranchID = p.BranchID
    LEFT JOIN REQ.PaymentOrder as po on po.PaymentOrderID=p.PaymentOrderID
WHERE p.PaymentReceiptID = @Id;

----------------[FIN].[GetPaymentReceipt]--------------------
