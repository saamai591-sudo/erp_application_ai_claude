
CREATE VIEW [SLE].[Quotation_UnpaidBalance]
AS
    SELECT T.QuotationID ,
           T.UnpaidBalance
    FROM   (   SELECT q.QuotationID ,
                      q.TotalNetPrice - ISNULL(invoices.Amount, 0)
                      - ISNULL(dcni.Amount, 0) - ISNULL(inv1.Amount, 0)
                      - ISNULL(used3.Amount, 0) - ISNULL(Rem1.Amount, 0)
                      - ISNULL(rs.Amount, 0) - ISNULL(saleContracts.Amount, 0)
                      + ISNULL(dcni2.Amount, 0) AS UnpaidBalance
               FROM   SLE.Quotation q
                      LEFT JOIN (   SELECT   qi.QuotationID ,
                                             SUM(i.NetPrice) Amount
                                    FROM     SLE.InvoiceItem i
                                             LEFT JOIN SLE.QuotationItem qi ON i.QuotationItemID = qi.QuotationItemID
                                    WHERE    i.QuotationItemID IS NOT NULL
                                    GROUP BY qi.QuotationID ) invoices ON q.QuotationID = invoices.QuotationID
                      LEFT JOIN (   SELECT   qi.QuotationID ,
                                             SUM(ii.NetPrice) AS Amount
                                    FROM     SLE.QuotationItem AS qi
                                             JOIN STC.OutgoingItem AS oi ON oi.QuotationItemID = qi.QuotationItemID
                                             JOIN SLE.InvoiceItem AS ii ON ii.OutgoingItemId = oi.OutgoingItemID
                                    GROUP BY qi.QuotationID ) AS inv1 ON inv1.QuotationID = q.QuotationID
                      LEFT JOIN (   SELECT   qi.QuotationID ,
                                             SUM(ii.NetPrice) Amount
                                    FROM     SLE.QuotationItem AS qi
                                             JOIN SLE.RemittanceItem AS ri ON ri.QuotationItemID = qi.QuotationItemID
                                             JOIN SLE.InvoiceItem AS ii ON ii.RemittanceItemID = ri.RemittanceItemID
                                    GROUP BY qi.QuotationID ) AS Rem1 ON Rem1.QuotationID = q.QuotationID
                      LEFT JOIN (   SELECT   qi.QuotationID ,
                                             SUM(ii.NetPrice) Amount
                                    FROM     SLE.QuotationItem AS qi
                                             JOIN SLE.RemittanceItem AS ri ON ri.QuotationItemID = qi.QuotationItemID
                                             JOIN STC.OutgoingItem AS oi ON oi.RemittanceItemID = ri.RemittanceItemID
                                             JOIN SLE.InvoiceItem AS ii ON ii.OutgoingItemId = oi.OutgoingItemID
                                    GROUP BY qi.QuotationID ) AS used3 ON used3.QuotationID = q.QuotationID
                      LEFT JOIN (   SELECT   QuotationID ,
                                             SUM(Amount) Amount
                                    FROM     CFG.DebitCreditNoteItem
                                    WHERE    Type = 1
                                             AND QuotationID IS NOT NULL
                                    GROUP BY QuotationID ) dcni ON q.QuotationID = dcni.QuotationID
                      LEFT JOIN (   SELECT   QuotationID ,
                                             SUM(Amount) Amount
                                    FROM     FIN.ReceiveSubject
                                    WHERE    QuotationID IS NOT NULL
                                    GROUP BY QuotationID ) rs ON q.QuotationID = rs.QuotationID
                      LEFT JOIN (   SELECT   qi.QuotationID ,
                                             SUM(i.NetPrice) Amount
                                    FROM     SLE.SaleContractItem i
                                             LEFT JOIN SLE.QuotationItem qi ON i.QuotationItemID = qi.QuotationItemID
                                    WHERE    i.QuotationItemID IS NOT NULL
                                    GROUP BY qi.QuotationID ) saleContracts ON q.QuotationID = saleContracts.QuotationID
                      LEFT JOIN (   SELECT   QuotationID ,
                                             SUM(Amount) Amount
                                    FROM     CFG.DebitCreditNoteItem
                                    WHERE    Type = 0
                                             AND QuotationID IS NOT NULL
                                    GROUP BY QuotationID ) dcni2 ON q.QuotationID = dcni.QuotationID ) T;

