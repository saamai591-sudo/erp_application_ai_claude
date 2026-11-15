
--==============================================Alter spManualReceiptUpdate
CREATE   PROC [CFG].spManualReceiptUpdate
    @ManualReceiptID INT,
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
    @Version INT,
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
		@CompanyID INT

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

    IF @Version = (SELECT [Version]
                   FROM   [CFG].[ManualReceipt]
                   WHERE  [ManualReceiptID] = @ManualReceiptID)
    BEGIN
        SET 
            @Version = @Version + 1 
    
        UPDATE 
            [CFG].[ManualReceipt]
        SET    
            [FinancialPeriodID] = @FinancialPeriodID,
            [BranchID] = @BranchID,
            PartyID = @PartyID,
            CurrencyID = @CurrencyID,
            ManualReceiptType =@ManualReceiptType,
            ManualReceiptSubject = @ManualReceiptSubject,
            PurchaseInvoiceID =@PurchaseInvoiceID,
            InvoiceID = @InvoiceID,
            ReturnedSaleInvoiceID = @ReturnedSaleInvoiceID,
            ReturnInvoiceID = @ReturnInvoiceID,
            CalculationResultID =@CalculationResultID,
            [InstallmentPaymentItemID] = @InstallmentPaymentItemID,
            [Number] = @Number,
            [Date] = @Date,
            [Amount] = @Amount,
            [Description] = @Description,
            [Version] = @Version,
            [Creator] = @Creator,
            [CreationDate] = @CreationDate,
            [LastEditor] = @LastEditor,
            [LastEditionDate] = @LastEditionDate,
		    SaleContractID = @SaleContractID
        WHERE  
            [ManualReceiptID] = @ManualReceiptID
    
       EXEC  
            Cfg.CheckManualReceipt @ManualReceiptID
   
       -- Begin Return Select <- do not remove
       SELECT 
			[Version],
            [Number]
       FROM   
			[CFG].[ManualReceipt]
       WHERE  
			[ManualReceiptID] = @ManualReceiptID 
       -- End Return Select <- do not remove
    END
