-------------------------------------
CREATE   PROC [AST].[SpRepairStuffCostInsert]
    @RepairID INT,
    @Type TINYINT,
    @PurchaseInvoiceItemID INT,
    @OutgoingItemID INT,
    @Price DECIMAL(30, 4),
    @Creator INT,
    @CreationDate DATETIME,
    @MainQuantity DECIMAL(30, 4),
    @SubQuantity DECIMAL(30, 4)
--WITH ENCRYPTION
AS
    SET NOCOUNT ON;

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

    INSERT INTO [AST].[RepairStuffCost]
    (
        [RepairID],
        [Type],
        [PurchaseInvoiceItemID],
        [OutgoingItemID],
        [Price],
        [Version],
        [Creator],
        [CreationDate],
        [LastEditor],
        [LastEditionDate],
        [MainQuantity],
        [SubQuantity]
    )
    SELECT @RepairID,
           @Type,
           @PurchaseInvoiceItemID,
           @OutgoingItemID,
           @Price,
           0,
           @Creator,
           @CreationDate,
           @Creator,
           @CreationDate,
           @MainQuantity,
           @SubQuantity;

    -- Begin Return Select <- do not remove
    SELECT [RepairStuffCostID],
           [Version]
    FROM [AST].[RepairStuffCost]
    WHERE [RepairStuffCostID] = SCOPE_IDENTITY();
    -- End Return Select <- do not remove

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
