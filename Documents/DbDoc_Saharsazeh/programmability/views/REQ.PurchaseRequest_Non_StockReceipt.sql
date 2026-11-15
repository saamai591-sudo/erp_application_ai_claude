
CREATE VIEW [REQ].[PurchaseRequest_Non_StockReceipt]
AS
    SELECT  T.MainQuantity ,
            T.SubQuantity ,
            T.DoMainQuantity ,
            T.DoSubQuantity ,
            T.MainQuantity - T.DoMainQuantity AS Non ,
            T.SubQuantity - T.DoSubQuantity AS SubNon
    FROM    ( SELECT    mi.PurchaseRequestItemID ,
                        SUM(mi.AcceptRequestMainMeasureQuantity) MainQuantity ,
                        SUM(mi.AcceptRequestSubMeasureQuantity) SubQuantity ,
                        SUM(mo.MainQuantity) DoMainQuantity ,
                        SUM(mo.SubQuantity) DoSubQuantity
              FROM      REQ.PurchaseRequestItem AS mi
                        LEFT JOIN REQ.PurchaseRequest_StockReceipt vw ON vw.PurchaseRequestItemID = mi.PurchaseRequestItemID
                        LEFT JOIN stc.StockReceiptItem AS mo ON mo.StockReceiptItemID = vw.StockReceiptItemID
              GROUP BY  mi.PurchaseRequestItemID
            ) T;
