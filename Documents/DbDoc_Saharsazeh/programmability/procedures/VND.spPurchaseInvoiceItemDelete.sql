-------------------------------------
CREATE   PROC [VND].[spPurchaseInvoiceItemDelete]
    @PurchaseInvoiceItemID INT ,
    @Version INT

--WITH ENCRYPTION
AS
    SET NOCOUNT ON;
    BEGIN TRY

        DECLARE @PurchaseRequestItemID INT ,
                @MainQuantity DECIMAL(30, 4) ,
                @SubQuantity DECIMAL(30, 4) ,
                @PreVersion INT ,
                @PreVoucher INT ,
				@rowIndex INT,
                @Date DATE ,
                @Message NVARCHAR(MAX) ,
                @PurchaseInvoiceID INT;

        SELECT @PurchaseRequestItemID = PurchaseRequestItemID ,
               @MainQuantity = MainQuantity ,
               @SubQuantity = SubQuantity ,
               @PreVersion = I.Version ,
			   @rowIndex = I.RowIndex,
               @Date = H.Date ,
               @PreVoucher = H.PreVoucherID ,
               @PurchaseInvoiceID = I.PurchaseInvoiceID
        FROM   [VND].[PurchaseInvoiceItem] I
               JOIN [VND].[PurchaseInvoice] H ON H.PurchaseInvoiceID = I.PurchaseInvoiceID
        WHERE  PurchaseInvoiceItemID = @PurchaseInvoiceItemID;


        IF @Date <= (   SELECT MAX(EndDate)
                        FROM   CFG.Vat v )
            BEGIN
                RAISERROR('VatHasPublished', 16, 12);
            --RAISERROR('تغيير اطلاعات بعد از صدور ارزش افزوده مجاز نيست.', 16 , 12)	
            END;

        IF @PreVoucher IS NOT NULL
            BEGIN
                RAISERROR('UnableToDeletePrevoucher', 16, 12);
                RETURN;
            END;


        IF EXISTS (   SELECT 1
                      FROM   VND.PurchaseInvoice h
                             JOIN VND.PurchaseInvoiceItem i ON i.PurchaseInvoiceID = h.PurchaseInvoiceID
                             JOIN STC.StockReceiptItem sr ON sr.StockReceiptItemID = i.StockReceiptItemID
                             JOIN STC.StockReceipt s ON s.StockReceiptID = sr.StockReceiptID
                      WHERE  i.PurchaseInvoiceItemID = @PurchaseInvoiceItemID
                             AND s.PreVoucherID IS NOT NULL )
            BEGIN
                SET @Message = 'InvoiceStockReceiptHasPrevoucher^'+CAST(@rowIndex AS NVARCHAR(50));
                RAISERROR(@Message, 16, 12);
                RETURN;
            END;



        IF EXISTS (   SELECT *
                      FROM   CFG.InstallmentPayment
                      WHERE  BaseType = 4
                             AND DocumentID = @PurchaseInvoiceID )
            BEGIN

                SET @Message = 'InvoiceDeleteHasInstallment';
                RAISERROR(@Message, 16, 12);
            END;

        IF @Version = @PreVersion
            BEGIN

                DECLARE @StockReceiptItemID INT;
                SELECT @StockReceiptItemID = StockReceiptItemID
                FROM   VND.PurchaseInvoiceItem
                WHERE  PurchaseInvoiceItemID = @PurchaseInvoiceItemID;

                --SET  PurchaseInvoice fact on StockReceipt 
                IF @StockReceiptItemID IS NOT NULL
                    BEGIN

                        DECLARE @StockReceiptId INT;

                        SELECT @StockReceiptId = StockReceiptID
                        FROM   STC.StockReceiptItem
                        WHERE  StockReceiptItemID = @StockReceiptItemID;

                        UPDATE STC.StockReceiptItem
                        SET    Fee = 0 ,
                               Price = 0
                        WHERE  StockReceiptItemID = @StockReceiptItemID;

                        UPDATE STC.StockReceipt
                        SET    TotalCosts = (   SELECT SUM(ShareOfCosts)
                                                FROM   STC.StockReceiptItem
                                                WHERE  StockReceiptID = @StockReceiptId) ,
                               TotalInvoicePrice = (   SELECT SUM(Price)
                                                       FROM   STC.StockReceiptItem
                                                       WHERE  StockReceiptID = @StockReceiptId) ,
                               TotalNetPrice = (   SELECT SUM(NetPrice)
                                                   FROM   STC.StockReceiptItem
                                                   WHERE  StockReceiptID = @StockReceiptId) ,
                               TotalEstimatedPrice = (   SELECT SUM(EstimatedPrice)
                                                         FROM   STC.StockReceiptItem
                                                         WHERE  StockReceiptID = @StockReceiptId)
                        WHERE  StockReceiptID = @StockReceiptId;

                    END;

                -- Clear reverse AR -> PI link (if any)
                UPDATE AST.AssetReceiptItem
                SET    PurchaseInvoiceItemID = NULL
                WHERE  PurchaseInvoiceItemID = @PurchaseInvoiceItemID;

                -- Forward PI -> AR link (AssetReceiptItemID) is removed with DELETE;
                -- uninvoiced remain recalculates via AST.AssetReceiptItem_PurchaseInvoice_Remains
                DELETE FROM [VND].[PurchaseInvoiceItem]
                WHERE [PurchaseInvoiceItemID] = @PurchaseInvoiceItemID;


            END;
        ELSE
            BEGIN

                RAISERROR(N'Delete_%s_%d.' ,       -- Message text.
                          16 ,                     -- Severity,
                          10 ,                     -- State,
                          N'PurchaseInvoiceItem' , -- First argument.
                          @PurchaseInvoiceItemID); -- Second argument.)
            END;

    END TRY
    BEGIN CATCH



        DECLARE @ErrorMessage NVARCHAR(4000);
        DECLARE @ErrorSeverity INT;
        DECLARE @ErrorState INT;

        SELECT @ErrorMessage = ERROR_MESSAGE() ,
               @ErrorSeverity = ERROR_SEVERITY() ,
               @ErrorState = ERROR_STATE();

        IF ( ERROR_NUMBER() = 547 )
            SET @ErrorState = 11;
        RAISERROR(@ErrorMessage ,  -- Message text.
                  @ErrorSeverity , -- Severity.
                  @ErrorState      -- State.
        );

    END CATCH;
