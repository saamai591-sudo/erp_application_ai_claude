----------------------------------------------
CREATE   PROCEDURE [FIN].spGetPaymentBaseDocuments
(
	@Type           TINYINT = NULL,
	@BranchID       INT,
	@DlID           BIGINT = NULL,
	@Date           DATE,
	@CurrencyID     INT = NULL,
	@PaymentRequestID INT = NULL,
	@ComeFromManualReceipt BIT = 0,
	@PaymentTypeID  INT = NULL,
	@PartyId        BIGINT = NULL,
	@ReceiptTypeID  INT = NULL
)
--WITH ENCRYPTION
AS
BEGIN
	DECLARE @ReceiptType TINYINT = NULL,
			@ReceiveSubject NVARCHAR(100),
			@DebitCreditNoteItemCredit NVARCHAR(100)

	IF @PartyId IS NOT NULL AND @DlID IS NULL
		SELECT @DlID = DlID FROM CFG.Party WHERE PartyID = @PartyId

	IF @ReceiptTypeID IS NOT NULL
		SELECT @ReceiptType = rt.Type
		FROM   FIN.ReceiptType AS rt
		WHERE  rt.ReceiptTypeID = @ReceiptTypeID

	IF @PaymentTypeID IS NOT NULL AND ISNULL(@Type, 0) = 0
		SELECT @Type = pt.Type
		FROM   FIN.PaymentType AS pt
		WHERE  pt.PaymentTypeID = @PaymentTypeID

	DECLARE @UserID INT,
			@DateType TINYINT,
			@DateFormat NVARCHAR(10),
			@PurchaseInvoice NVARCHAR(25),
			@ReturnedSaleInvoice NVARCHAR(50),
			@Sale NVARCHAR(25),
			@ConfirmStatement NVARCHAR(100),
			@ConfirmStatementItem NVARCHAR(100),
			@FinancialConfirm NVARCHAR(100),
			@Contract NVARCHAR(25),
			@ContractStatement NVARCHAR(100),
			@ConfigValue VARCHAR(25),
			@VatPurchaseInvoice NVARCHAR(100),
			@PurchaseContract NVARCHAR(25), 
			@Proposal NVARCHAR(25),
			@Proforma NVARCHAR(25),
			@PayPreparing NVARCHAR(25),
			@Culture NVARCHAR(10),
			@CultureNo tinyint,
			@ConfirmPurchaseInvoice NVARCHAR(50)
		
	SET @UserID = CFG.GetuserID()
	SET @Culture = cfg.GetuserCulture()	

	select @CultureNo = CultureNo
	from CFG.CultureInfo 
	where Culture = @Culture	
	
	SELECT @DateType = us.SettingValue
	FROM   CFG.UserSetting us
	WHERE  us.SettingKey = 'Date_Type'
		   AND us.UserID = @UserID
	
	IF @DateType IS NULL
		SET @DateType = CASE @Culture
							 WHEN 'fa' THEN 0
							 WHEN 'en' THEN 1
							 WHEN 'ar' THEN 2
						END
	
	SELECT @DateFormat = us.SettingValue
	FROM   CFG.UserSetting us
	WHERE  us.SettingKey = 'Date_Format'
		   AND us.UserID = @UserID
	
	IF @DateFormat IS NULL
		SET @DateFormat = 'YY/MM/DD'

	--Get Translate
	BEgin
		SELECT @PurchaseInvoice = lev.[Value]
		FROM   cfg.LocalizeEnum le
			   JOIN cfg.LocalizeEnumValue lev
					ON  lev.LocalizeEnumID = le.LocalizeEnumID
		WHERE  le.Enum = 'BaseDocuments'
			   AND le.Item = 'PurchaseInvoice'
			   AND lev.Culture = @Culture

		SELECT @FinancialConfirm = lev.[Value]
		FROM   cfg.LocalizeEnum le
			   JOIN cfg.LocalizeEnumValue lev
					ON  lev.LocalizeEnumID = le.LocalizeEnumID
		WHERE  le.Enum = 'BaseDocuments'
			   AND le.Item = 'FinancialConfirm'
			   AND lev.Culture = @Culture
		   
		SELECT @ReturnedSaleInvoice = lev.[Value]
		FROM   cfg.LocalizeEnum le
			   JOIN cfg.LocalizeEnumValue lev
					ON  lev.LocalizeEnumID = le.LocalizeEnumID
		WHERE  le.Enum = 'DocumentNumTypes'
			   AND le.Item = 'ReturnedSaleInvoice'
			   AND lev.Culture = @Culture

		SELECT @Sale = lev.[Value]
		FROM   cfg.LocalizeEnum le
			   JOIN cfg.LocalizeEnumValue lev
					ON  lev.LocalizeEnumID = le.LocalizeEnumID
		WHERE  le.Enum = 'VatItemDocType'
			   AND le.Item = 'Sale'
			   AND lev.Culture = @Culture
		   
		SELECT @ConfirmStatement = lev.[Value]
		FROM   cfg.LocalizeEnum le
			   JOIN cfg.LocalizeEnumValue lev
					ON  lev.LocalizeEnumID = le.LocalizeEnumID
		WHERE  le.Enum = 'BaseDocuments'
			   AND le.Item = 'ConfirmStatement'
			   AND lev.Culture = @Culture
		
		SELECT @ConfirmStatementItem = lev.[Value]
		FROM   cfg.LocalizeEnum le
			   JOIN cfg.LocalizeEnumValue lev
					ON  lev.LocalizeEnumID = le.LocalizeEnumID
		WHERE  le.Enum = 'BaseDocuments'
			   AND le.Item = 'ConfirmStatementItem'
			   AND lev.Culture = @Culture

		SELECT @Contract = lev.[Value]
		FROM   cfg.LocalizeEnum le
			   JOIN cfg.LocalizeEnumValue lev
					ON  lev.LocalizeEnumID = le.LocalizeEnumID
		WHERE  le.Enum = 'BaseDocuments'
			   AND le.Item = 'Contract'
			   AND lev.Culture = @Culture

		SELECT @ContractStatement = lev.[Value]
		FROM   cfg.LocalizeEnum le
			   JOIN cfg.LocalizeEnumValue lev
					ON  lev.LocalizeEnumID = le.LocalizeEnumID
		WHERE  le.Enum = 'BaseDocuments'
			   AND le.Item = 'ContractStatement'
			   AND lev.Culture = @Culture
		   
		SELECT @VatPurchaseInvoice = lev.[Value]
		FROM   cfg.LocalizeEnum le
				JOIN cfg.LocalizeEnumValue lev
					ON  lev.LocalizeEnumID = le.LocalizeEnumID
		WHERE  le.Enum = 'PaymentRequestItemBases'
				AND le.Item = 'ConfirmedPurchaseInvoiceVat'
				AND lev.Culture = @Culture

		SELECT @PurchaseContract = lev.[Value]
		FROM   cfg.LocalizeEnum le
			   JOIN cfg.LocalizeEnumValue lev
					ON  lev.LocalizeEnumID = le.LocalizeEnumID
		WHERE  le.Enum = 'PurchaseDocumentBases'
			   AND le.Item = 'PurchaseContract'
			   AND lev.Culture = @Culture
	
		SELECT @Proposal = lev.[Value]
		FROM   cfg.LocalizeEnum le
			   JOIN cfg.LocalizeEnumValue lev
					ON  lev.LocalizeEnumID = le.LocalizeEnumID
		WHERE  le.Enum = 'ProformaInvoiceBases'
			   AND le.Item = 'Proposal'
			   AND lev.Culture = @Culture
	
		SELECT @Proforma = lev.[Value]
		FROM   cfg.LocalizeEnum le
			   JOIN cfg.LocalizeEnumValue lev
					ON  lev.LocalizeEnumID = le.LocalizeEnumID
		WHERE  le.Enum = 'CostOfOrderBases'
			   AND le.Item = 'Proforma'
			   AND lev.Culture = @Culture		   

		SELECT @PayPreparing = lev.[Value]
		FROM   cfg.LocalizeEnum le
			   JOIN cfg.LocalizeEnumValue lev
					ON  lev.LocalizeEnumID = le.LocalizeEnumID
		WHERE  le.Enum = 'BaseDocuments'
			   AND le.Item = 'PayPreparing'
			   AND lev.Culture = @Culture

		select @ConfirmPurchaseInvoice = Value
		from MDT.VWEntityTranslate
		where name = 'ConfirmPurchaseInvoice'
		and Culture = @Culture	

	End

	/* Debit/Credit note receipt subjects (pre-receive) - not covered by payment @Type blocks */
	IF @ReceiptType = 1
	BEGIN
		SELECT @ReceiveSubject = lev.Value
		FROM CFG.LocalizeEnum le
			JOIN CFG.LocalizeEnumValue lev
				ON lev.LocalizeEnumID = le.LocalizeEnumID
		WHERE le.Enum = 'BaseDocuments'
			  AND le.Item = 'ReceiveSubject'
			  AND lev.Culture = @Culture

		SELECT @DebitCreditNoteItemCredit = lev.Value
		FROM CFG.LocalizeEnum le
			JOIN CFG.LocalizeEnumValue lev
				ON lev.LocalizeEnumID = le.LocalizeEnumID
		WHERE le.Enum = 'BaseDocuments'
			  AND le.Item = 'DebitCreditNoteItemCredit'
			  AND lev.Culture = @Culture

		SELECT 'Rs_' + CAST(s.ReceiveSubjectID AS VARCHAR(100)) AS DocumentId,
			   'ReceiveSubject' AS DocumentType,
			   @ReceiveSubject AS DocumentName,
			   CAST(r.Number AS VARCHAR(100)) Number,
			   r.[Date],
			   CFG.GetCLRSaturnDate(r.Date, @DateFormat, 0, @DateType) DateString,
			   s.CurrencyID,
			   s.CurrencyRate,
			   rs.NonPrice AS Non_Received,
			   null as PurchaseType,
			   s.DLID AS DlID,
			   CASE WHEN @CultureNo = 1 then cur.Title else cur.Title2 END CurrencyTitle
		FROM FIN.ReceiveSubject s
			JOIN FIN.ReceiveReceipt r
				ON s.ReceiveReceiptID = r.ReceiveReceiptID
			JOIN FIN.ReceiptType t
				ON s.ReceiptTypeID = t.ReceiptTypeID
			JOIN FIN.ReceiveSubject_PriceRemains rs
				ON s.ReceiveSubjectID = rs.ReceiveSubjectID
			JOIN cfg.Currency AS cur
				ON cur.CurrencyID = s.CurrencyID
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
			   dc.[Date],
			   CFG.GetCLRSaturnDate(dc.Date, @DateFormat, 0, @DateType) DateString,
			   i.CurrencyID,
			   i.CurrencyRate,
			   r.remain AS Non_Received,
			   null as PurchaseType,
			   pa.DlID,
			   CASE WHEN @CultureNo = 1 then cur.Title else cur.Title2 END CurrencyTitle
		FROM CFG.DebitCreditNoteItem i
			JOIN CFG.DebitCreditNote dc
				ON i.DebitCreditNoteID = dc.DebitCreditNoteID
			JOIN CFG.Credit_DebitCreditNoteItem_Remain r
				ON i.DebitCreditNoteItemID = r.DebitCreditNoteItemID
			JOIN CFG.Party pa
				ON pa.PartyID = i.PartyID
			JOIN cfg.Currency AS cur
				ON cur.CurrencyID = i.CurrencyID
			LEFT JOIN FIN.ReceiptType t
				ON i.ReceiptTypeID = t.ReceiptTypeID
		WHERE dc.BranchID = @BranchID
			  AND i.ReceiptTypeID IS NOT NULL
			  AND t.Type = 1
			  AND r.remain > 0
			  AND i.PartyID = @PartyId
			  AND dc.Date <= @Date

		RETURN
	END

	IF (@Type = 1)
	BEGIN
		IF @ComeFromManualReceipt = 0
		BEGIN
			/*فاکتور خرید با ارزش افزوده برای فاکتورهایی که دارای تایید مالی نیستند*/
			SELECT 'pur_' + CAST(p.PurchaseInvoiceID AS NVARCHAR(100)) DocumentId,
				   'PurchaseInvoice'     DocumentType,
				   @PurchaseInvoice DocumentName,
				   case when p.InvoiceNumber is not null then p.InvoiceNumber else  CAST(p.Number AS NVARCHAR(100)) end Number,
				   p.[Date],
				   CFG.GetCLRSaturnDate(isnull(p.InvoiceDate,p.[Date]), @DateFormat, 0, @DateType) DateString,
				   p.CurrencyID,
				   p.CurrencyRate,
				   case when pri.PaymentRequestItemID is null then pa.NonPaymented else pri.Amount end as Non_Received,
				   case when @CultureNo = 1 then t.Title else t.title2 end PurchaseType,
				   p.DlID,
				   CASE WHEN @CultureNo = 1 then cur.Title else cur.Title2 END CurrencyTitle
			FROM   VND.PurchaseInvoice p
			join cfg.Currency AS cur on cur.CurrencyID = p.CurrencyID
			JOIN VND.PurchaseInvoice_NonPaymented pa
				ON  p.PurchaseInvoiceID = pa.PurchaseInvoiceID
			JOIN VND.PurchaseType t ON p.[Type] = t.PurchaseTypeID
			left JOIN REQ.PaymentRequestItem pri
				ON pri.PaymentRequestID = @PaymentRequestID 
				AND BaseDocumentType = 2 
				AND pri.BaseDocumentID = p.PurchaseInvoiceID
			WHERE  p.BranchID = @BranchID
				   AND (@DlID IS NULL OR p.DlID = @DlID)
				   AND p.[Date] <= @Date	           
				   AND (@CurrencyID IS NULL OR p.CurrencyID = @CurrencyID) 
				   AND (@PaymentRequestID is null or pri.PaymentRequestItemID is not null)
				   AND p.Status = 2
				   AND t.HasConfirmStatement = 0
				   AND (@PaymentRequestID is not null or pa.NonPaymented > 0)

			UNION ALL

			/*ارزش افزوده فاکتورهای خرید دارای تایید مالی*/
			SELECT 'pur_' + CAST(p.PurchaseInvoiceID AS NVARCHAR(100)) DocumentId,
				   'PurchaseInvoice'     DocumentType,
				   @VatPurchaseInvoice DocumentName,
				   case when p.InvoiceNumber is not null then p.InvoiceNumber else CAST(p.Number AS NVARCHAR(100)) end Number,
				   p.[Date],
				   CFG.GetCLRSaturnDate(isnull(p.InvoiceDate,p.[Date]), @DateFormat, 0, @DateType) DateString,
					-1 CurrencyID,
					1 CurrencyRate,
				   case when pri.PaymentRequestItemID is null then pa.NonPaymented else pri.Amount end as Non_Received,
				   case when @CultureNo = 1 then t.Title else t.title2 end PurchaseType,
				   p.DlID,
				   CASE WHEN @CultureNo = 1 then cur.Title else cur.Title2 END CurrencyTitle
			FROM   VND.PurchaseInvoice p
			join cfg.Currency AS cur on cur.CurrencyID = -1
			JOIN VND.PurchaseInvoice_NonPaymented pa
				ON  p.PurchaseInvoiceID = pa.PurchaseInvoiceID
			JOIN VND.PurchaseType t ON p.[Type] = t.PurchaseTypeID
			left JOIN REQ.PaymentRequestItem pri
				ON pri.PaymentRequestID = @PaymentRequestID 
				AND BaseDocumentType = 12
				AND pri.BaseDocumentID = p.PurchaseInvoiceID
			WHERE  p.BranchID = @BranchID
				   AND (@DlID IS NULL OR p.DlID = @DlID)
				   AND p.[Date] <= @Date	           
				   AND (@CurrencyID  = -1) 
				   AND (@PaymentRequestID is null or pri.PaymentRequestItemID is not null)
				   AND p.Status = 2
				   AND t.HasConfirmStatement = 1 
				   AND (@PaymentRequestID is not null or pa.NonPaymented > 0)

			UNION ALL

			/*خالص فاکتورهای خرید دارای تایید مالی*/
			 SELECT 'cnp_' + CAST(c.ConfirmPurchaseInvoiceID AS NVARCHAR(100)) DocumentId,
				   'ConfirmPurchaseInvoice'     DocumentType,
				   @ConfirmPurchaseInvoice + ' ' + case when p.InvoiceNumber is not null then p.InvoiceNumber else CAST(p.Number AS NVARCHAR(100)) end  DocumentName,
				   CAST(c.Number AS NVARCHAR(100)) Number,
				   c.[Date],
				   CFG.GetCLRSaturnDate(c.[Date], @DateFormat, 0, @DateType) DateString,
				   p.CurrencyID,
				   p.CurrencyRate,
				   case when pri.PaymentRequestItemID is null then v.NonPayment else pri.Amount end as Non_Received,
				   case when @CultureNo = 1 then t.Title else t.title2 end PurchaseType,
				   p.DlID,
				   CASE WHEN @CultureNo = 1 then cur.Title else cur.Title2 END CurrencyTitle
			FROM   VND.ConfirmPurchaseInvoice c 
			JOIN VND.PurchaseInvoice p 
				ON p.PurchaseInvoiceID = c.PurchaseInvoiceID 
				join cfg.Currency AS cur on cur.CurrencyID = p.CurrencyID
			JOIN VND.VWConfirmPurchaseInvoiceNonePayment v
				ON c.ConfirmPurchaseInvoiceID = v.ConfirmPurchaseInvoiceID 
			JOIN VND.PurchaseType t 
				ON p.[Type] = t.PurchaseTypeID 
			LEFT JOIN REQ.PaymentRequestItem pri
				ON PaymentRequestID = @PaymentRequestID 
				AND BaseDocumentType = 11
				AND pri.BaseDocumentID = c.ConfirmPurchaseInvoiceID
			WHERE  p.BranchID = @BranchID
				   AND (@DlID IS NULL OR p.DlID = @DlID)
				   AND p.[Date] <= @Date	           
				   AND (@CurrencyID IS NULL OR p.CurrencyID = @CurrencyID) 
				   AND (@PaymentRequestID is null or pri.PaymentRequestItemID is not null)
				   AND p.Status = 2
				   AND (@PaymentRequestID is not null or v.DirectPayable > 0)

			UNION ALL

			/*کسور قابل پرداخت فاکتورهای خرید دارای تایید مالی*/
			 SELECT 'cpi_' + CAST(cpii.ConfirmPurchaseInvoiceItemID AS NVARCHAR(100)) DocumentId,
				   'ConfirmPurchaseInvoiceItem'     DocumentType,
				   case when @CultureNo = 1 then adt.Title else adt.Title2 end + ' ' + 
						@PurchaseInvoice + ' ' + ISNULL(p.InvoiceNumber,p.Number)  DocumentName,
				   CAST(c.Number AS NVARCHAR(100)) Number,
				   c.[Date],
				   CFG.GetCLRSaturnDate(c.[Date], @DateFormat, 0, @DateType) DateString,
				   p.CurrencyID,
				   p.CurrencyRate,
				   case when pri.PaymentRequestItemID is null then v.NonPayment else pri.Amount end as Non_Received,
				   case when @CultureNo = 1 then t.Title else t.title2 end PurchaseType,
				   p.DlID,
				   CASE WHEN @CultureNo = 1 then cur.Title else cur.Title2 END CurrencyTitle
			FROM  VND.ConfirmPurchaseInvoiceItem cpii
			join VND.ConfirmPurchaseInvoice c 
				ON cpii.ConfirmPurchaseInvoiceID = c.ConfirmPurchaseInvoiceID
			JOIN VND.PurchaseInvoice p 
				ON p.PurchaseInvoiceID = c.PurchaseInvoiceID
				 join cfg.Currency AS cur on cur.CurrencyID = p.CurrencyID
			JOIN VND.VWConfirmPurchaseInvoiceItemNonePayment v
				ON cpii.ConfirmPurchaseInvoiceItemID = v.ConfirmPurchaseInvoiceItemID 
			JOIN VND.PurchaseType t 
				ON p.[Type] = t.PurchaseTypeID 
			join CNT.AdditionDeductionType adt
				on adt.AdditionDeductionTypeID = cpii.AdditionDeductionTypeID
			LEFT JOIN REQ.PaymentRequestItem pri
				ON PaymentRequestID = @PaymentRequestID 
				AND BaseDocumentType = 13
				AND pri.BaseDocumentID = cpii.ConfirmPurchaseInvoiceItemID
			WHERE  (@PaymentRequestID is not null or v.NonPayment > 0)
				   AND p.BranchID = @BranchID
				   AND c.[Date] <= @Date	
				   AND adt.Payable = 1 -- قابل پرداخت
				   AND adt.Type = 2 --کسور
				   AND (@PaymentRequestID is null or pri.PaymentRequestItemID is not null)
				   AND (@CurrencyID IS NULL OR p.CurrencyID = @CurrencyID)
				   AND (@DlID IS NULL OR p.DlID = @DlID)

			UNION ALL
		
			/*تایید مالی صورت ضعیت = خالص صورت وضعیت*/
			SELECT 'cst_' + CAST(cs.ConfirmStatementID AS NVARCHAR(100)) DocumentId,
				   'ConfirmStatement'     DocumentType,
				   @ConfirmStatement + ' ' + cast(cst.Number as varchar(250)) + ' ' + @Contract + ' ' + cast(c.Number as varchar(250)) DocumentName,
				   CAST(cs.Number AS NVARCHAR(100)) Number,
				   cs.[Date],
				   CFG.GetCLRSaturnDate(cs.[Date], @DateFormat, 0, @DateType) DateString,
				   cst.CurrencyID,
				   cs.CurrencyRate,
				   case when pri.PaymentRequestItemID is null then vw.Remain else pri.Amount end as Non_Received,
				   null as PurchaseType,
				   p.DlID,
				   CASE WHEN @CultureNo = 1 then cur.Title else cur.Title2 END CurrencyTitle
			FROM   CNT.ConfirmStatement cs
			JOIN CNT.[Contract] c ON cs.ContractID = c.ContractID
			JOIN CNT.ContractStatement cst ON cst.ContractStatementID = cs.ContractStatementID
				 join cfg.Currency AS cur on cur.CurrencyID = cst.CurrencyID
			JOIN CFG.Party p ON cst.PartyID = p.PartyID
			JOIN CNT.vwConfirmStatementRemain	vw ON vw.ConfirmStatementID = cs.ConfirmStatementID		
			left JOIN REQ.PaymentRequestItem pri
				ON PaymentRequestID = @PaymentRequestID 
				AND BaseDocumentType = 4 
				AND pri.BaseDocumentID = cs.ConfirmStatementID	
			WHERE c.BranchID = @BranchID
				  AND (@DlID IS NULL OR p.DlID = @DlID)
				  AND cs.[Date] <= @Date 			  
				  AND
					   (@PaymentRequestID is null or 
					   pri.PaymentRequestItemID is not null )
				  AND cs.ConfirmStatus = 2

			UNION ALL
		
			/*کسور قابل پرداخت صورت وضعیت*/
			SELECT 'csi_' + CAST(csi.ConfirmStatementItemID AS NVARCHAR(100)) DocumentId,
				   'ConfirmStatementItem'     DocumentType,
				   case when @CultureNo = 1 then adt.Title else adt.Title2 end + ' ' + 
					 case when csi.ConfirmStatementID is not null then @FinancialConfirm else @PurchaseInvoice end + ' ' + 
					 case when csi.ConfirmStatementID is not null then CAST(cs.Number as nvarchar(50)) else ISNULL(pi.InvoiceNumber,pi.Number) end
					 + ' ' + @Contract + ' ' + cast(c.Number as varchar(250)) DocumentName,
				   case when csi.ConfirmStatementID is not null then CAST(cs.Number AS NVARCHAR(50))  else ISNULL(pi.InvoiceNumber,pi.Number) end Number,
				   case when csi.ConfirmStatementID is not null then cs.[Date] else isnull(pi.InvoiceDate,pi.Date) end [Date],
				   CFG.GetCLRSaturnDate(case when csi.ConfirmStatementID is not null then cs.[Date] else isnull(pi.InvoiceDate,pi.Date) end, @DateFormat, 0, @DateType) DateString,
				   case when csi.ConfirmStatementID is not null then cst.CurrencyID else pi.CurrencyID end CurrencyID,
				   case when csi.ConfirmStatementID is not null then cs.CurrencyRate else pi.CurrencyRate end CurrencyRate,
				   case when pri.PaymentRequestItemID is null then vw.Remain else pri.Amount end as Non_Received,
				   null PurchaseType,
				   case when pi.DlID is not null then pi.DlID
						else p.DlID end DlID,
				   CASE WHEN @CultureNo = 1 then cur.Title else cur.Title2 END CurrencyTitle
			FROM CNT.ConfirmStatementItem csi
			JOIN cnt.AdditionDeductionType adt ON adt.AdditionDeductionTypeID = csi.AdditionDeductionTypeID
			left JOIN CNT.ConfirmStatement cs ON csi.ConfirmStatementID = cs.ConfirmStatementID
			left JOIN CNT.ContractStatement cst ON cst.ContractStatementID = cs.ContractStatementID
			left JOIN CNT.[Contract] c ON cs.ContractID = c.ContractID
			left JOIN vnd.PurchaseInvoice pi ON pi.PurchaseInvoiceID = csi.PurchaseInvoiceID 
			JOIN CNT.vwConfirmStatementItemRemain vw ON vw.ConfirmStatementItemID = csi.ConfirmStatementItemID	  
			left JOIN REQ.PaymentRequestItem pri
				ON PaymentRequestID = @PaymentRequestID 
				AND pri.BaseDocumentType = 6
				AND pri.BaseDocumentID = csi.ConfirmStatementItemID		
			left JOIN cnt.ContractStatementDetail csd ON csd.ContractStatementDetailID = csi.BaseDocumentID
			left JOIN CFG.Party p ON case when  csi.BaseDocumentType = 3 then csd.PartyID else cst.PartyID end = p.PartyID
			join cfg.Currency AS cur on case when csi.ConfirmStatementID is not null then cst.CurrencyID else pi.CurrencyID END = cur.CurrencyID
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
				  AND (@PaymentRequestID is null or pri.PaymentRequestItemID is not null)
				  AND (pi.PurchaseInvoiceID is null or pi.Status = 2)
				  AND cs.ConfirmStatus = 2

			UNION ALL
		
			/*ارزش افزوده صورت وضعیت*/
			SELECT 'css_' + CAST(cs.ContractStatementID AS NVARCHAR(100)) DocumentId,
				   'ContractStatement'     DocumentType,         
					@ContractStatement + ' ' + cast(cs.Number as varchar(250))+ ' ' + @Contract + ' ' + cast(c.Number as varchar(250)) DocumentName,
					CAST(cs.Number AS NVARCHAR(100)) Number,
					cs.[Date],
					CFG.GetCLRSaturnDate(cs.[Date], @DateFormat, 0, @DateType) DateString,
					-1 CurrencyID,
					1 CurrencyRate,
					case when pri.PaymentRequestItemID is null then VatRemain else pri.Amount end as Non_Received,
					null PurchaseType,
				   p.DlID,
				   CASE WHEN @CultureNo = 1 then cur.Title else cur.Title2 END CurrencyTitle
			FROM CNT.ContractStatement cs
			join cfg.Currency AS cur on cur.CurrencyID = -1
			JOIN CNT.[Contract] c ON cs.ContractID = c.ContractID
			JOIN CFG.Party p ON cs.PartyID = p.PartyID
			JOIN CNT.vwContractStatementRemain vw ON vw.ContractStatementID = cs.ContractStatementID
			JOIN CNT.ConfirmStatement cfs ON cs.ContractStatementID = cfs.ContractStatementID
			left JOIN REQ.PaymentRequestItem pri
				ON PaymentRequestID = @PaymentRequestID 
				AND BaseDocumentType = 5 
				AND pri.BaseDocumentID = cs.ContractStatementID
			
			WHERE c.BranchID = @BranchID
				  AND (@DlID IS NULL OR p.DlID = @DlID)
				  AND c.[Date] <= @Date
				  AND (@PaymentRequestID is null or    pri.PaymentRequestItemID is not null )
				  AND cfs.ConfirmStatus = 2
		END 
		ELSE 
		BEGIN
			/*فاکتور خرید با ارزش افزوده برای فاکتورهایی که دارای تایید مالی نیستند*/
			SELECT CAST(p.PurchaseInvoiceID AS BIGINT) AS DocumentId,
				   'PurchaseInvoice'     DocumentType,
				   @PurchaseInvoice DocumentName,
				   case when p.InvoiceNumber is not null then p.InvoiceNumber else  CAST(p.Number AS NVARCHAR(100)) end Number,
				   p.[Date],
				   CFG.GetCLRSaturnDate(isnull(p.InvoiceDate,p.[Date]), @DateFormat, 0, @DateType) DateString,
				   p.CurrencyID,
				   p.CurrencyRate,
				   case when pri.PaymentRequestItemID is null then pa.NonPaymented else pri.Amount end as Non_Received,
				   case when @CultureNo = 1 then t.Title else t.title2 end PurchaseType,
				   p.DlID,
				   CASE WHEN @CultureNo = 1 then cur.Title else cur.Title2 END CurrencyTitle
			FROM   VND.PurchaseInvoice p
				 join cfg.Currency AS cur on cur.CurrencyID = p.CurrencyID
			JOIN VND.PurchaseInvoice_NonPaymented pa
				ON  p.PurchaseInvoiceID = pa.PurchaseInvoiceID
			JOIN VND.PurchaseType t ON p.[Type] = t.PurchaseTypeID
			left JOIN REQ.PaymentRequestItem pri
				ON pri.PaymentRequestID = @PaymentRequestID 
				AND BaseDocumentType = 2 
				AND pri.BaseDocumentID = p.PurchaseInvoiceID
			WHERE  p.BranchID = @BranchID
				   AND (@DlID IS NULL OR p.DlID = @DlID)
				   AND p.[Date] <= @Date	           
				   AND (@CurrencyID IS NULL OR p.CurrencyID = @CurrencyID) 
				   AND (@PaymentRequestID is null or pri.PaymentRequestItemID is not null)
				   AND p.Status = 2
				   AND t.HasConfirmStatement = 0
				   AND (@PaymentRequestID is not null or pa.NonPaymented > 0)
		END
	END
	
	IF (@Type = 2)
	BEGIN	
	
		IF @ComeFromManualReceipt = 0
		BEGIN
			SELECT 'rsi_' + CAST(r.ReturnedSaleInvoiceID AS NVARCHAR(100)) DocumentId,
				   'ReturnedSaleInvoice'     DocumentType,
				   @ReturnedSaleInvoice      DocumentName,
				   CAST(r.Number AS NVARCHAR(100)) Number,
				   r.[Date],
				   CFG.GetCLRSaturnDate(r.[Date], @DateFormat, 0, @DateType) DateString,
				   r.CurrencyID,
				   r.CurrencyRate,
				   case when pri.PaymentRequestItemID is null then rsi.NonPaymented else pri.Amount end as Non_Received,
				   null as PurchaseType,
				   p.DlID,
				   CASE WHEN @CultureNo = 1 then cur.Title else cur.Title2 END CurrencyTitle
			FROM   SLE.ReturnedSaleInvoice r
				 join cfg.Currency AS cur on cur.CurrencyID = r.CurrencyID
			JOIN CFG.Party p
				ON  r.CustomerID = p.PartyID
			JOIN SLE.ReturnedSaleInvoice_NonPaymented rsi
				ON  r.ReturnedSaleInvoiceID = rsi.ReturnedSaleInvoiceID
			left JOIN REQ.PaymentRequestItem pri
				ON PaymentRequestID = @PaymentRequestID 
				AND BaseDocumentType = 3
				AND pri.BaseDocumentID = r.ReturnedSaleInvoiceID	
			WHERE  r.BranchID = @BranchID
				   AND (@DlID IS NULL OR p.DlID = @DlID)
				   AND r.[Date] <= @Date	           
				   AND (@CurrencyID IS NULL OR r.CurrencyID = @CurrencyID)
				   AND r.BaseDocument = 1 
				  AND  (@PaymentRequestID is null or   pri.PaymentRequestItemID is not null )
		
			UNION ALL			
			
			SELECT  'inv_' + CAST(i.InvoiceID AS NVARCHAR(100)) DocumentId,
					'Invoice' DocumentType,
					@Sale DocumentName,
					CAST(i.Number AS NVARCHAR(100)) Number,
					i.[Date],
					CFG.GetCLRSaturnDate(i.[Date], @DateFormat, 0, @DateType) DateString,
					i.CurrencyID,
					i.CurrencyRate,
					abs(r.NonReceived) as Non_Received,
					null as PurchaseType,
					p.DlID	,
				   CASE WHEN @CultureNo = 1 then cur.Title else cur.Title2 END CurrencyTitle	
			FROM   SLE.Invoice i
				 join cfg.Currency AS cur on cur.CurrencyID = i.CurrencyID
			JOIN CFG.Party p
				ON  i.CustomerID = p.PartyID
			JOIN SLE.Invoice_NonReceived r
				ON  i.InvoiceID = r.InvoiceID
			WHERE  i.BranchID = @BranchID
					AND (@DlID IS NULL OR p.DlID = @DlID)
					AND i.Date <= @Date
					AND r.NonReceived < 0
					AND (@CurrencyID IS NULL OR i.CurrencyID = @CurrencyID)	
		END
		ELSE 
		BEGIN
			SELECT CAST(r.ReturnedSaleInvoiceID AS BIGINT) AS DocumentId,
				   'ReturnedSaleInvoice'     DocumentType,
				   @ReturnedSaleInvoice      DocumentName,
				   CAST(r.Number AS NVARCHAR(100)) Number,
				   r.[Date],
				   CFG.GetCLRSaturnDate(r.[Date], @DateFormat, 0, @DateType) DateString,
				   r.CurrencyID,
				   r.CurrencyRate,
				   case when pri.PaymentRequestItemID is null then rsi.NonPaymented else pri.Amount end as Non_Received,
				   null as PurchaseType,
				   p.DlID,
				   CASE WHEN @CultureNo = 1 then cur.Title else cur.Title2 END CurrencyTitle
			FROM   SLE.ReturnedSaleInvoice r
				 join cfg.Currency AS cur on cur.CurrencyID = r.CurrencyID
			JOIN CFG.Party p
				ON  r.CustomerID = p.PartyID
			JOIN SLE.ReturnedSaleInvoice_NonPaymented rsi
				ON  r.ReturnedSaleInvoiceID = rsi.ReturnedSaleInvoiceID
			left JOIN REQ.PaymentRequestItem pri
				ON PaymentRequestID = @PaymentRequestID 
				AND BaseDocumentType = 3
				AND pri.BaseDocumentID = r.ReturnedSaleInvoiceID	
			WHERE  r.BranchID = @BranchID
				   AND (@DlID IS NULL OR p.DlID = @DlID)
				   AND r.[Date] <= @Date	           
				   AND (@CurrencyID IS NULL OR r.CurrencyID = @CurrencyID)
				   AND r.BaseDocument = 1 
				  AND  (@PaymentRequestID is null or   pri.PaymentRequestItemID is not null )
		END

	END
	
	IF (@Type = 3)
	BEGIN
		IF	 @ComeFromManualReceipt = 0 
		BEGIN 
			SELECT   'ins_' +  CAST(ii.InstallmentPaymentItemID AS NVARCHAR(100))  	AS DocumentId,
				   'Installment'     DocumentType,
				   'قسط به شماره' +
						  CAST(ii.Number AS VARCHAR(50)) + ' از تقسیط به شماره ' + 
						  CAST(h.Number AS VARCHAR(50)) DocumentName,
				   CAST(ii.Number AS NVARCHAR(100)) Number,
				   ii.[Date],
				   CFG.GetCLRSaturnDate(ii.[Date], @DateFormat, 0, @DateType) DateString,
				   h.CurrencyID,
				   cast(1 as decimal) as CurrencyRate,
				   r.remain          Non_Received,
				   null as PurchaseType,
				   p.DlID,
				   CASE WHEN @CultureNo = 1 then cur.Title else cur.Title2 END CurrencyTitle
			FROM   cfg.InstallmentPayment h
				 join cfg.Currency AS cur on cur.CurrencyID = h.CurrencyID
			JOIN cfg.InstallmentPaymentItem ii
				ON  h.InstallmentPaymentID = ii.InstallmentPaymentID
			JOIN CFG.vwInstallmentPaymentRemain r
				ON  ii.InstallmentPaymentItemID = r.InstallmentPaymentItemID
			JOIN CFG.party p
				ON  h.PartyId = p.PartyID
			WHERE  h.BranchID = @BranchID
				   AND (@DlID IS NULL OR p.DlID = @DlID)      
				   AND h.InstallmentType = 2
				   AND (@CurrencyID IS NULL OR @CurrencyID = -1)
			Order by ii.[Date] 
		END
		ELSE 
		BEGIN
			SELECT  CAST(ii.InstallmentPaymentItemID AS BIGINT) 	AS DocumentId,
				   'Installment'     DocumentType,
				   'قسط به شماره' +
						  CAST(ii.Number AS VARCHAR(50)) + ' از تقسیط به شماره ' + 
						  CAST(h.Number AS VARCHAR(50)) DocumentName,
				   CAST(ii.Number AS NVARCHAR(100)) Number,
				   ii.[Date],
				   CFG.GetCLRSaturnDate(ii.[Date], @DateFormat, 0, @DateType) DateString,
				   h.CurrencyID,
				   cast(1 as decimal) as CurrencyRate,
				   r.remain          Non_Received,
				   null as PurchaseType,
				   p.DlID,
				   CASE WHEN @CultureNo = 1 then cur.Title else cur.Title2 END CurrencyTitle
			FROM   cfg.InstallmentPayment h
				 join cfg.Currency AS cur on cur.CurrencyID = h.CurrencyID
			JOIN cfg.InstallmentPaymentItem ii
				ON  h.InstallmentPaymentID = ii.InstallmentPaymentID
			JOIN CFG.vwInstallmentPaymentRemain r
				ON  ii.InstallmentPaymentItemID = r.InstallmentPaymentItemID
			JOIN CFG.party p
				ON  h.PartyId = p.PartyID
			WHERE  h.BranchID = @BranchID
				   AND (@DlID IS NULL OR p.DlID = @DlID)      
				   AND h.InstallmentType = 2
				   AND (@CurrencyID IS NULL OR @CurrencyID = -1)
			Order by ii.[Date] 
		END

	END
	
	IF (@Type = 10)
	BEGIN	

		SELECT @ConfigValue = LOWER(s.ConfigValue)
		FROM   CFG.Configuration s
		WHERE  s.ConfigKey = 'ProposalsNeededCommisionOpinion'

		SELECT 'cnt_' + CAST(c.PurchaseContractID AS NVARCHAR(100)) DocumentId,
			   'PurchaseContract'     DocumentType,
			   @PurchaseContract         DocumentName,
			   case when c.InvoiceNumber is not null then CAST(c.InvoiceNumber AS NVARCHAR(100))  else CAST(c.Number AS NVARCHAR(100)) end Number,
			   ISNULL(c.InvoiceDate,c.Date) [Date],
			   CFG.GetCLRSaturnDate(ISNULL(c.InvoiceDate,c.Date), @DateFormat, 0, @DateType) DateString,
			   c.CurrencyID,
			   cast(1 as decimal) as CurrencyRate,
			   case when pri.PaymentRequestItemID is null then pc.NonPaymented else pri.Amount end as Non_Received,
			   null as PurchaseType,
			   c.DlID,
			   CASE WHEN @CultureNo = 1 then c2.Title else c2.Title2 END CurrencyTitle
			   
			   
		FROM   VND.PurchaseContract c
		join cfg.Currency AS c2 on c2.CurrencyID = c.CurrencyID
		JOIN VND.PurchaseContract_NonPaymented pc
			ON  c.PurchaseContractID = pc.PurchaseContractID
		left JOIN REQ.PaymentRequestItem pri
			ON PaymentRequestID = @PaymentRequestID 
			AND BaseDocumentType = 9
			AND pri.BaseDocumentID = c.PurchaseContractID	
		WHERE  c.BranchID = @BranchID
			   AND (@DlID IS NULL OR c.DlID = @DlID)
			   AND c.[Date] <= @Date	  
			   AND c.[Status] != 2
			   AND (@CurrencyID IS NULL OR c.CurrencyID = @CurrencyID) 
			  AND   (@PaymentRequestID is null or 	   pri.PaymentRequestItemID is not null)

	  UNION all

		SELECT 'pos_' + CAST(p.ProposalID AS NVARCHAR(100)) DocumentId,
			   'Proposal'          DocumentType,
			   @Proposal      DocumentName,
			   case when p.QuotationNumber is not null then CAST(p.QuotationNumber AS NVARCHAR(100))  else  CAST(p.Number AS NVARCHAR(100)) end Number,
			   p.[Date],
			   CFG.GetCLRSaturnDate(p.[Date], @DateFormat, 0, @DateType) DateString,
			   p.CurrencyID,
			   cast(1 as decimal) as CurrencyRate,
			   case when pri.PaymentRequestItemID is null then pr.NonPaymented else pri.Amount end as Non_Received,
			   null as PurchaseType,
			   pa.DlID,
			   CASE WHEN @CultureNo = 1 then c2.Title else c2.Title2 END CurrencyTitle
		FROM   VND.Proposal p
		join cfg.Currency AS c2 on c2.CurrencyID = p.CurrencyID
		JOIN CFG.Party pa
			ON  p.PartyID = pa.PartyID
		JOIN VND.Proposal_NonPaymented pr
			ON  p.ProposalID = pr.ProposalID
		left JOIN REQ.PaymentRequestItem pri
			ON PaymentRequestID = @PaymentRequestID 
			AND BaseDocumentType = 8
			AND pri.BaseDocumentID = p.ProposalID
		WHERE  p.BranchID = @BranchID
			   AND (@DlID IS NULL OR pa.DlID = @DlID)
			   AND p.[Date] <= @Date	           
			   AND (@CurrencyID IS NULL OR p.CurrencyID = @CurrencyID)
			   AND (@ConfigValue <> 'true' OR p.[Status] = 2) 
			   AND (@PaymentRequestID is null or    pri.PaymentRequestItemID is not null  )

		UNION all

		
		SELECT 'prf_' + CAST(p.ProformaInvoiceID AS NVARCHAR(100)) DocumentId,
				'ProformaInvoice' DocumentType,
				@Proforma DocumentName,		
				CAST(p.Number AS NVARCHAR(100))  Number,
				p.[Date],
				CFG.GetCLRSaturnDate(p.[Date], @DateFormat, 0, @DateType) DateString,
				p.CurrencyID,
				cast(1 as decimal) as CurrencyRate,
				r.Remain Non_Received,
				null as PurchaseType,
				pa.DlID,
			   CASE WHEN @CultureNo = 1 then c2.Title else c2.Title2 END CurrencyTitle
		FROM   FOS.ProformaInvoice p
		join cfg.Currency AS c2 on c2.CurrencyID = p.CurrencyID
		JOIN CFG.Party pa
				ON  p.Vendor = pa.PartyID
		JOIN FOS.ProformaInvoice_Remain  r
				ON  p.ProformaInvoiceID = r.ProformaInvoiceID
		WHERE  p.BranchID = @BranchID
			AND (@DlID IS NULL OR pa.DlID = @DlID)
			AND p.[Date] <= @Date	        
			AND (@CurrencyID IS NULL OR p.CurrencyID = @CurrencyID)
			AND p.[Status] = 2

		union all

		SELECT 'con_' + CAST(c.ContractID AS NVARCHAR(100)) + '_' + CAST(vw.CurrencyID AS NVARCHAR(100)) DocumentId,
			   'Contract'     DocumentType,
			   @Contract      DocumentName,
			   CAST(c.Number AS NVARCHAR(100)) Number,
			   c.[Date],
			   CFG.GetCLRSaturnDate(c.[Date], @DateFormat, 0, @DateType) DateString,
			   vw.CurrencyID,
			   cast(1 as decimal) as CurrencyRate,
			   case when pri.PaymentRequestItemID is null then vw.Remain else pri.Amount end as Non_Received,
			   null as PurchaseType,
			   p.DlID,
			   CASE WHEN @CultureNo = 1 then c2.Title else c2.Title2 END CurrencyTitle
		FROM CNT.[Contract] c
		JOIN CFG.Party p ON c.PartyID = p.PartyID
		JOIN CNT.vwContractRemain vw ON vw.ContractID = c.ContractID
		join cfg.Currency AS c2 on c2.CurrencyID = vw.CurrencyID	  
		left JOIN REQ.PaymentRequestItem pri
			ON PaymentRequestID = @PaymentRequestID 
			AND BaseDocumentType = 7
			AND pri.BaseDocumentID = c.ContractID	
		WHERE c.BranchID = @BranchID
			  AND (@DlID IS NULL OR ( (c.ContractNature <> 3 AND p.DlID = @DlID)
										or
									  (c.ContractNature = 3 AND  @DlID in (select b.DlID from cnt.ContractParty a
																		   JOIN cfg.Party b ON a.PartyID = b.PartyID
																		   where ContractID = c.ContractID))
									)
				  )
			  AND c.[Date] <= @Date 
			  AND(@PaymentRequestID is null or  pri.PaymentRequestItemID is not null  )
			  and c.Status = 2

	END
	
	IF (@Type = 11)
	BEGIN
	
		SELECT @ConfigValue = ConfigValue
		FROM   cfg.Configuration
		WHERE  ConfigKey = 'AgreementNeedConfirm'
			  
		SELECT *
		INTO   #agreement
		FROM   (
				   SELECT ROW_NUMBER() OVER(
							  PARTITION BY a.PersonelID
							  ORDER BY CASE 
											WHEN LOWER(@ConfigValue) = 'false' THEN IssueDate
											ELSE ConfirmDate
									   END DESC
						  ) Rno,
						  a.PersonelID,
						  pa.DlID
				   FROM   HRM.Agreement a
						  JOIN HRM.Personel p
							   ON  a.PersonelID = p.PersonelID
						  JOIN CFG.Party pa
							   ON  p.PartyID = pa.PartyID
				   WHERE  (LOWER(@ConfigValue) = 'false' OR ConfirmedBy IS NOT NULL)
						  AND (
								  CASE 
									   WHEN LOWER(@ConfigValue) = 'false' THEN IssueDate
									   ELSE ConfirmDate
								  END
							  ) <= @Date
						  AND a.BranchID = @BranchID
						  AND pa.DlID = @DlID
			   ) A
		WHERE  Rno = 1

		IF @ComeFromManualReceipt = 0
		BEGIN
			SELECT 'cal_' + CAST(c.CalculationResultID AS NVARCHAR(100)) DocumentId,
				   'CalculationResult'     DocumentType,
				   case @CultureNo
						when 1 then ct.Title
						when 2 then ct.Title2
				   end as DocumentName,
				   CAST(cal.[Year] AS NVARCHAR(100)) + '/' + cm.[MonthName] Number,
				   cm.StartDate [Date],
				   CFG.GetCLRSaturnDate(cm.StartDate, @DateFormat, 0, @DateType) DateString,
				   -1  CurrencyID,
				   cast(1 as decimal) as CurrencyRate,
				   np.remain AS Non_Received,
				   null as PurchaseType,
				   c.[Value]               NetPay,
				   a.DlID,
				   CASE WHEN @CultureNo = 1 then cur.Title else cur.Title2 END CurrencyTitle
			FROM   PAY.CalculationResult c
			join cfg.Currency AS cur on cur.CurrencyID = -1
				   JOIN PAY.CalculationPersonel ca
						ON  c.CalculationPersonelID = ca.CalculationPersonelID
				   JOIN PAY.CalculationType ct
						ON  ca.CalculationTypeID = ct.CalculationTypeID
				   JOIN HRM.CalendarMonth cm
						ON  ca.CalendarMonthID = cm.CalendarMonthID
				   JOIN HRM.Calendar cal
						ON  cm.CalendarID = cal.CalendarID
				   JOIN pay.Parameter pa
						ON  pa.ParameterID = c.ParameterID
				   JOIN #agreement a
						ON  ca.PersonelID = a.PersonelID
				   JOIN [PAY].[CalculationResult_NonPayment] np ON np.CalculationResultID = c.CalculationResultID   
				   left JOIN pay.SettlementCalculation sc ON ca.CalculationPersonelID = sc.BaseCalculationPersonelID
			WHERE ct.IsPayable=1 AND  (@CurrencyID IS NULL OR @CurrencyID = -1) 
			AND sc.SettlementCalculationID is null
		
			union all
		
			SELECT 'prp_' + CAST(p.PayPreparingID AS NVARCHAR(100)) DocumentId,
				   'PayPreparing'     DocumentType,
				   case @CultureNo
						when 2 then t.Title2
						else t.Title
				   end as DocumentName,	           
				   CAST(p.Number AS NVARCHAR(100)) + ' - ' + CAST(cal.[Year] AS NVARCHAR(100)) + '/' + cm.[MonthName] Number,
				   cm.StartDate [Date],
				   CFG.GetCLRSaturnDate(cm.StartDate, @DateFormat, 0, @DateType) DateString,
				   -1 CurrencyID,	
				   cast(1 as decimal) as CurrencyRate,        
				   vw.RequestedAndPaidRemain as Non_Received,
				   null as PurchaseType,
				   vw.[Value]               NetPay,
				   null DlID,
				   CASE WHEN @CultureNo = 1 then cur.Title else cur.Title2 END CurrencyTitle
			FROM PAY.PayPreparing p	
			join cfg.Currency AS cur on cur.CurrencyID = -1
			JOIN HRM.CalendarMonth cm ON p.CalendarMonthID = cm.CalendarMonthID	
			JOIN HRM.Calendar cal ON cm.CalendarID = cal.CalendarID
			JOIN PAY.PayrollPaymentType t ON p.PayrollPaymentTypeID = t.PayrollPaymentTypeID
			JOIN PAY.vwPayPreparingRemain vw ON p.PayPreparingID = vw.PayPreparingID	   
			WHERE p.BranchID = @BranchID
			  AND vw.RequestedAndPaidRemain>0
		
		END
		ELSE
		BEGIN
			SELECT CAST(c.CalculationResultID AS BIGINT) AS DocumentId,
				   'CalculationResult'     DocumentType,
				   case @CultureNo
						when 1 then ct.Title
						when 2 then ct.Title2
				   end as DocumentName,
				   CAST(cal.[Year] AS NVARCHAR(100)) + '/' + cm.[MonthName] Number,
				   cm.StartDate [Date],
				   CFG.GetCLRSaturnDate(cm.StartDate, @DateFormat, 0, @DateType) DateString,
				   -1  CurrencyID,
				   cast(1 as decimal) as CurrencyRate,
				   np.remain AS Non_Received,
				   null as PurchaseType,
				   c.[Value]               NetPay,
				   a.DlID,
				   CASE WHEN @CultureNo = 1 then cur.Title else cur.Title2 END CurrencyTitle
			FROM   PAY.CalculationResult c
			join cfg.Currency AS cur on cur.CurrencyID = -1
				   JOIN PAY.CalculationPersonel ca
						ON  c.CalculationPersonelID = ca.CalculationPersonelID
				   JOIN PAY.CalculationType ct
						ON  ca.CalculationTypeID = ct.CalculationTypeID
				   JOIN HRM.CalendarMonth cm
						ON  ca.CalendarMonthID = cm.CalendarMonthID
				   JOIN HRM.Calendar cal
						ON  cm.CalendarID = cal.CalendarID
				   JOIN pay.Parameter pa
						ON  pa.ParameterID = c.ParameterID
				   JOIN #agreement a
						ON  ca.PersonelID = a.PersonelID
				   JOIN [PAY].[CalculationResult_NonPayment] np ON np.CalculationResultID = c.CalculationResultID   
				   left JOIN pay.SettlementCalculation sc ON ca.CalculationPersonelID = sc.BaseCalculationPersonelID
			WHERE ct.IsPayable=1 AND  (@CurrencyID IS NULL OR @CurrencyID = -1) 
			AND sc.SettlementCalculationID is null
		END 
	END

	if (@Type = 12)
	begin

		SELECT 'crt_' + CAST(c.ContractID AS NVARCHAR(100)) +'_'+ CAST(vw.CurrencyID AS NVARCHAR(100)) DocumentId,
			   'Contract'     DocumentType,
			   @Contract      DocumentName,
			   CAST(c.Number AS NVARCHAR(100)) Number,
			   c.[Date],
			   CFG.GetCLRSaturnDate(c.[Date], @DateFormat, 0, @DateType) DateString,
			   vw.CurrencyID,
			   cast(1 as decimal) as CurrencyRate,
			   case when pri.PaymentRequestItemID is null then vw.Remain else pri.Amount end as Non_Received,
			   null as PurchaseType,
			   p.DlID,
				   CASE WHEN @CultureNo = 1 then cur.Title else cur.Title2 END CurrencyTitle
		FROM CNT.[Contract] c
		JOIN CFG.Party p ON c.PartyID = p.PartyID
		JOIN CNT.vwContractRemain vw ON vw.ContractID = c.ContractID
		 join cfg.Currency AS cur on cur.CurrencyID = vw.CurrencyID			  
		left JOIN REQ.PaymentRequestItem pri
			ON pri.PaymentRequestID = @PaymentRequestID 
			AND pri.BaseDocumentType = 7
			AND pri.BaseDocumentID = c.ContractID			
		WHERE c.BranchID = @BranchID
			  AND (@DlID IS NULL OR ( (c.ContractNature <> 3 AND p.DlID = @DlID)
										or
									  (c.ContractNature = 3 AND  @DlID in (select b.DlID from cnt.ContractParty a
																		   JOIN cfg.Party b ON a.PartyID = b.PartyID
																		   where ContractID = c.ContractID))
									)
				  )
			  AND (@DlID IS NULL OR p.DlID = @DlID)
			  AND c.[Date] <= @Date 
			  AND (@PaymentRequestID is null or pri.PaymentRequestItemID is not null)
			  AND c.Status = 2
	end
END;
