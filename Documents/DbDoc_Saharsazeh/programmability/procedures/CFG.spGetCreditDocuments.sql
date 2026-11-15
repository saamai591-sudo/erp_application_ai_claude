
------------------------------------------------
CREATE   PROCEDURE [CFG].spGetCreditDocuments
(
   -- @Type TINYINT,
    @BranchID INT,
    @PartyId BIGINT = NULL,
    @date DATE,
    @ReceiptTypeID INT = NULL,
    @PaymentTypeID INT = NULL
)
--WITH ENCRYPTION
AS
BEGIN
    DECLARE @UserID                   INT,
            @DateType                 TINYINT,
            @DateFormat               VARCHAR(10),
            @QuotationConfigValue     VARCHAR(10),
            @InvoiceConfigValue       VARCHAR(10),
            @DlID                     BIGINT = NULL,
            @Culture                  NVARCHAR(10),
            @PaymentType              INT,
            @ReceiptType              INT,
			@ConfirmPurchaseInvoice NVARCHAR(50)
            
    SET @Culture = CFG.GetuserCulture();

    SELECT @DlID = DlID
    FROM CFG.Party
    WHERE PartyID = @PartyId;

    SET @UserID = CFG.GetuserID();

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
              
    SELECT @PaymentType = pt.Type
	FROM   fin.PaymentType AS pt
	WHERE  pt.PaymentTypeID = @PaymentTypeID

	SELECT @ReceiptType = rt.Type
	FROM   fin.ReceiptType AS rt
	WHERE  rt.ReceiptTypeID = @ReceiptTypeID

    --Transition
    BEGIN
        DECLARE @PurchaseInvoice NVARCHAR(100),
                @SaleContract NVARCHAR(100),
                @Quotation NVARCHAR(100),
                @Invoice NVARCHAR(100),
                @ConfirmStatement NVARCHAR(100),
                @ConfirmStatementItem NVARCHAR(100),
                @ContractStatement NVARCHAR(100);

        SELECT @PurchaseInvoice = lev.Value
        FROM CFG.LocalizeEnum le
            JOIN CFG.LocalizeEnumValue lev
                ON lev.LocalizeEnumID = le.LocalizeEnumID
        WHERE le.Enum = 'BaseDocuments'
              AND le.Item = 'PurchaseInvoice'
              AND lev.Culture = @Culture;

        SELECT @SaleContract = lev.Value
        FROM CFG.LocalizeEnum le
            JOIN CFG.LocalizeEnumValue lev
                ON lev.LocalizeEnumID = le.LocalizeEnumID
        WHERE le.Enum = 'OutgoingBaseTypes'
              AND lev.Culture = @Culture
              AND le.Item = 'SaleContract';

        SELECT @Quotation = lev.Value
        FROM CFG.LocalizeEnum le
            JOIN CFG.LocalizeEnumValue lev
                ON lev.LocalizeEnumID = le.LocalizeEnumID
        WHERE le.Enum = 'DocumentNumTypes'
              AND le.Item = 'Quotation'
              AND lev.Culture = @Culture;

        SELECT @Invoice = lev.Value
        FROM CFG.LocalizeEnum le
            JOIN CFG.LocalizeEnumValue lev
                ON lev.LocalizeEnumID = le.LocalizeEnumID
        WHERE le.Enum = 'BaseDocuments'
              AND le.Item = 'Invoice'
              AND lev.Culture = @Culture;

        SELECT @ConfirmStatement = lev.Value
        FROM CFG.LocalizeEnum le
            JOIN CFG.LocalizeEnumValue lev
                ON lev.LocalizeEnumID = le.LocalizeEnumID
        WHERE le.Enum = 'BaseDocuments'
              AND le.Item = 'ConfirmStatement'
              AND lev.Culture = @Culture;

        SELECT @ConfirmStatementItem = lev.Value
        FROM CFG.LocalizeEnum le
            JOIN CFG.LocalizeEnumValue lev
                ON lev.LocalizeEnumID = le.LocalizeEnumID
        WHERE le.Enum = 'BaseDocuments'
              AND le.Item = 'ConfirmStatementItem'
              AND lev.Culture = @Culture;

        SELECT @ContractStatement = lev.Value
        FROM CFG.LocalizeEnum le
            JOIN CFG.LocalizeEnumValue lev
                ON lev.LocalizeEnumID = le.LocalizeEnumID
        WHERE le.Enum = 'BaseDocuments'
              AND le.Item = 'ContractStatement'
              AND lev.Culture = @Culture;
    END;

    SELECT @QuotationConfigValue = LOWER(ConfigValue)
    FROM CFG.Configuration
    WHERE ConfigKey = 'QuotationNeedConfirm';

    SELECT @InvoiceConfigValue = LOWER(ConfigValue)
    FROM CFG.Configuration
    WHERE ConfigKey = 'InvoiceNeedConfirm';

	    SELECT @ConfirmPurchaseInvoice = lev.[Value]
	FROM   cfg.LocalizeEnum le
	       JOIN cfg.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'BaseDocuments'
	       AND le.Item = 'ConfirmPurchaseInvoice'
	       AND lev.Culture = @Culture

	-------- پیش دریافت
    IF @ReceiptType = 1
    BEGIN
        SELECT 'Sc_' + CAST(s.SaleContractID AS VARCHAR(100)) AS DocumentId,
               'SaleContract' AS DocumentType,
			   CAST(0 AS DECIMAL) NetPay,
               @SaleContract AS DocumentName,
               CAST(s.Number AS VARCHAR(100)) Number,
               CFG.GetCLRSaturnDate(s.Date, @DateFormat, 0, @DateType) DateString,
               s.CurrencyID,
               ISNULL(cr.Rate, 1) AS CurrencyRate,
               r.UnpaidBalance AS Non_Received
        FROM SLE.SaleContract s
            JOIN SLE.SaleContract_UnpaidBalance r
                ON s.SaleContractID = r.SaleContractID
            LEFT JOIN
            (
                SELECT tcr.CurrencyID,
                       tcr.Rate
                FROM
                (
                    SELECT CurrencyID,
                           Rate,
                           ROW_NUMBER() OVER (PARTITION BY CurrencyID ORDER BY Date DESC) AS rowNum
                    FROM CFG.CurrencyRate
                ) tcr
                WHERE tcr.rowNum = 1
                UNION
                SELECT -1 AS CurrencyID,
                       1 AS Rate
            ) cr
                ON s.CurrencyID = cr.CurrencyID
        WHERE s.BranchID = @BranchID
              AND r.UnpaidBalance > 0
              AND s.CustomerID = @PartyId
              AND s.Date <= @date
        UNION
        SELECT 'Qu_' + CAST(q.QuotationID AS VARCHAR(100)) AS DocumentId,
               'Quotation' AS DocumentType,
			   CAST(0 AS DECIMAL) NetPay,
               @Quotation AS DocumentName,
               CAST(q.Number AS VARCHAR(100)) Number,
               CFG.GetCLRSaturnDate(q.Date, @DateFormat, 0, @DateType) DateString,
               q.CurrencyID,
               ISNULL(cr.Rate, 1) AS CurrencyRate,
               r.UnpaidBalance AS Non_Received
        FROM SLE.Quotation q
            JOIN SLE.Quotation_UnpaidBalance r
                ON q.QuotationID = r.QuotationID
            LEFT JOIN
            (
                SELECT tcr.CurrencyID,
                       tcr.Rate
                FROM
                (
                    SELECT CurrencyID,
                           Rate,
                           ROW_NUMBER() OVER (PARTITION BY CurrencyID ORDER BY Date DESC) AS rowNum
                    FROM CFG.CurrencyRate
                ) tcr
                WHERE tcr.rowNum = 1
                UNION
                SELECT -1 AS CurrencyID,
                       1 AS Rate
            ) cr
                ON q.CurrencyID = cr.CurrencyID
        WHERE q.BranchID = @BranchID
              AND r.UnpaidBalance > 0
              AND q.Status <> 2
              AND
              (
                  @QuotationConfigValue <> 'true'
                  OR q.Status = 3
              )
              AND q.CustomerID = @PartyId
              AND q.Date <= @date
        UNION
        SELECT 'cn_' + CAST(c.ContractID AS NVARCHAR(100)) AS DocumentId,
               'Contract' AS DocumentType,
			   CAST(0 AS DECIMAL) NetPay,
               N'قرارداد' + CAST(c.Number AS VARCHAR(50)) DocumentName,
               CAST(c.Number AS VARCHAR(100)) Number,
               CFG.GetCLRSaturnDate(c.Date, @DateFormat, 0, @DateType) DateString,
               vcr.CurrencyID,
               1 AS CurrencyRate,
               vcr.Remain AS Non_Received
        FROM CNT.Contract AS c
            JOIN CNT.vwContractRemain AS vcr
                ON vcr.ContractID = c.ContractID
        WHERE vcr.Remain > 0
              AND c.PartyID = @PartyId
              AND @BranchID = @BranchID
              AND c.Date <= @date
              AND c.Status = 2
    END;

	--تسویه مشتری
    IF @ReceiptType = 2
    BEGIN
        SELECT 'In_' + CAST(i.InvoiceID AS VARCHAR(100)) AS DocumentId,
               'Invoice' AS DocumentType,
			   CAST(0 AS DECIMAL) NetPay,
               @Invoice AS DocumentName,
               CAST(i.Number AS VARCHAR(100)) Number,
               CFG.GetCLRSaturnDate(i.Date, @DateFormat, 0, @DateType) DateString,
               i.CurrencyID,
               i.CurrencyRate,
               r.NonReceived AS Non_Received
        FROM SLE.Invoice i
            JOIN SLE.Invoice_NonReceived r
                ON i.InvoiceID = r.InvoiceID
        WHERE i.BranchID = @BranchID
              AND r.NonReceived > 0
              AND i.SaleInvoiceStatus <> 5
              AND
              (
                  @InvoiceConfigValue <> 'true'
                  OR i.SaleInvoiceStatus = 2
              )
              AND i.CustomerID = @PartyId
              AND i.Date <= @date
        UNION ALL
        SELECT 'cs_' + CAST(cs.ConfirmStatementID AS NVARCHAR(100)) DocumentId,
               'ConfirmStatement' DocumentType,
			   CAST(0 AS DECIMAL) NetPay,
               @ConfirmStatement DocumentName,
               CAST(cs.Number AS VARCHAR(100)) Number,
               CFG.GetCLRSaturnDate(cs.[Date], @DateFormat, 0, @DateType) DateString,
               vw.CurrencyID,
               cs.CurrencyRate,
               vw.Remain AS Non_Received
        FROM CNT.ConfirmStatement cs
        JOIN CNT.[Contract] c
            ON cs.ContractID = c.ContractID
        JOIN CFG.Party p
            ON c.PartyID = p.PartyID
        JOIN CNT.vwConfirmStatementRemain vw
            ON vw.ConfirmStatementID = cs.ConfirmStatementID
        WHERE c.BranchID = @BranchID
              AND p.DlID = @DlID
              AND c.Date <= @date
              AND vw.Remain > 0
              AND c.CompanyRoll = 2
        UNION ALL
        SELECT 'si_' + CAST(csi.ConfirmStatementItemID AS NVARCHAR(100)) DocumentId,
               'ConfirmStatementItem' DocumentType,
			   CAST(0 AS DECIMAL) NetPay,
               @ConfirmStatementItem DocumentName,
               CASE
                   WHEN c.ContractID IS NOT NULL THEN
                       c.Number
                   ELSE
                       ISNULL(pi.InvoiceNumber, pi.Number)
               END Number,
               CFG.GetCLRSaturnDate(   CASE
                                           WHEN c.ContractID IS NOT NULL THEN
                                               c.Date
                                           ELSE
                                               ISNULL(pi.Date, pi.Date)
                                       END,
                                       @DateFormat,
                                       0,
                                       @DateType
                                   ) DateString,
               ISNULL(cs1.CurrencyID,pi.CurrencyID) CurrencyID,
			   ISNULL(cs.CurrencyRate,pi.CurrencyRate) CurrencyRate,
               vw.Remain AS Non_Received
        FROM CNT.ConfirmStatementItem csi
            JOIN CNT.AdditionDeductionType adt
                ON adt.AdditionDeductionTypeID = csi.AdditionDeductionTypeID
            LEFT JOIN CNT.ConfirmStatement cs
                ON csi.ConfirmStatementID = cs.ConfirmStatementID
            LEFT JOIN VND.PurchaseInvoice pi
                ON pi.PurchaseInvoiceID = csi.PurchaseInvoiceID
            LEFT JOIN CNT.[Contract] c
                ON cs.ContractID = c.ContractID
            LEFT JOIN CNT.ContractStatement cs1
                ON cs1.ContractStatementID = cs.ContractStatementID
            LEFT JOIN CNT.ContractStatementDetail csd
                ON csd.ContractStatementDetailID = csi.BaseDocumentID
                   AND csi.BaseDocumentType = 3
            LEFT JOIN CFG.Party p
                ON CASE
                       WHEN csi.BaseDocumentType = 3 THEN
                           csd.PartyID
                       ELSE
                           cs1.PartyID
                   END = p.PartyID
            JOIN CNT.vwConfirmStatementItemRemain vw
                ON vw.ConfirmStatementItemID = csi.ConfirmStatementItemID
        WHERE (
                  (
                      c.ContractID IS NOT NULL
                      AND c.BranchID = @BranchID
                  )
                  OR pi.BranchID = @BranchID
              )
              AND
              (
                  (
                      pi.DlID IS NOT NULL
                      AND pi.DlID = @DlID
                  )
                  OR (p.DlID = @DlID)
              )
              AND
              (
                  (
                      c.ContractID IS NOT NULL
                      AND c.[Date] <= @date
                  )
                  OR pi.[Date] <= @date
              )
              AND adt.Payable = 1
              AND csi.Deduction > 0
              AND vw.Remain > 0
              AND
              (
                  c.ContractID IS NULL
                  OR c.CompanyRoll <= 2
              )
        UNION ALL
        SELECT 'st_' + CAST(cs.ContractStatementID AS NVARCHAR(100)) DocumentId,
               'ContractStatement' DocumentType,
			   CAST(0 AS DECIMAL) NetPay,
               @ContractStatement DocumentName,
               c.Number,
               CFG.GetCLRSaturnDate(c.Date, @DateFormat, 0, @DateType) DateString,
               -1 CurrencyID,
               1 AS CurrencyRate,
               vw.VatRemain AS Non_Received
        FROM CNT.ContractStatement cs
            JOIN CNT.[Contract] c
                ON cs.ContractID = c.ContractID
            JOIN CFG.Party p
                ON c.PartyID = p.PartyID
            JOIN CNT.vwContractStatementRemain vw
                ON vw.ContractStatementID = cs.ContractStatementID
        WHERE c.BranchID = @BranchID
              AND p.DlID = @DlID
              AND c.Date <= @date
              AND vw.VatRemain > 0
              AND c.CompanyRoll = 2;
    END;
	---- تسویه اقساط دریافتنی
    IF @ReceiptType = 3
    BEGIN
        DECLARE @BaseCurrencyRate DECIMAL(36, 10) = 1;

        SELECT 'Ip_' + CAST(i.InstallmentPaymentItemID AS VARCHAR(100)) AS DocumentId,
               'InstallmentPaymentItem' AS DocumentType,
			   CAST(0 AS DECIMAL) NetPay,
               N'اقساط فاکتور شماره ' + CAST(i.Number AS VARCHAR(50)) DocumentName,
               CAST(i.Number AS VARCHAR(100)) Number,
               CFG.GetCLRSaturnDate(i.[Date], @DateFormat, 0, @DateType) DateString,
               -1 CurrencyID,
               @BaseCurrencyRate AS CurrencyRate,
               r.remain AS Non_Received
        FROM CFG.InstallmentPaymentItem i
            JOIN CFG.InstallmentPayment p
                ON i.InstallmentPaymentID = p.InstallmentPaymentID
            JOIN CFG.vwInstallmentPaymentRemain r
                ON i.InstallmentPaymentItemID = r.InstallmentPaymentItemID
        WHERE p.BranchId = @BranchID
              AND r.remain > 0
              AND p.PartyId = @PartyId;
    END;

    --از تامین کننده
    IF @ReceiptType = 4
    BEGIN
        SELECT 'Ri_' + CAST(r.ReturnInvoiceID AS VARCHAR(100)) AS DocumentId,
               'ReturnInvoice' AS DocumentType,
			   CAST(0 AS DECIMAL) NetPay,
               N'برگشت خرید' AS DocumentName,
               CAST(r.Number AS VARCHAR(100)) Number,
               CFG.GetCLRSaturnDate(r.Date, @DateFormat, 0, @DateType) DateString,
               r.CurrencyID,
               r.CurrencyRate,
               ri.NonReceived AS Non_Received
        FROM VND.ReturnInvoice r
        JOIN VND.ReturnInvoice_NonReceived ri
            ON r.ReturnInvoiceID = ri.ReturnInvoiceID
        WHERE r.BranchID = @BranchID
              AND ri.NonReceived > 0
              AND r.DlID = @DlID
              AND r.Date <= @date

		UNION ALL 

		SELECT 'Pi_' + CAST(p.PurchaseInvoiceID AS VARCHAR(100)) AS DocumentId,
               'PurchaseInvoice' AS DocumentType,
			   CAST(0 AS DECIMAL) NetPay,
               @PurchaseInvoice AS DocumentName,
               CASE
                   WHEN p.InvoiceNumber IS NOT NULL THEN
                       p.InvoiceNumber
                   ELSE
                       CAST(p.Number AS VARCHAR(100))
               END AS Number,
               CFG.GetCLRSaturnDate(p.Date, @DateFormat, 0, @DateType) DateString,
               p.CurrencyID,
               p.CurrencyRate,
               ABS(pa.NonPaymented) Non_Received
		FROM VND.PurchaseInvoice p
		JOIN VND.PurchaseInvoice_NonPaymented pa
			ON p.PurchaseInvoiceID = pa.PurchaseInvoiceID
        WHERE p.BranchID = @BranchID
              AND p.DlID = @DlID
              AND pa.NonPaymented < 0
              AND p.Status = 2
              AND p.Date <= @date

    END;

	--- پیش پرداخت
    IF @PaymentType = 10
    BEGIN
        SELECT 'Dc_' + CAST(i.DebitCreditNoteItemID AS VARCHAR(100)) AS DocumentId,
               'DebitCreditNoteItem' AS DocumentType,
			   CAST(0 AS DECIMAL) NetPay,
               N'بدهکار اعلامیه بدهکار بستانکار' AS DocumentName,
               CAST(dc.Number AS VARCHAR(100)) Number,
               CFG.GetCLRSaturnDate(dc.Date, @DateFormat, 0, @DateType) DateString,
               i.CurrencyID,
               i.CurrencyRate,
               r.remain AS Non_Received
        FROM CFG.DebitCreditNoteItem i
            JOIN CFG.DebitCreditNote dc
                ON i.DebitCreditNoteID = dc.DebitCreditNoteID
            LEFT JOIN FIN.PaymentType t
                ON i.PaymentTypeID = t.PaymentTypeID
            JOIN CFG.Debit_DebitCreditNoteItem_Remain r
                ON i.DebitCreditNoteItemID = r.DebitCreditNoteItemID
        WHERE dc.BranchID = @BranchID
              AND i.PaymentTypeID IS NOT NULL
              AND t.Type = 10
              AND r.remain > 0
              AND i.PartyID = @PartyId
              AND dc.Date <= @date
              AND i.Type = 0

        UNION ALL

        SELECT 'Ps_' + CAST(s.PaymentSubjectID AS VARCHAR(100)) AS DocumentId,
               'PaymentSubject' AS DocumentType,
			   CAST(0 AS DECIMAL) NetPay,
               N'موضوعات پرداخت' AS DocumentName,
               CAST(r.Number AS VARCHAR(100)) Number,
               CFG.GetCLRSaturnDate(r.Date, @DateFormat, 0, @DateType) DateString,
               s.CurrencyID,
               s.CurrencyRate,
               ps.NonPrice AS Non_Received
        FROM FIN.PaymentSubject s
            JOIN FIN.PaymentReceipt r
                ON s.PaymentReceiptID = r.PaymentReceiptID
            JOIN FIN.PaymentType t
                ON s.PaymentTypeID = t.PaymentTypeID
            JOIN FIN.PaymentSubject_PriceRemains ps
                ON s.PaymentSubjectID = ps.PaymentSubjectID
        WHERE r.BranchID = @BranchID
              AND t.Type = 10
              AND ps.NonPrice > 0
              AND s.DLID = @DlID
              AND r.Status <> 2
              AND r.Date <= @date

        UNION All

        SELECT 'Pe_' + CAST(i.PettyCashCostItemID AS VARCHAR(100)) AS DocumentId,
               'PettyCashCostItem' AS DocumentType,
			   CAST(0 AS DECIMAL) NetPay,
               N'صورتخلاصه تنخواه' AS DocumentName,
               CAST(p.Number AS VARCHAR(100)) Number,
               CFG.GetCLRSaturnDate(p.[Date], @DateFormat, 0, @DateType) DateString,
               pc.CurrencyID,
               pc.CurrencyRate,
               r.remain AS Non_Received
        FROM FIN.PettyCashCostItem i
            JOIN FIN.PettyCashCost p
                ON i.PettyCashCostID = p.PettyCashCostID
            JOIN FIN.PettyCash pc
                ON p.PettyCashID = pc.PettyCashID
            JOIN FIN.PaymentType t
                ON i.PaymentTypeID = t.PaymentTypeID
            JOIN FIN.PettyCashCostItem_Remain r
                ON i.PettyCashCostItemID = r.PettyCashCostItemID
            LEFT JOIN
            (
                SELECT ROW_NUMBER() OVER (PARTITION BY a.PettyCashCostItemID ORDER BY a.AccountLevelID) Rno,
                       a.PettyCashCostItemID,
                       a.DlID
                FROM FIN.PettyCashCostItemAccountLevel a
                    LEFT JOIN ACC.DL
                        ON DL.DLID = a.DlID
                           AND DlTypeID = 28
            ) a
                ON a.PettyCashCostItemID = i.PettyCashCostItemID
                   AND a.Rno = 1
        WHERE p.BranchID = @BranchID
              AND t.Type = 10
              AND r.remain > 0
              AND p.Date <= @date
              AND
              (
                  a.DlID IS NULL
                  OR a.DlID = @DlID
              );
    END;
	--- دریافت علی الحساب
    IF  @ReceiptType = 10
    BEGIN
        SELECT 'cn_' + CAST(c.ContractID AS NVARCHAR(100)) AS DocumentId,
               'Contract' AS DocumentType,
			   CAST(0 AS DECIMAL) NetPay,
               N'قرارداد' + CAST(c.Number AS NVARCHAR(50)) DocumentName,
               CAST(c.Number AS VARCHAR(100)) Number,
               vcr.CurrencyID,
              CAST(1 as DECIMAL) AS CurrencyRate,
               CFG.GetCLRSaturnDate(c.Date, @DateFormat, 0, @DateType) DateString,
               vcr.Remain AS Non_Received
        FROM CNT.Contract AS c
            JOIN CNT.vwContractRemain AS vcr
                ON vcr.ContractID = c.ContractID
        WHERE vcr.Remain > 0
              AND c.PartyID = @PartyId
              AND c.Date <= @date
              AND c.BranchID = @BranchID
              AND c.Status = 2
    END;

	--- استهلاک علی الحساب پرداختی

    IF @PaymentType = 12
    BEGIN

        SELECT 'Dc_' + CAST(i.DebitCreditNoteItemID AS VARCHAR(100)) AS DocumentId,
               'DebitCreditNoteItem' AS DocumentType,
			   CAST(0 AS DECIMAL) NetPay,
               N'بدهکار اعلامیه بدهکار بستانکار' AS DocumentName,
               CAST(dc.Number AS VARCHAR(100)) Number,
               CFG.GetCLRSaturnDate(dc.Date, @DateFormat, 0, @DateType) DateString,
               i.CurrencyID,
               i.CurrencyRate,
               r.remain AS Non_Received
        FROM CFG.DebitCreditNoteItem i
            JOIN CFG.DebitCreditNote dc
                ON i.DebitCreditNoteID = dc.DebitCreditNoteID
            LEFT JOIN FIN.PaymentType t
                ON i.PaymentTypeID = t.PaymentTypeID
            JOIN CFG.Debit_DebitCreditNoteItem_Remain r
                ON i.DebitCreditNoteItemID = r.DebitCreditNoteItemID
        WHERE dc.BranchID = @BranchID
              AND i.PaymentTypeID IS NOT NULL
              AND t.Type = 12
              AND r.remain > 0
              AND i.PartyID = @PartyId
              AND dc.Date <= @date
              AND i.Type = 0

        UNION ALL

        SELECT 'Ps_' + CAST(s.PaymentSubjectID AS VARCHAR(100)) AS DocumentId,
               'PaymentSubject' AS DocumentType,
			   CAST(0 AS DECIMAL) NetPay,
               N'موضوعات پرداخت' AS DocumentName,
               CAST(r.Number AS VARCHAR(100)) Number,
               CFG.GetCLRSaturnDate(r.Date, @DateFormat, 0, @DateType) DateString,
               s.CurrencyID,
               s.CurrencyRate,
               ps.NonPrice AS Non_Received
        FROM FIN.PaymentSubject s
            JOIN FIN.PaymentReceipt r
                ON s.PaymentReceiptID = r.PaymentReceiptID
            JOIN FIN.PaymentType t
                ON s.PaymentTypeID = t.PaymentTypeID
            JOIN FIN.PaymentSubject_PriceRemains ps
                ON s.PaymentSubjectID = ps.PaymentSubjectID
        WHERE r.BranchID = @BranchID
              AND t.Type = 12
              AND ps.NonPrice > 0
              AND s.DLID = @DlID
              AND r.Status <> 2
              AND r.Date <= @date

        UNION All

        SELECT 'Pe_' + CAST(i.PettyCashCostItemID AS VARCHAR(100)) AS DocumentId,
               'PettyCashCostItem' AS DocumentType,
			   CAST(0 AS DECIMAL) NetPay,
               N'صورتخلاصه تنخواه' AS DocumentName,
               CAST(p.Number AS VARCHAR(100)) Number,
               CFG.GetCLRSaturnDate(p.[Date], @DateFormat, 0, @DateType) DateString,
               pc.CurrencyID,
               pc.CurrencyRate,
               r.remain AS Non_Received
        FROM FIN.PettyCashCostItem i
            JOIN FIN.PettyCashCost p
                ON i.PettyCashCostID = p.PettyCashCostID
            JOIN FIN.PettyCash pc
                ON p.PettyCashID = pc.PettyCashID
            JOIN FIN.PaymentType t
                ON i.PaymentTypeID = t.PaymentTypeID
            JOIN FIN.PettyCashCostItem_Remain r
                ON i.PettyCashCostItemID = r.PettyCashCostItemID
            LEFT JOIN
            (
                SELECT ROW_NUMBER() OVER (PARTITION BY a.PettyCashCostItemID ORDER BY a.AccountLevelID) Rno,
                       a.PettyCashCostItemID,
                       a.DlID
                FROM FIN.PettyCashCostItemAccountLevel a
                    LEFT JOIN ACC.DL
                        ON DL.DLID = a.DlID
                           AND DlTypeID = 28
            ) a
                ON a.PettyCashCostItemID = i.PettyCashCostItemID
                   AND a.Rno = 1
        WHERE p.BranchID = @BranchID
              AND t.Type = 12
              AND r.remain > 0
              AND p.Date <= @date
              AND
              (
                  a.DlID IS NULL
                  OR a.DlID = @DlID
              );

    END;

END;
