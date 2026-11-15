CREATE VIEW [VND].[Proposal_PurchaseContract]
AS
    SELECT  pii.ProposalItemID ,
            pii.PurchaseContractItemID
    FROM    VND.PurchaseContractItem AS pii
    WHERE   pii.ProposalItemID IS NOT NULL;
