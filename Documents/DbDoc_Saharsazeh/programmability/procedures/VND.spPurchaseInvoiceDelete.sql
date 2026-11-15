
CREATE    PROC [VND].[spPurchaseInvoiceDelete]
    @PurchaseInvoiceID INT ,
    @Version INT

--WITH ENCRYPTION
AS
    SET NOCOUNT ON;
    -- BEGIN TRY 

    DECLARE @PreVersion INT ,
            @PreVoucher INT ,
            @date DATE ,
            @financialPeriod INT ,
            @Message NVARCHAR(MAX);

    SELECT @PreVersion = [Version] ,
           @PreVoucher = PreVoucherID ,
           @date = [Date] ,
           @financialPeriod = FinancialPeriodID
    FROM   [VND].[PurchaseInvoice]
    WHERE  [PurchaseInvoiceID] = @PurchaseInvoiceID;

    EXEC CFG.CheckWithVatAndSeason @Date = @date ,                        -- date
                                   @FinancialPeriodId = @financialPeriod; -- int

    IF @PreVoucher IS NOT NULL
        BEGIN
            RAISERROR('UnableToDeletePrevoucher', 16, 12);
            RETURN;
        END;

    DECLARE @HasFlow BIT = (SELECT VND.PurchaseInvoiceHasFlow(@PurchaseInvoiceID) )
    IF (@HasFlow = 1)
    BEGIN
        RAISERROR('HasFlowItemCanNotEdit', 16, 12);
        RETURN;
    END;

    IF EXISTS (   SELECT 1
                  FROM   VND.PurchaseInvoice h
                         JOIN VND.PurchaseInvoiceItem i ON i.PurchaseInvoiceID = h.PurchaseInvoiceID
                         JOIN STC.StockReceiptItem sr ON sr.StockReceiptItemID = i.StockReceiptItemID
                         JOIN STC.StockReceipt s ON s.StockReceiptID = sr.StockReceiptID
                  WHERE  i.PurchaseInvoiceID = @PurchaseInvoiceID
                         AND s.PreVoucherID IS NOT NULL )
        BEGIN
            SET @Message = N'رسیدهای مربوط به فاکتور مورد نظر دارای پیش نویس سند می باشند و نمی توان آن را حذف کرد';
            RAISERROR(@Message, 16, 12);
            RETURN;
        END;


    IF EXISTS (   SELECT 1
                  FROM   CFG.InstallmentPayment
                  WHERE  BaseType = 4
                         AND DocumentID = @PurchaseInvoiceID )
        BEGIN
            SET @Message = N'فاکتور مورد نظر قسط بندی شده و امکان حذف آن وجود ندارد.';
            RAISERROR(@Message, 16, 12);
        END;


    IF @Version = @PreVersion
        BEGIN
            DECLARE @ItemID INT ,
                    @ItemVersion INT;

            DECLARE db_cursor CURSOR FOR
                SELECT PurchaseInvoiceItemID ,
                       Version
                FROM   VND.PurchaseInvoiceItem
                WHERE  PurchaseInvoiceID = @PurchaseInvoiceID;

            OPEN db_cursor;
            FETCH NEXT FROM db_cursor
            INTO @ItemID ,
                 @ItemVersion;

            WHILE @@FETCH_STATUS = 0
                BEGIN
                    EXEC VND.spPurchaseInvoiceItemDelete @ItemID ,
                                                         @ItemVersion;

                    FETCH NEXT FROM db_cursor
                    INTO @ItemID ,
                         @ItemVersion;
                END;

            CLOSE db_cursor;
            DEALLOCATE db_cursor;

            DELETE CFG.EntityCustomeFieldData
            WHERE EntityCustomeFieldID IN (   SELECT EntityCustomeFieldID
                                              FROM   CFG.EntityCustomeField
                                              WHERE  EntityName = 'PurchaseInvoice' )
                  AND EntityID = @PurchaseInvoiceID;

            DELETE FROM [VND].[PurchaseInvoice]
            WHERE [PurchaseInvoiceID] = @PurchaseInvoiceID;
        END;
    ELSE
        BEGIN
            RAISERROR(N'Delete_%s_%d.' ,   -- Message text.
                      16 ,                 -- Severity,
                      10 ,                 -- State,
                      N'PurchaseInvoice' , -- First argument.
                      @PurchaseInvoiceID); -- Second argument.)
        END;
