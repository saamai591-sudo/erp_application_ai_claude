
CREATE   PROC [FIN].[GetPaymentOrderItemForPaymentSubjectByOrder]
(
	@PaymentOrderId INT
)
AS
BEGIN
	DECLARE @UserID INT,
			@DateType TINYINT,
			@DateFormat VARCHAR(10),
			@Culture NVARCHAR(10)

	SET @UserID = CFG.GetuserID()

	SET @Culture = cfg.GetuserCulture()	

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

	SELECT CAST(ROW_NUMBER() OVER (ORDER BY poi.PaymentOrderItemID) AS INT) AS RowIndex,
	   po.BaseType,
	   poi.BankAccountID,
	   d.Title AS PettyCashTitle,
	   d.Code AS PettyCashCode,
	   dl.Code AS BankAccountCode,
	   dl.Title AS BankAccountTitle,
	   poi.ReceiverID,
	   csi.ConfirmStatementItemID,
	   po.PaymentCurrencyID AS CurrencyID,
	   case when po.PaymentCurrencyID = -1 then CAST(1 AS DECIMAL(30, 4)) else null end CurrencyRate,
	   poi.Price,
	   CASE
		   WHEN pii.PurchaseInvoiceID IS NOT NULL THEN
			   pii.CurrencyRate
		   WHEN r.ReturnedSaleInvoiceID IS NOT NULL THEN
			   r.CurrencyRate
		   WHEN cs.ConfirmStatementID IS NOT NULL THEN
			   cs.CurrencyRate
		   WHEN csi.ConfirmStatementItemID IS NOT NULL THEN isnull(cs2.CurrencyRate,pii2.CurrencyRate)
		   WHEN cs1.ContractStatementID IS NOT NULL THEN
			   cs3.CurrencyRate
		   ELSE
			   1
	   END AS BaseCurrencyRate,
	   poi.BaseCurrencyID,
	   pri.BaseDocumentType,
	   pri.BaseDocumentID,
		CASE WHEN pa.PartyID is not null THEN pa.PartyID 
			 WHEN pa1.PartyID is not null THEN pa1.PartyID 
			 WHEN pa2.PartyID is not null THEN pa2.PartyID 
			 WHEN pa3.PartyID is not null THEN pa3.PartyID 
			 WHEN pa4.PartyID is not null THEN pa4.PartyID 
		ELSE null END   AS PartyID, 
		CASE WHEN dl1.Title is not null THEN dl1.Title 
			 WHEN dl2.Title is not null THEN dl2.Title 
			 WHEN dl3.Title is not null THEN dl3.Title 
			 WHEN dl4.Title is not null THEN dl4.Title 
		ELSE null END AS ReceiverTitle,
		CASE WHEN dl1.Code is not null THEN dl1.Code 
			 WHEN dl2.Code is not null THEN dl2.Code 
			 WHEN dl3.Code is not null THEN dl3.Code 
			 WHEN dl4.Code is not null THEN dl4.Code 
		ELSE null END AS ReceiverCode,
	   CASE
	   WHEN po.BaseType = 1 THEN
		   CAST(ppr.Number AS NVARCHAR(50))
	   WHEN po.BaseType = 2 THEN
			(	
				CASE
					WHEN pri.BaseDocumentType = 1 THEN
						'0'
					WHEN pri.BaseDocumentType = 2 THEN
						ISNULL(pii.InvoiceNumber, CAST(pii.Number AS NVARCHAR(50)))
					WHEN pri.BaseDocumentType = 3 THEN
						CAST(r.Number AS NVARCHAR(50))
					WHEN pri.BaseDocumentType = 4 THEN
						CAST(cs.Number AS NVARCHAR(50))
					WHEN pri.BaseDocumentType = 5 THEN
						CAST(cs1.Number AS NVARCHAR(50))
					WHEN pri.BaseDocumentType = 6 THEN
						CAST(cs3.Number AS NVARCHAR(50))
					WHEN pri.BaseDocumentType = 7 THEN
						CAST(c.Number AS NVARCHAR(50))
					WHEN pri.BaseDocumentType = 8 THEN
						CAST(p.Number AS NVARCHAR(50))
					WHEN pri.BaseDocumentType = 9 THEN
						CAST(pc.Number AS NVARCHAR(50))
					WHEN pri.BaseDocumentType = 10 THEN
						d2.Code
					WHEN pri.BaseDocumentType = 11 THEN
						CAST(cpi.Number AS NVARCHAR(50))
					WHEN pri.BaseDocumentType = 12 THEN
						ISNULL(pii.InvoiceNumber, CAST(pii.Number AS NVARCHAR(50)))
					WHEN pri.BaseDocumentType = 13 THEN
						ISNULL(pii3.InvoiceNumber, CAST(pii3.Number AS NVARCHAR(50)))
				END
			)
		 WHEN po.BaseType = 3 THEN
			 NULL
		 WHEN po.BaseType = 4 THEN
			 NULL
	 END AS BaseNumber,
	 CASE
					WHEN pri.BaseDocumentType = 1 THEN
						'BaseTypes_WithoutBase_1'
					WHEN pri.BaseDocumentType = 2 THEN
						'BaseDocuments_PurchaseInvoice_18'
					WHEN pri.BaseDocumentType = 3 THEN
						'BaseDocuments_ReturnedSale_22'
					WHEN pri.BaseDocumentType = 4 THEN
						'BaseDocuments_ConfirmStatement_2'
					WHEN pri.BaseDocumentType = 5 THEN
						'BaseDocuments_ContractStatement_5'
					WHEN pri.BaseDocumentType = 6 THEN
						'BaseDocuments_ConfirmStatement_2'
					WHEN pri.BaseDocumentType = 7 THEN
						'BaseDocuments_Contract_4'
					WHEN pri.BaseDocumentType = 8 THEN
						'BaseDocuments_Proposal_16'
					WHEN pri.BaseDocumentType = 9 THEN
						'BaseDocuments_PurchaseContract_17'
					WHEN pri.BaseDocumentType = 10 THEN
						'BaseDocuments_PettyCash'
					WHEN pri.BaseDocumentType = 11 THEN
						'BaseDocuments_ConfirmPurchaseInvoice_19'
					WHEN pri.BaseDocumentType = 12 THEN
						'BaseDocuments_PurchaseInvoice_18'
					WHEN pri.BaseDocumentType = 13 THEN
						'BaseDocuments_ConfirmPurchaseInvoice_19'
	END AS BaseDocumentName,
		   CASE
					WHEN pri.BaseDocumentType = 2 THEN
						pii.Date
					WHEN pri.BaseDocumentType = 3 THEN
						r.Date
					WHEN pri.BaseDocumentType = 4 THEN
						cs.Date
					WHEN pri.BaseDocumentType = 5 THEN
						cs1.Date
					WHEN pri.BaseDocumentType = 6 THEN
						cs3.Date
					WHEN pri.BaseDocumentType = 7 THEN
						c.Date
					WHEN pri.BaseDocumentType = 8 THEN
						p.Date
					WHEN pri.BaseDocumentType = 9 THEN
						pc.Date
					WHEN pri.BaseDocumentType = 10 THEN
						ptc.CreationDate
					WHEN pri.BaseDocumentType = 11 THEN
						cpi.Date
					WHEN pri.BaseDocumentType = 12 THEN
						pii.Date
					WHEN pri.BaseDocumentType = 13 THEN
						pii3.Date
	END AS BaseDocumentDate,
	 CASE
					WHEN pri.BaseDocumentType = 2 THEN
						CFG.GetCLRSaturnDate(pii.Date, @DateFormat, 0, @DateType)
					WHEN pri.BaseDocumentType = 3 THEN
						CFG.GetCLRSaturnDate(r.Date, @DateFormat, 0, @DateType)
					WHEN pri.BaseDocumentType = 4 THEN
						CFG.GetCLRSaturnDate(cs.Date, @DateFormat, 0, @DateType)
					WHEN pri.BaseDocumentType = 5 THEN
						CFG.GetCLRSaturnDate(cs1.Date, @DateFormat, 0, @DateType)
					WHEN pri.BaseDocumentType = 6 THEN
						CFG.GetCLRSaturnDate(cs3.Date, @DateFormat, 0, @DateType)
					WHEN pri.BaseDocumentType = 7 THEN
						CFG.GetCLRSaturnDate(c.Date, @DateFormat, 0, @DateType)
					WHEN pri.BaseDocumentType = 8 THEN
						CFG.GetCLRSaturnDate(p.Date, @DateFormat, 0, @DateType)
					WHEN pri.BaseDocumentType = 9 THEN
						CFG.GetCLRSaturnDate(pc.Date, @DateFormat, 0, @DateType)
					WHEN pri.BaseDocumentType = 10 THEN
						CFG.GetCLRSaturnDate(ptc.CreationDate, @DateFormat, 0, @DateType)
					WHEN pri.BaseDocumentType = 11 THEN
						CFG.GetCLRSaturnDate(cpi.Date, @DateFormat, 0, @DateType)
					WHEN pri.BaseDocumentType = 12 THEN
						CFG.GetCLRSaturnDate(pii.Date, @DateFormat, 0, @DateType)
					WHEN pri.BaseDocumentType = 13 THEN
						CFG.GetCLRSaturnDate(pii3.Date, @DateFormat, 0, @DateType)
	END AS BaseDocumentDateString,
	 case when po.PaymentCurrencyID = -1 then poi.ExchangeRate else null end ExchangeRate,
	   po.PaymentOrderID,
	   po.[Description],
	   po.Description2,
	   poi.Description ItemDescription,
	   poi.Description2 ItemDescription2,
	   ppr.PayPreparingID,
	   pii.PurchaseInvoiceID,
	   r.ReturnedSaleInvoiceID,
	   CASE 
			WHEN po.BaseType = 2 AND pri.BaseDocumentType = 4 THEN cs.ConfirmStatementID
			WHEN po.BaseType = 2 AND pri.BaseDocumentType = 6 THEN cs3.ConfirmStatementID
			ELSE NULL 
	   END AS  ConfirmStatementID,
	   cs1.ContractStatementID,
	   c.ContractID,
	   p.ProposalID,
	   pc.PurchaseContractID,
	   ptc.PettyCashID,
	   cpi.ConfirmPurchaseInvoiceID,
	   cpii.ConfirmPurchaseInvoiceItemID,
	   CASE
			WHEN pri.BaseDocumentType = 2 THEN pii.CurrencyID
			WHEN pri.BaseDocumentType = 3 THEN r.CurrencyID
			WHEN pri.BaseDocumentType = 4 THEN cst4.CurrencyID
			WHEN pri.BaseDocumentType = 5 THEN -1
			WHEN pri.BaseDocumentType = 6 THEN CASE WHEN cs2.ConfirmStatementID IS NOT NULL THEN cst6.CurrencyID ELSE pii2.CurrencyID END
			WHEN pri.BaseDocumentType = 8 THEN p.CurrencyID
			WHEN pri.BaseDocumentType = 9 THEN pc.CurrencyID
			WHEN pri.BaseDocumentType = 11 THEN pii4.CurrencyID
			WHEN pri.BaseDocumentType = 12 THEN -1
			WHEN pri.BaseDocumentType = 13 THEN pii3.CurrencyID
			ELSE pri.CurrencyID
	   END AS BaseDocumentCurrencyID,
	   CASE
			WHEN pri.BaseDocumentType = 2 THEN pii.CurrencyRate
			WHEN pri.BaseDocumentType = 3 THEN r.CurrencyRate
			WHEN pri.BaseDocumentType = 4 THEN cs.CurrencyRate
			WHEN pri.BaseDocumentType = 6 THEN CASE WHEN cs2.ConfirmStatementID IS NOT NULL THEN cs2.CurrencyRate ELSE pii2.CurrencyRate END
			WHEN pri.BaseDocumentType = 11 THEN pii4.CurrencyRate
			WHEN pri.BaseDocumentType = 13 THEN pii3.CurrencyRate
			ELSE 1
	   END AS BaseDocumentCurrencyRate
	FROM REQ.PaymentOrderItem AS poi
		JOIN REQ.PaymentOrder AS po
			ON po.PaymentOrderID = poi.PaymentOrderID
		LEFT JOIN REQ.PaymentRequestItem AS pri
			ON pri.PaymentRequestItemID = poi.PaymentRequestItemID
	   LEFT JOIN FIN.PettyCash ptc
			ON ptc.PettyCashID = pri.BaseDocumentID AND pri.BaseDocumentType = 10
	   LEFT JOIN FIN.Fund AS f ON f.FundID = ptc.FundID
	   LEFT JOIN ACC.DL AS d2 ON d2.DLID = f.DlID
	   LEFT JOIN CFG.Party pa
			ON pa.PartyID = ptc.PartyID
	   LEFT JOIN ACC.DL d
			ON d.DLID = pa.DlID
		LEFT JOIN REQ.PaymentRequest pr
			ON pr.PaymentRequestID = pri.PaymentRequestID
		LEFT JOIN CFG.Party pa1
			ON pa1.PartyID = pri.PartyID
		LEFT JOIN ACC.DL dl1
			ON dl1.DLID = pa1.DlID
		LEFT JOIN CFG.BankAccount ba
			ON ba.BankAccountID = poi.BankAccountID
		LEFT JOIN ACC.DL dl
			ON dl.DLID = ba.DlID
		LEFT JOIN PAY.PayPreparing ppr
			ON ppr.PayPreparingID = poi.PayPreparingID
		LEFT JOIN VND.PurchaseInvoice AS pii
			ON pii.PurchaseInvoiceID = pri.BaseDocumentID
			AND (pri.BaseDocumentType = 2 OR pri.BaseDocumentType = 12)
		LEFT JOIN SLE.ReturnedSaleInvoice AS r
			ON r.ReturnedSaleInvoiceID = pri.BaseDocumentID
			AND pri.BaseDocumentType = 3
		LEFT JOIN CNT.ConfirmStatement AS cs
			ON cs.ConfirmStatementID = pri.BaseDocumentID
			   AND pri.BaseDocumentType = 4
		LEFT JOIN CNT.ContractStatement AS cs1
			ON cs1.ContractStatementID = pri.BaseDocumentID
			AND pri.BaseDocumentType = 5
		LEFT JOIN CNT.ConfirmStatement AS cs3
			ON cs3.ContractStatementID = cs1.ContractStatementID
		LEFT JOIN CNT.ConfirmStatementItem AS csi
			ON csi.ConfirmStatementItemID = pri.BaseDocumentID
			AND pri.BaseDocumentType = 6
		LEFT JOIN CNT.ConfirmStatement AS cs2
			ON cs2.ConfirmStatementID = csi.ConfirmStatementID
		LEFT JOIN VND.PurchaseInvoice AS pii2
			ON pii2.PurchaseInvoiceID = csi.PurchaseInvoiceID
		LEFT JOIN CNT.[Contract] AS c
			ON c.ContractID = pri.BaseDocumentID
			AND pri.BaseDocumentType = 7
		LEFT JOIN VND.Proposal AS p
			ON p.ProposalID = pri.BaseDocumentID
			AND pri.BaseDocumentType = 8
		LEFT JOIN VND.PurchaseContract AS pc
			ON pc.PurchaseContractID = pri.BaseDocumentID
			AND pri.BaseDocumentType = 9
		LEFT JOIN VND.ConfirmPurchaseInvoice AS cpi
			ON cpi.ConfirmPurchaseInvoiceID = pri.BaseDocumentID
			AND pri.BaseDocumentType = 11
		LEFT JOIN VND.ConfirmPurchaseInvoiceItem AS cpii
			ON cpii.ConfirmPurchaseInvoiceItemID = pri.BaseDocumentID
			AND pri.BaseDocumentType = 13 
		LEFT JOIN VND.ConfirmPurchaseInvoice AS cpi1
			ON cpi1.ConfirmPurchaseInvoiceID = cpii.ConfirmPurchaseInvoiceID
			LEFT JOIN VND.PurchaseInvoice pii3
			ON pii3.PurchaseInvoiceID = cpi1.PurchaseInvoiceID
			LEFT JOIN VND.PurchaseInvoice pii4
			ON pii4.PurchaseInvoiceID = cpi.PurchaseInvoiceID
			LEFT JOIN CNT.ContractStatement cst4
			ON cst4.ContractStatementID = cs.ContractStatementID
			LEFT JOIN CNT.ContractStatement cst6
			ON cst6.ContractStatementID = cs2.ContractStatementID
		LEFT JOIN VND.VWConfirmPurchaseInvoiceItemNonePayment v
			ON cpii.ConfirmPurchaseInvoiceItemID = v.ConfirmPurchaseInvoiceItemID 
			AND  v.NonPayment > 0
		LEFT JOIN REQ.advancepaymentrequest AS apr
			ON apr.AdvancePaymentRequestID = poi.AdvancePaymentRequestID
		LEFT JOIN HRM.Personel AS prs
			ON prs.PersonelID = apr.PersonelID
		LEFT JOIN CFG.Party pa2
			ON pa2.PartyID = prs.PartyID
		LEFT JOIN ACC.DL dl2
			ON dl2.DLID = pa2.DlID
		LEFT JOIN REQ.LoanRequest AS lr
			ON lr.LoanRequestID = poi.LoanRequestID
		LEFT JOIN HRM.Personel AS prs1
			ON prs1.PersonelID = lr.PersonelID
		LEFT JOIN CFG.Party pa3
			ON pa3.PartyID = prs1.PartyID
		LEFT JOIN ACC.DL dl3
			ON dl3.DLID = pa3.DlID
		LEFT JOIN CFG.Party pa4
			ON pa4.PartyID = poi.ReceiverID
		LEFT JOIN ACC.DL dl4
			ON dl4.DLID = pa4.DlID
	WHERE poi.PaymentOrderID = @PaymentOrderId;
END;

