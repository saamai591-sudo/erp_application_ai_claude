
CREATE   PROC [SRM].[GetDocAttachmentData]
    (
        @engName NVARCHAR(255) ,
        @party NVARCHAR(MAX) = NULL ,
        @contactId INT
    )
--WITH ENCRYPTION
AS
    BEGIN

        DECLARE @hasParty BIT = 0 ,
                @dateFormat VARCHAR(11) ,
                @dateType BIT ,
                @userId INT ,
                @culture VARCHAR(2);

        SET @userId = CFG.GetuserID();

        SELECT @dateType = us.SettingValue
        FROM   CFG.UserSetting us
        WHERE  us.SettingKey = 'Date_Type'
               AND us.UserID = @userId;

        SELECT @dateFormat = us.SettingValue
        FROM   CFG.UserSetting us
        WHERE  us.SettingKey = 'Date_Format'
               AND us.UserID = @userId;

        IF @dateType IS NULL
            SET @dateType = CASE CFG.GetuserCulture()
                                 WHEN 'fa' THEN 0
                                 WHEN 'en' THEN 1
                                 WHEN 'ar' THEN 2
                            END;

        IF @dateFormat IS NULL
            SET @dateFormat = 'YY/MM/DD';

        CREATE TABLE #partyTable
            (
                PartyId BIGINT
            );

        IF @party IS NULL
           AND @contactId IS NOT NULL
            BEGIN
                INSERT #partyTable ( PartyId )
                       SELECT c.PartyID
                       FROM   SRM.Contact AS c;
            END;

        IF @party IS NOT NULL
            BEGIN
                INSERT #partyTable ( PartyId )
                       SELECT CAST(rfcst.value AS BIGINT)
                       FROM   CFG.R_FnCommaStr2Table(@party) AS rfcst;
            END;

        IF EXISTS (   SELECT 1
                      FROM   #partyTable AS pt )
            SET @hasParty = 1;

        IF @engName = 'DebitCreditNote'
            BEGIN
                SELECT rr.DebitCreditNoteID AS EntityId ,
                       CFG.GetCLRSaturnDate(rr.[Date], @dateFormat, 0, @dateType) AS Date ,
                       CAST(rr.Number AS NVARCHAR(100)) AS Number ,
                       '' AS PartyTitle ,
                       '' AS PartyDlCode
                FROM   CFG.DebitCreditNote AS rr
            END;

        IF @engName = 'ProformaInvoice'
            BEGIN
                SELECT rr.ProformaInvoiceID AS EntityId ,
                       CFG.GetCLRSaturnDate(rr.[Date], @dateFormat, 0, @dateType) AS Date ,
                       rr.Number AS Number ,
                       p2.Title + ' ' + ISNULL(p2.LastName,'') AS PartyTitle ,
                       d.Code AS PartyDlCode
                FROM   FOS.ProformaInvoice AS rr
                       JOIN CFG.Party AS p2 ON p2.PartyID = rr.Vendor
                       JOIN ACC.DL AS d ON d.DLID = p2.DlID
                       LEFT JOIN #partyTable AS pt ON pt.PartyId = p2.PartyID
                WHERE  @hasParty = 0
                       OR pt.PartyId IS NOT NULL;

            END;

        IF @engName = 'PaymentCommitmentRecall'
            BEGIN
                SELECT rr.PaymentCommitmentRecallID AS EntityId ,
                       CFG.GetCLRSaturnDate(rr.[Date], @dateFormat, 0, @dateType) AS Date ,
                       '' AS Number ,
                       p2.Title + ' ' + ISNULL(p2.LastName,'') AS PartyTitle ,
                       d.Code AS PartyDlCode
                FROM   FIN.PaymentCommitmentRecall AS rr
                       JOIN CFG.Party AS p2 ON p2.DlID = rr.DLID
                       JOIN ACC.DL AS d ON d.DLID = p2.DlID
                       LEFT JOIN #partyTable AS pt ON pt.PartyId = p2.PartyID
                WHERE  @hasParty = 0
                       OR pt.PartyId IS NOT NULL;
            END;

        IF @engName = 'ReceiveCommitmentRecall'
            BEGIN
                SELECT rr.ReceiveCommitmentRecallID AS EntityId ,
                       CFG.GetCLRSaturnDate(rr.[Date], @dateFormat, 0, @dateType) AS Date ,
                       '' AS Number ,
                       p2.Title + ' ' + ISNULL(p2.LastName,'')  AS PartyTitle ,
                       d.Code AS PartyDlCode
                FROM   FIN.ReceiveCommitmentRecall AS rr
                       JOIN CFG.Party AS p2 ON p2.DlID = rr.DLID
                       JOIN ACC.DL AS d ON d.DLID = p2.DlID
                       LEFT JOIN #partyTable AS pt ON pt.PartyId = p2.PartyID
                WHERE  @hasParty = 0
                       OR pt.PartyId IS NOT NULL;
            END;

        IF @engName = 'PaymentCommitment'
            BEGIN
                SELECT rr.PaymentCommitmentID AS EntityId ,
                       CFG.GetCLRSaturnDate(rr.[Date], @dateFormat, 0, @dateType) AS Date ,
                       CAST(rr.Number AS VARCHAR(100)) AS Number ,
                       p2.Title + ' ' + ISNULL(p2.LastName,'')  AS PartyTitle ,
                       d.Code AS PartyDlCode
                FROM   FIN.PaymentCommitment AS rr
                       JOIN CFG.Party AS p2 ON p2.PartyID = rr.PartyID
                       JOIN ACC.DL AS d ON d.DLID = p2.DlID
                       LEFT JOIN #partyTable AS pt ON pt.PartyId = p2.PartyID
                WHERE  @hasParty = 0
                       OR pt.PartyId IS NOT NULL;
            END;

        IF @engName = 'ReceiveCommitment'
            BEGIN
                SELECT rr.ReceiveCommitmentID AS EntityId ,
                       CFG.GetCLRSaturnDate(rr.[Date], @dateFormat, 0, @dateType) AS Date ,
                       CAST(rr.Number AS VARCHAR(100)) AS Number ,
                       p2.Title + ' ' + ISNULL(p2.LastName,'')  AS PartyTitle ,
                       d.Code AS PartyDlCode
                FROM   FIN.ReceiveCommitment AS rr
                       JOIN CFG.Party AS p2 ON p2.PartyID = rr.PartyID
                       JOIN ACC.DL AS d ON d.DLID = p2.DlID
                       LEFT JOIN #partyTable AS pt ON pt.PartyId = p2.PartyID
                WHERE  @hasParty = 0
                       OR pt.PartyId IS NOT NULL;
            END;

        IF @engName = 'DrawBackPaymentCheqe'
            BEGIN
                SELECT rr.PaymentCheqeFlowID AS EntityId ,
                       CFG.GetCLRSaturnDate(rr.[Date], @dateFormat, 0, @dateType) AS Date ,
                       CAST(rr.InnerNumber AS VARCHAR(100)) AS Number ,
                       p2.Title + ' ' + ISNULL(p2.LastName,'')  AS PartyTitle ,
                       d.Code AS PartyDlCode
                FROM   FIN.PaymentCheqeFlow AS rr
                       JOIN CFG.Party AS p2 ON p2.PartyID = rr.PartyID
                       JOIN ACC.DL AS d ON d.DLID = p2.DlID
                       LEFT JOIN #partyTable AS pt ON pt.PartyId = p2.PartyID
                WHERE  rr.[Type] = 4
                       AND (   @hasParty = 0
                               OR pt.PartyId IS NOT NULL );
            END;

        IF @engName = 'DrawBackReceivedCheqe'
            BEGIN
                SELECT rr.ReceiptCheqeFlowID AS EntityId ,
                       CFG.GetCLRSaturnDate(rr.[Date], @dateFormat, 0, @dateType) AS Date ,
                       rr.Number AS Number ,
                       p2.Title + ' ' + ISNULL(p2.LastName,'')  AS PartyTitle ,
                       d.Code AS PartyDlCode
                FROM   FIN.ReceiptCheqeFlow AS rr
                       JOIN CFG.Party AS p2 ON p2.PartyID = rr.PartyID
                       JOIN ACC.DL AS d ON d.DLID = p2.DlID
                       LEFT JOIN #partyTable AS pt ON pt.PartyId = p2.PartyID
                WHERE  rr.[Type] = 4
                       AND (   @hasParty = 0
                               OR pt.PartyId IS NOT NULL );
            END;

        IF @engName = 'DeliverToSupplier'
            BEGIN
                SELECT rr.ReceiptCheqeFlowID AS EntityId ,
                       CFG.GetCLRSaturnDate(rr.[Date], @dateFormat, 0, @dateType) AS Date ,
                       rr.Number AS Number ,
                       p2.Title + ' ' + ISNULL(p2.LastName,'')  AS PartyTitle ,
                       d.Code AS PartyDlCode
                FROM   FIN.ReceiptCheqeFlow AS rr
                       JOIN CFG.Party AS p2 ON p2.PartyID = rr.PartyID
                       JOIN ACC.DL AS d ON d.DLID = p2.DlID
                       LEFT JOIN #partyTable AS pt ON pt.PartyId = p2.PartyID
                WHERE  rr.[Type] = 2
                       AND (   @hasParty = 0
                               OR pt.PartyId IS NOT NULL );
            END;

        IF @engName = 'PaymentReceipt'
            BEGIN
                SELECT rr.PaymentReceiptID AS EntityId ,
                       CFG.GetCLRSaturnDate(rr.[Date], @dateFormat, 0, @dateType) AS Date ,
                       CAST(rr.Number AS NVARCHAR(100)) AS Number ,
                       p2.Title + ' ' + ISNULL(p2.LastName,'')  AS PartyTitle ,
                       d.Code AS PartyDlCode
                FROM   FIN.PaymentReceipt AS rr
                       JOIN CFG.Party AS p2 ON p2.PartyID = rr.PartyID
                       JOIN ACC.DL AS d ON d.DLID = p2.DlID
                       LEFT JOIN #partyTable AS pt ON pt.PartyId = p2.PartyID
                WHERE  @hasParty = 0
                       OR pt.PartyId IS NOT NULL;
            END;

        IF @engName = 'ReceiveReceipt'
            BEGIN
                SELECT rr.ReceiveReceiptID AS EntityId ,
                       CFG.GetCLRSaturnDate(rr.[Date], @dateFormat, 0, @dateType) AS Date ,
                       CAST(rr.Number AS NVARCHAR(100)) AS Number ,
                       p2.Title + ' ' + ISNULL(p2.LastName,'')  AS PartyTitle ,
                       d.Code AS PartyDlCode
                FROM   FIN.ReceiveReceipt AS rr
                       JOIN CFG.Party AS p2 ON p2.PartyID = rr.PartyID
                       JOIN ACC.DL AS d ON d.DLID = p2.DlID
                       LEFT JOIN #partyTable AS pt ON pt.PartyId = p2.PartyID
                WHERE  @hasParty = 0
                       OR pt.PartyId IS NOT NULL;
            END;

        IF @engName = 'ReturnedSaleInvoice'
            BEGIN
                SELECT rr.ReturnedSaleInvoiceID AS EntityId ,
                       CFG.GetCLRSaturnDate(rr.[Date], @dateFormat, 0, @dateType) AS Date ,
                       CAST(rr.Number AS NVARCHAR(100)) AS Number ,
                       p2.Title + ' ' + ISNULL(p2.LastName,'')  AS PartyTitle ,
                       d.Code AS PartyDlCode
                FROM   SLE.ReturnedSaleInvoice AS rr
                       JOIN CFG.Party AS p2 ON p2.PartyID = rr.CustomerID
                       JOIN ACC.DL AS d ON d.DLID = p2.DlID
                       LEFT JOIN #partyTable AS pt ON pt.PartyId = p2.PartyID
                WHERE  @hasParty = 0
                       OR pt.PartyId IS NOT NULL;
            END;

        IF @engName = 'ReturnedSaleJustification'
            BEGIN
                SELECT rr.ReturnedSaleJustificationID AS EntityId ,
                       CFG.GetCLRSaturnDate(rr.[Date], @dateFormat, 0, @dateType) AS Date ,
                       CAST(rr.Number AS NVARCHAR(100)) AS Number ,
                       p2.Title + ' ' + ISNULL(p2.LastName,'')  AS PartyTitle ,
                       d.Code AS PartyDlCode
                FROM   SLE.ReturnedSaleJustification AS rr
                       JOIN CFG.Party AS p2 ON p2.PartyID = rr.CustomerID
                       JOIN ACC.DL AS d ON d.DLID = p2.DlID
                       LEFT JOIN #partyTable AS pt ON pt.PartyId = p2.PartyID
                WHERE  @hasParty = 0
                       OR pt.PartyId IS NOT NULL;
            END;

        IF @engName = 'Invoice'
            BEGIN
                SELECT rr.InvoiceID AS EntityId ,
                       CFG.GetCLRSaturnDate(rr.[Date], @dateFormat, 0, @dateType) AS Date ,
                       CAST(rr.Number AS NVARCHAR(100)) AS Number ,
                       p2.Title + ' ' + ISNULL(p2.LastName,'')  AS PartyTitle ,
                       d.Code AS PartyDlCode
                FROM   SLE.Invoice AS rr
                       JOIN CFG.Party AS p2 ON p2.PartyID = rr.CustomerID
                       JOIN ACC.DL AS d ON d.DLID = p2.DlID
                       LEFT JOIN #partyTable AS pt ON pt.PartyId = p2.PartyID
                WHERE  @hasParty = 0
                       OR pt.PartyId IS NOT NULL;
            END;

        IF @engName = 'Remittance'
            BEGIN
                SELECT rr.RemittanceID AS EntityId ,
                       CFG.GetCLRSaturnDate(rr.[Date], @dateFormat, 0, @dateType) AS Date ,
                       CAST(rr.Number AS NVARCHAR(100)) AS Number ,
                       p2.Title + ' ' + ISNULL(p2.LastName,'')  AS PartyTitle ,
                       d.Code AS PartyDlCode
                FROM   SLE.Remittance AS rr
                       JOIN CFG.Party AS p2 ON p2.PartyID = rr.CustomerID
                       JOIN ACC.DL AS d ON d.DLID = p2.DlID
                       LEFT JOIN #partyTable AS pt ON pt.PartyId = p2.PartyID
                WHERE  @hasParty = 0
                       OR pt.PartyId IS NOT NULL;
            END;

        IF @engName = 'SaleContract'
            BEGIN
                SELECT rr.SaleContractID AS EntityId ,
                       rr.SaleContractID ,
                       CFG.GetCLRSaturnDate(rr.[Date], @dateFormat, 0, @dateType) AS Date ,
                       CAST(rr.Number AS NVARCHAR(100)) AS Number ,
                       p2.Title + ' ' + ISNULL(p2.LastName,'')  AS PartyTitle ,
                       d.Code AS PartyDlCode
                FROM   SLE.SaleContract AS rr
                       JOIN CFG.Party AS p2 ON p2.PartyID = rr.CustomerID
                       JOIN ACC.DL AS d ON d.DLID = p2.DlID
                       LEFT JOIN #partyTable AS pt ON pt.PartyId = p2.PartyID
                WHERE  @hasParty = 0
                       OR pt.PartyId IS NOT NULL;
            END;

        IF @engName = 'Quotation'
            BEGIN
                SELECT rr.QuotationID AS EntityId ,
                       rr.QuotationID ,
                       CFG.GetCLRSaturnDate(rr.[Date], @dateFormat, 0, @dateType) AS Date ,
                       CAST(rr.Number AS NVARCHAR(100)) AS Number ,
                       p2.Title + ' ' + ISNULL(p2.LastName,'')  AS PartyTitle ,
                       d.Code AS PartyDlCode
                FROM   SLE.Quotation AS rr
                       JOIN CFG.Party AS p2 ON p2.PartyID = rr.CustomerID
                       JOIN ACC.DL AS d ON d.DLID = p2.DlID
                       LEFT JOIN #partyTable AS pt ON pt.PartyId = p2.PartyID
                WHERE  @hasParty = 0
                       OR pt.PartyId IS NOT NULL;
            END;

        IF @engName = 'Justification'
            BEGIN
                SELECT rr.JustificationID AS EntityId ,
                       CFG.GetCLRSaturnDate(rr.[Date], @dateFormat, 0, @dateType) AS Date ,
                       CAST(rr.Number AS NVARCHAR(100)) AS Number ,
                       p2.Title + ' ' + ISNULL(p2.LastName,'')  AS PartyTitle ,
                       d.Code AS PartyDlCode
                FROM   SLE.Justification AS rr
                       JOIN CFG.Party AS p2 ON p2.PartyID = rr.CustomerID
                       JOIN ACC.DL AS d ON d.DLID = p2.DlID
                       LEFT JOIN #partyTable AS pt ON pt.PartyId = p2.PartyID
                WHERE  @hasParty = 0
                       OR pt.PartyId IS NOT NULL;
            END;

        IF @engName = 'Order'
            BEGIN
                SELECT rr.OrderID AS EntityId ,
                       CFG.GetCLRSaturnDate(rr.[Date], @dateFormat, 0, @dateType) AS Date ,
                       CAST(rr.Number AS NVARCHAR(100)) AS Number ,
                       p2.Title + ' ' + ISNULL(p2.LastName,'')  AS PartyTitle ,
                       d.Code AS PartyDlCode
                FROM   CTM.[Order] AS rr
                       LEFT JOIN CFG.Party AS p2 ON p2.PartyID = rr.CustomerID
                       LEFT JOIN ACC.DL AS d ON d.DLID = p2.DlID
                       LEFT JOIN #partyTable AS pt ON pt.PartyId = p2.PartyID
                WHERE  @hasParty = 0
                       OR pt.PartyId IS NOT NULL;
            END;

        IF @engName = 'ConfirmStatement'
            BEGIN
                SELECT rr.ConfirmStatementID AS EntityId ,
                       CFG.GetCLRSaturnDate([c].[Date], @dateFormat, 0, @dateType) AS Date ,
                       CAST(cs.Number AS NVARCHAR(100)) AS Number ,
                       p2.Title + ' ' + ISNULL(p2.LastName,'')  AS PartyTitle ,
                       d.Code AS PartyDlCode
                FROM   CNT.[ConfirmStatement] AS rr
                       JOIN CNT.ContractStatement AS cs ON cs.ContractStatementID = rr.ContractStatementID
                       JOIN CNT.[Contract] AS c ON c.ContractID = rr.ContractID
                       JOIN CFG.Party AS p2 ON p2.PartyID = c.PartyID
                       JOIN ACC.DL AS d ON d.DLID = p2.DlID
                       LEFT JOIN #partyTable AS pt ON pt.PartyId = p2.PartyID
                WHERE  @hasParty = 0
                       OR pt.PartyId IS NOT NULL;
            END;

        IF @engName = 'ContractStatement'
            BEGIN
                SELECT rr.ContractStatementID AS EntityId ,
                       CFG.GetCLRSaturnDate(rr.[EndDate], @dateFormat, 0, @dateType) AS Date ,
                       CAST(rr.Number AS NVARCHAR(100)) AS Number ,
                       p2.Title + ' ' + ISNULL(p2.LastName,'')  AS PartyTitle ,
                       d.Code AS PartyDlCode
                FROM   CNT.[ContractStatement] AS rr
                       JOIN CNT.[Contract] AS c ON c.ContractID = rr.ContractID
                       JOIN CFG.Party AS p2 ON p2.PartyID = c.PartyID
                       JOIN ACC.DL AS d ON d.DLID = p2.DlID
                       LEFT JOIN #partyTable AS pt ON pt.PartyId = p2.PartyID
                WHERE  @hasParty = 0
                       OR pt.PartyId IS NOT NULL;
            END;

        IF @engName = 'ContractComplement'
            BEGIN
                SELECT rr.ContractID AS EntityId ,
                       CFG.GetCLRSaturnDate(rr.[Date], @dateFormat, 0, @dateType) AS Date ,
                       rr.Number AS Number ,
                       p2.Title + ' ' + ISNULL(p2.LastName,'')  AS PartyTitle ,
                       d.Code AS PartyDlCode
                FROM   CNT.[Contract] AS rr
                       LEFT JOIN CFG.Party AS p2 ON p2.PartyID = rr.PartyID
                       LEFT JOIN ACC.DL AS d ON d.DLID = p2.DlID
                       LEFT JOIN #partyTable AS pt ON pt.PartyId = p2.PartyID
                WHERE  rr.ParentID IS NOT NULL
                       AND (   @hasParty = 0
                               OR pt.PartyId IS NOT NULL );
            END;

        IF @engName = 'ContractContinuation'
            BEGIN
                SELECT rr.ContractContinuationID AS EntityId ,
                       CFG.GetCLRSaturnDate(rr.[Date], @dateFormat, 0, @dateType) AS Date ,
                       c.Number AS Number ,
                       p2.Title + ' ' + ISNULL(p2.LastName,'')  AS PartyTitle ,
                       d.Code AS PartyDlCode
                FROM   CNT.[ContractContinuation] AS rr
                       JOIN CNT.Contract AS c ON c.ContractID = rr.ContractID
                       LEFT JOIN CFG.Party AS p2 ON p2.PartyID = c.PartyID
                       LEFT JOIN ACC.DL AS d ON d.DLID = p2.DlID
                       LEFT JOIN #partyTable AS pt ON pt.PartyId = p2.PartyID
                WHERE  @hasParty = 0
                       OR pt.PartyId IS NOT NULL;;
            END;

        IF @engName = 'ContractDefinition'
            BEGIN
                SELECT rr.ContractID AS EntityId ,
                       CFG.GetCLRSaturnDate(rr.[Date], @dateFormat, 0, @dateType) AS Date ,
                       rr.Number AS Number ,
                       p2.Title + ' ' + ISNULL(p2.LastName,'')  AS PartyTitle ,
                       d.Code AS PartyDlCode
                FROM   CNT.[Contract] AS rr
                       LEFT JOIN CFG.Party AS p2 ON p2.PartyID = rr.PartyID
                       LEFT JOIN ACC.DL AS d ON d.DLID = p2.DlID
                       LEFT JOIN #partyTable AS pt ON pt.PartyId = p2.PartyID
                WHERE  rr.ParentID IS NULL
                       AND (   @hasParty = 0
                               OR pt.PartyId IS NOT NULL );
            END;

        IF @engName = 'TenderCommission'
            BEGIN
                SELECT rr.TenderCommissionID AS EntityId ,
                       CFG.GetCLRSaturnDate(rr.[Date], @dateFormat, 0, @dateType) AS Date ,
                       CAST(rr.Number AS NVARCHAR(100)) AS Number ,
                       '' AS PartyTitle ,
                       '' AS PartyDlCode
                FROM   VND.TenderCommission AS rr;
            END;

        IF @engName = 'TenderParticipate'
            BEGIN
                SELECT rr.TenderParticipateID AS EntityId ,
                       CFG.GetCLRSaturnDate(
                           rr.[SecretariatDate], @dateFormat, 0, @dateType) AS Date ,
                       rr.SecretariatNumber AS Number ,
                       p2.Title + ' ' + ISNULL(p2.LastName,'')  AS PartyTitle ,
                       d.Code AS PartyDlCode
                FROM   VND.TenderParticipate AS rr
                       LEFT JOIN CFG.Party AS p2 ON p2.PartyID = rr.PartyID
                       LEFT JOIN ACC.DL AS d ON d.DLID = p2.DlID
                       LEFT JOIN #partyTable AS pt ON pt.PartyId = p2.PartyID
                WHERE  @hasParty = 0
                       OR pt.PartyId IS NOT NULL;
            END;

        IF @engName = 'ReturnInvoice'
            BEGIN
                SELECT rr.ReturnInvoiceID AS EntityId ,
                       CFG.GetCLRSaturnDate(rr.[Date], @dateFormat, 0, @dateType) AS Date ,
                       CAST(rr.Number AS NVARCHAR(100)) AS Number,
                       p2.Title + ' ' + ISNULL(p2.LastName,'')  AS PartyTitle ,
                       d.Code AS PartyDlCode
                FROM   VND.ReturnInvoice AS rr
                       LEFT JOIN CFG.Party AS p2 ON p2.DlID = rr.DlID
                       LEFT JOIN ACC.DL AS d ON d.DLID = rr.DlID
                       LEFT JOIN #partyTable AS pt ON pt.PartyId = p2.PartyID
                WHERE  @hasParty = 0
                       OR pt.PartyId IS NOT NULL;
            END;

        IF @engName = 'PurchaseInvoice'
            BEGIN
                SELECT rr.PurchaseInvoiceID AS EntityId ,
                       CFG.GetCLRSaturnDate(rr.[Date], @dateFormat, 0, @dateType) AS Date ,
                       CAST(rr.Number AS NVARCHAR(100)) AS Number ,
                       p2.Title + ' ' + ISNULL(p2.LastName,'')  AS PartyTitle ,
                       d.Code AS PartyDlCode
                FROM   VND.PurchaseInvoice AS rr
                       LEFT JOIN CFG.Party AS p2 ON p2.DlID = rr.DlID
                       LEFT JOIN ACC.DL AS d ON d.DLID = rr.DlID
                       LEFT JOIN #partyTable AS pt ON pt.PartyId = p2.PartyID
                WHERE  @hasParty = 0
                       OR pt.PartyId IS NOT NULL;
            END;

        IF @engName = 'PurchaseContract'
            BEGIN
                SELECT rr.PurchaseContractID AS EntityId ,
                       CFG.GetCLRSaturnDate(rr.[Date], @dateFormat, 0, @dateType) AS Date ,
                       CAST(rr.Number AS NVARCHAR(100))  AS Number,
                       p2.Title + ' ' + ISNULL(p2.LastName,'')  AS PartyTitle ,
                       d.Code AS PartyDlCode
                FROM   VND.PurchaseContract AS rr
                       LEFT JOIN CFG.Party AS p2 ON p2.DlID = rr.DlID
                       LEFT JOIN ACC.DL AS d ON d.DLID = rr.DlID
                       LEFT JOIN #partyTable AS pt ON pt.PartyId = p2.PartyID
                WHERE  @hasParty = 0
                       OR pt.PartyId IS NOT NULL;
            END;

        IF @engName = 'ProposalCommission'
            BEGIN
                SELECT rr.ProposalCommissionID AS EntityId ,
                       CFG.GetCLRSaturnDate(rr.[Date], @dateFormat, 0, @dateType) AS Date ,
                       CAST(rr.Number AS NVARCHAR(100))  AS Number,
                       '' AS PartyTitle ,
                       '' AS PartyDlCode
                FROM   VND.ProposalCommission AS rr;
            END;

        IF @engName = 'Proposal'
            BEGIN
                SELECT rr.ProposalID AS EntityId ,
                       CFG.GetCLRSaturnDate(rr.[Date], @dateFormat, 0, @dateType) AS Date ,
                       CAST(rr.Number AS NVARCHAR(100))  AS Number,
                       p2.Title + ' ' + ISNULL(p2.LastName,'')  AS PartyTitle ,
                       d.Code AS PartyDlCode
                FROM   VND.Proposal AS rr
                       LEFT JOIN CFG.Party AS p2 ON p2.PartyID = rr.PartyID
                       LEFT JOIN ACC.DL AS d ON d.DLID = p2.DlID
                       LEFT JOIN #partyTable AS pt ON pt.PartyId = p2.PartyID
                WHERE  @hasParty = 0
                       OR pt.PartyId IS NOT NULL;
            END;

        IF @engName = 'PaymentRequest'
            BEGIN
                SELECT rr.PaymentRequestID AS EntityId ,
                       CFG.GetCLRSaturnDate(rr.[Date], @dateFormat, 0, @dateType) AS Date ,
                       CAST(rr.Number AS NVARCHAR(100))  AS Number,
                       p.Title + ' ' + ISNULL(p.LastName,'') AS PartyTitle ,
                       d.Code AS PartyDlCode
                FROM   REQ.PaymentRequest AS rr
	                   JOIN (SELECT DISTINCT ri.PaymentRequestID, ri.PartyID FROM REQ.PaymentRequestItem ri) rii
		                    ON rr.PaymentRequestID = rii.PaymentRequestID
                       LEFT JOIN CFG.Party AS p ON p.PartyID = rii.PartyID
                       LEFT JOIN ACC.DL AS d ON d.DLID = p.DlID
                       LEFT JOIN #partyTable AS pt ON pt.PartyId = p.PartyID
                WHERE  @hasParty = 0
                       OR pt.PartyId IS NOT NULL;
            END;

        IF @engName = 'ReceiveRequest'
            BEGIN
                SELECT rr.ReceiveRequestID AS EntityId ,
                       CFG.GetCLRSaturnDate(rr.[Date], @dateFormat, 0, @dateType) AS Date ,
                       CAST(rr.Number AS NVARCHAR(100)) AS Number ,
                       p.Title + ' ' + ISNULL(p.LastName,'') AS PartyTitle ,
                       d.Code AS PartyDlCode
                FROM   REQ.ReceiveRequest AS rr
                       LEFT JOIN CFG.Party AS p ON p.PartyID = rr.PartyID
                       LEFT JOIN ACC.DL AS d ON d.DLID = p.DlID
                       LEFT JOIN #partyTable AS pt ON pt.PartyId = p.PartyID
                WHERE  @hasParty = 0
                       OR pt.PartyId IS NOT NULL;
            END;

        IF @engName = 'ReturnRequest'
            BEGIN

                SELECT sr.ReturnRequestID AS EntityId ,
                       CFG.GetCLRSaturnDate(
                           sr.ReturnRequestDate, @dateFormat, 0, @dateType) AS Date ,
                       CAST(sr.ReturnRequestNumber AS NVARCHAR(100)) AS Number ,
                       '' AS PartyTitle ,
                       '' AS PartyDlCode
                FROM   REQ.ReturnRequest AS sr;

            END;

        IF @engName = 'PurchaseRequest'
            BEGIN

                SELECT sr.PurchaseRequestID AS EntityId ,
                       CFG.GetCLRSaturnDate(
                           sr.PurchaseRequestDate, @dateFormat, 0, @dateType) AS Date ,
                       CAST(sr.PurchaseRequestNumber AS NVARCHAR(100)) AS Number ,
                       '' AS PartyTitle ,
                       '' AS PartyDlCode
                FROM   REQ.PurchaseRequest AS sr;

            END;

        IF @engName = 'StuffRequest'
            BEGIN

                SELECT sr.StuffRequestID AS EntityId ,
                       CFG.GetCLRSaturnDate(
                           sr.StuffRequestDate, @dateFormat, 0, @dateType) AS Date ,
                       CAST(sr.StuffRequestNumber AS NVARCHAR(100)) AS Number ,
                       '' AS PartyTitle ,
                       '' AS PartyDlCode
                FROM   REQ.StuffRequest AS sr;

            END;
    END;
