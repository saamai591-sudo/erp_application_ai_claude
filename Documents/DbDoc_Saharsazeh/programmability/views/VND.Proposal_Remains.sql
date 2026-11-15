
/************************************************************
 * Code formatted by SoftTree SQL Assistant © v7.2.338
 * Time: 06/09/95 12:30:14 ÚÕÑ
 ************************************************************/

CREATE VIEW [VND].[Proposal_Remains]
AS 


SELECT T.ProposalItemID,
       MainQuantity,
       T.DoMainQuantity,
       T.DoSubQuantity,
       MainQuantity -DoMainQuantity  AS Non,
       SubQuantity -DoSubQuantity    AS NonSub
FROM   (
           SELECT item.ProposalItemID,
                  SUM(ISNULL(used1.MainQuantity, 0)) +
                  SUM(ISNULL(used2.MainQuantity, 0)) +
                  SUM(ISNULL(used3.MainQuantity, 0)) +
                  SUM(ISNULL(used4.MainQuantity, 0))+
                  SUM(ISNULL(used5.MainQuantity, 0)) AS DoMainQuantity,
                  SUM(ISNULL(used1.SubQuantity, 0)) +
                  SUM(ISNULL(used2.SubQuantity, 0)) +
                  SUM(ISNULL(used3.SubQuantity, 0)) +
                  SUM(ISNULL(used4.SubQuantity, 0))+
                  SUM(ISNULL(used5.SubQuantity, 0)) AS DoSubQuantity
           FROM   VND.ProposalItem  AS item
                  LEFT JOIN (
                           SELECT ProposalItemID,
                                  SUM(MainQuantity) AS MainQuantity,
                                  SUM(SubQuantity) AS SubQuantity
                           FROM   VND.PurchaseInvoiceItem AS pri
                           GROUP BY
                                  ProposalItemID
                       )            AS used1
                       ON  item.ProposalItemID = used1.ProposalItemID
                  LEFT JOIN (
                           SELECT ProposalItemID,
                                  SUM(MainQuantity) AS MainQuantity,
                                  SUM(SubQuantity) AS SubQuantity
                           FROM   STC.StockReceiptItem AS pri
                           GROUP BY
                                  ProposalItemID
                       )            AS used2
                       ON  item.ProposalItemID = used2.ProposalItemID
                  LEFT JOIN (
                           SELECT ProposalItemID,
                                  SUM(MainQuantity) AS MainQuantity,
                                  SUM(SubQuantity) AS SubQuantity
                           FROM   STC.TemporaryStockReceiptItem AS pri
                           GROUP BY
                                  ProposalItemID
                       )            AS used3
                       ON  item.ProposalItemID = used3.ProposalItemID
                  LEFT JOIN (
                           SELECT ProposalItemID,
                                  SUM(MainQuantity) AS MainQuantity,
                                  SUM(SubQuantity) AS SubQuantity
                           FROM   STC.JustificationInputItem AS pri
                           GROUP BY
                                  ProposalItemID
                       )            AS used4
                       ON  item.ProposalItemID = used4.ProposalItemID
                  LEFT JOIN (
                           SELECT ProposalItemID,
                                  SUM(MainQuantity) AS MainQuantity,
                                  SUM(SubQuantity) AS SubQuantity
                           FROM   VND.PurchaseContractItem AS pri
                           GROUP BY
                                  ProposalItemID
                       )            AS used5
                       ON  item.ProposalItemID = used5.ProposalItemID
           GROUP BY
                  item.ProposalItemID
       ) T
       INNER JOIN VND.ProposalItem   AS sri
            ON  T.ProposalItemID = sri.ProposalItemID     
      


