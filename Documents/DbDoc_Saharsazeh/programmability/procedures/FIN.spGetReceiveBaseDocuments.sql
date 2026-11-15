
CREATE   PROCEDURE [FIN].spGetReceiveBaseDocuments
(
    @Type TINYINT,
    @BranchID INT,
    @DlID BIGINT = NULL,
    @Date DATE = NULL
)
--WITH ENCRYPTION
AS
BEGIN
    DECLARE @UserID INT,
            @DateType TINYINT,
            @DateFormat VARCHAR(10),
            @Sale NVARCHAR(100),
            @PurchaseInvoice NVARCHAR(100),
            @ReturnedPurchase NVARCHAR(100),
            @ConfirmStatement NVARCHAR(100),
            @ConfirmStatementItem NVARCHAR(100),
            @Contract NVARCHAR(100),
            @ContractStatement NVARCHAR(100),
            @ConfigValue VARCHAR(10),
            @Culture VARCHAR(10),
            @CultureNo TINYINT,
			@Quotation NVARCHAR(100),
			@SaleContract  NVARCHAR(100),
			@Installment NVARCHAR(100)

    SET @UserID = CFG.GetuserID();
    SET @Culture = cfg.GetuserCulture();

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

	BEGIN
    SELECT @Sale = lev.[Value]
    FROM cfg.LocalizeEnum le
        JOIN cfg.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'VatItemDocType'
          AND le.Item = 'Sale'
          AND lev.Culture = @Culture;

    SELECT @PurchaseInvoice = lev.[Value]
    FROM cfg.LocalizeEnum le
        JOIN cfg.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'DocumentNumTypes'
          AND le.Item = 'PurchaseInvoice'
          AND lev.Culture = @Culture

    SELECT @ReturnedPurchase = lev.[Value]
    FROM cfg.LocalizeEnum le
        JOIN cfg.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'VatItemDocType'
          AND le.Item = 'ReturnedPurchase'
          AND lev.Culture = @Culture;

    SELECT @ConfirmStatement = lev.[Value]
    FROM cfg.LocalizeEnum le
        JOIN cfg.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'BaseDocuments'
          AND le.Item = 'ConfirmStatement'
          AND lev.Culture = @Culture

    SELECT @ConfirmStatementItem = lev.[Value]
    FROM cfg.LocalizeEnum le
        JOIN cfg.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'BaseDocuments'
          AND le.Item = 'ConfirmStatementItem'
          AND lev.Culture = @Culture

    SELECT @Contract = lev.[Value]
    FROM cfg.LocalizeEnum le
        JOIN cfg.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'BaseDocuments'
          AND le.Item = 'Contract'
          AND lev.Culture = @Culture

    SELECT @ContractStatement = lev.[Value]
    FROM cfg.LocalizeEnum le
        JOIN cfg.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'BaseDocuments'
          AND le.Item = 'ContractStatement'
          AND lev.Culture = @Culture

	SELECT @Quotation = lev.[Value]
	FROM   cfg.LocalizeEnum le
	JOIN cfg.LocalizeEnumValue lev
	    ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'BaseDocuments'
	       AND le.Item = 'Quotation'
	       AND lev.Culture = @Culture

	SELECT @SaleContract = lev.[Value]
	FROM   cfg.LocalizeEnum le
	JOIN cfg.LocalizeEnumValue lev
	    ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'BaseDocuments'
	       AND le.Item = 'SaleContract'
	       AND lev.Culture = @Culture

	SELECT @Installment = lev.[Value]
	FROM   cfg.LocalizeEnum le
	JOIN cfg.LocalizeEnumValue lev
	    ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'BaseDocuments'
	       AND le.Item = 'Installment '
	       AND lev.Culture = @Culture
	END

    IF (@Type = 1)
    BEGIN

        SELECT @ConfigValue = LOWER(ConfigValue)
        FROM CFG.Configuration
        WHERE ConfigKey = 'QuotationNeedConfirm';

        SELECT 'qu_' + CAST(i.QuotationID AS NVARCHAR(100)) DocumentId,
               'Quotation' DocumentType,
               @Quotation DocumentName,
               CAST(i.Number AS VARCHAR(100)) Number,
               i.[Date] [Date],
               CFG.GetCLRSaturnDate(i.[Date], @DateFormat, 0, @DateType) DateString,
               i.CurrencyID CurrencyID,
               1 AS CurrencyRate,
               r.UnpaidBalance Non_Received
        FROM SLE.Quotation i
        JOIN CFG.Party p
            ON i.CustomerID = p.PartyID
        JOIN SLE.Quotation_UnpaidBalance r
            ON i.QuotationID = r.QuotationID
        WHERE i.BranchID = @BranchID
              AND p.DlID = @DlID
              AND
              (
                  @ConfigValue <> 'true'
                  OR i.[Status] = 3
              )
              AND i.[Status] <> 2
              AND
              (
                  @Date IS NULL
                  OR i.date <= @Date
              )
        
		UNION ALL

        SELECT 'sc_' + CAST(i.SaleContractID AS NVARCHAR(100)) DocumentId,
               'SaleContract' DocumentType,
               @SaleContract DocumentName,
               CAST(i.Number AS VARCHAR(100)) Number,
               i.[Date] [Date],
               CFG.GetCLRSaturnDate(i.[Date], @DateFormat, 0, @DateType) DateString,
               i.CurrencyID CurrencyID,
               1 AS CurrencyRate,
               r.UnpaidBalance Non_Received
        FROM SLE.SaleContract i
        JOIN CFG.Party p
            ON i.CustomerID = p.PartyID
        JOIN SLE.SaleContract_UnpaidBalance r
            ON i.SaleContractID = r.SaleContractID
        WHERE i.BranchID = @BranchID
              AND p.DlID = @DlID
              AND
              (
                  @Date IS NULL
                  OR i.date <= @Date
              )
        
		UNION ALL
		
		SELECT 'co_' + CAST(c.ContractID AS NVARCHAR(100)) DocumentId,
			   'Contract' DocumentType,
			   @Contract DocumentName,
			   c.Number,
			   c.[Date],
			   CFG.GetCLRSaturnDate(c.[Date], @DateFormat, 0, @DateType) DateString,
			   vw.CurrencyID,
			   1 AS CurrencyRate,
			   vw.Remain AS Non_Received
		FROM CNT.[Contract] c
		JOIN CFG.Party p
			ON c.PartyID = p.PartyID
		JOIN CNT.vwContractRemain vw
			ON vw.ContractID = c.ContractID
		WHERE c.BranchID = @BranchID
			  AND p.DlID = @DlID
			  AND c.[Date] <= @Date
			  and c.Status = 2

    END;

    IF (@Type = 2)
    BEGIN
        SELECT @ConfigValue = LOWER(s.ConfigValue)
        FROM CFG.Configuration s
        WHERE s.ConfigKey = 'InvoiceNeedConfirm';

        SELECT 'in_' + CAST(i.InvoiceID AS NVARCHAR(100)) DocumentId,
               'Invoice' DocumentType,
               @Sale DocumentName,
               CAST(i.Number AS VARCHAR(100)) Number,
               i.[Date] [Date],
               CFG.GetCLRSaturnDate(i.[Date], @DateFormat, 0, @DateType) DateString,
               i.CurrencyID CurrencyID,
               i.CurrencyRate,
               r.NonReceived Non_Received
        FROM SLE.Invoice i
            JOIN CFG.Party p
                ON i.CustomerID = p.PartyID
            JOIN SLE.Invoice_NonReceived r
                ON i.InvoiceID = r.InvoiceID
        WHERE i.BranchID = @BranchID
              AND p.DlID = @DlID
              AND
              (
                  @ConfigValue <> 'true'
                  OR i.SaleInvoiceStatus = 2
              )
              AND i.SaleInvoiceStatus <> 5
              AND
              (
                  @Date IS NULL
                  OR i.date <= @Date
              )
        
		UNION ALL

        SELECT 'st_' + CAST(cs.ConfirmStatementID AS NVARCHAR(100)) DocumentId,
               'ConfirmStatement' DocumentType,
               @ConfirmStatement + CAST(cst.Number AS VARCHAR(250)) DocumentName,
               c.Number,
               c.[Date],
               CFG.GetCLRSaturnDate(c.[Date], @DateFormat, 0, @DateType) DateString,
               vw.CurrencyID,
               cs.CurrencyRate,
               ABS(vw.Remain) AS Non_Received
        FROM CNT.ConfirmStatement cs
        JOIN CNT.[Contract] c
            ON cs.ContractID = c.ContractID
        JOIN CNT.ContractStatement cst
            ON cst.ContractStatementID = cs.ContractStatementID
        JOIN CFG.Party p
            ON c.PartyID = p.PartyID
        JOIN CNT.vwConfirmStatementRemain vw
            ON vw.ConfirmStatementID = cs.ConfirmStatementID
        WHERE c.BranchID = @BranchID
            AND p.DlID = @DlID
            AND c.[Date] <= @Date
			AND c.CompanyRoll = 2
		
		UNION ALL

        SELECT 'si_' + CAST(csi.ConfirmStatementItemID AS NVARCHAR(100)) DocumentId,
               'ConfirmStatementItem' DocumentType,
               CASE @CultureNo
                   WHEN 1 THEN
                       adt.Title
                   WHEN 2 THEN
                       adt.Title2
               END + @ConfirmStatementItem + CAST(cst.Number AS VARCHAR(250)) DocumentName,
               c.Number,
               c.[Date],
               CFG.GetCLRSaturnDate(c.[Date], @DateFormat, 0, @DateType) DateString,
               vw.CurrencyID,
               cs.CurrencyRate,
               vw.Remain AS Non_Received
        FROM CNT.ConfirmStatementItem csi
        JOIN cnt.AdditionDeductionType adt
            ON adt.AdditionDeductionTypeID = csi.AdditionDeductionTypeID
        JOIN CNT.ConfirmStatement cs
            ON csi.ConfirmStatementID = cs.ConfirmStatementID
        JOIN CNT.ContractStatement cst
            ON cst.ContractStatementID = cs.ContractStatementID
        JOIN CNT.[Contract] c
            ON cs.ContractID = c.ContractID
        JOIN CFG.Party p
            ON c.PartyID = p.PartyID
        JOIN CNT.vwConfirmStatementItemRemain vw
            ON vw.ConfirmStatementItemID = csi.ConfirmStatementItemID
        WHERE c.BranchID = @BranchID
              AND p.DlID = @DlID
              AND c.[Date] <= @Date
              AND adt.Payable = 1
              AND csi.Deduction > 0
			  AND c.CompanyRoll = 2

		UNION ALL

        SELECT 'ct_' + CAST(cs.ContractStatementID AS NVARCHAR(100)) DocumentId,
               'ContractStatement' DocumentType,
               @ContractStatement + @ConfirmStatement + CAST(cs.Number AS VARCHAR(250)) DocumentName,
               c.Number,
               c.[Date],
               CFG.GetCLRSaturnDate(c.[Date], @DateFormat, 0, @DateType) DateString,
               -1 CurrencyID,
               1 AS CurrencyRate,
               VatRemain AS Non_Received
        FROM CNT.ContractStatement cs
        JOIN CNT.[Contract] c
            ON cs.ContractID = c.ContractID
        JOIN CFG.Party p
            ON c.PartyID = p.PartyID
        JOIN CNT.vwContractStatementRemain vw
            ON vw.ContractStatementID = cs.ContractStatementID
        WHERE c.BranchID = @BranchID
              AND p.DlID = @DlID
              AND c.[Date] <= @Date
			  AND c.CompanyRoll = 2

    END;

    IF (@Type = 3)
    BEGIN
        SELECT 'ns_' + CAST(ii.InstallmentPaymentItemID AS NVARCHAR(100)) DocumentId,
               'Installment' DocumentType,
                @Installment + CAST(h.Number AS VARCHAR(50)) DocumentName,
               CAST(ii.Number AS VARCHAR(100)) Number,
               ii.[Date] [Date],
               CFG.GetCLRSaturnDate(ii.[Date], @DateFormat, 0, @DateType) DateString,
               -1 CurrencyID,
               1 AS CurrencyRate,
               r.remain Non_Received
        FROM cfg.InstallmentPayment h
            JOIN cfg.InstallmentPaymentItem ii
                ON h.InstallmentPaymentID = ii.InstallmentPaymentID
            JOIN CFG.Party p
                ON h.partyid = p.PartyID
            JOIN CFG.vwInstallmentPaymentRemain r
                ON ii.InstallmentPaymentItemID = r.InstallmentPaymentItemID
        WHERE h.BranchID = @BranchID
              AND p.DlID = @DlID
              AND
              (
                  @Date IS NULL
                  OR h.[Date] <= @Date
              )
              AND h.InstallmentType = 1;
    END;

    IF (@Type = 4)
    BEGIN

        SELECT 'rn_' + CAST(r.ReturnInvoiceID AS NVARCHAR(100)) DocumentId,
               'ReturnInvoice' DocumentType,
               @ReturnedPurchase DocumentName,
               CAST(r.Number AS VARCHAR(100)) Number,
               r.[Date] [Date],
               CFG.GetCLRSaturnDate(r.[Date], @DateFormat, 0, @DateType) DateString,
               r.CurrencyID,
               r.CurrencyRate,
               r.Non_Received
        FROM VND.ReturnInvoice r
        JOIN VND.ReturnInvoice_NonReceived ri
            ON r.ReturnInvoiceID = ri.ReturnInvoiceID
        WHERE r.BranchID = @BranchID
              AND ri.NonReceived > 0
              AND r.DlID = @DlID
              AND
              (
                  @Date IS NULL
                  OR r.date <= @Date
              )

        UNION ALL

        SELECT 'pi_' + CAST(p.PurchaseInvoiceID AS NVARCHAR(100)) DocumentId,
               'PurchaseInvoice' DocumentType,
               @PurchaseInvoice DocumentName,
               ISNULL(p.InvoiceNumber, CAST(p.Number AS NVARCHAR(100))) Number,
               p.[Date],
               CFG.GetCLRSaturnDate(p.[Date], @DateFormat, 0, @DateType) DateString,
               p.CurrencyID,
               p.CurrencyRate,
               ABS(pa.NonPaymented) AS Non_Received
		FROM VND.PurchaseInvoice p
		JOIN VND.PurchaseInvoice_NonPaymented pa
			ON p.PurchaseInvoiceID = pa.PurchaseInvoiceID
        WHERE p.BranchID = @BranchID
              AND p.DlID = @DlID
              AND pa.NonPaymented < 0
              AND p.Status = 2
              AND
              (
                  @Date IS NULL
                  OR p.Date <= @Date
              )

    END;

    IF (@Type = 10)
    BEGIN

        SELECT 'cn_'+CAST( c.ContractID AS NVARCHAR(100)) AS DocumentId,
               'Contract' AS DocumentType,
                @Contract + CAST(c.Number AS VARCHAR(50)) DocumentName,
			   CAST(c.Number AS NVARCHAR(100)) Number,
				vcr.CurrencyID,
				1 AS CurrencyRate,
				c.[Date],
		         CFG.GetCLRSaturnDate(c.[Date], @DateFormat, 0, @DateType) DateString,
                vcr.Remain AS Non_Received,
				@DlID
        FROM CNT.Contract AS c
        JOIN CNT.vwContractRemain AS vcr
            ON vcr.ContractID = c.ContractID
        WHERE vcr.Remain > 0 
		AND c.Date<=@date
		AND c.PartyID in(select  PartyID from CFG.Party where DlID=@DlID)
		and c.Status = 2

    END;
END;

