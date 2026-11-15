CREATE VIEW [VND].[Proposal_PurchaseInvoice]
AS
    SELECT  pii.ProposalItemID ,
            pii.PurchaseInvoiceItemID
    FROM    VND.PurchaseInvoiceItem AS pii
    WHERE   pii.ProposalItemID IS NOT NULL
    UNION
    SELECT  sri.ProposalItemID ,
            pii.PurchaseInvoiceItemID
    FROM    STC.StockReceiptItem AS sri
            INNER JOIN VND.PurchaseInvoiceItem AS pii ON pii.StockReceiptItemID = sri.StockReceiptItemID
    WHERE   sri.ProposalItemID IS NOT NULL
    UNION
    SELECT  tsri.ProposalItemID ,
            pii.PurchaseInvoiceItemID
    FROM    STC.TemporaryStockReceiptItem AS tsri
            INNER JOIN STC.JustificationInputItem AS jii ON jii.TemporaryStockReceiptItemID = tsri.TemporaryStockReceiptItemID
            INNER JOIN STC.StockReceiptItem AS sri ON sri.JustificationInputItemID = jii.JustificationInputItemID
            INNER JOIN VND.PurchaseInvoiceItem AS pii ON pii.StockReceiptItemID = sri.StockReceiptItemID
    WHERE   tsri.ProposalItemID IS NOT NULL
    UNION
    SELECT  jii.ProposalItemID ,
            pii.PurchaseInvoiceItemID
    FROM    STC.JustificationInputItem AS jii
            INNER JOIN STC.StockReceiptItem AS sri ON sri.JustificationInputItemID = jii.JustificationInputItemID
            INNER JOIN VND.PurchaseInvoiceItem AS pii ON pii.StockReceiptItemID = sri.StockReceiptItemID
    WHERE   jii.ProposalItemID IS NOT NULL
    UNION
    SELECT  pii.ProposalItemID ,
            pci.PurchaseInvoiceItemID
    FROM    VND.PurchaseContractItem pii
            JOIN VND.PurchaseInvoiceItem AS pci ON pci.PurchaseContractItemID = pii.PurchaseContractItemID
    WHERE   pii.ProposalItemID IS NOT NULL
    UNION
    SELECT  pci.ProposalItemID ,
            pii.PurchaseInvoiceItemID
    FROM    VND.PurchaseContractItem pci
            JOIN STC.StockReceiptItem AS sri ON sri.PurchaseContractItemID = pci.PurchaseContractItemID
            INNER JOIN VND.PurchaseInvoiceItem AS pii ON pii.StockReceiptItemID = sri.StockReceiptItemID
    WHERE   pci.ProposalItemID IS NOT NULL
    UNION
    SELECT  pci.ProposalItemID ,
            pii.PurchaseInvoiceItemID
    FROM    VND.PurchaseContractItem pci
            JOIN STC.TemporaryStockReceiptItem AS tsri ON tsri.PurchaseContractItemID = pci.PurchaseContractItemID
            INNER JOIN STC.JustificationInputItem AS jii ON jii.TemporaryStockReceiptItemID = tsri.TemporaryStockReceiptItemID
            INNER JOIN STC.StockReceiptItem AS sri ON sri.JustificationInputItemID = jii.JustificationInputItemID
            INNER JOIN VND.PurchaseInvoiceItem AS pii ON pii.StockReceiptItemID = sri.StockReceiptItemID
    WHERE   pci.ProposalItemID IS NOT NULL
    UNION
    SELECT  pci.ProposalItemID ,
            pii.PurchaseInvoiceItemID
    FROM    VND.PurchaseContractItem pci
            JOIN STC.JustificationInputItem AS jii ON jii.PurchaseContractItemID = pci.PurchaseContractItemID
            INNER JOIN STC.StockReceiptItem AS sri ON sri.JustificationInputItemID = jii.JustificationInputItemID
            INNER JOIN VND.PurchaseInvoiceItem AS pii ON pii.StockReceiptItemID = sri.StockReceiptItemID
    WHERE   pci.ProposalItemID IS NOT NULL;
