
CREATE VIEW [REQ].[StuffRequest_PurchaseInvoice]
AS
    SELECT  pri.StuffRequestItemID ,
            pii.PurchaseInvoiceItemID
    FROM    REQ.PurchaseRequestItem AS pri
            INNER JOIN VND.PurchaseInvoiceItem AS pii ON pii.PurchaseRequestItemID = pri.PurchaseRequestItemID
    WHERE   pri.StuffRequestItemID IS NOT NULL
    UNION
    SELECT  pri.StuffRequestItemID ,
            pii.PurchaseInvoiceItemID
    FROM    REQ.PurchaseRequestItem AS pri
            INNER JOIN STC.StockReceiptItem AS sri ON sri.PurchaseRequestItemID = pri.PurchaseRequestItemID
            INNER JOIN VND.PurchaseInvoiceItem AS pii ON pii.StockReceiptItemID = sri.StockReceiptItemID
    WHERE   pri.StuffRequestItemID IS NOT NULL
    UNION
    SELECT  pri.StuffRequestItemID ,
            pii.PurchaseInvoiceItemID
    FROM    REQ.PurchaseRequestItem AS pri
            INNER JOIN STC.JustificationInputItem AS jii ON jii.PurchaseRequestItemID = pri.PurchaseRequestItemID
            INNER JOIN STC.StockReceiptItem AS sri ON sri.JustificationInputItemID = jii.JustificationInputItemID
            INNER JOIN VND.PurchaseInvoiceItem AS pii ON pii.StockReceiptItemID = sri.StockReceiptItemID
    WHERE   pri.StuffRequestItemID IS NOT NULL
    UNION
    SELECT  pri.StuffRequestItemID ,
            pii.PurchaseInvoiceItemID
    FROM    REQ.PurchaseRequestItem AS pri
            INNER JOIN VND.ProposalItem AS pi1 ON pi1.PurchaseRequestItemID = pri.PurchaseRequestItemID
            INNER JOIN VND.PurchaseInvoiceItem AS pii ON pii.ProposalItemID = pi1.ProposalItemID
    WHERE   pri.StuffRequestItemID IS NOT NULL
    UNION
    SELECT  pri.StuffRequestItemID ,
            pii.PurchaseInvoiceItemID
    FROM    REQ.PurchaseRequestItem AS pri
            INNER JOIN VND.ProposalItem AS pi1 ON pi1.PurchaseRequestItemID = pri.PurchaseRequestItemID
            INNER JOIN STC.StockReceiptItem AS sri ON sri.ProposalItemID = pi1.ProposalItemID
            INNER JOIN VND.PurchaseInvoiceItem AS pii ON pii.StockReceiptItemID = sri.StockReceiptItemID
    WHERE   pri.StuffRequestItemID IS NOT NULL
    UNION
    SELECT  pri.StuffRequestItemID ,
            pii.PurchaseInvoiceItemID
    FROM    REQ.PurchaseRequestItem AS pri
            INNER JOIN VND.ProposalItem AS pi1 ON pi1.PurchaseRequestItemID = pri.PurchaseRequestItemID
            INNER JOIN STC.TemporaryStockReceiptItem AS tsri ON tsri.ProposalItemID = pi1.ProposalItemID
            INNER JOIN STC.JustificationInputItem AS jii ON jii.TemporaryStockReceiptItemID = tsri.TemporaryStockReceiptItemID
            INNER JOIN STC.StockReceiptItem AS sri ON sri.JustificationInputItemID = jii.JustificationInputItemID
            INNER JOIN VND.PurchaseInvoiceItem AS pii ON pii.StockReceiptItemID = sri.StockReceiptItemID
    WHERE   pri.StuffRequestItemID IS NOT NULL
    UNION
    SELECT  pri.StuffRequestItemID ,
            pii.PurchaseInvoiceItemID
    FROM    REQ.PurchaseRequestItem AS pri
            INNER JOIN VND.ProposalItem AS pi1 ON pi1.PurchaseRequestItemID = pri.PurchaseRequestItemID
            INNER JOIN STC.JustificationInputItem AS jii ON jii.ProposalItemID = pi1.ProposalItemID
            INNER JOIN STC.StockReceiptItem AS sri ON sri.JustificationInputItemID = jii.JustificationInputItemID
            INNER JOIN VND.PurchaseInvoiceItem AS pii ON pii.StockReceiptItemID = sri.StockReceiptItemID
    WHERE   pri.StuffRequestItemID IS NOT NULL
    UNION
    SELECT  pri.StuffRequestItemID ,
            pii.PurchaseInvoiceItemID
    FROM    REQ.PurchaseRequestItem AS pri
            INNER JOIN STC.TemporaryStockReceiptItem AS tsri ON tsri.PurchaseRequestItemID = pri.PurchaseRequestItemID
            INNER JOIN STC.JustificationInputItem AS jii ON jii.TemporaryStockReceiptItemID = tsri.TemporaryStockReceiptItemID
            INNER JOIN STC.StockReceiptItem AS sri ON sri.JustificationInputItemID = jii.JustificationInputItemID
            INNER JOIN VND.PurchaseInvoiceItem AS pii ON pii.StockReceiptItemID = sri.StockReceiptItemID
    WHERE   pri.StuffRequestItemID IS NOT NULL
    UNION
    SELECT  pri.StuffRequestItemID ,
            pii.PurchaseInvoiceItemID
    FROM    VND.PurchaseContractItem AS pri
            INNER JOIN VND.PurchaseInvoiceItem AS pii ON pii.PurchaseContractItemID = pri.PurchaseContractItemID
    WHERE   pri.StuffRequestItemID IS NOT NULL
    UNION
    SELECT  pri.StuffRequestItemID ,
            pii.PurchaseInvoiceItemID
    FROM    VND.PurchaseContractItem AS pri
            INNER JOIN STC.StockReceiptItem sri ON sri.PurchaseContractItemID = pri.PurchaseContractItemID
            INNER JOIN VND.PurchaseInvoiceItem AS pii ON pii.StockReceiptItemID = sri.StockReceiptItemID
    WHERE   pri.StuffRequestItemID IS NOT NULL
    UNION
    SELECT  pri.StuffRequestItemID ,
            pii.PurchaseInvoiceItemID
    FROM    VND.PurchaseContractItem AS pri
            INNER JOIN STC.JustificationInputItem ji ON ji.PurchaseContractItemID = pri.PurchaseContractItemID
            INNER JOIN STC.StockReceiptItem sri ON sri.JustificationInputItemID = ji.JustificationInputItemID
            INNER JOIN VND.PurchaseInvoiceItem AS pii ON pii.StockReceiptItemID = sri.StockReceiptItemID
    WHERE   pri.StuffRequestItemID IS NOT NULL
    UNION
    SELECT  pri.StuffRequestItemID ,
            pii.PurchaseInvoiceItemID
    FROM    VND.PurchaseContractItem AS pri
            INNER JOIN STC.TemporaryStockReceiptItem tsri ON tsri.PurchaseContractItemID = pri.PurchaseContractItemID
            INNER JOIN STC.JustificationInputItem ji ON ji.TemporaryStockReceiptItemID = tsri.TemporaryStockReceiptItemID
            INNER JOIN STC.StockReceiptItem sri ON sri.JustificationInputItemID = ji.JustificationInputItemID
            INNER JOIN VND.PurchaseInvoiceItem AS pii ON pii.StockReceiptItemID = sri.StockReceiptItemID
    WHERE   pri.StuffRequestItemID IS NOT NULL
    UNION
 ---
    SELECT  pri1.StuffRequestItemID ,
            pii.PurchaseInvoiceItemID
    FROM    REQ.PurchaseRequestItem pri1
            INNER JOIN VND.PurchaseContractItem AS pri ON pri.PurchaseRequestItemID = pri1.PurchaseRequestItemID
            INNER JOIN VND.PurchaseInvoiceItem AS pii ON pii.PurchaseContractItemID = pri.PurchaseContractItemID
    WHERE   pri1.StuffRequestItemID IS NOT NULL
    UNION
    SELECT  pri.StuffRequestItemID ,
            pii.PurchaseInvoiceItemID
    FROM    REQ.PurchaseRequestItem pri
            INNER JOIN VND.PurchaseContractItem AS pri1 ON pri1.PurchaseRequestItemID = pri.PurchaseRequestItemID
            INNER JOIN STC.StockReceiptItem sri ON sri.PurchaseContractItemID = pri1.PurchaseContractItemID
            INNER JOIN VND.PurchaseInvoiceItem AS pii ON pii.StockReceiptItemID = sri.StockReceiptItemID
    WHERE   pri.StuffRequestItemID IS NOT NULL
    UNION
    SELECT  pri.StuffRequestItemID ,
            pii.PurchaseInvoiceItemID
    FROM    REQ.PurchaseRequestItem pri
            INNER JOIN VND.PurchaseContractItem AS pri1 ON pri1.PurchaseRequestItemID = pri.PurchaseRequestItemID
            INNER JOIN STC.JustificationInputItem ji ON ji.PurchaseContractItemID = pri1.PurchaseContractItemID
            INNER JOIN STC.StockReceiptItem sri ON sri.JustificationInputItemID = ji.JustificationInputItemID
            INNER JOIN VND.PurchaseInvoiceItem AS pii ON pii.StockReceiptItemID = sri.StockReceiptItemID
    WHERE   pri.StuffRequestItemID IS NOT NULL
    UNION
    SELECT  pri.StuffRequestItemID ,
            pii.PurchaseInvoiceItemID
    FROM    REQ.PurchaseRequestItem pri
            INNER JOIN VND.PurchaseContractItem AS pri1 ON pri1.PurchaseRequestItemID = pri.PurchaseRequestItemID
            INNER JOIN STC.TemporaryStockReceiptItem tsri ON tsri.PurchaseContractItemID = pri1.PurchaseContractItemID
            INNER JOIN STC.JustificationInputItem ji ON ji.TemporaryStockReceiptItemID = tsri.TemporaryStockReceiptItemID
            INNER JOIN STC.StockReceiptItem sri ON sri.JustificationInputItemID = ji.JustificationInputItemID
            INNER JOIN VND.PurchaseInvoiceItem AS pii ON pii.StockReceiptItemID = sri.StockReceiptItemID
    WHERE   pri.StuffRequestItemID IS NOT NULL
    UNION
    SELECT  pri1.StuffRequestItemID ,
            pii.PurchaseInvoiceItemID
    FROM    REQ.PurchaseRequestItem pri1
            INNER JOIN VND.ProposalItem pit ON pit.PurchaseRequestItemID = pri1.PurchaseRequestItemID
            INNER JOIN VND.PurchaseContractItem AS pri ON pri.ProposalItemID = pit.ProposalItemID
            INNER JOIN VND.PurchaseInvoiceItem AS pii ON pii.PurchaseContractItemID = pri.PurchaseContractItemID
    WHERE   pri1.StuffRequestItemID IS NOT NULL
    UNION
    SELECT  pri.StuffRequestItemID ,
            pii.PurchaseInvoiceItemID
    FROM    REQ.PurchaseRequestItem pri
            INNER JOIN VND.ProposalItem pit ON pit.PurchaseRequestItemID = pri.PurchaseRequestItemID
            INNER JOIN VND.PurchaseContractItem AS pri1 ON pri1.ProposalItemID = pit.ProposalItemID
            INNER JOIN STC.StockReceiptItem sri ON sri.PurchaseContractItemID = pri1.PurchaseContractItemID
            INNER JOIN VND.PurchaseInvoiceItem AS pii ON pii.StockReceiptItemID = sri.StockReceiptItemID
    WHERE   pri.StuffRequestItemID IS NOT NULL
    UNION
    SELECT  pri.StuffRequestItemID ,
            pii.PurchaseInvoiceItemID
    FROM    REQ.PurchaseRequestItem pri
            INNER JOIN VND.ProposalItem pit ON pit.PurchaseRequestItemID = pri.PurchaseRequestItemID
            INNER JOIN VND.PurchaseContractItem AS pri1 ON pri1.ProposalItemID = pit.ProposalItemID
            INNER JOIN STC.JustificationInputItem ji ON ji.PurchaseContractItemID = pri1.PurchaseContractItemID
            INNER JOIN STC.StockReceiptItem sri ON sri.JustificationInputItemID = ji.JustificationInputItemID
            INNER JOIN VND.PurchaseInvoiceItem AS pii ON pii.StockReceiptItemID = sri.StockReceiptItemID
    WHERE   pri.StuffRequestItemID IS NOT NULL
    UNION
    SELECT  pri.StuffRequestItemID ,
            pii.PurchaseInvoiceItemID
    FROM    REQ.PurchaseRequestItem pri
            INNER JOIN VND.ProposalItem pit ON pit.PurchaseRequestItemID = pri.PurchaseRequestItemID
            INNER JOIN VND.PurchaseContractItem AS pri1 ON pri1.ProposalItemID = pit.ProposalItemID
            INNER JOIN STC.TemporaryStockReceiptItem tsri ON tsri.PurchaseContractItemID = pri1.PurchaseContractItemID
            INNER JOIN STC.JustificationInputItem ji ON ji.TemporaryStockReceiptItemID = tsri.TemporaryStockReceiptItemID
            INNER JOIN STC.StockReceiptItem sri ON sri.JustificationInputItemID = ji.JustificationInputItemID
            INNER JOIN VND.PurchaseInvoiceItem AS pii ON pii.StockReceiptItemID = sri.StockReceiptItemID
    WHERE   pri.StuffRequestItemID IS NOT NULL;


