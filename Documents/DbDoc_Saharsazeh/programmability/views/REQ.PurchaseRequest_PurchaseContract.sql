
CREATE VIEW [REQ].[PurchaseRequest_PurchaseContract]
AS
	SELECT  pci.PurchaseRequestItemID ,
            pci.PurchaseContractItemID
    FROM    VND.PurchaseContractItem AS pci
    WHERE   pci.PurchaseRequestItemID IS NOT NULL
	UNION	
    SELECT  pit.PurchaseRequestItemID ,
            pci.PurchaseContractItemID
    FROM    VND.ProposalItem pit
            JOIN VND.PurchaseContractItem pci ON pci.ProposalItemID = pit.ProposalItemID
    WHERE   pit.PurchaseRequestItemID IS NOT NULL
