
-------------------End NoTask2

------------------------------------- START #NoTask3

CREATE   VIEW SLE.SaleContract_Non_Outgoing
AS
SELECT sci2.SaleContractItemID,
       sci2.StuffID,
       sc.BranchID,
       sci2.MainQuantity,
       sci2.SubQuantity,
       T.DoMainQuantity,
       T.DoSubQuantity,
       CASE 
            WHEN s.[Type] = 1
                 OR MainQuantity < DoMainQuantity THEN 0
            ELSE MainQuantity - DoMainQuantity
       END                              AS Non,
       CASE 
            WHEN s.[Type] = 1
                 OR SubQuantity < DoSubQuantity THEN 0
            ELSE SubQuantity - DoSubQuantity
       END                              AS SubNon
FROM   (
           SELECT sci.SaleContractItemID,
                  ISNULL(fl.MainQuantity, 0)+ISNULL(cio.MainQuantity,0)+ISNULL(cro.MainQuantity,0)+
                  ISNULL(crio.MainQuantity,0)+ISNULL(ciro.MainQuantity,0)   AS DoMainQuantity,
                   ISNULL(fl.SubQuantity, 0)+ISNULL(cio.SubQuantity,0)+ISNULL(cro.SubQuantity,0)+
                  ISNULL(crio.SubQuantity,0)+ISNULL(ciro.SubQuantity,0)  AS DoSubQuantity
           FROM   SLE.SaleContractItem AS sci
                  LEFT JOIN (
                           SELECT ii2.SaleContractItemID,
                                  SUM(ii2.MainQuantity) MainQuantity,
                                  SUM(ii2.SubQuantity) SubQuantity
                           FROM   STC.OutgoingItem AS ii2
                           GROUP BY
                                  ii2.SaleContractItemID
                       ) fl
                       ON  fl.SaleContractItemID = sci.SaleContractItemID
                  left JOIN (
                           SELECT ii.SaleContractItemID,
                                  SUM(oi.MainQuantity) MainQuantity,
                                  SUM(oi.SubQuantity) SubQuantity
                           FROM   sle.InvoiceItem AS ii
                                  JOIN stc.OutgoingItem AS oi
                                       ON  ii.InvoiceItemID = oi.InvoiceItemID
                           WHERE  ii.SaleContractItemID is NOT NULL
                           GROUP BY
                                  ii.SaleContractItemID
                       ) cio
                       ON  sci.SaleContractItemID = cio.SaleContractItemID
                       
                  left JOIN (
                           SELECT ri.SaleContractItemID,
                                  SUM(oi.MainQuantity) MainQuantity,
                                  SUM(oi.SubQuantity) SubQuantity
                           FROM   sle.RemittanceItem AS ri 
                                  JOIN stc.OutgoingItem AS oi
                                       ON  ri.RemittanceItemID = oi.RemittanceItemID
                           WHERE  ri.SaleContractItemID is NOT NULL
                           GROUP BY
                                  ri.SaleContractItemID
                       ) cro
                       ON  sci.SaleContractItemID = cro.SaleContractItemID  
                  left JOIN (
                           SELECT ri.SaleContractItemID,
                                  SUM(oi.MainQuantity) MainQuantity,
                                  SUM(oi.SubQuantity) SubQuantity
                           FROM   sle.RemittanceItem AS ri 
                           join sle.InvoiceItem AS ii on ri.RemittanceItemID = ii.RemittanceItemID
                                  JOIN stc.OutgoingItem AS oi
                                       ON  ii.InvoiceItemID = oi.InvoiceItemID
                           WHERE  ri.SaleContractItemID is NOT NULL
                           GROUP BY
                                  ri.SaleContractItemID
                       ) crio
                       ON  sci.SaleContractItemID = crio.SaleContractItemID      
                  left JOIN (
                           SELECT ri.SaleContractItemID,
                                  SUM(oi.MainQuantity) MainQuantity,
                                  SUM(oi.SubQuantity) SubQuantity
                           FROM   sle.InvoiceItem AS ii 
                           join sle.RemittanceItem AS ri on ii.InvoiceItemID = ri.InvoiceItemID
                                  JOIN stc.OutgoingItem AS oi
                                       ON  ri.RemittanceItemID = oi.RemittanceItemID
                           WHERE  ii.SaleContractItemID is NOT NULL
                           GROUP BY
                                  ri.SaleContractItemID
                       ) ciro
                       ON  sci.SaleContractItemID = ciro.SaleContractItemID                         
                                            
                       
       ) T
       INNER JOIN SLE.SaleContractItem  AS sci2
            ON  sci2.SaleContractItemID = T.SaleContractItemID
       INNER JOIN SLE.SaleContract      AS sc
            ON  sc.SaleContractID = sci2.SaleContractID
       INNER JOIN STF.[Stuff]           AS s
            ON  s.StuffID = sci2.StuffID;

