

/************************************************************
 * Code formatted by SoftTree SQL Assistant © v7.2.338
 * Time: 06/09/95 11:19:14 ÕÈÍ
 ************************************************************/

CREATE VIEW [VND].[Proposal_ReturnRequest]
AS
    SELECT  tsri.ProposalItemID ,
            rri.ReturnRequestItemID
    FROM    STC.TemporaryStockReceiptItem AS tsri
            INNER JOIN REQ.ReturnRequestItem AS rri ON rri.TemporaryStockReceiptItemID = tsri.TemporaryStockReceiptItemID
    WHERE   tsri.ProposalItemID IS NOT NULL
    UNION
    SELECT  pci.ProposalItemID ,
            rri.ReturnRequestItemID
    FROM    VND.PurchaseContractItem pci
            INNER JOIN STC.TemporaryStockReceiptItem AS tsri ON tsri.PurchaseContractItemID = pci.PurchaseContractItemID
            INNER JOIN REQ.ReturnRequestItem AS rri ON rri.TemporaryStockReceiptItemID = tsri.TemporaryStockReceiptItemID
    WHERE   pci.ProposalItemID IS NOT NULL;

