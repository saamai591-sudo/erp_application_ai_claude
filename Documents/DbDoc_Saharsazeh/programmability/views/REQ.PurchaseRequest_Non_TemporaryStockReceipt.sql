
CREATE VIEW [REQ].[PurchaseRequest_Non_TemporaryStockReceipt]
AS
    SELECT  T.PurchaseRequestItemID ,
            T.MainQuantity ,
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
                        LEFT JOIN REQ.PurchaseRequest_TemporaryStockReceipt vw ON vw.PurchaseRequestItemID = mi.PurchaseRequestItemID
                        LEFT JOIN STC.TemporaryStockReceiptItem AS mo ON mo.TemporaryStockReceiptItemID = vw.TemporaryStockReceiptItemID
              GROUP BY  mi.PurchaseRequestItemID
            ) T;
