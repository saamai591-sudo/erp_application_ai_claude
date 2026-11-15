-------------------------------------
 Create   PROCEDURE [CFG].spGetDebitDocuments
(
	--@Type TINYINT,
	@BranchID INT,
	@PartyId BIGINT = NULL,
	@Date DATE,
	@ReceiptTypeID INT = NULL,
	@PaymentTypeID INT = NULL
)
--WITH ENCRYPTION
AS

DECLARE @PaymentType     INT,
		@ReceiptType     INT

SELECT @PaymentType = pt.Type
FROM   fin.PaymentType AS pt
WHERE  pt.PaymentTypeID = @PaymentTypeID

SELECT @ReceiptType = rt.Type
FROM   fin.ReceiptType AS rt
WHERE  rt.ReceiptTypeID = @ReceiptTypeID

BEGIN

	DECLARE @UserID INT,
			@DateType TINYINT,
			@DateFormat VARCHAR(10),
			@Culture VARCHAR(10),
			@CultureNo tinyint,
			@DlID BIGINT = NULL,
			@ReceiveSubject NVARCHAR(100),
			@DebitCreditNoteItemCredit NVARCHAR(100),
			@PurchaseInvoice NVARCHAR(100),
			@ConfirmStatement NVARCHAR(100),
			@ConfirmStatementItem NVARCHAR(100),
			@Contract NVARCHAR(100),
			@ContractStatement NVARCHAR(100),
			@ReturnedSale NVARCHAR(100),
			@Invoice NVARCHAR(100),
			@ProformaInvoice NVARCHAR(100),
			@PurchaseContract NVARCHAR(100),
			@ConfirmPurchaseInvoice NVARCHAR(50),
			@ConfirmPurchaseInvoiceItem NVARCHAR(50),
			@Proposal NVARCHAR(25),
			@VatPurchaseInvoice NVARCHAR(100);

	SET @UserID = CFG.GetuserID();
	SET @Culture = CFG.GetuserCulture();

	select @CultureNo = CultureNo
	from CFG.CultureInfo 
	where Culture = @Culture	

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

	--Get Transaction
	BEGIN


		SELECT @Proposal = lev.[Value]
		FROM   cfg.LocalizeEnum le
			   JOIN cfg.LocalizeEnumValue lev
					ON  lev.LocalizeEnumID = le.LocalizeEnumID
		WHERE  le.Enum = 'ProformaInvoiceBases'
			   AND le.Item = 'Proposal'
			   AND lev.Culture = @Culture

		SELECT @VatPurchaseInvoice = lev.[Value] --To Do
		FROM   cfg.LocalizeEnum le
			   JOIN cfg.LocalizeEnumValue lev
					ON  lev.LocalizeEnumID = le.LocalizeEnumID
		WHERE  le.Enum = 'BaseDocuments'
			   AND le.Item = 'VatPurchaseInvoice'
			   AND lev.Culture = @Culture

		SELECT @PurchaseContract = lev.Value
		FROM CFG.LocalizeEnum le
			JOIN CFG.LocalizeEnumValue lev
				ON lev.LocalizeEnumID = le.LocalizeEnumID
		WHERE le.Enum = 'BaseDocuments'
			  AND le.Item = 'PurchaseContract'
			  AND lev.Culture = @Culture;

		SELECT @ReceiveSubject = lev.Value
		FROM CFG.LocalizeEnum le
			JOIN CFG.LocalizeEnumValue lev
				ON lev.LocalizeEnumID = le.LocalizeEnumID
		WHERE le.Enum = 'BaseDocuments'
			  AND le.Item = 'ReceiveSubject'
			  AND lev.Culture = @Culture;

		SELECT @DebitCreditNoteItemCredit = lev.Value
		FROM CFG.LocalizeEnum le
			JOIN CFG.LocalizeEnumValue lev
				ON lev.LocalizeEnumID = le.LocalizeEnumID
		WHERE le.Enum = 'BaseDocuments'
			  AND le.Item = 'DebitCreditNoteItemCredit'
			  AND lev.Culture = @Culture;

		SELECT @PurchaseInvoice = lev.Value
		FROM CFG.LocalizeEnum le
			JOIN CFG.LocalizeEnumValue lev
				ON lev.LocalizeEnumID = le.LocalizeEnumID
		WHERE le.Enum = 'BaseDocuments'
			  AND le.Item = 'PurchaseInvoice'
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

		SELECT @Contract = lev.Value
		FROM CFG.LocalizeEnum le
			JOIN CFG.LocalizeEnumValue lev
				ON lev.LocalizeEnumID = le.LocalizeEnumID
		WHERE le.Enum = 'BaseDocuments'
			  AND le.Item = 'Contract'
			  AND lev.Culture = @Culture;

		SELECT @ContractStatement = lev.Value
		FROM CFG.LocalizeEnum le
			JOIN CFG.LocalizeEnumValue lev
				ON lev.LocalizeEnumID = le.LocalizeEnumID
		WHERE le.Enum = 'BaseDocuments'
			  AND le.Item = 'ContractStatement'
			  AND lev.Culture = @Culture;

		SELECT @ReturnedSale = lev.Value
		FROM CFG.LocalizeEnum le
			JOIN CFG.LocalizeEnumValue lev
				ON lev.LocalizeEnumID = le.LocalizeEnumID
		WHERE le.Enum = 'BaseDocuments'
			  AND le.Item = 'ReturnedSale'
			  AND lev.Culture = @Culture;

		SELECT @Invoice = lev.Value
		FROM CFG.LocalizeEnum le
			JOIN CFG.LocalizeEnumValue lev
				ON lev.LocalizeEnumID = le.LocalizeEnumID
		WHERE le.Enum = 'BaseDocuments'
			  AND le.Item = 'Invoice'
			  AND lev.Culture = @Culture;

		SELECT @ProformaInvoice = lev.Value
		FROM CFG.LocalizeEnum le
			JOIN CFG.LocalizeEnumValue lev
				ON lev.LocalizeEnumID = le.LocalizeEnumID
		WHERE le.Enum = 'BaseDocuments'
			  AND le.Item = 'ProformaInvoice'
			  AND lev.Culture = @Culture;

	SELECT @ConfirmPurchaseInvoice = lev.[Value]
	FROM   cfg.LocalizeEnum le
	  JOIN cfg.LocalizeEnumValue lev
		   ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'BaseDocuments'
	  AND le.Item = 'ConfirmPurchaseInvoice'
	  AND lev.Culture = @Culture
	  
	SELECT @ConfirmPurchaseInvoiceItem = lev.[Value]
	FROM   cfg.LocalizeEnum le
	  JOIN cfg.LocalizeEnumValue lev
		   ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'DocumentNumTypes'
	  AND le.Item = 'ConfirmPurchaseInvoiceItem'
	  AND lev.Culture = @Culture
	END;

	SELECT @DlID = DlID
	FROM CFG.Party
	WHERE PartyID = @PartyId;

	DECLARE @BaseCurrencyRate DECIMAL(36, 10) = 1;

	/*پیش دریافت*/
	IF @ReceiptType = 1
	BEGIN

		SELECT 'Rs_' + CAST(s.ReceiveSubjectID AS VARCHAR(100)) AS DocumentId,
			   'ReceiveSubject' AS DocumentType,
			   @ReceiveSubject AS DocumentName,
			   CAST(r.Number AS VARCHAR(100)) Number,
			   CFG.GetCLRSaturnDate(r.Date, @DateFormat, 0, @DateType) DateString,
			   s.CurrencyID,
			   s.CurrencyRate,
			   rs.NonPrice AS Non_Received,
			   CAST (0 AS DECIMAL) AS NetPay
		FROM FIN.ReceiveSubject s
			JOIN FIN.ReceiveReceipt r
				ON s.ReceiveReceiptID = r.ReceiveReceiptID
			JOIN FIN.ReceiptType t
				ON s.ReceiptTypeID = t.ReceiptTypeID
			JOIN FIN.ReceiveSubject_PriceRemains rs
				ON s.ReceiveSubjectID = rs.ReceiveSubjectID
		WHERE r.BranchID = @BranchID
			  AND t.Type = 1
			  AND rs.NonPrice > 0
			  AND s.DLID = @DlID
			  AND r.Date <= @Date

		UNION ALL

		SELECT 'Dc_' + CAST(i.DebitCreditNoteItemID AS VARCHAR(100)) AS DocumentId,
			   'DebitCreditNoteItem' AS DocumentType,
			   @DebitCreditNoteItemCredit AS DocumentName,
			   CAST(dc.Number AS VARCHAR(100)) Number,
			   CFG.GetCLRSaturnDate(dc.Date, @DateFormat, 0, @DateType) DateString,
			   i.CurrencyID,
			   i.CurrencyRate,
			   r.remain AS Non_Received,
			   CAST (0 AS DECIMAL) AS NetPay
		FROM CFG.DebitCreditNoteItem i
			JOIN CFG.DebitCreditNote dc
				ON i.DebitCreditNoteID = dc.DebitCreditNoteID
			JOIN CFG.Credit_DebitCreditNoteItem_Remain r
				ON i.DebitCreditNoteItemID = r.DebitCreditNoteItemID
			LEFT JOIN FIN.ReceiptType t
				ON i.ReceiptTypeID = t.ReceiptTypeID
		WHERE dc.BranchID = @BranchID
			  AND i.ReceiptTypeID IS NOT NULL
			  AND t.Type = 1
			  AND r.remain > 0
			  AND i.PartyID = @PartyId
			  AND dc.Date <= @Date;

	END;

	/*به تامین کننده*/
	IF @PaymentType = 1
	BEGIN

		/*فاکتور خرید با ارزش افزوده برای فاکتورهایی که دارای تایید مالی نیستند*/
		SELECT 'pur_' + CAST(p.PurchaseInvoiceID AS NVARCHAR(100)) DocumentId,
			   'PurchaseInvoice'     DocumentType,
			   @PurchaseInvoice DocumentName,
			   case when p.InvoiceNumber is not null then p.InvoiceNumber else CAST(p.Number AS NVARCHAR(100)) end Number,
			   CFG.GetCLRSaturnDate(isnull(p.InvoiceDate,p.[Date]), @DateFormat, 0, @DateType) DateString,
			   p.CurrencyID,
			   p.CurrencyRate,
			   pa.NonPaymented Non_Received,
			   CAST (0 AS DECIMAL) AS NetPay
		FROM   VND.PurchaseInvoice p
		JOIN VND.PurchaseInvoice_NonPaymented pa
			ON  p.PurchaseInvoiceID = pa.PurchaseInvoiceID
		JOIN VND.PurchaseType t ON p.[Type] = t.PurchaseTypeID
		WHERE  p.BranchID = @BranchID
			   AND p.DlID = @DlID
			   AND p.[Date] <= @Date	           
			   AND p.Status = 2
			   AND t.HasConfirmStatement = 0
			   AND pa.NonPaymented > 0

		UNION ALL

		/*ارزش افزوده فاکتورهای خرید دارای تایید مالی*/
		SELECT 'pur_' + CAST(p.PurchaseInvoiceID AS NVARCHAR(100)) DocumentId,
			   'PurchaseInvoice'     DocumentType,
			   @VatPurchaseInvoice DocumentName,
			   case when p.InvoiceNumber is not null then p.InvoiceNumber else CAST(p.Number AS NVARCHAR(100)) end Number,
			   CFG.GetCLRSaturnDate(isnull(p.InvoiceDate,p.[Date]), @DateFormat, 0, @DateType) DateString,
			   p.CurrencyID, --To Do
			   p.CurrencyRate, --To Do
			   pa.NonPaymented Non_Received,
			   CAST (0 AS DECIMAL) AS NetPay
		FROM   VND.PurchaseInvoice p
		JOIN VND.PurchaseInvoice_NonPaymented pa
			ON  p.PurchaseInvoiceID = pa.PurchaseInvoiceID
		JOIN VND.PurchaseType t ON p.[Type] = t.PurchaseTypeID
		WHERE  p.BranchID = @BranchID
			   AND p.DlID = @DlID
			   AND p.[Date] <= @Date	           
			   AND p.Status = 2
			   AND t.HasConfirmStatement = 1 
			   AND pa.NonPaymented > 0

		UNION ALL

		/*خالص فاکتورهای خرید دارای تایید مالی*/
		 SELECT 'cnp_' + CAST(c.ConfirmPurchaseInvoiceID AS NVARCHAR(100)) DocumentId,
			   'ConfirmPurchaseInvoice'     DocumentType,
			   @ConfirmPurchaseInvoice + ' ' + case when p.InvoiceNumber is not null then p.InvoiceNumber else CAST(p.Number AS NVARCHAR(100)) end  DocumentName,
			    CAST(c.Number AS NVARCHAR(100)) AS Number,
			   CFG.GetCLRSaturnDate(c.[Date], @DateFormat, 0, @DateType) DateString,
			   p.CurrencyID,
			   p.CurrencyRate,
			   v.NonPayment Non_Received,
			   CAST (0 AS DECIMAL) AS NetPay
		FROM   VND.ConfirmPurchaseInvoice c 
		JOIN VND.PurchaseInvoice p 
			ON p.PurchaseInvoiceID = c.PurchaseInvoiceID 
		JOIN VND.VWConfirmPurchaseInvoiceNonePayment v
			ON c.ConfirmPurchaseInvoiceID = v.ConfirmPurchaseInvoiceID 
		JOIN VND.PurchaseType t 
			ON p.[Type] = t.PurchaseTypeID 
		WHERE  p.BranchID = @BranchID
			   AND p.DlID = @DlID
			   AND p.[Date] <= @Date	           
			   AND p.Status = 2
			   AND v.NonPayment > 0 


		UNION ALL

		/*کسور قابل پرداخت فاکتورهای خرید دارای تایید مالی*/
		 SELECT 'cpi_' + CAST(cpii.ConfirmPurchaseInvoiceItemID AS NVARCHAR(100)) DocumentId,
			   'ConfirmPurchaseInvoiceItem'     DocumentType,
			   case when @CultureNo = 1 then adt.Title else adt.Title2 end + ' ' + 
					@PurchaseInvoice + ' ' + ISNULL(p.InvoiceNumber,p.Number)  DocumentName,
			   CAST(c.Number AS NVARCHAR(100)) Number,
			   CFG.GetCLRSaturnDate(c.[Date], @DateFormat, 0, @DateType) DateString,
			   p.CurrencyID,
			   p.CurrencyRate,
			   v.NonPayment Non_Received,
			   CAST (0 AS DECIMAL) AS NetPay
		FROM  VND.ConfirmPurchaseInvoiceItem cpii
		join VND.ConfirmPurchaseInvoice c 
			ON cpii.ConfirmPurchaseInvoiceID = c.ConfirmPurchaseInvoiceID
		JOIN VND.PurchaseInvoice p 
			ON p.PurchaseInvoiceID = c.PurchaseInvoiceID 
		JOIN VND.VWConfirmPurchaseInvoiceItemNonePayment v
			ON cpii.ConfirmPurchaseInvoiceItemID = v.ConfirmPurchaseInvoiceItemID 
		JOIN VND.PurchaseType t 
			ON p.[Type] = t.PurchaseTypeID 
		join CNT.AdditionDeductionType adt
			on adt.AdditionDeductionTypeID = cpii.AdditionDeductionTypeID
		WHERE  v.NonPayment > 0
			   AND p.BranchID = @BranchID
			   AND c.[Date] <= @Date	
			   AND adt.Payable = 1 -- قابل پرداخت
			   AND adt.Type = 2 --کسور

		UNION ALL
		
		/*تایید مالی صورت ضعیت = خالص صورت وضعیت*/
		SELECT 'cst_' + CAST(cs.ConfirmStatementID AS NVARCHAR(100)) DocumentId,
			   'ConfirmStatement'     DocumentType,
			   @ConfirmStatement + ' ' + cast(cst.Number as varchar(250)) DocumentName,
			   CAST(cs.Number AS NVARCHAR(100)) Number,
			   CFG.GetCLRSaturnDate(cs.[Date], @DateFormat, 0, @DateType) DateString,
			   cst.CurrencyID,
			   cs.CurrencyRate,
			   vw.Remain Non_Received,
			   CAST (0 AS DECIMAL) AS NetPay
		FROM   CNT.ConfirmStatement cs
		JOIN CNT.[Contract] c ON cs.ContractID = c.ContractID
		JOIN CNT.ContractStatement cst ON cst.ContractStatementID = cs.ContractStatementID
		JOIN CFG.Party p ON cst.PartyID = p.PartyID
		JOIN CNT.vwConfirmStatementRemain	vw ON vw.ConfirmStatementID = cs.ConfirmStatementID		
		WHERE c.BranchID = @BranchID
			  AND (@DlID IS NULL OR p.DlID = @DlID)
			  AND cs.[Date] <= @Date 		
			  AND vw.Remain > 0
			  AND cs.ConfirmStatus = 2

		UNION ALL
		
		/*کسور قابل پرداخت صورت وضعیت*/
		SELECT 'csi_' + CAST(csi.ConfirmStatementItemID AS NVARCHAR(100)) DocumentId,
			   'ConfirmStatementItem'     DocumentType,
			   case when @CultureNo = 1 then adt.Title else adt.Title2 end + ' ' + 
				 case when csi.ConfirmStatementID is not null then @ConfirmStatement else @PurchaseInvoice end + ' ' + 
				 case when csi.ConfirmStatementID is not null then CAST(cs.Number as varchar(250)) else ISNULL(pi.InvoiceNumber,pi.Number) end  DocumentName,
			   case when csi.ConfirmStatementID is not null then CAST(cs.Number AS NVARCHAR(100))  else ISNULL(pi.InvoiceNumber,pi.Number) end Number,
			   CFG.GetCLRSaturnDate(case when csi.ConfirmStatementID is not null then cs.[Date] else isnull(pi.InvoiceDate,pi.Date) end, @DateFormat, 0, @DateType) DateString,
			   case when csi.ConfirmStatementID is not null then cst.CurrencyID else pi.CurrencyID end CurrencyID,
			   case when csi.ConfirmStatementID is not null then cs.CurrencyRate else pi.CurrencyRate end CurrencyRate,
			   vw.Remain Non_Received,
			   CAST (0 AS DECIMAL) AS NetPay
		FROM CNT.ConfirmStatementItem csi
		JOIN cnt.AdditionDeductionType adt ON adt.AdditionDeductionTypeID = csi.AdditionDeductionTypeID
		left JOIN CNT.ConfirmStatement cs ON csi.ConfirmStatementID = cs.ConfirmStatementID
		left JOIN CNT.ContractStatement cst ON cst.ContractStatementID = cs.ContractStatementID
		left JOIN CNT.[Contract] c ON cs.ContractID = c.ContractID
		left JOIN vnd.PurchaseInvoice pi ON pi.PurchaseInvoiceID = csi.PurchaseInvoiceID 
		JOIN CNT.vwConfirmStatementItemRemain vw ON vw.ConfirmStatementItemID = csi.ConfirmStatementItemID	  
		left JOIN cnt.ContractStatementDetail csd ON csd.ContractStatementDetailID = csi.BaseDocumentID
		left JOIN CFG.Party p ON case when  csi.BaseDocumentType = 3 then csd.PartyID else cst.PartyID end = p.PartyID
		WHERE  isnull(c.BranchID,pi.BranchID) = @BranchID
			  AND (
				  @DlID IS NULL 
				  OR 
				  (pi.DlID is not null AND pi.DlID = @DlID)
				  or
				  (p.DlID = @DlID)
				 )
			  AND isnull(cs.[Date],pi.Date) <= @Date
			  AND adt.Payable = 1
			  AND csi.Deduction > 0 
			  AND (pi.PurchaseInvoiceID is null or pi.Status = 2)
			  AND vw.Remain > 0
			  AND cs.ConfirmStatus = 2

		UNION ALL
		
		/*ارزش افزوده صورت وضعیت*/
		SELECT 'css_' + CAST(cs.ContractStatementID AS NVARCHAR(100)) DocumentId,
			   'ContractStatement'     DocumentType,         
				@ContractStatement + ' ' + cast(cs.Number as varchar(250)) DocumentName,
			    CAST(cs.Number AS NVARCHAR(100)) Number,
			    CFG.GetCLRSaturnDate(cs.[Date], @DateFormat, 0, @DateType) DateString,
			    -1 CurrencyID,
			    1 CurrencyRate,
			    VatRemain Non_Received,
			    CAST (0 AS DECIMAL) AS NetPay
		FROM CNT.ContractStatement cs
		JOIN CNT.[Contract] c ON cs.ContractID = c.ContractID
		JOIN CFG.Party p ON cs.PartyID = p.PartyID
		JOIN CNT.vwContractStatementRemain vw ON vw.ContractStatementID = cs.ContractStatementID
		LEFT JOIN CNT.ConfirmStatement cfs ON c.ContractID = cfs.ContractID
		
		WHERE c.BranchID = @BranchID
			  AND (@DlID IS NULL OR p.DlID = @DlID)
			  AND c.[Date] <= @Date
			  AND VatRemain > 0
			  AND cfs.ConfirmStatus = 2
	END;

	/*به مشتری*/
	IF @PaymentType = 2
	BEGIN
		SELECT 'Re_' + CAST(i.ReturnedSaleInvoiceID AS VARCHAR(100)) AS DocumentId,
			   'ReturnedSaleInvoice' AS DocumentType,
			   @ReturnedSale AS DocumentName,
			   CAST(i.Number AS VARCHAR(100)) Number,
			   CFG.GetCLRSaturnDate(i.Date, @DateFormat, 0, @DateType) DateString,
			   i.CurrencyID,
			   i.CurrencyRate,
			   r.NonPaymented AS Non_Received,
			   CAST(0 AS DECIMAL) AS NetPay
		FROM SLE.ReturnedSaleInvoice i
			JOIN SLE.ReturnedSaleInvoice_NonPaymented r
				ON i.ReturnedSaleInvoiceID = r.ReturnedSaleInvoiceID

		WHERE i.BranchID = @BranchID
			  AND r.NonPaymented > 0
			  AND i.CustomerID = @PartyId
			  AND i.BaseDocument = 1
			  AND i.Date <= @Date
		UNION
		SELECT 'In_' + CAST(i.InvoiceID AS VARCHAR(100)) AS DocumentId,
			   'Invoice' DocumentType,
			   @Invoice DocumentName,
			   CAST(i.Number AS NVARCHAR(100)) Number,
			   CFG.GetCLRSaturnDate(i.Date, @DateFormat, 0, @DateType) DateString,
			   i.CurrencyID,
			   i.CurrencyRate,
			   ABS(r.NonReceived) AS Non_Received,
			   CAST(0 AS DECIMAL) AS NetPay
		FROM SLE.Invoice i
			JOIN SLE.Invoice_NonReceived r
				ON i.InvoiceID = r.InvoiceID
		WHERE i.BranchID = @BranchID
			  AND i.CustomerID = @PartyId
			  AND r.NonReceived < 0
			  AND i.Date <= @Date;
	END;

	/*اقساط پرداختنی*/
	IF @PaymentType  = 3
	BEGIN
		SELECT 'Ip_' + CAST(i.InstallmentPaymentItemID AS VARCHAR(100)) AS DocumentId,
			   'InstallmentPaymentItem' AS DocumentType,
			   'قسط شماره ' + CAST(i.Number AS VARCHAR(50)) + ' از تقسیط شماره ' + CAST(p.Number AS VARCHAR(50)) DocumentName,
			   CAST(i.Number AS VARCHAR(100)) Number,
			   CFG.GetCLRSaturnDate(i.[Date], @DateFormat, 0, @DateType) DateString,
			   -1 CurrencyID,
			   @BaseCurrencyRate AS CurrencyRate,
			   r.remain AS Non_Received,
			   CAST(0 AS DECIMAL) AS NetPay
		FROM CFG.InstallmentPaymentItem i
			JOIN CFG.InstallmentPayment p
				ON i.InstallmentPaymentID = p.InstallmentPaymentID
			JOIN CFG.vwInstallmentPaymentRemain r
				ON i.InstallmentPaymentItemID = r.InstallmentPaymentItemID
		WHERE p.BranchID = @BranchID
			  AND r.remain > 0
			  AND p.PartyID = @PartyId;

	END;

	/*پیش پرداخت*/
	IF (@PaymentType = 10)
	BEGIN
		SELECT 'Pc_' + CAST(c.PurchaseContractID AS VARCHAR(100)) AS DocumentId,
			   'PurchaseContract' AS DocumentType,
			   @PurchaseContract AS DocumentName,
			   CASE
				   WHEN c.InvoiceNumber IS NULL THEN
					   CAST(c.Number AS VARCHAR(100))
				   ELSE
					   c.InvoiceNumber
			   END Number,
			   CFG.GetCLRSaturnDate(ISNULL(c.InvoiceDate,c.Date), @DateFormat, 0, @DateType) DateString,
			   c.CurrencyID,
			   CAST (ISNULL(cr.Rate, 1.0) AS DECIMAL) AS CurrencyRate,
			   r.NonPaymented AS Non_Received,
			   CAST (0 AS DECIMAL) AS NetPay
		FROM VND.PurchaseContract c
			JOIN VND.PurchaseContract_NonPaymented r
				ON c.PurchaseContractID = r.PurchaseContractID
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
				ON c.CurrencyID = cr.CurrencyID
		WHERE c.BranchID = @BranchID
			  AND r.NonPaymented > 0
			  AND c.DlID = @DlID
			  AND c.Date <= @Date

		UNION ALL

		SELECT 'Pr_' + CAST(p.ProposalID AS VARCHAR(100)) AS DocumentId,
			   'Proposal' AS DocumentType,
			   @Proposal AS DocumentName,
			   case when p.QuotationNumber is not null then CAST(p.QuotationNumber AS NVARCHAR(100))  else  CAST(p.Number AS NVARCHAR(100)) end Number,
			   CFG.GetCLRSaturnDate(p.Date, @DateFormat, 0, @DateType) DateString,
			   p.CurrencyID,
			   ISNULL(cr.Rate, 1) AS CurrencyRate,
			   r.NonPaymented AS Non_Received,
			   CAST (0 AS DECIMAL) AS NetPay
		FROM VND.Proposal p
			JOIN VND.Proposal_NonPaymented r
				ON p.ProposalID = r.ProposalID
			JOIN CFG.Party pa
				ON p.PartyID = pa.PartyID
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
				ON p.CurrencyID = cr.CurrencyID
		WHERE p.Status = 2
			  AND p.BranchID = @BranchID
			  AND r.NonPaymented > 0
			  AND p.PartyID = @PartyId
			  AND p.Date <= @Date

		UNION ALL

		SELECT 'pf_' + CAST(p.ProformaInvoiceID AS NVARCHAR(100)) DocumentId,
			   'ProformaInvoice' DocumentType,
			   @ProformaInvoice DocumentName,
			   p.Number,
			   CFG.GetCLRSaturnDate(p.Date, @DateFormat, 0, @DateType) DateString,
			   p.CurrencyID,
			   ISNULL(cr.Rate, 1) AS CurrencyRate,
			   r.Remain Non_Received,
			   CAST (0 AS DECIMAL) AS NetPay
		FROM FOS.ProformaInvoice p
			JOIN CFG.Party pa
				ON p.Vendor = pa.PartyID
			JOIN FOS.ProformaInvoice_Remain r
				ON p.ProformaInvoiceID = r.ProformaInvoiceID
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
				ON p.CurrencyID = cr.CurrencyID
		WHERE p.BranchID = @BranchID
			  AND pa.DlID = @DlID
			  AND p.Date <= @Date
			  AND r.Remain > 0
			  AND p.Status = 2

		UNION ALL

		SELECT 'cn_' + CAST(c.ContractID AS NVARCHAR(100)) DocumentId,
			   'Contract' DocumentType,
			   @Contract DocumentName,
			   c.Number,
			   CFG.GetCLRSaturnDate(c.Date, @DateFormat, 0, @DateType) DateString,
			   vw.CurrencyID,
			   ISNULL(cr.Rate, 1) AS CurrencyRate,
			   vw.Remain AS Non_Received,
			   CAST (0 AS DECIMAL) AS NetPay
		FROM CNT.[Contract] c
			JOIN CFG.Party p
				ON c.PartyID = p.PartyID
			JOIN CNT.vwContractRemain vw
				ON vw.ContractID = c.ContractID
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
				ON vw.CurrencyID = cr.CurrencyID
		WHERE c.BranchID = @BranchID
			  AND p.DlID = @DlID
			  AND c.Date <= @Date
			  AND vw.Remain > 0
			  AND c.Status = 2
	END;

	/*حقوق پرداختنی*/
	IF @PaymentType = 11
	BEGIN

		DECLARE @ConfigValue VARCHAR(25) =
				(
					SELECT ConfigValue
					FROM CFG.Configuration
					WHERE ConfigKey = 'AgreementNeedConfirm'
				);

		SELECT *
		INTO #agreement
		FROM
		(
			SELECT ROW_NUMBER() OVER (PARTITION BY a.PersonelID
									  ORDER BY CASE
												   WHEN LOWER(@ConfigValue) = 'false' THEN
													   a.IssueDate
												   ELSE
													   a.ConfirmDate
											   END DESC
									 ) Rno,
				   a.PersonelID
			FROM HRM.Agreement a
				JOIN HRM.Personel p
					ON a.PersonelID = p.PersonelID
				JOIN CFG.Party pa
					ON pa.PartyID = p.PartyID
			WHERE (
					  LOWER(@ConfigValue) = 'false'
					  OR a.ConfirmedBy IS NOT NULL
				  )
				  AND a.BranchID = @BranchID
				  AND pa.PartyID = @PartyId
		) T
		WHERE T.Rno = 1;

		SELECT 'Ca_' + CAST(c.CalculationResultID AS VARCHAR(100)) AS DocumentId,
			   'CalculationResult' AS DocumentType,
			   ct.Title DocumentName,
			   CAST(cal.Year AS NVARCHAR(100)) + '/' + cm.MonthName Number,
			   CFG.GetCLRSaturnDate(cm.EndDate, @DateFormat, 0, @DateType) DateString,
			   -1 CurrencyID,
			   @BaseCurrencyRate AS CurrencyRate,
			   r.Remain Non_Received,
			   c.[Value] NetPay
		FROM PAY.CalculationResult c
			JOIN PAY.CalculationPersonel AS cp
				ON cp.CalculationPersonelID = c.CalculationPersonelID
			JOIN PAY.CalculationType ct
				ON cp.CalculationTypeID = ct.CalculationTypeID
			JOIN HRM.CalendarMonth cm
				ON cp.CalendarMonthID = cm.CalendarMonthID
			JOIN HRM.Calendar cal
				ON cm.CalendarID = cal.CalendarID
			JOIN #agreement a
				ON cp.PersonelID = a.PersonelID
			JOIN PAY.Parameter pa
				ON pa.ParameterID = c.ParameterID
			JOIN PAY.CalculationResult_NonPayment r
				ON r.CalculationResultID = c.CalculationResultID
		WHERE r.Remain > 0
			  AND cm.EndDate <= @Date
		UNION all
	
		SELECT  'prp_' + CAST(p.PayPreparingID AS NVARCHAR(100)) AS DocumentId,
			'PayPreparing' AS DocumentType,
			CASE @CultureNo WHEN 2 THEN t.Title2 ELSE t.Title END AS DocumentName,
			CAST(p.Number AS NVARCHAR(100)) + ' - ' + CAST(cal.[Year] AS NVARCHAR(100)) + '/' + cm.[MonthName] AS Number,
			CFG.GetCLRSaturnDate(cm.StartDate, @DateFormat, 0, @DateType) AS DateString,
			-1 AS CurrencyID,
			@BaseCurrencyRate AS CurrencyRate,
			vw.Remain AS Non_Received,
			vw.[Value] AS NetPay

		FROM PAY.PayPreparing p	
		JOIN HRM.CalendarMonth cm ON p.CalendarMonthID = cm.CalendarMonthID	
		JOIN HRM.Calendar cal ON cm.CalendarID = cal.CalendarID
		JOIN PAY.PayrollPaymentType t ON p.PayrollPaymentTypeID = t.PayrollPaymentTypeID
		JOIN PAY.vwPayPreparingRemain vw ON p.PayPreparingID = vw.PayPreparingID	   
		WHERE p.BranchID = @BranchID
			AND NOT EXISTS (
				SELECT 1
				FROM CFG.DebitCreditNoteItem d
				WHERE d.PayPreparingID = p.PayPreparingID
			)
	END;

	/*علی الحساب*/
	IF @PaymentType = 12
	BEGIN

		SELECT 'cn_' + CAST(c.ContractID AS NVARCHAR(100)) DocumentId,
			   'Contract' DocumentType,
			   CS.CurrencyRate,
			   @Contract DocumentName,
			   CAST(c.Number AS NVARCHAR(100)) Number,
			   c.Date,
			   CFG.GetCLRSaturnDate(c.Date, @DateFormat, 0, @DateType) DateString,
			   vw.CurrencyID,
			   p.DlID,
			   vw.Remain AS Non_Received,
			   CAST(0 AS DECIMAL) AS NetPay
		FROM CNT.[Contract] c
		JOIN CNT.ConfirmStatement CS ON C.ContractID = CS.ContractID
			JOIN CFG.Party p
				ON c.PartyID = p.PartyID
			JOIN CNT.vwContractRemain vw
				ON vw.ContractID = c.ContractID
		WHERE c.BranchID = @BranchID
			  AND
			  (
				  @DlID IS NULL
				  OR
				  (
					  (
						  c.ContractNature <> 3
						  AND p.DlID = @DlID
					  )
					  OR
					  (
						  c.ContractNature = 3
						  AND EXISTS
							(
								SELECT b.DlID
								FROM CNT.ContractParty a
									JOIN CFG.Party b
										ON a.PartyID = b.PartyID
								WHERE a.ContractID = c.ContractID
									  AND b.DlID = @DlID
							)
					  )
				  )
			  )
			  AND
			  (
				  @DlID IS NULL
				  OR p.DlID = @DlID
			  )
			  AND c.Date <= @Date
			  AND vw.Remain > 0
			  AND c.Status = 2
	END;

END;
