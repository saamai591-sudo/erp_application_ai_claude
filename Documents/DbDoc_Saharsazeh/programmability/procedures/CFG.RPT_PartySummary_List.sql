
CREATE   PROC [CFG].RPT_PartySummary_List
(
    @FromDate DATE,
    @ToDate DATE,
    @PartyID BIGINT,
    @EntityName NVARCHAR(100)
)
--WITH ENCRYPTION 
AS
DECLARE @UserID INT,
        @DateType TINYINT,
        @DateFormat VARCHAR(10),
        @Submit NVARCHAR(100),
        @Voucher NVARCHAR(100),
        @PreVoucher NVARCHAR(100),
        @Culture VARCHAR(25),
        @Gift NVARCHAR(100),
        @Sale NVARCHAR(100),
        @Confirmed NVARCHAR(100),
        @Revoke NVARCHAR(100),
        @Initial NVARCHAR(100),
        @Establish NVARCHAR(150),
        @Register NVARCHAR(150),
        @Employer NVARCHAR(250),
        @Contractor NVARCHAR(250),
        @PurchaseRequest NVARCHAR(100),
        @Proposal NVARCHAR(100),
        @NoBase NVARCHAR(100),
        @Confirm NVARCHAR(100),
        @Modify NVARCHAR(100),
        @WithOutbase NVARCHAR(100),
        @Justification NVARCHAR(100),
        @Quotation NVARCHAR(100),
        @Remittance NVARCHAR(100),
        @Order NVARCHAR(100),
        @Invoice NVARCHAR(100),
        @Outgoing NVARCHAR(100),
        @ReturnedSaleInvoice NVARCHAR(100),
        @ReturnedSaleJustification NVARCHAR(100),
        @Internal NVARCHAR(100),
        @Importable NVARCHAR(100),
        @Ended NVARCHAR(100),
        @JustificationInput NVARCHAR(100),
        @PurchaseInvoice NVARCHAR(100),
        @PurchaseContract NVARCHAR(100),
        @Contract NVARCHAR(100),
        @ContractStatement NVARCHAR(100),
        @StockReceipt NVARCHAR(100),
        @TemporaryOutgoing NVARCHAR(100),
        @Reception NVARCHAR(100),
        @StuffRequest NVARCHAR(100),
        @TempReceipt NVARCHAR(100),
        @ReturnRequest NVARCHAR(100),
        @Debit NVARCHAR(100),
        @Credit NVARCHAR(100),
        @Normal NVARCHAR(100),
        @Guaranteed NVARCHAR(100),
        @Rejected NVARCHAR(100),
        @BaseCurrencyPrecision INT,
        @DlID BIGINT = NULL,
        @CultureNo TINYINT;

SET @UserID = CFG.GetuserID();
SET @Culture = CFG.GetuserCulture();
SET @BaseCurrencyPrecision = CFG.GetBaseCurrencyPrecision();

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


SELECT @Submit = LV.Value
FROM CFG.LocalizeEnum L
    JOIN CFG.LocalizeEnumValue LV
        ON L.LocalizeEnumID = LV.LocalizeEnumID
WHERE L.Enum = 'Statuses'
      AND L.Item = 'Submit'
      AND LV.Culture = @Culture;

SELECT @Voucher = LV.Value
FROM CFG.LocalizeEnum L
    JOIN CFG.LocalizeEnumValue LV
        ON L.LocalizeEnumID = LV.LocalizeEnumID
WHERE L.Enum = 'PreVoucherStatuses'
      AND L.Item = 'Voucher'
      AND LV.Culture = @Culture;

SELECT @PreVoucher = LV.Value
FROM CFG.LocalizeEnum L
    JOIN CFG.LocalizeEnumValue LV
        ON L.LocalizeEnumID = LV.LocalizeEnumID
WHERE L.Enum = 'PreVoucherStatuses'
      AND L.Item = 'PreVoucher'
      AND LV.Culture = @Culture;

SELECT @Gift = LV.Value
FROM CFG.LocalizeEnum L
    JOIN CFG.LocalizeEnumValue LV
        ON L.LocalizeEnumID = LV.LocalizeEnumID
WHERE L.Enum = 'AssetSaleTypes'
      AND L.Item = 'Gift'
      AND LV.Culture = @Culture;

SELECT @Sale = LV.Value
FROM CFG.LocalizeEnum L
    JOIN CFG.LocalizeEnumValue LV
        ON L.LocalizeEnumID = LV.LocalizeEnumID
WHERE L.Enum = 'AssetSaleTypes'
      AND L.Item = 'Sale'
      AND LV.Culture = @Culture;

SELECT @Confirmed = LV.Value
FROM CFG.LocalizeEnum L
    JOIN CFG.LocalizeEnumValue LV
        ON L.LocalizeEnumID = LV.LocalizeEnumID
WHERE L.Enum = 'Statuses'
      AND L.Item = 'Confirmed'
      AND LV.Culture = @Culture;

SELECT @Revoke = LV.Value
FROM CFG.LocalizeEnum L
    JOIN CFG.LocalizeEnumValue LV
        ON L.LocalizeEnumID = LV.LocalizeEnumID
WHERE L.Enum = 'Statuses'
      AND L.Item = 'Revoke'
      AND LV.Culture = @Culture;

SELECT @Initial = LV.Value
FROM CFG.LocalizeEnum L
    JOIN CFG.LocalizeEnumValue LV
        ON L.LocalizeEnumID = LV.LocalizeEnumID
WHERE L.Enum = 'StatusOfReceipt'
      AND L.Item = 'Initial'
      AND LV.Culture = @Culture;

SELECT @Establish = LV.Value
FROM CFG.LocalizeEnum L
    JOIN CFG.LocalizeEnumValue LV
        ON L.LocalizeEnumID = LV.LocalizeEnumID
WHERE L.Enum = 'StatusOfReceipt'
      AND L.Item = 'Initial'
      AND LV.Culture = @Culture;

SELECT @Register = LV.Value
FROM CFG.LocalizeEnum L
    JOIN CFG.LocalizeEnumValue LV
        ON L.LocalizeEnumID = LV.LocalizeEnumID
WHERE L.Enum = 'StatusOfReceipt'
      AND L.Item = 'Submited'
      AND LV.Culture = @Culture;

SELECT @Employer = LV.Value
FROM CFG.LocalizeEnum L
    JOIN CFG.LocalizeEnumValue LV
        ON L.LocalizeEnumID = LV.LocalizeEnumID
WHERE L.Enum = 'CompanyRolls'
      AND L.Item = 'Employer'
      AND LV.Culture = @Culture;

SELECT @Contractor = LV.Value
FROM CFG.LocalizeEnum L
    JOIN CFG.LocalizeEnumValue LV
        ON L.LocalizeEnumID = LV.LocalizeEnumID
WHERE L.Enum = 'CompanyRolls'
      AND L.Item = 'Contractor'
      AND LV.Culture = @Culture;

SELECT @PurchaseRequest = LV.Value
FROM CFG.LocalizeEnum L
    JOIN CFG.LocalizeEnumValue LV
        ON L.LocalizeEnumID = LV.LocalizeEnumID
WHERE L.Enum = 'ProformaInvoiceBases'
      AND L.Item = 'PurchaseRequest'
      AND LV.Culture = @Culture;

SELECT @Proposal = LV.Value
FROM CFG.LocalizeEnum L
    JOIN CFG.LocalizeEnumValue LV
        ON L.LocalizeEnumID = LV.LocalizeEnumID
WHERE L.Enum = 'ProformaInvoiceBases'
      AND L.Item = 'Proposal'
      AND LV.Culture = @Culture;

SELECT @NoBase = LV.Value
FROM CFG.LocalizeEnum L
    JOIN CFG.LocalizeEnumValue LV
        ON L.LocalizeEnumID = LV.LocalizeEnumID
WHERE L.Enum = 'ProformaInvoiceBases'
      AND L.Item = 'NoBase'
      AND LV.Culture = @Culture;

SELECT @Confirm = LV.Value
FROM CFG.LocalizeEnum L
    JOIN CFG.LocalizeEnumValue LV
        ON L.LocalizeEnumID = LV.LocalizeEnumID
WHERE L.Enum = 'ProformaInvoiceStatuses'
      AND L.Item = 'Confirm'
      AND LV.Culture = @Culture;

SELECT @Modify = LV.Value
FROM CFG.LocalizeEnum L
    JOIN CFG.LocalizeEnumValue LV
        ON L.LocalizeEnumID = LV.LocalizeEnumID
WHERE L.Enum = 'ProformaInvoiceStatuses'
      AND L.Item = 'Modify'
      AND LV.Culture = @Culture;

SELECT @WithOutbase = LV.Value
FROM CFG.LocalizeEnum L
    JOIN CFG.LocalizeEnumValue LV
        ON L.LocalizeEnumID = LV.LocalizeEnumID
WHERE L.Enum = 'SaleDocumentBases'
      AND L.Item = 'WithOutbase'
      AND LV.Culture = CFG.GetuserCulture();

SELECT @Justification = LV.Value
FROM CFG.LocalizeEnum L
    JOIN CFG.LocalizeEnumValue LV
        ON L.LocalizeEnumID = LV.LocalizeEnumID
WHERE L.Enum = 'SaleDocumentBases'
      AND L.Item = 'Justification'
      AND LV.Culture = CFG.GetuserCulture();

SELECT @Quotation = LV.Value
FROM CFG.LocalizeEnum L
    JOIN CFG.LocalizeEnumValue LV
        ON L.LocalizeEnumID = LV.LocalizeEnumID
WHERE L.Enum = 'SaleDocumentBases'
      AND L.Item = 'Quotation'
      AND LV.Culture = CFG.GetuserCulture();

SELECT @Remittance = LV.Value
FROM CFG.LocalizeEnum L
    JOIN CFG.LocalizeEnumValue LV
        ON L.LocalizeEnumID = LV.LocalizeEnumID
WHERE L.Enum = 'SaleDocumentBases'
      AND L.Item = 'Remittance'
      AND LV.Culture = CFG.GetuserCulture();

SELECT @Order = LV.Value
FROM CFG.LocalizeEnum L
    JOIN CFG.LocalizeEnumValue LV
        ON L.LocalizeEnumID = LV.LocalizeEnumID
WHERE L.Enum = 'SaleDocumentBases'
      AND L.Item = 'Order'
      AND LV.Culture = CFG.GetuserCulture();

SELECT @Invoice = LV.Value
FROM CFG.LocalizeEnum L
    JOIN CFG.LocalizeEnumValue LV
        ON L.LocalizeEnumID = LV.LocalizeEnumID
WHERE L.Enum = 'SaleDocumentBases'
      AND L.Item = 'Invoice'
      AND LV.Culture = CFG.GetuserCulture();

SELECT @Outgoing = LV.Value
FROM CFG.LocalizeEnum L
    JOIN CFG.LocalizeEnumValue LV
        ON L.LocalizeEnumID = LV.LocalizeEnumID
WHERE L.Enum = 'SaleDocumentBases'
      AND L.Item = 'Outgoing'
      AND LV.Culture = CFG.GetuserCulture();

SELECT @ReturnedSaleInvoice = LV.Value
FROM CFG.LocalizeEnum L
    JOIN CFG.LocalizeEnumValue LV
        ON L.LocalizeEnumID = LV.LocalizeEnumID
WHERE L.Enum = 'SaleDocumentBases'
      AND L.Item = 'ReturnedSaleInvoice'
      AND LV.Culture = CFG.GetuserCulture();

SELECT @ReturnedSaleJustification = LV.Value
FROM CFG.LocalizeEnum L
    JOIN CFG.LocalizeEnumValue LV
        ON L.LocalizeEnumID = LV.LocalizeEnumID
WHERE L.Enum = 'SaleDocumentBases'
      AND L.Item = 'ReturnedSaleJustification'
      AND LV.Culture = CFG.GetuserCulture();

SELECT @Internal = LV.Value
FROM CFG.LocalizeEnum L
    JOIN CFG.LocalizeEnumValue LV
        ON L.LocalizeEnumID = LV.LocalizeEnumID
WHERE L.Enum = 'TradeType'
      AND L.Item = 'Internal'
      AND LV.Culture = @Culture;

SELECT @Importable = LV.Value
FROM CFG.LocalizeEnum L
    JOIN CFG.LocalizeEnumValue LV
        ON L.LocalizeEnumID = LV.LocalizeEnumID
WHERE L.Enum = 'TradeType'
      AND L.Item = 'Import'
      AND LV.Culture = @Culture;

SELECT @Ended = Value
FROM CFG.LocalizeEnum l
    JOIN CFG.LocalizeEnumValue v
        ON l.LocalizeEnumID = v.LocalizeEnumID
WHERE Enum = 'RequestStates'
      AND Item = 'Ended'
      AND Culture = CFG.GetuserCulture();

SELECT @JustificationInput = LV.Value
FROM CFG.LocalizeEnum L
    JOIN CFG.LocalizeEnumValue LV
        ON L.LocalizeEnumID = LV.LocalizeEnumID
WHERE L.Enum = 'TemporaryStockReceiptBaseType'
      AND L.Item = 'JustificationInput'
      AND LV.Culture = CFG.GetuserCulture();

SELECT @PurchaseInvoice = LV.Value
FROM CFG.LocalizeEnum L
    JOIN CFG.LocalizeEnumValue LV
        ON L.LocalizeEnumID = LV.LocalizeEnumID
WHERE L.Enum = 'TemporaryStockReceiptBaseType'
      AND L.Item = 'PurchaseInvoice'
      AND LV.Culture = CFG.GetuserCulture();

SELECT @PurchaseContract = LV.Value
FROM CFG.LocalizeEnum L
    JOIN CFG.LocalizeEnumValue LV
        ON L.LocalizeEnumID = LV.LocalizeEnumID
WHERE L.Enum = 'PurchaseDocumentBases'
      AND L.Item = 'PurchaseContract'
      AND LV.Culture = CFG.GetuserCulture();

SELECT @Contract = LV.Value
FROM CFG.LocalizeEnum L
    JOIN CFG.LocalizeEnumValue LV
        ON L.LocalizeEnumID = LV.LocalizeEnumID
WHERE L.Enum = 'PurchaseDocumentBases'
      AND L.Item = 'Contract'
      AND LV.Culture = @Culture;

SELECT @ContractStatement = LV.Value
FROM CFG.LocalizeEnum L
    JOIN CFG.LocalizeEnumValue LV
        ON L.LocalizeEnumID = LV.LocalizeEnumID
WHERE L.Enum = 'PurchaseDocumentBases'
      AND L.Item = 'ContractStatement'
      AND LV.Culture = @Culture;

SELECT @StockReceipt = LV.Value
FROM CFG.LocalizeEnum L
    JOIN CFG.LocalizeEnumValue LV
        ON L.LocalizeEnumID = LV.LocalizeEnumID
WHERE L.Enum = 'PurchaseDocumentBases'
      AND L.Item = 'StockReceipt'
      AND LV.Culture = @Culture;

SELECT @TemporaryOutgoing = LV.Value
FROM CFG.LocalizeEnum L
    JOIN CFG.LocalizeEnumValue LV
        ON L.LocalizeEnumID = LV.LocalizeEnumID
WHERE L.Enum = 'OutgoingBaseTypes'
      AND L.Item = 'TemporaryOutgoing'
      AND LV.Culture = CFG.GetuserCulture();

SELECT @Reception = LV.Value
FROM CFG.LocalizeEnum L
    JOIN CFG.LocalizeEnumValue LV
        ON L.LocalizeEnumID = LV.LocalizeEnumID
WHERE L.Enum = 'SaleDocumentBases'
      AND L.Item = 'Reception'
      AND LV.Culture = CFG.GetuserCulture();

SELECT @StuffRequest = LV.Value
FROM CFG.LocalizeEnum L
    JOIN CFG.LocalizeEnumValue LV
        ON L.LocalizeEnumID = LV.LocalizeEnumID
WHERE L.Enum = 'DocumentNumTypes'
      AND L.Item = 'StuffRequest'
      AND LV.Culture = CFG.GetuserCulture();

SELECT @TempReceipt = LV.Value
FROM CFG.LocalizeEnum L
    JOIN CFG.LocalizeEnumValue LV
        ON L.LocalizeEnumID = LV.LocalizeEnumID
WHERE L.Enum = 'TemporaryStockReceiptBaseType'
      AND L.Item = 'TemporaryReceipt'
      AND LV.Culture = CFG.GetuserCulture();

SELECT @ReturnRequest = LV.Value
FROM CFG.LocalizeEnum L
    JOIN CFG.LocalizeEnumValue LV
        ON L.LocalizeEnumID = LV.LocalizeEnumID
WHERE L.Enum = 'TemporaryStockReceiptBaseType'
      AND L.Item = 'ReturnRequest'
      AND LV.Culture = CFG.GetuserCulture();

SELECT @Debit = LV.Value
FROM CFG.LocalizeEnum L
    JOIN CFG.LocalizeEnumValue LV
        ON L.LocalizeEnumID = LV.LocalizeEnumID
WHERE L.Enum = 'NaturalityOfBalanceType'
      AND L.Item = 'debit'
      AND LV.Culture = @Culture;

SELECT @Credit = LV.Value
FROM CFG.LocalizeEnum L
    JOIN CFG.LocalizeEnumValue LV
        ON L.LocalizeEnumID = LV.LocalizeEnumID
WHERE L.Enum = 'NaturalityOfBalanceType'
      AND L.Item = 'credit'
      AND LV.Culture = @Culture;

SELECT @Normal = LV.Value
FROM CFG.LocalizeEnum L
    JOIN CFG.LocalizeEnumValue LV
        ON L.LocalizeEnumID = LV.LocalizeEnumID
WHERE L.Enum = 'PaymentRequestTypes'
      AND L.Item = 'Normal'
      AND LV.Culture = @Culture;

SELECT @Guaranteed = LV.Value
FROM CFG.LocalizeEnum L
    JOIN CFG.LocalizeEnumValue LV
        ON L.LocalizeEnumID = LV.LocalizeEnumID
WHERE L.Enum = 'PaymentRequestTypes'
      AND L.Item = 'Guaranteed'
      AND LV.Culture = @Culture;

SELECT @Rejected = LV.Value
FROM CFG.LocalizeEnum L
    JOIN CFG.LocalizeEnumValue LV
        ON L.LocalizeEnumID = LV.LocalizeEnumID
WHERE L.Enum = 'RequestStates'
      AND L.Item = 'Rejected'
      AND LV.Culture = @Culture;


SELECT @DlID = DlID
FROM CFG.Party
WHERE PartyID = @PartyID;

IF (@EntityName = 'AssetInsurance')
BEGIN
    SELECT i.InsuranceID ID,
           i.Number,
           i.[Date],
           i.InsuranceID EntityID,
           'Insurance' EngName,
           'AssetManager' ModuleKey,
           CASE
               WHEN @CultureNo = 1 THEN
                   t.Title
               WHEN @CultureNo = 2 THEN
                   t.Title2
           END AS InsuranceTypeTitle,
           i.FromDate,
           CFG.GetCLRSaturnDate(i.FromDate, @DateFormat, 0, @DateType) Date_FromDate,
           i.EndDate,
           CFG.GetCLRSaturnDate(i.EndDate, @DateFormat, 0, @DateType) Date_EndDate,
           i.Price Amount,
           b.Code AS BranchCode,
           CASE
               WHEN @CultureNo = 1 THEN
                   b.Title
               WHEN @CultureNo = 2 THEN
                   b.Title2
           END AS BranchName,
           CFG.GetCLRSaturnDate(i.[Date], @DateFormat, 0, @DateType) AS Date_Date,
           v.ReferenceNumber AS VoucherNumber,
           v.[Date] AS VoucherDate,
           CFG.GetCLRSaturnDate(v.Date, @DateFormat, 0, @DateType) AS Date_VoucherDate,
           CAST(CASE
                    WHEN vp.VoucherID IS NOT NULL THEN
                        @Voucher
                    WHEN i.PrevoucherID IS NOT NULL THEN
                        @PreVoucher
                    ELSE
                        @Submit
                END AS NVARCHAR(512)) AS StatusString
    FROM AST.Insurance i
        JOIN CFG.Branch b
            ON b.BranchID = i.BranchID
        JOIN AST.InsuranceType t
            ON i.InsuranceTypeID = t.InsuranceTypeID
        LEFT JOIN
        (
            SELECT PrevoucherID,
                   VoucherID
            FROM ACC.VoucherPrevoucher
            GROUP BY PrevoucherID,
                     VoucherID
        ) vp
            ON vp.PrevoucherID = i.PrevoucherID
        LEFT JOIN ACC.Voucher v
            ON v.VoucherID = vp.VoucherID
    WHERE i.PartyID = @PartyID
          AND i.Date
          BETWEEN @FromDate AND @ToDate;
END;


IF (@EntityName = 'SellAndDonate')
BEGIN
    SELECT s.SaleID ID,
           s.Number,
           s.[Date],
           s.SaleID EntityID,
           'Sale' EngName,
           'AssetManager' ModuleKey,
           s.[Type],
           CAST(CASE
                    WHEN s.[Type] = 1 THEN
                        @Sale
                    WHEN s.[Type] = 2 THEN
                        @Gift
                END AS NVARCHAR(512)) AS TypeString,
           b.Code AS BranchCode,
           CASE
               WHEN @CultureNo = 1 THEN
                   b.Title
               WHEN @CultureNo = 2 THEN
                   b.Title2
           END AS BranchName,
           CFG.GetCLRSaturnDate(s.[Date], @DateFormat, 0, @DateType) AS Date_Date,
           v.ReferenceNumber AS VoucherNumber,
           v.[Date] AS VoucherDate,
           CFG.GetCLRSaturnDate(v.Date, @DateFormat, 0, @DateType) AS Date_VoucherDate,
           CAST(CASE
                    WHEN vp.VoucherID IS NOT NULL THEN
                        @Voucher
                    WHEN s.PrevoucherID IS NOT NULL THEN
                        @PreVoucher
                    ELSE
                        @Submit
                END AS NVARCHAR(512)) AS StatusString
    FROM AST.Sale s
        JOIN CFG.Branch b
            ON b.BranchID = s.BranchID
        JOIN CFG.Party p
            ON s.PartyID = p.PartyID
        LEFT JOIN ACC.DL d
            ON p.DlID = d.DLID
        LEFT JOIN
        (
            SELECT PrevoucherID,
                   VoucherID
            FROM ACC.VoucherPrevoucher
            GROUP BY PrevoucherID,
                     VoucherID
        ) vp
            ON vp.PrevoucherID = s.PrevoucherID
        LEFT JOIN ACC.Voucher v
            ON v.VoucherID = vp.VoucherID
    WHERE s.PartyID = @PartyID
          AND s.Date
          BETWEEN @FromDate AND @ToDate;
END;


IF (@EntityName = 'DebitCreditNoteItem')
BEGIN

    SELECT i.DebitCreditNoteItemID ID,
           d.Number,
           d.Date,
           i.DebitCreditNoteID EntityID,
           'DebitCreditNote' EngName,
           'BaseDataProvider' ModuleKey,
           b.Code BranchCode,
           CASE
               WHEN @CultureNo = 1 THEN
                   b.Title
               WHEN @CultureNo = 2 THEN
                   b.Title2
           END AS BranchName,
           CASE
               WHEN @CultureNo = 1 THEN
                   c.Title
               WHEN @CultureNo = 2 THEN
                   c.Title2
           END AS CurrencyName,
           i.CurrencyRate,
           i.Amount,
           CASE
               WHEN i.Type = 0 THEN
                   @Debit
               WHEN i.Type = 1 THEN
                   @Credit
           END AS TypeString,
           CFG.GetCLRSaturnDate(d.Date, @DateFormat, 0, @DateType) Date_Date,
           v.ReferenceNumber AS VoucherNumber,
           v.[Date] AS VoucherDate,
           CFG.GetCLRSaturnDate(v.[Date], @DateFormat, 0, @DateType) AS Date_VoucherDate,
           CAST(CASE
                    WHEN vp.VoucherID IS NOT NULL THEN
                        @Voucher
                    WHEN d.PreVoucherID IS NOT NULL THEN
                        @PreVoucher
                    ELSE
                        @Submit
                END AS NVARCHAR(512)) AS StatusString
    FROM CFG.DebitCreditNoteItem i
        JOIN CFG.DebitCreditNote d
            ON i.DebitCreditNoteID = d.DebitCreditNoteID
        JOIN CFG.Currency c
            ON i.CurrencyID = c.CurrencyID
        JOIN CFG.Branch b
            ON d.BranchID = b.BranchID
        LEFT JOIN
        (
            SELECT PrevoucherID,
                   VoucherID
            FROM ACC.VoucherPrevoucher
            GROUP BY PrevoucherID,
                     VoucherID
        ) vp
            ON d.PreVoucherID = vp.PrevoucherID
        LEFT JOIN ACC.Voucher v
            ON vp.VoucherID = v.VoucherID
    WHERE i.PartyID = @PartyID
          AND d.Date
          BETWEEN @FromDate AND @ToDate;
END;


IF (@EntityName = 'PartPayment')
BEGIN
    SELECT i.InstallmentPaymentID ID,
           i.Number,
           i.Date,
           i.InstallmentPaymentID EntityID,
           'InstallmentPayment' EngName,
           'ReportGenerator' ModuleKey,
           CFG.GetCLRSaturnDate(i.[Date], @DateFormat, 0, @DateType) AS Date_Date,
           b.Code BranchCode,
           CASE
               WHEN @CultureNo = 1 THEN
                   b.Title
               WHEN @CultureNo = 2 THEN
                   b.Title2
           END AS BranchName
    FROM CFG.InstallmentPayment i
        JOIN CFG.Branch b
            ON i.BranchID = b.BranchID
    WHERE i.PartyID = @PartyID
          AND i.Date
          BETWEEN @FromDate AND @ToDate;
END;


IF (@EntityName = 'ManualReceipt')
BEGIN
    SELECT i.ManualReceiptID ID,
           Number,
           i.[Date],
           i.ManualReceiptID EntityID,
           'ManualReceipt' EngName,
           'ReportGenerator' ModuleKey,
           Amount,
           CASE
               WHEN @CultureNo = 1 THEN
                   c.Title
               WHEN @CultureNo = 2 THEN
                   c.Title2
           END AS CurrencyName,
           CFG.GetCLRSaturnDate(i.[Date], @DateFormat, 0, @DateType) AS Date_Date,
           b.Code BranchCode,
           CASE
               WHEN @CultureNo = 1 THEN
                   b.Title
               WHEN @CultureNo = 2 THEN
                   b.Title2
           END AS BranchTitle,
           CASE
               WHEN i.ManualReceiptType = 1 THEN
                   'دریافتی'
               ELSE
                   'پرداختی'
           END AS TypeString
    FROM CFG.ManualReceipt i
        JOIN CFG.Branch b
            ON i.BranchID = b.BranchID
        JOIN CFG.Currency c
            ON c.CurrencyID = i.CurrencyID
    WHERE i.PartyID = @PartyID
          AND i.Date
          BETWEEN @FromDate AND @ToDate;
END;


IF (@EntityName = 'ContractDefinition')
BEGIN
    SELECT c.ContractID ID,
           c.CompanyRoll,
           c.ContractID EntityID,
           'ContractDefinition' EngName,
           'Contract' ModuleKey,
           CAST(CASE
                    WHEN c.CompanyRoll = 1 THEN
                        @Employer
                    WHEN c.CompanyRoll = 2 THEN
                        @Contractor
                END AS NVARCHAR(512)) AS CompanyRollTitle,
           ct.Title ContractTypeTitle,
           ct.Title2 ContractTypeTitle2,
           c.Number,
           c.[Date],
           CFG.GetCLRSaturnDate(c.[Date], @DateFormat, 0, @DateType) Date_Date,
           c.Title,
           c.Title2,
           t.Title TenderTitle,
           t.Title2 TenderTitle2,
           b.Code BranchCode,
           CASE
               WHEN @CultureNo = 1 THEN
                   b.Title
               WHEN @CultureNo = 2 THEN
                   b.Title2
           END AS BranchName,
           null CurrencyName,
           c.StartDate,
           CFG.GetCLRSaturnDate(c.StartDate, @DateFormat, 0, @DateType) Date_StartDate,
           c.EndDate,
           CFG.GetCLRSaturnDate(c.EndDate, @DateFormat, 0, @DateType) Date_EndDate,
           (
               SELECT SUM(vcs.Price)
               FROM CNT.VWContractSubject AS vcs
               WHERE vcs.ContractID = c.ContractID
           ) Amount
    FROM CNT.[Contract] c
        INNER JOIN CNT.ContractType ct
            ON ct.ContractTypeID = c.ContractTypeID
        LEFT JOIN VND.Tender t
            ON t.TenderID = c.TenderID
        INNER JOIN CFG.Branch b
            ON b.BranchID = c.BranchID
        LEFT JOIN ACC.DL d
            ON d.DLID = c.DLID
    WHERE c.ParentID = @PartyID
          AND c.Date
          BETWEEN @FromDate AND @ToDate;
END;


IF (@EntityName = 'TenderParticipate')
BEGIN
    SELECT tp.TenderParticipateID ID,
           tp.SecretariatNumber Number,
           tp.SecretariatDate AS [Date],
           tp.TenderParticipateID EntityID,
           'TenderParticipate' EngName,
           'Contract' ModuleKey,
           CFG.GetCLRSaturnDate(tp.SecretariatDate, @DateFormat, 0, @DateType) AS Date_Date,
           t.Number TenderNumber,
           t.Title TenderTitle,
           t.Title2 TenderTitle2,
            N'مناقصه'  AS TypeString
    FROM VND.TenderParticipate tp
        INNER JOIN [VND].Tender t
            ON t.TenderID = tp.TenderID
    WHERE tp.PartyID = @PartyID
          AND tp.SecretariatDate
          BETWEEN @FromDate AND @ToDate;
END;


IF (@EntityName = 'Order')
BEGIN
    SELECT o.OrderID ID,
           CASE
               WHEN @CultureNo = 1 THEN
                   b.Title
               WHEN @CultureNo = 2 THEN
                   b.Title2
           END AS BranchName,
           b.Code AS BranchCode,
           o.Number,
           o.[Date],
           o.OrderID EntityID,
           'Order' EngName,
           'CustomerManager' ModuleKey,
           CFG.GetCLRSaturnDate(o.[Date], @DateFormat, 0, @DateType) AS Date_Date,
           CASE
               WHEN @CultureNo = 1 THEN
                   sty.Title
               WHEN @CultureNo = 2 THEN
                   sty.Title2
           END AS OrderType,
           CASE
               WHEN [Status] = 2 THEN
                   @Revoke
               ELSE
                   @Submit
           END AS StatusString
    FROM CTM.[Order] o
        JOIN SLE.SaleType sty
            ON sty.SaleTypeID = o.SaleTypeID
        JOIN CFG.Branch b
            ON b.BranchID = o.BranchID
    WHERE o.CustomerID = @PartyID
          AND o.Date
          BETWEEN @FromDate AND @ToDate;
END;


IF (@EntityName = 'Reception')
BEGIN
    SELECT r.ReceptionID ID,
           r.Number,
           r.[Date],
           r.ReceptionID EntityID,
           'Reception' EngName,
           'CustomerManager' ModuleKey,
           CASE
               WHEN @CultureNo = 1 THEN
                   b.Title
               WHEN @CultureNo = 2 THEN
                   b.Title2
           END AS BranchName,
           b.Code AS BranchCode,
           p.CustomerCode AS CustomerSubscription,
           CASE
               WHEN @CultureNo = 1 THEN
                   rt.Title
               WHEN @CultureNo = 2 THEN
                   rt.Title2
           END AS ReceptionTypeTitle,
           ad.[Address] AS AddressString,
           ph.Phone AS PhoneString,
           CFG.GetCLRSaturnDate(r.[Date], @DateFormat, 0, @DateType) AS Date_Date
    FROM CTM.Reception r
        JOIN CFG.Branch b
            ON b.BranchID = r.BranchID
        JOIN CFG.Party p
            ON p.PartyID = r.CustomerID
        JOIN ACC.DL d
            ON p.DlID = d.DLID
        JOIN CTM.ReceptionType rt
            ON rt.ReceptionTypeID = r.ReceptionTypeID
        LEFT JOIN CFG.[Address] ad
            ON r.AddressID = ad.AddressID
        LEFT JOIN CFG.Phone ph
            ON r.PhoneID = ph.PhoneID
    WHERE r.CustomerID = @PartyID
          AND r.Date
          BETWEEN @FromDate AND @ToDate;
END;


IF (@EntityName = 'ReceptionTrace')
BEGIN
    SELECT rt.ReceptionTraceID ID,
           rt.Number,
           rt.[Date],
           rt.ReceptionTraceID EntityID,
           'ReceptionTrace' EngName,
           'CustomerManager' ModuleKey,
           CASE
               WHEN @CultureNo = 1 THEN
                   p.Title + ' ' + (ISNULL((p.LastName), ''))
               WHEN @CultureNo = 2 THEN
                   p.Title2 + ' ' + (ISNULL((p.LastName2), ''))
           END AS ResponsibleName,
           d.Code AS ResponsibleCode,
           CASE
               WHEN @CultureNo = 1 THEN
                   rs.Title
               WHEN @CultureNo = 2 THEN
                   rs.Title2
           END AS ReceptionStatusTitle,
           r.Number AS ReceptionNumber,
           CFG.GetCLRSaturnDate(rt.[Date], @DateFormat, 0, @DateType) AS Date_Date
    FROM CTM.ReceptionTrace rt
        JOIN CTM.Reception r
            ON r.ReceptionID = rt.ReceptionID
        JOIN CTM.ReceptionStatus rs
            ON rs.ReceptionStatusID = rt.ReceptionStatusID
        JOIN CFG.Party p
            ON rt.PartyID = p.PartyID
        JOIN ACC.DL d
            ON d.DLID = p.DlID
    WHERE rt.PartyID = @PartyID
          AND rt.Date
          BETWEEN @FromDate AND @ToDate;
END;


IF (@EntityName = 'SubscribeCard')
BEGIN
    SELECT s.SubscribeCardID ID,
           s.Number,
           s.IssueDate Date,
           s.SubscribeCardID EntityID,
           'SubscribeCard' EngName,
           'CustomerManager' ModuleKey,
           CFG.GetCLRSaturnDate(s.IssueDate, @DateFormat, 0, @DateType) AS Date_IssueDate,
           s.[ExpireDate],
           CFG.GetCLRSaturnDate(s.[ExpireDate], @DateFormat, 0, @DateType) AS Date_ExpireDate
    FROM CTM.SubscribeCard s
    WHERE s.PartyID = @PartyID
          AND s.IssueDate
          BETWEEN @FromDate AND @ToDate;
END;


IF (@EntityName = 'ReceiveReceipt')
BEGIN

    SELECT i.ReceiveReceiptID,
           SUM(i.ReceiptAmountInBaseCurrency) ReceiptAmountInBaseCurrency
    INTO #ReceiveReceiptItems
    FROM
    (
        SELECT a.ReceiveReceiptID,
               CASE
                   WHEN c.IsBaseCurrencyBasis = 0 THEN
                       ROUND(a.Amount * a.CurrencyRate / c.ExchangeUnit, @BaseCurrencyPrecision)
                   WHEN c.IsBaseCurrencyBasis = 1 THEN
                       ROUND(a.Amount * c.ExchangeUnit / a.CurrencyRate, @BaseCurrencyPrecision)
               END AS ReceiptAmountInBaseCurrency
        FROM
        (
            SELECT ReceiveReceiptID,
                   CurrencyID,
                   CurrencyRate,
                   Amount
            FROM FIN.ReceivedBankDraft
            UNION ALL
            SELECT ReceiveReceiptID,
                   CurrencyID,
                   CurrencyRate,
                   Amount
            FROM FIN.ReceivedCheqe
            UNION ALL
            SELECT ReceiveReceiptID,
                   CurrencyID,
                   CurrencyRate,
                   Amount
            FROM FIN.ReceivedCash
        ) a
            JOIN CFG.Currency c
                ON a.CurrencyID = c.CurrencyID
    ) i
    GROUP BY i.ReceiveReceiptID;


    SELECT r.ReceiveReceiptID ID,
           b.Code BranchCode,
           CASE
               WHEN @CultureNo = 1 THEN
                   b.Title
               WHEN @CultureNo = 2 THEN
                   b.Title2
           END AS BranchName,
           r.Number,
           r.[Date],
           r.ReceiveReceiptID EntityID,
           'ReceiveReceipt' EngName,
           'FinanceManager' ModuleKey,
           CFG.GetCLRSaturnDate(r.[Date], @DateFormat, 0, @DateType) AS Date_Date,
           v.ReferenceNumber AS VoucherNumber,
           v.Date AS VoucherDate,
           CFG.GetCLRSaturnDate(v.[Date], @DateFormat, 0, @DateType) AS Date_VoucherDate,
           CAST(CASE
                    WHEN r.[Status] = 1 THEN
                        @Initial
                    WHEN vp.VoucherID IS NOT NULL THEN
                        @Voucher
                    WHEN r.PreVoucherID IS NOT NULL THEN
                        @PreVoucher
                    ELSE
                        @Submit
                END AS NVARCHAR(512)) AS StatusString,
           i.ReceiptAmountInBaseCurrency Amount
    FROM FIN.ReceiveReceipt AS r
        JOIN CFG.Branch b
            ON b.BranchID = r.BranchID
        JOIN #ReceiveReceiptItems i
            ON r.ReceiveReceiptID = i.ReceiveReceiptID
        LEFT JOIN
        (
            SELECT PrevoucherID,
                   VoucherID
            FROM ACC.VoucherPrevoucher
            GROUP BY PrevoucherID,
                     VoucherID
        ) vp
            ON r.PreVoucherID = vp.PrevoucherID
        LEFT JOIN ACC.Voucher v
            ON vp.VoucherID = v.VoucherID
    WHERE r.PartyID = @PartyID
          AND r.Date
          BETWEEN @FromDate AND @ToDate;

END;


IF (@EntityName = 'PaymentReceipt')
BEGIN

    SELECT i.PaymentReceiptID,
           SUM(i.PaymentAmountInBaseCurrency) PaymentAmountInBaseCurrency
    INTO #PaymentReceiptItems
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


    SELECT p.PaymentReceiptID ID,
           p.Number,
           p.[Date],
           p.PaymentReceiptID EntityID,
           'PaymentReceipt' EngName,
           'FinanceManager' ModuleKey,
           i.PaymentAmountInBaseCurrency Amount,
           b.Code BranchCode,
           CASE
               WHEN @CultureNo = 1 THEN
                   b.Title
               WHEN @CultureNo = 2 THEN
                   b.Title2
           END AS BranchName,
           CFG.GetCLRSaturnDate(p.[Date], @DateFormat, 0, @DateType) Date_Date,
           v.ReferenceNumber AS VoucherNumber,
           v.Date AS VoucherDate,
           CFG.GetCLRSaturnDate(v.Date, @DateFormat, 0, @DateType) Date_VoucherDate,
           CAST(CASE
                    WHEN p.[Status] = 1 THEN
                        @Establish
                    WHEN vp.VoucherID IS NOT NULL THEN
                        @Voucher
                    WHEN p.PreVoucherID IS NOT NULL THEN
                        @PreVoucher
                    ELSE
                        @Register
                END AS NVARCHAR(150)) AS StatusString
    FROM FIN.PaymentReceipt p
        JOIN CFG.Branch b
            ON b.BranchID = p.BranchID
        JOIN #PaymentReceiptItems i
            ON p.PaymentReceiptID = i.PaymentReceiptID
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
    WHERE p.PartyID = @PartyID
          AND p.Date
          BETWEEN @FromDate AND @ToDate;

END;


IF (@EntityName = 'PaymentCommitment')
BEGIN

    SELECT i.PaymentCommitmentID,
           SUM(i.AmountInBaseCurrency) AmountInBaseCurrency
    INTO #PaymentCommitmentItems
    FROM
    (
        SELECT a.PaymentCommitmentID,
               CASE
                   WHEN c.IsBaseCurrencyBasis = 0 THEN
                       ROUND(a.Amount * a.CurrencyRate / c.ExchangeUnit, @BaseCurrencyPrecision)
                   WHEN c.IsBaseCurrencyBasis = 1 THEN
                       ROUND(a.Amount * c.ExchangeUnit / a.CurrencyRate, @BaseCurrencyPrecision)
               END AS AmountInBaseCurrency
        FROM
        (
            SELECT PaymentCommitmentID,
                   CurrencyID,
                   CurrencyRate,
                   Amount
            FROM FIN.PaymentCheqeCommitment
            UNION ALL
            SELECT PaymentCommitmentID,
                   CurrencyID,
                   CurrencyRate,
                   Amount
            FROM FIN.PaymentPromissoryCommitment
            UNION ALL
            SELECT PaymentCommitmentID,
                   CurrencyID,
                   CurrencyRate,
                   Amount
            FROM FIN.PaymentGuarantyCommitment
        ) a
            JOIN CFG.Currency c
                ON a.CurrencyID = c.CurrencyID
    ) i
    GROUP BY i.PaymentCommitmentID;


    SELECT p.PaymentCommitmentID ID,
           p.Number,
           p.Date,
           p.PaymentCommitmentID EntityID,
           'PaymentCommitment' EngName,
           'FinanceManager' ModuleKey,
           b.Code BranchCode,
           CASE
               WHEN @CultureNo = 1 THEN
                   b.Title
               WHEN @CultureNo = 2 THEN
                   b.Title2
           END AS BranchName,
           dl.Code ContractDlCode,
           CASE
               WHEN @CultureNo = 1 THEN
                   t.Title
               WHEN @CultureNo = 2 THEN
                   t.Title2
           END AS TenderTitle,
           CFG.GetCLRSaturnDate(p.[Date], @DateFormat, 0, @DateType) Date_Date,
           v.ReferenceNumber VoucherNumber,
           v.Date AS VoucherDate,
           CFG.GetCLRSaturnDate(v.Date, @DateFormat, 0, @DateType) Date_VoucherDate,
           CAST(CASE
                    WHEN p.[Status] = 1 THEN
                        @Initial
                    WHEN vp.VoucherID IS NOT NULL THEN
                        @Voucher
                    WHEN p.PreVoucherID IS NOT NULL THEN
                        @PreVoucher
                    ELSE
                        @Submit
                END AS NVARCHAR(512)) AS StatusString,
           i.AmountInBaseCurrency Amount
    FROM FIN.PaymentCommitment p
        JOIN CFG.Branch b
            ON p.BranchID = b.BranchID
        LEFT JOIN CNT.Contract ct
            ON p.ContractID = ct.ContractID
        LEFT JOIN ACC.DL dl
            ON ct.DLID = dl.DLID
        LEFT JOIN VND.Tender t
            ON p.TenderID = t.TenderID
        LEFT JOIN
        (
            SELECT PrevoucherID,
                   VoucherID
            FROM ACC.VoucherPrevoucher
            GROUP BY PrevoucherID,
                     VoucherID
        ) vp
            ON p.PreVoucherID = vp.PrevoucherID
        LEFT JOIN ACC.Voucher v
            ON vp.VoucherID = v.VoucherID
        JOIN #PaymentCommitmentItems i
            ON p.PaymentCommitmentID = i.PaymentCommitmentID
    WHERE p.PartyID = @PartyID
          AND p.Date
          BETWEEN @FromDate AND @ToDate;
END;


IF (@EntityName = 'ReceiveCommitment')
BEGIN

    SELECT i.ReceiveCommitmentID,
           SUM(i.AmountInBaseCurrency) AmountInBaseCurrency
    INTO #ReceiveCommitmentItems
    FROM
    (
        SELECT a.ReceiveCommitmentID,
               CASE
                   WHEN c.IsBaseCurrencyBasis = 0 THEN
                       ROUND(a.Amount * a.CurrencyRate / c.ExchangeUnit, @BaseCurrencyPrecision)
                   WHEN c.IsBaseCurrencyBasis = 1 THEN
                       ROUND(a.Amount * c.ExchangeUnit / a.CurrencyRate, @BaseCurrencyPrecision)
               END AS AmountInBaseCurrency
        FROM
        (
            SELECT ReceiveCommitmentID,
                   CurrencyID,
                   CurrencyRate,
                   Amount
            FROM FIN.ReceiveCheqeCommitment
            UNION ALL
            SELECT ReceiveCommitmentID,
                   CurrencyID,
                   CurrencyRate,
                   Amount
            FROM FIN.ReceivePromissoryCommitment
            UNION ALL
            SELECT ReceiveCommitmentID,
                   CurrencyID,
                   CurrencyRate,
                   Amount
            FROM FIN.ReceiveGuarantyCommitment
        ) a
            JOIN CFG.Currency c
                ON a.CurrencyID = c.CurrencyID
    ) i
    GROUP BY i.ReceiveCommitmentID;


    SELECT r.ReceiveCommitmentID ID,
           b.Code BranchCode,
           CASE
               WHEN @CultureNo = 1 THEN
                   b.Title
               WHEN @CultureNo = 2 THEN
                   b.Title2
           END AS BranchName,
           r.Number,
           r.Date,
           r.ReceiveCommitmentID EntityID,
           'ReceiveCommitment' EngName,
           'FinanceManager' ModuleKey,
           dl.Code CashCode,
           c.Title CashName,
           dl2.Code ContractDlCode,
           CASE
               WHEN @CultureNo = 1 THEN
                   t.Title
               WHEN @CultureNo = 2 THEN
                   t.Title2
           END AS TenderTitle,
           CFG.GetCLRSaturnDate(r.[Date], @DateFormat, 0, @DateType) Date_Date,
           v.ReferenceNumber VoucherNumber,
           v.Date AS VoucherDate,
           CFG.GetCLRSaturnDate(v.Date, @DateFormat, 0, @DateType) AS Date_VoucherDate,
           CAST(CASE
                    WHEN r.[Status] = 1 THEN
                        @Initial
                    WHEN vp.VoucherID IS NOT NULL THEN
                        @Voucher
                    WHEN r.PreVoucherID IS NOT NULL THEN
                        @PreVoucher
                    ELSE
                        @Submit
                END AS NVARCHAR(512)) AS StatusString,
           i.AmountInBaseCurrency Amount
    FROM FIN.ReceiveCommitment r
        JOIN CFG.Branch b
            ON r.BranchID = b.BranchID
        JOIN CFG.Cash c
            ON r.CashID = c.CashID
        JOIN ACC.DL dl
            ON c.DlID = dl.DLID
        LEFT JOIN CNT.Contract ct
            ON r.ContractID = ct.ContractID
        LEFT JOIN ACC.DL dl2
            ON ct.DLID = dl2.DLID
        LEFT JOIN VND.Tender t
            ON r.TenderID = t.TenderID
        LEFT JOIN REQ.ReceiveRequest rr
            ON r.ReceiveRequestID = rr.ReceiveRequestID
        LEFT JOIN
        (
            SELECT PrevoucherID,
                   VoucherID
            FROM ACC.VoucherPrevoucher
            GROUP BY PrevoucherID,
                     VoucherID
        ) vp
            ON r.PreVoucherID = vp.PrevoucherID
        LEFT JOIN ACC.Voucher v
            ON vp.VoucherID = v.VoucherID
        JOIN #ReceiveCommitmentItems i
            ON r.ReceiveCommitmentID = i.ReceiveCommitmentID
    WHERE r.PartyID = @PartyID
          AND r.Date
          BETWEEN @FromDate AND @ToDate;

END;


IF (@EntityName = 'BillOfLading')
BEGIN
    SELECT b.BillOfLadingID ID,
           b.Number,
           b.Date,
           b.BillOfLadingID EntityID,
           'BillOfLading' EngName,
           'ForeignOrder' ModuleKey,
           CFG.GetCLRSaturnDate(b.[Date], @DateFormat, 0, @DateType) AS Date_Date,
           br.Code BranchCode,
           CASE
               WHEN @CultureNo = 1 THEN
                   br.Title
               WHEN @CultureNo = 2 THEN
                   br.Title2
           END AS BranchName,
           b.BillNumber,
           p.Number PurchaseInvoiceNumber,
           b.IssueDate,
           CFG.GetCLRSaturnDate(b.IssueDate, @DateFormat, 0, @DateType) Date_IssueDate,
           b.StartDateOfLading,
           CFG.GetCLRSaturnDate(b.StartDateOfLading, @DateFormat, 0, @DateType) Date_StartDateOfLading,
           CASE
               WHEN @CultureNo = 1 THEN
                   t.Title
               WHEN @CultureNo = 2 THEN
                   t.Title2
           END AS LadingTypeTitle,
           v.ReferenceNumber VoucherNumber,
           v.Date AS VoucherDate,
           CFG.GetCLRSaturnDate(v.Date, @DateFormat, 0, @DateType) Date_VoucherDate,
           CASE
               WHEN vp.VoucherID IS NOT NULL THEN
                   @Voucher
               WHEN b.PreVoucherID IS NOT NULL THEN
                   @PreVoucher
               ELSE
                   @Submit
           END StatusString
    FROM FOS.BillOfLading AS b
        INNER JOIN FOS.LadingType t
            ON t.LadingTypeID = b.LadingTypeID
        INNER JOIN CFG.Branch AS br
            ON b.BranchID = br.BranchID
        LEFT JOIN VND.PurchaseInvoiceItem i
            ON i.PurchaseInvoiceItemID = b.PurchaseInvoiceItemID
        LEFT JOIN VND.PurchaseInvoice p
            ON i.PurchaseInvoiceID = p.PurchaseInvoiceID
        LEFT JOIN
        (
            SELECT PrevoucherID,
                   VoucherID
            FROM ACC.VoucherPrevoucher
            GROUP BY PrevoucherID,
                     VoucherID
        ) vp
            ON b.PreVoucherID = vp.PrevoucherID
        LEFT JOIN ACC.Voucher v
            ON vp.VoucherID = v.VoucherID
    WHERE b.PartyID = @PartyID
          AND b.Date
          BETWEEN @FromDate AND @ToDate;
END;


IF (@EntityName = 'ProformaInvoice')
BEGIN
    SELECT p.ProformaInvoiceID ID,
           b.Code BranchCode,
           CASE
               WHEN @CultureNo = 1 THEN
                   b.Title
               WHEN @CultureNo = 2 THEN
                   b.Title2
           END AS BranchName,
           CASE
               WHEN p.Base = 1 THEN
                   @PurchaseRequest
               WHEN p.Base = 2 THEN
                   @Proposal
               WHEN p.Base = 3 THEN
                   @NoBase
           END BaseString,
           p.Number,
           p.[Date],
           p.ProformaInvoiceID EntityID,
           'ProformaInvoice' EngName,
           'ForeignOrder' ModuleKey,
           CFG.GetCLRSaturnDate(p.[Date], @DateFormat, 0, @DateType) AS Date_Date,
           p.CreditDate,
           CFG.GetCLRSaturnDate(p.CreditDate, @DateFormat, 0, @DateType) AS Date_CreditDate,
           CASE
               WHEN @CultureNo = 1 THEN
                   c.Title
               WHEN @CultureNo = 2 THEN
                   c.Title2
           END AS CurrencyName,
           d.Code DlCode,
           CASE
               WHEN @CultureNo = 1 THEN
                   d.Title
               WHEN @CultureNo = 2 THEN
                   d.Title2
           END AS DlTitle,
           CASE
               WHEN p.Status = 1 THEN
                   @Submit
               WHEN p.Status = 2 THEN
                   @Confirm
               WHEN p.Status = 3 THEN
                   @Modify
           END StatusString
    FROM FOS.ProformaInvoice p
        JOIN CFG.Branch b
            ON b.BranchID = p.BranchID
        JOIN CFG.Currency c
            ON p.CurrencyID = c.CurrencyID
        JOIN ACC.DL d
            ON d.DLID = p.DLID
    WHERE p.Vendor = @PartyID
          AND p.Date
          BETWEEN @FromDate AND @ToDate;
END;


IF (@EntityName = 'ShippingInsurance')
BEGIN
    SELECT s.ShippingInsuranceID ID,
           s.Number,
           s.Date,
           s.ShippingInsuranceID EntityID,
           'ShippingInsurance' EngName,
           'ForeignOrder' ModuleKey,
           CFG.GetCLRSaturnDate(s.[Date], @DateFormat, 0, @DateType) AS Date_Date,
           b.Code BranchCode,
           CASE
               WHEN @CultureNo = 1 THEN
                   b.Title
               WHEN @CultureNo = 2 THEN
                   b.Title2
           END AS BranchName,
           s.ShippingInsuranceNumber,
           i.ProformaInvoiceID ProformaInvoiceNumber,
           s.IssueDate,
           CFG.GetCLRSaturnDate(s.IssueDate, @DateFormat, 0, @DateType) AS Date_IssueDate,
           s.CreditDate,
           CFG.GetCLRSaturnDate(s.CreditDate, @DateFormat, 0, @DateType) AS Date_CreditDate,
           CASE
               WHEN @CultureNo = 1 THEN
                   t.Title
               WHEN @CultureNo = 2 THEN
                   t.Title2
           END AS ShippingInsuranceType,
           s.CurrencyID,
           s.Price Amount,
           v.ReferenceNumber VoucherNumber,
           CFG.GetCLRSaturnDate(v.Date, @DateFormat, 0, @DateType) VoucherDate,
           CASE
               WHEN vp.VoucherID IS NOT NULL THEN
                   @Voucher
               WHEN s.PreVoucherID IS NOT NULL THEN
                   @PreVoucher
               ELSE
                   @Submit
           END StatusString
    FROM FOS.ShippingInsurance s
        JOIN CFG.Branch b
            ON s.BranchID = b.BranchID
        JOIN FOS.ProformaInvoice i
            ON s.ProformaInvoiceID = i.ProformaInvoiceID
        JOIN FOS.ShippingInsuranceType t
            ON s.ShippingInsuranceTypeID = t.ShippingInsuranceTypeID
        LEFT JOIN
        (
            SELECT PrevoucherID,
                   VoucherID
            FROM ACC.VoucherPrevoucher
            GROUP BY PrevoucherID,
                     VoucherID
        ) vp
            ON s.PreVoucherID = vp.PrevoucherID
        LEFT JOIN ACC.Voucher v
            ON vp.VoucherID = v.VoucherID
    WHERE s.PartyID = @PartyID
          AND s.Date
          BETWEEN @FromDate AND @ToDate;
END;


IF (@EntityName = 'PaymentRequest')
BEGIN
    SELECT r.PaymentRequestID ID,
           CASE
               WHEN r.Type = 1 THEN
                   @Normal
               WHEN r.Type = 2 THEN
                   @Guaranteed
           END AS TypeString,
           r.Number,
           b.Code BranchCode,
           CASE
               WHEN @CultureNo = 1 THEN
                   b.Title
               WHEN @CultureNo = 2 THEN
                   b.Title2
           END AS BranchName,
           r.Date,
           r.PaymentRequestID EntityID,
           'PaymentRequest' EngName,
           'RequestManager' ModuleKey,
           CFG.GetCLRSaturnDate(r.[Date], @DateFormat, 0, @DateType) AS Date_Date,
           CASE
               WHEN @CultureNo = 1 THEN
                   c.Title
               WHEN @CultureNo = 2 THEN
                   c.Title2
           END AS CurrencyName,
           pri.Amount,
           CASE
               WHEN r.Status = 1 THEN
                   @Submit
               WHEN r.Status = 2 THEN
                   @Confirm
               WHEN r.Status = 3 THEN
                   @Rejected
           END AS StatusString
    FROM REQ.PaymentRequest r
        JOIN REQ.PaymentRequestItem AS pri
            ON pri.PaymentRequestID = r.PaymentRequestID
        JOIN CFG.Branch b
            ON r.BranchID = b.BranchID
        JOIN CFG.Currency c
            ON pri.CurrencyID = c.CurrencyID
    WHERE pri.PartyID = @PartyID
          AND r.Date
          BETWEEN @FromDate AND @ToDate;
END;


IF (@EntityName = 'ReceiveRequest')
BEGIN
    SELECT r.ReceiveRequestID ID,
           CASE
               WHEN r.Type = 1 THEN
                   @Normal
               WHEN r.Type = 2 THEN
                   @Guaranteed
           END AS TypeString,
           r.Number,
           b.Code BranchCode,
           CASE
               WHEN @CultureNo = 1 THEN
                   b.Title
               WHEN @CultureNo = 2 THEN
                   b.Title2
           END AS BranchName,
           r.Date,
           r.ReceiveRequestID EntityID,
           'ReceiveRequest' EngName,
           'RequestManager' ModuleKey,
           CFG.GetCLRSaturnDate(r.[Date], @DateFormat, 0, @DateType) AS Date_Date,
           CASE
               WHEN @CultureNo = 1 THEN
                   c.Title
               WHEN @CultureNo = 2 THEN
                   c.Title2
           END AS CurrencyName,
           r.Amount,
           CASE
               WHEN r.Status = 1 THEN
                   @Submit
               WHEN r.Status = 2 THEN
                   @Confirm
               WHEN r.Status = 3 THEN
                   @Rejected
           END AS StatusString
    FROM REQ.ReceiveRequest r
        JOIN CFG.Branch b
            ON r.BranchID = b.BranchID
        JOIN CFG.Currency c
            ON r.CurrencyID = c.CurrencyID
    WHERE r.PartyID = @PartyID
          AND r.Date
          BETWEEN @FromDate AND @ToDate;
END;

IF (@EntityName = 'Invoice')
BEGIN
    SELECT i.InvoiceID ID,
           i.Number,
           i.InvoiceID EntityID,
           'Invoice' EngName,
           'SaleManager' ModuleKey,
           i.CurrencyID,
           i.CurrencyRate,
           i.TotalNetPrice Amount,
           CASE
               WHEN @CultureNo = 1 THEN
                   b.Title
               WHEN @CultureNo = 2 THEN
                   b.Title2
           END AS BranchName,
           b.Code AS BranchCode,
           CASE
               WHEN @CultureNo = 1 THEN
                   sty.Title
               WHEN @CultureNo = 2 THEN
                   sty.Title2
           END AS SaleType,
           p.CustomerCode AS CustomerSubscription,
           CASE
               WHEN @CultureNo = 1 THEN
                   c.Title
               WHEN @CultureNo = 2 THEN
                   c.Title2
           END AS CurrencyName,
           i.[Date],
           CFG.GetCLRSaturnDate(i.[Date], @DateFormat, 0, @DateType) AS Date_Date,
           v.ReferenceNumber AS VoucherNumber,
           v.[Date] AS VoucherDate,
           CFG.GetCLRSaturnDate(v.[Date], @DateFormat, 0, @DateType) AS Date_VoucherDate,
           CASE
               WHEN @CultureNo = 1 THEN
                   p2.Title + ' ' + p2.LastName
               WHEN @CultureNo = 2 THEN
                   p2.Title2 + ' ' + p2.LastName2
           END AS SaleAgentName,
           ISNULL(pre.PreReceive, 0) AS PreReceive,
           CAST(CASE
                    WHEN i.[SaleInvoiceStatus] = 5 THEN
                        @Revoke
                    WHEN vp.VoucherID IS NOT NULL THEN
                        @Voucher
                    WHEN i.PreVoucherID IS NOT NULL THEN
                        @PreVoucher
                    WHEN i.[SaleInvoiceStatus] = 2 THEN
                        REPLACE(@Confirmed, NCHAR(1610), NCHAR(1740))
                    ELSE
                        @Submit
                END AS NVARCHAR(512)) AS StatusString
    FROM SLE.Invoice AS i
        JOIN SLE.SaleType sty
            ON sty.SaleTypeID = i.SaleTypeID
        LEFT JOIN
        (
            SELECT ipr.InvoiceID,
                   SUM(ipr.Price) PreReceive
            FROM SLE.InvoicePreReceive AS ipr
            GROUP BY ipr.InvoiceID
        ) pre
            ON pre.InvoiceID = i.InvoiceID
        INNER JOIN CFG.Branch AS b
            ON b.BranchID = i.BranchID
        INNER JOIN CFG.Party AS p
            ON p.PartyID = i.CustomerID
        INNER JOIN CFG.Currency AS c
            ON c.CurrencyID = i.CurrencyID
        LEFT JOIN CFG.Party p2
            ON p2.PartyID = i.SaleAgentID
        LEFT JOIN
        (
            SELECT PrevoucherID,
                   VoucherID
            FROM ACC.VoucherPrevoucher
            GROUP BY PrevoucherID,
                     VoucherID
        ) vp
            ON vp.PrevoucherID = i.PreVoucherID
        LEFT JOIN ACC.Voucher v
            ON v.VoucherID = vp.VoucherID
    WHERE i.CustomerID = @PartyID
          AND i.Date
          BETWEEN @FromDate AND @ToDate;
END;


IF (@EntityName = 'Justification')
BEGIN
    SELECT j.JustificationID ID,
           CASE
               WHEN @CultureNo = 1 THEN
                   c.Title
               WHEN @CultureNo = 2 THEN
                   c.Title2
           END AS CurrencyName,
           1 AS CurrencyRate,
           j.TotalNetPrice Amount,
           j.JustificationID EntityID,
           'Justification' EngName,
           'SaleManager' ModuleKey,
           b.Code AS BranchCode,
           CASE
               WHEN @CultureNo = 1 THEN
                   b.Title
               WHEN @CultureNo = 2 THEN
                   b.Title2
           END AS BranchName,
           p.CustomerCode AS CustomerSubscription,
           j.Number,
           j.[Date],
           CFG.GetCLRSaturnDate(j.[Date], @DateFormat, 0, @DateType) AS Date_Date,
           CASE
               WHEN @CultureNo = 1 THEN
                   sty.Title
               WHEN @CultureNo = 2 THEN
                   sty.Title2
           END AS SaleType,
           CASE
               WHEN [Status] = 2 THEN
                   @Revoke
               ELSE
                   @Submit
           END AS StatusString,
           CAST(CASE BaseDocument
                    WHEN 1 THEN
                        @WithOutbase
                    WHEN 2 THEN
                        @Order
                    WHEN 3 THEN
                        @Justification
                    WHEN 4 THEN
                        @Quotation
                    WHEN 5 THEN
                        @Remittance
                    WHEN 6 THEN
                        @Invoice
                    WHEN 7 THEN
                        @ReturnedSaleJustification
                    WHEN 8 THEN
                        @ReturnedSaleInvoice
                    WHEN 9 THEN
                        @Outgoing
                END AS NVARCHAR(200)) AS BaseDocumentName
    FROM SLE.Justification j
        JOIN SLE.SaleType sty
            ON sty.SaleTypeID = j.SaleTypeID
        JOIN CFG.Branch b
            ON b.BranchID = j.BranchID
        JOIN CFG.Party p
            ON p.PartyID = j.CustomerID
        JOIN CFG.Currency c
            ON c.CurrencyID = j.CurrencyID
    WHERE j.CustomerID = @PartyID
          AND j.Date
          BETWEEN @FromDate AND @ToDate;
END;


IF (@EntityName = 'Quotation')
BEGIN
    SELECT q.QuotationID ID,
           CASE
               WHEN @CultureNo = 1 THEN
                   c.Title
               WHEN @CultureNo = 2 THEN
                   c.Title2
           END AS CurrencyName,
           1 AS CurrencyRate,
           q.QuotationID EntityID,
           'Quotation' EngName,
           'SaleManager' ModuleKey,
           q.TotalNetPrice Amount,
           b.Code AS BranchCode,
           CASE
               WHEN @CultureNo = 1 THEN
                   b.Title
               WHEN @CultureNo = 2 THEN
                   b.Title2
           END AS BranchName,
           p.CustomerCode AS CustomerSubscription,
           q.Number,
           q.[Date],
           CFG.GetCLRSaturnDate(q.[Date], @DateFormat, 0, @DateType) AS Date_Date,
           CASE
               WHEN @CultureNo = 1 THEN
                   sty.Title
               WHEN @CultureNo = 2 THEN
                   sty.Title2
           END AS SaleType,
           CASE
               WHEN [Status] = 2 THEN
                   @Revoke
               WHEN [Status] = 3 THEN
                   @Confirmed
               ELSE
                   @Submit
           END AS StatusString,
           CAST(CASE BaseDocument
                    WHEN 1 THEN
                        @WithOutbase
                    WHEN 2 THEN
                        @Order
                    WHEN 3 THEN
                        @Justification
                    WHEN 4 THEN
                        @Quotation
                    WHEN 5 THEN
                        @Remittance
                    WHEN 6 THEN
                        @Invoice
                    WHEN 7 THEN
                        @ReturnedSaleJustification
                    WHEN 8 THEN
                        @ReturnedSaleInvoice
                    WHEN 9 THEN
                        @Outgoing
                END AS NVARCHAR(200)) AS BaseDocumentName
    FROM SLE.Quotation q
        JOIN SLE.SaleType sty
            ON sty.SaleTypeID = q.SaleTypeID
        JOIN CFG.Branch b
            ON b.BranchID = q.BranchID
        JOIN CFG.Party p
            ON p.PartyID = q.CustomerID
        JOIN CFG.Currency c
            ON c.CurrencyID = q.CurrencyID
    WHERE q.CustomerID = @PartyID
          AND q.Date
          BETWEEN @FromDate AND @ToDate;
END;

IF (@EntityName = 'Remittance')
BEGIN
    SELECT r.RemittanceID ID,
           b.Code AS BranchCode,
           CASE
               WHEN @CultureNo = 1 THEN
                   b.Title
               WHEN @CultureNo = 2 THEN
                   b.Title2
           END AS BranchName,
           p.CustomerCode AS CustomerSubscription,
           r.Number,
           s.Code AS StockCode,
           CASE
               WHEN @CultureNo = 1 THEN
                   s.Title
               WHEN @CultureNo = 2 THEN
                   s.Title2
           END AS StockName,
           r.RemittanceID EntityID,
           'Remittance' EngName,
           'SaleManager' ModuleKey,
           r.[Date],
           CFG.GetCLRSaturnDate(r.[Date], @DateFormat, 0, @DateType) AS Date_Date,
           r.DeadLine,
           CFG.GetCLRSaturnDate(r.DeadLine, @DateFormat, 0, @DateType) AS Date_DeadLine,
           CASE
               WHEN @CultureNo = 1 THEN
                   sty.Title
               WHEN @CultureNo = 2 THEN
                   sty.Title2
           END AS SaleType,
           CASE
               WHEN [Status] = 2 THEN
                   @Revoke
               WHEN [Status] = 3 THEN
                   @Confirmed
               ELSE
                   @Submit
           END AS StatusString,
           CAST(CASE BaseDocument
                    WHEN 1 THEN
                        @WithOutbase
                    WHEN 2 THEN
                        @Order
                    WHEN 3 THEN
                        @Justification
                    WHEN 4 THEN
                        @Quotation
                    WHEN 5 THEN
                        @Remittance
                    WHEN 6 THEN
                        @Invoice
                    WHEN 7 THEN
                        @ReturnedSaleJustification
                    WHEN 8 THEN
                        @ReturnedSaleInvoice
                    WHEN 9 THEN
                        @Outgoing
                    WHEN 14 THEN
                        @Remittance
                END AS NVARCHAR(200)) AS BaseDocumentName
    FROM SLE.[Remittance] r
        JOIN SLE.SaleType sty
            ON sty.SaleTypeID = r.SaleTypeID
        JOIN CFG.Branch b
            ON b.BranchID = r.BranchID
        JOIN CFG.Party p
            ON p.PartyID = r.CustomerID
        JOIN STF.Stock s
            ON s.StockID = r.StockID
    WHERE r.CustomerID = @PartyID
          AND r.Date
          BETWEEN @FromDate AND @ToDate;
END;

IF (@EntityName = 'ReturnedSaleInvoice')
BEGIN
    SELECT rs.ReturnedSaleInvoiceID ID,
           CASE
               WHEN @CultureNo = 1 THEN
                   c.Title
               WHEN @CultureNo = 2 THEN
                   c.Title2
           END AS CurrencyName,
           rs.CurrencyRate,
           rs.TotalNetPrice,
           0 AS Percentage,
           b.Code AS BranchCode,
           CASE
               WHEN @CultureNo = 1 THEN
                   b.Title
               WHEN @CultureNo = 2 THEN
                   b.Title2
           END AS BranchName,
           CASE
               WHEN @CultureNo = 1 THEN
                   sty.Title
               WHEN @CultureNo = 2 THEN
                   sty.Title2
           END AS SaleType,
           p.CustomerCode AS CustomerSubscription,
           rs.Number,
           rs.ReturnedSaleInvoiceID EntityID,
           'ReturnedSaleInvoice' EngName,
           'SaleManager' ModuleKey,
           rs.[Date],
           CFG.GetCLRSaturnDate(rs.[Date], @DateFormat, 0, @DateType) AS Date_Date,
           v.ReferenceNumber AS VoucherNumber,
           v.[Date] AS VoucherDate,
           CFG.GetCLRSaturnDate(v.[Date], @DateFormat, 0, @DateType) AS Date_VoucherDate,
           CASE
               WHEN [Status] = 2 THEN
                   @Revoke
               WHEN vp.VoucherID IS NOT NULL THEN
                   @Voucher
               WHEN rs.PreVoucherID IS NOT NULL THEN
                   @PreVoucher
               ELSE
                   @Submit
           END AS StatusString,
           CAST(CASE BaseDocument
                    WHEN 1 THEN
                        @WithOutbase
                    WHEN 2 THEN
                        @Order
                    WHEN 3 THEN
                        @Justification
                    WHEN 4 THEN
                        @Quotation
                    WHEN 5 THEN
                        @Remittance
                    WHEN 6 THEN
                        @Invoice
                    WHEN 7 THEN
                        @ReturnedSaleJustification
                    WHEN 8 THEN
                        @ReturnedSaleInvoice
                    WHEN 9 THEN
                        @Outgoing
                END AS NVARCHAR(200)) AS BaseDocumentName
    FROM SLE.ReturnedSaleInvoice rs
        JOIN SLE.SaleType sty
            ON sty.SaleTypeID = rs.SaleTypeID
        JOIN CFG.Branch b
            ON b.BranchID = rs.BranchID
        JOIN CFG.Party p
            ON p.PartyID = rs.CustomerID
        JOIN CFG.Currency c
            ON c.CurrencyID = rs.CurrencyID
        LEFT JOIN
        (
            SELECT PrevoucherID,
                   VoucherID
            FROM ACC.VoucherPrevoucher
            GROUP BY PrevoucherID,
                     VoucherID
        ) vp
            ON vp.PrevoucherID = rs.PreVoucherID
        LEFT JOIN ACC.Voucher v
            ON v.VoucherID = vp.VoucherID
    WHERE rs.CustomerID = @PartyID
          AND rs.Date
          BETWEEN @FromDate AND @ToDate;
END;

IF (@EntityName = 'ReturnedSaleJustification')
BEGIN
    SELECT rsj.ReturnedSaleJustificationID ID,
           CASE
               WHEN @CultureNo = 1 THEN
                   b.Title
               WHEN @CultureNo = 2 THEN
                   b.Title2
           END AS BranchName,
           b.Code AS BranchCode,
           p.CustomerCode AS CustomerSubscription,
           rsj.Number,
           rsj.[Date],
           rsj.ReturnedSaleJustificationID EntityID,
           'ReturnedSaleJustification' EngName,
           'SaleManager' ModuleKey,
           CASE
               WHEN @CultureNo = 1 THEN
                   sty.Title
               WHEN @CultureNo = 2 THEN
                   sty.Title2
           END AS SaleType,
           CFG.GetCLRSaturnDate(rsj.[Date], @DateFormat, 0, @DateType) AS Date_Date,
           CASE
               WHEN [Status] = 2 THEN
                   @Revoke
               ELSE
                   @Submit
           END AS StatusString,
           CASE BaseDocument
               WHEN 1 THEN
                   @WithOutbase
               WHEN 6 THEN
                   @Invoice
           END AS BaseDocumentString
    FROM SLE.ReturnedSaleJustification rsj
        JOIN SLE.SaleType sty
            ON sty.SaleTypeID = rsj.SaleTypeID
        JOIN CFG.Branch b
            ON b.BranchID = rsj.BranchID
        JOIN CFG.Party p
            ON p.PartyID = rsj.CustomerID
    WHERE rsj.CustomerID = @PartyID
          AND rsj.Date
          BETWEEN @FromDate AND @ToDate;
END;

IF (@EntityName = 'SaleContract')
BEGIN
    SELECT sc.SaleContractID ID,
           sc.Number,
           sc.[Date],
           CFG.GetCLRSaturnDate(sc.[Date], @DateFormat, 0, @DateType) AS Date_Date,
           b.Code AS BranchCode,
           CASE
               WHEN @CultureNo = 1 THEN
                   b.Title
               WHEN @CultureNo = 2 THEN
                   b.Title2
           END AS BranchName,
           sc.ContractNumber,
           sc.SaleContractID EntityID,
           'SaleContract' EngName,
           'SaleManager' ModuleKey,
           sc.ContractDate,
           CFG.GetCLRSaturnDate(sc.ContractDate, @DateFormat, 0, @DateType) AS Date_ContractDate,
           CASE
               WHEN @CultureNo = 1 THEN
                   c.Title
               WHEN @CultureNo = 2 THEN
                   c.Title2
           END AS CurrencyName,
           1 AS CurrencyRate,
           sc.TotalNetPrice Amount,
           CASE sc.BaseDocument
               WHEN 1 THEN
                   @WithOutbase
               WHEN 4 THEN
                   @Quotation
           END AS BaseDocumentName
    FROM SLE.SaleContract AS sc
        INNER JOIN CFG.Branch AS b
            ON b.BranchID = sc.BranchID
        INNER JOIN CFG.Party AS p
            ON p.PartyID = sc.CustomerID
        INNER JOIN CFG.Currency AS c
            ON c.CurrencyID = sc.CurrencyID
    WHERE sc.CustomerID = @PartyID
          AND sc.Date
          BETWEEN @FromDate AND @ToDate;
END;

IF (@EntityName = 'Proposal')
BEGIN
    SELECT p.ProposalID ID,
           CASE p.BaseDocument
               WHEN 1 THEN
                   @WithOutbase
               WHEN 2 THEN
                   @PurchaseRequest
           END BaseString,
           p.QuotationNumber,
           p.QuotationDate,
           p.Number,
           p.ProposalID EntityID,
           'Proposal' EngName,
           'VendorManager' ModuleKey,
           CASE
               WHEN @CultureNo = 1 THEN
                   c.Title
               WHEN @CultureNo = 2 THEN
                   c.Title2
           END AS CurrencyName,
           (p.TotalPrice - p.TotalDiscount + p.TotalTax + p.TotalDuty) Amount,
           p.[Date],
           CFG.GetCLRSaturnDate(p.[Date], @DateFormat, 0, @DateType) AS Date_Date,
           b.Code AS BranchCode,
           CASE
               WHEN @CultureNo = 1 THEN
                   b.Title
               WHEN @CultureNo = 2 THEN
                   b.Title2
           END AS BranchName,
           p.QuotationDate,
           CFG.GetCLRSaturnDate(p.QuotationDate, @DateFormat, 0, @DateType) AS Date_QuotationDate,
           CASE
               WHEN p.Status = 3 THEN
                   @Ended
               WHEN p.Status = 2 THEN
                   @Confirmed
               ELSE
                   @Submit
           END StatusString
    FROM VND.Proposal p
        LEFT JOIN CFG.Branch b
            ON b.BranchID = p.BranchID
        LEFT JOIN CFG.Currency c
            ON c.CurrencyID = p.CurrencyID
        LEFT JOIN CFG.Party pa
            ON pa.PartyID = p.PartyID
    WHERE p.PartyID = @PartyID
          AND p.Date
          BETWEEN @FromDate AND @ToDate;
END;

IF (@EntityName = 'ReturnedOutgoing')
BEGIN
    SELECT r.ReturnedOutgoingID ID,
           r.Number,
           r.Date,
           CFG.GetCLRSaturnDate(r.[Date], @DateFormat, 0, @DateType) AS Date_Date,
           r.ReturnedOutgoingID EntityID,
           'AmountReturnedOutgoing' EngName,
           'StockManager' ModuleKey,
           r.TotalPrice Amount,
           s.Code StockCode,
           CASE
               WHEN @CultureNo = 1 THEN
                   s.Title
               WHEN @CultureNo = 2 THEN
                   s.Title2
           END AS StockName,
           v.ReferenceNumber AS VoucherNumber,
           v.[Date] AS VoucherDate,
           CFG.GetCLRSaturnDate(v.[Date], @DateFormat, 0, @DateType) AS VoucherDate,
           CASE
               WHEN vp.VoucherID IS NOT NULL THEN
                   @Voucher
               WHEN r.PreVoucherID IS NOT NULL THEN
                   @PreVoucher
               ELSE
                   @Submit
           END AS StatusString
    FROM STC.ReturnedOutgoing r
        JOIN STF.Stock s
            ON r.StockID = s.StockID
        LEFT JOIN
        (
            SELECT PrevoucherID,
                   VoucherID
            FROM ACC.VoucherPrevoucher
            GROUP BY PrevoucherID,
                     VoucherID
        ) vp
            ON vp.PrevoucherID = r.PreVoucherID
        LEFT JOIN ACC.Voucher v
            ON v.VoucherID = vp.VoucherID
    WHERE @DlID IS NOT NULL
          AND r.DlDeliverID = @DlID
          AND r.Date
          BETWEEN @FromDate AND @ToDate;
END;

IF (@EntityName = 'PaymentCommitmentRecall')
BEGIN
    SELECT r.PaymentCommitmentRecallID ID,
           CASE
               WHEN @CultureNo = 1 THEN
                   b.Title
               WHEN @CultureNo = 2 THEN
                   b.Title2
           END AS BranchName,
           b.Code BranchCode,
           r.Date,
           CFG.GetCLRSaturnDate(r.[Date], @DateFormat, 0, @DateType) AS Date_Date,
           r.PaymentCommitmentRecallID EntityID,
           'PaymentCommitmentRecall' EngName,
           'FinanceManager' ModuleKey,
           v.ReferenceNumber AS VoucherNumber,
           v.[Date] AS VoucherDate,
           CFG.GetCLRSaturnDate(v.[Date], @DateFormat, 0, @DateType) AS Date_VoucherDate,
           CASE
               WHEN vp.VoucherID IS NOT NULL THEN
                   @Voucher
               WHEN r.PreVoucherID IS NOT NULL THEN
                   @PreVoucher
               ELSE
                   @Submit
           END AS StatusString
    FROM FIN.PaymentCommitmentRecall r
        JOIN CFG.Branch b
            ON r.BranchID = b.BranchID
        LEFT JOIN
        (
            SELECT PrevoucherID,
                   VoucherID
            FROM ACC.VoucherPrevoucher
            GROUP BY PrevoucherID,
                     VoucherID
        ) vp
            ON vp.PrevoucherID = r.PreVoucherID
        LEFT JOIN ACC.Voucher v
            ON v.VoucherID = vp.VoucherID
    WHERE @DlID IS NOT NULL
          AND r.DLID = @DlID
          AND r.Date
          BETWEEN @FromDate AND @ToDate;
END;

IF (@EntityName = 'ReceiveCommitmentRecall')
BEGIN
    SELECT r.ReceiveCommitmentRecallID ID,
           CASE
               WHEN @CultureNo = 1 THEN
                   b.Title
               WHEN @CultureNo = 2 THEN
                   b.Title2
           END AS BranchName,
           b.Code BranchCode,
           r.Date,
           CFG.GetCLRSaturnDate(r.[Date], @DateFormat, 0, @DateType) AS Date_Date,
           r.ReceiveCommitmentRecallID EntityID,
           'ReceiveCommitmentRecall' EngName,
           'FinanceManager' ModuleKey,
           v.ReferenceNumber AS VoucherNumber,
           v.[Date] AS VoucherDate,
           CFG.GetCLRSaturnDate(v.[Date], @DateFormat, 0, @DateType) AS Date_VoucherDate,
           CASE
               WHEN vp.VoucherID IS NOT NULL THEN
                   @Voucher
               WHEN r.PreVoucherID IS NOT NULL THEN
                   @PreVoucher
               ELSE
                   @Submit
           END AS StatusString
    FROM FIN.ReceiveCommitmentRecall r
        JOIN CFG.Branch b
            ON r.BranchID = b.BranchID
        LEFT JOIN
        (
            SELECT PrevoucherID,
                   VoucherID
            FROM ACC.VoucherPrevoucher
            GROUP BY PrevoucherID,
                     VoucherID
        ) vp
            ON vp.PrevoucherID = r.PreVoucherID
        LEFT JOIN ACC.Voucher v
            ON v.VoucherID = vp.VoucherID
    WHERE @DlID IS NOT NULL
          AND r.DLID = @DlID
          AND r.Date
          BETWEEN @FromDate AND @ToDate;
END;

IF (@EntityName = 'StockReceipt')
BEGIN
    SELECT sr.StockReceiptID ID,
           sr.Number,
           sr.TotalNetPrice Amount,
           CASE sdtb.BaseEntity
               WHEN 1 THEN
                   @WithOutbase
               WHEN 2 THEN
                   @PurchaseRequest
               WHEN 3 THEN
                   @Proposal
               WHEN 6 THEN
                   @JustificationInput
               WHEN 7 THEN
                   @PurchaseInvoice
               WHEN 8 THEN
                   @PurchaseContract
               WHEN 10 THEN
                   'ترخیص'
           END AS BaseDocumentName,
           s.Code StockCode,
           CASE
               WHEN @CultureNo = 1 THEN
                   s.Title
               WHEN @CultureNo = 2 THEN
                   s.Title2
           END AS StockName,
           sr.StockReceiptID EntityID,
           'AmountReceipt' EngName,
           'StockManager' ModuleKey,
           sr.[Date],
           CFG.GetCLRSaturnDate(sr.[Date], @DateFormat, 0, @DateType) AS Date_Date,
           CASE
               WHEN @CultureNo = 1 THEN
                   sdt.Title
               WHEN @CultureNo = 2 THEN
                   sdt.Title2
           END AS TypeString,
           v.ReferenceNumber AS VoucherNumber,
           v.[Date] AS VoucherDate,
           CFG.GetCLRSaturnDate(v.[Date], @DateFormat, 0, @DateType) AS Date_VoucherDate,
           CASE
               WHEN vp.VoucherID IS NOT NULL THEN
                   @Voucher
               WHEN sr.PreVoucherID IS NOT NULL THEN
                   @PreVoucher
               ELSE
                   @Submit
           END AS StatusString
    FROM STC.StockReceipt AS sr
        INNER JOIN STF.Stock s
            ON s.StockID = sr.StockID
        JOIN [STC].[StockDocumentTypeBaseEntity] sdtb
            ON sr.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
        JOIN STC.StockDocumentType sdt
            ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
        LEFT JOIN
        (
            SELECT PrevoucherID,
                   VoucherID
            FROM ACC.VoucherPrevoucher
            GROUP BY PrevoucherID,
                     VoucherID
        ) vp
            ON vp.PrevoucherID = sr.PreVoucherID
        LEFT JOIN ACC.Voucher v
            ON v.VoucherID = vp.VoucherID
    WHERE @DlID IS NOT NULL
          AND sr.DeliverDlID = @DlID
          AND sr.Date
          BETWEEN @FromDate AND @ToDate;
END;

IF (@EntityName = 'ReturnedTemporaryOutgoing')
BEGIN
    SELECT r.ReturnedTemporaryOutgoingID ID,
           r.Number,
           r.[Date],
           r.ReturnedTemporaryOutgoingID EntityID,
           'ReturnedTemporaryOutgoing' EngName,
           'StockManager' ModuleKey,
           CFG.GetCLRSaturnDate(r.[Date], @DateFormat, 0, @DateType) AS Date_Date,
           CASE
               WHEN @CultureNo = 1 THEN
                   st.Title
               WHEN @CultureNo = 2 THEN
                   st.Title2
           END AS StockName,
           st.Code AS StockCode
    FROM STC.ReturnedTemporaryOutgoing r
        JOIN STF.Stock st
            ON r.StockID = st.StockID
    WHERE @DlID IS NOT NULL
          AND r.DlID = @DlID
          AND r.Date
          BETWEEN @FromDate AND @ToDate;
END;

IF (@EntityName = 'TemporaryStockReceipt')
BEGIN
    SELECT tsr.TemporaryStockReceiptID ID,
           CASE
               WHEN @CultureNo = 1 THEN
                   sdt.Title
               WHEN @CultureNo = 2 THEN
                   sdt.Title2
           END AS TypeString,
           CASE sdtb.BaseEntity
               WHEN 1 THEN
                   @WithOutbase
               WHEN 2 THEN
                   @PurchaseRequest
               WHEN 3 THEN
                   @Proposal
               WHEN 8 THEN
                   @PurchaseContract
           END BaseDocumentName,
           tsr.Number,
           tsr.[Date],
           CFG.GetCLRSaturnDate(tsr.[Date], @DateFormat, 0, @DateType) Date_Date,
           tsr.TemporaryStockReceiptID EntityID,
           'TemporaryStockReceipt' EngName,
           'StockManager' ModuleKey,
           s.Code StockCode,
           CASE
               WHEN @CultureNo = 1 THEN
                   s.Title
               WHEN @CultureNo = 2 THEN
                   s.Title2
           END AS StockName
    FROM STC.TemporaryStockReceipt tsr
         JOIN STC.StockDocumentTypeBaseEntity sdtb
            ON tsr.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
        JOIN STC.StockDocumentType sdt
            ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
        JOIN STF.Stock s
            ON s.StockID = tsr.StockID
        LEFT JOIN ACC.DL d
            ON d.DLID = tsr.DeliverDlID
    WHERE @DlID IS NOT NULL
          AND tsr.DeliverDlID = @DlID
          AND tsr.Date
          BETWEEN @FromDate AND @ToDate;
END;

IF (@EntityName = 'PurchaseInvoice')
BEGIN
    SELECT p.PurchaseInvoiceID ID,
           p.Number,
           p.InvoiceNumber,
           p.CurrencyRate,
           CASE
               WHEN @CultureNo = 1 THEN
                   c.Title
               WHEN @CultureNo = 2 THEN
                   c.Title2
           END AS CurrencyName,
           p.TotalNetPrice Amount,
           p.PurchaseInvoiceID EntityID,
           'PurchaseInvoice' EngName,
           'VendorManager' ModuleKey,
           p.[Date],
           CFG.GetCLRSaturnDate(p.[Date], @DateFormat, 0, @DateType) AS Date_Date,
           p.InvoiceDate,
           CFG.GetCLRSaturnDate(p.InvoiceDate, @DateFormat, 0, @DateType) AS Date_InvoiceDate,
           v.[Date] AS VoucherDate,
           CFG.GetCLRSaturnDate(v.[Date], @DateFormat, 0, @DateType) AS Date_VoucherDate,
           b.Code AS BranchCode,
           CASE
               WHEN @CultureNo = 1 THEN
                   b.Title
               WHEN @CultureNo = 2 THEN
                   b.Title2
           END AS BranchName,
           CASE
               WHEN @CultureNo = 1 THEN
                   pt.Title
               WHEN @CultureNo = 2 THEN
                   pt.Title2
           END AS TypeString,
           ISNULL(ppr.PrePayment, 0) AS PrePayment,
           v.ReferenceNumber AS VoucherNumber,
           CAST(CASE
                    WHEN vp.VoucherID IS NOT NULL THEN
                        @Voucher
                    WHEN p.PreVoucherID IS NOT NULL THEN
                        @PreVoucher
                    ELSE
                        @Submit
                END AS NVARCHAR(512)) AS StatusString,
           CAST(CASE p.BaseType
                    WHEN 1 THEN
                        @WithOutbase
                    WHEN 2 THEN
                        @PurchaseRequest
                    WHEN 3 THEN
                        @Contract
                    WHEN 4 THEN
                        @ContractStatement
                    WHEN 5 THEN
                        @Proposal
                    WHEN 6 THEN
                        @StockReceipt
                    WHEN 8 THEN
                        @PurchaseContract
                    WHEN 9 THEN
                        'پروفرما'
                END AS NVARCHAR(512)) AS BaseTypeString
    FROM VND.PurchaseInvoice p
        JOIN VND.PurchaseType AS pt
            ON pt.PurchaseTypeID = p.[Type]
        LEFT JOIN
        (
            SELECT pipp.PurchaseInvoiceID,
                   SUM(pipp.Price) AS PrePayment
            FROM VND.PurchaseInvoicePrePayment AS pipp
            GROUP BY pipp.PurchaseInvoiceID
        ) ppr
            ON ppr.PurchaseInvoiceID = p.PurchaseInvoiceID
        JOIN CFG.Branch b
            ON b.BranchID = p.BranchID
        JOIN CFG.Currency c
            ON c.CurrencyID = p.CurrencyID
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
    WHERE @DlID IS NOT NULL
          AND p.DlID = @DlID
          AND p.Date
          BETWEEN @FromDate AND @ToDate;
END;

IF (@EntityName = 'Outgoing')
BEGIN
    SELECT OutgoingID ID,
           o.Number,
           o.[Date],
           TotalPrice Amount,
           s.Code StockCode,
           CASE
               WHEN @CultureNo = 1 THEN
                   s.Title
               WHEN @CultureNo = 2 THEN
                   s.Title2
           END AS StockName,
           OutgoingID EntityID,
           'AmountOutgoing' EngName,
           'StockManager' ModuleKey,
           CFG.GetCLRSaturnDate(o.[Date], @DateFormat, 0, @DateType) AS Date_Date,
           CASE
               WHEN @CultureNo = 1 THEN
                   sdt.Title
               WHEN @CultureNo = 2 THEN
                   sdt.Title2
           END AS TypeString,
           v.ReferenceNumber AS VoucherNumber,
           v.[Date] AS VoucherDate,
           CFG.GetCLRSaturnDate(v.[Date], @DateFormat, 0, @DateType) AS Date_VoucherDate,
           CASE
               WHEN vp.VoucherID IS NOT NULL THEN
                   @Voucher
               WHEN o.PreVoucherID IS NOT NULL THEN
                   @PreVoucher
               ELSE
                   @Submit
           END AS StatusString,
           CASE sdtb.BaseEntity
               WHEN 2 THEN
                   @StuffRequest
               WHEN 3 THEN
                   @Justification
               WHEN 4 THEN
                   @Quotation
               WHEN 5 THEN
                   @Remittance
               WHEN 6 THEN
                   @Invoice
               WHEN 7 THEN
                   @TemporaryOutgoing
               WHEN 8 THEN
                   @Reception
               WHEN 9 THEN
                   'قرارداد فروش'
               ELSE
                   @WithOutbase
           END AS BaseTypeString
    FROM STC.Outgoing o
        JOIN [STC].[StockDocumentTypeBaseEntity] sdtb 
            ON o.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
        INNER JOIN STF.Stock s
            ON s.StockID = o.StockID
        JOIN STC.StockDocumentType sdt
            ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
        LEFT JOIN ACC.DL d
            ON d.DLID = o.DeliverDlID
        LEFT JOIN STF.Stock ds
            ON ds.StockID = o.DeliverStockID
        LEFT JOIN
        (
            SELECT PrevoucherID,
                   VoucherID
            FROM ACC.VoucherPrevoucher
            GROUP BY PrevoucherID,
                     VoucherID
        ) vp
            ON vp.PrevoucherID = o.PreVoucherID
        LEFT JOIN ACC.Voucher v
            ON v.VoucherID = vp.VoucherID
    WHERE @DlID IS NOT NULL
          AND o.DeliverDlID = @DlID
          AND o.Date
          BETWEEN @FromDate AND @ToDate;
END;

IF (@EntityName = 'ReturnInvoice')
BEGIN
    SELECT ri.ReturnInvoiceID ID,
           ri.Number,
           ri.Date,
           CASE
               WHEN @CultureNo = 1 THEN
                   c.Title
               WHEN @CultureNo = 2 THEN
                   c.Title2
           END AS CurrencyName,
           ri.CurrencyRate,
           ri.TotalNetPrice Amount,
           ri.ReturnInvoiceID EntityID,
           'ReturnInvoice' EngName,
           'VendorManager' ModuleKey,
           CASE
               WHEN @CultureNo = 1 THEN
                   b.Title
               WHEN @CultureNo = 2 THEN
                   b.Title2
           END AS BranchName,
           b.Code AS BranchCode,
           CASE
               WHEN @CultureNo = 1 THEN
                   pt.Title
               WHEN @CultureNo = 2 THEN
                   pt.Title2
           END AS TypeString,
           CFG.GetCLRSaturnDate(ri.[Date], @DateFormat, 0, @DateType) AS Date_Date,
           v.ReferenceNumber AS VoucherNumber,
           v.Date AS VoucherDate,
           CFG.GetCLRSaturnDate(v.Date, @DateFormat, 0, @DateType) AS Date_VoucherDate,
           CASE
               WHEN vp.VoucherID IS NOT NULL THEN
                   @Voucher
               WHEN ri.PreVoucherID IS NOT NULL THEN
                   @PreVoucher
               ELSE
                   @Submit
           END AS StatusString
    FROM VND.ReturnInvoice ri
        JOIN VND.PurchaseType AS pt
            ON pt.PurchaseTypeID = ri.[Type]
        JOIN CFG.Branch b
            ON b.BranchID = ri.BranchID
        LEFT JOIN CFG.Currency c
            ON c.CurrencyID = ri.CurrencyID
        LEFT JOIN ACC.PreVoucher p
            ON p.PreVoucherID = ri.PreVoucherID
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
    WHERE @DlID IS NOT NULL
          AND ri.DlID = @DlID
          AND ri.Date
          BETWEEN @FromDate AND @ToDate;
END;

IF (@EntityName = 'ReturnStockReceipt')
BEGIN
    SELECT r.ReturnStockReceiptID ID,
           CASE
               WHEN @CultureNo = 1 THEN
                   s.Title
               WHEN @CultureNo = 2 THEN
                   s.Title2
           END AS TypeString,
           r.Number,
           r.ReturnStockReceiptID EntityID,
           'ReturnAmountReceipt' EngName,
           'StockManager' ModuleKey,
           r.TotalInvoicePrice Amount,
           st.Code StockCode,
           CASE
               WHEN @CultureNo = 1 THEN
                   st.Title
               WHEN @CultureNo = 2 THEN
                   st.Title2
           END AS StockName,
           r.Date,
           CFG.GetCLRSaturnDate(r.[Date], @DateFormat, 0, @DateType) AS Date_Date,
           v.ReferenceNumber AS VoucherNumber,
           v.[Date] AS VoucherDate,
           CFG.GetCLRSaturnDate(v.[Date], @DateFormat, 0, @DateType) AS Date_VoucherDate,
           CASE
               WHEN vp.VoucherID IS NOT NULL THEN
                   @Voucher
               WHEN r.PreVoucherID IS NOT NULL THEN
                   @PreVoucher
               ELSE
                   @Submit
           END AS StatusString
    FROM STC.ReturnStockReceipt r
        JOIN [STC].[StockDocumentTypeBaseEntity] sdtb
            ON r.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
        JOIN STC.StockDocumentType s
            ON sdtb.StockDocumentTypeID = s.StockDocumentTypeID
        JOIN STF.Stock st
            ON r.StockID = st.StockID
        LEFT JOIN ACC.PreVoucher p
            ON p.PreVoucherID = r.PreVoucherID
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
    WHERE @DlID IS NOT NULL
          AND r.DeliverDlID = @DlID
          AND r.Date
          BETWEEN @FromDate AND @ToDate;
END;

IF (@EntityName = 'TemporaryOutgoing')
BEGIN
    SELECT t.TemporaryOutgoingID ID,
           t.Number,
           t.[Date],
           CFG.GetCLRSaturnDate(t.[Date], @DateFormat, 0, @DateType) AS Date_Date,
           t.TemporaryOutgoingID EntityID,
           'TemporaryOutgoing' EngName,
           'StockManager' ModuleKey,
           CASE
               WHEN @CultureNo = 1 THEN
                   st.Title
               WHEN @CultureNo = 2 THEN
                   st.Title2
           END AS StockName,
           st.Code AS StockCode
    FROM STC.TemporaryOutgoing t
        JOIN STF.Stock st
            ON t.StockID = st.StockID
    WHERE @DlID IS NOT NULL
          AND t.DlID = @DlID
          AND t.Date
          BETWEEN @FromDate AND @ToDate;
END;

IF (@EntityName = 'ReturnedTemporaryStockReceipt')
BEGIN
    SELECT rtsr.ReturnedTemporaryStockReceiptID ID,
           CASE sdtb.BaseEntity
               WHEN 1 THEN
                   @WithOutbase
               WHEN 4 THEN
                   @TempReceipt
               WHEN 5 THEN
                   @ReturnRequest
           END BaseDocumentString,
           rtsr.Number,
           rtsr.[Date],
           CFG.GetCLRSaturnDate(rtsr.[Date], @DateFormat, 0, @DateType) Date_Date,
           rtsr.ReturnedTemporaryStockReceiptID EntityID,
           'ReturnedTemporaryStockReceipt' EngName,
           'StockManager' ModuleKey,
           s.Code StockCode,
           CASE
               WHEN @CultureNo = 1 THEN
                   s.Title
               WHEN @CultureNo = 2 THEN
                   s.Title2
           END AS StockName
    FROM STC.ReturnedTemporaryStockReceipt rtsr
	     JOIN STC.StockDocumentTypeBaseEntity sdtb
			ON rtsr.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
        JOIN STC.StockDocumentType sdt
            ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
        JOIN STF.Stock s
            ON s.StockID = rtsr.StockID
    WHERE @DlID IS NOT NULL
          AND rtsr.DeliverDlID = @DlID
          AND rtsr.Date
          BETWEEN @FromDate AND @ToDate;
END;

IF (@EntityName = 'PurchaseContract')
BEGIN
    SELECT c.PurchaseContractID ID,
           c.Number,
           c.Date,
           c.PurchaseContractID EntityID,
           'PurchaseContract' EngName,
           'VendorManager' ModuleKey,
           CASE
               WHEN @CultureNo = 1 THEN
                   cu.Title
               WHEN @CultureNo = 2 THEN
                   cu.Title2
           END AS CurrencyName,
           CFG.GetCLRSaturnDate(c.[Date], @DateFormat, 0, @DateType) Date_Date,
           b.Code BranchCode,
           CASE
               WHEN @CultureNo = 1 THEN
                   b.Title
               WHEN @CultureNo = 2 THEN
                   b.Title2
           END AS BranchName,
           (
               SELECT CASE
                          WHEN @CultureNo = 1 THEN
                              Title
                          WHEN @CultureNo = 2 THEN
                              Title2
                      END AS Title
               FROM VND.PurchaseType
               WHERE PurchaseTypeID = c.[Type]
           ) TypeString,
           c.TotalNetPrice Amount
    FROM VND.PurchaseContract c
        JOIN CFG.Currency cu
            ON c.CurrencyID = cu.CurrencyID
        JOIN CFG.Branch b
            ON c.BranchID = b.BranchID
    WHERE @DlID IS NOT NULL
          AND c.DlID = @DlID
          AND c.Date
          BETWEEN @FromDate AND @ToDate;
END;

IF (@EntityName = 'ReceiveSubject')
BEGIN
    SELECT s.ReceiveSubjectID ID,
           s.ReceiveReceiptID,
           r.Number,
           r.Date,
           CFG.GetCLRSaturnDate(r.[Date], @DateFormat, 0, @DateType) Date_Date,
           s.ReceiveReceiptID EntityID,
           'ReceiveReceipt' EngName,
           'FinanceManager' ModuleKey,
           CASE
               WHEN @CultureNo = 1 THEN
                   t.Title
               WHEN @CultureNo = 2 THEN
                   t.Title2
           END AS TypeString,
           CASE
               WHEN @CultureNo = 1 THEN
                   c.Title
               WHEN @CultureNo = 2 THEN
                   c.Title2
           END AS CurrencyName,
           s.CurrencyRate,
           s.Amount,
           s.Discount
    FROM FIN.ReceiveSubject s
        JOIN FIN.ReceiveReceipt r
            ON s.ReceiveReceiptID = r.ReceiveReceiptID
        JOIN FIN.ReceiptType t
            ON s.ReceiptTypeID = t.ReceiptTypeID
        JOIN CFG.Currency c
            ON s.CurrencyID = c.CurrencyID
    WHERE @DlID IS NOT NULL
          AND s.DLID = @DlID
          AND r.Date
          BETWEEN @FromDate AND @ToDate;
END;

IF (@EntityName = 'PaymentSubject')
BEGIN
    SELECT s.PaymentSubjectID ID,
           s.PaymentReceiptID,
           r.Number,
           r.Date,
           CFG.GetCLRSaturnDate(r.[Date], @DateFormat, 0, @DateType) Date_Date,
           s.PaymentReceiptID EntityID,
           'PaymentReceipt' EngName,
           'FinanceManager' ModuleKey,
           CASE
               WHEN @CultureNo = 1 THEN
                   t.Title
               WHEN @CultureNo = 2 THEN
                   t.Title2
           END AS TypeString,
           CASE
               WHEN @CultureNo = 1 THEN
                   c.Title
               WHEN @CultureNo = 2 THEN
                   c.Title2
           END AS CurrencyName,
           s.CurrencyRate,
           s.Amount,
           s.Discount
    FROM FIN.PaymentSubject s
        JOIN FIN.PaymentReceipt r
            ON s.PaymentReceiptID = r.PaymentReceiptID
        JOIN FIN.PaymentType t
            ON s.PaymentTypeID = t.PaymentTypeID
        JOIN CFG.Currency c
            ON s.CurrencyID = c.CurrencyID
    WHERE @DlID IS NOT NULL
          AND s.DLID = @DlID
          AND r.Date
          BETWEEN @FromDate AND @ToDate;
END;


IF (@EntityName = 'PettyCashCost')
BEGIN
    SELECT pcci.PettyCashCostItemID ID,
           pcc.PettyCashCostID,
          pcc.Number,
           pcc.[Date],
           CFG.GetCLRSaturnDate(pcc.[Date], @DateFormat, 0, @DateType) Date_Date,
           pcc.PettyCashCostID EntityID,
           'PettyCashCost' EngName,
           'FinanceManager' ModuleKey,
           CASE
               WHEN @CultureNo = 1 THEN
                   pt.Title
               WHEN @CultureNo = 2 THEN
                   pt.Title2
           END AS TypeString,
           CASE
               WHEN @CultureNo = 1 THEN
                   c.Title
               WHEN @CultureNo = 2 THEN
                   c.Title2
           END AS CurrencyName,
           pcc.CurrencyRate,
           pcci.Amount,
           0 As Discount
    FROM FIN.PettyCashCost AS pcc
    join fin.PettyCashCostItem AS pcci on pcci.PettyCashCostID = pcc.PettyCashCostID
    join fin.PaymentType AS pt on pt.PaymentTypeID = pcci.PaymentTypeID
    join fin.PettyCash AS pc on pc.PettyCashID = pcc.PettyCashID
    join cfg.Currency AS c on c.CurrencyID = pc.CurrencyID
    WHERE @DlID IS NOT NULL
          AND pcci.PartyID = @PartyID
          AND pcc.Date
          BETWEEN @FromDate AND @ToDate;
END;

