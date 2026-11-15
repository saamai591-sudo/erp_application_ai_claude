
CREATE VIEW [REQ].[PurchaseRequest_ReturnRequest]
AS
    SELECT  tsri.PurchaseRequestItemID ,
            rri.ReturnRequestItemID
    FROM    STC.TemporaryStockReceiptItem AS tsri
            INNER JOIN REQ.ReturnRequestItem AS rri ON rri.TemporaryStockReceiptItemID = tsri.TemporaryStockReceiptItemID
    WHERE   tsri.PurchaseRequestItemID IS NOT NULL
    UNION
    SELECT  pi1.PurchaseRequestItemID ,
            rri.ReturnRequestItemID
    FROM    VND.ProposalItem AS pi1
            INNER JOIN STC.TemporaryStockReceiptItem AS tsri ON tsri.ProposalItemID = pi1.ProposalItemID
            INNER JOIN REQ.ReturnRequestItem AS rri ON rri.TemporaryStockReceiptItemID = tsri.TemporaryStockReceiptItemID
    WHERE   pi1.PurchaseRequestItemID IS NOT NULL
    UNION
    SELECT  tsri.PurchaseRequestItemID ,
            rri.ReturnRequestItemID
    FROM    VND.PurchaseContractItem AS tsri
            JOIN STC.TemporaryStockReceiptItem tsri2 ON tsri2.PurchaseContractItemID = tsri.PurchaseContractItemID
            INNER JOIN REQ.ReturnRequestItem AS rri ON rri.TemporaryStockReceiptItemID = tsri2.TemporaryStockReceiptItemID
    WHERE   tsri.PurchaseRequestItemID IS NOT NULL
    UNION
    SELECT  pi1.PurchaseRequestItemID ,
            rri.ReturnRequestItemID
    FROM    VND.ProposalItem AS pi1
            INNER JOIN VND.PurchaseContractItem pci ON pci.ProposalItemID = pi1.ProposalItemID
            INNER JOIN STC.TemporaryStockReceiptItem tsri2 ON tsri2.PurchaseContractItemID = pci.PurchaseContractItemID
            INNER JOIN REQ.ReturnRequestItem AS rri ON rri.TemporaryStockReceiptItemID = tsri2.TemporaryStockReceiptItemID
    WHERE   pi1.PurchaseRequestItemID IS NOT NULL
