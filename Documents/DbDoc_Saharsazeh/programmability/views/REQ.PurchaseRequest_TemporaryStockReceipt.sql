
CREATE VIEW [REQ].[PurchaseRequest_TemporaryStockReceipt]
AS
    SELECT  tsri.PurchaseRequestItemID ,
            tsri.TemporaryStockReceiptItemID
    FROM    STC.TemporaryStockReceiptItem AS tsri
    WHERE   tsri.PurchaseRequestItemID IS NOT NULL
    UNION
    SELECT  pi1.PurchaseRequestItemID ,
            tsri.TemporaryStockReceiptItemID
    FROM    VND.ProposalItem AS pi1
            INNER JOIN STC.TemporaryStockReceiptItem AS tsri ON tsri.ProposalItemID = pi1.ProposalItemID
    WHERE   pi1.PurchaseRequestItemID IS NOT NULL
    UNION
    SELECT  pci.PurchaseRequestItemID ,
            tsri.TemporaryStockReceiptItemID
    FROM    VND.PurchaseContractItem pci
            INNER JOIN STC.TemporaryStockReceiptItem AS tsri ON tsri.PurchaseContractItemID = pci.PurchaseContractItemID
    WHERE   pci.PurchaseRequestItemID IS NOT NULL
    UNION
    SELECT  pi1.PurchaseRequestItemID ,
            tsri.TemporaryStockReceiptItemID
    FROM    VND.ProposalItem AS pi1
            JOIN VND.PurchaseContractItem pci ON pci.ProposalItemID = pi1.ProposalItemID
            INNER JOIN STC.TemporaryStockReceiptItem AS tsri ON tsri.PurchaseContractItemID = pci.PurchaseContractItemID
    WHERE   pi1.PurchaseRequestItemID IS NOT NULL;
