
CREATE VIEW [REQ].[StuffRequest_StockReceipt]
AS
    SELECT  pri.StuffRequestItemID ,
            sri.StockReceiptItemID
    FROM    REQ.PurchaseRequestItem AS pri
            INNER JOIN VND.PurchaseInvoiceItem AS pii ON pii.PurchaseRequestItemID = pri.PurchaseRequestItemID
            INNER JOIN STC.StockReceiptItem AS sri ON sri.PurchaseInvoiceItemID = pii.PurchaseInvoiceItemID
    WHERE   pri.StuffRequestItemID IS NOT NULL
    UNION
    SELECT  pri.StuffRequestItemID ,
            sri.StockReceiptItemID
    FROM    REQ.PurchaseRequestItem AS pri
            INNER JOIN STC.StockReceiptItem AS sri ON sri.PurchaseRequestItemID = pri.PurchaseRequestItemID
    WHERE   pri.StuffRequestItemID IS NOT NULL
    UNION
    SELECT  pri.StuffRequestItemID ,
            sri.StockReceiptItemID
    FROM    REQ.PurchaseRequestItem AS pri
            INNER JOIN STC.JustificationInputItem AS jii ON jii.PurchaseRequestItemID = pri.PurchaseRequestItemID
            INNER JOIN STC.StockReceiptItem AS sri ON sri.JustificationInputItemID = jii.JustificationInputItemID
    WHERE   pri.StuffRequestItemID IS NOT NULL
    UNION
    SELECT  pri.StuffRequestItemID ,
            sri.StockReceiptItemID
    FROM    REQ.PurchaseRequestItem AS pri
            INNER JOIN VND.ProposalItem AS pi1 ON pi1.PurchaseRequestItemID = pri.PurchaseRequestItemID
            INNER JOIN VND.PurchaseInvoiceItem AS pii ON pii.ProposalItemID = pi1.ProposalItemID
            INNER JOIN STC.StockReceiptItem AS sri ON sri.PurchaseInvoiceItemID = pii.PurchaseInvoiceItemID
    WHERE   pri.StuffRequestItemID IS NOT NULL
    UNION
    SELECT  pri.StuffRequestItemID ,
            sri.StockReceiptItemID
    FROM    REQ.PurchaseRequestItem AS pri
            INNER JOIN VND.ProposalItem AS pi1 ON pi1.PurchaseRequestItemID = pri.PurchaseRequestItemID
            INNER JOIN STC.StockReceiptItem AS sri ON sri.ProposalItemID = pi1.ProposalItemID
    WHERE   pri.StuffRequestItemID IS NOT NULL
    UNION
    SELECT  pri.StuffRequestItemID ,
            sri.StockReceiptItemID
    FROM    REQ.PurchaseRequestItem AS pri
            INNER JOIN VND.ProposalItem AS pi1 ON pi1.PurchaseRequestItemID = pri.PurchaseRequestItemID
            INNER JOIN STC.TemporaryStockReceiptItem AS tsri ON tsri.ProposalItemID = pi1.ProposalItemID
            INNER JOIN STC.JustificationInputItem AS jii ON jii.TemporaryStockReceiptItemID = tsri.TemporaryStockReceiptItemID
            INNER JOIN STC.StockReceiptItem AS sri ON sri.JustificationInputItemID = jii.JustificationInputItemID
    WHERE   pri.StuffRequestItemID IS NOT NULL
    UNION
    SELECT  pri.StuffRequestItemID ,
            sri.StockReceiptItemID
    FROM    REQ.PurchaseRequestItem AS pri
            INNER JOIN VND.ProposalItem AS pi1 ON pi1.PurchaseRequestItemID = pri.PurchaseRequestItemID
            INNER JOIN STC.JustificationInputItem AS jii ON jii.ProposalItemID = pi1.ProposalItemID
            INNER JOIN STC.StockReceiptItem AS sri ON sri.JustificationInputItemID = jii.JustificationInputItemID
    WHERE   pri.StuffRequestItemID IS NOT NULL
    UNION
    SELECT  pri.StuffRequestItemID ,
            sri.StockReceiptItemID
    FROM    REQ.PurchaseRequestItem AS pri
            INNER JOIN STC.TemporaryStockReceiptItem AS tsri ON tsri.PurchaseRequestItemID = pri.PurchaseRequestItemID
            INNER JOIN STC.JustificationInputItem AS jii ON jii.TemporaryStockReceiptItemID = tsri.TemporaryStockReceiptItemID
            INNER JOIN STC.StockReceiptItem AS sri ON sri.JustificationInputItemID = jii.JustificationInputItemID
    WHERE   pri.StuffRequestItemID IS NOT NULL
    UNION
	-- form PurchaseContract
    SELECT  pci.StuffRequestItemID ,
            sri.StockReceiptItemID
    FROM    VND.PurchaseContractItem pci
            INNER JOIN STC.StockReceiptItem AS sri ON sri.PurchaseContractItemID = pci.PurchaseContractItemID
    WHERE   pci.StuffRequestItemID IS NOT NULL
    UNION
    SELECT  pci.StuffRequestItemID ,
            sri.StockReceiptItemID
    FROM    VND.PurchaseContractItem pci
            INNER JOIN VND.PurchaseInvoiceItem AS tsri ON tsri.PurchaseContractItemID = pci.PurchaseContractItemID
            INNER JOIN STC.StockReceiptItem AS sri ON sri.StockReceiptItemID = tsri.StockReceiptItemID
    WHERE   pci.StuffRequestItemID IS NOT NULL
    UNION
    SELECT  pci.StuffRequestItemID ,
            sri.StockReceiptItemID
    FROM    VND.PurchaseContractItem pci
            INNER JOIN STC.JustificationInputItem AS jii ON jii.PurchaseContractItemID = pci.PurchaseContractItemID
            INNER JOIN STC.StockReceiptItem AS sri ON sri.JustificationInputItemID = jii.JustificationInputItemID
    WHERE   pci.StuffRequestItemID IS NOT NULL
    UNION
    SELECT  pci.StuffRequestItemID ,
            sri.StockReceiptItemID
    FROM    VND.PurchaseContractItem pci
            INNER JOIN STC.TemporaryStockReceiptItem AS tsri ON tsri.PurchaseContractItemID = pci.PurchaseContractItemID
            INNER JOIN STC.JustificationInputItem AS jii ON jii.TemporaryStockReceiptItemID = tsri.TemporaryStockReceiptItemID
            INNER JOIN STC.StockReceiptItem AS sri ON sri.JustificationInputItemID = jii.JustificationInputItemID
    WHERE   pci.StuffRequestItemID IS NOT NULL
	-------------- from Purchase -> Contract
    UNION
    SELECT  pri.StuffRequestItemID ,
            sri.StockReceiptItemID
    FROM    REQ.PurchaseRequestItem pri
            INNER JOIN VND.PurchaseContractItem pci ON pci.PurchaseRequestItemID = pri.PurchaseRequestItemID
            INNER JOIN STC.StockReceiptItem AS sri ON sri.PurchaseContractItemID = pci.PurchaseContractItemID
    WHERE   pri.StuffRequestItemID IS NOT NULL
    UNION
    SELECT  pri.StuffRequestItemID ,
            sri.StockReceiptItemID
    FROM    REQ.PurchaseRequestItem pri
            INNER JOIN VND.PurchaseContractItem pci ON pci.PurchaseRequestItemID = pri.PurchaseRequestItemID
            INNER JOIN VND.PurchaseInvoiceItem AS tsri ON tsri.PurchaseContractItemID = pci.PurchaseContractItemID
            INNER JOIN STC.StockReceiptItem AS sri ON sri.StockReceiptItemID = tsri.StockReceiptItemID
    WHERE   pri.StuffRequestItemID IS NOT NULL
    UNION
    SELECT  pri.StuffRequestItemID ,
            sri.StockReceiptItemID
    FROM    REQ.PurchaseRequestItem pri
            INNER JOIN VND.PurchaseContractItem pci ON pci.PurchaseRequestItemID = pri.PurchaseRequestItemID
            INNER JOIN STC.JustificationInputItem AS jii ON jii.PurchaseContractItemID = pci.PurchaseContractItemID
            INNER JOIN STC.StockReceiptItem AS sri ON sri.JustificationInputItemID = jii.JustificationInputItemID
    WHERE   pri.StuffRequestItemID IS NOT NULL
    UNION
    SELECT  pri.StuffRequestItemID ,
            sri.StockReceiptItemID
    FROM    REQ.PurchaseRequestItem pri
            INNER JOIN VND.PurchaseContractItem pci ON pci.PurchaseRequestItemID = pri.PurchaseRequestItemID
            INNER JOIN STC.TemporaryStockReceiptItem AS tsri ON tsri.PurchaseContractItemID = pci.PurchaseContractItemID
            INNER JOIN STC.JustificationInputItem AS jii ON jii.TemporaryStockReceiptItemID = tsri.TemporaryStockReceiptItemID
            INNER JOIN STC.StockReceiptItem AS sri ON sri.JustificationInputItemID = jii.JustificationInputItemID
    WHERE   pri.StuffRequestItemID IS NOT NULL
-------------- from Purchase -> proposal -> Contract
    UNION
    SELECT  pri.StuffRequestItemID ,
            sri.StockReceiptItemID
    FROM    REQ.PurchaseRequestItem pri
            JOIN VND.ProposalItem pit ON pit.PurchaseRequestItemID = pri.PurchaseRequestItemID
            INNER JOIN VND.PurchaseContractItem pci ON pci.ProposalItemID = pit.ProposalItemID
            INNER JOIN STC.StockReceiptItem AS sri ON sri.PurchaseContractItemID = pci.PurchaseContractItemID
    WHERE   pri.StuffRequestItemID IS NOT NULL
    UNION
    SELECT  pri.StuffRequestItemID ,
            sri.StockReceiptItemID
    FROM    REQ.PurchaseRequestItem pri
            JOIN VND.ProposalItem pit ON pit.PurchaseRequestItemID = pri.PurchaseRequestItemID
            INNER JOIN VND.PurchaseContractItem pci ON pci.ProposalItemID = pit.ProposalItemID
            INNER JOIN VND.PurchaseInvoiceItem AS tsri ON tsri.PurchaseContractItemID = pci.PurchaseContractItemID
            INNER JOIN STC.StockReceiptItem AS sri ON sri.StockReceiptItemID = tsri.StockReceiptItemID
    WHERE   pri.StuffRequestItemID IS NOT NULL
    UNION
    SELECT  pri.StuffRequestItemID ,
            sri.StockReceiptItemID
    FROM    REQ.PurchaseRequestItem pri
            JOIN VND.ProposalItem pit ON pit.PurchaseRequestItemID = pri.PurchaseRequestItemID
            INNER JOIN VND.PurchaseContractItem pci ON pci.ProposalItemID = pit.ProposalItemID
            INNER JOIN STC.JustificationInputItem AS jii ON jii.PurchaseContractItemID = pci.PurchaseContractItemID
            INNER JOIN STC.StockReceiptItem AS sri ON sri.JustificationInputItemID = jii.JustificationInputItemID
    WHERE   pri.StuffRequestItemID IS NOT NULL
    UNION
    SELECT  pri.StuffRequestItemID ,
            sri.StockReceiptItemID
    FROM    REQ.PurchaseRequestItem pri
            JOIN VND.ProposalItem pit ON pit.PurchaseRequestItemID = pri.PurchaseRequestItemID
            INNER JOIN VND.PurchaseContractItem pci ON pci.ProposalItemID = pit.ProposalItemID
            INNER JOIN STC.TemporaryStockReceiptItem AS tsri ON tsri.PurchaseContractItemID = pci.PurchaseContractItemID
            INNER JOIN STC.JustificationInputItem AS jii ON jii.TemporaryStockReceiptItemID = tsri.TemporaryStockReceiptItemID
            INNER JOIN STC.StockReceiptItem AS sri ON sri.JustificationInputItemID = jii.JustificationInputItemID
    WHERE   pri.StuffRequestItemID IS NOT NULL;

