-------------------------------------
CREATE     PROC [VND].spPurchaseInvoiceItemUpdate
    @PurchaseInvoiceItemID INT ,
    @PurchaseInvoiceID INT ,
    @RowIndex SMALLINT ,
    @PurchaseRequestItemID INT ,
    @ContractSubjectID INT ,
    @ProposalItemID INT ,
    @StuffID INT ,
    @MainQuantity DECIMAL(36, 10) ,
    @SubQuantity DECIMAL(36, 10) ,
    @Fee DECIMAL(36, 10) ,
    @Price DECIMAL(36, 10) ,
    @Discount DECIMAL(36, 10) ,
    @Tax DECIMAL(36, 10) ,
    @Duty DECIMAL(36, 10) ,
    @Net DECIMAL(36, 10) ,
    @Description NVARCHAR(MAX) ,
    @Description2 NVARCHAR(MAX) ,
    @LastEditor INT ,
    @LastEditionDate DATETIME ,
    @Version INT ,
    @StockReceiptItemID INT ,
    @PurchaseContractItemID INT ,
    @AllocationSharingAmount DECIMAL(36, 10) ,
    @ProformaInvoiceItemID INT,
	@IsVatPartOfCost bit,
    @AssetReceiptItemID INT

--WITH ENCRYPTION
AS
    SET NOCOUNT ON;

        DECLARE @Message NVARCHAR(MAX),
                @CompanyId INT,
                @FinancialPeriodId INT,
                @maxDate DATE,
                @date DATE,
                @BranchID INT ;

        SELECT @FinancialPeriodId = pi.FinancialPeriodID , @date = pi.[Date], @CompanyId = b.CompanyID
        FROM [VND].[PurchaseInvoice] pi
        JOIN CFG.Branch b ON pi.BranchID = b.BranchID     
        WHERE PurchaseInvoiceID = @PurchaseInvoiceID

        SELECT @maxDate = MAX(EndDate)
        FROM   CFG.Vat v 
        WHERE v.FinancialPeriodID = @FinancialPeriodId
        AND v.CompanyID = @CompanyId

        IF ( @maxDate IS NOT NULL AND  @maxDate >= @date )
            BEGIN
                RAISERROR('VatHasPublished', 16, 12);
                RETURN;
            END;

        DECLARE @PrePurchaseRequestItemID INT ,
                @PreMainQuantity DECIMAL(36, 10) ,
                @PreSubQuantity DECIMAL(36, 10) ,
                @PreVersion INT ,
                @StuffCode NVARCHAR(256) ,
                @prePrevoucherID INT;

        SELECT @PreVersion = pil.[Version] ,
               @PrePurchaseRequestItemID = PurchaseRequestItemID ,
               @PreMainQuantity = MainQuantity ,
               @PreSubQuantity = SubQuantity ,
               @prePrevoucherID = pi1.PreVoucherID
        FROM   [VND].[PurchaseInvoiceItem] pil
               JOIN VND.PurchaseInvoice pi1 ON pi1.PurchaseInvoiceID = pil.PurchaseInvoiceID
        WHERE  [PurchaseInvoiceItemID] = @PurchaseInvoiceItemID;

        IF @Version <> @PreVersion
           OR @prePrevoucherID IS NOT NULL
            RAISERROR('Version mismatch...', 16, 10);


        UPDATE [VND].[PurchaseInvoiceItem]
        SET    [RowIndex] = @RowIndex ,
               [PurchaseRequestItemID] = @PurchaseRequestItemID ,
               [ContractSubjectID] = @ContractSubjectID ,
               [ProposalItemID] = @ProposalItemID ,
               [StuffID] = @StuffID ,
               [MainQuantity] = @MainQuantity ,
               [SubQuantity] = @SubQuantity ,
               [Fee] = @Fee ,
               [Price] = @Price ,
               [Discount] = @Discount ,
               [Tax] = @Tax ,
               [Duty] = @Duty ,
               [Net] = @Net ,
               [Description] = @Description ,
               [Description2] = @Description2 ,
               [LastEditor] = @LastEditor ,
               [LastEditionDate] = @LastEditionDate ,
               [Version] = @Version + 1 ,
               [StockReceiptItemID] = @StockReceiptItemID ,
               [PurchaseContractItemID] = @PurchaseContractItemID ,
               [AllocationSharingAmount] = @AllocationSharingAmount ,
               [ProformaInvoiceItemID] = @ProformaInvoiceItemID,
			   [IsVatPartOfCost] = @IsVatPartOfCost,
               [AssetReceiptItemID] = @AssetReceiptItemID
        WHERE  [PurchaseInvoiceItemID] = @PurchaseInvoiceItemID;

		IF @StockReceiptItemID IS NOT NULL
           AND EXISTS (
                SELECT 1
                FROM   STC.StockReceipt_Remains
                WHERE  StockReceiptItemID = @StockReceiptItemID
                       AND DoMainQuantity > MainQuantity
           )
        BEGIN
            RAISERROR('StockReceiptUninvoicedRemainCannotBeNegative', 16, 12);
            RETURN;
        END;

        IF @AssetReceiptItemID IS NOT NULL
           AND EXISTS (
                SELECT 1
                FROM   AST.AssetReceiptItem_PurchaseInvoice_Remains
                WHERE  AssetReceiptItemID = @AssetReceiptItemID
                       AND Non < 0
           )
        BEGIN
            RAISERROR('AssetReceiptUninvoicedRemainCannotBeNegative', 16, 12);
            RETURN;
        END;

        -- Begin Return Select <- do not remove
        SELECT [Version]
        FROM   [VND].[PurchaseInvoiceItem]
        WHERE  [PurchaseInvoiceItemID] = @PurchaseInvoiceItemID;
    -- End Return Select <- do not remove
