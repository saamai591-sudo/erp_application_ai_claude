/************************************************************
 * Code formatted by SoftTree SQL Assistant © v7.2.338
 * Time: 06/09/95 10:20:56 صبح
 ************************************************************/

CREATE VIEW [REQ].[PurchaseRequest_Proposal]
AS 



SELECT pi1.PurchaseRequestItemID,pi1.ProposalItemID
FROM   VND.ProposalItem AS pi1
WHERE pi1.PurchaseRequestItemID IS NOT null

