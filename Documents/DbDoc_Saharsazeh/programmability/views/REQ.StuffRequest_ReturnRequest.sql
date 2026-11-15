
/************************************************************
 * Code formatted by SoftTree SQL Assistant © v7.2.338
 * Time: 06/09/95 11:19:14 ÕÈÍ
 ************************************************************/

CREATE VIEW [REQ].[StuffRequest_ReturnRequest]
AS
    SELECT  pri.StuffRequestItemID ,
            rri.ReturnRequestItemID
    FROM    REQ.PurchaseRequestItem AS pri
            INNER JOIN VND.ProposalItem AS pi1 ON pi1.PurchaseRequestItemID = pri.PurchaseRequestItemID
            INNER JOIN STC.TemporaryStockReceiptItem AS tsri ON tsri.ProposalItemID = pi1.ProposalItemID
            INNER JOIN REQ.ReturnRequestItem AS rri ON rri.TemporaryStockReceiptItemID = tsri.TemporaryStockReceiptItemID
    WHERE   pri.StuffRequestItemID IS NOT NULL
    UNION
    SELECT  pri.StuffRequestItemID ,
            rri.ReturnRequestItemID
    FROM    REQ.PurchaseRequestItem AS pri
            INNER JOIN STC.TemporaryStockReceiptItem AS tsri ON tsri.PurchaseRequestItemID = pri.PurchaseRequestItemID
            INNER JOIN REQ.ReturnRequestItem AS rri ON rri.TemporaryStockReceiptItemID = tsri.TemporaryStockReceiptItemID
    WHERE   pri.StuffRequestItemID IS NOT NULL
    UNION
    SELECT  pic.StuffRequestItemID ,
            rri.ReturnRequestItemID
    FROM    VND.PurchaseContractItem pic
            INNER JOIN STC.TemporaryStockReceiptItem AS tsri ON tsri.PurchaseContractItemID = pic.PurchaseContractItemID
            INNER JOIN REQ.ReturnRequestItem AS rri ON rri.TemporaryStockReceiptItemID = tsri.TemporaryStockReceiptItemID
    WHERE   pic.StuffRequestItemID IS NOT NULL
    UNION
    SELECT  pri.StuffRequestItemID ,
            rri.ReturnRequestItemID
    FROM    REQ.PurchaseRequestItem AS pri
            INNER JOIN VND.ProposalItem AS pi1 ON pi1.PurchaseRequestItemID = pri.PurchaseRequestItemID
            INNER JOIN VND.PurchaseContractItem pic ON pic.PurchaseRequestItemID = pri.PurchaseRequestItemID
            INNER JOIN STC.TemporaryStockReceiptItem AS tsri ON tsri.PurchaseContractItemID = pic.PurchaseContractItemID
            INNER JOIN REQ.ReturnRequestItem AS rri ON rri.TemporaryStockReceiptItemID = tsri.TemporaryStockReceiptItemID
    WHERE   pri.StuffRequestItemID IS NOT NULL
    UNION
    SELECT  pri.StuffRequestItemID ,
            rri.ReturnRequestItemID
    FROM    REQ.PurchaseRequestItem AS pri
            INNER JOIN VND.PurchaseContractItem pic ON pic.PurchaseRequestItemID = pri.PurchaseRequestItemID
            INNER JOIN STC.TemporaryStockReceiptItem AS tsri ON tsri.PurchaseContractItemID = pic.PurchaseContractItemID
            INNER JOIN REQ.ReturnRequestItem AS rri ON rri.TemporaryStockReceiptItemID = tsri.TemporaryStockReceiptItemID
    WHERE   pri.StuffRequestItemID IS NOT NULL;

