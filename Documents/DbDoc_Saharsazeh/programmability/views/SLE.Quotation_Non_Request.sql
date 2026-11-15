
CREATE VIEW [SLE].[Quotation_Non_Request]
AS
    SELECT src.QuotationItemID ,
           src.MainQuantity ,
           src.SubQuantity ,
           src.doMainQuantity ,
           src.doSubQuantity ,
           src.MainQuantity - src.doMainQuantity AS Non ,
           ISNULL(src.SubQuantity, 0) - src.doSubQuantity AS NonSub
    FROM   (   SELECT qi.QuotationItemID ,
                      qi.MainQuantity ,
                      qi.SubQuantity ,
                      ISNULL(used1.MainQuantity, 0)
                      + ISNULL(used2.MainQuantity, 0)
                      + ISNULL(useH1.MainQuantity, 0)
                      + ISNULL(useH2.MainQuantity, 0)
                      + ISNULL(useH11.MainQuantity, 0)
                      + ISNULL(doOut1.MainQuantity, 0)
                      + ISNULL(doOut2.MainQuantity, 0)
                      + ISNULL(doOut3.MainQuantity, 0)
                      + ISNULL(doOut4.MainQuantity, 0)
                      + ISNULL(doRem1.MainQuantity, 0)
                      + ISNULL(doRem2.MainQuantity, 0)
                      + ISNULL(doRem3.MainQuantity, 0) doMainQuantity ,
                      ISNULL(used1.SubQuantity, 0)
                      + ISNULL(used2.SubQuantity, 0)
                      + ISNULL(useH1.SubQuantity, 0)
                      + ISNULL(useH11.SubQuantity, 0)
                      + ISNULL(useH2.SubQuantity, 0)
                      + ISNULL(doOut1.SubQuantity, 0)
                      + ISNULL(doOut2.SubQuantity, 0)
                      + ISNULL(doOut3.SubQuantity, 0)
                      + ISNULL(doOut4.SubQuantity, 0)
                      + ISNULL(doRem1.SubQuantity, 0)
                      + ISNULL(doRem2.SubQuantity, 0)
                      + ISNULL(doRem3.SubQuantity, 0) doSubQuantity
               FROM   SLE.QuotationItem AS qi
                      LEFT JOIN (   SELECT   qi.QuotationItemID ,
                                             SUM(pri.MainQuantity) MainQuantity ,
                                             SUM(ISNULL(pri.SubQuantity, 0)) SubQuantity
                                    FROM     SLE.QuotationItem AS qi
                                             JOIN REQ.PurchaseRequestItem AS pri ON pri.QuotationItemID = qi.QuotationItemID
                                    GROUP BY qi.QuotationItemID ) used1 ON used1.QuotationItemID = qi.QuotationItemID
                      LEFT JOIN (   SELECT   qi.QuotationItemID ,
                                             SUM(pri.MainQuantity) MainQuantity ,
                                             SUM(ISNULL(pri.SubQuantity, 0)) SubQuantity
                                    FROM     SLE.QuotationItem AS qi
                                             JOIN SLE.SaleContractItem AS sci ON sci.QuotationItemID = qi.QuotationItemID
                                             JOIN REQ.PurchaseRequestItem AS pri ON pri.SaleContractItemID = sci.SaleContractItemID
                                    GROUP BY qi.QuotationItemID ) used2 ON used2.QuotationItemID = qi.QuotationItemID
                      LEFT JOIN (   SELECT   qi.QuotationItemID ,
                                             SUM(pri.MainQuantity) MainQuantity ,
                                             SUM(ISNULL(pri.SubQuantity, 0)) SubQuantity
                                    FROM     SLE.QuotationItem AS qi
									JOIN SLE.JustificationItem AS ji ON ji.JustificationItemID = qi.JustificationItemID
                                             JOIN CTM.OrderItem AS oi ON oi.OrderItemID = ji.OrderItemID
                                             JOIN REQ.PurchaseRequestItem AS pri ON pri.OrderItemID = oi.OrderItemID
                                    GROUP BY qi.QuotationItemID ) useH11 ON useH11.QuotationItemID = qi.QuotationItemID
                      LEFT JOIN (   SELECT   qi.QuotationItemID ,
                                             SUM(pri.MainQuantity) MainQuantity ,
                                             SUM(ISNULL(pri.SubQuantity, 0)) SubQuantity
                                    FROM     SLE.QuotationItem AS qi
                                             JOIN CTM.OrderItem AS oi ON oi.OrderItemID = qi.OrderItemID
                                             JOIN REQ.PurchaseRequestItem AS pri ON pri.OrderItemID = oi.OrderItemID
                                    GROUP BY qi.QuotationItemID ) useH1 ON useH1.QuotationItemID = qi.QuotationItemID
                      LEFT JOIN (   SELECT   qi.QuotationItemID ,
                                             SUM(pri.MainQuantity) MainQuantity ,
                                             SUM(ISNULL(pri.SubQuantity, 0)) SubQuantity
                                    FROM     SLE.QuotationItem AS qi
                                             JOIN SLE.JustificationItem AS ji ON ji.JustificationItemID = qi.JustificationItemID
                                             JOIN REQ.PurchaseRequestItem AS pri ON pri.JustificationItemID = ji.JustificationItemID
                                    GROUP BY qi.QuotationItemID ) useH2 ON useH2.QuotationItemID = qi.QuotationItemID


                      LEFT JOIN (   SELECT   qi.QuotationItemID ,
                                             SUM(oi.MainQuantity) MainQuantity ,
                                             SUM(ISNULL(oi.SubQuantity, 0)) SubQuantity
                                    FROM     SLE.QuotationItem AS qi
                                             JOIN STC.OutgoingItem AS oi ON oi.QuotationItemID = qi.QuotationItemID
                                    GROUP BY qi.QuotationItemID ) doOut1 ON doOut1.QuotationItemID = qi.QuotationItemID
                      LEFT JOIN (   SELECT   qi.QuotationItemID ,
                                             SUM(oi.MainQuantity) MainQuantity ,
                                             SUM(ISNULL(oi.SubQuantity, 0)) SubQuantity
                                    FROM     SLE.QuotationItem AS qi
                                             JOIN SLE.SaleContractItem AS sci ON sci.QuotationItemID = qi.QuotationItemID
                                             JOIN STC.OutgoingItem AS oi ON oi.SaleContractItemID = sci.SaleContractItemID
                                    GROUP BY qi.QuotationItemID ) doOut2 ON doOut2.QuotationItemID = qi.QuotationItemID
                      LEFT JOIN (   SELECT   qi.QuotationItemID ,
                                             SUM(oi.MainQuantity) MainQuantity ,
                                             SUM(ISNULL(oi.SubQuantity, 0)) SubQuantity
                                    FROM     SLE.QuotationItem AS qi
                                             JOIN SLE.SaleContractItem AS sci ON sci.QuotationItemID = qi.QuotationItemID
                                             JOIN SLE.InvoiceItem AS ii ON ii.SaleContractItemID = sci.SaleContractItemID
                                             JOIN STC.OutgoingItem AS oi ON oi.InvoiceItemID = ii.InvoiceItemID
                                    GROUP BY qi.QuotationItemID ) doOut3 ON doOut3.QuotationItemID = qi.QuotationItemID
                      LEFT JOIN (   SELECT   qi.QuotationItemID ,
                                             SUM(oi.MainQuantity) MainQuantity ,
                                             SUM(ISNULL(oi.SubQuantity, 0)) SubQuantity
                                    FROM     SLE.QuotationItem AS qi
                                             JOIN SLE.InvoiceItem AS ii ON ii.QuotationItemID = qi.QuotationItemID
                                             JOIN STC.OutgoingItem AS oi ON oi.InvoiceItemID = ii.InvoiceItemID
                                    GROUP BY qi.QuotationItemID ) doOut4 ON doOut4.QuotationItemID = qi.QuotationItemID
                      LEFT JOIN (   SELECT   qi.QuotationItemID ,
                                             SUM(ri.MainQuantity) MainQuantity ,
                                             SUM(ISNULL(ri.SubQuantity, 0)) SubQuantity
                                    FROM     SLE.QuotationItem AS qi
                                             JOIN SLE.RemittanceItem AS ri ON ri.QuotationItemID = qi.QuotationItemID
                                    GROUP BY qi.QuotationItemID ) doRem1 ON doRem1.QuotationItemID = qi.QuotationItemID
                      LEFT JOIN (   SELECT   qi.QuotationItemID ,
                                             SUM(ri.MainQuantity) MainQuantity ,
                                             SUM(ISNULL(ri.SubQuantity, 0)) SubQuantity
                                    FROM     SLE.QuotationItem AS qi
                                             JOIN SLE.SaleContractItem AS sci ON sci.QuotationItemID = qi.QuotationItemID
                                             JOIN SLE.RemittanceItem AS ri ON ri.SaleContractItemID = sci.SaleContractItemID
                                    GROUP BY qi.QuotationItemID ) doRem2 ON doRem2.QuotationItemID = qi.QuotationItemID
                      LEFT JOIN (   SELECT   qi.QuotationItemID ,
                                             SUM(ri.MainQuantity) MainQuantity ,
                                             SUM(ISNULL(ri.SubQuantity, 0)) SubQuantity
                                    FROM     SLE.QuotationItem AS qi
                                             JOIN SLE.InvoiceItem AS ii ON ii.QuotationItemID = qi.QuotationItemID
                                             JOIN SLE.RemittanceItem AS ri ON ri.InvoiceItemID = ii.InvoiceItemID
                                    GROUP BY qi.QuotationItemID ) doRem3 ON doRem3.QuotationItemID = qi.QuotationItemID ) src;



