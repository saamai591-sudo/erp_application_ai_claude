
CREATE  VIEW [REQ].[PurchaseRequest_JustificationInput]
AS
    SELECT  jii.PurchaseRequestItemID ,
            jii.JustificationInputItemID
    FROM    STC.JustificationInputItem AS jii
    WHERE   jii.PurchaseRequestItemID IS NOT NULL
    UNION
    SELECT  pi1.PurchaseRequestItemID ,
            jii.JustificationInputItemID
    FROM    VND.ProposalItem AS pi1
            INNER JOIN STC.JustificationInputItem AS jii ON jii.ProposalItemID = pi1.ProposalItemID
    WHERE   pi1.PurchaseRequestItemID IS NOT NULL
    UNION
    SELECT  tsri.PurchaseRequestItemID ,
            jii.JustificationInputItemID
    FROM    STC.TemporaryStockReceiptItem AS tsri
            INNER JOIN STC.JustificationInputItem AS jii ON jii.TemporaryStockReceiptItemID = tsri.TemporaryStockReceiptItemID
    WHERE   tsri.PurchaseRequestItemID IS NOT NULL
    UNION
    SELECT  pci.PurchaseRequestItemID ,
            jii.JustificationInputItemID
    FROM    VND.PurchaseContractItem pci
            JOIN STC.JustificationInputItem jii ON jii.PurchaseContractItemID = pci.PurchaseContractItemID
    WHERE   pci.PurchaseRequestItemID IS NOT NULL
    UNION
    SELECT  pci.PurchaseRequestItemID ,
            jii.JustificationInputItemID
    FROM    VND.PurchaseContractItem pci
            JOIN STC.TemporaryStockReceiptItem tsri ON tsri.PurchaseContractItemID = pci.PurchaseContractItemID
            JOIN STC.JustificationInputItem jii ON jii.TemporaryStockReceiptItemID = tsri.TemporaryStockReceiptItemID
    WHERE   pci.PurchaseRequestItemID IS NOT NULL
    UNION
    SELECT  pci.PurchaseRequestItemID ,
            jii.JustificationInputItemID
    FROM    VND.ProposalItem pci
            JOIN VND.PurchaseContractItem pci2 ON pci2.ProposalItemID = pci.ProposalItemID
            JOIN STC.JustificationInputItem jii ON jii.PurchaseContractItemID = pci2.PurchaseContractItemID
    WHERE   pci.PurchaseRequestItemID IS NOT NULL
    UNION
    SELECT  pci.PurchaseRequestItemID ,
            jii.JustificationInputItemID
    FROM    VND.ProposalItem pci
            JOIN VND.PurchaseContractItem pci2 ON pci2.ProposalItemID = pci.ProposalItemID
            JOIN STC.TemporaryStockReceiptItem tsri ON tsri.PurchaseContractItemID = pci2.PurchaseContractItemID
            JOIN STC.JustificationInputItem jii ON jii.TemporaryStockReceiptItemID = tsri.TemporaryStockReceiptItemID
    WHERE   pci.PurchaseRequestItemID IS NOT NULL;

