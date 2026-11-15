
--------------------------------------------- START #7763 
Create   PROC [STC].[SpStockReceiptItemUpdate]
    @StockReceiptItemID INT,
    @StockReceiptID INT,
    @RowIndex SMALLINT,
    @OutgoingItemID INT = NULL,
    @PurchaseInvoiceItemID INT = NULL,
    @StuffID INT,
    @MainQuantity DECIMAL(36, 10),
    @SubQuantity DECIMAL(36, 10) = NULL,
    @Fee DECIMAL(36, 10),
    @Price DECIMAL(36, 10),
    @EstimatedFee DECIMAL(36, 10),
    @EstimatedPrice DECIMAL(36, 10),
    @ShareOfCosts DECIMAL(36, 10),
    @NetPrice DECIMAL(36, 10),
    @Description NVARCHAR(256) = NULL,
    @Description2 NVARCHAR(256) = NULL,
    @Version INT,
    @LastEditor INT,
    @LastEditionDate DATETIME,
    @ProposalItemID INT = NULL,
    @JustificationInputItemID INT = NULL,
    @PurchaseRequestItemID INT = NULL,
    @PurchaseContractItemID INT = NULL,
    @DeliveryJustificationItemID INT = NULL,
    @ClearanceItemID INT = NULL,
    @ConvertSpecificationID INT = NULL,
    @ContractSubjectID INT = NULL,
    @ProductionPlanningItemID INT = NULL,
    @ProductionStatisticItemID INT = NULL
--WITH ENCRYPTION
AS
SET NOCOUNT ON;
BEGIN

    IF EXISTS
    (
        SELECT PreVoucherID
        FROM STC.StockReceipt
        WHERE StockReceiptID = @StockReceiptID
              AND PreVoucherID IS NOT NULL
    )
    BEGIN
        RAISERROR('رسید مورد نظر در حسابداری انبار دارای گردش است.', 16, 12);
        RETURN 0;
    END;

    IF EXISTS
    (
        SELECT 1
        FROM VND.PurchaseInvoiceItem AS pii
        WHERE pii.StockReceiptItemID = @StockReceiptItemID
    )
    BEGIN

        IF EXISTS
        (
            SELECT 1
            FROM STC.StockReceiptItem AS sri
            WHERE sri.StockReceiptItemID = @StockReceiptItemID
                  AND sri.MainQuantity <> @MainQuantity
        )
           OR EXISTS
        (
            SELECT sri.StuffID
            FROM STC.StockReceiptItem AS sri
            WHERE sri.StockReceiptItemID = @StockReceiptItemID
                  AND sri.StuffID <> @StuffID
        )
        BEGIN
            DECLARE @msg1 NVARCHAR(MAX)
                = N'برای ردیف ' + CAST(@RowIndex AS NCHAR(10)) + N' فاکتور خرید صادر شده و قابل ویرایش نمی باشد.';
            RAISERROR(@msg1, 16, 12);
            RETURN 0;
        END;

    END;

    IF EXISTS
    (
        SELECT 1
        FROM STC.RevisionCostItem
        WHERE StockReceiptItemID = @StockReceiptItemID
    )
    BEGIN
        DECLARE @msg NVARCHAR(MAX)
            = N'ردیف ' + CAST(@RowIndex AS NCHAR(10)) + N' دارای اصلاح فی می باشد و قابل ویرایش نمی باشد.';
        RAISERROR(@msg, 16, 12);
        RETURN 0;
    END;

    DECLARE @PreVersion INT,
            @PrePrevoucher INT,
            @Message NVARCHAR(MAX);

    SELECT @PreVersion = ARI.[Version],
           @PrePrevoucher = sr.PreVoucherID
    FROM [STC].StockReceiptItem ARI
        JOIN STC.StockReceipt sr
            ON sr.StockReceiptID = ARI.StockReceiptID
    WHERE ARI.StockReceiptItemID = @StockReceiptItemID;

    IF @Version <> @PreVersion
       OR
       (
           @PrePrevoucher IS NOT NULL
           AND @PurchaseInvoiceItemID IS NULL
       )
    BEGIN
        RAISERROR('Version mismatch...', 16, 10);
        RETURN 0;
    END;

    SET @Version = @Version + 1;

    UPDATE [STC].[StockReceiptItem]
    SET [RowIndex] = @RowIndex,
        [OutgoingItemID] = @OutgoingItemID,
        [PurchaseInvoiceItemID] = @PurchaseInvoiceItemID,
        [StuffID] = @StuffID,
        [MainQuantity] = @MainQuantity,
        [SubQuantity] = @SubQuantity,
        [Fee] = @Fee,
        [Price] = @Price,
        [EstimatedFee] = @EstimatedFee,
        [EstimatedPrice] = @EstimatedPrice,
        [ShareOfCosts] = @ShareOfCosts,
        [Description] = @Description,
        [Description2] = @Description2,
        [Version] = @Version,
        [LastEditor] = @LastEditor,
        [LastEditionDate] = @LastEditionDate,
        ProposalItemID = @ProposalItemID,
        JustificationInputItemID = @JustificationInputItemID,
        PurchaseRequestItemID = @PurchaseRequestItemID,
        PurchaseContractItemID = @PurchaseContractItemID,
        DeliveryJustificationItemID = @DeliveryJustificationItemID,
        ClearanceItemID = @ClearanceItemID,
        [ConvertSpecificationID] = @ConvertSpecificationID,
        [ContractSubjectID] = @ContractSubjectID,
        [ProductionPlanningItemID] = @ProductionPlanningItemID,
        ProductionStatisticItemID = @ProductionStatisticItemID
    WHERE [StockReceiptItemID] = @StockReceiptItemID;

    IF (@OutgoingItemID IS NOT NULL)
    BEGIN

        IF EXISTS
        (
            SELECT MainQuantity
            FROM [STC].[OutgoingItem]
            WHERE OutgoingItemID = @OutgoingItemID
                  AND MainQuantity < @MainQuantity
        )
        BEGIN
            DECLARE @Stuff_Code NVARCHAR(256);

            SELECT @Stuff_Code = Code
            FROM [STF].[Stuff]
            WHERE StuffID = @StuffID;

            SET @Message = N'Messages.MinusOutgoing^' + @Stuff_Code;
            RAISERROR(@Message, 16, 12);
        END;

    END;

    IF EXISTS
    (
        SELECT 1
        FROM VND.PurchaseInvoice_Remains
        WHERE PurchaseInvoiceItemID = @PurchaseInvoiceItemID
              AND DoMainQuantity > MainQuantity
    )
    BEGIN
        RAISERROR(N'مانده رسید نشده فاکتور نمی تواند منفی باشد', 16, 12);
    END;

    -- Begin Return Select <- do not remove
    SELECT  [Version] 
        FROM [STC].[StockReceiptItem]
    WHERE [StockReceiptItemID] = @StockReceiptItemID;
-- End Return Select <- do not remove

END;
