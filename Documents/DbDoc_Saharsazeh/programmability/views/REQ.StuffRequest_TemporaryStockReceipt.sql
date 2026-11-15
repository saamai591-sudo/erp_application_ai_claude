
CREATE  VIEW [REQ].[StuffRequest_TemporaryStockReceipt]
AS
    SELECT  pri.StuffRequestItemID ,
            tsri.TemporaryStockReceiptItemID
    FROM    REQ.PurchaseRequestItem AS pri
            INNER JOIN VND.ProposalItem AS pi1 ON pi1.PurchaseRequestItemID = pri.PurchaseRequestItemID
            INNER JOIN STC.TemporaryStockReceiptItem AS tsri ON tsri.ProposalItemID = pi1.ProposalItemID
    WHERE   pri.StuffRequestItemID IS NOT NULL
    UNION
    SELECT  pri.StuffRequestItemID ,
            tsri.TemporaryStockReceiptItemID
    FROM    REQ.PurchaseRequestItem AS pri
            INNER JOIN STC.TemporaryStockReceiptItem AS tsri ON tsri.PurchaseRequestItemID = pri.PurchaseRequestItemID
    WHERE   pri.StuffRequestItemID IS NOT NULL
    UNION
    SELECT  pri.StuffRequestItemID ,
            tsri.TemporaryStockReceiptItemID
    FROM    VND.PurchaseContractItem AS pri
            INNER JOIN STC.TemporaryStockReceiptItem AS tsri ON tsri.PurchaseContractItemID = pri.PurchaseContractItemID
    WHERE   pri.StuffRequestItemID IS NOT NULL
    UNION
    SELECT  pr.StuffRequestItemID ,
            tsri.TemporaryStockReceiptItemID
    FROM    REQ.PurchaseRequestItem pr
            INNER JOIN VND.PurchaseContractItem AS pri ON pri.PurchaseRequestItemID = pr.PurchaseRequestItemID
            INNER JOIN STC.TemporaryStockReceiptItem AS tsri ON tsri.PurchaseContractItemID = pri.PurchaseContractItemID
    WHERE   pr.StuffRequestItemID IS NOT NULL
    UNION
    SELECT  pr.StuffRequestItemID ,
            tsri.TemporaryStockReceiptItemID
    FROM    REQ.PurchaseRequestItem pr
			INNER JOIN VND.ProposalItem pit ON pit.PurchaseRequestItemID = pr.PurchaseRequestItemID
            INNER JOIN VND.PurchaseContractItem AS pri ON pri.ProposalItemID = pit.ProposalItemID
            INNER JOIN STC.TemporaryStockReceiptItem AS tsri ON tsri.PurchaseContractItemID = pri.PurchaseContractItemID
    WHERE   pr.StuffRequestItemID IS NOT NULL;
