
CREATE  VIEW [REQ].[StuffRequest_JustificationInput]
AS
    SELECT  pri.StuffRequestItemID ,
            jii.JustificationInputItemID
    FROM    REQ.PurchaseRequestItem AS pri
            INNER JOIN STC.JustificationInputItem AS jii ON jii.PurchaseRequestItemID = pri.PurchaseRequestItemID
    WHERE   pri.StuffRequestItemID IS NOT NULL
    UNION
    SELECT  pri.StuffRequestItemID ,
            jii.JustificationInputItemID
    FROM    REQ.PurchaseRequestItem AS pri
            INNER JOIN VND.ProposalItem AS pi1 ON pi1.PurchaseRequestItemID = pri.PurchaseRequestItemID
            INNER JOIN STC.JustificationInputItem AS jii ON jii.ProposalItemID = pi1.ProposalItemID
    WHERE   pri.StuffRequestItemID IS NOT NULL
    UNION
    SELECT  pri.StuffRequestItemID ,
            jii.JustificationInputItemID
    FROM    REQ.PurchaseRequestItem AS pri
            INNER JOIN STC.TemporaryStockReceiptItem AS tsri ON tsri.PurchaseRequestItemID = pri.PurchaseRequestItemID
            INNER JOIN STC.JustificationInputItem AS jii ON jii.TemporaryStockReceiptItemID = tsri.TemporaryStockReceiptItemID
    WHERE   pri.StuffRequestItemID IS NOT NULL
    UNION
    SELECT  pri.StuffRequestItemID ,
            jii.JustificationInputItemID
    FROM    VND.PurchaseContractItem AS pri
            INNER JOIN STC.JustificationInputItem AS jii ON jii.PurchaseContractItemID = pri.PurchaseContractItemID
    WHERE   pri.StuffRequestItemID IS NOT NULL
    UNION
    SELECT  pri.StuffRequestItemID ,
            jii.JustificationInputItemID
    FROM    VND.PurchaseContractItem AS pri
            INNER JOIN STC.TemporaryStockReceiptItem tsr ON tsr.PurchaseContractItemID = pri.PurchaseContractItemID
            INNER JOIN STC.JustificationInputItem AS jii ON jii.TemporaryStockReceiptItemID = tsr.TemporaryStockReceiptItemID
    WHERE   pri.StuffRequestItemID IS NOT NULL
    UNION
    SELECT  prii.StuffRequestItemID ,
            jii.JustificationInputItemID
    FROM    REQ.PurchaseRequestItem prii
            INNER JOIN VND.PurchaseContractItem AS pri ON pri.PurchaseRequestItemID = prii.PurchaseRequestItemID
            INNER JOIN STC.JustificationInputItem AS jii ON jii.PurchaseContractItemID = pri.PurchaseContractItemID
    WHERE   prii.StuffRequestItemID IS NOT NULL
    UNION
    SELECT  prii.StuffRequestItemID ,
            jii.JustificationInputItemID
    FROM    REQ.PurchaseRequestItem prii
            JOIN VND.PurchaseContractItem AS pri ON pri.PurchaseRequestItemID = prii.PurchaseRequestItemID
            INNER JOIN STC.TemporaryStockReceiptItem tsr ON tsr.PurchaseContractItemID = pri.PurchaseContractItemID
            INNER JOIN STC.JustificationInputItem AS jii ON jii.TemporaryStockReceiptItemID = tsr.TemporaryStockReceiptItemID
    WHERE   prii.StuffRequestItemID IS NOT NULL
    UNION
    SELECT  prii.StuffRequestItemID ,
            jii.JustificationInputItemID
    FROM    REQ.PurchaseRequestItem prii
			INNER JOIN VND.ProposalItem pit ON pit.PurchaseRequestItemID = prii.PurchaseRequestItemID
            INNER JOIN VND.PurchaseContractItem AS pri ON pri.ProposalItemID = pit.ProposalItemID
            INNER JOIN STC.JustificationInputItem AS jii ON jii.PurchaseContractItemID = pri.PurchaseContractItemID
    WHERE   prii.StuffRequestItemID IS NOT NULL
    UNION
    SELECT  prii.StuffRequestItemID ,
            jii.JustificationInputItemID
    FROM    REQ.PurchaseRequestItem prii
			INNER JOIN VND.ProposalItem pit ON pit.PurchaseRequestItemID = prii.PurchaseRequestItemID
            INNER JOIN VND.PurchaseContractItem AS pri ON pri.ProposalItemID = pit.ProposalItemID
            INNER JOIN STC.TemporaryStockReceiptItem tsr ON tsr.PurchaseContractItemID = pri.PurchaseContractItemID
            INNER JOIN STC.JustificationInputItem AS jii ON jii.TemporaryStockReceiptItemID = tsr.TemporaryStockReceiptItemID
    WHERE   prii.StuffRequestItemID IS NOT NULL;

