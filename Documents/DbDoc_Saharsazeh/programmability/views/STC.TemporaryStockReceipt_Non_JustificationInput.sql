
/************************************************************
 * Code formatted by SoftTree SQL Assistant © v7.2.338
 * Time: 06/09/95 11:55:26 صبح
 ************************************************************/

CREATE VIEW [STC].[TemporaryStockReceipt_Non_JustificationInput]
AS
 
SELECT *,
       T.MainQuantity -T.DoMainQuantity  AS Non,
       T.SubQuantity -T.DoSubQuantity    AS SubNon
FROM   (
           SELECT mi.TemporaryStockReceiptItemID,
                  SUM(mi.MainQuantity)     MainQuantity,
                  SUM(mi.SubQuantity)      SubQuantity,
                  SUM(mo.MainQuantity)     DoMainQuantity,
                  SUM(mo.SubQuantity)      DoSubQuantity
           FROM   STC.TemporaryStockReceiptItem       AS mi
                  LEFT JOIN STC.TemporaryStockReceipt_JustificationInput vw
                       ON  vw.TemporaryStockReceiptItemID = mi.TemporaryStockReceiptItemID
                  LEFT JOIN Stc.JustificationInputItem          AS mo
                       ON  mo.JustificationInputItemID = vw.JustificationInputItemID
           GROUP BY
                  mi.TemporaryStockReceiptItemID
       )                                    T
