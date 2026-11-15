
------------------------------------- START #7676
CREATE   Function Req.fnPurchaseRequest_Non_StockReceipt (@StuffID INT,@Date DATE, @WithRemain BIT = 1)
RETURNS TABLE
AS
RETURN

SELECT pr.PurchaseRequestID ,
	   pr.PurchaseRequestNumber,
	   pri.PurchaseRequestItemID ,
	   pr.PurchaseRequestDate,
       pri.AcceptRequestMainMeasureQuantity,
       ISNULL(SUM(t.Done),0) Done,
       pri.AcceptRequestMainMeasureQuantity - ISNULL(SUM(t.Done),0) Non,
       StuffID
FROM   req.PurchaseRequest                AS pr
       JOIN req.PurchaseRequestItem       AS pri
            ON  pri.PurchaseRequestID = pr.PurchaseRequestID
       left JOIN (
                SELECT sri.PurchaseRequestItemID,
                       SUM(sri.MainQuantity) Done
                FROM   stc.StockReceiptItem AS sri
                WHERE  sri.PurchaseRequestItemID is NOT NULL
                GROUP BY
                       sri.PurchaseRequestItemID
                UNION ALL
                SELECT pi1.PurchaseRequestItemID,
                       SUM(sri.MainQuantity) Done
                FROM   stc.StockReceiptItem AS sri
                       JOIN vnd.ProposalItem AS pi1
                            ON  pi1.ProposalItemID = sri.ProposalItemID
                WHERE  pi1.PurchaseRequestItemID is NOT NULL
                GROUP BY
                       pi1.PurchaseRequestItemID
                UNION ALL
                SELECT pi1.PurchaseRequestItemID,
                       SUM(sri.MainQuantity) AS Done
                FROM   stc.StockReceiptItem AS sri
                       JOIN vnd.PurchaseContractItem AS pi1
                            ON  pi1.ProposalItemID = sri.ProposalItemID
                WHERE  pi1.PurchaseRequestItemID is NOT NULL
                GROUP BY
                       pi1.PurchaseRequestItemID
                UNION ALL
                SELECT pci.PurchaseRequestItemID,
                       SUM(sri.MainQuantity) AS Done
                FROM   stc.StockReceiptItem AS sri
                       JOIN vnd.DeliveryJustificationItem AS dji
                            ON  dji.DeliveryJustificationItemID = sri.DeliveryJustificationItemID
                       JOIN vnd.PurchaseContractItem AS pci
                            ON  pci.PurchaseContractItemID = dji.PurchaseContractItemID
                WHERE  pci.PurchaseRequestItemID is NOT NULL
                GROUP BY
                       pci.PurchaseRequestItemID

				UNION ALL
				SELECT pci.PurchaseRequestItemID,
                       SUM(sri.MainQuantity) AS Done
                FROM   stc.StockReceiptItem AS sri
				JOIN vnd.PurchaseInvoiceItem pii on sri.PurchaseInvoiceItemID = pii.PurchaseInvoiceItemID
				    JOIN vnd.PurchaseContractItem AS pci
                            ON  pci.PurchaseContractItemID = pii.PurchaseContractItemID
                WHERE  pci.PurchaseRequestItemID is NOT NULL
                GROUP BY
                       pci.PurchaseRequestItemID
            ) T
            ON  T.PurchaseRequestItemID = pri.PurchaseRequestItemID
WHERE 
pr.PurchaseRequestState = 2
and (@Date is null or pr.PurchaseRequestDate <= @Date)   
and (@StuffID is NULL or pri.StuffID = @StuffID)
GROUP BY pri.PurchaseRequestItemID,pri.AcceptRequestMainMeasureQuantity,pr.PurchaseRequestDate,pr.PurchaseRequestNumber,pr.PurchaseRequestID,pri.StuffID
HAVING CASE WHEN @WithRemain = 1 then (pri.AcceptRequestMainMeasureQuantity - ISNULL(SUM(t.Done),0)) else 1 END > 0
