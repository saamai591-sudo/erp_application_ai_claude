-------------------------------------

CREATE   PROC [CFG].[spDebitCreditNoteItemInsert]
    @DebitCreditNoteID INT,
    @Type TINYINT,
    @RowIndex INT,
    @ReceiptTypeID INT,
    @PaymentTypeID INT,
    @PartyID BIGINT,
    @ReceiveSubjectID INT,
    @DebitCreditID INT,
    @PurchaseInvoiceID INT,
    @ReturnedSaleInvoiceID INT,
    @InstallmentPaymentItemID INT,
    @PurchaseContractID INT,
    @ProposalID INT,
    @CalculationResultID DECIMAL(18, 0),
    @SaleContractID INT,
    @QuotationID INT,
    @InvoiceID INT,
    @ReturnInvoiceID INT,
    @PaymentSubjectID INT,
    @PettyCashCostItemID INT,
    @ProformaInvoiceID INT,
    @ConfirmStatementID INT,
    @ConfirmStatementItemID INT,
    @ContractID INT,
    @ContractStatementID INT,
    @Description NVARCHAR(MAX),
    @Description2 NVARCHAR(MAX),
    @CurrencyID INT,
    @CurrencyRate DECIMAL(20, 10),
    @Amount DECIMAL(30, 4),
    @Discount DECIMAL(30, 4),
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME,
    @PettyCashID INT,
    @Allocation DECIMAL(36, 10),
    @ConfirmPurchaseInvoiceID INT = NULL,
    @ConfirmPurchaseInvoiceItemID INT = NULL,
    @PayPreparingID INT NULL
--WITH ENCRYPTION
AS
SET NOCOUNT ON;

    DECLARE @AnnouncedInAdditionalValue BIT,
            @Date DATE;

    SELECT @AnnouncedInAdditionalValue = AnnouncedInAdditionalValue
    FROM FIN.PaymentType
    WHERE PaymentTypeID = @PaymentTypeID;

    SELECT @Date = [Date]
    FROM CFG.DebitCreditNote
    WHERE DebitCreditNoteID = @DebitCreditNoteID;

    IF (@AnnouncedInAdditionalValue = 1)
    BEGIN

        DECLARE @maxDate DATE;
        SELECT @maxDate = MAX(v.EndDate)
        FROM CFG.Vat v;

        IF @maxDate IS NOT NULL
           AND @maxDate >= @Date
        BEGIN
            RAISERROR('VatHasPublished', 16, 12);
        END;

    END;

    INSERT INTO [CFG].[DebitCreditNoteItem]
    (
        [DebitCreditNoteID],
        [Type],
        [RowIndex],
        [ReceiptTypeID],
        [PaymentTypeID],
        [PartyID],
        [ReceiveSubjectID],
        [DebitCreditID],
        [PurchaseInvoiceID],
        [ReturnedSaleInvoiceID],
        [InstallmentPaymentItemID],
        [PurchaseContractID],
        [ProposalID],
        [CalculationResultID],
        [SaleContractID],
        [QuotationID],
        [InvoiceID],
        [ReturnInvoiceID],
        [PaymentSubjectID],
        [PettyCashCostItemID],
        [ProformaInvoiceID],
        [ConfirmStatementID],
        [ConfirmStatementItemID],
        [ContractID],
        [ContractStatementID],
        [Description],
        [Description2],
        [CurrencyID],
        [CurrencyRate],
        [Amount],
        [Discount],
        [Version],
        [Creator],
        [CreationDate],
        [LastEditor],
        [LastEditionDate],
        [PettyCashID],
        [Allocation],
        [ConfirmPurchaseInvoiceID],
        [ConfirmPurchaseInvoiceItemID],
        [PayPreparingID]
    )
    SELECT @DebitCreditNoteID,
           @Type,
           @RowIndex,
           @ReceiptTypeID,
           @PaymentTypeID,
           @PartyID,
           @ReceiveSubjectID,
           @DebitCreditID,
           @PurchaseInvoiceID,
           @ReturnedSaleInvoiceID,
           @InstallmentPaymentItemID,
           @PurchaseContractID,
           @ProposalID,
           @CalculationResultID,
           @SaleContractID,
           @QuotationID,
           @InvoiceID,
           @ReturnInvoiceID,
           @PaymentSubjectID,
           @PettyCashCostItemID,
           @ProformaInvoiceID,
           @ConfirmStatementID,
           @ConfirmStatementItemID,
           @ContractID,
           @ContractStatementID,
           @Description,
           @Description2,
           @CurrencyID,
           @CurrencyRate,
           @Amount,
           @Discount,
           0,
           @Creator,
           @CreationDate,
           @LastEditor,
           @LastEditionDate,
           @PettyCashID,
           @Allocation,
           @ConfirmPurchaseInvoiceID,
           @ConfirmPurchaseInvoiceItemID,
           @PayPreparingID

    -- Begin Return Select <- do not remove
    SELECT  [DebitCreditNoteItemID],
            [Version]
    FROM [CFG].[DebitCreditNoteItem]
    WHERE [DebitCreditNoteItemID] = SCOPE_IDENTITY();
    -- End Return Select <- do not remove

    DECLARE @Remain DECIMAL(30, 4),
            @Number NVARCHAR(100),
            @Message NVARCHAR(MAX) = NULL,
            @Index SMALLINT;

    IF (@ReceiveSubjectID IS NOT NULL)
    BEGIN
        SELECT @Remain = rs.NonPrice,
               @Number = CAST(r.Number AS NVARCHAR(100))
        FROM FIN.ReceiveSubject s
            JOIN FIN.ReceiveReceipt r
                ON s.ReceiveReceiptID = r.ReceiveReceiptID
            JOIN FIN.ReceiveSubject_PriceRemains rs
                ON s.ReceiveSubjectID = rs.ReceiveSubjectID
        WHERE s.ReceiveSubjectID = @ReceiveSubjectID;

        IF (@Remain < 0)
        BEGIN
            SET @Message = N'ReceiveSubjectRemainWillBeNegative^' + @Number;
        END;
    END;

    IF (@DebitCreditID IS NOT NULL)
    BEGIN
        IF (@Type = 0)
        BEGIN
            SELECT @Remain = r.remain,
                   @Number = CAST(dc.Number AS NVARCHAR(100))
            FROM CFG.DebitCreditNoteItem i
                JOIN CFG.DebitCreditNote dc
                    ON i.DebitCreditNoteID = dc.DebitCreditNoteID
                JOIN CFG.Credit_DebitCreditNoteItem_Remain r
                    ON r.DebitCreditNoteItemID = i.DebitCreditNoteItemID
            WHERE i.DebitCreditNoteItemID = @DebitCreditID;

            IF (@Remain < 0)
            BEGIN
                SET @Message = N'CreditRemainOfDebitCreditNoteWillBeNegative^' + @Number;
            END;
        END;
        IF (@Type = 1)
        BEGIN
            SELECT @Remain = r.remain,
                   @Number = CAST(dc.Number AS NVARCHAR(100))
            FROM CFG.DebitCreditNoteItem i
                JOIN CFG.DebitCreditNote dc
                    ON i.DebitCreditNoteID = dc.DebitCreditNoteID
                JOIN CFG.Debit_DebitCreditNoteItem_Remain r
                    ON r.DebitCreditNoteItemID = i.DebitCreditNoteItemID
            WHERE i.DebitCreditNoteItemID = @DebitCreditID;

            IF (@Remain < 0)
            BEGIN
                SET @Message = N'DebitRemainOfDebitCreditNoteWillBeNegative^' + @Number;
            END;
        END;
    END;

    IF (@PurchaseInvoiceID IS NOT NULL)
    BEGIN
        SELECT @Remain = r.NonPaymented,
               @Number = CAST(p.Number AS NVARCHAR(100))
        FROM VND.PurchaseInvoice p
            JOIN VND.PurchaseInvoice_NonPaymented r
                ON p.PurchaseInvoiceID = r.PurchaseInvoiceID
        WHERE p.PurchaseInvoiceID = @PurchaseInvoiceID;

        IF (@Type = 0)
        BEGIN
            IF (@Remain < 0)
            BEGIN
                SET @Message = N'PurchaseInvoiceDocumentRemainWillBeNegative^' + @Number;
            END;
        END;

        IF (@Type = 1)
        BEGIN
            IF (@Remain > 0)
            BEGIN
                SET @Message = N'PurchaseInvoiceRemainWillBePositive^' + @Number;
            END;
        END;
    END;

    IF (@ReturnedSaleInvoiceID IS NOT NULL)
    BEGIN
        SELECT @Remain = r.NonPaymented,
               @Number = CAST(i.Number AS NVARCHAR(100))
        FROM SLE.ReturnedSaleInvoice i
            JOIN SLE.ReturnedSaleInvoice_NonPaymented r
                ON r.ReturnedSaleInvoiceID = i.ReturnedSaleInvoiceID
        WHERE i.ReturnedSaleInvoiceID = @ReturnedSaleInvoiceID;

        IF (@Remain < 0)
        BEGIN
            SET @Message = N'ReturnSaleRemainWillBeNegative^' + @Number;
        END;
    END;

    IF (@InstallmentPaymentItemID IS NOT NULL)
    BEGIN
        SELECT @Remain = r.remain,
               @Number = CAST(i.Number AS NVARCHAR(100))
        FROM CFG.InstallmentPaymentItem i
            JOIN CFG.vwInstallmentPaymentRemain r
                ON i.InstallmentPaymentItemID = r.InstallmentPaymentItemID
        WHERE i.InstallmentPaymentItemID = @InstallmentPaymentItemID;

        IF (@Remain < 0)
        BEGIN
            SET @Message = N'InstallmentRemainWillBeNegative^' + @Number;
        END;
    END;

    IF (@PurchaseContractID IS NOT NULL)
    BEGIN
        SELECT @Remain = pc.NonPaymented,
               @Number = CAST(c.Number AS NVARCHAR(100))
        FROM VND.PurchaseContract c
            JOIN VND.PurchaseContract_NonPaymented pc
                ON c.PurchaseContractID = pc.PurchaseContractID
        WHERE c.PurchaseContractID = @PurchaseContractID;

        IF (@Remain < 0)
        BEGIN
            SET @Message = N'PurchaseContractRemainWillBeNegative^' + @Number;
        END;
    END;

    IF (@ProposalID IS NOT NULL)
    BEGIN
        SELECT @Remain = r.NonPaymented,
               @Number = CAST(p.Number AS NVARCHAR(100))
        FROM VND.Proposal p
            JOIN VND.Proposal_NonPaymented r
                ON p.ProposalID = r.ProposalID
        WHERE p.ProposalID = @ProposalID;

        IF (@Remain < 0)
        BEGIN
            SET @Message = N'ProposalRemainWillBeNegative^' + @Number;
        END;
    END;

    IF (@CalculationResultID IS NOT NULL)
    BEGIN
        SELECT @Remain = r.Remain,
               @Number
                   = CAST(cal.Year AS VARCHAR(100)) + N' ' + cm.MonthName + N' ' + pa.Title + N' '
                     + ISNULL(pa.LastName, '')
        FROM PAY.CalculationResult c
            JOIN PAY.CalculationPersonel AS cp
                ON c.CalculationPersonelID = cp.CalculationPersonelID
            JOIN HRM.CalendarMonth cm
                ON cp.CalendarMonthID = cm.CalendarMonthID
            JOIN HRM.Calendar cal
                ON cm.CalendarID = cal.CalendarID
            JOIN HRM.Personel pe
                ON pe.PersonelID = cp.PersonelID
            JOIN CFG.Party pa
                ON pa.PartyID = pe.PartyID
            JOIN PAY.CalculationResult_NonPayment r
                ON c.CalculationResultID = r.CalculationResultID
        WHERE c.CalculationResultID = @CalculationResultID;

        IF (@Remain < 0)
        BEGIN
            SET @Message = N'SalaryUnpaidRemainWillBeNegative^' + @Number;
        END;
    END;

    IF (@SaleContractID IS NOT NULL)
    BEGIN
        SELECT @Remain = r.UnpaidBalance,
               @Number = CAST(s.Number AS NVARCHAR(100))
        FROM SLE.SaleContract s
            JOIN SLE.SaleContract_UnpaidBalance r
                ON s.SaleContractID = r.SaleContractID
        WHERE s.SaleContractID = @SaleContractID;

        IF (@Remain < 0)
        BEGIN
            SET @Message = N'SaleContractRemainWillBeNegative^' + @Number;
        END;
    END;

    IF (@QuotationID IS NOT NULL)
    BEGIN
        SELECT @Remain = r.UnpaidBalance,
               @Number = CAST(q.Number AS NVARCHAR(100))
        FROM SLE.Quotation q
            JOIN SLE.Quotation_UnpaidBalance r
                ON q.QuotationID = r.QuotationID
        WHERE q.QuotationID = @QuotationID;

        IF (@Remain < 0)
        BEGIN
            SET @Message = N'QuotationRemainWillBeNegative^' + @Number;
        END;
    END;

    IF (@InvoiceID IS NOT NULL)
    BEGIN
        SELECT @Remain = r.NonReceived,
               @Number = CAST(i.Number AS NVARCHAR(100))
        FROM SLE.Invoice i
            JOIN SLE.Invoice_NonReceived r
                ON i.InvoiceID = r.InvoiceID
        WHERE i.InvoiceID = @InvoiceID;

        IF (@Type = 0)
        BEGIN
            IF (@Remain > 0)
            BEGIN
                SET @Message = N'InvoiceRemainWillBePositive^' + @Number;
            END;
        END;
        IF (@Type = 1)
        BEGIN
            IF (@Remain < 0)
            BEGIN
                SET @Message = N'InvoiceRemainWillBeNegative^' + @Number;
            END;
        END;
    END;

    IF (@ReturnInvoiceID IS NOT NULL)
    BEGIN
        SELECT @Remain = r.NonReceived,
               @Number = CAST(i.Number AS NVARCHAR(100))
        FROM VND.ReturnInvoice i
            JOIN VND.ReturnInvoice_NonReceived r
                ON i.ReturnInvoiceID = r.ReturnInvoiceID
        WHERE i.ReturnInvoiceID = @ReturnInvoiceID;

        IF (@Remain < 0)
        BEGIN
            SET @Message = N'ReturnInvoiceRemainWillBeNegative^' + @Number;
        END;
    END;

    IF (@PaymentSubjectID IS NOT NULL)
    BEGIN
        SELECT @Remain = ps.NonPrice,
               @Number = CAST(p.Number AS NVARCHAR(100))
        FROM FIN.PaymentSubject s
            JOIN FIN.PaymentReceipt p
                ON s.PaymentReceiptID = p.PaymentReceiptID
            JOIN FIN.PaymentSubject_PriceRemains ps
                ON s.PaymentSubjectID = ps.PaymentSubjectID
        WHERE s.PaymentSubjectID = @PaymentSubjectID;

        IF (@Remain < 0)
        BEGIN
            SET @Message = N'PaymentSubjectRemainWillBeNegative^' + @Number;
        END;
    END;

    IF (@PettyCashCostItemID IS NOT NULL)
    BEGIN
        SELECT @Remain = r.remain,
               @Number = CAST(p.Number AS NVARCHAR(100)),
               @Index = i.RowIndex
        FROM FIN.PettyCashCostItem i
            JOIN FIN.PettyCashCost p
                ON i.PettyCashCostID = p.PettyCashCostID
            JOIN FIN.PettyCashCostItem_Remain r
                ON i.PettyCashCostItemID = r.PettyCashCostItemID
        WHERE i.PettyCashCostItemID = @PettyCashCostItemID;

        IF (@Remain < 0)
        BEGIN
            SET @Message = N'PettyCashCostItemRemainWillBeNegative^' + @Index + @Number;
        END;
    END;

    IF (@ProformaInvoiceID IS NOT NULL)
    BEGIN
        SELECT @Remain = r.Remain,
               @Number = p.Number
        FROM FOS.ProformaInvoice p
            JOIN FOS.ProformaInvoice_Remain r
                ON p.ProformaInvoiceID = r.ProformaInvoiceID
        WHERE p.ProformaInvoiceID = @ProformaInvoiceID;

        IF (@Remain < 0)
        BEGIN
            SET @Message = N'ProformaInvoiceRemainWillBeNegative^' + @Number;
        END;
    END;

    IF (@ConfirmStatementID IS NOT NULL)
    BEGIN
        SELECT @Remain = vw.Remain,
               @Number = c.Number
        FROM CNT.ConfirmStatement cs
            JOIN CNT.[Contract] c
                ON cs.ContractID = c.ContractID
            JOIN CNT.vwConfirmStatementRemain vw
                ON cs.ConfirmStatementID = vw.ConfirmStatementID
        WHERE cs.ConfirmStatementID = @ConfirmStatementID;

        IF (@Remain < 0)
        BEGIN
            SET @Message = N'ConfirmStatementDocumentRemainWillBeNegative^' + @Number;
        END;
    END;

    IF (@ConfirmStatementItemID IS NOT NULL)
    BEGIN
        SELECT @Remain = vw.Remain,
               @Number = c.Number
        FROM CNT.ConfirmStatementItem csi
            JOIN CNT.ConfirmStatement cs
                ON csi.ConfirmStatementID = cs.ConfirmStatementID
            JOIN CNT.[Contract] c
                ON cs.ContractID = c.ContractID
            JOIN CNT.vwConfirmStatementRemain vw
                ON cs.ConfirmStatementID = vw.ConfirmStatementID
        WHERE csi.ConfirmStatementItemID = @ConfirmStatementItemID;

        IF (@Remain < 0)
        BEGIN
            SET @Message = N'ConfirmStatementItemDocumentRemainWillBeNegative^' + @Index;
        END;
    END;

    IF (@ContractID IS NOT NULL)
    BEGIN
        SELECT @Remain = vw.Remain,
               @Number = c.Number
        FROM CNT.[Contract] c
            JOIN CNT.vwContractRemain vw
                ON c.ContractID = vw.ContractID
        WHERE c.ContractID = @ContractID;

        IF (@Remain < 0)
        BEGIN
            SET @Message = N'ContractDocumentRemainWillBeNegative^' + @Number;
        END;
    END;

    IF (@ContractStatementID IS NOT NULL)
    BEGIN
        SELECT @Remain = vw.VatRemain,
               @Number = c.Number
        FROM CNT.ContractStatement cs
            JOIN CNT.[Contract] c
                ON cs.ContractID = c.ContractID
            JOIN CNT.vwContractStatementRemain vw
                ON cs.ContractStatementID = vw.ContractStatementID
        WHERE cs.ContractStatementID = @ContractStatementID;

        IF (@Remain < 0)
        BEGIN
            SET @Message = N'ContractStatementDocumentRemainWillBeNegative^' + @Number;
        END;
    END;

    IF (@Message IS NOT NULL)
    BEGIN
        RAISERROR(@Message, 16, 12);
        RETURN;
    END;

