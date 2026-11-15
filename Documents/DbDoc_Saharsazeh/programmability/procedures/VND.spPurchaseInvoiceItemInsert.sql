------------------------------------- END #PurchaseInvoice QuantityAssetReceipt base






------------------------------------- START #PurchaseInvoice AssetReceipt remain controls
CREATE   PROC [VND].spPurchaseInvoiceItemInsert
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
    @Creator INT ,
    @CreationDate DATETIME ,
    @StockReceiptItemID INT ,
    @PurchaseContractItemID INT ,
    @AllocationSharingAmount DECIMAL(36, 10) ,
    @ProformaInvoiceItemID INT,
	@IsVatPartOfCost bit,
    @AssetReceiptItemID INT

--WITH ENCRYPTION
AS
    SET NOCOUNT ON;

        DECLARE @PurchaseInvoiceItemID INT ,
                @CompanyId INT,
                @FinancialPeriodId INT,
                @maxDate DATE,
                @date DATE,
                @BranchID INT ,
                @Message NVARCHAR(MAX);




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
                RETURN
            END;

        IF EXISTS (   SELECT 1
                      FROM   CFG.InstallmentPayment
                      WHERE  BaseType = 4
                             AND DocumentID = @PurchaseInvoiceID )
            BEGIN
                RAISERROR('InvoiceHasInstallment', 16, 12);
                RETURN
            END;

        INSERT INTO [VND].[PurchaseInvoiceItem] ( [PurchaseInvoiceID] ,
                                                  [RowIndex] ,
                                                  [PurchaseRequestItemID] ,
                                                  [ContractSubjectID] ,
                                                  [ProposalItemID] ,
                                                  [StuffID] ,
                                                  [MainQuantity] ,
                                                  [SubQuantity] ,
                                                  [Fee] ,
                                                  [Price] ,
                                                  [Discount] ,
                                                  [Tax] ,
                                                  [Duty] ,
                                                  [Net] ,
                                                  [Description] ,
                                                  [Description2] ,
                                                  [Creator] ,
                                                  [CreationDate] ,
                                                  [LastEditor] ,
                                                  [LastEditionDate] ,
                                                  [Version] ,
                                                  [StockReceiptItemID] ,
                                                  [PurchaseContractItemID] ,
                                                  [AllocationSharingAmount] ,
                                                  [ProformaInvoiceItemID] ,
												  [IsVatPartOfCost],
                                                  [AssetReceiptItemID])
                    SELECT @PurchaseInvoiceID ,
                           @RowIndex ,
                           @PurchaseRequestItemID ,
                           @ContractSubjectID ,
                           @ProposalItemID ,
                           @StuffID ,
                           @MainQuantity ,
                           @SubQuantity ,
                           @Fee ,
                           @Price ,
                           @Discount ,
                           @Tax ,
                           @Duty ,
                           @Net ,
                           @Description ,
                           @Description2 ,
                           @Creator ,
                           @CreationDate ,
                           @Creator ,
                           @CreationDate ,
                           0 ,
                           @StockReceiptItemID ,
                           @PurchaseContractItemID ,
                           @AllocationSharingAmount ,
                           @ProformaInvoiceItemID,
						   @IsVatPartOfCost,
                           @AssetReceiptItemID

        SET @PurchaseInvoiceItemID = SCOPE_IDENTITY();

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
        SELECT [PurchaseInvoiceItemID] ,
               [Version]
        FROM   [VND].[PurchaseInvoiceItem]
        WHERE  [PurchaseInvoiceItemID] = @PurchaseInvoiceItemID;
        -- End Return Select <- do not remove
