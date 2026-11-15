
/************************************************************
 * Code formatted by SoftTree SQL Assistant © v7.2.338
 * Time: 06/09/95 11:55:26 صبح
 ************************************************************/

CREATE VIEW [VND].[Proposal_Non_StockReceipt]
AS
 
SELECT *,
       T.MainQuantity -T.DoMainQuantity  AS Non,
       T.SubQuantity -T.DoSubQuantity    AS SubNon
FROM   (
           SELECT mi.ProposalItemID,
                  SUM(mi.MainQuantity)     MainQuantity,
                  SUM(mi.SubQuantity)      SubQuantity,
                  SUM(mo.MainQuantity)     DoMainQuantity,
                  SUM(mo.SubQuantity)      DoSubQuantity
           FROM   VND.ProposalItem      AS mi
                  LEFT JOIN VND.Proposal_StockReceipt vw
                       ON  vw.ProposalItemID = mi.ProposalItemID
                  LEFT JOIN Stc.StockReceiptItem        AS mo
                       ON  mo.StockReceiptItemID = vw.StockReceiptItemID
           GROUP BY
                  mi.ProposalItemID
       )                                    T
