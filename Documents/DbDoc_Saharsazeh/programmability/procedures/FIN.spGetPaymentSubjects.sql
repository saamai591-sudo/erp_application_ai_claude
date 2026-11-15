
CREATE   PROC [FIN].[spGetPaymentSubjects]
(@PaymentReceiptID INT)
--WITH ENCRYPTION
AS
BEGIN
	DECLARE @UserID INT,
			@DateType TINYINT,
			@DateFormat NVARCHAR(10),
			@Culture NVARCHAR(5),
			@CultureNo CHAR(1);

	SET @Culture = CFG.GetuserCulture();

	SELECT @CultureNo = CultureNo
	FROM CFG.CultureInfo
	WHERE Culture = @Culture;

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
		SET @DateFormat = N'YY/MM/DD';

	SELECT s.PaymentSubjectID,
		   CASE
			   WHEN s.PaymentBankDraftID IS NOT NULL THEN
				   s.PaymentBankDraftID
			   WHEN s.PaymentCheqeID IS NOT NULL THEN
				   s.PaymentCheqeID
			   WHEN s.PaymentOtherCheqeID IS NOT NULL THEN
				   s.PaymentOtherCheqeID
			   WHEN s.PaymentCashID IS NOT NULL THEN
				   s.PaymentCashID
			   ELSE
				   NULL
		   END AS ItemId,
		   CASE
			   WHEN s.PaymentBankDraftID IS NOT NULL THEN
				   bd.RowIndex
			   WHEN s.PaymentCheqeID IS NOT NULL THEN
				   ch.RowIndex
			   WHEN s.PaymentOtherCheqeID IS NOT NULL THEN
				   o.RowIndex
			   WHEN s.PaymentCashID IS NOT NULL THEN
				   ca.RowIndex
			   ELSE
				   CAST(0 AS SMALLINT)
		   END AS ItemNumber,
		   CASE
			   WHEN s.PaymentBankDraftID IS NOT NULL THEN
				   'bankDraft'
			   WHEN s.PaymentCheqeID IS NOT NULL THEN
				   'cheque'
			   WHEN s.PaymentOtherCheqeID IS NOT NULL THEN
				   'otherCheque'
			   WHEN s.PaymentCashID IS NOT NULL THEN
				   'cash'
			   ELSE
				   NULL
		   END AS ItemType,
		   CASE
			   WHEN s.PaymentBankDraftID IS NOT NULL THEN
				   bd.CurrencyID
			   WHEN s.PaymentCheqeID IS NOT NULL THEN
				   ch.CurrencyID
			   WHEN s.PaymentOtherCheqeID IS NOT NULL THEN
				   rc.CurrencyID
			   WHEN s.PaymentCashID IS NOT NULL THEN
				   ca.CurrencyID
			   ELSE
				   NULL
		   END AS ItemCurrency,
		   0.0000 AS ItemRemain
	INTO #Items
	FROM FIN.PaymentSubject s
		LEFT JOIN FIN.PaymentBankDraft bd
			ON s.PaymentBankDraftID = bd.PaymentBankDraftID
		LEFT JOIN FIN.PaymentCheqe ch
			ON s.PaymentCheqeID = ch.PaymentCheqeID
		LEFT JOIN FIN.PaymentOtherCheqe o
			ON s.PaymentOtherCheqeID = o.PaymentOtherCheqeID
		LEFT JOIN FIN.PaymentCash ca
			ON s.PaymentCashID = ca.PaymentCashID
		LEFT JOIN FIN.ReceivedCheqe rc
			ON o.ReceivedCheqeID = rc.ReceivedCheqeID
	WHERE s.PaymentReceiptID = @PaymentReceiptID;


SELECT pc.PettyCashID,
		p.PartyID,
		d2.Code AS FundDlCode,
	   d.DLID,
	   d.DlTypeID,
	   d.Code PartyCode,
	   f.Title ,
	   f.Title2 ,
	   CASE
		   WHEN p.Type = 1
				OR p.Type = 2 THEN
			   p.Title
		   ELSE
			   p.Title + ' ' + p.LastName
	   END AS PartyName,
	   CASE
		   WHEN p.Type = 1
				OR p.Type = 2 THEN
			   p.Title2
		   ELSE
			   p.Title2 + ' ' + p.LastName2
	   END AS PartyName2
INTO #pettyCashes
FROM FIN.PettyCash AS pc
JOIN FIN.Fund AS f ON f.FundID = pc.FundID
JOIN ACC.DL AS d2 ON d2.DLID = f.DlID
	JOIN CFG.Party p
		ON p.PartyID = pc.PartyID
	LEFT JOIN ACC.DL d
		ON p.DlID = d.DLID;


	SELECT s.PaymentSubjectID,
		   CASE
			   WHEN s.PurchaseInvoiceID IS NOT NULL THEN
				  'pur_' + CAST(s.PurchaseInvoiceID AS NVARCHAR(50))
			   WHEN s.ConfirmPurchaseInvoiceID IS NOT NULL THEN
				  'cnp_' + CAST(s.ConfirmPurchaseInvoiceID AS NVARCHAR(50))
			   WHEN s.ConfirmPurchaseInvoiceItemID IS NOT NULL THEN
				  'cpi_' + CAST(s.ConfirmPurchaseInvoiceItemID AS NVARCHAR(50))
			   WHEN s.ReturnedSaleInvoiceID IS NOT NULL THEN
				   'rsi_' + CAST(s.ReturnedSaleInvoiceID AS NVARCHAR(50))
			   WHEN s.InstallmentPaymentItemID IS NOT NULL THEN
				  'ins_' + CAST(s.InstallmentPaymentItemID AS NVARCHAR(50))
			   WHEN s.PurchaseContractID IS NOT NULL THEN
				   'cnt_' + CAST(s.PurchaseContractID AS NVARCHAR(50))
			   WHEN s.ProposalID IS NOT NULL THEN
				   'pos_' + CAST(s.ProposalID AS NVARCHAR(50))
			   WHEN s.CalculationResultID IS NOT NULL THEN
				   'cal_' +CAST(s.CalculationResultID AS NVARCHAR(50))
			   WHEN s.PayPreparingID IS NOT NULL THEN
				   'prp_' + CAST(s.PayPreparingID AS NVARCHAR(50))
			   WHEN s.InvoiceID IS NOT NULL THEN
				   'inv_' + CAST(s.InvoiceID AS NVARCHAR(50))
			   WHEN s.ProformaInvoiceID IS NOT NULL THEN
				   'prf_' + CAST(s.ProformaInvoiceID AS NVARCHAR(50))
			   WHEN s.ConfirmStatementID IS NOT NULL THEN
				   'cst_' + CAST(s.ConfirmStatementID AS NVARCHAR(50))
			   WHEN s.ConfirmStatementItemID IS NOT NULL THEN
				   'csi_' + CAST(s.ConfirmStatementItemID AS NVARCHAR(50))
			   WHEN s.ContractID IS NOT NULL THEN
				   'con_' +CAST(s.ContractID AS NVARCHAR(50))
			   WHEN s.ContractStatementID IS NOT NULL THEN
				   'css_' + CAST(s.ContractStatementID AS NVARCHAR(50))
			   WHEN s.PettyCashID IS NOT NULL THEN
				   'ptc_' + CAST(s.PettyCashID AS NVARCHAR(50))
		   END AS BaseDocumentId,
		   CASE
			   WHEN s.PurchaseInvoiceID IS NOT NULL THEN
				   'PurchaseInvoice'
			   WHEN s.ConfirmPurchaseInvoiceID IS NOT NULL THEN
				   'ConfirmPurchaseInvoiceID'
			   WHEN s.ConfirmPurchaseInvoiceItemID IS NOT NULL THEN
				   'ConfirmPurchaseInvoiceItemID'
			   WHEN s.ReturnedSaleInvoiceID IS NOT NULL THEN
				   'ReturnedSaleInvoice'
			   WHEN s.InstallmentPaymentItemID IS NOT NULL THEN
				   'Installment'
			   WHEN s.PurchaseContractID IS NOT NULL THEN
				   'PurchaseContract'
			   WHEN s.ProposalID IS NOT NULL THEN
				   'Proposal'
			   WHEN s.CalculationResultID IS NOT NULL THEN
				   'CalculationResult'
			   WHEN s.PayPreparingID IS NOT NULL THEN
				   'PayPreparing'
			   WHEN s.InvoiceID IS NOT NULL THEN
				   'Invoice'
			   WHEN s.ProformaInvoiceID IS NOT NULL THEN
				   'ProformaInvoice'
			   WHEN s.ConfirmStatementID IS NOT NULL THEN
				   'ConfirmStatement'
			   WHEN s.ConfirmStatementItemID IS NOT NULL THEN
				   'ConfirmStatementItem'
			   WHEN s.ContractID IS NOT NULL THEN
				   'Contract'
			   WHEN s.ContractStatementID IS NOT NULL THEN
				   'ContractStatement'
			   WHEN s.PettyCashID IS NOT NULL THEN
					CAST(s.PettyCashID AS NVARCHAR(50))
		   END AS BaseDocumentType,
		   CASE
			   WHEN s.PurchaseInvoiceID IS NOT NULL THEN
				   CAST(isnull(pur.InvoiceNumber,pur.Number)AS NVARCHAR(100))
			   WHEN s.ConfirmPurchaseInvoiceID IS NOT NULL THEN
				   CAST(c.Number AS NVARCHAR(100))
			   WHEN s.ConfirmPurchaseInvoiceItemID IS NOT NULL THEN 
				   CAST(cpii.Number AS NVARCHAR(100))
			   WHEN s.ReturnedSaleInvoiceID IS NOT NULL THEN
				   CAST(rsi.Number AS NVARCHAR(100))
			   WHEN s.InstallmentPaymentItemID IS NOT NULL THEN
				   CAST(ipi.Number AS NVARCHAR(100))
			   WHEN s.PurchaseContractID IS NOT NULL THEN
				   CAST(isnull(pc.InvoiceNumber,pc.Number)AS NVARCHAR(100))
			   WHEN s.ProposalID IS NOT NULL THEN
				   CAST(prp.Number AS NVARCHAR(100))
			   WHEN s.CalculationResultID IS NOT NULL THEN
				   CAST(cr.Number AS NVARCHAR(100))
			   WHEN s.PayPreparingID IS NOT NULL THEN
				   CAST(paypre.Number AS NVARCHAR(100))
			   WHEN s.InvoiceID IS NOT NULL THEN
				   CAST(inv.Number AS NVARCHAR(100))
			   WHEN s.ProformaInvoiceID IS NOT NULL THEN
				   CAST(prf.Number AS NVARCHAR(100))
			   WHEN s.ConfirmStatementID IS NOT NULL THEN
				   CAST(cnf.Number AS NVARCHAR(100))
			   WHEN s.ConfirmStatementItemID IS NOT NULL THEN
					CAST(cnfi.Number AS NVARCHAR(100))
			   WHEN s.ContractID IS NOT NULL THEN
				   CAST(con.Number AS NVARCHAR(100))
			   WHEN s.ContractStatementID IS NOT NULL THEN
				   CAST(st.Number AS NVARCHAR(100))
			   WHEN s.PettyCashID IS NOT NULL THEN
				   CAST(ptc.FundDlCode AS NVARCHAR(100))
		   END AS BaseDocumentNumber,
		   CASE
			   WHEN s.PurchaseInvoiceID IS NOT NULL and pt.HasConfirmStatement = 0 THEN
				   'BaseDocuments_PurchaseInvoice_18'
			   WHEN s.PurchaseInvoiceID IS NOT NULL and pt.HasConfirmStatement = 1 THEN
				   'BaseDocuments_PurchaseInvoice_18' --To Do
			   WHEN s.ConfirmPurchaseInvoiceID IS NOT NULL THEN
				   c.Description
			   WHEN s.ConfirmPurchaseInvoiceItemID IS NOT NULL THEN
				   cpii.Description
			   WHEN s.ReturnedSaleInvoiceID IS NOT NULL THEN
				   'BaseDocuments_ReturnedSale_22'
			   WHEN s.InstallmentPaymentItemID IS NOT NULL THEN
				   'BaseDocuments_InstallmentPayment_10'
			   WHEN s.PurchaseContractID IS NOT NULL THEN
				   'BaseDocuments_PurchaseContract_17'
			   WHEN s.ProposalID IS NOT NULL THEN
				   'BaseDocuments_Proposal_16'
			   WHEN s.CalculationResultID IS NOT NULL THEN
				   cr.Title
			   WHEN s.PayPreparingID IS NOT NULL THEN
				   paypre.Title
			   WHEN s.InvoiceID IS NOT NULL THEN
				   'BaseDocuments_Invoice_11'
			   WHEN s.ProformaInvoiceID IS NOT NULL THEN
				   'BaseDocuments_ProformaInvoice_15'
			   WHEN s.ConfirmStatementID IS NOT NULL THEN
				   'BaseDocuments_ConfirmStatement_2' + ' '+ CAST(cnf.ContractStatementNumber AS NVARCHAR(50))
			   WHEN s.ConfirmStatementItemID IS NOT NULL THEN
				   cnfi.Description
			   WHEN s.ContractID IS NOT NULL THEN
				   'BaseDocuments_Contract_4'
			   WHEN s.ContractStatementID IS NOT NULL THEN
				   'BaseDocuments_ContractStatement_5'
			   ELSE 
				''
		   END AS BaseDocumentName,
		   CASE
			   WHEN s.PurchaseInvoiceID IS NOT NULL THEN
				   isnull(pur.invoicedate,pur.Date)
			   WHEN s.ConfirmPurchaseInvoiceID IS NOT NULL THEN
					c.Date
			   WHEN s.ConfirmPurchaseInvoiceItemID IS NOT NULL THEN
					cpii.Date
			   WHEN s.ReturnedSaleInvoiceID IS NOT NULL THEN
				   rsi.Date
			   WHEN s.InstallmentPaymentItemID IS NOT NULL THEN
				   ipi.Date
			   WHEN s.PurchaseContractID IS NOT NULL THEN
				   isnull(pc.invoicedate,pc.Date)
			   WHEN s.ProposalID IS NOT NULL THEN
				   prp.Date
			   WHEN s.CalculationResultID IS NOT NULL THEN
				   cr.EndDate
			   WHEN s.PayPreparingID IS NOT NULL THEN
				   paypre.EndDate
			   WHEN s.InvoiceID IS NOT NULL THEN
				   inv.Date
			   WHEN s.ProformaInvoiceID IS NOT NULL THEN
				   prf.Date
			   WHEN s.ConfirmStatementID IS NOT NULL THEN
				   cnf.Date
			   WHEN s.ConfirmStatementItemID IS NOT NULL THEN
				   cnfi.Date
			   WHEN s.ContractID IS NOT NULL THEN
				   con.Date
			   WHEN s.ContractStatementID IS NOT NULL THEN
				   st.Date
		   END AS BaseDocumentDate,
		   s.BaseDocumentCurrencyID AS BaseDocumentCurrencyID,
		   s.BaseDocumentCurrencyRate AS BaseDocumentCurrencyRate
	INTO #BaseDocument
	FROM FIN.PaymentSubject s
		LEFT JOIN #pettyCashes ptc
			ON s.PettyCashID = ptc.PettyCashID
		LEFT JOIN VND.PurchaseInvoice pur
			ON s.PurchaseInvoiceID = pur.PurchaseInvoiceID
		LEFT JOIN VND.PurchaseType pt 
			ON pt.PurchaseTypeID = pur.Type
		LEFT JOIN 
		(select a.ConfirmPurchaseInvoiceID,
				a.Number,
				cast(isnull(b.InvoiceNumber,b.number) as nvarchar(100)) InvoiceNumber,
				a.Date,
				b.CurrencyID,
				b.CurrencyRate,
				'BaseDocuments_ConfirmPurchaseInvoice_19' Description
		from VND.ConfirmPurchaseInvoice a
		join VND.PurchaseInvoice b on a.PurchaseInvoiceID = b.PurchaseInvoiceID
		)c 
			ON c.ConfirmPurchaseInvoiceID = s.ConfirmPurchaseInvoiceID
		LEFT JOIN SLE.ReturnedSaleInvoice rsi
			ON s.ReturnedSaleInvoiceID = rsi.ReturnedSaleInvoiceID
		LEFT JOIN CFG.InstallmentPaymentItem ipi
			ON s.InstallmentPaymentItemID = ipi.InstallmentPaymentItemID
		LEFT JOIN VND.PurchaseContract pc
			ON s.PurchaseContractID = pc.PurchaseContractID
		LEFT JOIN
		(
			SELECT i.ConfirmPurchaseInvoiceItemID,
					CASE WHEN s.ConfirmPurchaseInvoiceItemID IS NOT NULL THEN pi.Number 
						 ELSE cs.Number
					END Number,
					CASE WHEN s.ConfirmPurchaseInvoiceItemID IS NOT NULL THEN pi.Date 
						 ELSE cs.Date
					END Date,
					pi.CurrencyRate,
					pi.CurrencyID,
				   CASE @CultureNo WHEN 2 THEN adt.Title2 ELSE adt.Title END AdditionDeductionType,
				   CASE WHEN s.ConfirmPurchaseInvoiceItemID IS NOT NULL THEN 'BaseDocuments_ConfirmPurchaseInvoice_19'
						 ELSE CASE @CultureNo WHEN 2 THEN adt.Title2 ELSE adt.Title END + ' ' + 'BaseDocuments_PurchaseInvoice_18'+ ' ' + cast(isnull(pi.InvoiceNumber,pi.number) as nvarchar(100)) 
					END Description
			FROM VND.ConfirmPurchaseInvoiceItem i
			left JOIN VND.ConfirmPurchaseInvoice  cs ON i.ConfirmPurchaseInvoiceID = cs.ConfirmPurchaseInvoiceID
			left join vnd.PurchaseInvoice pi on pi.PurchaseInvoiceID = cs.PurchaseInvoiceID
			LEFT JOIN FIN.PaymentSubject s ON s.ConfirmPurchaseInvoiceItemID = i.ConfirmPurchaseInvoiceItemID
			join cnt.AdditionDeductionType adt
				ON adt.AdditionDeductionTypeID = i.AdditionDeductionTypeID
		) cpii
			ON s.ConfirmPurchaseInvoiceItemID = cpii.ConfirmPurchaseInvoiceItemID
		LEFT JOIN VND.Proposal prp
			ON s.ProposalID = prp.ProposalID
		LEFT JOIN
		(
			SELECT cr.CalculationResultID,
				   CAST(ca.Year AS NVARCHAR(10)) + ' ' + cm.MonthName AS Number,
				   cm.EndDate,
				   CASE @CultureNo
					   WHEN 2 THEN
						   ct.Title2
					   ELSE
						   ct.Title
				   END AS Title
			FROM PAY.CalculationResult cr
				JOIN PAY.CalculationPersonel AS cp
					ON cr.CalculationPersonelID = cp.CalculationPersonelID
				JOIN PAY.CalculationType ct
					ON cp.CalculationTypeID = ct.CalculationTypeID
				JOIN HRM.CalendarMonth cm
					ON cp.CalendarMonthID = cm.CalendarMonthID
				JOIN HRM.Calendar ca
					ON cm.CalendarID = ca.CalendarID
		) cr
			ON s.CalculationResultID = cr.CalculationResultID
		LEFT JOIN SLE.Invoice inv
			ON s.InvoiceID = inv.InvoiceID
		LEFT JOIN
		(
			SELECT p.PayPreparingID,
				   CAST(p.Number AS VARCHAR(100)) + ' - ' + CAST(ca.Year AS NVARCHAR(10)) + ' ' + cm.MonthName AS Number,
				   cm.EndDate,
				   CASE @CultureNo
					   WHEN 2 THEN
						   pt.Title2
					   ELSE
						   pt.Title
				   END AS Title
			FROM PAY.PayPreparing p
				JOIN HRM.CalendarMonth cm
					ON p.CalendarMonthID = cm.CalendarMonthID
				JOIN HRM.Calendar ca
					ON cm.CalendarID = ca.CalendarID
				JOIN PAY.PayrollPaymentType pt
					ON p.PayrollPaymentTypeID = pt.PayrollPaymentTypeID
		) paypre
			ON s.PayPreparingID = paypre.PayPreparingID
		LEFT JOIN FOS.ProformaInvoice prf
			ON s.ProformaInvoiceID = prf.ProformaInvoiceID
		LEFT JOIN
		(
			SELECT cs.ConfirmStatementID,
				   cs.Number,
				   cs.Date,
				   cs2.CurrencyID,
				   cs.CurrencyRate,
				   cs2.Number ContractStatementNumber
			FROM CNT.ConfirmStatement cs
			JOIN CNT.ContractStatement AS cs2 ON cs2.ContractStatementID = cs.ContractStatementID
		) cnf
			ON s.ConfirmStatementID = cnf.ConfirmStatementID
		LEFT JOIN
		(
			SELECT i.ConfirmStatementItemID,
				   isnull(cast(cs.Number as varchar(100)) ,cast(isnull(pi.InvoiceNumber,pi.number) as varchar(100))) Number,
				   isnull(cs.Date,isnull(pi.Date,pi.Date)) Date,
				   isnull(cs.CurrencyRate,pi.CurrencyRate) CurrencyRate,
				   isnull(cs3.CurrencyID,pi.CurrencyID) CurrencyID,
				   CASE @CultureNo WHEN 2 THEN adt.Title2 ELSE adt.Title END AdditionDeductionType,
				   CASE @CultureNo WHEN 2 THEN adt.Title2 ELSE adt.Title END + ' ' + 
				   case when i.ConfirmStatementID is not null then 'BaseDocuments_ContractStatement_5'
						+ ' ' + cast(cs.Number as varchar(100)) 
						when i.PurchaseInvoiceID  is not null then 'BaseDocuments_PurchaseInvoice_18'
						+ ' ' + cast(isnull(pi.InvoiceNumber,pi.number) as varchar(100)) 
						end 
						Description
			FROM CNT.ConfirmStatementItem i
			left JOIN CNT.ConfirmStatement  cs ON i.ConfirmStatementID = cs.ConfirmStatementID
			left JOIN CNT.ContractStatement cs3 ON cs3.ContractStatementID = cs.ContractStatementID
			left join vnd.PurchaseInvoice pi on pi.PurchaseInvoiceID = i.PurchaseInvoiceID
			join cnt.AdditionDeductionType adt
				ON adt.AdditionDeductionTypeID = i.AdditionDeductionTypeID
		) cnfi
			ON s.ConfirmStatementItemID = cnfi.ConfirmStatementItemID
		LEFT JOIN CNT.Contract con
			ON s.ContractID = con.ContractID
		LEFT JOIN
		(
			SELECT cs.ContractStatementID,
				   cs.Number,
				   cs.Date,
				   cs.CurrencyID,
				   cons.CurrencyRate AS CurrencyRate
			FROM CNT.ContractStatement cs
			JOIN CNT.ConfirmStatement cons
				ON cs.ContractStatementID = cons.ContractStatementID
		) st
			ON s.ContractStatementID = st.ContractStatementID
	WHERE s.PaymentReceiptID = @PaymentReceiptID;

	SELECT s.PaymentSubjectID,
		   s.Allocation,
		   s.PaymentReceiptID,
		   s.PettyCashID,
		   s.RowIndex,
		   s.PaymentBankDraftID,
		   s.PaymentCheqeID,
		   s.PaymentOtherCheqeID,
		   s.PaymentCashID,
		   s.PaymentTypeID,
		   CASE @CultureNo
			   WHEN 2 THEN
				   t.Title2
			   ELSE
				   t.Title
		   END AS PaymentTypeTitle,
		   t.Type AS PaymentTypeType,
		   s.DLID,
		   s.DLID AS DocumentDlID,
		   d.Code AS DocumentDlCode,
		   CASE @CultureNo
				WHEN 2 THEN
					d.Title2
				ELSE
					d.Title
			END AS DocumentDlTitle,
		   s.PurchaseInvoiceID,
		   s.ConfirmPurchaseInvoiceID,
		   s.ConfirmPurchaseInvoiceItemID,
		   s.ReturnedSaleInvoiceID,
		   s.InstallmentPaymentItemID,
		   s.PurchaseContractID,
		   s.ProposalID,
		   s.CalculationResultID,
		   s.PayPreparingID,
		   s.InvoiceID,
		   s.ProformaInvoiceID,
		   s.ConfirmStatementID,
		   s.ConfirmStatementItemID,
		   s.ContractID,
		   s.ContractStatementID,
		   s.CurrencyID,
		   CASE @CultureNo WHEN 2 THEN c.Title2 ELSE c.Title END AS CurrencyName,
		   s.CurrencyRate,
		   s.Amount,
		   s.Discount,
		   s.Description,
		   s.Description2,
		   s.Version,
		   s.Creator,
		   s.CreationDate,
		   i.ItemId,
		   i.ItemNumber,
		   i.ItemType,
		   i.ItemRemain,
		   i.ItemCurrency,
		   bd.BaseDocumentId,
		   bd.BaseDocumentNumber,
		   bd.BaseDocumentType,
		   bd.BaseDocumentName,
		   bd.BaseDocumentDate,
		   s.BaseDocumentCurrencyID AS BaseDocumentCurrencyID,
		   s.BaseDocumentCurrencyRate AS BaseDocumentCurrencyRate,
		   CFG.GetCLRSaturnDate(bd.BaseDocumentDate, @DateFormat, 0, @DateType) BaseDocumentDateString,
		   CAST(CASE
					WHEN pip.PaymentSubjectID IS NOT NULL THEN
						1
					ELSE
						0
				END AS BIT) AS Used,
		   CAST(CASE
					WHEN FIN.PaymentSubjectHasFlow(s.PaymentSubjectID) = 1 THEN
						0
					ELSE
						1
				END AS BIT) AS IsNotInFlow
	FROM FIN.PaymentSubject s
		LEFT JOIN #pettyCashes AS pc
			ON pc.PettyCashID = s.PettyCashID
		LEFT JOIN CFG.Party AS pcp
			ON pcp.PartyID = pc.PartyID
		LEFT JOIN ACC.DL AS pcpd
			ON pcpd.DLID = pcp.DlID
		JOIN FIN.PaymentReceipt r
			ON s.PaymentReceiptID = r.PaymentReceiptID
		JOIN FIN.PaymentType t
			ON s.PaymentTypeID = t.PaymentTypeID
		LEFT JOIN ACC.DL d
			ON s.DLID = d.DLID
		JOIN CFG.Currency c
			ON s.CurrencyID = c.CurrencyID
		JOIN #Items i
			ON s.PaymentSubjectID = i.PaymentSubjectID
		JOIN #BaseDocument bd
			ON s.PaymentSubjectID = bd.PaymentSubjectID
		LEFT JOIN
		(
			SELECT PaymentSubjectID
			FROM VND.PurchaseInvoicePrePayment
			WHERE PaymentSubjectID IS NOT NULL
			GROUP BY PaymentSubjectID
		) pip
			ON s.PaymentSubjectID = pip.PaymentSubjectID
	WHERE s.PaymentReceiptID = @PaymentReceiptID;

END;

