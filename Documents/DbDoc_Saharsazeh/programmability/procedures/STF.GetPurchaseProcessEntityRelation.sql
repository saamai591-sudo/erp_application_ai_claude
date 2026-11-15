-------------------------------------
CREATE    PROCEDURE [STF].GetPurchaseProcessEntityRelation
(
    @EngName NVARCHAR(100),
    @ParentId INT,
    @needParent BIT
)
--WITH ENCRYPTION
AS
BEGIN

    DECLARE @StockReceipt NVARCHAR(100),
            @Proposal NVARCHAR(100),
            @ProposalCommission NVARCHAR(100),
            @Outgoing NVARCHAR(100),
            @StuffRequest NVARCHAR(100),
            @TransferRequest NVARCHAR(100),
            @TemporaryStockReceipt NVARCHAR(100),
            @PurchaseRequest NVARCHAR(100),
            @JustificationInput NVARCHAR(100),
            @PurchaseInvoice NVARCHAR(100),
            @ReturnedPurchaseInvoice NVARCHAR(100),
            @ReturnedSaleJustification NVARCHAR(100),
            @ReturnedTemporaryStockReceipt NVARCHAR(100),
            @ReturnRequest NVARCHAR(100),
            @SaleInvoice NVARCHAR(100),
            @ReturnedSaleInvoice NVARCHAR(100),
            @RevisionCost NVARCHAR(100),
            @ReturnedOutgoing NVARCHAR(100),
            @Quotation NVARCHAR(100),
            @Justification NVARCHAR(100),
            @Remittance NVARCHAR(100),
            @Reception NVARCHAR(100),
            @Contract NVARCHAR(100),
            @AssetReceipt NVARCHAR(100),
            @SaleContract NVARCHAR(100),
            @ContractStatement NVARCHAR(100),
            @SaleAsset NVARCHAR(100),
            @Order NVARCHAR(100),
            @ReturnSaleInvoice NVARCHAR(100),
            @PurchaseContract NVARCHAR(100),
            @ReturnStockReceipt NVARCHAR(100),
            @Insurance NVARCHAR(100),
            @Repair NVARCHAR(100),
            @Culture VARCHAR(10),
            @PurchaseInvoicePrePayment NVARCHAR(25),
            @DebitCreditNote NVARCHAR(25),
            @ParameterMonthlyData NVARCHAR(25),
            @LoanAssignment NVARCHAR(25),
            @Installment NVARCHAR(25),
            @PayPreparing NVARCHAR(25),
            @ProformaInvoice NVARCHAR(25),
            @FinancialConfirm NVARCHAR(25),
            @PaymentCheqeCashing NVARCHAR(25),
            @DrawBackPaymentCheqe NVARCHAR(25),
            @DeliverToSupplier NVARCHAR(25),
            @AssignToBank NVARCHAR(25),
            @CashFromBank NVARCHAR(25),
            @Protest NVARCHAR(25),
            @ReturnFromAssignment NVARCHAR(25),
            @CashToFund NVARCHAR(25),
            @CashToBank NVARCHAR(25),
            @Spending NVARCHAR(25),
            @DrawBack NVARCHAR(25),
            @ReturnedOfSpend NVARCHAR(25);

    SET @Culture = CFG.GetuserCulture();

    SELECT de.ID,
           de.[Name] AS EntityKey,
           dti.[Value] AS EntityTitle
    INTO #TableNames
    FROM MDT.DmdEntity AS de
        JOIN MDT.DmdRelatedEntityTranslate AS dret
            ON dret.DmdEntityID = de.ID
        JOIN MDT.DmdTranslateItem AS dti
            ON dti.ID = dret.DmdTranslateItemID
    WHERE dti.Culture = @Culture;

    SELECT @ReturnStockReceipt = tt.EntityTitle
    FROM #TableNames tt
    WHERE tt.EntityKey = 'ReturnStockReceipt';

    SELECT @PurchaseContract = tt.EntityTitle
    FROM #TableNames tt
    WHERE tt.EntityKey = 'PurchaseContract';

    SELECT @SaleAsset = tt.EntityTitle
    FROM #TableNames tt
    WHERE tt.EntityKey = 'Insurance';

    SELECT @SaleAsset = tt.EntityTitle
    FROM #TableNames tt
    WHERE tt.EntityKey = 'SaleAsset';

    SELECT @ReturnSaleInvoice = tt.EntityTitle
    FROM #TableNames tt
    WHERE tt.EntityKey = 'ReturnSaleInvoice';

    SELECT @SaleContract = tt.EntityTitle
    FROM #TableNames tt
    WHERE tt.EntityKey = 'SaleContract';

    SELECT @ReturnedSaleJustification = tt.EntityTitle
    FROM #TableNames tt
    WHERE tt.EntityKey = 'ReturnedSaleJustification';

    SELECT @ReturnedPurchaseInvoice = tt.EntityTitle
    FROM #TableNames tt
    WHERE tt.EntityKey = 'ReturnInvoice';

    SELECT @Repair = tt.EntityTitle
    FROM #TableNames tt
    WHERE tt.EntityKey = 'Repair';

    SELECT @AssetReceipt = tt.EntityTitle
    FROM #TableNames tt
    WHERE tt.EntityKey = 'AssetReceipt';

    SELECT @Order = tt.EntityTitle
    FROM #TableNames tt
    WHERE tt.EntityKey = 'Order';

    SELECT @ContractStatement = tt.EntityTitle
    FROM #TableNames tt
    WHERE tt.EntityKey = 'ContractStatement';

    SELECT @Contract = tt.EntityTitle
    FROM #TableNames tt
    WHERE tt.EntityKey = 'Contract';

    SELECT @Reception = tt.EntityTitle
    FROM #TableNames tt
    WHERE tt.EntityKey = 'Reception';

    SELECT @Remittance = tt.EntityTitle
    FROM #TableNames tt
    WHERE tt.EntityKey = 'Remittance';

    SELECT @Quotation = tt.EntityTitle
    FROM #TableNames tt
    WHERE tt.EntityKey = 'Quotation';

    SELECT @Justification = tt.EntityTitle
    FROM #TableNames tt
    WHERE tt.EntityKey = 'Justification';

    SELECT @SaleInvoice = tt.EntityTitle
    FROM #TableNames tt
    WHERE tt.EntityKey = 'invoice';

    SELECT @ReturnedSaleInvoice = tt.EntityTitle
    FROM #TableNames tt
    WHERE tt.EntityKey = 'ReturnedSaleInvoice';

    SELECT @ReturnedOutgoing = tt.EntityTitle
    FROM #TableNames tt
    WHERE tt.EntityKey = 'ReturnedOutgoing';

    SELECT @RevisionCost = tt.EntityTitle
    FROM #TableNames tt
    WHERE tt.EntityKey = 'RevisionCost';

    SELECT @StockReceipt = tt.EntityTitle
    FROM #TableNames tt
    WHERE tt.EntityKey = 'StockReceipt';

    SELECT @Proposal = tt.EntityTitle
    FROM #TableNames tt
    WHERE tt.EntityKey = 'Proposal';

    SELECT @ProposalCommission = tt.EntityTitle
    FROM #TableNames tt
    WHERE tt.EntityKey = 'ProposalCommission';

    SELECT @Outgoing = tt.EntityTitle
    FROM #TableNames tt
    WHERE tt.EntityKey = 'Outgoing';

    SELECT @PurchaseRequest = tt.EntityTitle
    FROM #TableNames tt
    WHERE tt.EntityKey = 'PurchaseRequest';

    SELECT @StuffRequest = tt.EntityTitle
    FROM #TableNames tt
    WHERE tt.EntityKey = 'StuffRequest';

    SELECT @TransferRequest = tt.EntityTitle
    FROM #TableNames tt
    WHERE tt.EntityKey = 'TransferRequest';

    SELECT @TemporaryStockReceipt = tt.EntityTitle
    FROM #TableNames tt
    WHERE tt.EntityKey = 'TemporaryStockReceipt';

    SELECT @JustificationInput = tt.EntityTitle
    FROM #TableNames tt
    WHERE tt.EntityKey = 'JustificationInput';

    SELECT @PurchaseInvoice = tt.EntityTitle
    FROM #TableNames tt
    WHERE tt.EntityKey = 'PurchaseInvoice';

    SELECT @ReturnedTemporaryStockReceipt = tt.EntityTitle
    FROM #TableNames tt
    WHERE tt.EntityKey = 'ReturnedTemporaryStockReceipt';

    SELECT @ReturnRequest = tt.EntityTitle
    FROM #TableNames tt
    WHERE tt.EntityKey = 'ReturnRequest';

    SELECT @PurchaseInvoicePrePayment = tt.EntityTitle
    FROM #TableNames tt
    WHERE tt.EntityKey = 'Prepayment';

    SELECT @DebitCreditNote = tt.EntityTitle
    FROM #TableNames tt
    WHERE tt.EntityKey = 'DebitCreditNote';

    SELECT @ParameterMonthlyData = tt.EntityTitle
    FROM #TableNames tt
    WHERE tt.EntityKey = 'ParameterMonthlyData';

    SELECT @LoanAssignment = tt.EntityTitle
    FROM #TableNames tt
    WHERE tt.EntityKey = 'LoanAssignment';

    SELECT @Installment = tt.EntityTitle
    FROM #TableNames tt
    WHERE tt.EntityKey = 'Installment';

    SELECT @PayPreparing = tt.EntityTitle
    FROM #TableNames tt
    WHERE tt.EntityKey = 'PayPreparing';

    SELECT @ProformaInvoice = tt.EntityTitle
    FROM #TableNames tt
    WHERE tt.EntityKey = 'ProformaInvoice';

    SELECT @FinancialConfirm = tt.EntityTitle
    FROM #TableNames tt
    WHERE tt.EntityKey = 'FinancialConfirm';

    SELECT @PaymentCheqeCashing = tt.EntityTitle
    FROM #TableNames tt
    WHERE tt.EntityKey = 'PaymentCheqeCashing';

    SELECT @DrawBackPaymentCheqe = tt.EntityTitle
    FROM #TableNames tt
    WHERE tt.EntityKey = 'DrawBackPaymentCheqe';

    SELECT @DeliverToSupplier = tt.EntityTitle
    FROM #TableNames tt
    WHERE tt.EntityKey = 'DeliverToSupplier';

    SELECT @AssignToBank = tt.EntityTitle
    FROM #TableNames tt
    WHERE tt.EntityKey = 'AssignToBank';

    SELECT @CashFromBank = tt.EntityTitle
    FROM #TableNames tt
    WHERE tt.EntityKey = 'CashFromBank';

    SELECT @Protest = tt.EntityTitle
    FROM #TableNames tt
    WHERE tt.EntityKey = 'Protest';

    SELECT @ReturnFromAssignment = tt.EntityTitle
    FROM #TableNames tt
    WHERE tt.EntityKey = 'ReturnFromAssignment';

    SELECT @CashToFund = tt.EntityTitle
    FROM #TableNames tt
    WHERE tt.EntityKey = 'CashToFund';

    SELECT @CashToBank = tt.EntityTitle
    FROM #TableNames tt
    WHERE tt.EntityKey = 'CashToBank';

    SELECT @Spending = tt.EntityTitle
    FROM #TableNames tt
    WHERE tt.EntityKey = 'Spending';

    SELECT @ReturnedOfSpend = tt.EntityTitle
    FROM #TableNames tt
    WHERE tt.EntityKey = 'ReturnedOfSpend';

    SELECT @DrawBack = tt.EntityTitle
    FROM #TableNames tt
    WHERE tt.EntityKey = 'DrawBack';



    DECLARE @UserID INT,
            @DateType TINYINT,
            @DateFormat VARCHAR(10);

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

    IF @EngName = 'SaleContract'
    BEGIN
        IF @needParent = 0
        BEGIN
            SELECT relations.EngName,
                   relations.Title,
                   relations.EntityId,
                   relations.RelatedEntityId,
                   relations.ParentId,
                   CAST(relations.Number AS NVARCHAR(MAX)) Number,
                   relations.DateString,
                   CAST(relations.RowIndex AS INT) RowIndex
            FROM
            (
                SELECT 'Remittance' EngName,
                       @Remittance Title,
                       r.RemittanceID EntityId,
                       ri.RemittanceItemID RelatedEntityId,
                       ri.SaleContractItemID ParentId,
                       r.Number,
                       CFG.GetCLRSaturnDate(r.[Date], @DateFormat, 0, @DateType) DateString,
                       ri.RowIndex
                FROM SLE.RemittanceItem AS ri
                    JOIN SLE.Remittance AS r
                        ON r.RemittanceID = ri.RemittanceID
                WHERE ri.SaleContractItemID = @ParentId
                UNION
                SELECT 'Outgoing' EngName,
                       @Outgoing Title,
                       pri.OutgoingID EntityId,
                       pri.OutgoingItemID RelatedEntityId,
                       pri.SaleContractItemID ParentId,
                       pr.Number,
                       CFG.GetCLRSaturnDate([pr].[Date], @DateFormat, 0, @DateType) DateString,
                       pri.RowIndex
                FROM STC.OutgoingItem AS pri
                    JOIN STC.Outgoing AS pr
                        ON pr.OutgoingID = pri.OutgoingID
                WHERE pri.SaleContractItemID = @ParentId
                UNION
                SELECT 'Invoice' EngName,
                       @SaleInvoice Title,
                       pri.InvoiceID EntityId,
                       pri.InvoiceItemID RelatedEntityId,
                       pri.SaleContractItemID ParentId,
                       pr.Number,
                       CFG.GetCLRSaturnDate([pr].[Date], @DateFormat, 0, @DateType) DateString,
                       pri.RowIndex
                FROM SLE.InvoiceItem AS pri
                    JOIN SLE.Invoice AS pr
                        ON pr.InvoiceID = pri.InvoiceID
                WHERE pri.SaleContractItemID = @ParentId
            ) AS relations;
        END;
        ELSE
        BEGIN
            SELECT CASE o.BaseDocument
                       WHEN 4 THEN
                           'Quotation'
                   END EngName,
                   CASE o.BaseDocument
                       WHEN 4 THEN
                           @Quotation
                   END Title,
                   CASE o.BaseDocument
                       WHEN 4 THEN
                           quot.QuotationID
                   END EntityId,
                   CASE o.BaseDocument
                       WHEN 4 THEN
                           quot.QuotationItemID
                   END RelatedEntityId,
                   CASE
                       WHEN o.BaseDocument <> 1 THEN
                           oi.SaleContractItemID
                   END ParentId,
                   CASE o.BaseDocument
                       WHEN 4 THEN
                           CAST(quot.Number AS NVARCHAR(MAX))
                   END Number,
                   CASE o.BaseDocument
                       WHEN 4 THEN
                           CFG.GetCLRSaturnDate(quot.[Date], @DateFormat, 0, @DateType)
                   END DateString,
                   CASE o.BaseDocument
                       WHEN 4 THEN
                           CAST(quot.RowIndex AS INT)
                   END RowIndex
            FROM SLE.SaleContractItem AS oi
                JOIN SLE.SaleContract AS o
                    ON o.SaleContractID = oi.SaleContractID
                LEFT JOIN
                (
                    SELECT q.QuotationID,
                           qi.QuotationItemID,
                           q.Number,
                           [q].[Date],
                           qi.RowIndex
                    FROM SLE.QuotationItem qi
                        JOIN SLE.Quotation q
                            ON q.QuotationID = qi.QuotationID
                ) quot
                    ON quot.QuotationItemID = oi.QuotationItemID
            WHERE oi.SaleContractItemID = @ParentId
                  AND o.BaseDocument <> 1;
        END;
    END;

    IF @EngName = 'StuffRequest'
    BEGIN
        IF @needParent = 0
        BEGIN
            SELECT relations.EngName,
                   relations.Title,
                   relations.EntityId,
                   relations.RelatedEntityId,
                   relations.ParentId,
                   CAST(relations.Number AS NVARCHAR(MAX)) Number,
                   relations.DateString,
                   CAST(relations.RowIndex AS INT) RowIndex
            FROM
            (
                SELECT 'Outgoing' EngName,
                       @Outgoing Title,
                       oi.OutgoingID EntityId,
                       oi.OutgoingItemID RelatedEntityId,
                       oi.StuffRequestItemID ParentId,
                       o.Number,
                       CFG.GetCLRSaturnDate(o.[Date], @DateFormat, 0, @DateType) DateString,
                       oi.RowIndex
                FROM STC.OutgoingItem oi
                    JOIN STC.Outgoing o
                        ON o.OutgoingID = oi.OutgoingID
                WHERE oi.StuffRequestItemID = @ParentId
                UNION
                SELECT 'PurchaseRequest' EngName,
                       @PurchaseRequest Title,
                       pri.PurchaseRequestID EntityId,
                       pri.PurchaseRequestItemID RelatedEntityId,
                       pri.StuffRequestItemID ParentId,
                       pr.PurchaseRequestNumber Number,
                       CFG.GetCLRSaturnDate([pr].[PurchaseRequestDate], @DateFormat, 0, @DateType) DateString,
                       pri.PurchaseRequestItemIndex RowIndex
                FROM REQ.PurchaseRequestItem pri
                    JOIN REQ.PurchaseRequest pr
                        ON pr.PurchaseRequestID = pri.PurchaseRequestID
                WHERE pri.StuffRequestItemID = @ParentId
                UNION
                -- abcdef
                SELECT 'StuffRequest' EngName,
                       @TransferRequest Title,
                       pri.StuffRequestID EntityId,
                       pri.StuffRequestItemID RelatedEntityId,
                       pri.BaseStuffRequestItemID ParentId,
                       pr.StuffRequestNumber Number,
                       CFG.GetCLRSaturnDate([pr].StuffRequestDate, @DateFormat, 0, @DateType) DateString,
                       pri.StuffRequestItemIndex RowIndex
                FROM REQ.StuffRequestItem AS pri
                    JOIN REQ.StuffRequest AS pr
                        ON pr.StuffRequestID = pri.StuffRequestID
                WHERE pri.BaseStuffRequestItemID = @ParentId
            ) AS relations;
        END;
    END;

    IF @EngName = 'TransferRequest'
    BEGIN
        IF @needParent = 0
        BEGIN
            SELECT relations.EngName,
                   relations.Title,
                   relations.EntityId,
                   relations.RelatedEntityId,
                   relations.ParentId,
                   CAST(relations.Number AS NVARCHAR(MAX)) Number,
                   relations.DateString,
                   CAST(relations.RowIndex AS INT) RowIndex
            FROM
            (
                SELECT 'Outgoing' EngName,
                       @Outgoing Title,
                       oi.OutgoingID EntityId,
                       oi.OutgoingItemID RelatedEntityId,
                       oi.StuffRequestItemID ParentId,
                       o.Number,
                       CFG.GetCLRSaturnDate(o.[Date], @DateFormat, 0, @DateType) DateString,
                       oi.RowIndex
                FROM STC.OutgoingItem oi
                    JOIN STC.Outgoing o
                        ON o.OutgoingID = oi.OutgoingID
                WHERE oi.StuffRequestItemID = @ParentId
                UNION
                SELECT 'PurchaseRequest' EngName,
                       @PurchaseRequest Title,
                       pri.PurchaseRequestID EntityId,
                       pri.PurchaseRequestItemID RelatedEntityId,
                       pri.StuffRequestItemID ParentId,
                       pr.PurchaseRequestNumber Number,
                       CFG.GetCLRSaturnDate([pr].[PurchaseRequestDate], @DateFormat, 0, @DateType) DateString,
                       pri.PurchaseRequestItemIndex RowIndex
                FROM REQ.PurchaseRequestItem pri
                    JOIN REQ.PurchaseRequest pr
                        ON pr.PurchaseRequestID = pri.PurchaseRequestID
                WHERE pri.StuffRequestItemID = @ParentId
            ) AS relations;
        END;
        ELSE IF @needParent = 1
        BEGIN
            SELECT N'StuffRequest' EngName,
                   @StuffRequest Title,
                   rSR.StuffRequestID EntityId,
                   sri.BaseStuffRequestItemID RelatedEntityId,
                   sri.StuffRequestItemID ParentId,
                   CAST(sr.StuffRequestNumber AS NVARCHAR(MAX)) Number,
                   CFG.GetCLRSaturnDate(rSR.StuffRequestDate, @DateFormat, 0, @DateType) DateString,
                   rSR.StuffRequestItemIndex RowIndex
            FROM REQ.StuffRequestItem AS sri
                JOIN REQ.StuffRequest AS sr
                    ON sr.StuffRequestID = sri.StuffRequestID
                LEFT JOIN
                (
                    SELECT sri.StuffRequestItemID,
                           SR.StuffRequestNumber,
                           SR.StuffRequestDate,
                           sri.StuffRequestItemIndex,
                           sri.StuffRequestID
                    FROM REQ.StuffRequestItem sri
                        JOIN REQ.StuffRequest SR
                            ON SR.StuffRequestID = sri.StuffRequestID
                ) rSR
                    ON rSR.StuffRequestItemID = sri.BaseStuffRequestItemID
            WHERE sri.StuffRequestItemID = @ParentId
                  AND sr.BaseDocument <> 1;
        END;
    END;


    IF @EngName = 'Outgoing'
    BEGIN
        IF @needParent = 1
        BEGIN
            SELECT CASE sdtb.BaseEntity
                       WHEN 2 THEN
                           'StuffRequest'
                       WHEN 3 THEN
                           'Justification'
                       WHEN 4 THEN
                           'Quotation'
                       WHEN 5 THEN
                           'Remittance'
                       WHEN 6 THEN
                           'Invoice'
                       WHEN 7 THEN
                           'TemporaryOutgoing'
                       WHEN 8 THEN
                           'Reception'
                   END EngName,
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
                           @SaleInvoice
                       WHEN 7 THEN
                           N'برگشت حواله موقت'
                       WHEN 8 THEN
                           @Reception
                   END Title,
                   CASE sdtb.BaseEntity
                       WHEN 2 THEN
                           SR.StuffRequestID
                       WHEN 3 THEN
                           ju.JustificationID
                       WHEN 4 THEN
                           quot.QuotationID
                       WHEN 5 THEN
                           rem.RemittanceID
                       WHEN 6 THEN
                           inv.InvoiceID
                       WHEN 7 THEN
                           temp.TemporaryOutgoingID
                       WHEN 8 THEN
                           oi.ReceptionID
                   END EntityId,
                   CASE sdtb.BaseEntity
                       WHEN 2 THEN
                           oi.StuffRequestItemID
                       WHEN 3 THEN
                           ju.JustificationItemID
                       WHEN 4 THEN
                           quot.QuotationItemID
                       WHEN 5 THEN
                           rem.RemittanceItemID
                       WHEN 6 THEN
                           inv.InvoiceItemID
                       WHEN 7 THEN
                           temp.TemporaryOutgoingItemID
                       WHEN 8 THEN
                           oi.ReceptionID
                   END RelatedEntityId,
                   CASE
                       WHEN sdtb.BaseEntity <> 1 THEN
                           oi.OutgoingItemID
                   END ParentId,
                   CASE sdtb.BaseEntity
                       WHEN 2 THEN
                           CAST(SR.StuffRequestNumber AS NVARCHAR(MAX))
                       WHEN 3 THEN
                           CAST(ju.Number AS NVARCHAR(MAX))
                       WHEN 4 THEN
                           CAST(quot.Number AS NVARCHAR(MAX))
                       WHEN 5 THEN
                           CAST(rem.Number AS NVARCHAR(MAX))
                       WHEN 6 THEN
                           CAST(inv.Number AS NVARCHAR(MAX))
                       WHEN 7 THEN
                           CAST(temp.Number AS NVARCHAR(MAX))
                       WHEN 8 THEN
                           CAST(r.Number AS NVARCHAR(MAX))
                   END Number,
                   CASE sdtb.BaseEntity
                       WHEN 2 THEN
                           CFG.GetCLRSaturnDate(SR.StuffRequestDate, @DateFormat, 0, @DateType)
                       WHEN 3 THEN
                           CFG.GetCLRSaturnDate(ju.[Date], @DateFormat, 0, @DateType)
                       WHEN 4 THEN
                           CFG.GetCLRSaturnDate(quot.[Date], @DateFormat, 0, @DateType)
                       WHEN 5 THEN
                           CFG.GetCLRSaturnDate(rem.[Date], @DateFormat, 0, @DateType)
                       WHEN 6 THEN
                           CFG.GetCLRSaturnDate(inv.[Date], @DateFormat, 0, @DateType)
                       WHEN 7 THEN
                           CFG.GetCLRSaturnDate(temp.[Date], @DateFormat, 0, @DateType)
                       WHEN 8 THEN
                           CFG.GetCLRSaturnDate(r.[Date], @DateFormat, 0, @DateType)
                   END DateString,
                   CASE sdtb.BaseEntity
                       WHEN 2 THEN
                           SR.StuffRequestItemIndex
                       WHEN 3 THEN
                           CAST(ju.RowIndex AS INT)
                       WHEN 4 THEN
                           CAST(quot.RowIndex AS INT)
                       WHEN 5 THEN
                           CAST(rem.RowIndex AS INT)
                       WHEN 6 THEN
                           CAST(inv.RowIndex AS INT)
                       WHEN 7 THEN
                           CAST(temp.RowIndex AS INT)
                       WHEN 8 THEN
                           0
                   END RowIndex
            FROM STC.OutgoingItem oi
                JOIN STC.Outgoing o
                    ON o.OutgoingID = oi.OutgoingID
                JOIN [STC].[StockDocumentTypeBaseEntity] sdtb 
                    ON o.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
                LEFT JOIN
                (
                    SELECT sri.StuffRequestItemID,
                           SR.StuffRequestNumber,
                           SR.StuffRequestDate,
                           sri.StuffRequestItemIndex,
                           sri.StuffRequestID
                    FROM REQ.StuffRequestItem sri
                        JOIN REQ.StuffRequest SR
                            ON SR.StuffRequestID = sri.StuffRequestID
                ) SR
                    ON SR.StuffRequestItemID = oi.StuffRequestItemID
                LEFT JOIN
                (
                    SELECT j.JustificationID,
                           ji.JustificationItemID,
                           j.Number,
                           [j].[Date],
                           ji.RowIndex
                    FROM SLE.JustificationItem ji
                        JOIN SLE.Justification j
                            ON j.JustificationID = ji.JustificationID
                ) ju
                    ON ju.JustificationItemID = oi.JustificationItemID
                LEFT JOIN
                (
                    SELECT q.QuotationID,
                           qi.QuotationItemID,
                           q.Number,
                           [q].[Date],
                           qi.RowIndex
                    FROM SLE.QuotationItem qi
                        JOIN SLE.Quotation q
                            ON q.QuotationID = qi.QuotationID
                ) quot
                    ON quot.QuotationItemID = oi.QuotationItemID
                LEFT JOIN
                (
                    SELECT r.RemittanceID,
                           ri.RemittanceItemID,
                           r.Number,
                           [r].[Date],
                           ri.RowIndex
                    FROM SLE.RemittanceItem ri
                        JOIN SLE.Remittance r
                            ON r.RemittanceID = ri.RemittanceID
                ) rem
                    ON rem.RemittanceItemID = oi.RemittanceItemID
                LEFT JOIN
                (
                    SELECT i.InvoiceID,
                           ii.InvoiceItemID,
                           i.Number,
                           [i].[Date],
                           ii.RowIndex
                    FROM SLE.InvoiceItem ii
                        JOIN SLE.Invoice i
                            ON i.InvoiceID = ii.InvoiceID
                ) inv
                    ON inv.InvoiceItemID = oi.InvoiceItemID
                LEFT JOIN
                (
                    SELECT t.TemporaryOutgoingID,
                           toi.TemporaryOutgoingItemID,
                           t.Number,
                           t.[Date],
                           toi.RowIndex
                    FROM STC.TemporaryOutgoingItem toi
                        JOIN STC.TemporaryOutgoing t
                            ON t.TemporaryOutgoingID = toi.TemporaryOutgoingID
                ) temp
                    ON temp.TemporaryOutgoingItemID = oi.TemporaryOutgoingItemID
                LEFT JOIN CTM.Reception r
                    ON r.ReceptionID = oi.ReceptionID
            WHERE oi.OutgoingItemID = @ParentId
                  AND sdtb.BaseEntity <> 1;
        END;
        ELSE
        BEGIN
            SELECT relation.EngName,
                   relation.Title,
                   relation.EntityId,
                   relation.RelatedEntityId,
                   relation.ParentId,
                   CAST(relation.Number AS NVARCHAR(MAX)) Number,
                   relation.DateString,
                   CAST(relation.RowIndex AS INT) RowIndex
            FROM
            (
                SELECT 'Invoice' EngName,
                       @SaleInvoice Title,
                       ii.InvoiceID EntityId,
                       ii.InvoiceItemID RelatedEntityId,
                       ii.OutgoingItemId ParentId,
                       i.Number,
                       CFG.GetCLRSaturnDate(i.[Date], @DateFormat, 0, @DateType) DateString,
                       CAST(ii.RowIndex AS INT) RowIndex
                FROM SLE.InvoiceItem ii
                    JOIN SLE.Invoice i
                        ON i.InvoiceID = ii.InvoiceID
                WHERE OutgoingItemId = @ParentId
                UNION
                SELECT 'AssetReceipt' EngName,
                       @AssetReceipt Title,
                       ii.AssetReceiptID EntityId,
                       ii.AssetReceiptItemID RelatedEntityId,
                       ii.OutgoingItemID ParentId,
                       ar.Number,
                       CFG.GetCLRSaturnDate(ar.[Date], @DateFormat, 0, @DateType) DateString,
                       0 RowIndex
                FROM AST.AssetReceiptItem ii
                JOIN AST.AssetReceipt ar
                    on ii.AssetReceiptID = ar.AssetReceiptID
                WHERE ii.OutgoingItemID = @ParentId
                UNION
                SELECT 'ReturnedOutgoing' EngName,
                       @ReturnedOutgoing Title,
                       i.ReturnedOutgoingID EntityId,
                       ii.ReturnedOutgoingItemID RelatedEntityId,
                       ii.OutgoingItemID ParentId,
                       i.Number,
                       CFG.GetCLRSaturnDate(i.[Date], @DateFormat, 0, @DateType) DateString,
                       CAST(ii.RowIndex AS INT) RowIndex
                FROM STC.ReturnedOutgoingItem ii
                    JOIN STC.ReturnedOutgoing i
                        ON i.ReturnedOutgoingID = ii.ReturnedOutgoingID
                WHERE OutgoingItemID = @ParentId
                UNION
                SELECT 'Repair' EngName,
                       @Repair Title,
                       i.RepairID EntityId,
                       ii.RepairStuffCostID RelatedEntityId,
                       ii.OutgoingItemID ParentId,
                       i.Number,
                       CFG.GetCLRSaturnDate(i.[Date], @DateFormat, 0, @DateType) DateString,
                       0 RowIndex
                FROM AST.RepairStuffCost ii
                    JOIN AST.Repair i
                        ON i.RepairID = ii.RepairID
                WHERE OutgoingItemID = @ParentId
                UNION
                SELECT 'RevisionCost' EngName,
                       @RevisionCost Title,
                       i.RevisionCostID EntityId,
                       ii.RevisionCostItemID RelatedEntityId,
                       ii.OutgoingItemID ParentId,
                       i.Number,
                       CFG.GetCLRSaturnDate(i.[Date], @DateFormat, 0, @DateType) DateString,
                       0 RowIndex
                FROM STC.RevisionCostItem ii
                    JOIN STC.RevisionCost i
                        ON i.RevisionCostID = ii.RevisionCostID
                WHERE OutgoingItemID = @ParentId
                UNION
                SELECT 'StockReceipt' EngName,
                       @StockReceipt Title,
                       i.StockReceiptID EntityId,
                       ii.StockReceiptItemID RelatedEntityId,
                       ii.OutgoingItemID ParentId,
                       i.Number,
                       CFG.GetCLRSaturnDate(i.[Date], @DateFormat, 0, @DateType) DateString,
                       CAST(ii.RowIndex AS INT) RowIndex
                FROM STC.StockReceiptItem ii
                    JOIN STC.StockReceipt i
                        ON i.StockReceiptID = ii.StockReceiptID
                WHERE OutgoingItemID = @ParentId
            ) relation;
        END;
    END;

    IF @EngName = 'PurchaseRequest'
    BEGIN
        IF @needParent = 1
        BEGIN
            SELECT CASE pr.BaseDocument
                       WHEN 2 THEN
                           N'StuffRequest'
                       WHEN 9 THEN
                           N'TransferRequest'
                   END EngName,
                   CASE pr.BaseDocument
                       WHEN 2 THEN
                           @StuffRequest
                       WHEN 9 THEN
                           @TransferRequest
                   END Title,
                   CASE pr.BaseDocument
                       WHEN 2 THEN
                           SR.StuffRequestID
                       WHEN 9 THEN
                           SR.StuffRequestID
                   END EntityId,
                   CASE pr.BaseDocument
                       WHEN 2 THEN
                           pri.StuffRequestItemID
                       WHEN 9 THEN
                           pri.StuffRequestItemID
                   END RelatedEntityId,
                   CASE pr.BaseDocument
                       WHEN 2 THEN
                           pri.PurchaseRequestItemID
                       WHEN 9 THEN
                           pri.PurchaseRequestItemID
                   END ParentId,
                   CASE pr.BaseDocument
                       WHEN 2 THEN
                           CAST(SR.StuffRequestNumber AS NVARCHAR(MAX))
                       WHEN 9 THEN
                           CAST(SR.StuffRequestNumber AS NVARCHAR(MAX))
                   END Number,
                   CASE pr.BaseDocument
                       WHEN 2 THEN
                           CFG.GetCLRSaturnDate(SR.StuffRequestDate, @DateFormat, 0, @DateType)
                       WHEN 9 THEN
                           CFG.GetCLRSaturnDate(SR.StuffRequestDate, @DateFormat, 0, @DateType)
                   END DateString,
                   CASE pr.BaseDocument
                       WHEN 2 THEN
                           SR.StuffRequestItemIndex
                       WHEN 9 THEN
                           SR.StuffRequestItemIndex
                   END RowIndex
            FROM REQ.PurchaseRequestItem pri
                JOIN REQ.PurchaseRequest pr
                    ON pr.PurchaseRequestID = pri.PurchaseRequestID
                LEFT JOIN
                (
                    SELECT sri.StuffRequestItemID,
                           SR.StuffRequestNumber,
                           SR.StuffRequestDate,
                           sri.StuffRequestItemIndex,
                           sri.StuffRequestID
                    FROM REQ.StuffRequestItem sri
                        JOIN REQ.StuffRequest SR
                            ON SR.StuffRequestID = sri.StuffRequestID
                ) SR
                    ON SR.StuffRequestItemID = pri.StuffRequestItemID
            WHERE pri.PurchaseRequestItemID = @ParentId
                  AND pr.BaseDocument <> 1;
        END;
        ELSE
        BEGIN
            SELECT relation.EngName,
                   relation.Title,
                   relation.EntityId,
                   relation.RelatedEntityId,
                   relation.ParentId,
                   CAST(relation.Number AS NVARCHAR(MAX)) Number,
                   relation.DateString,
                   relation.RowIndex
            FROM
            (
                SELECT 'TemporaryStockReceipt' EngName,
                       @TemporaryStockReceipt Title,
                       tri.TemporaryStockReceiptID EntityId,
                       tri.TemporaryStockReceiptItemID RelatedEntityId,
                       tri.PurchaseRequestItemID ParentId,
                       tsr.Number,
                       CFG.GetCLRSaturnDate(tsr.[Date], @DateFormat, 0, @DateType) DateString,
                       tri.RowIndex
                FROM STC.TemporaryStockReceipt tsr
                    JOIN STC.TemporaryStockReceiptItem tri
                        ON tri.TemporaryStockReceiptID = tsr.TemporaryStockReceiptID
                WHERE tri.PurchaseRequestItemID = @ParentId
                UNION
                SELECT 'PurchaseContract' EngName,
                       @PurchaseContract Title,
                       pc.PurchaseContractID EntityId,
                       pci.PurchaseContractItemID RelatedEntityId,
                       pci.PurchaseRequestItemID ParentId,
                       pc.Number,
                       CFG.GetCLRSaturnDate([pc].[Date], @DateFormat, 0, @DateType) DateString,
                       pci.RowIndex
                FROM VND.PurchaseContract AS pc
                    JOIN VND.PurchaseContractItem AS pci
                        ON pci.PurchaseContractID = pc.PurchaseContractID
                WHERE pci.PurchaseRequestItemID = @ParentId
                UNION
                SELECT 'Proposal' EngName,
                       @Proposal Title,
                       p.ProposalID EntityId,
                       ProposalItemID RelatedEntityId,
                       PurchaseRequestItemID ParentId,
                       p.Number,
                       CFG.GetCLRSaturnDate([p].[Date], @DateFormat, 0, @DateType) DateString,
                       CAST(pin.RowIndex AS INT) RowIndex
                FROM VND.Proposal p
                    JOIN VND.ProposalItem pin
                        ON pin.ProposalID = p.ProposalID
                WHERE PurchaseRequestItemID = @ParentId
                UNION
                SELECT 'JustificationInput' EngName,
                       @JustificationInput Title,
                       ji.JustificationInputID EntityId,
                       JustificationInputItemID RelatedEntityId,
                       PurchaseRequestItemID ParentId,
                       ji.Number,
                       CFG.GetCLRSaturnDate([ji].[Date], @DateFormat, 0, @DateType) DateString,
                       jii.RowIndex
                FROM STC.JustificationInputItem jii
                    JOIN STC.JustificationInput ji
                        ON ji.JustificationInputID = jii.JustificationInputID
                WHERE PurchaseRequestItemID = @ParentId
                UNION
                SELECT 'StockReceipt' EngName,
                       @StockReceipt Title,
                       i.StockReceiptID EntityId,
                       StockReceiptItemID RelatedEntityId,
                       PurchaseRequestItemID ParentId,
                       i.Number,
                       CFG.GetCLRSaturnDate([i].[Date], @DateFormat, 0, @DateType) DateString,
                       CAST(ii.RowIndex AS INT) RowIndex
                FROM STC.StockReceipt i
                    JOIN STC.StockReceiptItem ii
                        ON ii.StockReceiptID = i.StockReceiptID
                WHERE PurchaseRequestItemID = @ParentId
                UNION
                SELECT 'PurchaseInvoice' EngName,
                       @PurchaseInvoice Title,
                       i.PurchaseInvoiceID EntityId,
                       PurchaseInvoiceItemID RelatedEntityId,
                       PurchaseRequestItemID ParentId,
                       i.Number,
                       CFG.GetCLRSaturnDate([i].[Date], @DateFormat, 0, @DateType) DateString,
                       CAST(ii.RowIndex AS INT) RowIndex
                FROM VND.PurchaseInvoice i
                    JOIN VND.PurchaseInvoiceItem ii
                        ON ii.PurchaseInvoiceID = i.PurchaseInvoiceID
                WHERE PurchaseRequestItemID = @ParentId
            ) relation;
        END;
    END;

    IF @EngName = 'TemporaryStockReceipt'
    BEGIN
        IF @needParent = 1
        BEGIN
            SELECT CASE sdtb.BaseEntity
                       WHEN 2 THEN
                           'PurchaseRequest'
                       WHEN 3 THEN
                           'Proposal'
                       WHEN 8 THEN
                           'PurchaseContract'
                   END EngName,
                   CASE sdtb.BaseEntity
                       WHEN 2 THEN
                           @PurchaseRequest
                       WHEN 3 THEN
                           @Proposal
                       WHEN 8 THEN
                           @PurchaseContract
                   END Title,
                   CASE sdtb.BaseEntity
                       WHEN 2 THEN
                           PR.PurchaseRequestID
                       WHEN 3 THEN
                           P.ProposalID
                       WHEN 8 THEN
                           PC.PurchaseContractID
                   END EntityId,
                   CASE sdtb.BaseEntity
                       WHEN 2 THEN
                           tsri.PurchaseRequestItemID
                       WHEN 3 THEN
                           tsri.ProposalItemID
                       WHEN 8 THEN
                           PC.PurchaseContractItemID
                   END RelatedEntityId,
                   CASE
                       WHEN sdtb.BaseEntity <> 1 THEN
                           tsri.TemporaryStockReceiptItemID
                   END ParentId,
                   CASE sdtb.BaseEntity
                       WHEN 2 THEN
                           CAST(PR.PurchaseRequestNumber AS NVARCHAR(MAX))
                       WHEN 3 THEN
                           CAST(P.Number AS NVARCHAR(MAX))
                       WHEN 8 THEN
                           CAST(PC.Number AS NVARCHAR(MAX))
                   END Number,
                   CASE sdtb.BaseEntity
                       WHEN 2 THEN
                           CFG.GetCLRSaturnDate(PR.PurchaseRequestDate, @DateFormat, 0, @DateType)
                       WHEN 3 THEN
                           CFG.GetCLRSaturnDate(P.[Date], @DateFormat, 0, @DateType)
                       WHEN 8 THEN
                           CFG.GetCLRSaturnDate(PC.[Date], @DateFormat, 0, @DateType)
                   END DateString,
                   CASE sdtb.BaseEntity
                       WHEN 2 THEN
                           PR.PurchaseRequestItemIndex
                       WHEN 3 THEN
                           P.RowIndex
                       WHEN 8 THEN
                           PC.RowIndex
                   END RowIndex
            FROM STC.TemporaryStockReceiptItem tsri
                JOIN STC.TemporaryStockReceipt tsr
                    ON tsr.TemporaryStockReceiptID = tsri.TemporaryStockReceiptID
                JOIN STC.StockDocumentTypeBaseEntity sdtb
                        ON tsr.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
                LEFT JOIN
                (
                    SELECT pri.PurchaseRequestItemID,
                           PR.PurchaseRequestNumber,
                           PR.PurchaseRequestDate,
                           pri.PurchaseRequestItemIndex,
                           pri.PurchaseRequestID
                    FROM REQ.PurchaseRequestItem pri
                        JOIN REQ.PurchaseRequest PR
                            ON PR.PurchaseRequestID = pri.PurchaseRequestID
                ) PR
                    ON PR.PurchaseRequestItemID = tsri.PurchaseRequestItemID
                LEFT JOIN
                (
                    SELECT ppi.ProposalItemID,
                           pp.[Date],
                           pp.Number,
                           ppi.RowIndex,
                           ppi.ProposalID
                    FROM VND.ProposalItem ppi
                        JOIN VND.Proposal pp
                            ON pp.ProposalID = ppi.ProposalID
                ) P
                    ON P.ProposalItemID = tsri.ProposalItemID
                LEFT JOIN
                (
                    SELECT pci.PurchaseContractItemID,
                           PC.Date,
                           PC.Number,
                           pci.RowIndex,
                           PC.PurchaseContractID
                    FROM VND.PurchaseContractItem AS pci
                        JOIN VND.PurchaseContract AS PC
                            ON PC.PurchaseContractID = pci.PurchaseContractID
                ) PC
                    ON PC.PurchaseContractItemID = tsri.PurchaseContractItemID
            WHERE tsri.TemporaryStockReceiptItemID = @ParentId
                  AND sdtb.BaseEntity <> 1;
        END;
        ELSE
        BEGIN
            SELECT relation.EngName,
                   relation.Title,
                   relation.EntityId,
                   relation.RelatedEntityId,
                   relation.ParentId,
                   CAST(relation.Number AS NVARCHAR(MAX)) Number,
                   relation.DateString,
                   CAST(relation.RowIndex AS INT) RowIndex
            FROM
            (
                SELECT 'JustificationInput' EngName,
                       @JustificationInput Title,
                       j.JustificationInputID EntityId,
                       ji.JustificationInputItemID RelatedEntityId,
                       ji.TemporaryStockReceiptItemID ParentId,
                       j.Number,
                       CFG.GetCLRSaturnDate(j.[Date], @DateFormat, 0, @DateType) DateString,
                       ji.RowIndex
                FROM STC.JustificationInputItem ji
                    JOIN STC.JustificationInput j
                        ON j.JustificationInputID = ji.JustificationInputID
                WHERE TemporaryStockReceiptItemID = @ParentId
                UNION
                SELECT 'ReturnRequest' EngName,
                       @ReturnRequest Title,
                       rr.ReturnRequestID EntityId,
                       rri.ReturnRequestItemID RelatedEntityId,
                       rri.TemporaryStockReceiptItemID ParentId,
                       rr.ReturnRequestNumber Number,
                       CFG.GetCLRSaturnDate([rr].[ReturnRequestDate], @DateFormat, 0, @DateType) DateString,
                       CAST(rri.ReturnRequestItemIndex AS INT) RowIndex
                FROM REQ.ReturnRequestItem rri
                    JOIN REQ.ReturnRequest rr
                        ON rr.ReturnRequestID = rri.ReturnRequestID
                WHERE TemporaryStockReceiptItemID = @ParentId
                UNION
                SELECT 'ReturnedTemporaryStockReceipt' EngName,
                       N'برگشت رسید موقت' Title,
                       rts.ReturnedTemporaryStockReceiptID EntityId,
                       rtsr.ReturnedTemporaryStockReceiptItemID RelatedEntityId,
                       rtsr.TemporaryStockReceiptItemID ParentId,
                       rts.Number,
                       CFG.GetCLRSaturnDate(rts.[Date], @DateFormat, 0, @DateType) DateString,
                       rtsr.RowIndex
                FROM STC.ReturnedTemporaryStockReceiptItem rtsr
                    JOIN STC.ReturnedTemporaryStockReceipt rts
                        ON rts.ReturnedTemporaryStockReceiptID = rtsr.ReturnedTemporaryStockReceiptID
                WHERE TemporaryStockReceiptItemID = @ParentId
            ) relation;
        END;
    END;

    IF @EngName = 'JustificationInput'
    BEGIN
        IF @needParent = 1
        BEGIN
            SELECT CASE sdtb.BaseEntity
                       WHEN 2 THEN
                           'PurchaseRequest'
                       WHEN 3 THEN
                           'Proposal'
                       WHEN 4 THEN
                           'TemporaryStockReceipt'
                   END EngName,
                   CASE sdtb.BaseEntity
                       WHEN 2 THEN
                           @PurchaseRequest
                       WHEN 3 THEN
                           @Proposal
                       WHEN 4 THEN
                           @TemporaryStockReceipt
                   END Title,
                   CASE sdtb.BaseEntity
                       WHEN 2 THEN
                           PR.PurchaseRequestID
                       WHEN 3 THEN
                           P.ProposalID
                       WHEN 4 THEN
                           Temp.TemporaryStockReceiptID
                   END EntityId,
                   CASE sdtb.BaseEntity
                       WHEN 2 THEN
                           jii.PurchaseRequestItemID
                       WHEN 3 THEN
                           jii.ProposalItemID
                       WHEN 4 THEN
                           jii.TemporaryStockReceiptItemID
                   END RelatedEntityId,
                   CASE
                       WHEN sdtb.BaseEntity <> 1 THEN
                           jii.JustificationInputItemID
                   END ParentId,
                   CAST(CASE sdtb.BaseEntity
                            WHEN 2 THEN
                                PR.PurchaseRequestNumber
                            WHEN 3 THEN
                                P.Number
                            WHEN 4 THEN
                                Temp.Number
                        END AS NVARCHAR(10)) Number,
                   CASE sdtb.BaseEntity
                       WHEN 2 THEN
                           CFG.GetCLRSaturnDate(PR.PurchaseRequestDate, @DateFormat, 0, @DateType)
                       WHEN 3 THEN
                           CFG.GetCLRSaturnDate(P.[Date], @DateFormat, 0, @DateType)
                       WHEN 4 THEN
                           CFG.GetCLRSaturnDate(Temp.[Date], @DateFormat, 0, @DateType)
                   END DateString,
                   CAST(CASE sdtb.BaseEntity
                            WHEN 2 THEN
                                PR.PurchaseRequestItemIndex
                            WHEN 3 THEN
                                P.RowIndex
                            WHEN 4 THEN
                                Temp.RowIndex
                        END AS INT) RowIndex
            FROM STC.JustificationInputItem jii
                JOIN STC.JustificationInput ji
                    ON ji.JustificationInputID = jii.JustificationInputID
                JOIN [STC].[StockDocumentTypeBaseEntity] sdtb
                    ON ji.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
                LEFT JOIN
                (
                    SELECT pii.PurchaseRequestID,
                           pii.PurchaseRequestItemID,
                           P.PurchaseRequestNumber,
                           P.PurchaseRequestDate,
                           pii.PurchaseRequestItemIndex
                    FROM REQ.PurchaseRequest P
                        JOIN REQ.PurchaseRequestItem pii
                            ON pii.PurchaseRequestID = P.PurchaseRequestID
                ) PR
                    ON PR.PurchaseRequestItemID = jii.PurchaseRequestItemID
                LEFT JOIN
                (
                    SELECT pii.ProposalID,
                           pii.ProposalItemID,
                           pp.[Date],
                           pp.Number,
                           pii.RowIndex
                    FROM VND.ProposalItem pii
                        JOIN VND.Proposal pp
                            ON pp.ProposalID = pii.ProposalID
                ) P
                    ON P.ProposalItemID = jii.ProposalItemID
                LEFT JOIN
                (
                    SELECT ppi.TemporaryStockReceiptID,
                           ppi.TemporaryStockReceiptItemID,
                           pp.[Date],
                           pp.Number,
                           ppi.RowIndex
                    FROM STC.TemporaryStockReceiptItem ppi
                        JOIN STC.TemporaryStockReceipt pp
                            ON pp.TemporaryStockReceiptID = ppi.TemporaryStockReceiptID
                ) Temp
                    ON Temp.TemporaryStockReceiptItemID = jii.TemporaryStockReceiptItemID
            WHERE jii.JustificationInputItemID = @ParentId
                  AND sdtb.BaseEntity <> 1;
        END;
        ELSE
        BEGIN
            SELECT 'StockReceipt' EngName,
                   @StockReceipt Title,
                   sr.StockReceiptID EntityId,
                   StockReceiptItemID RelatedEntityId,
                   JustificationInputItemID ParentId,
                   CAST(sr.Number AS NVARCHAR(10)) Number,
                   CFG.GetCLRSaturnDate(sr.Date, @DateFormat, 0, @DateType) DateString,
                   CAST(sri.RowIndex AS INT) RowIndex
            FROM STC.StockReceiptItem sri
                JOIN STC.StockReceipt sr
                    ON sr.StockReceiptID = sri.StockReceiptID
            WHERE JustificationInputItemID = @ParentId;
        END;
    END;

    IF @EngName = 'ReturnRequest'
    BEGIN
        IF @needParent = 1
        BEGIN
            SELECT CASE rr.DocumentType
                       WHEN 3 THEN
                           'StockReceipt'
                       WHEN 4 THEN
                           'TemporaryStockReceipt'
                   END EngName,
                   CASE rr.DocumentType
                       WHEN 3 THEN
                           @StockReceipt
                       WHEN 4 THEN
                           @TemporaryStockReceipt
                   END Title,
                   CASE rr.DocumentType
                       WHEN 3 THEN
                           sr.StockReceiptID
                       WHEN 4 THEN
                           TSR.TemporaryStockReceiptID
                   END EntityId,
                   CASE rr.DocumentType
                       WHEN 3 THEN
                           rri.StockReceiptItemID
                       WHEN 4 THEN
                           rri.TemporaryStockReceiptItemID
                   END RelatedEntityId,
                   CASE
                       WHEN rr.DocumentType <> 1 THEN
                           rri.ReturnRequestItemID
                   END ParentId,
                   CAST(CASE rr.DocumentType
                            WHEN 3 THEN
                                sr.Number
                            WHEN 4 THEN
                                TSR.Number
                        END AS NVARCHAR(10)) Number,
                   CASE rr.DocumentType
                       WHEN 3 THEN
                           CFG.GetCLRSaturnDate(sr.[Date], @DateFormat, 0, @DateType)
                       WHEN 4 THEN
                           CFG.GetCLRSaturnDate(TSR.[Date], @DateFormat, 0, @DateType)
                   END DateString,
                   CAST(CASE rr.DocumentType
                            WHEN 3 THEN
                                sr.RowIndex
                            WHEN 4 THEN
                                TSR.RowIndex
                        END AS INT) RowIndex
            FROM REQ.ReturnRequestItem rri
                JOIN REQ.ReturnRequest rr
                    ON rr.ReturnRequestID = rri.ReturnRequestID
                LEFT JOIN
                (
                    SELECT sri.StockReceiptID,
                           sri.StockReceiptItemID,
                           sr.Number,
                           sr.Date,
                           sri.RowIndex
                    FROM STC.StockReceipt sr
                        JOIN STC.StockReceiptItem sri
                            ON sri.StockReceiptID = sr.StockReceiptID
                ) sr
                    ON sr.StockReceiptItemID = rri.StockReceiptItemID
                LEFT JOIN
                (
                    SELECT sri.TemporaryStockReceiptID,
                           sri.TemporaryStockReceiptItemID,
                           sr.Number,
                           sr.[Date],
                           sri.RowIndex
                    FROM STC.TemporaryStockReceipt sr
                        JOIN STC.TemporaryStockReceiptItem sri
                            ON sri.TemporaryStockReceiptID = sr.TemporaryStockReceiptID
                ) TSR
                    ON TSR.TemporaryStockReceiptItemID = rri.TemporaryStockReceiptItemID
            WHERE rri.ReturnRequestItemID = @ParentId
                  AND rr.DocumentType <> 1;
        END;
        ELSE
            SELECT 'ReturnedTemporaryStockReceipt' EngName,
                   N'برگشت رسید موقت' Title,
                   rri.ReturnedTemporaryStockReceiptID EntityId,
                   ReturnedTemporaryStockReceiptItemID RelatedEntityId,
                   ReturnRequestItemID ParentId,
                   CAST(tr.Number AS NVARCHAR(10)) Number,
                   CFG.GetCLRSaturnDate(tr.Date, @DateFormat, 0, @DateType) DateString,
                   rri.RowIndex
            FROM STC.ReturnedTemporaryStockReceiptItem rri
                JOIN STC.ReturnedTemporaryStockReceipt tr
                    ON tr.ReturnedTemporaryStockReceiptID = rri.ReturnedTemporaryStockReceiptID
            WHERE ReturnRequestItemID = @ParentId;
    END;

    IF @EngName = 'Proposal'
    BEGIN
        IF @needParent = 1
        BEGIN
            SELECT CASE p.BaseDocument
                       WHEN 2 THEN
                           'PurchaseRequest'
                   END EngName,
                   CASE p.BaseDocument
                       WHEN 2 THEN
                           @PurchaseRequest
                   END Title,
                   CASE p.BaseDocument
                       WHEN 2 THEN
                           pr.PurchaseRequestID
                   END EntityId,
                   CASE p.BaseDocument
                       WHEN 2 THEN
                           pri.PurchaseRequestItemID
                   END RelatedEntityId,
                   CASE p.BaseDocument
                       WHEN 2 THEN
                           pri.ProposalItemID
                   END ParentId,
                   CAST(CASE p.BaseDocument
                            WHEN 2 THEN
                                pr.PurchaseRequestNumber
                        END AS NVARCHAR(10)) Number,
                   CASE p.BaseDocument
                       WHEN 2 THEN
                           CFG.GetCLRSaturnDate(pr.PurchaseRequestDate, @DateFormat, 0, @DateType)
                   END DateString,
                   CASE p.BaseDocument
                       WHEN 2 THEN
                           prii.PurchaseRequestItemIndex
                   END RowIndex
            FROM VND.ProposalItem pri
                JOIN VND.Proposal p
                    ON p.ProposalID = pri.ProposalID
                JOIN REQ.PurchaseRequestItem prii
                    ON prii.PurchaseRequestItemID = pri.PurchaseRequestItemID
                JOIN REQ.PurchaseRequest pr
                    ON pr.PurchaseRequestID = prii.PurchaseRequestID
            WHERE pri.ProposalItemID = @ParentId
                  AND p.BaseDocument <> 1;
        END;
        ELSE
        BEGIN
            SELECT relations.EngName,
                   relations.Title,
                   relations.EntityId,
                   relations.RelatedEntityId,
                   relations.ParentId,
                   CAST(relations.Number AS NVARCHAR(10)) Number,
                   relations.DateString,
                   relations.RowIndex
            FROM
            (
                SELECT 'JustificationInput' EngName,
                       @JustificationInput Title,
                       ji.JustificationInputID EntityId,
                       pji.JustificationInputItemID RelatedEntityId,
                       pji.ProposalItemID ParentId,
                       ji.Number,
                       CFG.GetCLRSaturnDate(ji.[Date], @DateFormat, 0, @DateType) DateString,
                       pji.RowIndex
                FROM STC.JustificationInputItem pji
                    JOIN STC.JustificationInput ji
                        ON ji.JustificationInputID = pji.JustificationInputID
                WHERE pji.ProposalItemID = @ParentId
                UNION
                SELECT 'TemporaryStockReceipt' EngName,
                       @TemporaryStockReceipt Title,
                       tsr.TemporaryStockReceiptID EntityId,
                       TemporaryStockReceiptItemID RelatedEntityId,
                       ProposalItemID ParentId,
                       tsr.Number,
                       CFG.GetCLRSaturnDate([tsr].[Date], @DateFormat, 0, @DateType) DateString,
                       tsri.RowIndex
                FROM STC.TemporaryStockReceiptItem tsri
                    JOIN STC.TemporaryStockReceipt tsr
                        ON tsr.TemporaryStockReceiptID = tsri.TemporaryStockReceiptID                    
                WHERE ProposalItemID = @ParentId
                UNION
                SELECT 'StockReceipt' EngName,
                       @StockReceipt Title,
                       sr.StockReceiptID EntityId,
                       StockReceiptItemID RelatedEntityId,
                       ProposalItemID ParentId,
                       sr.Number,
                       CFG.GetCLRSaturnDate([sr].[Date], @DateFormat, 0, @DateType) DateString,
                       sri.RowIndex
                FROM STC.StockReceiptItem sri
                    JOIN STC.StockReceipt sr
                        ON sr.StockReceiptID = sri.StockReceiptID
                WHERE ProposalItemID = @ParentId
                UNION
                SELECT 'PurchaseInvoice' EngName,
                       @PurchaseInvoice Title,
                       pin.PurchaseInvoiceID EntityId,
                       PurchaseInvoiceItemID RelatedEntityId,
                       ProposalItemID ParentId,
                       pin.Number,
                       CFG.GetCLRSaturnDate([pin].[Date], @DateFormat, 0, @DateType) DateString,
                       prii.RowIndex
                FROM VND.PurchaseInvoiceItem prii
                    JOIN VND.PurchaseInvoice pin
                        ON pin.PurchaseInvoiceID = prii.PurchaseInvoiceID
                WHERE ProposalItemID = @ParentId
                UNION
                SELECT 'PurchaseContract' EngName,
                       @PurchaseContract Title,
                       pin.PurchaseContractID EntityId,
                       prii.PurchaseContractItemID RelatedEntityId,
                       prii.ProposalItemID ParentId,
                       pin.Number,
                       CFG.GetCLRSaturnDate([pin].[Date], @DateFormat, 0, @DateType) DateString,
                       prii.RowIndex
                FROM VND.PurchaseContractItem prii
                    JOIN VND.PurchaseContract pin
                        ON pin.PurchaseContractID = prii.PurchaseContractID
                WHERE prii.ProposalItemID = @ParentId
                UNION
                SELECT 'ProposalCommission' EngName,
                       @ProposalCommission Title,
                       pc.ProposalCommissionID EntityId,
                       pci.ProposalCommissionItemID RelatedEntityId,
                       pci.ProposalItemID ParentId,
                       pc.Number,
                       CFG.GetCLRSaturnDate(pc.[Date], @DateFormat, 0, @DateType) DateString,
                       pci.RowIndex
                FROM VND.ProposalCommissionItem AS pci
                    JOIN VND.ProposalCommission AS pc
                        ON pc.ProposalCommissionID = pci.ProposalCommissionID
                WHERE pci.ProposalItemID = @ParentId
            ) relations;
        END;
    END;

    IF @EngName = 'StockReceipt'
    BEGIN
        IF @needParent = 1
        BEGIN
            SELECT CASE
                       WHEN sdtb.BaseEntity = 2 THEN
                           'PurchaseRequest'
                       WHEN sdtb.BaseEntity = 3 THEN
                           'Proposal'
                       WHEN sdtb.BaseEntity = 6 THEN
                           'JustificationInput'
                       WHEN sdtb.BaseEntity = 7 THEN
                           'PurchaseInvoice'
                       WHEN sdtb.BaseEntity = 8 THEN
                           'PurchaseContract'
                       WHEN sdtb.BaseEntity = 9
                            OR ou.ConvertSpecificationID IS NOT NULL THEN
                           'Outgoing'
                   END EngName,
                   CASE
                       WHEN sdtb.BaseEntity = 2 THEN
                           @PurchaseRequest
                       WHEN sdtb.BaseEntity = 3 THEN
                           @Proposal
                       WHEN sdtb.BaseEntity = 6 THEN
                           @JustificationInput
                       WHEN sdtb.BaseEntity = 7 THEN
                           @PurchaseInvoice
                       WHEN sdtb.BaseEntity = 8 THEN
                           @PurchaseContract
                       WHEN sdtb.BaseEntity = 9
                            OR ou.ConvertSpecificationID IS NOT NULL THEN
                           @Outgoing
                   END Title,
                   CASE
                       WHEN sdtb.BaseEntity = 2 THEN
                           purq.PurchaseRequestID
                       WHEN sdtb.BaseEntity = 3 THEN
                           prop.ProposalID
                       WHEN sdtb.BaseEntity = 6 THEN
                           just.JustificationInputID
                       WHEN sdtb.BaseEntity = 7 THEN
                           purch.PurchaseInvoiceID
                       WHEN sdtb.BaseEntity = 8 THEN
                           cont.PurchaseContractID
                       WHEN sdtb.BaseEntity = 9
                            OR ou.ConvertSpecificationID IS NOT NULL THEN
                           ou.OutgoingID
                   END EntityId,
                   CASE
                       WHEN sdtb.BaseEntity = 2 THEN
                           sri.PurchaseRequestItemID
                       WHEN sdtb.BaseEntity = 3 THEN
                           sri.ProposalItemID
                       WHEN sdtb.BaseEntity = 6 THEN
                           sri.JustificationInputItemID
                       WHEN sdtb.BaseEntity = 7 THEN
                           sri.PurchaseInvoiceItemID
                       WHEN sdtb.BaseEntity = 8 THEN
                           cont.PurchaseContractItemID
                       WHEN sdtb.BaseEntity = 9
                            OR ou.ConvertSpecificationID IS NOT NULL THEN
                           ou.OutgoingItemID
                   END RelatedEntityId,
                   CASE
                       WHEN sdtb.BaseEntity <> 1
                            OR ou.ConvertSpecificationID IS NOT NULL THEN
                           sri.StockReceiptItemID
                   END ParentId,
                   CASE
                       WHEN sdtb.BaseEntity = 2 THEN
                           CAST(purq.Number AS NVARCHAR(MAX))
                       WHEN sdtb.BaseEntity = 3 THEN
                           CAST(prop.Number AS NVARCHAR(MAX))
                       WHEN sdtb.BaseEntity = 6 THEN
                           CAST(just.Number AS NVARCHAR(MAX))
                       WHEN sdtb.BaseEntity = 7 THEN
                           CAST(purch.Number AS NVARCHAR(MAX))
                       WHEN sdtb.BaseEntity = 8 THEN
                           CAST(cont.Number AS NVARCHAR(MAX))
                       WHEN sdtb.BaseEntity = 9
                            OR ou.ConvertSpecificationID IS NOT NULL THEN
                           CAST(ou.Number AS NVARCHAR(MAX))
                   END Number,
                   CASE
                       WHEN sdtb.BaseEntity = 2 THEN
                           CFG.GetCLRSaturnDate(purq.[Date], @DateFormat, 0, @DateType)
                       WHEN sdtb.BaseEntity = 3 THEN
                           CFG.GetCLRSaturnDate(prop.[Date], @DateFormat, 0, @DateType)
                       WHEN sdtb.BaseEntity = 6 THEN
                           CFG.GetCLRSaturnDate(just.[Date], @DateFormat, 0, @DateType)
                       WHEN sdtb.BaseEntity = 7 THEN
                           CFG.GetCLRSaturnDate(purch.[Date], @DateFormat, 0, @DateType)
                       WHEN sdtb.BaseEntity = 8 THEN
                           CFG.GetCLRSaturnDate(cont.[Date], @DateFormat, 0, @DateType)
                       WHEN sdtb.BaseEntity = 9
                            OR ou.ConvertSpecificationID IS NOT NULL THEN
                           CFG.GetCLRSaturnDate(ou.[Date], @DateFormat, 0, @DateType)
                   END DateString,
                   CASE
                       WHEN sdtb.BaseEntity = 2 THEN
                           CAST(purq.RowIndex AS INT)
                       WHEN sdtb.BaseEntity = 3 THEN
                           CAST(prop.RowIndex AS INT)
                       WHEN sdtb.BaseEntity = 6 THEN
                           CAST(just.RowIndex AS INT)
                       WHEN sdtb.BaseEntity = 7 THEN
                           CAST(purch.RowIndex AS INT)
                       WHEN sdtb.BaseEntity = 8 THEN
                           CAST(cont.RowIndex AS INT)
                       WHEN sdtb.BaseEntity = 9
                            OR ou.ConvertSpecificationID IS NOT NULL THEN
                           CAST(ou.RowIndex AS INT)
                   END RowIndex
            FROM STC.StockReceiptItem sri
                JOIN STC.StockReceipt sr
                    ON sr.StockReceiptID = sri.StockReceiptID
                JOIN [STC].[StockDocumentTypeBaseEntity] sdtb
                    ON sr.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
                LEFT JOIN
                (
                    SELECT pri.PurchaseRequestID,
                           pri.PurchaseRequestItemID,
                           pr.PurchaseRequestNumber Number,
                           pr.PurchaseRequestDate [Date],
                           pri.PurchaseRequestItemIndex RowIndex
                    FROM REQ.PurchaseRequest pr
                        JOIN REQ.PurchaseRequestItem pri
                            ON pri.PurchaseRequestID = pr.PurchaseRequestID
                ) purq
                    ON purq.PurchaseRequestItemID = sri.PurchaseRequestItemID
                LEFT JOIN
                (
                    SELECT pri.ProposalID,
                           pri.ProposalItemID,
                           pr.Number,
                           pr.[Date],
                           pri.RowIndex
                    FROM VND.Proposal pr
                        JOIN VND.ProposalItem pri
                            ON pri.ProposalID = pr.ProposalID
                ) prop
                    ON prop.ProposalItemID = sri.ProposalItemID
                LEFT JOIN
                (
                    SELECT pri.JustificationInputID,
                           pri.JustificationInputItemID,
                           pr.Number,
                           pr.[Date],
                           pri.RowIndex
                    FROM STC.JustificationInput pr
                        JOIN STC.JustificationInputItem pri
                            ON pri.JustificationInputID = pr.JustificationInputID
                ) just
                    ON just.JustificationInputItemID = sri.JustificationInputItemID
                LEFT JOIN
                (
                    SELECT pri.PurchaseInvoiceID,
                           pri.PurchaseInvoiceItemID,
                           pr.Number,
                           pr.[Date],
                           pri.RowIndex
                    FROM VND.PurchaseInvoice pr
                        JOIN VND.PurchaseInvoiceItem pri
                            ON pri.PurchaseInvoiceID = pr.PurchaseInvoiceID
                ) purch
                    ON purch.PurchaseInvoiceItemID = sri.PurchaseInvoiceItemID
                LEFT JOIN
                (
                    SELECT pc.PurchaseContractID,
                           pci.PurchaseContractItemID,
                           pc.Number,
                           pc.[Date],
                           pci.RowIndex
                    FROM VND.PurchaseContract pc
                        JOIN VND.PurchaseContractItem pci
                            ON pci.PurchaseContractID = pc.PurchaseContractID
                ) cont
                    ON cont.PurchaseContractItemID = sri.PurchaseContractItemID
                LEFT JOIN
                (
                    SELECT o.OutgoingID,
                           oi.OutgoingItemID,
                           o.Number,
                           o.[Date],
                           oi.RowIndex,
                           cs.ConvertSpecificationID
                    FROM STC.Outgoing o
                        JOIN STC.OutgoingItem oi
                            ON oi.OutgoingID = o.OutgoingID
                        LEFT JOIN STC.ConvertSpecification cs
                            ON cs.OutgoingItemID = oi.OutgoingItemID
                ) ou
                    ON ou.OutgoingItemID = sri.OutgoingItemID
                       OR ou.ConvertSpecificationID = sri.ConvertSpecificationID
            WHERE sri.StockReceiptItemID = @ParentId
                  AND
                  (
                      sdtb.BaseEntity <> 1
                      OR ou.ConvertSpecificationID IS NOT NULL
                  );
        END;
        ELSE
        BEGIN
            SELECT res.EngName,
                   res.Title,
                   res.EntityId,
                   res.RelatedEntityId,
                   res.ParentId,
                   CAST(res.Number AS NVARCHAR(MAX)) Number,
                   CFG.GetCLRSaturnDate(res.[Date], @DateFormat, 0, @DateType) AS DateString,
                   CAST(res.RowIndex AS INT) RowIndex
            FROM
            (
                SELECT 'PurchaseInvoice' EngName,
                       @PurchaseInvoice Title,
                       pin.PurchaseInvoiceID EntityId,
                       pri.PurchaseInvoiceItemID RelatedEntityId,
                       pri.StockReceiptItemID ParentId,
                       pin.Number,
                       [pin].[Date],
                       pri.RowIndex
                FROM VND.PurchaseInvoiceItem pri
                    JOIN VND.PurchaseInvoice pin
                        ON pin.PurchaseInvoiceID = pri.PurchaseInvoiceID
                WHERE pri.StockReceiptItemID = @ParentId
                UNION
                SELECT 'ReturnRequest' EngName,
                       @ReturnRequest Title,
                       rr.ReturnRequestID EntityId,
                       rri.ReturnRequestItemID RelatedEntityId,
                       rri.StockReceiptItemID ParentId,
                       rr.ReturnRequestNumber Number,
                       [rr].[ReturnRequestDate] [Date],
                       rri.ReturnRequestItemIndex
                FROM REQ.ReturnRequestItem rri
                    JOIN REQ.ReturnRequest rr
                        ON rr.ReturnRequestID = rri.ReturnRequestID
                WHERE rri.StockReceiptItemID = @ParentId
                UNION
                SELECT 'ReturnStockReceipt' EngName,
                       @ReturnStockReceipt Title,
                       rs.ReturnStockReceiptID EntityId,
                       rsi.ReturnStockReceiptItemID RelatedEntityId,
                       rsi.StockReceiptItemID ParentId,
                       rs.Number,
                       [rs].[Date],
                       rsi.RowIndex
                FROM STC.ReturnStockReceiptItem rsi
                    JOIN STC.ReturnStockReceipt rs
                        ON rs.ReturnStockReceiptID = rsi.ReturnStockReceiptID
                WHERE rsi.StockReceiptItemID = @ParentId
                UNION
                SELECT 'RevisionCost' EngName,
                       @RevisionCost Title,
                       rs.RevisionCostID EntityId,
                       rsi.RevisionCostItemID RelatedEntityId,
                       rsi.StockReceiptItemID ParentId,
                       rs.Number,
                       [rs].[Date],
                       0 RowIndex
                FROM STC.RevisionCostItem rsi
                    JOIN STC.RevisionCost rs
                        ON rs.RevisionCostID = rsi.RevisionCostID
                WHERE rsi.StockReceiptItemID = @ParentId
            ) res;
        END;
    END;

    IF @EngName = 'PurchaseInvoice'
    BEGIN
        IF @needParent = 1
        BEGIN
            SELECT CASE pr.BaseType
                       WHEN 2 THEN
                           'PurchaseRequest'
                       WHEN 3 THEN
                           'ContractDefinition'
                       WHEN 5 THEN
                           'Proposal'
                       WHEN 6 THEN
                           'StockReceipt'
                       WHEN 8 THEN
                           'PurchaseContract'
                   END EngName,
                   CASE pr.BaseType
                       WHEN 2 THEN
                           @PurchaseRequest
                       WHEN 3 THEN
                           @Contract
                       WHEN 5 THEN
                           @Proposal
                       WHEN 6 THEN
                           @StockReceipt
                       WHEN 8 THEN
                           @PurchaseContract
                   END Title,
                   CASE pr.BaseType
                       WHEN 2 THEN
                           pureq.PurchaseRequestID
                       WHEN 3 THEN
                           csb.ContractID
                       WHEN 5 THEN
                           prop.ProposalID
                       WHEN 6 THEN
                           receipt.StockReceiptID
                       WHEN 8 THEN
                           PCItem.PurchaseContractID
                   END EntityId,
                   CASE pr.BaseType
                       WHEN 2 THEN
                           pri.PurchaseRequestItemID
                       WHEN 3 THEN
                           csb.ContractSubjectID
                       WHEN 5 THEN
                           pri.ProposalItemID
                       WHEN 6 THEN
                           pri.StockReceiptItemID
                       WHEN 8 THEN
                           pri.PurchaseContractItemID
                   END RelatedEntityId,
                   CASE
                       WHEN pr.BaseType <> 1 THEN
                           pri.PurchaseInvoiceItemID
                   END ParentId,
                   CASE pr.BaseType
                       WHEN 2 THEN
                           CAST(pureq.Number AS NVARCHAR(MAX))
                       WHEN 3 THEN
                           csb.Number
                       WHEN 5 THEN
                           CAST(prop.Number AS NVARCHAR(MAX))
                       WHEN 6 THEN
                           CAST(receipt.Number AS NVARCHAR(MAX))
                       WHEN 8 THEN
                           CAST(PCItem.Number AS NVARCHAR(MAX))
                   END Number,
                   CASE pr.BaseType
                       WHEN 2 THEN
                           CFG.GetCLRSaturnDate(pureq.[Date], @DateFormat, 0, @DateType)
                       WHEN 3 THEN
                           CFG.GetCLRSaturnDate(csb.[Date], @DateFormat, 0, @DateType)
                       WHEN 5 THEN
                           CFG.GetCLRSaturnDate(prop.[Date], @DateFormat, 0, @DateType)
                       WHEN 6 THEN
                           CFG.GetCLRSaturnDate(receipt.[Date], @DateFormat, 0, @DateType)
                       WHEN 8 THEN
                           CFG.GetCLRSaturnDate(PCItem.[Date], @DateFormat, 0, @DateType)
                   END DateString,
                   CASE pr.BaseType
                       WHEN 2 THEN
                           CAST(pureq.RowIndex AS INT)
                       WHEN 3 THEN
                           0
                       WHEN 5 THEN
                           CAST(prop.RowIndex AS INT)
                       WHEN 6 THEN
                           CAST(receipt.Number AS INT)
                       WHEN 8 THEN
                           CAST(PCItem.RowIndex AS INT)
                   END RowIndex
            FROM VND.PurchaseInvoiceItem pri
                JOIN VND.PurchaseInvoice pr
                    ON pr.PurchaseInvoiceID = pri.PurchaseInvoiceID
                LEFT JOIN
                (
                    SELECT prqi.PurchaseRequestID,
                           prqi.PurchaseRequestItemID,
                           prq.PurchaseRequestNumber Number,
                           prq.PurchaseRequestDate [Date],
                           prqi.PurchaseRequestItemIndex RowIndex
                    FROM REQ.PurchaseRequest prq
                        JOIN REQ.PurchaseRequestItem prqi
                            ON prqi.PurchaseRequestID = prq.PurchaseRequestID
                ) pureq
                    ON pureq.PurchaseRequestItemID = pri.PurchaseRequestItemID
                LEFT JOIN
                (
                    SELECT prqi.ProposalID,
                           prqi.ProposalItemID,
                           prq.Number,
                           prq.[Date],
                           prqi.RowIndex
                    FROM VND.Proposal prq
                        JOIN VND.ProposalItem prqi
                            ON prqi.ProposalID = prq.ProposalID
                ) prop
                    ON prop.ProposalItemID = pri.ProposalItemID
                LEFT JOIN
                (
                    SELECT prqi.StockReceiptID,
                           prqi.StockReceiptItemID,
                           prq.Number,
                           prq.[Date],
                           prqi.RowIndex
                    FROM STC.StockReceipt prq
                        JOIN STC.StockReceiptItem prqi
                            ON prqi.StockReceiptID = prq.StockReceiptID
                ) receipt
                    ON receipt.StockReceiptItemID = pri.StockReceiptItemID
                LEFT JOIN
                (
                    SELECT c.ContractID,
                           c1.ContractSubjectID,
                           c.Number,
                           c.[Date],
                           c1.RowIndex
                    FROM CNT.ContractSubject c1
                        JOIN CNT.[Contract] c
                            ON c.ContractID = c1.ContractID
                ) csb
                    ON csb.ContractSubjectID = pri.ContractSubjectID
                LEFT JOIN
                (
                    SELECT pci.PurchaseContractID,
                           pci.PurchaseContractItemID,
                           pc.Number,
                           pc.[Date],
                           pci.RowIndex
                    FROM VND.PurchaseContract AS pc
                        JOIN VND.PurchaseContractItem AS pci
                            ON pci.PurchaseContractID = pc.PurchaseContractID
                ) PCItem
                    ON PCItem.PurchaseContractItemID = pri.PurchaseContractItemID
            WHERE pri.PurchaseInvoiceItemID = @ParentId
                  AND pr.BaseType <> 1;
        END;
        ELSE
        BEGIN
            SELECT rel.EngName,
                   rel.Title,
                   rel.EntityId,
                   rel.RelatedEntityId,
                   rel.ParentId,
                   CAST(rel.Number AS NVARCHAR(MAX)) Number,
                   rel.DateString,
                   CAST(rel.RowIndex AS INT) RowIndex
            FROM
            (
                SELECT 'AssetReceipt' EngName,
                       @AssetReceipt Title,
                       ar.AssetReceiptID EntityId,
                       AssetReceiptItemID RelatedEntityId,
                       PurchaseInvoiceItemID ParentId,
                       ar.Number,
                       CFG.GetCLRSaturnDate(ar.[Date], @DateFormat, 0, @DateType) DateString,
                       0 RowIndex
                FROM AST.AssetReceiptItem ari
                JOIN AST.AssetReceipt ar on ari.AssetReceiptID = ar.AssetReceiptID
                WHERE PurchaseInvoiceItemID = @ParentId
                UNION
                SELECT 'Insurance' EngName,
                       @Insurance Title,
                       InsuranceID EntityId,
                       InsuranceID RelatedEntityId,
                       PurchaseInvoiceItemID ParentId,
                       Number,
                       CFG.GetCLRSaturnDate([Date], @DateFormat, 0, @DateType) DateString,
                       0 RowIndex
                FROM AST.Insurance
                WHERE PurchaseInvoiceItemID = @ParentId
                UNION
                SELECT 'ReceiptCost' EngName,
                       N'سایر هزینه های رسید انبار' Title,
                       0 EntityId,
                       rc.ReceiptCostID RelatedEntityId,
                       rc.PurchaseInvoiceItemID ParentId,
                       sr.Number Number,
                       CFG.GetCLRSaturnDate(sr.[Date], @DateFormat, 0, @DateType) DateString,
                       0 RowIndex
                FROM STC.ReceiptCost rc
                    JOIN STC.StockReceipt AS sr
                        ON sr.StockReceiptID = rc.StockReceiptID
                WHERE PurchaseInvoiceItemID = @ParentId
                UNION
                SELECT 'RepairServiceCost' EngName,
                       @Repair Title,
                       RepairServiceCostID EntityId,
                       RepairServiceCostID RelatedEntityId,
                       PurchaseInvoiceItemID ParentId,
                       r.Number Number,
                       CFG.GetCLRSaturnDate([r].[Date], @DateFormat, 0, @DateType) DateString,
                       0 RowIndex
                FROM AST.RepairServiceCost rc
                    JOIN AST.Repair AS r
                        ON r.RepairID = rc.RepairID
                WHERE PurchaseInvoiceItemID = @ParentId
                UNION
                SELECT 'ReturnInvoice' EngName,
                       @ReturnedPurchaseInvoice Title,
                       ri.ReturnInvoiceID EntityId,
                       rii.ReturnInvoiceItemID RelatedEntityId,
                       rii.PurchaseInvoiceItemID ParentId,
                       ri.Number,
                       CFG.GetCLRSaturnDate([ri].[Date], @DateFormat, 0, @DateType) DateString,
                       rii.RowIndex
                FROM VND.ReturnInvoiceItem rii
                    JOIN VND.ReturnInvoice ri
                        ON ri.ReturnInvoiceID = rii.ReturnInvoiceID
                WHERE rii.PurchaseInvoiceItemID = @ParentId
                UNION
                SELECT 'StockReceipt' EngName,
                       @StockReceipt Title,
                       i.StockReceiptID EntityId,
                       ii.StockReceiptItemID RelatedEntityId,
                       ii.PurchaseInvoiceItemID ParentId,
                       i.Number,
                       CFG.GetCLRSaturnDate(i.[Date], @DateFormat, 0, @DateType) DateString,
                       ii.RowIndex
                FROM STC.StockReceiptItem ii
                    JOIN STC.StockReceipt i
                        ON i.StockReceiptID = ii.StockReceiptID
                WHERE ii.PurchaseInvoiceItemID = @ParentId
                UNION
                SELECT 'UtilizationCost' EngName,
                       N'هزینه بهره برداری دارایی' Title,
                       AssetReceiptUtilizationCostID EntityId,
                       AssetReceiptUtilizationCostID RelatedEntityId,
                       uc.PurchaseInvoiceItemID ParentId,
                       ar.Number Number,
                       CFG.GetCLRSaturnDate(ar.[Date], @DateFormat, 0, @DateType) DateSting,
                       0 RowIndex
                FROM AST.AssetReceiptUtilizationCost uc
                JOIN AST.AssetReceipt ar on uc.AssetReceiptID = ar.AssetReceiptID
                WHERE uc.PurchaseInvoiceItemID = @ParentId
            ) rel;
        END;
    END;

    IF @EngName = 'ReturnedTemporaryStockReceipt'
    BEGIN
        IF @needParent = 1
        BEGIN
            SELECT CASE sdtb.BaseEntity
           WHEN 4 THEN
               'TemporaryStockReceipt'
           WHEN 5 THEN
               'ReturnRequest'
       END EngName,
       CASE sdtb.BaseEntity
           WHEN 4 THEN
               @TemporaryStockReceipt
           WHEN 5 THEN
               @ReturnRequest
       END Title,
       CASE sdtb.BaseEntity
           WHEN 4 THEN
               r1.TemporaryStockReceiptID
           WHEN 5 THEN
               r2.ReturnRequestID
       END EntityId,
       CASE sdtb.BaseEntity
           WHEN 4 THEN
               i.TemporaryStockReceiptItemID
           WHEN 5 THEN
               i.ReturnRequestItemID
       END RelatedEntityId,
       CASE
           WHEN sdtb.BaseEntity <> 1 THEN
               i.ReturnedTemporaryStockReceiptItemID
       END ParentId,
       CASE sdtb.BaseEntity
           WHEN 2 THEN
               CAST(r1.Number AS NVARCHAR(MAX))
           WHEN 5 THEN
               CAST(r2.Number AS NVARCHAR(MAX))
       END Number,
       CASE sdtb.BaseEntity
           WHEN 2 THEN
               CFG.GetCLRSaturnDate(r1.[Date], @DateFormat, 0, @DateType)
           WHEN 5 THEN
               CFG.GetCLRSaturnDate(r2.[Date], @DateFormat, 0, @DateType)
       END DateString,
       CASE sdtb.BaseEntity
           WHEN 2 THEN
               CAST(r1.RowIndex AS INT)
           WHEN 5 THEN
               CAST(r2.RowIndex AS INT)
       END RowIndex
FROM STC.ReturnedTemporaryStockReceiptItem i
    JOIN STC.ReturnedTemporaryStockReceipt h
        ON h.ReturnedTemporaryStockReceiptID = i.ReturnedTemporaryStockReceiptID
	JOIN STC.StockDocumentTypeBaseEntity sdtb
		ON h.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
    LEFT JOIN
    (
        SELECT prqi.TemporaryStockReceiptID,
               prqi.TemporaryStockReceiptItemID,
               prq.Number,
               prq.[Date],
               prqi.RowIndex
        FROM STC.TemporaryStockReceipt prq
            JOIN STC.TemporaryStockReceiptItem prqi
                ON prqi.TemporaryStockReceiptID = prq.TemporaryStockReceiptID
    ) r1
        ON r1.TemporaryStockReceiptItemID = i.TemporaryStockReceiptItemID
    LEFT JOIN
    (
        SELECT rri.ReturnRequestID,
               rri.ReturnRequestItemID,
               rr.ReturnRequestNumber Number,
               rr.ReturnRequestDate [Date],
               rri.ReturnRequestItemIndex RowIndex
        FROM REQ.ReturnRequestItem rri
            JOIN REQ.ReturnRequest rr
                ON rr.ReturnRequestID = rri.ReturnRequestID
    ) r2
        ON r2.ReturnRequestItemID = i.ReturnRequestItemID
WHERE i.ReturnedTemporaryStockReceiptItemID = @ParentId
      AND sdtb.BaseEntity <> 1;
        END;
    END;

    IF @EngName = 'ReceiptCost'
    BEGIN
        IF @needParent = 1
        BEGIN
            SELECT 'PurchaseInvoice' EngName,
                   @PurchaseInvoice Title,
                   pii.PurchaseInvoiceID EntityId,
                   pii.PurchaseInvoiceItemID RelatedEntityId,
                   r.ReceiptCostID ParentId,
                   CAST(p.Number AS NVARCHAR(MAX)),
                   CFG.GetCLRSaturnDate([p].[Date], @DateFormat, 0, @DateType) DateString,
                   CAST(pii.RowIndex AS INT) RowIndex
            FROM STC.ReceiptCost r
                JOIN VND.PurchaseInvoiceItem pii
                    ON pii.PurchaseInvoiceItemID = r.PurchaseInvoiceItemID
                JOIN VND.PurchaseInvoice p
                    ON p.PurchaseInvoiceID = pii.PurchaseInvoiceID
            WHERE r.ReceiptCostID = @ParentId;
        END;
    END;

    IF @EngName = 'PurchaseContract'
    BEGIN
        IF @needParent = 1
        BEGIN
            SELECT CASE pr.BaseType
                       WHEN 2 THEN
                           'PurchaseRequest'
                       WHEN 5 THEN
                           'Proposal'
                       WHEN 7 THEN
                           'StuffRequest'
                   END EngName,
                   CASE pr.BaseType
                       WHEN 2 THEN
                           @PurchaseRequest
                       WHEN 5 THEN
                           @Proposal
                       WHEN 7 THEN
                           @StuffRequest
                   END Title,
                   CASE pr.BaseType
                       WHEN 2 THEN
                           pureq.PurchaseRequestID
                       WHEN 5 THEN
                           prop.ProposalID
                       WHEN 7 THEN
                           receipt.StuffRequestID
                   END EntityId,
                   CASE pr.BaseType
                       WHEN 2 THEN
                           pri.PurchaseRequestItemID
                       WHEN 5 THEN
                           pri.ProposalItemID
                       WHEN 7 THEN
                           pri.StuffRequestItemID
                   END RelatedEntityId,
                   CASE
                       WHEN pr.BaseType <> 1 THEN
                           pri.PurchaseContractItemID
                   END ParentId,
                   CASE pr.BaseType
                       WHEN 2 THEN
                           CAST(pureq.Number AS NVARCHAR(MAX))
                       WHEN 5 THEN
                           CAST(prop.Number AS NVARCHAR(MAX))
                       WHEN 7 THEN
                           CAST(receipt.StuffRequestNumber AS NVARCHAR(MAX))
                   END Number,
                   CASE pr.BaseType
                       WHEN 2 THEN
                           CFG.GetCLRSaturnDate(pureq.[Date], @DateFormat, 0, @DateType)
                       WHEN 5 THEN
                           CFG.GetCLRSaturnDate(prop.[Date], @DateFormat, 0, @DateType)
                       WHEN 7 THEN
                           CFG.GetCLRSaturnDate(receipt.StuffRequestDate, @DateFormat, 0, @DateType)
                   END DateString,
                   CASE pr.BaseType
                       WHEN 2 THEN
                           CAST(pureq.RowIndex AS INT)
                       WHEN 5 THEN
                           CAST(prop.RowIndex AS INT)
                       WHEN 7 THEN
                           CAST(receipt.StuffRequestNumber AS INT)
                   END RowIndex
            FROM VND.PurchaseContractItem pri
                JOIN VND.PurchaseContract pr
                    ON pr.PurchaseContractID = pri.PurchaseContractID
                LEFT JOIN
                (
                    SELECT prqi.PurchaseRequestID,
                           prqi.PurchaseRequestItemID,
                           prq.PurchaseRequestNumber Number,
                           prq.PurchaseRequestDate [Date],
                           prqi.PurchaseRequestItemIndex RowIndex
                    FROM REQ.PurchaseRequest prq
                        JOIN REQ.PurchaseRequestItem prqi
                            ON prqi.PurchaseRequestID = prq.PurchaseRequestID
                ) pureq
                    ON pureq.PurchaseRequestItemID = pri.PurchaseRequestItemID
                LEFT JOIN
                (
                    SELECT prqi.ProposalID,
                           prqi.ProposalItemID,
                           prq.Number,
                           prq.[Date],
                           prqi.RowIndex
                    FROM VND.Proposal prq
                        JOIN VND.ProposalItem prqi
                            ON prqi.ProposalID = prq.ProposalID
                ) prop
                    ON prop.ProposalItemID = pri.ProposalItemID
                LEFT JOIN
                (
                    SELECT prqi.StuffRequestID,
                           prqi.StuffRequestItemID,
                           prq.StuffRequestNumber,
                           prq.StuffRequestDate,
                           prqi.StuffRequestItemIndex
                    FROM REQ.StuffRequest prq
                        JOIN REQ.StuffRequestItem prqi
                            ON prqi.StuffRequestID = prq.StuffRequestID
                ) receipt
                    ON receipt.StuffRequestItemID = pri.StuffRequestItemID
            WHERE pri.PurchaseContractItemID = @ParentId
                  AND pr.BaseType <> 1;
        END;
        ELSE
        BEGIN
            BEGIN
                SELECT relations.EngName,
                       relations.Title,
                       relations.EntityId,
                       relations.RelatedEntityId,
                       relations.ParentId,
                       CAST(relations.Number AS NVARCHAR(MAX)) Number,
                       CFG.GetCLRSaturnDate(relations.[Date], @DateFormat, 0, @DateType) DateString,
                       CAST(relations.RowIndex AS INT) RowIndex
                FROM
                (
                    SELECT 'JustificationInput' EngName,
                           @JustificationInput Title,
                           ji.JustificationInputID EntityId,
                           jii.JustificationInputItemID RelatedEntityId,
                           jii.PurchaseContractItemID ParentId,
                           ji.Number,
                           ji.[Date],
                           jii.RowIndex
                    FROM STC.JustificationInputItem jii
                        JOIN STC.JustificationInput ji
                            ON ji.JustificationInputID = jii.JustificationInputID
                    WHERE jii.PurchaseContractItemID = @ParentId
                    UNION
                    SELECT 'PurchaseInvoice' EngName,
                           @PurchaseInvoice Title,
                           p.PurchaseInvoiceID EntityId,
                           pii.PurchaseInvoiceItemID RelatedEntityId,
                           pii.PurchaseContractItemID ParentId,
                           p.Number,
                           p.[Date],
                           pii.RowIndex
                    FROM VND.PurchaseInvoiceItem pii
                        JOIN VND.PurchaseInvoice p
                            ON p.PurchaseInvoiceID = pii.PurchaseInvoiceID
                    WHERE pii.PurchaseContractItemID = @ParentId
                    UNION
                    SELECT 'StockReceipt' EngName,
                           @StockReceipt Title,
                           s.StockReceiptID EntityId,
                           si.StockReceiptItemID RelatedEntityId,
                           si.PurchaseContractItemID ParentId,
                           s.Number,
                           s.[Date],
                           si.RowIndex
                    FROM STC.StockReceiptItem si
                        JOIN STC.StockReceipt s
                            ON s.StockReceiptID = si.StockReceiptID
                    WHERE si.PurchaseContractItemID = @ParentId
                    UNION
                    SELECT 'TemporaryStockReceipt' EngName,
                           @TemporaryStockReceipt Title,
                           s.TemporaryStockReceiptID EntityId,
                           si.TemporaryStockReceiptItemID RelatedEntityId,
                           si.PurchaseContractItemID ParentId,
                           s.Number,
                           s.[Date],
                           si.RowIndex
                    FROM STC.TemporaryStockReceiptItem si
                        JOIN STC.TemporaryStockReceipt s
                            ON s.TemporaryStockReceiptID = si.TemporaryStockReceiptID
                    WHERE si.PurchaseContractItemID = @ParentId
                ) relations;
            END;
        END;
    END;

    IF @EngName = 'Invoice'
    BEGIN
        IF @needParent = 1
        BEGIN
            SELECT CASE pr.BaseDocument
                       WHEN 3 THEN
                           'Justification'
                       WHEN 4 THEN
                           'Quotation'
                       WHEN 5 THEN
                           'Remittance'
                       WHEN 9 THEN
                           'Outgoing'
                       WHEN 10 THEN
                           'Reception'
                       WHEN 11 THEN
                           'ConfirmStatement'
                       WHEN 12 THEN
                           'ContractStatement'
                       WHEN 13 THEN
                           'Sale'
                       WHEN 14 THEN
                           'SaleContract'
                   END EngName,
                   CASE pr.BaseDocument
                       WHEN 3 THEN
                           @Justification
                       WHEN 4 THEN
                           @Quotation
                       WHEN 5 THEN
                           @Remittance
                       WHEN 9 THEN
                           @Outgoing
                       WHEN 10 THEN
                           @Reception
                       WHEN 11 THEN
                           @Contract
                       WHEN 12 THEN
                           @ContractStatement
                       WHEN 13 THEN
                           @SaleAsset
                       WHEN 14 THEN
                           @SaleContract
                   END Title,
                   CASE pr.BaseDocument
                       WHEN 3 THEN
                           pureq.JustificationID
                       WHEN 4 THEN
                           prop.QuotationID
                       WHEN 5 THEN
                           remi.RemittanceID
                       WHEN 9 THEN
                           ou.OutgoingID
                       WHEN 10 THEN
                           pri.ReceptionID
                       -- WHEN 11 THEN cfs.ConfirmStatementID
                       WHEN 12 THEN
                           cnt.ContractSubjectID
                       WHEN 13 THEN
                           sl.SaleID
                       WHEN 14 THEN
                           sc1.SaleContractID
                   END EntityId,
                   CASE pr.BaseDocument
                       WHEN 3 THEN
                           pri.JustificationItemID
                       WHEN 4 THEN
                           pri.QuotationItemID
                       WHEN 5 THEN
                           pri.RemittanceItemID
                       WHEN 9 THEN
                           pri.OutgoingItemId
                       WHEN 10 THEN
                           pri.ReceptionID
                       --  WHEN 11 THEN pri.ConfirmStatementID
                       WHEN 12 THEN
                           pri.ContractSubjectID
                       WHEN 13 THEN
                           pri.SaleItemID
                       WHEN 14 THEN
                           pri.SaleContractItemID
                   END RelatedEntityId,
                   CASE
                       WHEN pr.BaseDocument <> 1 THEN
                           pri.InvoiceItemID
                   END ParentId,
                   CASE pr.BaseDocument
                       WHEN 3 THEN
                           CAST(pureq.Number AS NVARCHAR(MAX))
                       WHEN 4 THEN
                           CAST(prop.Number AS NVARCHAR(MAX))
                       WHEN 5 THEN
                           CAST(remi.Number AS NVARCHAR(MAX))
                       WHEN 9 THEN
                           CAST(ou.Number AS NVARCHAR(MAX))
                       WHEN 10 THEN
                           CAST(rec.Number AS NVARCHAR(MAX))
                       WHEN 11 THEN
                           '0'
                       WHEN 12 THEN
                           CAST(cnt.Number AS NVARCHAR(MAX))
                       WHEN 13 THEN
                           CAST(sl.Number AS NVARCHAR(MAX))
                       WHEN 14 THEN
                           CAST(sc1.Number AS NVARCHAR(MAX))
                   END Number,
                   CASE pr.BaseDocument
                       WHEN 3 THEN
                           CFG.GetCLRSaturnDate(pureq.[Date], @DateFormat, 0, @DateType)
                       WHEN 4 THEN
                           CFG.GetCLRSaturnDate(prop.[Date], @DateFormat, 0, @DateType)
                       WHEN 5 THEN
                           CFG.GetCLRSaturnDate(remi.[Date], @DateFormat, 0, @DateType)
                       WHEN 9 THEN
                           CFG.GetCLRSaturnDate(ou.[Date], @DateFormat, 0, @DateType)
                       WHEN 10 THEN
                           CFG.GetCLRSaturnDate(rec.[Date], @DateFormat, 0, @DateType)
                       --WHEN 11 THEN
                       --    CFG.GetCLRSaturnDate(
                       --        cfs.[CreationDate] ,
                       --        @DateFormat ,
                       --        0 ,
                       --        @DateType)
                       WHEN 12 THEN
                           CFG.GetCLRSaturnDate(cnt.[Date], @DateFormat, 0, @DateType)
                       WHEN 13 THEN
                           CFG.GetCLRSaturnDate(sl.[Date], @DateFormat, 0, @DateType)
                       WHEN 14 THEN
                           CFG.GetCLRSaturnDate(sc1.[Date], @DateFormat, 0, @DateType)
                   END DateString,
                   CASE pr.BaseDocument
                       WHEN 3 THEN
                           CAST(pureq.RowIndex AS INT)
                       WHEN 4 THEN
                           CAST(prop.RowIndex AS INT)
                       WHEN 5 THEN
                           CAST(remi.RowIndex AS INT)
                       WHEN 9 THEN
                           CAST(ou.RowIndex AS INT)
                       WHEN 10 THEN
                           0
                       WHEN 11 THEN
                           0
                       WHEN 12 THEN
                           CAST(cnt.RowIndex AS INT)
                       WHEN 13 THEN
                           CAST(sl.RowIndex AS INT)
                       WHEN 14 THEN
                           CAST(sc1.RowIndex AS INT)
                   END RowIndex
            FROM SLE.InvoiceItem pri
                JOIN SLE.Invoice pr
                    ON pr.InvoiceID = pri.InvoiceID
                LEFT JOIN
                (
                    SELECT sc.SaleContractID,
                           sci.SaleContractItemID,
                           sc.Number,
                           sc.Date,
                           sci.RowIndex
                    FROM SLE.SaleContractItem AS sci
                        JOIN SLE.SaleContract AS sc
                            ON sc.SaleContractID = sci.SaleContractID
                ) sc1
                    ON sc1.SaleContractItemID = pri.SaleContractItemID
                LEFT JOIN
                (
                    SELECT prqi.JustificationID,
                           prqi.JustificationItemID,
                           prq.Number,
                           prq.[Date],
                           prqi.RowIndex
                    FROM SLE.Justification prq
                        JOIN SLE.JustificationItem prqi
                            ON prqi.JustificationID = prq.JustificationID
                ) pureq
                    ON pureq.JustificationItemID = pri.JustificationItemID
                LEFT JOIN
                (
                    SELECT prqi.QuotationID,
                           prqi.QuotationItemID,
                           prq.Number,
                           prq.[Date],
                           prqi.RowIndex
                    FROM SLE.Quotation prq
                        JOIN SLE.QuotationItem prqi
                            ON prqi.QuotationID = prq.QuotationID
                ) prop
                    ON prop.QuotationItemID = pri.QuotationItemID
                LEFT JOIN
                (
                    SELECT r.RemittanceID,
                           ri.RemittanceItemID,
                           r.Number,
                           r.[Date],
                           ri.RowIndex
                    FROM SLE.Remittance r
                        JOIN SLE.RemittanceItem ri
                            ON ri.RemittanceID = r.RemittanceID
                ) remi
                    ON remi.RemittanceItemID = pri.RemittanceItemID
                LEFT JOIN
                (
                    SELECT o.OutgoingID,
                           oi.OutgoingItemID,
                           o.Number,
                           o.[Date],
                           oi.RowIndex
                    FROM STC.Outgoing o
                        JOIN STC.OutgoingItem oi
                            ON oi.OutgoingID = o.OutgoingID
                ) ou
                    ON ou.OutgoingItemID = pri.OutgoingItemId
                LEFT JOIN CTM.Reception rec
                    ON rec.ReceptionID = pri.ReceptionID
                --   LEFT JOIN CNT.ConfirmStatement cfs ON cfs.ConfirmStatementID = pri.ConfirmStatementID

                LEFT JOIN
                (
                    SELECT c.ContractID,
                           cs.ContractSubjectID,
                           c.[Date],
                           c.Number,
                           cs.RowIndex
                    FROM CNT.[Contract] c
                        JOIN CNT.ContractSubject cs
                            ON cs.ContractID = c.ContractID
                ) cnt
                    ON cnt.ContractSubjectID = pri.ContractSubjectID
                LEFT JOIN
                (
                    SELECT s.SaleID,
                           si.SaleItemID,
                           s.Number,
                           s.[Date],
                           si.RowIndex
                    FROM AST.SaleItem si
                        JOIN AST.Sale s
                            ON s.SaleID = si.SaleID
                ) sl
                    ON sl.SaleItemID = pri.SaleItemID
            WHERE pri.InvoiceItemID = @ParentId
                  AND pr.BaseDocument <> 1;
        END;
        ELSE
        BEGIN
            SELECT a.EngName,
                   a.EntityId,
                   a.Title,
                   a.RelatedEntityId,
                   a.ParentId,
                   CAST(a.Number AS NVARCHAR(MAX)) Number,
                   CFG.GetCLRSaturnDate([a].[Date], @DateFormat, 0, @DateType) DateString,
                   CAST(a.RowIndex AS INT) RowIndex
            FROM
            (
                SELECT 'Outgoing' EngName,
                       @Outgoing Title,
                       O.OutgoingID EntityId,
                       OI.OutgoingItemID RelatedEntityId,
                       OI.InvoiceItemID ParentId,
                       O.Number,
                       O.[Date],
                       OI.RowIndex
                FROM STC.OutgoingItem OI
                    JOIN STC.Outgoing O
                        ON O.OutgoingID = OI.OutgoingID
                WHERE OI.InvoiceItemID = @ParentId
                UNION
                SELECT 'Reception' EngName,
                       @Reception Title,
                       o.ReceptionID EntityId,
                       oi.ReceptionItemID RelatedEntityId,
                       oi.InvoiceItemID ParentId,
                       o.Number,
                       o.[Date],
                       0
                FROM CTM.ReceptionItem oi
                    JOIN CTM.Reception o
                        ON o.ReceptionID = oi.ReceptionID
                WHERE oi.InvoiceItemID = @ParentId
                UNION
                SELECT 'Remittance' EngName,
                       @Remittance Title,
                       o.RemittanceID EntityId,
                       oi.RemittanceItemID RelatedEntityId,
                       oi.InvoiceItemID ParentId,
                       o.Number,
                       o.[Date],
                       oi.RowIndex
                FROM SLE.RemittanceItem oi
                    JOIN SLE.Remittance o
                        ON o.RemittanceID = oi.RemittanceID
                WHERE oi.InvoiceItemID = @ParentId
                UNION
                SELECT 'ReturnedSaleInvoice' EngName,
                       @ReturnSaleInvoice Title,
                       o.ReturnedSaleInvoiceID EntityId,
                       oi.ReturnedSaleInvoiceItemID RelatedEntityId,
                       oi.InvoiceItemID ParentId,
                       o.Number,
                       o.[Date],
                       oi.RowIndex
                FROM SLE.ReturnedSaleInvoiceItem oi
                    JOIN SLE.ReturnedSaleInvoice o
                        ON o.ReturnedSaleInvoiceID = oi.ReturnedSaleInvoiceID
                WHERE oi.InvoiceItemID = @ParentId
                UNION
                SELECT 'ReturnedSaleJustification' EngName,
                       @ReturnedSaleJustification Title,
                       o.ReturnedSaleJustificationID EntityId,
                       oi.ReturnedSaleJustificationItemID RelatedEntityId,
                       oi.InvoiceItemID ParentId,
                       o.Number,
                       o.[Date],
                       oi.RowIndex
                FROM SLE.ReturnedSaleJustificationItem oi
                    JOIN SLE.ReturnedSaleJustification o
                        ON o.ReturnedSaleJustificationID = oi.ReturnedSaleJustificationID
                WHERE oi.InvoiceItemID = @ParentId
            ) a;
        END;
    END;

    IF @EngName = 'Remittance'
    BEGIN
        IF @needParent = 1
        BEGIN
            SELECT CASE rr.BaseDocument
                       WHEN 3 THEN
                           'Justification'
                       WHEN 4 THEN
                           'Quotation'
                       WHEN 6 THEN
                           'Invoice'
                       WHEN 14 THEN
                           'SaleContract'
                   END EngName,
                   CASE rr.BaseDocument
                       WHEN 3 THEN
                           @Justification
                       WHEN 4 THEN
                           @Quotation
                       WHEN 6 THEN
                           @SaleInvoice
                       WHEN 14 THEN
                           @SaleContract
                   END Title,
                   CASE rr.BaseDocument
                       WHEN 3 THEN
                           just.JustificationID
                       WHEN 4 THEN
                           quot.QuotationID
                       WHEN 6 THEN
                           invoice.InvoiceID
                       WHEN 14 THEN
                           cont.SaleContractID
                   END EntityId,
                   CASE rr.BaseDocument
                       WHEN 3 THEN
                           just.JustificationItemID
                       WHEN 4 THEN
                           quot.QuotationItemID
                       WHEN 6 THEN
                           invoice.InvoiceItemID
                       WHEN 14 THEN
                           cont.SaleContractItemID
                   END RelatedEntityId,
                   CASE
                       WHEN rr.BaseDocument <> 1 THEN
                           r.RemittanceItemID
                   END ParentId,
                   CASE rr.BaseDocument
                       WHEN 3 THEN
                           CAST(just.Number AS NVARCHAR(MAX))
                       WHEN 4 THEN
                           CAST(quot.Number AS NVARCHAR(MAX))
                       WHEN 6 THEN
                           CAST(invoice.Number AS NVARCHAR(MAX))
                       WHEN 14 THEN
                           CAST(cont.Number AS NVARCHAR(MAX))
                   END Number,
                   CASE rr.BaseDocument
                       WHEN 3 THEN
                           CFG.GetCLRSaturnDate([just].[Date], @DateFormat, 0, @DateType)
                       WHEN 4 THEN
                           CFG.GetCLRSaturnDate(quot.[Date], @DateFormat, 0, @DateType)
                       WHEN 6 THEN
                           CFG.GetCLRSaturnDate([invoice].[Date], @DateFormat, 0, @DateType)
                       WHEN 14 THEN
                           CFG.GetCLRSaturnDate(cont.[Date], @DateFormat, 0, @DateType)
                   END DateString,
                   CASE rr.BaseDocument
                       WHEN 3 THEN
                           CAST(just.RowIndex AS INT)
                       WHEN 4 THEN
                           CAST(quot.RowIndex AS INT)
                       WHEN 6 THEN
                           CAST(invoice.RowIndex AS INT)
                       WHEN 14 THEN
                           CAST(cont.RowIndex AS INT)
                   END RowIndex
            FROM SLE.RemittanceItem r
                JOIN SLE.Remittance rr
                    ON rr.RemittanceID = r.RemittanceID
                LEFT JOIN
                (
                    SELECT i.InvoiceID,
                           ii.InvoiceItemID,
                           i.[Date],
                           i.Number,
                           ii.RowIndex
                    FROM SLE.InvoiceItem ii
                        JOIN SLE.Invoice i
                            ON i.InvoiceID = ii.InvoiceID
                ) invoice
                    ON invoice.InvoiceItemID = r.InvoiceItemID
                LEFT JOIN
                (
                    SELECT oi.QuotationID,
                           oi.QuotationItemID,
                           q.Number,
                           [q].[Date],
                           oi.RowIndex
                    FROM SLE.QuotationItem oi
                        JOIN SLE.Quotation q
                            ON q.QuotationID = oi.QuotationID
                ) quot
                    ON quot.QuotationItemID = r.QuotationItemID
                LEFT JOIN
                (
                    SELECT j.JustificationID,
                           ji.JustificationItemID,
                           j.Number,
                           [j].[Date],
                           ji.RowIndex
                    FROM SLE.JustificationItem ji
                        JOIN SLE.Justification j
                            ON j.JustificationID = ji.JustificationID
                ) just
                    ON just.JustificationItemID = r.JustificationItemID
                LEFT JOIN
                (
                    SELECT sc.SaleContractID,
                           sci.SaleContractItemID,
                           sc.Number,
                           [sc].[Date],
                           sci.RowIndex
                    FROM SLE.SaleContractItem AS sci
                        JOIN SLE.SaleContract AS sc
                            ON sc.SaleContractID = sci.SaleContractID
                ) cont
                    ON cont.SaleContractItemID = r.SaleContractItemID
            WHERE r.RemittanceItemID = @ParentId
                  AND rr.BaseDocument <> 1;
        END;
        ELSE
        BEGIN
            SELECT a.EngName,
                   a.Title,
                   a.EntityId,
                   a.RelatedEntityId,
                   a.ParentId,
                   CAST(a.Number AS NVARCHAR(MAX)) Number,
                   CFG.GetCLRSaturnDate(a.[Date], @DateFormat, 0, @DateType) DateString,
                   CAST(a.RowIndex AS INT) RowIndex
            FROM
            (
                SELECT 'Outgoing' EngName,
                       @Outgoing Title,
                       o.OutgoingID EntityId,
                       oi.OutgoingItemID RelatedEntityId,
                       oi.RemittanceItemID ParentId,
                       o.Number,
                       o.[Date],
                       oi.RowIndex
                FROM STC.OutgoingItem oi
                    JOIN STC.Outgoing o
                        ON o.OutgoingID = oi.OutgoingID
                WHERE oi.RemittanceItemID = @ParentId
                UNION
                SELECT 'Invoice' EngName,
                       @SaleInvoice Title,
                       i.InvoiceID EntityId,
                       ii.InvoiceItemID RelatedEntityId,
                       ii.RemittanceItemID ParentId,
                       i.Number,
                       i.[Date],
                       ii.RowIndex
                FROM SLE.Invoice i
                    JOIN SLE.InvoiceItem ii
                        ON ii.InvoiceID = i.InvoiceID
                WHERE ii.RemittanceItemID = @ParentId
            ) a;
        END;
    END;

    IF @EngName = 'Justification'
    BEGIN
        IF @needParent = 1
        BEGIN
            SELECT CASE j.BaseDocument
                       WHEN 2 THEN
                           'Order'
                   END EngName,
                   CASE j.BaseDocument
                       WHEN 2 THEN
                           @Order
                   END Title,
                   CASE j.BaseDocument
                       WHEN 2 THEN
                           ord.OrderID
                   END EntityId,
                   CASE j.BaseDocument
                       WHEN 2 THEN
                           ji.OrderItemID
                   END RelatedEntityId,
                   CASE j.BaseDocument
                       WHEN 2 THEN
                           ji.JustificationItemID
                   END ParentId,
                   CASE j.BaseDocument
                       WHEN 2 THEN
                           CAST(ord.Number AS NVARCHAR(MAX))
                   END Number,
                   CASE j.BaseDocument
                       WHEN 2 THEN
                           CFG.GetCLRSaturnDate(ord.[Date], @DateFormat, 0, @DateType)
                   END DateString,
                   CASE j.BaseDocument
                       WHEN 2 THEN
                           CAST(ord.Number AS INT)
                   END RowIndex
            FROM SLE.JustificationItem ji
                JOIN SLE.Justification j
                    ON j.JustificationID = ji.JustificationID
                LEFT JOIN
                (
                    SELECT o.OrderID,
                           oi.OrderItemID,
                           o.Number,
                           o.[Date],
                           oi.RowIndex
                    FROM CTM.[Order] o
                        JOIN CTM.OrderItem oi
                            ON oi.OrderID = o.OrderID
                ) ord
                    ON ord.OrderItemID = ji.OrderItemID
            WHERE ji.JustificationItemID = @ParentId
                  AND j.BaseDocument <> 1;
        END;
        ELSE
        BEGIN
            SELECT a.EngName,
                   a.Title,
                   a.EntityId,
                   a.RelatedEntityId,
                   a.ParentId,
                   CAST(a.Number AS NVARCHAR(MAX)) Number,
                   CFG.GetCLRSaturnDate(a.[Date], @DateFormat, 0, @DateType) DateString,
                   CAST(a.RowIndex AS INT) RowIndex
            FROM
            (
                SELECT 'Invoice' EngName,
                       @SaleInvoice Title,
                       h.InvoiceID EntityId,
                       i.InvoiceItemID RelatedEntityId,
                       i.JustificationItemID ParentId,
                       h.Number,
                       h.[Date],
                       i.RowIndex
                FROM SLE.InvoiceItem i
                    JOIN SLE.Invoice h
                        ON i.InvoiceID = h.InvoiceID
                WHERE i.JustificationItemID = @ParentId
                UNION
                SELECT 'Outgoing' EngName,
                       @Outgoing Title,
                       h.OutgoingID EntityId,
                       i.OutgoingItemID RelatedEntityId,
                       i.JustificationItemID ParentId,
                       h.Number,
                       h.[Date],
                       i.RowIndex
                FROM STC.OutgoingItem i
                    JOIN STC.Outgoing h
                        ON h.OutgoingID = i.OutgoingID
                WHERE i.JustificationItemID = @ParentId
                UNION
                SELECT 'Quotation' EngName,
                       @Quotation Title,
                       h.QuotationID EntityId,
                       i.QuotationItemID RelatedEntityId,
                       i.JustificationItemID ParentId,
                       h.Number,
                       h.[Date],
                       i.RowIndex
                FROM SLE.QuotationItem i
                    JOIN SLE.Quotation h
                        ON h.QuotationID = i.QuotationID
                WHERE i.JustificationItemID = @ParentId
                UNION
                SELECT 'Remittance' EngName,
                       @Remittance Title,
                       h.RemittanceID EntityId,
                       i.RemittanceItemID RelatedEntityId,
                       i.JustificationItemID ParentId,
                       h.Number,
                       h.[Date],
                       i.RowIndex
                FROM SLE.RemittanceItem i
                    JOIN SLE.Remittance h
                        ON h.RemittanceID = i.RemittanceID
                WHERE i.JustificationItemID = @ParentId
            ) a;
        END;
    END;

    IF @EngName = 'Quotation'
    BEGIN
        IF @needParent = 1
        BEGIN
            SELECT CASE q.BaseDocument
                       WHEN 2 THEN
                           'Order'
                       WHEN 3 THEN
                           'Justification'
                   END EngName,
                   CASE q.BaseDocument
                       WHEN 2 THEN
                           @Order
                       WHEN 3 THEN
                           @Justification
                   END Title,
                   CASE q.BaseDocument
                       WHEN 2 THEN
                           o.OrderID
                       WHEN 3 THEN
                           jus.JustificationID
                   END EntityId,
                   CASE q.BaseDocument
                       WHEN 2 THEN
                           o.OrderItemID
                       WHEN 3 THEN
                           jus.JustificationItemID
                   END RelatedEntityId,
                   CASE
                       WHEN q.BaseDocument <> 1 THEN
                           qi.QuotationItemID
                   END ParentId,
                   CASE q.BaseDocument
                       WHEN 2 THEN
                           CAST(o.Number AS NVARCHAR(MAX))
                       WHEN 3 THEN
                           CAST(jus.Number AS NVARCHAR(MAX))
                   END Number,
                   CASE q.BaseDocument
                       WHEN 2 THEN
                           CFG.GetCLRSaturnDate(o.[Date], @DateFormat, 0, @DateType)
                       WHEN 3 THEN
                           CFG.GetCLRSaturnDate(jus.[Date], @DateFormat, 0, @DateType)
                   END DateString,
                   CASE q.BaseDocument
                       WHEN 2 THEN
                           CAST(o.RowIndex AS INT)
                       WHEN 3 THEN
                           CAST(jus.RowIndex AS INT)
                   END RowIndex
            FROM SLE.Quotation q
                JOIN SLE.QuotationItem qi
                    ON qi.QuotationID = q.QuotationID
                LEFT JOIN
                (
                    SELECT j.JustificationID,
                           ji.JustificationItemID,
                           j.Number,
                           j.[Date],
                           ji.RowIndex
                    FROM SLE.JustificationItem ji
                        JOIN SLE.Justification j
                            ON j.JustificationID = ji.JustificationID
                ) jus
                    ON jus.JustificationItemID = qi.JustificationItemID
                LEFT JOIN
                (
                    SELECT o.OrderID,
                           oi.OrderItemID,
                           o.Number,
                           [o].[Date],
                           oi.RowIndex
                    FROM CTM.[Order] o
                        JOIN CTM.OrderItem oi
                            ON oi.OrderID = o.OrderID
                ) o
                    ON o.OrderItemID = qi.OrderItemID
            WHERE qi.QuotationItemID = @ParentId
                  AND q.BaseDocument <> 1;
        END;
        ELSE
        BEGIN
            SELECT rel.EngName,
                   rel.Title,
                   rel.EntityId,
                   rel.RelatedEntityId,
                   rel.ParentId,
                   CAST(rel.Number AS NVARCHAR(MAX)) Number,
                   CFG.GetCLRSaturnDate(rel.[Date], @DateFormat, 0, @DateType) DateString,
                   CAST(rel.RowIndex AS INT) RowIndex
            FROM
            (
                SELECT 'Invoice' EngName,
                       @SaleInvoice Title,
                       h.InvoiceID EntityId,
                       i.InvoiceItemID RelatedEntityId,
                       i.QuotationItemID ParentId,
                       h.Number,
                       [h].[Date],
                       i.RowIndex
                FROM SLE.InvoiceItem i
                    JOIN SLE.Invoice h
                        ON h.InvoiceID = i.InvoiceID
                WHERE i.QuotationItemID = @ParentId
                UNION
                SELECT 'Outgoing' EngName,
                       @Outgoing Title,
                       h.OutgoingID EntityId,
                       i.OutgoingItemID RelatedEntityId,
                       i.QuotationItemID ParentId,
                       h.Number,
                       [h].[Date],
                       i.RowIndex
                FROM STC.OutgoingItem i
                    JOIN STC.Outgoing h
                        ON h.OutgoingID = i.OutgoingID
                WHERE i.QuotationItemID = @ParentId
                UNION
                SELECT 'Remittance' EngName,
                       @Remittance Title,
                       h.RemittanceID EntityId,
                       i.RemittanceItemID RelatedEntityId,
                       i.QuotationItemID ParentId,
                       h.Number,
                       [h].[Date],
                       i.RowIndex
                FROM SLE.RemittanceItem i
                    JOIN SLE.Remittance h
                        ON h.RemittanceID = i.RemittanceID
                WHERE i.QuotationItemID = @ParentId
                UNION
                SELECT 'SaleContract' EngName,
                       @SaleContract Title,
                       h.SaleContractID EntityId,
                       i.SaleContractItemID RelatedEntityId,
                       i.QuotationItemID ParentId,
                       h.Number,
                       [h].[Date],
                       i.RowIndex
                FROM SLE.SaleContractItem AS i
                    JOIN SLE.SaleContract AS h
                        ON h.SaleContractID = i.SaleContractID
                WHERE i.QuotationItemID = @ParentId
            ) rel;
        END;
    END;

    IF @EngName = 'ReturnedSaleJustification'
    BEGIN
        SELECT CASE j.BaseDocument
                   WHEN 6 THEN
                       'Invoice'
               END EngName,
               CASE j.BaseDocument
                   WHEN 6 THEN
                       @SaleInvoice
               END Title,
               CASE j.BaseDocument
                   WHEN 6 THEN
                       inv.InvoiceID
               END EntityId,
               CASE j.BaseDocument
                   WHEN 6 THEN
                       inv.InvoiceItemID
               END RelatedEntityId,
               CASE
                   WHEN j.BaseDocument <> 1 THEN
                       rj.ReturnedSaleJustificationItemID
               END ParentId,
               CASE j.BaseDocument
                   WHEN 6 THEN
                       CAST(inv.Number AS NVARCHAR(MAX))
               END Number,
               CASE j.BaseDocument
                   WHEN 6 THEN
                       CFG.GetCLRSaturnDate(inv.[Date], @DateFormat, 0, @DateType)
               END DateString,
               CASE j.BaseDocument
                   WHEN 6 THEN
                       CAST(inv.RowIndex AS INT)
               END RowIndex
        FROM SLE.ReturnedSaleJustificationItem rj
            JOIN SLE.ReturnedSaleJustification j
                ON j.ReturnedSaleJustificationID = rj.ReturnedSaleJustificationID
            LEFT JOIN
            (
                SELECT i.InvoiceID,
                       ii.InvoiceItemID,
                       i.Number,
                       [i].[Date],
                       ii.RowIndex
                FROM SLE.InvoiceItem ii
                    JOIN SLE.Invoice i
                        ON i.InvoiceID = ii.InvoiceID
            ) inv
                ON inv.InvoiceItemID = rj.InvoiceItemID
        WHERE rj.ReturnedSaleJustificationItemID = @ParentId
              AND j.BaseDocument <> 1;
    END;

    IF @EngName = 'ReturnStockReceipt'
    BEGIN
        IF @needParent = 0
        BEGIN
            -- load Childrens
            SELECT 'ReturnInvoice' EngName,
                   @ReturnedPurchaseInvoice Title,
                   h.ReturnInvoiceID EntityId,
                   i.ReturnInvoiceItemID RelatedEntityId,
                   i.ReturnStockReceiptItemID ParentId,
                   CAST(h.Number AS NVARCHAR(MAX)) Number,
                   CFG.GetCLRSaturnDate(h.[Date], @DateFormat, 0, @DateType) DateString,
                   CAST(i.RowIndex AS INT) RowIndex
            FROM VND.ReturnInvoiceItem AS i
                JOIN VND.ReturnInvoice h
                    ON h.ReturnInvoiceID = i.ReturnInvoiceID
            WHERE i.ReturnStockReceiptItemID = @ParentId;
        END;
        ELSE
        BEGIN
            SELECT CASE sdtb.BaseEntity
                       WHEN 2 THEN
                           'StockReceipt'
                       WHEN 3 THEN
                           'ReturnRequest'
                   END EngName,
                   CASE sdtb.BaseEntity
                       WHEN 2 THEN
                           @StockReceipt
                       WHEN 3 THEN
                           @ReturnRequest
                   END Title,
                   CASE sdtb.BaseEntity
                       WHEN 2 THEN
                           base1.StockReceiptID
                       WHEN 3 THEN
                           base2.ReturnRequestID
                   END EntityId,
                   CASE sdtb.BaseEntity
                       WHEN 2 THEN
                           base1.StockReceiptItemID
                       WHEN 3 THEN
                           base2.ReturnRequestItemID
                   END RelatedEntityId,
                   CASE
                       WHEN sdtb.BaseEntity <> 1 THEN
                           i.ReturnStockReceiptItemID
                   END ParentId,
                   CASE sdtb.BaseEntity
                       WHEN 2 THEN
                           CAST(base1.Number AS NVARCHAR(MAX))
                       WHEN 3 THEN
                           CAST(base2.ReturnRequestNumber AS NVARCHAR(MAX))
                   END Number,
                   CASE sdtb.BaseEntity
                       WHEN 2 THEN
                           CFG.GetCLRSaturnDate([base1].[Date], @DateFormat, 0, @DateType)
                       WHEN 3 THEN
                           CFG.GetCLRSaturnDate(base2.ReturnRequestDate, @DateFormat, 0, @DateType)
                   END DateString,
                   CASE sdtb.BaseEntity
                       WHEN 2 THEN
                           CAST(base1.RowIndex AS INT)
                       WHEN 3 THEN
                           CAST(base2.ReturnRequestItemIndex AS INT)
                   END RowIndex
            FROM STC.ReturnStockReceiptItem AS i
                JOIN STC.ReturnStockReceipt AS h
                    ON h.ReturnStockReceiptID = i.ReturnStockReceiptID                
            JOIN [STC].[StockDocumentTypeBaseEntity] sdtb
                ON h.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
                LEFT JOIN
                (
                    SELECT sr.StockReceiptID,
                           sri.StockReceiptItemID,
                           sr.Number,
                           sr.Date,
                           sri.RowIndex
                    FROM STC.StockReceiptItem AS sri
                        JOIN STC.StockReceipt AS sr
                            ON sr.StockReceiptID = sri.StockReceiptID
                ) base1
                    ON base1.StockReceiptItemID = i.StockReceiptItemID
                LEFT JOIN
                (
                    SELECT rr.ReturnRequestID,
                           rri.ReturnRequestItemID,
                           rr.ReturnRequestNumber,
                           rr.ReturnRequestDate,
                           rri.ReturnRequestItemIndex
                    FROM REQ.ReturnRequestItem AS rri
                        JOIN REQ.ReturnRequest AS rr
                            ON rr.ReturnRequestID = rri.ReturnRequestID
                ) base2
                    ON base2.ReturnRequestItemID = i.ReturnRequestItemID
            WHERE i.ReturnStockReceiptItemID = @ParentId
                  AND sdtb.BaseEntity <> 1;
        END;
    END;

    IF @EngName = 'ReturnedSaleInvoice'
    BEGIN
        IF @needParent = 1
        BEGIN
            SELECT t.EngName,
                   t.Title,
                   t.EntityId,
                   t.RelatedEntityId,
                   t.ParentId,
                   t.Number,
                   t.DateString,
                   CAST(t.RowIndex AS INT) RowIndex
            FROM
            (
                SELECT 'ReturnedSaleJustification' AS EngName,
                       @ReturnedSaleJustification AS Title,
                       rsj.ReturnedSaleJustificationID AS EntityId,
                       rsii.ReturnedSaleJustificationItemID RelatedEntityId,
                       rsii.ReturnedSaleInvoiceItemID ParentId,
                       CAST(rsj.Number AS NVARCHAR(MAX)) AS Number,
                       CFG.GetCLRSaturnDate(rsj.Date, @DateFormat, 0, @DateType) AS DateString,
                       rsji.RowIndex AS RowIndex
                FROM SLE.ReturnedSaleInvoice AS rsi
                    JOIN SLE.ReturnedSaleInvoiceItem AS rsii
                        ON rsii.ReturnedSaleInvoiceID = rsi.ReturnedSaleInvoiceID
                    JOIN SLE.ReturnedSaleJustificationItem AS rsji
                        ON rsji.ReturnedSaleJustificationItemID = rsii.ReturnedSaleJustificationItemID
                    JOIN SLE.ReturnedSaleJustification AS rsj
                        ON rsj.ReturnedSaleJustificationID = rsji.ReturnedSaleJustificationID
                WHERE rsi.BaseDocument <> 1
                      AND rsii.ReturnedSaleInvoiceItemID = @ParentId
                UNION
                SELECT 'ReturnedOutgoing' AS EngName,
                       @ReturnedOutgoing AS Title,
                       rsj.ReturnedOutgoingID AS EntityId,
                       rsii.ReturnedOutgoingItemID RelatedEntityId,
                       rsii.ReturnedSaleInvoiceItemID ParentId,
                       CAST(rsj.Number AS NVARCHAR(MAX)) AS Number,
                       CFG.GetCLRSaturnDate(rsj.[Date], @DateFormat, 0, @DateType) AS DateString,
                       rsji.RowIndex AS RowIndex
                FROM SLE.ReturnedSaleInvoice AS rsi
                    JOIN SLE.ReturnedSaleInvoiceItem AS rsii
                        ON rsii.ReturnedSaleInvoiceID = rsi.ReturnedSaleInvoiceID
                    JOIN STC.ReturnedOutgoingItem AS rsji
                        ON rsji.ReturnedOutgoingItemID = rsii.ReturnedOutgoingItemID
                    JOIN STC.ReturnedOutgoing AS rsj
                        ON rsj.ReturnedOutgoingID = rsji.ReturnedOutgoingID
                WHERE rsi.BaseDocument <> 1
                      AND rsii.ReturnedSaleInvoiceItemID = @ParentId
                UNION
                SELECT 'Invoice' AS EngName,
                       @SaleInvoice AS Title,
                       rsj.InvoiceID AS EntityId,
                       rsii.ReturnedOutgoingItemID RelatedEntityId,
                       rsii.ReturnedSaleInvoiceItemID ParentId,
                       CAST(rsj.Number AS NVARCHAR(MAX)) AS Number,
                       CFG.GetCLRSaturnDate(rsj.[Date], @DateFormat, 0, @DateType) AS DateString,
                       rsji.RowIndex AS RowIndex
                FROM SLE.ReturnedSaleInvoice AS rsi
                    JOIN SLE.ReturnedSaleInvoiceItem AS rsii
                        ON rsii.ReturnedSaleInvoiceID = rsi.ReturnedSaleInvoiceID
                    JOIN SLE.InvoiceItem AS rsji
                        ON rsji.InvoiceItemID = rsii.InvoiceItemID
                    JOIN SLE.Invoice AS rsj
                        ON rsj.InvoiceID = rsji.InvoiceID
                WHERE rsi.BaseDocument <> 1
                      AND rsii.ReturnedSaleInvoiceItemID = @ParentId
            ) AS t;
        END;
        ELSE
        BEGIN
            SELECT Relation.EngName,
                   Relation.Title,
                   Relation.EntityId,
                   Relation.RelatedEntityId,
                   Relation.ParentId,
                   CAST(Relation.Number AS NVARCHAR(MAX)) Number,
                   Relation.DateString,
                   CAST(Relation.RowIndex AS INT) RowIndex
            FROM
            (
                SELECT 'QuantityReturnedOutgoing' EngName,
                       @ReturnedOutgoing Title,
                       ro.ReturnedOutgoingID EntityId,
                       roi.ReturnedOutgoingItemID RelatedEntityId,
                       roi.ReturnedSaleInvoiceItemID ParentId,
                       ro.Number,
                       CFG.GetCLRSaturnDate(ro.[Date], @DateFormat, 0, @DateType) DateString,
                       roi.RowIndex
                FROM STC.ReturnedOutgoing AS ro
                    JOIN STC.ReturnedOutgoingItem AS roi
                        ON roi.ReturnedOutgoingID = ro.ReturnedOutgoingID
                WHERE roi.ReturnedSaleInvoiceItemID = @ParentId
            ) AS Relation;
        END;
    END;

    IF @EngName = 'ReturnOutgoing'
    BEGIN
        IF @needParent = 0
        BEGIN
            -- load Childrens
            SELECT 'ReturnedSaleInvoice' EngName,
                   @ReturnSaleInvoice Title,
                   h.ReturnedSaleInvoiceID EntityId,
                   i.ReturnedSaleInvoiceItemID RelatedEntityId,
                   i.ReturnedOutgoingItemID ParentId,
                   CAST(h.Number AS NVARCHAR(MAX)) Number,
                   CFG.GetCLRSaturnDate(h.[Date], @DateFormat, 0, @DateType) DateString,
                   CAST(i.RowIndex AS INT) RowIndex
            FROM SLE.ReturnedSaleInvoiceItem AS i
                JOIN SLE.ReturnedSaleInvoice h
                    ON h.ReturnedSaleInvoiceID = i.ReturnedSaleInvoiceID
            WHERE i.ReturnedOutgoingItemID = @ParentId;
        END;
        ELSE
        BEGIN
            SELECT 'Outgoing' AS EngName,
                   @Outgoing Title,
                   o.OutgoingID EntityId,
                   oi.OutgoingItemID RelatedEntityId,
                   ro.ReturnedOutgoingID AS ParentId,
                   CAST(o.Number AS NVARCHAR(MAX)) AS Number,
                   CFG.GetCLRSaturnDate(o.[Date], @DateFormat, 0, @DateType) AS DateString,
                   CAST(oi.RowIndex AS INT) AS RowIndex
            FROM STC.ReturnedOutgoing AS ro
                JOIN [STC].[StockDocumentTypeBaseEntity] sdtb 
                    ON ro.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
                JOIN STC.ReturnedOutgoingItem AS roi
                    ON roi.ReturnedOutgoingID = ro.ReturnedOutgoingID
                JOIN STC.OutgoingItem AS oi
                    ON oi.OutgoingItemID = roi.OutgoingItemID
                JOIN STC.Outgoing AS o
                    ON o.OutgoingID = oi.OutgoingID
            WHERE sdtb.BaseEntity <> 1
                  AND roi.ReturnedOutgoingItemID = @ParentId
            UNION ALL
            SELECT 'ReturnedSaleInvoice' AS EngName,
                   @ReturnedSaleInvoice Title,
                   rsi.ReturnedSaleInvoiceID EntityId,
                   rsii.ReturnedSaleInvoiceItemID RelatedEntityId,
                   @ParentId AS ParentId,
                   CAST(rsi.Number AS NVARCHAR(MAX)) AS Number,
                   CFG.GetCLRSaturnDate(rsi.[Date], @DateFormat, 0, @DateType) AS DateString,
                   CAST(rsii.RowIndex AS INT) AS RowIndex
            FROM SLE.ReturnedSaleInvoice AS rsi
                JOIN SLE.ReturnedSaleInvoiceItem AS rsii
                    ON rsii.ReturnedSaleInvoiceID = rsi.ReturnedSaleInvoiceID
                JOIN STC.ReturnedOutgoingItem AS roi
                    ON rsii.ReturnedSaleInvoiceItemID = roi.ReturnedSaleInvoiceItemID
            WHERE roi.ReturnedOutgoingItemID = @ParentId;
        END;
    END;

    IF (@EngName = 'PaymentSubject')
    BEGIN
        IF (@needParent = 0)
        BEGIN
            SELECT 'PurchaseInvoicePrePayment' EngName,
                   @PurchaseInvoicePrePayment Title,
                   p.PurchaseInvoiceID EntityId,
                   p.PurchaseInvoicePrePaymentID RelatedEntityId,
                   p.PaymentSubjectID ParentId,
                   CAST(i.Number AS NVARCHAR(MAX)) AS Number,
                   CFG.GetCLRSaturnDate(i.[Date], @DateFormat, 0, @DateType) DateString,
                   0 RowIndex
            FROM VND.PurchaseInvoicePrePayment p
                JOIN VND.PurchaseInvoice i
                    ON p.PurchaseInvoiceID = i.PurchaseInvoiceID
            WHERE p.PaymentSubjectID = @ParentId
            UNION
            SELECT 'DebitCreditNote' EngName,
                   @DebitCreditNote Title,
                   i.DebitCreditNoteID EntityId,
                   i.DebitCreditNoteItemID RelatedEntityId,
                   i.PaymentSubjectID ParentId,
                   CAST(d.Number AS NVARCHAR(MAX)) AS Number,
                   CFG.GetCLRSaturnDate(d.[Date], @DateFormat, 0, @DateType) DateString,
                   i.RowIndex
            FROM CFG.DebitCreditNoteItem i
                JOIN CFG.DebitCreditNote d
                    ON i.DebitCreditNoteID = d.DebitCreditNoteID
            WHERE i.PaymentSubjectID = @ParentId
            UNION
            SELECT 'ParameterMonthlyData' EngName,
                   @ParameterMonthlyData Title,
                   p.ParameterMonthlyDataID EntityId,
                   p.ParameterMonthlyDataID RelatedEntityId,
                   p.PaymentSubjectID ParentId,
                   CAST(c.[Year] AS NVARCHAR(100)) + '/' + cm.[MonthName] Number,
                   CFG.GetCLRSaturnDate(cm.EndDate, @DateFormat, 0, @DateType) DateString,
                   0 RowIndex
            FROM PAY.ParameterMonthlyData p
                JOIN HRM.CalendarMonth cm
                    ON p.CalendarMonthID = cm.CalendarMonthID
                JOIN HRM.Calendar c
                    ON cm.CalendarID = c.CalendarID
            WHERE p.PaymentSubjectID = @ParentId
            UNION
            SELECT 'Loan' EngName,
                   @LoanAssignment Title,
                   l.LoanID EntityId,
                   l.LoanID RelatedEntityId,
                   l.PaymentSubjectID ParentId,
                   CAST(l.Number AS NVARCHAR(MAX)) AS Number,
                   CFG.GetCLRSaturnDate(l.[Date], @DateFormat, 0, @DateType) DateString,
                   0 RowIndex
            FROM PAY.Loan l
            WHERE l.PaymentSubjectID = @ParentId;
        END;
        ELSE
        BEGIN
            SELECT a.EngName,
                   a.Title,
                   a.EntityId,
                   a.RelatedEntityId,
                   a.ParentId,
                   CAST(a.Number AS NVARCHAR(MAX)) AS Number,
                   CFG.GetCLRSaturnDate(a.[Date], @DateFormat, 0, @DateType) AS DateString,
                   a.RowIndex
            FROM
            (
                SELECT CASE
                           WHEN s.PurchaseInvoiceID IS NOT NULL THEN
                               'PurchaseInvoice'
                           WHEN s.ReturnedSaleInvoiceID IS NOT NULL THEN
                               'ReturnedSaleInvoice'
                           WHEN s.InstallmentPaymentItemID IS NOT NULL THEN
                               'InstallmentPayment'
                           WHEN s.PurchaseContractID IS NOT NULL THEN
                               'PurchaseContract'
                           WHEN s.ProposalID IS NOT NULL THEN
                               'Proposal'
                           WHEN s.PayPreparingID IS NOT NULL THEN
                               'PayPreparing'
                           WHEN s.InvoiceID IS NOT NULL THEN
                               'Invoice'
                           WHEN s.ProformaInvoiceID IS NOT NULL THEN
                               'ProformaInvoice'
                           WHEN s.ConfirmStatementID IS NOT NULL
                                OR s.ConfirmStatementItemID IS NOT NULL THEN
                               'ConfirmStatement'
                           WHEN s.ContractID IS NOT NULL THEN
                               'ContractDefinition'
                           WHEN s.ContractStatementID IS NOT NULL THEN
                               'ContractStatement'
                       END AS EngName,
                       CASE
                           WHEN s.PurchaseInvoiceID IS NOT NULL THEN
                               @PurchaseInvoice
                           WHEN s.ReturnedSaleInvoiceID IS NOT NULL THEN
                               @ReturnSaleInvoice
                           WHEN s.InstallmentPaymentItemID IS NOT NULL THEN
                               @Installment
                           WHEN s.PurchaseContractID IS NOT NULL THEN
                               @PurchaseContract
                           WHEN s.ProposalID IS NOT NULL THEN
                               @Proposal
                           WHEN s.PayPreparingID IS NOT NULL THEN
                               @PayPreparing
                           WHEN s.InvoiceID IS NOT NULL THEN
                               @SaleInvoice
                           WHEN s.ProformaInvoiceID IS NOT NULL THEN
                               @ProformaInvoice
                           WHEN s.ConfirmStatementID IS NOT NULL
                                OR s.ConfirmStatementItemID IS NOT NULL THEN
                               @FinancialConfirm
                           WHEN s.ContractID IS NOT NULL THEN
                               @Contract
                           WHEN s.ContractStatementID IS NOT NULL THEN
                               @ContractStatement
                       END AS Title,
                       CASE
                           WHEN s.PurchaseInvoiceID IS NOT NULL THEN
                               s.PurchaseInvoiceID
                           WHEN s.ReturnedSaleInvoiceID IS NOT NULL THEN
                               s.ReturnedSaleInvoiceID
                           WHEN s.InstallmentPaymentItemID IS NOT NULL THEN
                               ins.InstallmentPaymentID
                           WHEN s.PurchaseContractID IS NOT NULL THEN
                               s.PurchaseContractID
                           WHEN s.ProposalID IS NOT NULL THEN
                               s.ProposalID
                           WHEN s.PayPreparingID IS NOT NULL THEN
                               s.PayPreparingID
                           WHEN s.InvoiceID IS NOT NULL THEN
                               s.InvoiceID
                           WHEN s.ProformaInvoiceID IS NOT NULL THEN
                               s.ProformaInvoiceID
                           WHEN s.ConfirmStatementID IS NOT NULL THEN
                               s.ConfirmStatementID
                           WHEN s.ConfirmStatementItemID IS NOT NULL THEN
                               cfs.ConfirmStatementID
                           WHEN s.ContractID IS NOT NULL THEN
                               s.ContractID
                           WHEN s.ContractStatementID IS NOT NULL THEN
                               s.ContractStatementID
                       END AS EntityId,
                       CAST(CASE
                                WHEN s.PurchaseInvoiceID IS NOT NULL THEN
                                    s.PurchaseInvoiceID
                                WHEN s.ReturnedSaleInvoiceID IS NOT NULL THEN
                                    s.ReturnedSaleInvoiceID
                                WHEN s.InstallmentPaymentItemID IS NOT NULL THEN
                                    s.InstallmentPaymentItemID
                                WHEN s.PurchaseContractID IS NOT NULL THEN
                                    s.PurchaseContractID
                                WHEN s.ProposalID IS NOT NULL THEN
                                    s.ProposalID
                                WHEN s.PayPreparingID IS NOT NULL THEN
                                    s.PayPreparingID
                                WHEN s.InvoiceID IS NOT NULL THEN
                                    s.InvoiceID
                                WHEN s.ProformaInvoiceID IS NOT NULL THEN
                                    s.ProformaInvoiceID
                                WHEN s.ConfirmStatementID IS NOT NULL THEN
                                    s.ConfirmStatementID
                                WHEN s.ConfirmStatementItemID IS NOT NULL THEN
                                    s.ConfirmStatementItemID
                                WHEN s.ContractID IS NOT NULL THEN
                                    s.ContractID
                                WHEN s.ContractStatementID IS NOT NULL THEN
                                    s.ContractStatementID
                            END AS INT) AS RelatedEntityId,
                       s.PaymentSubjectID ParentId,
                       CASE
                           WHEN s.PurchaseInvoiceID IS NOT NULL THEN
                               piv.Number
                           WHEN s.ReturnedSaleInvoiceID IS NOT NULL THEN
                               rsi.Number
                           WHEN s.InstallmentPaymentItemID IS NOT NULL THEN
                               ins.Number
                           WHEN s.PurchaseContractID IS NOT NULL THEN
                               pc.Number
                           WHEN s.ProposalID IS NOT NULL THEN
                               prp.Number
                           WHEN s.PayPreparingID IS NOT NULL THEN
                               PayPre.Number
                           WHEN s.InvoiceID IS NOT NULL THEN
                               inv.Number
                           WHEN s.ProformaInvoiceID IS NOT NULL THEN
                               prf.Number
                           WHEN s.ConfirmStatementID IS NOT NULL THEN
                               cst.Number
                           WHEN s.ConfirmStatementItemID IS NOT NULL THEN
                               cfs.Number
                           WHEN s.ContractID IS NOT NULL THEN
                               cnt.Number
                           WHEN s.ContractStatementID IS NOT NULL THEN
                               cnts.Number
                       END AS Number,
                       CASE
                           WHEN s.PurchaseInvoiceID IS NOT NULL THEN
                               piv.[Date]
                           WHEN s.ReturnedSaleInvoiceID IS NOT NULL THEN
                               rsi.[Date]
                           WHEN s.InstallmentPaymentItemID IS NOT NULL THEN
                               ins.[Date]
                           WHEN s.PurchaseContractID IS NOT NULL THEN
                               pc.[Date]
                           WHEN s.ProposalID IS NOT NULL THEN
                               prp.[Date]
                           WHEN s.PayPreparingID IS NOT NULL THEN
                               PayPre.[Date]
                           WHEN s.InvoiceID IS NOT NULL THEN
                               inv.[Date]
                           WHEN s.ProformaInvoiceID IS NOT NULL THEN
                               prf.[Date]
                           WHEN s.ConfirmStatementID IS NOT NULL THEN
                               cst.[Date]
                           WHEN s.ConfirmStatementItemID IS NOT NULL THEN
                               cfs.[Date]
                           WHEN s.ContractID IS NOT NULL THEN
                               cnt.[Date]
                           WHEN s.ContractStatementID IS NOT NULL THEN
                               cnts.[Date]
                       END AS [Date],
                       CASE
                           WHEN s.ConfirmStatementItemID IS NOT NULL THEN
                               cfs.RowIndex
                           ELSE
                               0
                       END AS RowIndex
                FROM FIN.PaymentSubject s
                    LEFT JOIN VND.PurchaseInvoice piv
                        ON s.PurchaseInvoiceID = piv.PurchaseInvoiceID
                    LEFT JOIN SLE.ReturnedSaleInvoice rsi
                        ON s.ReturnedSaleInvoiceID = rsi.ReturnedSaleInvoiceID
                    LEFT JOIN VND.PurchaseContract pc
                        ON s.PurchaseContractID = pc.PurchaseContractID
                    LEFT JOIN VND.Proposal prp
                        ON s.ProposalID = prp.ProposalID
                    LEFT JOIN SLE.Invoice inv
                        ON s.InvoiceID = inv.InvoiceID
                    LEFT JOIN FOS.ProformaInvoice prf
                        ON s.ProformaInvoiceID = prf.ProformaInvoiceID
                    LEFT JOIN CNT.ConfirmStatement cst
                        ON s.ConfirmStatementID = cst.ConfirmStatementID
                    LEFT JOIN CNT.[Contract] cnt
                        ON s.ContractID = cnt.ContractID
                    LEFT JOIN
                    (
                        SELECT ipi.InstallmentPaymentID,
                               ipi.InstallmentPaymentItemID,
                               h.Number,
                               h.[Date]
                        FROM CFG.InstallmentPaymentItem ipi
                            JOIN CFG.InstallmentPayment h
                                ON ipi.InstallmentPaymentID = h.InstallmentPaymentID
                    ) ins
                        ON s.InstallmentPaymentItemID = ins.InstallmentPaymentItemID
                    LEFT JOIN
                    (
                        SELECT csi.ConfirmStatementItemID,
                               csi.ConfirmStatementID,
                               cs.Number,
                               cs.Date,
                               csi.RowIndex
                        FROM CNT.ConfirmStatementItem csi
                            JOIN CNT.ConfirmStatement cs
                                ON csi.ConfirmStatementID = cs.ConfirmStatementID
                    ) cfs
                        ON s.ConfirmStatementItemID = cfs.ConfirmStatementItemID
                    LEFT JOIN
                    (
                        SELECT Pay.PayPreparingID,
                               CAST(cal.[Year] AS NVARCHAR(100)) + '/' + cm.[MonthName] Number,
                               cm.EndDate [Date]
                        FROM PAY.PayPreparing Pay
                            JOIN HRM.CalendarMonth cm
                                ON Pay.CalendarMonthID = cm.CalendarMonthID
                            JOIN HRM.Calendar cal
                                ON cm.CalendarID = cal.CalendarID
                    ) PayPre
                        ON s.PayPreparingID = PayPre.PayPreparingID
                    LEFT JOIN
                    (
                        SELECT st.ContractStatementID,
                               st.Number,
                               st2.Date
                        FROM CNT.ContractStatement st
                            JOIN CNT.[Contract] st2
                                ON st.ContractID = st2.ContractID
                    ) cnts
                        ON s.ContractStatementID = cnts.ContractStatementID
                WHERE s.PaymentSubjectID = @ParentId
            ) a
            WHERE a.RelatedEntityId IS NOT NULL;
        END;
    END;

    IF (@EngName = 'PaymentCheqe')
    BEGIN
        SELECT 'PaymentCheqeCashing' EngName,
               @PaymentCheqeCashing Title,
               i.PaymentCheqeFlowID EntityId,
               i.PaymentCheqeFlowItemID RelatedEntityId,
               i.PaymentCheqeID ParentId,
               CAST(f.InnerNumber AS NVARCHAR(256)) AS Number,
               CFG.GetCLRSaturnDate(f.[Date], @DateFormat, 0, @DateType) DateString,
               CAST(i.RowIndex AS INT) RowIndex
        FROM FIN.PaymentCheqeFlowItem i
            JOIN FIN.PaymentCheqeFlow f
                ON i.PaymentCheqeFlowID = f.PaymentCheqeFlowID
        WHERE i.PaymentCheqeID = @ParentId
              AND f.Type = 0
        UNION
        SELECT 'DrawBackPaymentCheqe' EngName,
               @DrawBackPaymentCheqe Title,
               i.PaymentCheqeFlowID EntityId,
               i.PaymentCheqeFlowItemID RelatedEntityId,
               i.PaymentCheqeID ParentId,
               CAST(f.InnerNumber AS NVARCHAR(256)) AS Number,
               CFG.GetCLRSaturnDate(f.[Date], @DateFormat, 0, @DateType) DateString,
               CAST(i.RowIndex AS INT) RowIndex
        FROM FIN.PaymentCheqeFlowItem i
            JOIN FIN.PaymentCheqeFlow f
                ON i.PaymentCheqeFlowID = f.PaymentCheqeFlowID
        WHERE i.PaymentCheqeID = @ParentId
              AND f.Type = 1;
    END;

    IF (@EngName = 'ReceivedCheqe')
    BEGIN
        SELECT 'DeliverToSupplier' EngName,
               @DeliverToSupplier Title,
               i.ReceiptCheqeFlowID EntityId,
               i.ReceiptCheqeFlowItemID RelatedEntityId,
               i.ReceivedCheqeID ParentId,
               CAST(f.InnerNumber AS NVARCHAR(256)) AS Number,
               CFG.GetCLRSaturnDate(f.[Date], @DateFormat, 0, @DateType) DateString,
               CAST(i.RowIndex AS INT) RowIndex
        FROM FIN.ReceiptCheqeFlowItem i
            JOIN FIN.ReceiptCheqeFlow f
                ON i.ReceiptCheqeFlowID = f.ReceiptCheqeFlowID
        WHERE i.ReceivedCheqeID = @ParentId
              AND i.State = 8
        UNION
        SELECT 'BankOperation' EngName,
               @AssignToBank Title,
               i.ReceiptCheqeFlowID EntityId,
               i.ReceiptCheqeFlowItemID RelatedEntityId,
               i.ReceivedCheqeID ParentId,
               CAST(f.InnerNumber AS NVARCHAR(256)) AS Number,
               CFG.GetCLRSaturnDate(f.[Date], @DateFormat, 0, @DateType) DateString,
               CAST(i.RowIndex AS INT) RowIndex
        FROM FIN.ReceiptCheqeFlowItem i
            JOIN FIN.ReceiptCheqeFlow f
                ON i.ReceiptCheqeFlowID = f.ReceiptCheqeFlowID
        WHERE i.ReceivedCheqeID = @ParentId
              AND i.State = 1
              AND f.Type IN ( 0, 7 )
        UNION
        SELECT 'BankOperation' EngName,
               @CashFromBank Title,
               i.ReceiptCheqeFlowID EntityId,
               i.ReceiptCheqeFlowItemID RelatedEntityId,
               i.ReceivedCheqeID ParentId,
               CAST(f.InnerNumber AS NVARCHAR(256)) AS Number,
               CFG.GetCLRSaturnDate(f.[Date], @DateFormat, 0, @DateType) DateString,
               CAST(i.RowIndex AS INT) RowIndex
        FROM FIN.ReceiptCheqeFlowItem i
            JOIN FIN.ReceiptCheqeFlow f
                ON i.ReceiptCheqeFlowID = f.ReceiptCheqeFlowID
        WHERE i.ReceivedCheqeID = @ParentId
              AND i.State = 6
        UNION
        SELECT 'BankOperation' EngName,
               @Protest Title,
               i.ReceiptCheqeFlowID EntityId,
               i.ReceiptCheqeFlowItemID RelatedEntityId,
               i.ReceivedCheqeID ParentId,
               CAST(f.InnerNumber AS NVARCHAR(256)) AS Number,
               CFG.GetCLRSaturnDate(f.[Date], @DateFormat, 0, @DateType) DateString,
               CAST(i.RowIndex AS INT) RowIndex
        FROM FIN.ReceiptCheqeFlowItem i
            JOIN FIN.ReceiptCheqeFlow f
                ON i.ReceiptCheqeFlowID = f.ReceiptCheqeFlowID
        WHERE i.ReceivedCheqeID = @ParentId
              AND i.State = 7
              AND f.Type IN ( 5, 8 )
        UNION
        SELECT 'BankOperation' EngName,
               @ReturnFromAssignment Title,
               i.ReceiptCheqeFlowID EntityId,
               i.ReceiptCheqeFlowItemID RelatedEntityId,
               i.ReceivedCheqeID ParentId,
               CAST(f.InnerNumber AS NVARCHAR(256)) AS Number,
               CFG.GetCLRSaturnDate(f.[Date], @DateFormat, 0, @DateType) DateString,
               CAST(i.RowIndex AS INT) RowIndex
        FROM FIN.ReceiptCheqeFlowItem i
            JOIN FIN.ReceiptCheqeFlow f
                ON i.ReceiptCheqeFlowID = f.ReceiptCheqeFlowID
        WHERE i.ReceivedCheqeID = @ParentId
              AND f.Type = 10
        UNION
        SELECT 'ReceivedCheqeCashing' EngName,
               @CashToFund Title,
               i.ReceiptCheqeFlowID EntityId,
               i.ReceiptCheqeFlowItemID RelatedEntityId,
               i.ReceivedCheqeID ParentId,
               CAST(f.InnerNumber AS NVARCHAR(256)) AS Number,
               CFG.GetCLRSaturnDate(f.[Date], @DateFormat, 0, @DateType) DateString,
               CAST(i.RowIndex AS INT) RowIndex
        FROM FIN.ReceiptCheqeFlowItem i
            JOIN FIN.ReceiptCheqeFlow f
                ON i.ReceiptCheqeFlowID = f.ReceiptCheqeFlowID
        WHERE i.ReceivedCheqeID = @ParentId
              AND i.State = 3
        UNION
        SELECT 'ReceivedCheqeCashing' EngName,
               @CashToBank Title,
               i.ReceiptCheqeFlowID EntityId,
               i.ReceiptCheqeFlowItemID RelatedEntityId,
               i.ReceivedCheqeID ParentId,
               CAST(f.InnerNumber AS NVARCHAR(256)) AS Number,
               CFG.GetCLRSaturnDate(f.[Date], @DateFormat, 0, @DateType) DateString,
               CAST(i.RowIndex AS INT) RowIndex
        FROM FIN.ReceiptCheqeFlowItem i
            JOIN FIN.ReceiptCheqeFlow f
                ON i.ReceiptCheqeFlowID = f.ReceiptCheqeFlowID
        WHERE i.ReceivedCheqeID = @ParentId
              AND i.State = 4
        UNION
        SELECT 'PaymentReceipt' EngName,
               @Spending Title,
               o.PaymentReceiptID EntityId,
               o.PaymentOtherCheqeID RelatedEntityId,
               o.ReceivedCheqeID ParentId,
               CAST(p.Number AS NVARCHAR(256)) AS Number,
               CFG.GetCLRSaturnDate(p.[Date], @DateFormat, 0, @DateType) DateString,
               CAST(o.RowIndex AS INT) RowIndex
        FROM FIN.PaymentOtherCheqe o
            JOIN FIN.PaymentReceipt p
                ON o.PaymentReceiptID = p.PaymentReceiptID
        WHERE o.ReceivedCheqeID = @ParentId
        UNION
        SELECT 'DrawBackReceivedCheqe' EngName,
               @DrawBack Title,
               i.ReceiptCheqeFlowID EntityId,
               i.ReceiptCheqeFlowItemID RelatedEntityId,
               i.ReceivedCheqeID ParentId,
               CAST(f.InnerNumber AS NVARCHAR(256)) AS Number,
               CFG.GetCLRSaturnDate(f.[Date], @DateFormat, 0, @DateType) DateString,
               CAST(i.RowIndex AS INT) RowIndex
        FROM FIN.ReceiptCheqeFlowItem i
            JOIN FIN.ReceiptCheqeFlow f
                ON i.ReceiptCheqeFlowID = f.ReceiptCheqeFlowID
        WHERE i.ReceivedCheqeID = @ParentId
              AND i.State = 2
        UNION
        SELECT 'DrawBackReceivedCheqe' EngName,
               @ReturnedOfSpend Title,
               i.ReceiptCheqeFlowID EntityId,
               i.ReceiptCheqeFlowItemID RelatedEntityId,
               i.ReceivedCheqeID ParentId,
               CAST(f.InnerNumber AS NVARCHAR(256)) AS Number,
               CFG.GetCLRSaturnDate(f.[Date], @DateFormat, 0, @DateType) DateString,
               CAST(i.RowIndex AS INT) RowIndex
        FROM FIN.ReceiptCheqeFlowItem i
            JOIN FIN.ReceiptCheqeFlow f
                ON i.ReceiptCheqeFlowID = f.ReceiptCheqeFlowID
        WHERE i.ReceivedCheqeID = @ParentId
              AND f.Type = 4;
    END;

END;
