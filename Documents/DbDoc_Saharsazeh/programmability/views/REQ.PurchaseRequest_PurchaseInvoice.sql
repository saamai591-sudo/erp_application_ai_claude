

/************************************************************
 * Code formatted by SoftTree SQL Assistant © v7.2.338
 * Time: 06/09/95 09:20:09 ÕÈÍ
 ************************************************************/

CREATE VIEW [REQ].[PurchaseRequest_PurchaseInvoice]
AS
    SELECT  pii.PurchaseRequestItemID ,
            pii.PurchaseInvoiceItemID
    FROM    VND.PurchaseInvoiceItem AS pii
    WHERE   pii.PurchaseRequestItemID IS NOT NULL
    UNION
    SELECT  sri.PurchaseRequestItemID ,
            pii.PurchaseInvoiceItemID
    FROM    STC.StockReceiptItem AS sri
            INNER JOIN VND.PurchaseInvoiceItem AS pii ON pii.StockReceiptItemID = sri.StockReceiptItemID
    WHERE   sri.PurchaseRequestItemID IS NOT NULL
    UNION
    SELECT  jii.PurchaseRequestItemID ,
            pii.PurchaseInvoiceItemID
    FROM    STC.JustificationInputItem AS jii
            INNER JOIN STC.StockReceiptItem AS sri ON sri.JustificationInputItemID = jii.JustificationInputItemID
            INNER JOIN VND.PurchaseInvoiceItem AS pii ON pii.StockReceiptItemID = sri.StockReceiptItemID
    WHERE   jii.PurchaseRequestItemID IS NOT NULL
    UNION
    SELECT  pi1.PurchaseRequestItemID ,
            pii.PurchaseInvoiceItemID
    FROM    VND.ProposalItem AS pi1
            INNER JOIN VND.PurchaseInvoiceItem AS pii ON pii.ProposalItemID = pi1.ProposalItemID
    WHERE   pi1.PurchaseRequestItemID IS NOT NULL
    UNION
    SELECT  pi1.PurchaseRequestItemID ,
            pii.PurchaseInvoiceItemID
    FROM    VND.ProposalItem AS pi1
            INNER JOIN STC.StockReceiptItem AS sri ON sri.ProposalItemID = pi1.ProposalItemID
            INNER JOIN VND.PurchaseInvoiceItem AS pii ON pii.StockReceiptItemID = sri.StockReceiptItemID
    WHERE   pi1.PurchaseRequestItemID IS NOT NULL
    UNION
    SELECT  pi1.PurchaseRequestItemID ,
            pii.PurchaseInvoiceItemID
    FROM    VND.ProposalItem AS pi1
            INNER JOIN STC.TemporaryStockReceiptItem AS tsri ON tsri.ProposalItemID = pi1.ProposalItemID
            INNER JOIN STC.JustificationInputItem AS jii ON jii.TemporaryStockReceiptItemID = tsri.TemporaryStockReceiptItemID
            INNER JOIN STC.StockReceiptItem AS sri ON sri.JustificationInputItemID = jii.JustificationInputItemID
            INNER JOIN VND.PurchaseInvoiceItem AS pii ON pii.StockReceiptItemID = sri.StockReceiptItemID
    WHERE   pi1.PurchaseRequestItemID IS NOT NULL
    UNION
    SELECT  pi1.PurchaseRequestItemID ,
            pii.PurchaseInvoiceItemID
    FROM    VND.ProposalItem AS pi1
            INNER JOIN STC.JustificationInputItem AS jii ON jii.ProposalItemID = pi1.ProposalItemID
            INNER JOIN STC.StockReceiptItem AS sri ON sri.JustificationInputItemID = jii.JustificationInputItemID
            INNER JOIN VND.PurchaseInvoiceItem AS pii ON pii.StockReceiptItemID = sri.StockReceiptItemID
    WHERE   pi1.PurchaseRequestItemID IS NOT NULL
    UNION
    SELECT  tsri.PurchaseRequestItemID ,
            pii.PurchaseInvoiceItemID
    FROM    STC.TemporaryStockReceiptItem AS tsri
            INNER JOIN STC.JustificationInputItem AS jii ON jii.TemporaryStockReceiptItemID = tsri.TemporaryStockReceiptItemID
            INNER JOIN STC.StockReceiptItem AS sri ON sri.JustificationInputItemID = jii.JustificationInputItemID
            INNER JOIN VND.PurchaseInvoiceItem AS pii ON pii.StockReceiptItemID = sri.StockReceiptItemID
    WHERE   tsri.PurchaseRequestItemID IS NOT NULL
    UNION
    SELECT  pci.PurchaseRequestItemID ,
            pii.PurchaseInvoiceItemID
    FROM    VND.PurchaseContractItem pci
            JOIN VND.PurchaseInvoiceItem pii ON pii.PurchaseContractItemID = pci.PurchaseContractItemID
    WHERE   pci.PurchaseRequestItemID IS NOT NULL
    UNION
    SELECT  pci.PurchaseRequestItemID ,
            pii.PurchaseInvoiceItemID
    FROM    VND.PurchaseContractItem pci
            JOIN STC.StockReceiptItem sri ON sri.PurchaseContractItemID = pci.PurchaseContractItemID
            JOIN VND.PurchaseInvoiceItem pii ON pii.StockReceiptItemID = sri.StockReceiptItemID
    WHERE   pci.PurchaseRequestItemID IS NOT NULL
    UNION
    SELECT  pi1.PurchaseRequestItemID ,
            pii.PurchaseInvoiceItemID
    FROM    VND.PurchaseContractItem AS pi1
            INNER JOIN STC.JustificationInputItem AS jii ON jii.PurchaseContractItemID = pi1.PurchaseContractItemID
            INNER JOIN STC.StockReceiptItem AS sri ON sri.JustificationInputItemID = jii.JustificationInputItemID
            INNER JOIN VND.PurchaseInvoiceItem AS pii ON pii.StockReceiptItemID = sri.StockReceiptItemID
    WHERE   pi1.PurchaseRequestItemID IS NOT NULL
    UNION
    SELECT  pi1.PurchaseRequestItemID ,
            pii.PurchaseInvoiceItemID
    FROM    VND.PurchaseContractItem AS pi1
            JOIN STC.TemporaryStockReceiptItem tsri ON tsri.PurchaseContractItemID = pi1.PurchaseContractItemID
            INNER JOIN STC.JustificationInputItem AS jii ON jii.TemporaryStockReceiptItemID = tsri.TemporaryStockReceiptItemID
            INNER JOIN STC.StockReceiptItem AS sri ON sri.JustificationInputItemID = jii.JustificationInputItemID
            INNER JOIN VND.PurchaseInvoiceItem AS pii ON pii.StockReceiptItemID = sri.StockReceiptItemID
    WHERE   pi1.PurchaseRequestItemID IS NOT NULL
    UNION
    SELECT  pci.PurchaseRequestItemID ,
            pii.PurchaseInvoiceItemID
    FROM    REQ.PurchaseRequestItem pci
            JOIN VND.PurchaseContractItem pci2 ON pci2.PurchaseRequestItemID = pci.PurchaseRequestItemID
            JOIN VND.PurchaseInvoiceItem pii ON pii.PurchaseContractItemID = pci2.PurchaseContractItemID
    WHERE   pci.PurchaseRequestItemID IS NOT NULL
    UNION
    SELECT  pci.PurchaseRequestItemID ,
            pii.PurchaseInvoiceItemID
    FROM    REQ.PurchaseRequestItem pci
            JOIN VND.PurchaseContractItem pci2 ON pci2.PurchaseRequestItemID = pci.PurchaseRequestItemID
            JOIN STC.StockReceiptItem sri ON sri.PurchaseContractItemID = pci2.PurchaseContractItemID
            JOIN VND.PurchaseInvoiceItem pii ON pii.StockReceiptItemID = sri.StockReceiptItemID
    WHERE   pci.PurchaseRequestItemID IS NOT NULL
    UNION
    SELECT  pci.PurchaseRequestItemID ,
            pii.PurchaseInvoiceItemID
    FROM    REQ.PurchaseRequestItem pci
            JOIN VND.PurchaseContractItem pci2 ON pci2.PurchaseRequestItemID = pci.PurchaseRequestItemID
            INNER JOIN STC.JustificationInputItem AS jii ON jii.PurchaseContractItemID = pci2.PurchaseContractItemID
            INNER JOIN STC.StockReceiptItem AS sri ON sri.JustificationInputItemID = jii.JustificationInputItemID
            INNER JOIN VND.PurchaseInvoiceItem AS pii ON pii.StockReceiptItemID = sri.StockReceiptItemID
    WHERE   pci.PurchaseRequestItemID IS NOT NULL
    UNION
    SELECT  pci.PurchaseRequestItemID ,
            pii.PurchaseInvoiceItemID
    FROM    REQ.PurchaseRequestItem pci
            JOIN VND.PurchaseContractItem pci2 ON pci2.PurchaseRequestItemID = pci.PurchaseRequestItemID
            JOIN STC.TemporaryStockReceiptItem tsri ON tsri.PurchaseContractItemID = pci2.PurchaseContractItemID
            INNER JOIN STC.JustificationInputItem AS jii ON jii.TemporaryStockReceiptItemID = tsri.TemporaryStockReceiptItemID
            INNER JOIN STC.StockReceiptItem AS sri ON sri.JustificationInputItemID = jii.JustificationInputItemID
            INNER JOIN VND.PurchaseInvoiceItem AS pii ON pii.StockReceiptItemID = sri.StockReceiptItemID
    WHERE   pci.PurchaseRequestItemID IS NOT NULL
    UNION
    SELECT  pci.PurchaseRequestItemID ,
            pii.PurchaseInvoiceItemID
    FROM    REQ.PurchaseRequestItem pci
            JOIN VND.ProposalItem pit ON pit.PurchaseRequestItemID = pci.PurchaseRequestItemID
            JOIN VND.PurchaseContractItem pci2 ON pci2.ProposalItemID = pit.ProposalItemID
            JOIN VND.PurchaseInvoiceItem pii ON pii.PurchaseContractItemID = pci2.PurchaseContractItemID
    WHERE   pci.PurchaseRequestItemID IS NOT NULL
    UNION
    SELECT  pci.PurchaseRequestItemID ,
            pii.PurchaseInvoiceItemID
    FROM    REQ.PurchaseRequestItem pci
            JOIN VND.ProposalItem pit ON pit.PurchaseRequestItemID = pci.PurchaseRequestItemID
            JOIN VND.PurchaseContractItem pci2 ON pci2.ProposalItemID = pit.ProposalItemID
            JOIN STC.StockReceiptItem sri ON sri.PurchaseContractItemID = pci2.PurchaseContractItemID
            JOIN VND.PurchaseInvoiceItem pii ON pii.StockReceiptItemID = sri.StockReceiptItemID
    WHERE   pci.PurchaseRequestItemID IS NOT NULL
    UNION
    SELECT  pci.PurchaseRequestItemID ,
            pii.PurchaseInvoiceItemID
    FROM    REQ.PurchaseRequestItem pci
            JOIN VND.ProposalItem pit ON pit.PurchaseRequestItemID = pci.PurchaseRequestItemID
            JOIN VND.PurchaseContractItem pci2 ON pci2.ProposalItemID = pit.ProposalItemID
            INNER JOIN STC.JustificationInputItem AS jii ON jii.PurchaseContractItemID = pci2.PurchaseContractItemID
            INNER JOIN STC.StockReceiptItem AS sri ON sri.JustificationInputItemID = jii.JustificationInputItemID
            INNER JOIN VND.PurchaseInvoiceItem AS pii ON pii.StockReceiptItemID = sri.StockReceiptItemID
    WHERE   pci.PurchaseRequestItemID IS NOT NULL
    UNION
    SELECT  pci.PurchaseRequestItemID ,
            pii.PurchaseInvoiceItemID
    FROM    REQ.PurchaseRequestItem pci
            JOIN VND.ProposalItem pit ON pit.PurchaseRequestItemID = pci.PurchaseRequestItemID
            JOIN VND.PurchaseContractItem pci2 ON pci2.ProposalItemID = pit.ProposalItemID
            JOIN STC.TemporaryStockReceiptItem tsri ON tsri.PurchaseContractItemID = pci2.PurchaseContractItemID
            INNER JOIN STC.JustificationInputItem AS jii ON jii.TemporaryStockReceiptItemID = tsri.TemporaryStockReceiptItemID
            INNER JOIN STC.StockReceiptItem AS sri ON sri.JustificationInputItemID = jii.JustificationInputItemID
            INNER JOIN VND.PurchaseInvoiceItem AS pii ON pii.StockReceiptItemID = sri.StockReceiptItemID
    WHERE   pci.PurchaseRequestItemID IS NOT NULL;

