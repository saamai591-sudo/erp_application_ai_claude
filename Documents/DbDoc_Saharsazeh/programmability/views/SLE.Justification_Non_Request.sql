
CREATE VIEW [SLE].[Justification_Non_Request]
AS
    SELECT src.JustificationItemID ,
           src.MainQuantity ,
           src.SubQuantity ,
           src.doMain ,
           src.doSub ,
           src.MainQuantity - src.doMain AS Non ,
           src.SubQuantity - src.doSub AS NonSub
    FROM   (   SELECT ji.JustificationItemID ,
                      ji.MainQuantity ,
                      ji.SubQuantity ,
                      ISNULL(used1.MainQuantity, 0)
                      + ISNULL(used3.MainQuantity, 0)
                      + ISNULL(used4.MainQuantity, 0)
                      + ISNULL(used2.MainQuantity, 0)
                      + ISNULL(doOut1.MainQuantity, 0)
                      + ISNULL(doOut2.MainQuantity, 0)
                      + ISNULL(doOut3.MainQuantity, 0)
                      + ISNULL(doOut4.MainQuantity, 0)
                      + ISNULL(doJus1.MainQuantity, 0)
                      + ISNULL(doJus2.MainQuantity, 0)
                      + ISNULL(doJus3.MainQuantity, 0)
                      + ISNULL(doJus4.MainQuantity, 0)
                      + ISNULL(doJus5.MainQuantity, 0) doMain ,
                      ISNULL(used1.SubQuantity, 0)
                      + ISNULL(used2.SubQuantity, 0)
                      + ISNULL(used3.SubQuantity, 0)
                      + ISNULL(used4.SubQuantity, 0)
                      + ISNULL(doOut1.SubQuantity, 0)
                      + ISNULL(doOut2.SubQuantity, 0)
                      + ISNULL(doOut1.SubQuantity, 0)
                      + ISNULL(doOut2.SubQuantity, 0)
                      + ISNULL(doJus1.SubQuantity, 0)
                      + ISNULL(doJus2.SubQuantity, 0)
                      + ISNULL(doJus3.SubQuantity, 0)
                      + ISNULL(doJus4.SubQuantity, 0)
                      + ISNULL(doJus5.SubQuantity, 0) doSub
               FROM   SLE.JustificationItem AS ji
                      LEFT JOIN (   SELECT   ji.JustificationItemID ,
                                             SUM(pri.MainQuantity) MainQuantity ,
                                             SUM(ISNULL(pri.SubQuantity, 0)) AS SubQuantity
                                    FROM     SLE.JustificationItem AS ji
                                             JOIN REQ.PurchaseRequestItem AS pri ON pri.JustificationItemID = ji.JustificationItemID
                                    GROUP BY ji.JustificationItemID ) used1 ON used1.JustificationItemID = ji.JustificationItemID
                      LEFT JOIN (   SELECT   ji.JustificationItemID ,
                                             SUM(pri.MainQuantity) MainQuantity ,
                                             SUM(ISNULL(pri.SubQuantity, 0)) AS SubQuantity
                                    FROM     SLE.JustificationItem AS ji
                                             JOIN SLE.QuotationItem AS qi ON qi.JustificationItemID = ji.JustificationItemID
                                             JOIN REQ.PurchaseRequestItem AS pri ON pri.QuotationItemID = qi.QuotationItemID
                                    GROUP BY ji.JustificationItemID ) used2 ON used2.JustificationItemID = ji.JustificationItemID
                      LEFT JOIN (   SELECT   ji.JustificationItemID ,
                                             SUM(pri.MainQuantity) MainQuantity ,
                                             SUM(ISNULL(pri.SubQuantity, 0)) AS SubQuantity
                                    FROM     SLE.JustificationItem AS ji
                                             JOIN SLE.QuotationItem AS qi ON qi.JustificationItemID = ji.JustificationItemID
                                             JOIN SLE.SaleContractItem AS sci ON sci.QuotationItemID = qi.QuotationItemID
                                             JOIN REQ.PurchaseRequestItem AS pri ON pri.SaleContractItemID = sci.SaleContractItemID
                                    GROUP BY ji.JustificationItemID ) used3 ON used3.JustificationItemID = ji.JustificationItemID
                      LEFT JOIN (   SELECT   ji.JustificationItemID ,
                                             SUM(pri.MainQuantity) MainQuantity ,
                                             SUM(ISNULL(pri.SubQuantity, 0)) AS SubQuantity
                                    FROM     SLE.JustificationItem AS ji
                                             JOIN CTM.OrderItem AS oi ON oi.OrderItemID = ji.OrderItemID
                                             JOIN REQ.PurchaseRequestItem AS pri ON pri.OrderItemID = oi.OrderItemID
                                    GROUP BY ji.JustificationItemID ) used4 ON used4.JustificationItemID = ji.JustificationItemID
                      LEFT JOIN (   SELECT   ji.JustificationItemID ,
                                             SUM(oi.MainQuantity) MainQuantity ,
                                             SUM(ISNULL(oi.SubQuantity, 0)) SubQuantity
                                    FROM     SLE.JustificationItem AS ji
                                             JOIN STC.OutgoingItem AS oi ON oi.JustificationItemID = ji.JustificationItemID
                                    GROUP BY ji.JustificationItemID ) doOut1 ON doOut1.JustificationItemID = ji.JustificationItemID
                      LEFT JOIN (   SELECT   ji.JustificationItemID ,
                                             SUM(oi.MainQuantity) MainQuantity ,
                                             SUM(ISNULL(oi.SubQuantity, 0)) SubQuantity
                                    FROM     SLE.JustificationItem AS ji
                                             JOIN SLE.InvoiceItem AS ii ON ii.JustificationItemID = ji.JustificationItemID
                                             JOIN STC.OutgoingItem AS oi ON oi.InvoiceItemID = ii.InvoiceItemID
                                    GROUP BY ji.JustificationItemID ) doOut2 ON doOut2.JustificationItemID = ji.JustificationItemID
                      LEFT JOIN (   SELECT   ji.JustificationItemID ,
                                             SUM(oi.MainQuantity) MainQuantity ,
                                             SUM(ISNULL(oi.SubQuantity, 0)) SubQuantity
                                    FROM     SLE.JustificationItem AS ji
                                             JOIN SLE.QuotationItem AS qi ON qi.JustificationItemID = ji.JustificationItemID
                                             JOIN STC.OutgoingItem AS oi ON oi.QuotationItemID = qi.QuotationItemID
                                    GROUP BY ji.JustificationItemID ) doOut3 ON doOut3.JustificationItemID = ji.JustificationItemID
                      LEFT JOIN (   SELECT   ji.JustificationItemID ,
                                             SUM(oi.MainQuantity) MainQuantity ,
                                             SUM(ISNULL(oi.SubQuantity, 0)) SubQuantity
                                    FROM     SLE.JustificationItem AS ji
                                             JOIN SLE.QuotationItem AS qi ON qi.JustificationItemID = ji.JustificationItemID
                                             JOIN SLE.SaleContractItem AS sci ON sci.QuotationItemID = qi.QuotationItemID
                                             JOIN STC.OutgoingItem AS oi ON oi.SaleContractItemID = sci.SaleContractItemID
                                    GROUP BY ji.JustificationItemID ) doOut4 ON doOut4.JustificationItemID = ji.JustificationItemID
                      LEFT JOIN (   SELECT   ji.JustificationItemID ,
                                             SUM(oi.MainQuantity) MainQuantity ,
                                             SUM(ISNULL(oi.SubQuantity, 0)) SubQuantity
                                    FROM     SLE.JustificationItem AS ji
                                             JOIN SLE.QuotationItem AS qi ON qi.JustificationItemID = ji.JustificationItemID
                                             JOIN SLE.SaleContractItem AS sci ON sci.QuotationItemID = qi.QuotationItemID
                                             JOIN SLE.InvoiceItem AS ii ON ii.SaleContractItemID = sci.SaleContractItemID
                                             JOIN STC.OutgoingItem AS oi ON oi.InvoiceItemID = ii.InvoiceItemID
                                    GROUP BY ji.JustificationItemID ) doOut5 ON doOut5.JustificationItemID = ji.JustificationItemID
                      LEFT JOIN (   SELECT   ji.JustificationItemID ,
                                             SUM(oi.MainQuantity) MainQuantity ,
                                             SUM(ISNULL(oi.SubQuantity, 0)) SubQuantity
                                    FROM     SLE.JustificationItem AS ji
                                             JOIN SLE.QuotationItem AS qi ON qi.JustificationItemID = ji.JustificationItemID
                                             JOIN SLE.InvoiceItem AS ii ON ii.QuotationItemID = qi.QuotationItemID
                                             JOIN STC.OutgoingItem AS oi ON oi.InvoiceItemID = ii.InvoiceItemID
                                    GROUP BY ji.JustificationItemID ) doOut6 ON doOut6.JustificationItemID = ji.JustificationItemID
                      LEFT JOIN (   SELECT   ji.JustificationItemID ,
                                             SUM(ri.MainQuantity) AS MainQuantity ,
                                             SUM(ri.SubQuantity) AS SubQuantity
                                    FROM     SLE.JustificationItem AS ji
                                             JOIN SLE.InvoiceItem AS ii ON ii.JustificationItemID = ji.JustificationItemID
                                             JOIN SLE.RemittanceItem AS ri ON ri.InvoiceItemID = ii.InvoiceItemID
                                    GROUP BY ji.JustificationItemID ) doJus1 ON doJus1.JustificationItemID = ji.JustificationItemID
                      LEFT JOIN (   SELECT   ji.JustificationItemID ,
                                             SUM(ri.MainQuantity) AS MainQuantity ,
                                             SUM(ri.SubQuantity) AS SubQuantity
                                    FROM     SLE.JustificationItem AS ji
                                             JOIN SLE.RemittanceItem AS ri ON ri.JustificationItemID = ji.JustificationItemID
                                    GROUP BY ji.JustificationItemID ) doJus2 ON doJus2.JustificationItemID = ji.JustificationItemID
                      LEFT JOIN (   SELECT   ji.JustificationItemID ,
                                             SUM(ri.MainQuantity) AS MainQuantity ,
                                             SUM(ri.SubQuantity) AS SubQuantity
                                    FROM     SLE.JustificationItem AS ji
                                             JOIN SLE.QuotationItem AS qi ON qi.JustificationItemID = ji.JustificationItemID
                                             JOIN SLE.SaleContractItem AS sci ON sci.QuotationItemID = qi.QuotationItemID
                                             JOIN SLE.RemittanceItem AS ri ON ri.SaleContractItemID = sci.SaleContractItemID
                                    GROUP BY ji.JustificationItemID ) doJus3 ON doJus3.JustificationItemID = ji.JustificationItemID
                      LEFT JOIN (   SELECT   ji.JustificationItemID ,
                                             SUM(ri.MainQuantity) AS MainQuantity ,
                                             SUM(ri.SubQuantity) AS SubQuantity
                                    FROM     SLE.JustificationItem AS ji
                                             JOIN SLE.QuotationItem AS qi ON qi.JustificationItemID = ji.JustificationItemID
                                             JOIN SLE.RemittanceItem AS ri ON ri.QuotationItemID = qi.QuotationItemID
                                    GROUP BY ji.JustificationItemID ) doJus4 ON doJus4.JustificationItemID = ji.JustificationItemID
                      LEFT JOIN (   SELECT   ji.JustificationItemID ,
                                             SUM(ri.MainQuantity) AS MainQuantity ,
                                             SUM(ri.SubQuantity) AS SubQuantity
                                    FROM     SLE.JustificationItem AS ji
                                             JOIN SLE.QuotationItem AS qi ON qi.JustificationItemID = ji.JustificationItemID
                                             JOIN SLE.InvoiceItem AS ii ON ii.QuotationItemID = qi.QuotationItemID
                                             JOIN SLE.RemittanceItem AS ri ON ri.InvoiceItemID = ii.InvoiceItemID
                                    GROUP BY ji.JustificationItemID ) doJus5 ON doJus5.JustificationItemID = ji.JustificationItemID ) src;
