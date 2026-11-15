-------------------------------------
CREATE   VIEW [AST].AssetReceiptItem_PurchaseInvoice_Remains
AS

SELECT ari.AssetReceiptItemID,
       ari.MainQuantity,
       ISNULL(T.DoMainQuantity, 0) AS DoMainQuantity,
       ari.MainQuantity - ISNULL(T.DoMainQuantity, 0) AS Non
FROM   AST.AssetReceiptItem AS ari
       LEFT JOIN (
                SELECT AssetReceiptItemID,
                       SUM(MainQuantity) AS DoMainQuantity
                FROM   VND.PurchaseInvoiceItem
                WHERE  AssetReceiptItemID IS NOT NULL
                GROUP BY AssetReceiptItemID
            ) AS T
            ON ari.AssetReceiptItemID = T.AssetReceiptItemID
