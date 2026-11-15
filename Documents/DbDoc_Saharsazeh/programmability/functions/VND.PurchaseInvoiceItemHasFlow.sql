-------------------------------------
CREATE   FUNCTION [VND].[PurchaseInvoiceItemHasFlow]
(
    @ID INT
)
RETURNS BIT
--WITH ENCRYPTION
AS
BEGIN
    DECLARE @Result BIT,
            @Count INT;

    --AdjustmentItem
    IF (
           @Count IS NULL
           OR @Count = 0
       )
       AND OBJECT_ID('AST.AdjustmentItem') IS NOT NULL
        SET @Count = ISNULL(
                     (
                         SELECT COUNT(1)
                         FROM AST.AdjustmentItem
                         WHERE BaseDocumentID = @ID
                         AND BaseDocumentType = 2
                     ),
                     0
                           );

    --UtilizationCost
    IF OBJECT_ID('AST.UtilizationCost') IS NOT NULL
        SET @Count = ISNULL(
                     (
                         SELECT COUNT(1)
                         FROM AST.UtilizationCost
                         WHERE PurchaseInvoiceItemID = @ID
                     ),
                     0
                           );

    --ShippingInsurance
    IF OBJECT_ID('FOS.ShippingInsurance') IS NOT NULL
        SET @Count = ISNULL(
                     (
                         SELECT COUNT(1)
                         FROM FOS.ShippingInsurance
                         WHERE PurchaseInvoiceItemID = @ID
                     ),
                     0
                           );
    --OrderPricingItem
    IF OBJECT_ID('FOS.OrderPricingItem') IS NOT NULL
        SET @Count = ISNULL(
                     (
                         SELECT COUNT(1)
                         FROM FOS.OrderPricingItem
                         WHERE PurchaseInvoiceItemID = @ID
                     ),
                     0
                           );


    --StockReceiptItem
    IF (
           @Count IS NULL
           OR @Count = 0
       )
       AND OBJECT_ID('STC.StockReceiptItem') IS NOT NULL
        SET @Count = ISNULL(
                     (
                         SELECT COUNT(1)
                         FROM STC.StockReceiptItem
                         WHERE PurchaseInvoiceItemID = @ID
                     ),
                     0
                           );

    --ReceiptCost
    IF (
           @Count IS NULL
           OR @Count = 0
       )
       AND OBJECT_ID('STC.ReceiptCost') IS NOT NULL
        SET @Count = ISNULL(
                     (
                         SELECT COUNT(1)FROM STC.ReceiptCost WHERE PurchaseInvoiceItemID = @ID
                     ),
                     0
                           );

    --BillOfLading
    IF (
           @Count IS NULL
           OR @Count = 0
       )
       AND OBJECT_ID('FOS.BillOfLading') IS NOT NULL
        SET @Count = ISNULL(
                     (
                         SELECT COUNT(1)FROM FOS.BillOfLading WHERE PurchaseInvoiceItemID = @ID
                     ),
                     0
                           );
    --BillOfLadingItem
    IF (
           @Count IS NULL
           OR @Count = 0
       )
       AND OBJECT_ID('FOS.BillOfLadingItem') IS NOT NULL
        SET @Count = ISNULL(
                     (
                         SELECT COUNT(1)
                         FROM FOS.BillOfLadingItem
                         WHERE PurchaseInvoiceItemID = @ID
                     ),
                     0
                           );

    --Insurance
    IF (
           @Count IS NULL
           OR @Count = 0
       )
       AND OBJECT_ID('AST.Insurance') IS NOT NULL
        SET @Count = ISNULL(
                     (
                         SELECT COUNT(1)FROM AST.Insurance WHERE PurchaseInvoiceItemID = @ID
                     ),
                     0
                           );

    --AssetReceiptItem
    IF (
           @Count IS NULL
           OR @Count = 0
       )
       AND OBJECT_ID('AST.AssetReceiptItem') IS NOT NULL
        SET @Count = ISNULL(
                     (
                         SELECT COUNT(1)FROM AST.AssetReceiptItem WHERE PurchaseInvoiceItemID = @ID
                     ),
                     0
                           );

    --CostOfOrderItem
    IF (
           @Count IS NULL
           OR @Count = 0
       )
       AND OBJECT_ID('FOS.CostOfOrderItem') IS NOT NULL
        SET @Count = ISNULL(
                     (
                         SELECT COUNT(1)
                         FROM FOS.CostOfOrderItem
                         WHERE PurchaseInvoiceItemID = @ID
                     ),
                     0
                           );


    --TemporaryStockReceiptItem
    IF (
           @Count IS NULL
           OR @Count = 0
       )
       AND OBJECT_ID('STC.TemporaryStockReceiptItem') IS NOT NULL
        SET @Count = ISNULL(
                     (
                         SELECT COUNT(1)
                         FROM STC.TemporaryStockReceiptItem
                         WHERE PurchaseInvoiceItemID = @ID
                     ),
                     0
                           );

   --ReturnInvoiceItem
    IF (
           @Count IS NULL
           OR @Count = 0
       )
       AND OBJECT_ID('VND.ReturnInvoiceItem') IS NOT NULL
        SET @Count = ISNULL(
                     (
                         SELECT COUNT(1)
                         FROM VND.ReturnInvoiceItem
                         WHERE PurchaseInvoiceItemID = @ID
                     ),
                     0
                           );

    --RepairServiceCost
    IF (
           @Count IS NULL
           OR @Count = 0
       )
       AND OBJECT_ID('AST.RepairServiceCost') IS NOT NULL
        SET @Count = ISNULL(
                     (
                         SELECT COUNT(1)
                         FROM AST.RepairServiceCost
                         WHERE PurchaseInvoiceItemID = @ID
                     ),
                     0
                           );

        --RepairStuffCost
    IF (
           @Count IS NULL
           OR @Count = 0
       )
       AND OBJECT_ID('AST.RepairStuffCost') IS NOT NULL
        SET @Count = ISNULL(
                     (
                         SELECT COUNT(1)
                         FROM AST.RepairStuffCost
                         WHERE PurchaseInvoiceItemID = @ID
                     ),
                     0
                           );

    IF (@Count IS NULL OR @Count = 0)
    BEGIN

        IF EXISTS
        (
            SELECT 1
            FROM VND.PurchaseInvoice h
                JOIN VND.PurchaseInvoiceItem i
                    ON i.PurchaseInvoiceID = h.PurchaseInvoiceID
                JOIN STC.StockReceiptItem sr
                    ON sr.StockReceiptItemID = i.StockReceiptItemID
                JOIN STC.StockReceipt s
                    ON s.StockReceiptID = sr.StockReceiptID
            WHERE i.PurchaseInvoiceItemID = @ID
                  AND s.PreVoucherID IS NOT NULL
                  AND sr.EstimatedFee = 0
        )
            SET @Count = 1;


    END;

    IF (@Count IS NULL OR @Count = 0)
        SET @Result = 0;
    ELSE
        SET @Result = 1;

    RETURN @Result;
END;
