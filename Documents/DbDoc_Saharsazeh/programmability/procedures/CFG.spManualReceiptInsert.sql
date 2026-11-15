
--==============================================Alter spManualReceiptInsert
CREATE   PROC [CFG].spManualReceiptInsert
    @FinancialPeriodID INT,
    @BranchID INT,
    @PartyID BIGINT,
    @CurrencyID INT,
    @ManualReceiptType TINYINT,
    @ManualReceiptSubject TINYINT,
    @InstallmentPaymentItemID INT,
    @PurchaseInvoiceID INT,
    @InvoiceID INT,
    @ReturnedSaleInvoiceID INT,
    @ReturnInvoiceID INT,
    @CalculationResultID DECIMAL(18,0),
    @Number INT,
    @Date DATE,
    @Amount DECIMAL(18, 4),
    @Description NVARCHAR(1024),
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME,
	@SaleContractID INT
AS 
    SET NOCOUNT ON 

    IF @Amount <= 0
    BEGIN
        RAISERROR('مبلغ وارد شده معتبر نمی باشد', 16, 12)
        RETURN
    END

    DECLARE 
		@CompanyID INT,
        @Id INT

	SELECT 
		@CompanyID = b.CompanyID 
	FROM 
		CFG.Branch b 
	WHERE 
		b.BranchID = @BranchID
	
	IF(@Number = 0 OR @Number IS NULL)
	SET 
		@Number = ISNULL(
						(SELECT 
							MAX(Number) + 1
                         FROM 
							CFG.ManualReceipt mr
						 JOIN 
							CFG.Branch b 
						 ON 
							mr.BranchID = b.BranchID
						 WHERE 
							mr.FinancialPeriodID = @FinancialPeriodID AND 
							b.CompanyID = @CompanyID)
						, 1) 
    INSERT INTO 
        [CFG].[ManualReceipt]
	(
        [FinancialPeriodID],
        [BranchID],
        PartyID, 
        CurrencyID, 
        ManualReceiptType,
        ManualReceiptSubject,
        [InstallmentPaymentItemID],
        PurchaseInvoiceID, 
        InvoiceID, 
        ReturnedSaleInvoiceID,
        ReturnInvoiceID,
        CalculationResultID,
        [Number],
        [Date],
        [Amount],
        [Description],
        [Version],
        [Creator],
        [CreationDate],
        [LastEditor],
        [LastEditionDate],
	    [SaleContractID]
	)
    SELECT 
        @FinancialPeriodID,
        @BranchID,
        @PartyID,
        @CurrencyID,
        @ManualReceiptType,
        @ManualReceiptSubject,
        @InstallmentPaymentItemID,
        @PurchaseInvoiceID,
        @InvoiceID,
        @ReturnedSaleInvoiceID,
        @ReturnInvoiceID,
        @CalculationResultID,
        @Number,
        @Date,
        @Amount,
        @Description,
        0,
        @Creator,
        @CreationDate,
        @LastEditor,
        @LastEditionDate,
	    @SaleContractID

    SET 
        @Id=SCOPE_IDENTITY()	

    -- Begin Return Select <- do not remove
    SELECT 
		[ManualReceiptID],
		[Version],
        [Number]
    FROM   
		[CFG].[ManualReceipt]
    WHERE  
		[ManualReceiptID] = @id
    -- End Return Select <- do not remove
       
     EXEC  
        Cfg.CheckManualReceipt @ID
