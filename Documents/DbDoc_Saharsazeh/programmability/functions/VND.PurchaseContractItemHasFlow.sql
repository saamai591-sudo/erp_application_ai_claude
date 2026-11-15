------------------------------------------
CREATE   FUNCTION [VND].[PurchaseContractItemHasFlow] ( @ID INT )
RETURNS BIT
   -- WITH ENCRYPTION
AS
    BEGIN
    	
        DECLARE @Result BIT ,
            @Count INT;
	
        IF OBJECT_ID('STC.StockReceiptItem') IS NOT NULL
            SET @Count = ISNULL(( SELECT    COUNT(1)
                                  FROM      STC.StockReceiptItem
                                  WHERE     PurchaseContractItemID = @ID
                                ), 0); 

        IF ( @Count IS NULL OR @Count = 0)
            AND OBJECT_ID('VND.PurchaseInvoiceItem') IS NOT NULL
            SET @Count = ISNULL(( SELECT    COUNT(1)
                                  FROM      VND.PurchaseInvoiceItem
                                  WHERE     PurchaseContractItemID = @ID
                                ), 0); 
                                
        IF ( @Count IS NULL OR @Count = 0)
            AND OBJECT_ID('FOS.ProformaInvoiceItem') IS NOT NULL
            SET @Count = ISNULL(( SELECT    COUNT(1)
                                  FROM      FOS.ProformaInvoiceItem pii
                                  WHERE     PurchaseContractItemID = @ID
                                ), 0); 

        IF  ( @Count IS NULL OR @Count = 0)
            AND OBJECT_ID('STC.TemporaryStockReceiptItem') IS NOT NULL
            SET @Count = ISNULL(( SELECT    COUNT(1)
                                  FROM      STC.TemporaryStockReceiptItem
                                  WHERE     PurchaseContractItemID = @ID
                                ), 0); 

        IF  ( @Count IS NULL OR @Count = 0)
            AND OBJECT_ID('STC.JustificationInputItem') IS NOT NULL
            SET @Count = ISNULL(( SELECT    COUNT(1)
                                  FROM      STC.JustificationInputItem
                                  WHERE     PurchaseContractItemID = @ID
                                ), 0); 

        IF  ( @Count IS NULL OR @Count = 0)
            AND OBJECT_ID('VND.DeliveryJustificationItem') IS NOT NULL
            SET @Count = ISNULL(( SELECT    COUNT(1)
                                  FROM      VND.DeliveryJustificationItem
                                  WHERE     PurchaseContractItemID = @ID
                                ), 0); 

        IF ( @Count IS NULL
             OR @Count = 0
           )
            SET @Result = 0;
        ELSE
            SET @Result = 1;
        RETURN @Result;

    END;
