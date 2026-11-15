
------------------------------------------------
Create   VIEW [SLE].SaleContract_Remains
AS
WITH InvoiceNonReturned_CTE AS
     (
         SELECT irr.InvoiceItemID,
                irr.Non,
                irr.NonSub
         FROM   sle.Invoice_Return_Remains AS irr
     ),
     
     InvoiceBasedOnSaleContract_CTE AS (
         SELECT ii2.SaleContractItemID,
                SUM(inrc.Non)     AS MainQuantity,
                SUM(inrc.NonSub)  AS SubQuantity
         FROM   SLE.InvoiceItem   AS ii2
                JOIN InvoiceNonReturned_CTE inrc
                     ON  ii2.InvoiceItemID = inrc.InvoiceItemID
                JOIN SLE.Invoice h
                     ON  h.InvoiceID = ii2.InvoiceID
         WHERE  h.SaleInvoiceStatus <> 5
         GROUP BY
                ii2.SaleContractItemID
     ),
     OutGoingBasedOnSaleContract_CTE
     as (
         SELECT ii2.SaleContractItemID,
                SUM(ii2.MainQuantity)     MainQuantity,
                SUM(ii2.SubQuantity)      SubQuantity
         FROM   STC.OutgoingItem       AS ii2
         GROUP BY
                ii2.SaleContractItemID
     ) ,
     RemittanceBasedOnSaleContract_CTE
     as (
         SELECT ii2.SaleContractItemID,
                SUM(ii2.MainQuantity)     MainQuantity,
                SUM(ii2.SubQuantity)      SubQuantity
         FROM   SLE.RemittanceItem     AS ii2
         GROUP BY
                ii2.SaleContractItemID
     )

 
SELECT sci2.SaleContractItemID,
       sci2.MainQuantity,
       sci2.SubQuantity,
       T.DoMainQuantity,
       T.DoSubQuantity,
       MainQuantity - DoMainQuantity    AS Non,
       SubQuantity - DoSubQuantity      AS SubNon
FROM   (
           SELECT sci.SaleContractItemID,
                  SUM(
                      ISNULL(fl.MainQuantity, 0)
                      + ISNULL(fl1.MainQuantity, 0)
                      + ISNULL(fl2.MainQuantity, 0)
                  )                     AS DoMainQuantity,
                  SUM(
                      ISNULL(fl.SubQuantity, 0) + ISNULL(fl1.SubQuantity, 0)
                      + ISNULL(fl2.SubQuantity, 0)
                  )                     AS DoSubQuantity
           FROM   SLE.SaleContractItem  AS sci
                  LEFT JOIN InvoiceBasedOnSaleContract_CTE fl
                       ON  fl.SaleContractItemID = sci.SaleContractItemID
                  LEFT JOIN OutGoingBasedOnSaleContract_CTE fl1
                       ON  fl1.SaleContractItemID = sci.SaleContractItemID
                  LEFT JOIN RemittanceBasedOnSaleContract_CTE fl2
                       ON  fl2.SaleContractItemID = sci.SaleContractItemID
           GROUP BY
                  sci.SaleContractItemID
       ) T
       INNER JOIN SLE.SaleContractItem  AS sci2
            ON  sci2.SaleContractItemID = T.SaleContractItemID
       INNER JOIN STF.[Stuff]           AS s
            ON  s.StuffID = sci2.StuffID;

