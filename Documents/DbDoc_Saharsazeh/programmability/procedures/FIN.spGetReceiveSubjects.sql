------------------------------------- START #7335

CREATE   PROC [FIN].[spGetReceiveSubjects]
(@ReceiveReceiptID INT)
--WITH ENCRYPTION
AS
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
    SET @DateType = CASE CFG.GetuserCulture()
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

SELECT s.ReceiveSubjectID,
       CASE
           WHEN s.ReceivedBankDraftID IS NOT NULL THEN
               s.ReceivedBankDraftID
           WHEN s.ReceivedCheqeID IS NOT NULL THEN
               s.ReceivedCheqeID
           WHEN s.ReceivedCashID IS NOT NULL THEN
               s.ReceivedCashID
           ELSE
               NULL
       END AS ItemId,
       CASE
           WHEN s.ReceivedBankDraftID IS NOT NULL THEN
               bd.RowIndex
           WHEN s.ReceivedCheqeID IS NOT NULL THEN
               ch.RowIndex
           WHEN s.ReceivedCashID IS NOT NULL THEN
               ca.RowIndex
           ELSE
               CAST(0 AS SMALLINT)
       END AS ItemNumber,
       CASE
           WHEN s.ReceivedBankDraftID IS NOT NULL THEN
               'bankDraft'
           WHEN s.ReceivedCheqeID IS NOT NULL THEN
               'cheque'
           WHEN s.ReceivedCashID IS NOT NULL THEN
               'cash'
           ELSE
               NULL
       END AS ItemType,
       CASE
           WHEN s.ReceivedBankDraftID IS NOT NULL THEN
               bd.CurrencyID
           WHEN s.ReceivedCheqeID IS NOT NULL THEN
               ch.CurrencyID
           WHEN s.ReceivedCashID IS NOT NULL THEN
               ca.CurrencyID
           ELSE
               NULL
       END AS ItemCurrency,
       0.0000 AS ItemRemain
INTO #Items
FROM FIN.ReceiveSubject s
    LEFT JOIN FIN.ReceivedBankDraft bd
        ON s.ReceivedBankDraftID = bd.ReceivedBankDraftID
    LEFT JOIN FIN.ReceivedCheqe ch
        ON s.ReceivedCheqeID = ch.ReceivedCheqeID
    LEFT JOIN FIN.ReceivedCash ca
        ON s.ReceivedCashID = ca.ReceivedCashID;

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

SELECT s.ReceiveSubjectID,
       CASE
           WHEN s.InvoiceID IS NOT NULL THEN
               CAST(s.InvoiceID AS NVARCHAR(50))
		   WHEN c.ConfirmPurchaseInvoiceID IS NOT NULL THEN
               CAST(c.ConfirmPurchaseInvoiceID AS NVARCHAR(50))
           WHEN s.ReturnInvoiceID IS NOT NULL THEN
               CAST(s.ReturnInvoiceID AS NVARCHAR(50))
           WHEN s.InstallmentPaymentItemID IS NOT NULL THEN
               CAST(s.InstallmentPaymentItemID AS NVARCHAR(50))
           WHEN s.PurchaseInvoiceID IS NOT NULL THEN
               CAST(s.PurchaseInvoiceID AS NVARCHAR(50))
           WHEN s.QuotationID IS NOT NULL THEN
               CAST(s.QuotationID AS NVARCHAR(50))
           WHEN s.SaleContractID IS NOT NULL THEN
               CAST(s.SaleContractID AS NVARCHAR(50))
           WHEN s.ConfirmStatementID IS NOT NULL THEN
               CAST(s.ConfirmStatementID AS NVARCHAR(50))
           WHEN s.ConfirmStatementItemID IS NOT NULL THEN
               CAST(s.ConfirmStatementItemID AS NVARCHAR(50))
           WHEN s.ContractID IS NOT NULL THEN
               CAST(s.ContractID AS NVARCHAR(50))
           WHEN s.ContractStatementID IS NOT NULL THEN
               CAST(s.ContractStatementID AS NVARCHAR(50))
		   WHEN s.PettyCashID IS NOT NULL THEN
               CAST(s.PettyCashID AS NVARCHAR(50))
       END AS DocumentId,
       CASE
           WHEN s.InvoiceID IS NOT NULL THEN
               CAST(inv.Number AS NVARCHAR(50))
		   WHEN c.ConfirmPurchaseInvoiceID IS NOT NULL THEN
               CAST(c.Number AS NVARCHAR(50))
           WHEN s.ReturnInvoiceID IS NOT NULL THEN
               CAST(ri.Number AS NVARCHAR(50))
           WHEN s.InstallmentPaymentItemID IS NOT NULL THEN
               CAST(ipi.Number AS NVARCHAR(50))
           WHEN s.PurchaseInvoiceID IS NOT NULL THEN
               CAST(pur.Number AS NVARCHAR(50))
           WHEN s.QuotationID IS NOT NULL THEN
               CAST(q.Number AS NVARCHAR(50))
           WHEN s.SaleContractID IS NOT NULL THEN
               CAST(sc.Number AS NVARCHAR(50))
           WHEN s.ConfirmStatementID IS NOT NULL THEN
               CAST(cnf.Number AS NVARCHAR(50))
           WHEN s.ConfirmStatementItemID IS NOT NULL THEN
               CAST(cnfi.Number AS NVARCHAR(50))
           WHEN s.ContractID IS NOT NULL THEN
               CAST(con.Number AS NVARCHAR(50))
           WHEN s.ContractStatementID IS NOT NULL THEN
               CAST(st.Number AS NVARCHAR(50))
		   WHEN s.PettyCashID IS NOT NULL THEN
               CAST(ptc.FundDlCode AS NVARCHAR(50))
       END AS DocumentNumber,
       CASE
           WHEN s.InvoiceID IS NOT NULL THEN
               'Invoice'
           WHEN s.ReturnInvoiceID IS NOT NULL THEN
               'ReturnInvoice'
           WHEN s.InstallmentPaymentItemID IS NOT NULL THEN
               'Installment'
           WHEN s.PurchaseInvoiceID IS NOT NULL THEN
               'PurchaseInvoice'
		   WHEN c.ConfirmPurchaseInvoiceID IS NOT NULL THEN
               'ConfirmPurchaseInvoice'
           WHEN s.QuotationID IS NOT NULL THEN
               'Quotation'
           WHEN s.SaleContractID IS NOT NULL THEN
               'SaleContract'
           WHEN s.ConfirmStatementID IS NOT NULL THEN
               'ConfirmStatement'
           WHEN s.ConfirmStatementItemID IS NOT NULL THEN
               'ConfirmStatementItem'
           WHEN s.ContractID IS NOT NULL THEN
               'Contract'
           WHEN s.ContractStatementID IS NOT NULL THEN
               'ContractStatement'
       END AS DocumentType,
       CASE
           WHEN s.InvoiceID IS NOT NULL THEN
               'BaseDocuments_Invoice_11'
           WHEN s.ReturnInvoiceID IS NOT NULL THEN
               'ManualReceiptSubject_returnInvoice_7'
           WHEN s.InstallmentPaymentItemID IS NOT NULL THEN
               CAST(ipi.HeaderNumber AS NVARCHAR(50))
           WHEN s.PurchaseInvoiceID IS NOT NULL THEN
               'BaseDocuments_PurchaseInvoice_18'
           WHEN s.QuotationID IS NOT NULL THEN
               'BaseDocuments_Quotation_24'
           WHEN s.SaleContractID IS NOT NULL THEN
               'BaseDocuments_SaleContract_25'
           WHEN s.ConfirmStatementID IS NOT NULL THEN
               'BaseDocuments_ConfirmStatement_2'
           WHEN s.ConfirmStatementItemID IS NOT NULL THEN
               'BaseDocuments_ConfirmStatementItem_3'
           WHEN s.ContractID IS NOT NULL THEN
               'BaseDocuments_Contract_4'
           WHEN s.ContractStatementID IS NOT NULL THEN
               'BaseDocuments_ContractStatement_5'
			WHEN s.ContractStatementID IS NOT NULL THEN
               'BaseDocuments_ConfirmPurchaseInvoice_19'
       END AS DocumentName,
       CASE
           WHEN s.InvoiceID IS NOT NULL THEN
               inv.Date
           WHEN s.ReturnInvoiceID IS NOT NULL THEN
               ri.Date
           WHEN s.InstallmentPaymentItemID IS NOT NULL THEN
               ipi.Date
           WHEN s.PurchaseInvoiceID IS NOT NULL THEN
               pur.Date
           WHEN s.QuotationID IS NOT NULL THEN
               q.Date
           WHEN s.SaleContractID IS NOT NULL THEN
               sc.Date
           WHEN s.ConfirmStatementID IS NOT NULL THEN
               cnf.Date
           WHEN s.ConfirmStatementItemID IS NOT NULL THEN
               cnfi.Date
           WHEN s.ContractID IS NOT NULL THEN
               con.Date
           WHEN s.ContractStatementID IS NOT NULL THEN
               st.Date
		   WHEN c.ConfirmPurchaseInvoiceID IS NOT NULL THEN
               c.Date
       END AS DocumentDate,
	   CASE
		  WHEN s.ReturnInvoiceID IS NOT NULL THEN
               ri.CurrencyID

           WHEN s.PurchaseInvoiceID IS NOT NULL THEN
               pur.CurrencyID

           WHEN s.ConfirmStatementID IS NOT NULL THEN
               cnf.CurrencyID

           WHEN s.ContractStatementID IS NOT NULL THEN
              st.CurrencyID

           WHEN s.InvoiceID IS NOT NULL THEN
               inv.CurrencyID
			 WHEN c.ConfirmPurchaseInvoiceID IS NOT NULL THEN
               pur.CurrencyID

			ELSE 
				NULL

       END AS  BaseCurrencyID,

		CASE
		  WHEN s.ReturnInvoiceID IS NOT NULL THEN
               ri.CurrencyRate

           WHEN s.PurchaseInvoiceID IS NOT NULL THEN
               pur.CurrencyRate

           WHEN s.ConfirmStatementID IS NOT NULL THEN
               cnf.CurrencyRate

           WHEN s.ContractStatementID IS NOT NULL THEN
              st.CurrencyRate

           WHEN s.InvoiceID IS NOT NULL THEN
               inv.CurrencyRate
		    WHEN c.ConfirmPurchaseInvoiceID IS NOT NULL THEN
               pur.CurrencyRate

			ELSE 
				NULL

       END AS BaseCurrencyRate
INTO #BaseDocument
FROM FIN.ReceiveSubject s
	LEFT JOIN #pettyCashes ptc
        ON s.PettyCashID = ptc.PettyCashID
    LEFT JOIN SLE.Invoice inv
        ON s.InvoiceID = inv.InvoiceID
    LEFT JOIN VND.ReturnInvoice ri
        ON s.ReturnInvoiceID = ri.ReturnInvoiceID
    LEFT JOIN
    (
        SELECT i.InstallmentPaymentItemID,
               i.Number,
               p.Number HeaderNumber,
               i.Date
        FROM CFG.InstallmentPaymentItem i
            JOIN CFG.InstallmentPayment p
                ON i.InstallmentPaymentID = p.InstallmentPaymentID
    ) ipi
        ON s.InstallmentPaymentItemID = ipi.InstallmentPaymentItemID
    LEFT JOIN VND.PurchaseInvoice pur
        ON s.PurchaseInvoiceID = pur.PurchaseInvoiceID
    LEFT JOIN VND.ConfirmPurchaseInvoice c
	    ON c.ConfirmPurchaseInvoiceID = s.ConfirmPurchaseInvoiceID
    LEFT JOIN SLE.Quotation q
        ON s.QuotationID = q.QuotationID
    LEFT JOIN SLE.SaleContract sc
        ON s.SaleContractID = sc.SaleContractID
    LEFT JOIN
    (
        SELECT cs.ConfirmStatementID,
               c.Number,
               c.Date,
			   cs.CurrencyRate,
			   cs2.CurrencyID
        FROM CNT.ConfirmStatement cs
			JOIN CNT.ContractStatement AS cs2 
				ON cs2.ContractStatementID = cs.ContractStatementID
            JOIN CNT.Contract c
                ON cs.ContractID = c.ContractID
    ) cnf
        ON s.ConfirmStatementID = cnf.ConfirmStatementID
    LEFT JOIN
    (
        SELECT i.ConfirmStatementItemID,
               c.Number,
               c.Date
        FROM CNT.ConfirmStatementItem i
            JOIN CNT.ConfirmStatement cs
                ON i.ConfirmStatementID = cs.ConfirmStatementID
            JOIN CNT.Contract c
                ON cs.ContractID = c.ContractID
    ) cnfi
        ON s.ConfirmStatementItemID = cnfi.ConfirmStatementItemID
    LEFT JOIN CNT.Contract con
        ON s.ContractID = con.ContractID
    LEFT JOIN
    (
        SELECT cs.ContractStatementID,
               c.Number,
               c.Date,
			   cs.CurrencyID,
			   cs3.CurrencyRate
        FROM CNT.ContractStatement cs
			JOIN CNT.ConfirmStatement AS cs3 
				ON cs3.ContractStatementID = cs.ContractStatementID
            JOIN CNT.Contract c
                ON cs.ContractID = c.ContractID

    ) st
        ON s.ContractStatementID = st.ContractStatementID;

SELECT s.ReceiveSubjectID,
       s.ReceiveReceiptID,
       s.RowIndex,
       s.ReceivedBankDraftID,
       s.ReceivedCheqeID,
       s.ReceivedCashID,
       s.ReceiptTypeID,
       CASE @CultureNo
           WHEN 2 THEN
               t.Title2
           ELSE
               t.Title
       END AS ReceiptTypeTitle,
	   t.Type as ReceiptTypeType,
       s.DLID,
       s.InvoiceID,
       s.PurchaseInvoiceID,

       s.ReturnInvoiceID,
       s.InstallmentPaymentItemID,
       s.QuotationID,
       s.SaleContractID,
       s.ConfirmStatementID,
       s.ConfirmStatementItemID,
       s.ContractID,
       s.ContractStatementID,
       s.CurrencyID,
       CASE @CultureNo
           WHEN 2 THEN
               c.Title2
           ELSE
               c.Title
       END AS CurrencyName,
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
       s.Allocation,
       bd.DocumentId,
       bd.DocumentNumber,
       bd.DocumentType,
       bd.DocumentName,
       bd.DocumentDate,
	   bd.BaseCurrencyID,
	   bd.BaseCurrencyRate,
       CFG.GetCLRSaturnDate(bd.DocumentDate, @DateFormat, 0, @DateType) DocumentDateString,
	   pc.PettyCashID,
       CAST(CASE
                WHEN ipr.ReceiveSubjectID IS NOT NULL THEN
                    1
                ELSE
                    0
            END AS BIT) AS Used,
       CASE
           WHEN s.PettyCashID IS NOT NULL THEN
               CAST(s.PettyCashID AS BIGINT)
           ELSE
               s.DLID
       END AS DocumentDlID,
       CASE
           WHEN s.PettyCashID IS NOT NULL THEN
               pcpd.Code
           ELSE
               d.Code
       END AS DocumentDlCode,
       CASE
           WHEN s.PettyCashID IS NOT NULL THEN
               CASE @CultureNo
                   WHEN 2 THEN
                       pc.Title2 + N' ' + pc.PartyName2
                   ELSE
                       pc.Title + N' ' + pc.PartyName
               END
           ELSE
               CASE @CultureNo
                   WHEN 2 THEN
                       d.Title2
                   ELSE
                       d.Title
               END
       END AS DocumentDlTitle
FROM FIN.ReceiveSubject s
    LEFT JOIN #pettyCashes AS pc
        ON pc.PettyCashID = s.PettyCashID
    LEFT JOIN CFG.Party AS pcp
        ON pcp.PartyID = pc.PartyID
    LEFT JOIN ACC.DL AS pcpd
        ON pcpd.DLID = pcp.DlID
    JOIN FIN.ReceiveReceipt r
        ON s.ReceiveReceiptID = r.ReceiveReceiptID
    JOIN FIN.ReceiptType t
        ON s.ReceiptTypeID = t.ReceiptTypeID
    LEFT JOIN ACC.DL d
        ON s.DLID = d.DLID
    JOIN CFG.Currency c
        ON s.CurrencyID = c.CurrencyID
    JOIN #Items i
        ON s.ReceiveSubjectID = i.ReceiveSubjectID
    JOIN #BaseDocument bd
        ON s.ReceiveSubjectID = bd.ReceiveSubjectID
    LEFT JOIN
    (
        SELECT ReceiveSubjectID
        FROM SLE.InvoicePreReceive
        WHERE ReceiveSubjectID IS NOT NULL
        GROUP BY ReceiveSubjectID
    ) ipr
        ON s.ReceiveSubjectID = ipr.ReceiveSubjectID
WHERE s.ReceiveReceiptID = @ReceiveReceiptID;
