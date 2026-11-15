
CREATE VIEW [SLE].[SaleContract_Non_Request]
AS
    SELECT src.SaleContractItemID ,
           src.MainQuantity ,
           src.SubQuantity ,
           src.doMainQuantity ,
           src.doSubQuantity ,
           src.MainQuantity - src.doMainQuantity AS Non ,
           ISNULL(src.SubQuantity, 0) - src.doSubQuantity AS NonSub
    FROM   (   SELECT sci.SaleContractItemID ,
                      sci.MainQuantity ,
                      sci.SubQuantity ,
                      ISNULL(used1.MainQuantity, 0)
                      + ISNULL(usedH1.MainQuantity, 0)
                      + ISNULL(usedH2.MainQuantity, 0)
                      + ISNULL(usedH3.MainQuantity, 0)
                      + ISNULL(usedH4.MainQuantity, 0)
                      + ISNULL(doRem1.MainQuantity, 0)
                      + ISNULL(doOut1.MainQuantity, 0)
                      + ISNULL(doOut2.MainQuantity, 0) doMainQuantity ,
                      ISNULL(used1.SubQuantity, 0)
                      + ISNULL(usedH1.SubQuantity, 0)
                      + ISNULL(usedH2.SubQuantity, 0)
                      + ISNULL(usedH3.SubQuantity, 0)
                      + ISNULL(usedH4.SubQuantity, 0)
                      + ISNULL(doRem1.SubQuantity, 0)
                      + ISNULL(doOut1.SubQuantity, 0)
                      + ISNULL(doOut2.SubQuantity, 0) doSubQuantity
               FROM   SLE.SaleContractItem AS sci
                      LEFT JOIN (   SELECT   sci.SaleContractItemID ,
                                             SUM(pri.MainQuantity) MainQuantity ,
                                             SUM(ISNULL(pri.SubQuantity, 0)) SubQuantity
                                    FROM     SLE.SaleContractItem AS sci
                                             JOIN REQ.PurchaseRequestItem AS pri ON pri.SaleContractItemID = sci.SaleContractItemID
                                    GROUP BY sci.SaleContractItemID ) used1 ON used1.SaleContractItemID = sci.SaleContractItemID
                      LEFT JOIN (   SELECT   sci.SaleContractItemID ,
                                             SUM(pri.MainQuantity) MainQuantity ,
                                             SUM(ISNULL(pri.SubQuantity, 0)) SubQuantity
                                    FROM     SLE.SaleContractItem AS sci
                                             JOIN SLE.QuotationItem AS qi ON qi.QuotationItemID = sci.QuotationItemID
                                             JOIN REQ.PurchaseRequestItem AS pri ON pri.QuotationItemID = qi.QuotationItemID
                                    GROUP BY sci.SaleContractItemID ) usedH1 ON usedH1.SaleContractItemID = sci.SaleContractItemID
                      LEFT JOIN (   SELECT   sci.SaleContractItemID ,
                                             SUM(pri.MainQuantity) MainQuantity ,
                                             SUM(ISNULL(pri.SubQuantity, 0)) SubQuantity
                                    FROM     SLE.SaleContractItem AS sci
                                             JOIN SLE.QuotationItem AS qi ON qi.QuotationItemID = sci.QuotationItemID
                                             JOIN CTM.OrderItem AS oi ON oi.OrderItemID = qi.OrderItemID
                                             JOIN REQ.PurchaseRequestItem AS pri ON pri.OrderItemID = oi.OrderItemID
                                    GROUP BY sci.SaleContractItemID ) usedH2 ON usedH2.SaleContractItemID = sci.SaleContractItemID
                      LEFT JOIN (   SELECT   sci.SaleContractItemID ,
                                             SUM(pri.MainQuantity) MainQuantity ,
                                             SUM(ISNULL(pri.SubQuantity, 0)) SubQuantity
                                    FROM     SLE.SaleContractItem AS sci
                                             JOIN SLE.QuotationItem AS qi ON qi.QuotationItemID = sci.QuotationItemID
                                             JOIN SLE.JustificationItem AS ji ON ji.JustificationItemID = qi.JustificationItemID
                                             JOIN REQ.PurchaseRequestItem AS pri ON pri.JustificationItemID = ji.JustificationItemID
                                    GROUP BY sci.SaleContractItemID ) usedH3 ON usedH3.SaleContractItemID = sci.SaleContractItemID
                      LEFT JOIN (   SELECT   sci.SaleContractItemID ,
                                             SUM(pri.MainQuantity) MainQuantity ,
                                             SUM(ISNULL(pri.SubQuantity, 0)) SubQuantity
                                    FROM     SLE.SaleContractItem AS sci
                                             JOIN SLE.QuotationItem AS qi ON qi.QuotationItemID = sci.QuotationItemID
                                             JOIN SLE.JustificationItem AS ji ON ji.JustificationItemID = qi.JustificationItemID
                                             JOIN CTM.OrderItem AS oi ON oi.OrderItemID = ji.OrderItemID
                                             JOIN REQ.PurchaseRequestItem AS pri ON pri.OrderItemID = oi.OrderItemID
                                    GROUP BY sci.SaleContractItemID ) usedH4 ON usedH4.SaleContractItemID = sci.SaleContractItemID
                      LEFT JOIN (   SELECT   sci.SaleContractItemID ,
                                             SUM(ri.MainQuantity) MainQuantity ,
                                             SUM(ISNULL(ri.SubQuantity, 0)) SubQuantity
                                    FROM     SLE.SaleContractItem AS sci
                                             JOIN SLE.RemittanceItem AS ri ON ri.SaleContractItemID = sci.SaleContractItemID
                                    GROUP BY sci.SaleContractItemID ) doRem1 ON doRem1.SaleContractItemID = sci.SaleContractItemID
                      LEFT JOIN (   SELECT   sci.SaleContractItemID ,
                                             SUM(oi.MainQuantity) MainQuantity ,
                                             SUM(ISNULL(oi.SubQuantity, 0)) SubQuantity
                                    FROM     SLE.SaleContractItem AS sci
                                             JOIN STC.OutgoingItem AS oi ON oi.SaleContractItemID = sci.SaleContractItemID
                                    GROUP BY sci.SaleContractItemID ) doOut1 ON doOut1.SaleContractItemID = sci.SaleContractItemID
                      LEFT JOIN (   SELECT   sci.SaleContractItemID ,
                                             SUM(oi.MainQuantity) MainQuantity ,
                                             SUM(ISNULL(oi.SubQuantity, 0)) SubQuantity
                                    FROM     SLE.SaleContractItem AS sci
                                             JOIN SLE.InvoiceItem AS ii ON ii.SaleContractItemID = sci.SaleContractItemID
                                             JOIN STC.OutgoingItem AS oi ON oi.InvoiceItemID = ii.InvoiceItemID
                                    GROUP BY sci.SaleContractItemID ) doOut2 ON doOut2.SaleContractItemID = sci.SaleContractItemID ) src;
