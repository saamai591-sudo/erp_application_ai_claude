CREATE VIEW [STC].StockReceipt_Remains
AS 


SELECT sri.StockReceiptItemID,
       sri.MainQuantity,
       ISNULL(T.DoMainQuantity, 0)     DoMainQuantity,
       ISNULL(T.DoSubQuantity, 0)      DoSubQuantity,
       sri.MainQuantity - ISNULL(DoMainQuantity, 0) AS Non,
       sri.SubQuantity -ISNULL(DoSubQuantity, 0) AS NonSub
FROM   stc.StockReceiptItem         AS sri
       LEFT JOIN (
                SELECT StockReceiptItemID,
                       SUM(MainQuantity)  AS DoMainQuantity,
                       SUM(SubQuantity)   AS DoSubQuantity
                FROM   VND.PurchaseInvoiceItem AS pri
                GROUP BY
                       StockReceiptItemID
            )                       AS T
            ON  sri.StockReceiptItemID = T.StockReceiptItemID
