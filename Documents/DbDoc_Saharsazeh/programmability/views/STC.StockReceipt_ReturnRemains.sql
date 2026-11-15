
CREATE VIEW [STC].[StockReceipt_ReturnRemains]
AS
    SELECT  T.StockReceiptItemID ,
            MainQuantity ,
            T.DoMainQuantity ,
            T.DoSubQuantity ,
            MainQuantity - DoMainQuantity AS Non ,
            SubQuantity - DoSubQuantity AS NonSub
    FROM    ( SELECT    item.StockReceiptItemID ,
                        SUM(ISNULL(used1.MainQuantity, 0)
                            + ISNULL(used2.MainQuantity, 0)) AS DoMainQuantity ,
                        SUM(ISNULL(used1.SubQuantity, 0)
                            + ISNULL(used2.SubQuantity, 0)) AS DoSubQuantity
              FROM      STC.StockReceiptItem AS item
                        LEFT JOIN ( SELECT  StockReceiptItemID ,
                                            SUM(MainQuantity) AS MainQuantity ,
                                            SUM(SubQuantity) AS SubQuantity
                                    FROM    REQ.ReturnRequestItem AS pri
                                    GROUP BY StockReceiptItemID
                                  ) AS used1 ON item.StockReceiptItemID = used1.StockReceiptItemID
                        LEFT JOIN ( SELECT  pri.StockReceiptItemID ,
                                            SUM(MainQuantity) AS MainQuantity ,
                                            SUM(SubQuantity) AS SubQuantity
                                    FROM    STC.ReturnStockReceiptItem AS pri
                                    GROUP BY pri.StockReceiptItemID
                                  ) AS used2 ON item.StockReceiptItemID = used2.StockReceiptItemID
              GROUP BY  item.StockReceiptItemID
            ) T
            INNER JOIN STC.StockReceiptItem AS sri ON T.StockReceiptItemID = sri.StockReceiptItemID;

      
