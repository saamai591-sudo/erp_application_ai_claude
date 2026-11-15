CREATE VIEW [VND].[Proposal_ReturnedTemporaryStockReceipt]
AS
    SELECT  tsri.ProposalItemID ,
            rtsri.ReturnedTemporaryStockReceiptItemID
    FROM    STC.TemporaryStockReceiptItem AS tsri
            INNER JOIN STC.ReturnedTemporaryStockReceiptItem AS rtsri ON rtsri.TemporaryStockReceiptItemID = tsri.TemporaryStockReceiptItemID
    WHERE   tsri.ProposalItemID IS NOT NULL
    UNION
    SELECT  tsri.ProposalItemID ,
            rtsri.ReturnedTemporaryStockReceiptItemID
    FROM    STC.TemporaryStockReceiptItem AS tsri
            INNER JOIN REQ.ReturnRequestItem AS rri ON rri.TemporaryStockReceiptItemID = tsri.TemporaryStockReceiptItemID
            INNER JOIN STC.ReturnedTemporaryStockReceiptItem AS rtsri ON rtsri.ReturnRequestItemID = rri.ReturnRequestItemID
    WHERE   tsri.ProposalItemID IS NOT NULL
    UNION
    SELECT  pci.ProposalItemID ,
            rtsri.ReturnedTemporaryStockReceiptItemID
    FROM    VND.PurchaseContractItem pci
            JOIN STC.TemporaryStockReceiptItem AS tsri ON tsri.PurchaseContractItemID = pci.PurchaseContractItemID
            INNER JOIN STC.ReturnedTemporaryStockReceiptItem AS rtsri ON rtsri.TemporaryStockReceiptItemID = tsri.TemporaryStockReceiptItemID
    WHERE   pci.ProposalItemID IS NOT NULL
    UNION
    SELECT  pci.ProposalItemID ,
            rtsri.ReturnedTemporaryStockReceiptItemID
    FROM    VND.PurchaseContractItem pci
            INNER JOIN STC.TemporaryStockReceiptItem AS tsri ON tsri.PurchaseContractItemID = pci.PurchaseContractItemID
            INNER JOIN REQ.ReturnRequestItem AS rri ON rri.TemporaryStockReceiptItemID = tsri.TemporaryStockReceiptItemID
            INNER JOIN STC.ReturnedTemporaryStockReceiptItem AS rtsri ON rtsri.ReturnRequestItemID = rri.ReturnRequestItemID
    WHERE   pci.ProposalItemID IS NOT NULL;
