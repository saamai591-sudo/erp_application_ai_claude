
CREATE VIEW [REQ].[PurchaseRequest_ReturnedTemporaryStockReceipt]
AS
    SELECT  pi1.PurchaseRequestItemID ,
            rtsri.ReturnedTemporaryStockReceiptItemID
    FROM    VND.ProposalItem AS pi1
            INNER JOIN STC.TemporaryStockReceiptItem AS tsri ON tsri.ProposalItemID = pi1.ProposalItemID
            INNER JOIN STC.ReturnedTemporaryStockReceiptItem AS rtsri ON rtsri.TemporaryStockReceiptItemID = tsri.TemporaryStockReceiptItemID
    WHERE   pi1.PurchaseRequestItemID IS NOT NULL
    UNION
    SELECT  pi1.PurchaseRequestItemID ,
            rtsri.ReturnedTemporaryStockReceiptItemID
    FROM    VND.ProposalItem AS pi1
            INNER JOIN STC.TemporaryStockReceiptItem AS tsri ON tsri.ProposalItemID = pi1.ProposalItemID
            INNER JOIN REQ.ReturnRequestItem AS rri ON rri.TemporaryStockReceiptItemID = tsri.TemporaryStockReceiptItemID
            INNER JOIN STC.ReturnedTemporaryStockReceiptItem AS rtsri ON rtsri.ReturnRequestItemID = rri.ReturnRequestItemID
    WHERE   pi1.PurchaseRequestItemID IS NOT NULL
    UNION
    SELECT  tsri.PurchaseRequestItemID ,
            rtsri.ReturnedTemporaryStockReceiptItemID
    FROM    STC.TemporaryStockReceiptItem AS tsri
            INNER JOIN STC.ReturnedTemporaryStockReceiptItem AS rtsri ON rtsri.TemporaryStockReceiptItemID = tsri.TemporaryStockReceiptItemID
    WHERE   tsri.PurchaseRequestItemID IS NOT NULL
    UNION
    SELECT  tsri.PurchaseRequestItemID ,
            rtsri.ReturnedTemporaryStockReceiptItemID
    FROM    STC.TemporaryStockReceiptItem AS tsri
            INNER JOIN REQ.ReturnRequestItem AS rri ON rri.TemporaryStockReceiptItemID = tsri.TemporaryStockReceiptItemID
            INNER JOIN STC.ReturnedTemporaryStockReceiptItem AS rtsri ON rtsri.ReturnRequestItemID = rri.ReturnRequestItemID
    WHERE   tsri.PurchaseRequestItemID IS NOT NULL
    UNION
    SELECT  pi1.PurchaseRequestItemID ,
            rtsri.ReturnedTemporaryStockReceiptItemID
    FROM    VND.PurchaseContractItem AS pi1
            INNER JOIN STC.TemporaryStockReceiptItem AS tsri ON tsri.PurchaseContractItemID = pi1.PurchaseContractItemID
            INNER JOIN STC.ReturnedTemporaryStockReceiptItem AS rtsri ON rtsri.TemporaryStockReceiptItemID = tsri.TemporaryStockReceiptItemID
    WHERE   pi1.PurchaseRequestItemID IS NOT NULL
    UNION
    SELECT  pi1.PurchaseRequestItemID ,
            rtsri.ReturnedTemporaryStockReceiptItemID
    FROM    VND.PurchaseContractItem AS pi1
            INNER JOIN STC.TemporaryStockReceiptItem AS tsri ON tsri.PurchaseContractItemID = pi1.PurchaseContractItemID
            INNER JOIN REQ.ReturnRequestItem AS rri ON rri.TemporaryStockReceiptItemID = tsri.TemporaryStockReceiptItemID
            INNER JOIN STC.ReturnedTemporaryStockReceiptItem AS rtsri ON rtsri.ReturnRequestItemID = rri.ReturnRequestItemID
    WHERE   pi1.PurchaseRequestItemID IS NOT NULL
    UNION
    SELECT  pit.PurchaseRequestItemID ,
            rtsri.ReturnedTemporaryStockReceiptItemID
    FROM    VND.ProposalItem pit
            JOIN VND.PurchaseContractItem pci ON pci.ProposalItemID = pit.ProposalItemID
            JOIN STC.TemporaryStockReceiptItem AS tsri ON tsri.PurchaseContractItemID = pci.PurchaseContractItemID
            INNER JOIN STC.ReturnedTemporaryStockReceiptItem AS rtsri ON rtsri.TemporaryStockReceiptItemID = tsri.TemporaryStockReceiptItemID
    WHERE   pit.PurchaseRequestItemID IS NOT NULL
    UNION
    SELECT  pit.PurchaseRequestItemID ,
            rtsri.ReturnedTemporaryStockReceiptItemID
    FROM    VND.ProposalItem pit
            JOIN VND.PurchaseContractItem pci ON pci.ProposalItemID = pit.ProposalItemID
            JOIN STC.TemporaryStockReceiptItem AS tsri ON tsri.PurchaseContractItemID = pci.PurchaseContractItemID
            INNER JOIN REQ.ReturnRequestItem AS rri ON rri.TemporaryStockReceiptItemID = tsri.TemporaryStockReceiptItemID
            INNER JOIN STC.ReturnedTemporaryStockReceiptItem AS rtsri ON rtsri.ReturnRequestItemID = rri.ReturnRequestItemID
    WHERE   pit.PurchaseRequestItemID IS NOT NULL;
