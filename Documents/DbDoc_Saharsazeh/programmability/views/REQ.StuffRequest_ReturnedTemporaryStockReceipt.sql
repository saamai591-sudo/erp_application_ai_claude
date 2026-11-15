
CREATE VIEW [REQ].[StuffRequest_ReturnedTemporaryStockReceipt]
AS
    SELECT  pri.StuffRequestItemID ,
            rtsri.ReturnedTemporaryStockReceiptItemID
    FROM    REQ.PurchaseRequestItem AS pri
            INNER JOIN VND.ProposalItem AS pi1 ON pi1.PurchaseRequestItemID = pri.PurchaseRequestItemID
            INNER JOIN STC.TemporaryStockReceiptItem AS tsri ON tsri.ProposalItemID = pi1.ProposalItemID
            INNER JOIN STC.ReturnedTemporaryStockReceiptItem AS rtsri ON rtsri.TemporaryStockReceiptItemID = tsri.TemporaryStockReceiptItemID
    WHERE   pri.StuffRequestItemID IS NOT NULL
    UNION
    SELECT  pri.StuffRequestItemID ,
            rtsri.ReturnedTemporaryStockReceiptItemID
    FROM    REQ.PurchaseRequestItem AS pri
            INNER JOIN VND.ProposalItem AS pi1 ON pi1.PurchaseRequestItemID = pri.PurchaseRequestItemID
            INNER JOIN STC.TemporaryStockReceiptItem AS tsri ON tsri.ProposalItemID = pi1.ProposalItemID
            INNER JOIN REQ.ReturnRequestItem AS rri ON rri.TemporaryStockReceiptItemID = tsri.TemporaryStockReceiptItemID
            INNER JOIN STC.ReturnedTemporaryStockReceiptItem AS rtsri ON rtsri.ReturnRequestItemID = rri.ReturnRequestItemID
    WHERE   pri.StuffRequestItemID IS NOT NULL
    UNION
    SELECT  pri.StuffRequestItemID ,
            rtsri.ReturnedTemporaryStockReceiptItemID
    FROM    REQ.PurchaseRequestItem AS pri
            INNER JOIN STC.TemporaryStockReceiptItem AS tsri ON tsri.PurchaseRequestItemID = pri.PurchaseRequestItemID
            INNER JOIN STC.ReturnedTemporaryStockReceiptItem AS rtsri ON rtsri.TemporaryStockReceiptItemID = tsri.TemporaryStockReceiptItemID
    WHERE   pri.StuffRequestItemID IS NOT NULL
    UNION
    SELECT  pri.StuffRequestItemID ,
            rtsri.ReturnedTemporaryStockReceiptItemID
    FROM    REQ.PurchaseRequestItem AS pri
            INNER JOIN STC.TemporaryStockReceiptItem AS tsri ON tsri.PurchaseRequestItemID = pri.PurchaseRequestItemID
            INNER JOIN REQ.ReturnRequestItem AS rri ON rri.TemporaryStockReceiptItemID = tsri.TemporaryStockReceiptItemID
            INNER JOIN STC.ReturnedTemporaryStockReceiptItem AS rtsri ON rtsri.ReturnRequestItemID = rri.ReturnRequestItemID
    WHERE   pri.StuffRequestItemID IS NOT NULL
    UNION
    SELECT  pic.StuffRequestItemID ,
            rtsri.ReturnedTemporaryStockReceiptItemID
    FROM    VND.PurchaseContractItem pic
            INNER JOIN STC.TemporaryStockReceiptItem AS tsri ON tsri.PurchaseContractItemID = pic.PurchaseContractItemID
            INNER JOIN STC.ReturnedTemporaryStockReceiptItem AS rtsri ON rtsri.TemporaryStockReceiptItemID = tsri.TemporaryStockReceiptItemID
    WHERE   pic.StuffRequestItemID IS NOT NULL
    UNION
    SELECT  pic.StuffRequestItemID ,
            rtsri.ReturnedTemporaryStockReceiptItemID
    FROM    VND.PurchaseContractItem pic
            INNER JOIN STC.TemporaryStockReceiptItem AS tsri ON tsri.PurchaseContractItemID = pic.PurchaseContractItemID
            INNER JOIN REQ.ReturnRequestItem AS rri ON rri.TemporaryStockReceiptItemID = tsri.TemporaryStockReceiptItemID
            INNER JOIN STC.ReturnedTemporaryStockReceiptItem AS rtsri ON rtsri.ReturnRequestItemID = rri.ReturnRequestItemID
    WHERE   pic.StuffRequestItemID IS NOT NULL
    UNION
    SELECT  pri.StuffRequestItemID ,
            rtsri.ReturnedTemporaryStockReceiptItemID
    FROM    REQ.PurchaseRequestItem AS pri
            INNER JOIN VND.ProposalItem AS pi1 ON pi1.PurchaseRequestItemID = pri.PurchaseRequestItemID
            INNER JOIN VND.PurchaseContractItem pic ON pic.ProposalItemID = pi1.ProposalItemID
            INNER JOIN STC.TemporaryStockReceiptItem AS tsri ON tsri.PurchaseContractItemID = pic.PurchaseContractItemID
            INNER JOIN STC.ReturnedTemporaryStockReceiptItem AS rtsri ON rtsri.TemporaryStockReceiptItemID = tsri.TemporaryStockReceiptItemID
    WHERE   pri.StuffRequestItemID IS NOT NULL
    UNION
    SELECT  pri.StuffRequestItemID ,
            rtsri.ReturnedTemporaryStockReceiptItemID
    FROM    REQ.PurchaseRequestItem AS pri
            INNER JOIN VND.ProposalItem AS pi1 ON pi1.PurchaseRequestItemID = pri.PurchaseRequestItemID
            INNER JOIN VND.PurchaseContractItem pic ON pic.ProposalItemID = pi1.ProposalItemID
            INNER JOIN STC.TemporaryStockReceiptItem AS tsri ON tsri.PurchaseContractItemID = pic.PurchaseContractItemID
            INNER JOIN REQ.ReturnRequestItem AS rri ON rri.TemporaryStockReceiptItemID = tsri.TemporaryStockReceiptItemID
            INNER JOIN STC.ReturnedTemporaryStockReceiptItem AS rtsri ON rtsri.ReturnRequestItemID = rri.ReturnRequestItemID
    WHERE   pri.StuffRequestItemID IS NOT NULL
    UNION
    SELECT  pri.StuffRequestItemID ,
            rtsri.ReturnedTemporaryStockReceiptItemID
    FROM    REQ.PurchaseRequestItem AS pri
            INNER JOIN VND.PurchaseContractItem pic ON pic.PurchaseRequestItemID = pri.PurchaseRequestItemID
            INNER JOIN STC.TemporaryStockReceiptItem AS tsri ON tsri.PurchaseContractItemID = pic.PurchaseContractItemID
            INNER JOIN STC.ReturnedTemporaryStockReceiptItem AS rtsri ON rtsri.TemporaryStockReceiptItemID = tsri.TemporaryStockReceiptItemID
    WHERE   pri.StuffRequestItemID IS NOT NULL
    UNION
    SELECT  pri.StuffRequestItemID ,
            rtsri.ReturnedTemporaryStockReceiptItemID
    FROM    REQ.PurchaseRequestItem AS pri
            INNER JOIN VND.PurchaseContractItem pic ON pic.PurchaseRequestItemID = pri.PurchaseRequestItemID
            INNER JOIN STC.TemporaryStockReceiptItem AS tsri ON tsri.PurchaseContractItemID = pic.PurchaseContractItemID
            INNER JOIN REQ.ReturnRequestItem AS rri ON rri.TemporaryStockReceiptItemID = tsri.TemporaryStockReceiptItemID
            INNER JOIN STC.ReturnedTemporaryStockReceiptItem AS rtsri ON rtsri.ReturnRequestItemID = rri.ReturnRequestItemID
    WHERE   pri.StuffRequestItemID IS NOT NULL;


