

CREATE    PROC NOC.spDataCollection
(
    @ReportagePeriodID INT,
    @Type TINYINT
)
--WITH ENCRYPTION
AS

	if @Type = 1
	and 
	exists(
	select 1 from pay.Parameter p
	join pay.Category c on p.CategoryID = c.CategoryID
	left join noc.FractionPayrollParameterSetting fpps
		on fpps.ParameterID = p.ParameterID
	where c.EngName ='Fraction'
	and isnull(p.SystemName,'') <> 'LOAN_SUM'
	and fpps.ParameterID is null
	)
	begin
		raiserror('برخی از عاملهای حقوق از نوع کسور، تعیین رفتار نشده اند',16,12)
		return 
	end	

DECLARE @StartDate DATE,
        @EndDate DATE,
        @ConfigValue VARCHAR(50),
        @user INT,
        @StartOfThePeriod DATE;

SET @user = CFG.GetuserID();

SELECT @EndDate = EndDate,
       @StartOfThePeriod = StartDate
FROM NOC.ReportagePeriod
WHERE ReportagePeriodID = @ReportagePeriodID;

SELECT TOP 1
       @StartDate = StartDate
FROM NOC.ReportagePeriod
ORDER BY StartDate;

DECLARE @DataCollectionID INT;

INSERT INTO [NOC].[DataCollection]
(
    [ReportagePeriodID],
    [Type],
    [Creator],
    [CreationDate],
    [LastEditor],
    [LastEditionDate],
    [Version]
)
SELECT @ReportagePeriodID,
       @Type,
       @user,
       GETDATE(),
       @user,
       GETDATE(),
       0;

SET @DataCollectionID = SCOPE_IDENTITY();

IF @Type = 2
BEGIN

    SELECT v.VoucherID
    INTO #Modification
    FROM NOC.Modification c
        LEFT JOIN
        (
            SELECT PrevoucherID,
                   VoucherID
            FROM ACC.VoucherPrevoucher
            GROUP BY PrevoucherID,
                     VoucherID
        ) vp
            ON vp.PrevoucherID = c.PreVoucherID
        LEFT JOIN ACC.Voucher v
            ON v.VoucherID = vp.VoucherID;

    SELECT @ConfigValue = ConfigValue
    FROM NOC.NIOCSetting
    WHERE ConfigKey = 'DocumentType';

    SELECT a.VoucherID
    INTO #Voucher
    FROM ACC.Voucher a
        JOIN ACC.VoucherItem b
            ON a.VoucherID = b.VoucherID
        JOIN NOC.ReportHeadline c
            ON b.SlID = c.SlID
        LEFT JOIN NOC.AccrueAnalysing d
            ON d.VoucherItemID = b.VoucherItemID
        LEFT JOIN #Modification e
            ON e.VoucherID = a.VoucherID
    WHERE Date <= @EndDate
          AND d.VoucherItemID IS NULL
          AND a.DocumentTypeID IN
              (
                  SELECT value FROM CFG.R_FnCommaStr2Table(@ConfigValue)
              )
          AND HasCashNature = 0
          AND e.VoucherID IS NULL
    GROUP BY a.VoucherID;


    INSERT INTO [NOC].[AccrueDataCollection]
    (
        [DataCollectionID],
        [VoucherID],
        [Creator],
        [CreationDate],
        [LastEditor],
        [LastEditionDate],
        [Version]
    )
    SELECT @DataCollectionID,
           [VoucherID],
           @user,
           GETDATE(),
           @user,
           GETDATE(),
           0
    FROM #Voucher;
END;

IF @Type = 1
BEGIN

    INSERT INTO [NOC].[CashDataCollection]
    (
        [DataCollectionID],
        [PaymentSubjectID],
        [DebitCreditNoteItemID],
        [PettyCashCostItemID],
        [Creator],
        [CreationDate],
        [LastEditor],
        [LastEditionDate],
        [Version],
        [PurchaseInvoicePrePaymentID],
        [VoucherID]
    )
    SELECT @DataCollectionID,
           a.[PaymentSubjectID],
           NULL,
           NULL,
           @user,
           GETDATE(),
           @user,
           GETDATE(),
           0,
           NULL,
           a.VoucherID
    FROM NOC.VwPaymentReceipt a
        LEFT JOIN [NOC].[CashDataCollection] c
            ON c.[PaymentSubjectID] = a.[PaymentSubjectID]
    WHERE EffectiveDate <= @EndDate
          AND c.[PaymentSubjectID] IS NULL;

    INSERT INTO [NOC].[CashDataCollection]
    (
        [DataCollectionID],
        [PaymentSubjectID],
        [DebitCreditNoteItemID],
        [PettyCashCostItemID],
        [Creator],
        [CreationDate],
        [LastEditor],
        [LastEditionDate],
        [Version],
        [PurchaseInvoicePrePaymentID],
        [VoucherID]
    )
    SELECT @DataCollectionID,
           NULL,
           a.DebitCreditNoteItemID,
           NULL,
           @user,
           GETDATE(),
           @user,
           GETDATE(),
           0,
           NULL,
           a.VoucherID
    FROM NOC.VwDebitCreditNote a
        LEFT JOIN [NOC].[CashDataCollection] c
            ON c.DebitCreditNoteItemID = a.DebitCreditNoteItemID
    WHERE EffectiveDate <= @EndDate
		  AND a.date <= @EndDate
          AND c.DebitCreditNoteItemID IS NULL



    INSERT INTO [NOC].[CashDataCollection]
    (
        [DataCollectionID],
        [PaymentSubjectID],
        [DebitCreditNoteItemID],
        [PettyCashCostItemID],
        [Creator],
        [CreationDate],
        [LastEditor],
        [LastEditionDate],
        [Version],
        [PurchaseInvoicePrePaymentID],
        [VoucherID]
    )
    SELECT @DataCollectionID,
           NULL,
           NULL,
           a.PettyCashCostItemID,
           @user,
           GETDATE(),
           @user,
           GETDATE(),
           0,
           NULL,
           a.VoucherID
    FROM NOC.VwPettyCashCost a
        LEFT JOIN [NOC].[CashDataCollection] c
            ON c.PettyCashCostItemID = a.PettyCashCostItemID
    WHERE EffectiveDate <= @EndDate
          AND c.PettyCashCostItemID IS NULL;

    INSERT INTO [NOC].[CashDataCollection]
    (
        [DataCollectionID],
        [PaymentSubjectID],
        [DebitCreditNoteItemID],
        [PettyCashCostItemID],
        [Creator],
        [CreationDate],
        [LastEditor],
        [LastEditionDate],
        [Version],
        [PurchaseInvoicePrePaymentID],
        [VoucherID]
    )
    SELECT @DataCollectionID,
           NULL,
           NULL,
           NULL,
           @user,
           GETDATE(),
           @user,
           GETDATE(),
           0,
           a.PurchaseInvoicePrePaymentID,
           a.VoucherID
    FROM NOC.VWPurchaseInvoicePrePayment a
        JOIN NOC.VWPurchaseInvoicePrePaymentSlPortion b
            ON a.PurchaseInvoicePrePaymentID = b.PurchaseInvoicePrePaymentID
        JOIN NOC.ReportHeadline c
            ON c.SlID = b.SlID
        LEFT JOIN [NOC].[CashDataCollection] d
            ON d.PurchaseInvoicePrePaymentID = a.PurchaseInvoicePrePaymentID
    WHERE VoucherDate <= @EndDate
          AND d.PurchaseInvoicePrePaymentID IS NULL
    GROUP BY a.PurchaseInvoicePrePaymentID,
             a.VoucherID;


    INSERT INTO [NOC].[CashDataCollection]
    (
        [DataCollectionID],
        [PaymentSubjectID],
        [DebitCreditNoteItemID],
        [PettyCashCostItemID],
        [Creator],
        [CreationDate],
        [LastEditor],
        [LastEditionDate],
        [Version],
        [ConfirmPurchaseInvoiceAdvancePaymentID],
        [VoucherID]
    )
    SELECT @DataCollectionID,
           NULL,
           NULL,
           NULL,
           @user,
           GETDATE(),
           @user,
           GETDATE(),
           0,
           a.ConfirmPurchaseInvoiceAdvancePaymentID,
           a.VoucherID
    FROM NOC.VWConfirmPurchaseInvoiceAdvancePayment a
        JOIN NOC.VWConfirmPurchaseInvoiceAdvancePaymentSlPortion b
            ON a.ConfirmPurchaseInvoiceAdvancePaymentID = b.ConfirmPurchaseInvoiceAdvancePaymentID
        JOIN NOC.ReportHeadline c
            ON c.SlID = b.SlID
        LEFT JOIN [NOC].[CashDataCollection] d
            ON d.ConfirmPurchaseInvoiceAdvancePaymentID = a.ConfirmPurchaseInvoiceAdvancePaymentID
    WHERE VoucherDate <= @EndDate
          AND d.ConfirmPurchaseInvoiceAdvancePaymentID IS NULL
    GROUP BY a.ConfirmPurchaseInvoiceAdvancePaymentID,
             a.VoucherID;

    INSERT INTO [NOC].[CashDataCollection]
    (
        [DataCollectionID],
        [PaymentSubjectID],
        [DebitCreditNoteItemID],
        [PettyCashCostItemID],
        [Creator],
        [CreationDate],
        [LastEditor],
        [LastEditionDate],
        [Version],
        [PurchaseInvoicePrePaymentID],
        [VoucherID],
        [ConfirmStatementPrePaymentID]
    )
    SELECT @DataCollectionID,
           NULL,
           NULL,
           NULL,
           @user,
           GETDATE(),
           @user,
           GETDATE(),
           0,
           NULL,
           a.VoucherID,
           a.ConfirmStatementPrePaymentID
    FROM NOC.VwConfirmStatementItem a
        JOIN NOC.VWConfirmStatementItemPortion po
            ON po.ConfirmStatementPrePaymentID = a.ConfirmStatementPrePaymentID
        JOIN NOC.ReportHeadline d
            ON po.SlID = d.SlID
        LEFT JOIN [NOC].[CashDataCollection] e
            ON e.ConfirmStatementPrePaymentID = a.ConfirmStatementPrePaymentID
    WHERE VoucherDate <= @EndDate
          AND e.ConfirmStatementPrePaymentID IS NULL
    GROUP BY a.ConfirmStatementPrePaymentID,
             a.VoucherID;

    INSERT INTO [NOC].[CashDataCollection]
    (
        [DataCollectionID],
        [PaymentSubjectID],
        [DebitCreditNoteItemID],
        [PettyCashCostItemID],
        [Creator],
        [CreationDate],
        [LastEditor],
        [LastEditionDate],
        [Version],
        [PurchaseInvoicePrePaymentID],
        [VoucherID],
        CalculationResultID
    )
    SELECT @DataCollectionID,
           NULL,
           NULL,
           NULL,
           @user,
           GETDATE(),
           @user,
           GETDATE(),
           0,
           NULL,
           a.VoucherID,
           a.CalculationResultID
    FROM [NOC].[FnAdvanceDepreciation]() a
        LEFT JOIN [NOC].[CashDataCollection] e
            ON a.CalculationResultID = e.CalculationResultID
    WHERE a.EndDate <= @EndDate
          AND e.CalculationResultID IS NULL


    INSERT INTO [NOC].[CashDataCollection]
    (
        [DataCollectionID],
        [PaymentSubjectID],
        [DebitCreditNoteItemID],
        [PettyCashCostItemID],
        [Creator],
        [CreationDate],
        [LastEditor],
        [LastEditionDate],
        [Version],
        [PurchaseInvoicePrePaymentID],
        [VoucherID],
        ReceiveSubjectID
    )
    SELECT @DataCollectionID,
           NULL,
           NULL,
           NULL,
           @user,
           GETDATE(),
           @user,
           GETDATE(),
           0,
           NULL,
           a.VoucherID,
           a.ReceiveSubjectID
    FROM NOC.VwReceiveReceipt a
        LEFT JOIN [NOC].[CashDataCollection] c
            ON c.ReceiveSubjectID = a.ReceiveSubjectID
    WHERE EffectiveDate <= @EndDate
          AND c.ReceiveSubjectID IS NULL;


    INSERT INTO [NOC].[CashDataCollection]
    (
        [DataCollectionID],
        [PaymentSubjectID],
        [DebitCreditNoteItemID],
        [PettyCashCostItemID],
        [Creator],
        [CreationDate],
        [LastEditor],
        [LastEditionDate],
        [Version],
        [PurchaseInvoicePrePaymentID],
        [VoucherID],
        [CalculationResultID],
        [ReceiveSubjectID],
        [ConfirmStatementPrePaymentID],
        [ConfirmStatementItemID]
    )
    SELECT @DataCollectionID,
           NULL,
           NULL,
           NULL,
           @user,
           GETDATE(),
           @user,
           GETDATE(),
           0,
           NULL,
           a.[VoucherID],
           NULL,
           NULL,
           NULL,
           a.[ConfirmStatementItemID]
    FROM NOC.VwDepreciatedDeductionInConfirmStatement a
        LEFT JOIN [NOC].[CashDataCollection] c
            ON c.[ConfirmStatementItemID] = a.[ConfirmStatementItemID]
    WHERE a.EffectiveDate <= @EndDate
          AND c.[ConfirmStatementItemID] IS NULL;

	create table #T
	(
	DestructionItemID int,
	EffectiveDate Date,
	DocumentNumber int,
	ReferenceNumber int,
	VoucherID int,
	VoucherDate Date,
	Amount decimal(36,10),
	PreVoucherID int,
	AssetCategoryID int,
	DlID int
	)
	insert into #T
	exec NOC.SpGetDestructionItem
	
    INSERT INTO [NOC].[CashDataCollection]
    (
        [DataCollectionID],
        [Creator],
        [CreationDate],
        [LastEditor],
        [LastEditionDate],
        [Version],
        [VoucherID],
        [DestructionItemID]
    )
    SELECT @DataCollectionID,
           @user,
           GETDATE(),
           @user,
           GETDATE(),
           0,
           a.[VoucherID],
           a.[DestructionItemID]
    FROM #T a
        LEFT JOIN [NOC].[CashDataCollection] c
            ON c.DestructionItemID = a.DestructionItemID
    WHERE a.EffectiveDate <= @EndDate
          AND c.DestructionItemID IS NULL;

END;
