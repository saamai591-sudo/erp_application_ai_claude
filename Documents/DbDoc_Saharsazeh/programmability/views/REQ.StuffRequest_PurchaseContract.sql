
CREATE VIEW [REQ].[StuffRequest_PurchaseContract]
AS
    SELECT  pci.StuffRequestItemID ,
            pci.PurchaseContractItemID
    FROM    VND.PurchaseContractItem AS pci
    WHERE   pci.StuffRequestItemID IS NOT NULL
    UNION
    SELECT  pri.StuffRequestItemID ,
            pci.PurchaseContractItemID
    FROM    REQ.PurchaseRequestItem pri
            JOIN VND.PurchaseContractItem pci ON pci.PurchaseRequestItemID = pri.PurchaseRequestItemID
    WHERE   pri.StuffRequestItemID IS NOT NULL
	UNION	
    SELECT  pri.StuffRequestItemID ,
            pci.PurchaseContractItemID
    FROM    REQ.PurchaseRequestItem pri
			JOIN VND.ProposalItem pit ON pit.PurchaseRequestItemID = pri.PurchaseRequestItemID
            JOIN VND.PurchaseContractItem pci ON pci.ProposalItemID = pit.ProposalItemID
    WHERE   pri.StuffRequestItemID IS NOT NULL

