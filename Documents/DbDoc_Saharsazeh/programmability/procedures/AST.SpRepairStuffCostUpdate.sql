-------------------------------------
CREATE   PROC [AST].[SpRepairStuffCostUpdate]
    @RepairStuffCostID INT,
    @RepairID INT,
    @Type TINYINT,
    @PurchaseInvoiceItemID INT,
    @OutgoingItemID INT,
    @Price DECIMAL(30, 4),
    @Version INT,
    @LastEditor INT,
    @LastEditionDate DATETIME,
    @MainQuantity DECIMAL(30, 4),
    @SubQuantity DECIMAL(30, 4)
--WITH ENCRYPTION
AS
SET NOCOUNT ON;
    IF @Version <>
    (
        SELECT [Version]
        FROM [AST].[RepairStuffCost]
        WHERE [RepairStuffCostID] = @RepairStuffCostID
    )
    BEGIN
        RAISERROR('Version mismatch...', 16, 10);
        RETURN;
    END;

    IF (@OutgoingItemID IS NOT NULL)
    BEGIN
        IF EXISTS
        (
            SELECT 1
            FROM AST.AssetReceiptItem
            WHERE OutgoingItemID = @OutgoingItemID
        )
        BEGIN
            RAISERROR('برای حواله انبار انتخاب شده قبلا ایجاد دارایی انجام شده است.', 16, 12);
            RETURN;
        END;

    END;

    SET @Version = @Version + 1;

    UPDATE [AST].[RepairStuffCost]
    SET [RepairID] = @RepairID,
        [Type] = @Type,
        [PurchaseInvoiceItemID] = @PurchaseInvoiceItemID,
        [OutgoingItemID] = @OutgoingItemID,
        [Price] = @Price,
        [Version] = @Version,
        [LastEditor] = @LastEditor,
        [LastEditionDate] = @LastEditionDate,
        [MainQuantity] = @MainQuantity,
        [SubQuantity] = @SubQuantity
    WHERE [RepairStuffCostID] = @RepairStuffCostID;

    IF (@PurchaseInvoiceItemID IS NOT NULL)
    BEGIN

        DECLARE @Number INT,
                @Remain DECIMAL(30, 4),
                @Message NVARCHAR(MAX);

        SELECT @Number = p.Number,
               @Remain = r.Non
        FROM VND.PurchaseInvoiceItem i
            JOIN VND.PurchaseInvoice p
                ON i.PurchaseInvoiceID = p.PurchaseInvoiceID
            JOIN VND.PurchaseInvoice_PriceRemains r
                ON i.PurchaseInvoiceItemID = r.PurchaseInvoiceItemID
        WHERE i.PurchaseInvoiceItemID = @PurchaseInvoiceItemID;

        IF (@Remain < 0)
        BEGIN
            SELECT @Message = N'مانده فاکتور خرید شماره {0} منفی خواهد شد.';
            SET @Message = REPLACE(@Message, '{0}', @Number);
            RAISERROR(@Message, 16, 12);
        END;

    END;
    
    -- Begin Return Select <- do not remove
    SELECT [Version]
    FROM [AST].[RepairStuffCost]
    WHERE [RepairStuffCostID] = @RepairStuffCostID;
    -- End Return Select <- do not remove
