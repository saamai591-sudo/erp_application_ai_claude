


/************************************************************
 * Code formatted by SoftTree SQL Assistant © v7.2.338
 * Time: 06/09/95 11:19:14 صبح
 ************************************************************/

Create  VIEW [REQ].[StuffRequest_Proposal]
AS 


SELECT pri.StuffRequestItemID,
       pi1.ProposalItemID
FROM   req.PurchaseRequestItem      AS pri
       INNER JOIN VND.ProposalItem  AS pi1
            ON  pi1.PurchaseRequestItemID = pri.PurchaseRequestItemID
WHERE  pri.StuffRequestItemID IS NOT NULL






