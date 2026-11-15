CREATE PROC [STC].[StockReceiptItemsNeedReveisionCost]
    (
        @stockReceiptItemId ArrayInput READONLY
    )
AS
    BEGIN

        SELECT sri.StockReceiptItemID
        FROM   STC.StockReceiptItem AS sri
        WHERE  sri.StockReceiptItemID IN (   SELECT srii.Val
                                             FROM   @stockReceiptItemId AS srii )
               AND sri.EstimatedFee <> 0
               AND sri.EstimatedFee <> sri.EstimatedPrice;
    END;
