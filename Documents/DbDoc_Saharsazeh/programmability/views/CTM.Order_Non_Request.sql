
CREATE VIEW [CTM].[Order_Non_Request]
AS
SELECT Src.OrderItemID,
       Src.MainQuantity,
       Src.SubQuantity,
       Src.DoReqMain,
       Src.OutMianQuantity,
       Src.RemittanceMianQuantity,
       Src.MainQuantity - Src.DoReqMain - Src.OutMianQuantity
       - Src.RemittanceMianQuantity  AS Non,
       Src.SubQuantity - Src.DoReqSub - Src.OutSubQuantity
       - Src.RemittanceSubQuantity   AS NonSub
FROM   (
           SELECT oi.OrderItemID,
                  oi.MainQuantity,
                  oi.SubQuantity,
                  ISNULL(use1.MainQuantity, 0)
                  + ISNULL(use2.MainQuantity, 0)
                  + ISNULL(use3.MainQuantity, 0)
                  + ISNULL(use4.MainQuantity, 0)
                  + ISNULL(use5.MainQuantity, 0)
                  + ISNULL(use6.MainQuantity, 0) AS DoReqMain,
                  ISNULL(use1.SubQuantity, 0) + ISNULL(use2.SubQuantity, 0)
                  + ISNULL(use3.SubQuantity, 0)
                  + ISNULL(use4.SubQuantity, 0)
                  + ISNULL(use5.SubQuantity, 0)
                  + ISNULL(use6.SubQuantity, 0) AS DoReqSub,
                  ISNULL(doOut1.MainQuantity, 0)
                  + ISNULL(doOut2.MainQuantity, 0)
                  + ISNULL(doOut3.MainQuantity, 0)
                  + ISNULL(doOut4.MainQuantity, 0)
                  + ISNULL(doOut5.MainQuantity, 0)
                  + ISNULL(doOut6.MainQuantity, 0)
                  + ISNULL(doOut7.MainQuantity, 0)
                  + ISNULL(doOut8.MainQuantity, 0)
                  + ISNULL(doOut9.MainQuantity, 0)
                  + ISNULL(doOut10.MainQuantity, 0) OutMianQuantity,
                  ISNULL(doOut1.SubQuantity, 0)
                  + ISNULL(doOut2.SubQuantity, 0)
                  + ISNULL(doOut3.SubQuantity, 0)
                  + ISNULL(doOut4.SubQuantity, 0)
                  + ISNULL(doOut5.SubQuantity, 0)
                  + ISNULL(doOut6.SubQuantity, 0)
                  + ISNULL(doOut7.SubQuantity, 0)
                  + ISNULL(doOut8.SubQuantity, 0)
                  + ISNULL(doOut9.SubQuantity, 0)
                  + ISNULL(doOut10.SubQuantity, 0) OutSubQuantity,
                  ISNULL(doRem1.MainQuantity, 0)
                  + ISNULL(doRem2.MainQuantity, 0)
                  + ISNULL(doRem3.MainQuantity, 0)
                  + ISNULL(doRem4.MainQuantity, 0)
                  + ISNULL(doRem5.MainQuantity, 0)
                  + ISNULL(doRem6.MainQuantity, 0)
                  + ISNULL(doRem7.MainQuantity, 0) RemittanceMianQuantity,
                  ISNULL(doRem1.SubQuantity, 0)
                  + ISNULL(doRem2.SubQuantity, 0)
                  + ISNULL(doRem3.SubQuantity, 0)
                  + ISNULL(doRem4.SubQuantity, 0)
                  + ISNULL(doRem5.SubQuantity, 0)
                  + ISNULL(doRem6.SubQuantity, 0)
                  + ISNULL(doRem7.SubQuantity, 0) RemittanceSubQuantity
           FROM   CTM.OrderItem AS oi
                  LEFT JOIN (
                           SELECT oi.OrderItemID,
                                  SUM(ISNULL(pri.MainQuantity, 0)) MainQuantity,
                                  SUM(ISNULL(pri.SubQuantity, 0)) SubQuantity
                           FROM   CTM.OrderItem AS oi
                                  JOIN REQ.PurchaseRequestItem AS pri
                                       ON  pri.OrderItemID = oi.OrderItemID
                           GROUP BY
                                  oi.OrderItemID
                       ) use1
                       ON  use1.OrderItemID = oi.OrderItemID
                  LEFT JOIN (
                           SELECT oi.OrderItemID,
                                  SUM(ISNULL(pri.MainQuantity, 0)) MainQuantity,
                                  SUM(ISNULL(pri.SubQuantity, 0)) SubQuantity
                           FROM   CTM.OrderItem AS oi
                                  JOIN SLE.JustificationItem AS ji
                                       ON  ji.OrderItemID = oi.OrderItemID
                                  JOIN REQ.PurchaseRequestItem AS pri
                                       ON  pri.JustificationItemID = ji.JustificationItemID
                           GROUP BY
                                  oi.OrderItemID
                       ) use2
                       ON  use2.OrderItemID = oi.OrderItemID
                  LEFT JOIN (
                           SELECT oi.OrderItemID,
                                  SUM(ISNULL(pri.MainQuantity, 0)) MainQuantity,
                                  SUM(ISNULL(pri.SubQuantity, 0)) SubQuantity
                           FROM   CTM.OrderItem AS oi
                                  JOIN SLE.JustificationItem AS ji
                                       ON  ji.OrderItemID = oi.OrderItemID
                                  JOIN SLE.QuotationItem AS qi
                                       ON  qi.JustificationItemID = ji.JustificationItemID
                                  JOIN REQ.PurchaseRequestItem AS pri
                                       ON  pri.QuotationItemID = qi.QuotationItemID
                           GROUP BY
                                  oi.OrderItemID
                       ) use3
                       ON  use3.OrderItemID = oi.OrderItemID
                  LEFT JOIN (
                           SELECT oi.OrderItemID,
                                  SUM(ISNULL(pri.MainQuantity, 0)) MainQuantity,
                                  SUM(ISNULL(pri.SubQuantity, 0)) SubQuantity
                           FROM   CTM.OrderItem AS oi
                                  JOIN SLE.JustificationItem AS ji
                                       ON  ji.OrderItemID = oi.OrderItemID
                                  JOIN SLE.QuotationItem AS qi
                                       ON  qi.JustificationItemID = ji.JustificationItemID
                                  JOIN SLE.SaleContractItem AS sci
                                       ON  sci.QuotationItemID = qi.QuotationItemID
                                  JOIN REQ.PurchaseRequestItem AS pri
                                       ON  pri.SaleContractItemID = sci.SaleContractItemID
                           GROUP BY
                                  oi.OrderItemID
                       ) use4
                       ON  use4.OrderItemID = oi.OrderItemID
                  LEFT JOIN (
                           SELECT oi.OrderItemID,
                                  SUM(ISNULL(pri.MainQuantity, 0)) MainQuantity,
                                  SUM(ISNULL(pri.SubQuantity, 0)) SubQuantity
                           FROM   CTM.OrderItem AS oi
                                  JOIN SLE.QuotationItem AS qi
                                       ON  qi.OrderItemID = oi.OrderItemID
                                  JOIN REQ.PurchaseRequestItem AS pri
                                       ON  pri.OrderItemID = oi.OrderItemID
                           GROUP BY
                                  oi.OrderItemID
                       ) use5
                       ON  use5.OrderItemID = oi.OrderItemID
                  LEFT JOIN (
                           SELECT oi.OrderItemID,
                                  SUM(ISNULL(pri.MainQuantity, 0)) MainQuantity,
                                  SUM(ISNULL(pri.SubQuantity, 0)) SubQuantity
                           FROM   CTM.OrderItem AS oi
                                  JOIN SLE.QuotationItem AS qi
                                       ON  qi.OrderItemID = oi.OrderItemID
                                  JOIN SLE.SaleContractItem AS sci
                                       ON  sci.QuotationItemID = qi.QuotationItemID
                                  JOIN REQ.PurchaseRequestItem AS pri
                                       ON  pri.SaleContractItemID = sci.SaleContractItemID
                           GROUP BY
                                  oi.OrderItemID
                       ) use6
                       ON  use6.OrderItemID = oi.OrderItemID
                  LEFT JOIN (
                           SELECT oi.OrderItemID,
                                  SUM(oi2.MainQuantity) MainQuantity,
                                  SUM(ISNULL(oi2.SubQuantity, 0)) SubQuantity
                           FROM   CTM.OrderItem AS oi
                                  JOIN SLE.JustificationItem AS ji
                                       ON  ji.OrderItemID = oi.OrderItemID
                                  JOIN STC.OutgoingItem AS oi2
                                       ON  oi2.JustificationItemID = ji.JustificationItemID
                           GROUP BY
                                  oi.OrderItemID
                       ) doOut1
                       ON  doOut1.OrderItemID = oi.OrderItemID
                  LEFT JOIN (
                           SELECT oi.OrderItemID,
                                  SUM(oi2.MainQuantity) MainQuantity,
                                  SUM(ISNULL(oi2.SubQuantity, 0)) SubQuantity
                           FROM   CTM.OrderItem AS oi
                                  JOIN SLE.JustificationItem AS ji
                                       ON  ji.OrderItemID = oi.OrderItemID
                                  JOIN SLE.InvoiceItem AS ii
                                       ON  ii.JustificationItemID = ji.JustificationItemID
                                  JOIN STC.OutgoingItem AS oi2
                                       ON  oi2.InvoiceItemID = ii.InvoiceItemID
                           GROUP BY
                                  oi.OrderItemID
                       ) doOut2
                       ON  doOut2.OrderItemID = oi.OrderItemID
                  LEFT JOIN (
                           SELECT oi.OrderItemID,
                                  SUM(oi2.MainQuantity) MainQuantity,
                                  SUM(ISNULL(oi2.SubQuantity, 0)) SubQuantity
                           FROM   CTM.OrderItem AS oi
                                  JOIN SLE.JustificationItem AS ji
                                       ON  ji.OrderItemID = oi.OrderItemID
                                  JOIN SLE.QuotationItem AS qi
                                       ON  qi.JustificationItemID = ji.JustificationItemID
                                  JOIN STC.OutgoingItem AS oi2
                                       ON  oi2.QuotationItemID = qi.QuotationItemID
                           GROUP BY
                                  oi.OrderItemID
                       ) doOut3
                       ON  doOut3.OrderItemID = oi.OrderItemID
                  LEFT JOIN (
                           SELECT oi.OrderItemID,
                                  SUM(oi2.MainQuantity) MainQuantity,
                                  SUM(ISNULL(oi2.SubQuantity, 0)) SubQuantity
                           FROM   CTM.OrderItem AS oi
                                  JOIN SLE.JustificationItem AS ji
                                       ON  ji.OrderItemID = oi.OrderItemID
                                  JOIN SLE.QuotationItem AS qi
                                       ON  qi.JustificationItemID = ji.JustificationItemID
                                  JOIN SLE.SaleContractItem AS sci
                                       ON  sci.QuotationItemID = qi.QuotationItemID
                                  JOIN STC.OutgoingItem AS oi2
                                       ON  oi2.SaleContractItemID = sci.SaleContractItemID
                           GROUP BY
                                  oi.OrderItemID
                       ) doOut4
                       ON  doOut4.OrderItemID = oi.OrderItemID
                  LEFT JOIN (
                           SELECT oi.OrderItemID,
                                  SUM(oi2.MainQuantity) MainQuantity,
                                  SUM(ISNULL(oi2.SubQuantity, 0)) SubQuantity
                           FROM   CTM.OrderItem AS oi
                                  JOIN SLE.JustificationItem AS ji
                                       ON  ji.OrderItemID = oi.OrderItemID
                                  JOIN SLE.QuotationItem AS qi
                                       ON  qi.JustificationItemID = ji.JustificationItemID
                                  JOIN SLE.SaleContractItem AS sci
                                       ON  sci.QuotationItemID = qi.QuotationItemID
                                  JOIN SLE.InvoiceItem AS ii
                                       ON  ii.SaleContractItemID = sci.SaleContractItemID
                                  JOIN STC.OutgoingItem AS oi2
                                       ON  oi2.InvoiceItemID = ii.InvoiceItemID
                           GROUP BY
                                  oi.OrderItemID
                       ) doOut5
                       ON  doOut5.OrderItemID = oi.OrderItemID
                  LEFT JOIN (
                           SELECT oi.OrderItemID,
                                  SUM(oi2.MainQuantity) MainQuantity,
                                  SUM(ISNULL(oi2.SubQuantity, 0)) SubQuantity
                           FROM   CTM.OrderItem AS oi
                                  JOIN SLE.JustificationItem AS ji
                                       ON  ji.OrderItemID = oi.OrderItemID
                                  JOIN SLE.QuotationItem AS qi
                                       ON  qi.JustificationItemID = ji.JustificationItemID
                                  JOIN SLE.InvoiceItem AS ii
                                       ON  ii.QuotationItemID = qi.QuotationItemID
                                  JOIN STC.OutgoingItem AS oi2
                                       ON  oi2.InvoiceItemID = ii.InvoiceItemID
                           GROUP BY
                                  oi.OrderItemID
                       ) doOut6
                       ON  doOut6.OrderItemID = oi.OrderItemID
                  LEFT JOIN (
                           SELECT oi.OrderItemID,
                                  SUM(oi2.MainQuantity) MainQuantity,
                                  SUM(ISNULL(oi2.SubQuantity, 0)) SubQuantity
                           FROM   CTM.OrderItem AS oi
                                  JOIN SLE.QuotationItem AS qi
                                       ON  qi.OrderItemID = oi.OrderItemID
                                  JOIN STC.OutgoingItem AS oi2
                                       ON  oi2.QuotationItemID = qi.QuotationItemID
                           GROUP BY
                                  oi.OrderItemID
                       ) doOut7
                       ON  doOut7.OrderItemID = oi.OrderItemID
                  LEFT JOIN (
                           SELECT oi.OrderItemID,
                                  SUM(oi2.MainQuantity) MainQuantity,
                                  SUM(ISNULL(oi2.SubQuantity, 0)) SubQuantity
                           FROM   CTM.OrderItem AS oi
                                  JOIN SLE.QuotationItem AS qi
                                       ON  qi.OrderItemID = oi.OrderItemID
                                  JOIN SLE.SaleContractItem AS sci
                                       ON  sci.QuotationItemID = qi.QuotationItemID
                                  JOIN STC.OutgoingItem AS oi2
                                       ON  oi2.SaleContractItemID = sci.SaleContractItemID
                           GROUP BY
                                  oi.OrderItemID
                       ) doOut8
                       ON  doOut8.OrderItemID = oi.OrderItemID
                  LEFT JOIN (
                           SELECT oi.OrderItemID,
                                  SUM(oi2.MainQuantity) MainQuantity,
                                  SUM(ISNULL(oi2.SubQuantity, 0)) SubQuantity
                           FROM   CTM.OrderItem AS oi
                                  JOIN SLE.QuotationItem AS qi
                                       ON  qi.OrderItemID = oi.OrderItemID
                                  JOIN SLE.SaleContractItem AS sci
                                       ON  sci.QuotationItemID = qi.QuotationItemID
                                  JOIN SLE.InvoiceItem AS ii
                                       ON  ii.SaleContractItemID = sci.SaleContractItemID
                                  JOIN STC.OutgoingItem AS oi2
                                       ON  oi2.InvoiceItemID = ii.InvoiceItemID
                           GROUP BY
                                  oi.OrderItemID
                       ) doOut9
                       ON  doOut9.OrderItemID = oi.OrderItemID
                  LEFT JOIN (
                           SELECT oi.OrderItemID,
                                  SUM(oi2.MainQuantity) MainQuantity,
                                  SUM(ISNULL(oi2.SubQuantity, 0)) SubQuantity
                           FROM   CTM.OrderItem AS oi
                                  JOIN SLE.QuotationItem AS qi
                                       ON  qi.OrderItemID = oi.OrderItemID
                                  JOIN SLE.InvoiceItem AS ii
                                       ON  ii.QuotationItemID = qi.QuotationItemID
                                  JOIN STC.OutgoingItem AS oi2
                                       ON  oi2.InvoiceItemID = ii.InvoiceItemID
                           GROUP BY
                                  oi.OrderItemID
                       ) doOut10
                       ON  doOut10.OrderItemID = oi.OrderItemID
                  LEFT JOIN (
                           SELECT oi.OrderItemID,
                                  SUM(ri.MainQuantity) MainQuantity,
                                  SUM(ISNULL(ri.SubQuantity, 0)) SubQuantity
                           FROM   CTM.OrderItem AS oi
                                  JOIN SLE.JustificationItem AS ji
                                       ON  ji.OrderItemID = oi.OrderItemID
                                  JOIN SLE.InvoiceItem AS ii
                                       ON  ii.JustificationItemID = ji.JustificationItemID
                                  JOIN SLE.RemittanceItem AS ri
                                       ON  ri.InvoiceItemID = ii.InvoiceItemID
                           GROUP BY
                                  oi.OrderItemID
                       ) doRem1
                       ON  doRem1.OrderItemID = oi.OrderItemID
                  LEFT JOIN (
                           SELECT oi.OrderItemID,
                                  SUM(ri.MainQuantity) MainQuantity,
                                  SUM(ISNULL(ri.SubQuantity, 0)) SubQuantity
                           FROM   CTM.OrderItem AS oi
                                  JOIN SLE.JustificationItem AS ji
                                       ON  ji.OrderItemID = oi.OrderItemID
                                  JOIN SLE.RemittanceItem AS ri
                                       ON  ri.JustificationItemID = ji.JustificationItemID
                           GROUP BY
                                  oi.OrderItemID
                       ) doRem2
                       ON  doRem2.OrderItemID = oi.OrderItemID
                  LEFT JOIN (
                           SELECT oi.OrderItemID,
                                  SUM(ri.MainQuantity) MainQuantity,
                                  SUM(ISNULL(ri.SubQuantity, 0)) SubQuantity
                           FROM   CTM.OrderItem AS oi
                                  JOIN SLE.JustificationItem AS ji
                                       ON  ji.OrderItemID = oi.OrderItemID
                                  JOIN SLE.QuotationItem AS qi
                                       ON  qi.JustificationItemID = ji.JustificationItemID
                                  JOIN SLE.SaleContractItem AS sci
                                       ON  sci.QuotationItemID = qi.QuotationItemID
                                  JOIN SLE.RemittanceItem AS ri
                                       ON  ri.SaleContractItemID = sci.SaleContractItemID
                           GROUP BY
                                  oi.OrderItemID
                       ) doRem3
                       ON  doRem3.OrderItemID = oi.OrderItemID
                  LEFT JOIN (
                           SELECT oi.OrderItemID,
                                  SUM(ri.MainQuantity) MainQuantity,
                                  SUM(ISNULL(ri.SubQuantity, 0)) SubQuantity
                           FROM   CTM.OrderItem AS oi
                                  JOIN SLE.JustificationItem AS ji
                                       ON  ji.OrderItemID = oi.OrderItemID
                                  JOIN SLE.QuotationItem AS qi
                                       ON  qi.JustificationItemID = ji.JustificationItemID
                                  JOIN SLE.RemittanceItem AS ri
                                       ON  ri.QuotationItemID = qi.QuotationItemID
                           GROUP BY
                                  oi.OrderItemID
                       ) doRem4
                       ON  doRem4.OrderItemID = oi.OrderItemID
                  LEFT JOIN (
                           SELECT oi.OrderItemID,
                                  SUM(ri.MainQuantity) MainQuantity,
                                  SUM(ISNULL(ri.SubQuantity, 0)) SubQuantity
                           FROM   CTM.OrderItem AS oi
                                  JOIN SLE.JustificationItem AS ji
                                       ON  ji.OrderItemID = oi.OrderItemID
                                  JOIN SLE.QuotationItem AS qi
                                       ON  qi.JustificationItemID = ji.JustificationItemID
                                  JOIN SLE.InvoiceItem AS ii
                                       ON  ii.QuotationItemID = qi.QuotationItemID
                                  JOIN SLE.RemittanceItem AS ri
                                       ON  ri.InvoiceItemID = ii.InvoiceItemID
                           GROUP BY
                                  oi.OrderItemID
                       ) doRem5
                       ON  doRem5.OrderItemID = oi.OrderItemID
                  LEFT JOIN (
                           SELECT oi.OrderItemID,
                                  SUM(ri.MainQuantity) MainQuantity,
                                  SUM(ISNULL(ri.SubQuantity, 0)) SubQuantity
                           FROM   CTM.OrderItem AS oi
                                  JOIN SLE.QuotationItem AS qi
                                       ON  qi.OrderItemID = oi.OrderItemID
                                  JOIN SLE.InvoiceItem AS ii
                                       ON  ii.QuotationItemID = qi.QuotationItemID
                                  JOIN SLE.RemittanceItem AS ri
                                       ON  ri.InvoiceItemID = ii.InvoiceItemID
                           GROUP BY
                                  oi.OrderItemID
                       ) doRem6
                       ON  doRem6.OrderItemID = oi.OrderItemID
                  LEFT JOIN (
                           SELECT oi.OrderItemID,
                                  SUM(ri.MainQuantity) MainQuantity,
                                  SUM(ISNULL(ri.SubQuantity, 0)) SubQuantity
                           FROM   CTM.OrderItem AS oi
                                  JOIN SLE.QuotationItem AS qi
                                       ON  qi.OrderItemID = oi.OrderItemID
                                  JOIN SLE.RemittanceItem AS ri
                                       ON  ri.QuotationItemID = qi.QuotationItemID
                           GROUP BY
                                  oi.OrderItemID
                       ) doRem7
                       ON  doRem7.OrderItemID = oi.OrderItemID
       )                             AS Src;
