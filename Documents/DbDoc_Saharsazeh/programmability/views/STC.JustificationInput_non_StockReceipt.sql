

/************************************************************
 * Code formatted by SoftTree SQL Assistant © v7.2.338
 * Time: 06/09/95 11:55:26 صبح
 ************************************************************/

CREATE VIEW [STC].[JustificationInput_non_StockReceipt]
AS
 
SELECT *,
       T.MainQuantity -T.DoMainQuantity  AS Non,
       T.SubQuantity -T.DoSubQuantity    AS SubNon
FROM   (
           SELECT mi.JustificationInputItemID,
                  SUM(mi.MainQuantity)     MainQuantity,
                  SUM(mi.SubQuantity)      SubQuantity,
                  SUM(mo.MainQuantity)     DoMainQuantity,
                  SUM(mo.SubQuantity)      DoSubQuantity
           FROM   STC.JustificationInputItem     AS mi
                  LEFT JOIN STC.JustificationInput_StockReceipt vw
                       ON  vw.JustificationInputItemID = mi.JustificationInputItemID
                  LEFT JOIN Stc.StockReceiptItem      AS mo
                       ON  mo.StockReceiptItemID = vw.StockReceiptItemID
           GROUP BY
                  mi.JustificationInputItemID
       )                                    T

