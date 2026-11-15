
CREATE VIEW [VND].[Proposal_JustificationInput]
AS
    SELECT  jii.ProposalItemID ,
            jii.JustificationInputItemID
    FROM    STC.JustificationInputItem AS jii
    WHERE   jii.ProposalItemID IS NOT NULL
    UNION
    SELECT  tsri.ProposalItemID ,
            jii.JustificationInputItemID
    FROM    STC.TemporaryStockReceiptItem AS tsri
            INNER JOIN STC.JustificationInputItem AS jii ON jii.TemporaryStockReceiptItemID = tsri.TemporaryStockReceiptItemID
    WHERE   tsri.ProposalItemID IS NOT NULL
    UNION
    SELECT  pci.ProposalItemID ,
            jii.JustificationInputItemID
    FROM    VND.PurchaseContractItem pci
            JOIN STC.JustificationInputItem AS jii ON jii.PurchaseContractItemID = pci.PurchaseContractItemID
    WHERE   pci.ProposalItemID IS NOT NULL
    UNION
    SELECT  pci.ProposalItemID ,
            jii.JustificationInputItemID
    FROM    VND.PurchaseContractItem pci
            JOIN STC.TemporaryStockReceiptItem AS tsri ON tsri.PurchaseContractItemID = pci.PurchaseContractItemID
            INNER JOIN STC.JustificationInputItem AS jii ON jii.TemporaryStockReceiptItemID = tsri.TemporaryStockReceiptItemID
    WHERE   pci.ProposalItemID IS NOT NULL;
