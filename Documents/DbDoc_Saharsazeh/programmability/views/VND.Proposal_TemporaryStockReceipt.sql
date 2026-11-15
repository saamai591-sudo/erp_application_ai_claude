

/************************************************************
 * Code formatted by SoftTree SQL Assistant © v7.2.338
 * Time: 06/09/95 11:19:14 ÕÈÍ
 ************************************************************/

CREATE VIEW [VND].[Proposal_TemporaryStockReceipt]
AS
    SELECT  tsri.ProposalItemID ,
            tsri.TemporaryStockReceiptItemID
    FROM    STC.TemporaryStockReceiptItem AS tsri
    WHERE   tsri.ProposalItemID IS NOT NULL
    UNION
    SELECT  pci.ProposalItemID ,
            tsri.TemporaryStockReceiptItemID
    FROM    VND.PurchaseContractItem pci
            INNER JOIN STC.TemporaryStockReceiptItem AS tsri ON tsri.PurchaseContractItemID = pci.PurchaseContractItemID
    WHERE   pci.ProposalItemID IS NOT NULL;

