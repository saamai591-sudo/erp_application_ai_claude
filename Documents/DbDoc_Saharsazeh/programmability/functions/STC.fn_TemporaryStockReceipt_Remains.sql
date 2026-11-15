
------------------------------------- START #7636
CREATE   FUNCTION [STC].[fn_TemporaryStockReceipt_Remains]
(
    @StockID        INT,
    @DeliverDlID    INT,
    @Date date,
    @WithRemain bit = 1
)
RETURNS TABLE
AS
RETURN
(
    SELECT
        sri.TemporaryStockReceiptItemID,
        sri.MainQuantity,
        sri.SubQuantity,
        SUM(ISNULL(u.MainQuantity, 0)) AS DoMainQuantity,
        SUM(ISNULL(u.SubQuantity, 0))  AS DoSubQuantity,
        sri.MainQuantity - SUM(ISNULL(u.MainQuantity, 0)) AS Non,
        sri.SubQuantity - SUM(ISNULL(u.SubQuantity, 0))  AS NonSub,
        tsr.[Date],
        tsr.StockID,
        tsr.DeliverDlID,
        sdt.StockDocumentTypeID
    FROM STC.TemporaryStockReceiptItem sri
    JOIN STC.TemporaryStockReceipt tsr
         ON tsr.TemporaryStockReceiptID = sri.TemporaryStockReceiptID
    JOIN stc.StockDocumentTypeBaseEntity sdtbe
         ON sdtbe.StockDocumentTypeBaseEntityID = tsr.StockDocumentTypeBaseEntityID
    JOIN stc.StockDocumentType sdt
         ON sdt.StockDocumentTypeID = sdtbe.StockDocumentTypeID
    LEFT JOIN (
        SELECT TemporaryStockReceiptItemID, MainQuantity, SubQuantity
        FROM STC.ReturnedTemporaryStockReceiptItem
        UNION ALL
        SELECT TemporaryStockReceiptItemID, MainQuantity, SubQuantity
        FROM Req.ReturnRequestItem
        UNION ALL
        SELECT TemporaryStockReceiptItemID, MainQuantity, SubQuantity
        FROM STC.JustificationInputItem
    ) u ON u.TemporaryStockReceiptItemID = sri.TemporaryStockReceiptItemID
    WHERE (tsr.StockID     = @StockID or @StockID is null)
      AND (tsr.DeliverDlID = @DeliverDlID or @DeliverDlID is null)
      and (tsr.[Date]<=@Date or @Date is null)
    GROUP BY
        sri.TemporaryStockReceiptItemID,
        sri.MainQuantity,
        sri.SubQuantity,
        tsr.[Date],
        tsr.StockID,
        tsr.DeliverDlID,
        sdt.StockDocumentTypeID
         having case when @WithRemain = 1 then  (sri.MainQuantity - SUM(ISNULL(u.MainQuantity, 0))) else 1 End >0
 
);
