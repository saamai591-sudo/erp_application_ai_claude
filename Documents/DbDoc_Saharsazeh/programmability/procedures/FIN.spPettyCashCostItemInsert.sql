-------------------------------------
CREATE   PROC [FIN].[spPettyCashCostItemInsert]
	@PettyCashCostID INT,
	@RowIndex INT,
	@Date DATE,
	@TraceNumber NVARCHAR(50),
	@Amount DECIMAL(30, 4),
	@Description NVARCHAR(MAX),
	@Description2 NVARCHAR(MAX),
	@PaymentTypeID INT,
	@PurchaseInvoiceID INT,
	@PayPreparingID INT,
	@ReturnedSaleInvoiceID INT,
	@InstallmentPaymentItemID INT,
	@PurchaseContractID INT,
	@ProposalID INT,
	@InvoiceID INT,
	@PartyID BIGINT,
	@Creator INT,
	@CreationDate DATETIME,
	@LastEditor INT,
	@LastEditionDate DATETIME,
	@PettyCashID INT = NULL,
	@Allocation DECIMAL(36, 10),
	@ConfirmPurchaseInvoiceID INT = null,
	@ConfirmPurchaseInvoiceItemID INT = NULL
--WITH ENCRYPTION
AS
SET NOCOUNT ON;

	DECLARE @AnnouncedInAdditionalValue BIT,
			@PettyCashCostDate DATE,
			@FinancialPeriodID INT;

	SELECT @AnnouncedInAdditionalValue = AnnouncedInAdditionalValue
	FROM FIN.PaymentType
	WHERE PaymentTypeID = @PaymentTypeID;

	SELECT @PettyCashCostDate = [Date],
		   @FinancialPeriodID = FinancialPeriodID
	FROM FIN.PettyCashCost
	WHERE PettyCashCostID = @PettyCashCostID;

	IF (@AnnouncedInAdditionalValue = 1)
	BEGIN
		EXEC CFG.CheckWithVatAndSeason @Date = @PettyCashCostDate,              -- date
									   @FinancialPeriodId = @FinancialPeriodID; -- int
	END;

	INSERT INTO [FIN].[PettyCashCostItem]
	(
		[PettyCashCostID],
		[RowIndex],
		[Date],
		[TraceNumber],
		[Amount],
		[Description],
		[Description2],
		[PaymentTypeID],
		[PurchaseInvoiceID],
		[PayPreparingID],
		[ReturnedSaleInvoiceID],
		[InstallmentPaymentItemID],
		[PurchaseContractID],
		[ProposalID],
		[InvoiceID],
		[PartyID],
		[Version],
		[Creator],
		[CreationDate],
		[LastEditor],
		[LastEditionDate],
		[PettyCashID],
		[Allocation],
		[ConfirmPurchaseInvoiceID],
		[ConfirmPurchaseInvoiceItemID]
	)
	SELECT @PettyCashCostID,
		   @RowIndex,
		   @Date,
		   @TraceNumber,
		   @Amount,
		   @Description,
		   @Description2,
		   @PaymentTypeID,
		   @PurchaseInvoiceID,
		   @PayPreparingID,
		   @ReturnedSaleInvoiceID,
		   @InstallmentPaymentItemID,
		   @PurchaseContractID,
		   @ProposalID,
		   @InvoiceID,
		   @PartyID,
		   0,
		   @Creator,
		   @CreationDate,
		   @LastEditor,
		   @LastEditionDate,
		   @PettyCashID,
		   @Allocation,
		   @ConfirmPurchaseInvoiceID,
		   @ConfirmPurchaseInvoiceItemID;

	-- Begin Return Select <- do not remove
	SELECT [PettyCashCostItemID], [PettyCashCostID], [Version]
	FROM [FIN].[PettyCashCostItem]
	WHERE [PettyCashCostItemID] = SCOPE_IDENTITY();
	-- End Return Select <- do not remove

	DECLARE @Non_Payment DECIMAL(30, 4) = NULL,
			@Number VARCHAR(50) = NULL,
			@Message NVARCHAR(MAX) = NULL,
			@culture NVARCHAR(100) = CFG.GetuserCulture();

	IF (@PurchaseInvoiceID IS NOT NULL)
	BEGIN

		SELECT @Non_Payment = pa.NonPaymented,
			   @Number = p.Number
		FROM VND.PurchaseInvoice p
			JOIN VND.PurchaseInvoice_NonPaymented pa
				ON p.PurchaseInvoiceID = pa.PurchaseInvoiceID
		WHERE p.PurchaseInvoiceID = @PurchaseInvoiceID;

		IF (@Non_Payment < 0)
		BEGIN
			SELECT @Message = lsv.Value
			FROM CFG.LocalizationSQLMessage ls
				JOIN CFG.LocalizationSQLMessageValue lsv
					ON lsv.LocalizationSQLMessageID = ls.LocalizationSQLMessageID
			WHERE ls.SQLMessageCode = 'FIN_spPaymentSubjectInsert_2'
				  AND lsv.Culture = @culture;

			SET @Message = REPLACE(@Message, '{0}', @Number);
			RAISERROR(@Message, 16, 12);
			RETURN 0;
		--RAISERROR('مانده پرداخت نشده فاکتور خرید شماره (%s) منفی خواهد شد.',16,12,@Number)
		END;

	END;

	IF (@ReturnedSaleInvoiceID IS NOT NULL)
	BEGIN

		SELECT @Non_Payment = rsi.NonPaymented,
			   @Number = r.Number
		FROM SLE.ReturnedSaleInvoice r
			JOIN SLE.ReturnedSaleInvoice_NonPaymented rsi
				ON r.ReturnedSaleInvoiceID = rsi.ReturnedSaleInvoiceID
		WHERE r.ReturnedSaleInvoiceID = @ReturnedSaleInvoiceID;

		IF (@Non_Payment < 0)
		BEGIN
			SELECT @Message = lsv.Value
			FROM CFG.LocalizationSQLMessage ls
				JOIN CFG.LocalizationSQLMessageValue lsv
					ON lsv.LocalizationSQLMessageID = ls.LocalizationSQLMessageID
			WHERE ls.SQLMessageCode = 'FIN_spPaymentSubjectInsert_1'
				  AND lsv.Culture = @culture;

			SET @Message = REPLACE(@Message, '{0}', @Number);
			RAISERROR(@Message, 16, 12);
			RETURN 0;
		--RAISERROR('مانده پرداخت نشده سند برگشت فروش شماره (%s) منفی خواهد شد.',16,12,@Number)
		END;

	END;

	IF (@InstallmentPaymentItemID IS NOT NULL)
	BEGIN
		SELECT @Non_Payment = r.remain,
			   @Number = i.Number
		FROM CFG.InstallmentPaymentItem i
			JOIN CFG.vwInstallmentPaymentRemain r
				ON i.InstallmentPaymentItemID = r.InstallmentPaymentItemID
		WHERE i.InstallmentPaymentItemID = @InstallmentPaymentItemID;

		IF (@Non_Payment < 0)
		BEGIN
			SET @Message = N'مانده تسویه نشده قسط شماره {0} منفی خواهد شد.';

			SET @Message = REPLACE(@Message, '{0}', @Number);
			RAISERROR(@Message, 16, 12);
			RETURN 0;
		END;
	END;

	IF (@PurchaseContractID IS NOT NULL)
	BEGIN
		SELECT @Non_Payment = pc.NonPaymented,
			   @Number = c.Number
		FROM VND.PurchaseContract c
			JOIN VND.PurchaseContract_NonPaymented pc
				ON c.PurchaseContractID = pc.PurchaseContractID
		WHERE c.PurchaseContractID = @PurchaseContractID;

		IF (@Non_Payment < 0)
		BEGIN
			SET @Message = 'FinanceManager.Messages.NonReceivedOfPurchaseOrderWillBecomeNegative^' + CAST(@Number AS NVARCHAR(10));
			RAISERROR(@Message, 16, 12);
			RETURN 0;
		END;
	END;

	IF (@ProposalID IS NOT NULL)
	BEGIN
		SELECT @Non_Payment = pr.NonPaymented,
			   @Number = p.Number
		FROM VND.Proposal p
			JOIN VND.Proposal_NonPaymented pr
				ON p.ProposalID = pr.ProposalID
		WHERE p.ProposalID = @ProposalID;

		IF (@Non_Payment < 0)
		BEGIN
			SET @Message = N'مانده تسویه نشده استعلام قیمت شماره {0} منفی خواهد شد.';

			SET @Message = REPLACE(@Message, '{0}', @Number);
			RAISERROR(@Message, 16, 12);
			RETURN 0;
		END;
	END;

	IF (@InvoiceID IS NOT NULL)
	BEGIN

		SELECT @Non_Payment = r.NonReceived,
			   @Number = i.Number
		FROM SLE.Invoice i
			JOIN SLE.Invoice_NonReceived r
				ON i.InvoiceID = r.InvoiceID
		WHERE i.InvoiceID = @InvoiceID;

		IF (@Non_Payment > 0)
		BEGIN
			SELECT @Message = N'مانده تسویه نشده فاکتور فروش شماره {0} مثبت خواهد شد.';

			SET @Message = REPLACE(@Message, '{0}', @Number);
			RAISERROR(@Message, 16, 12);
		END;

	END;
