
------------------------------------- START #7938
CREATE   VIEW [REQ].[vwPurchaseRequestFlowDetection] AS
	SELECT 
		pr.PurchaseRequestID,

		CASE WHEN EXISTS (SELECT 1 FROM [VND].[ProposalCommission] pc WHERE pc.PurchaseRequestID = pr.PurchaseRequestID) 
			 THEN 1 ELSE 0 END AS HeaderFlow,

		CASE WHEN EXISTS (
			SELECT 1 FROM [REQ].[PurchaseRequestItem] pri 
			WHERE pri.PurchaseRequestID = pr.PurchaseRequestID
			AND (
				EXISTS (SELECT 1 FROM [STC].[JustificationInputItem] jii WHERE jii.PurchaseRequestItemID = pri.PurchaseRequestItemID)
				OR EXISTS (SELECT 1 FROM [VND].[ProposalItem] pi WHERE pi.PurchaseRequestItemID = pri.PurchaseRequestItemID)
				OR EXISTS (SELECT 1 FROM [VND].[PurchaseInvoiceItem] pii WHERE pii.PurchaseRequestItemID = pri.PurchaseRequestItemID)
				OR EXISTS (SELECT 1 FROM [VND].[PurchaseContractItem] pci WHERE pci.PurchaseRequestItemID = pri.PurchaseRequestItemID)
				OR EXISTS (SELECT 1 FROM [STC].[StockReceiptItem] sri WHERE sri.PurchaseRequestItemID = pri.PurchaseRequestItemID)
				OR EXISTS (SELECT 1 FROM [STC].[TemporaryStockReceiptItem] tsri WHERE tsri.PurchaseRequestItemID = pri.PurchaseRequestItemID)
				OR EXISTS (SELECT 1 FROM [FOS].[ProformaInvoiceItem] pfi WHERE pfi.PurchaseRequestItemID = pri.PurchaseRequestItemID)
				OR EXISTS (SELECT 1 FROM [VND].[PurchasePlanningItem] ppi WHERE ppi.PurchaseRequestItemID = pri.PurchaseRequestItemID)
			)
		) THEN 1 ELSE 0 END AS ItemFlow
	FROM [REQ].[PurchaseRequest] pr;
