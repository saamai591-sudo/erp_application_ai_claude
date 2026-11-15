
CREATE    VIEW [STC].VwCardex
--WITH ENCRYPTION
AS
	SELECT  'Outgoing' DocName ,
			sdtb.StockDocumentTypeID ,
			o.Date ,
			o.Number ,
			o.FinancialPeriodID ,
			o.StockID ,
			StuffID ,
			-MainQuantity MainQuantity ,
			-SubQuantity SubQuantity ,
			( -1 )
			* CASE WHEN Revision.RevisionPrice IS NOT NULL
				   THEN Revision.RevisionPrice
				   ELSE oi.Price
			  END Amount ,
			o.DeliverDlID DlID ,
			o.OutgoingID HeaderID ,
			oi.OutgoingItemID ItemID,
			b.CompanyID
	FROM    STC.Outgoing o
	join stf.Stock AS s on s.StockID = o.StockID
	join cfg.Branch AS b on b.BranchID = s.BranchID
	JOIN [STC].[StockDocumentTypeBaseEntity] sdtb ON o.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID        
	INNER JOIN STC.OutgoingItem oi ON o.OutgoingID = oi.OutgoingID
	LEFT JOIN ( SELECT  ROW_NUMBER() OVER ( PARTITION BY OutgoingItemID ORDER BY Number DESC ) Rno ,
								OutgoingItemID ,
								RevisionPrice
						FROM    STC.RevisionCost h
								JOIN STC.RevisionCostItem i ON h.RevisionCostID = i.RevisionCostID
						WHERE   OutgoingItemID IS NOT NULL
					  ) Revision ON Rno = 1
									AND Revision.OutgoingItemID = oi.OutgoingItemID
	UNION ALL
	SELECT  'ReturnStockReceipt' DocName ,
			sdtb.StockDocumentTypeID ,
			o.Date ,
			o.Number ,
			o.FinancialPeriodID ,
			o.StockID ,
			StuffID ,
			-MainQuantity MainQuantity ,
			-SubQuantity SubQuantity ,
			( -1 )
			* CASE WHEN Revision.RevisionPrice IS NOT NULL
				   THEN Revision.RevisionPrice
				   ELSE oi.Price
			  END Amount ,
			o.DeliverDlID DlID ,
			o.ReturnStockReceiptID HeaderID ,
			oi.ReturnStockReceiptItemID ItemID,
			b.CompanyID
	FROM    STC.ReturnStockReceipt o
	join stf.Stock AS s on o.StockID = s.StockID
	join cfg.Branch AS b on b.BranchID = s.BranchID
		JOIN [STC].[StockDocumentTypeBaseEntity] sdtb
			ON o.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
			INNER JOIN STC.ReturnStockReceiptItem oi ON o.ReturnStockReceiptID = oi.ReturnStockReceiptID
			LEFT JOIN ( SELECT  ROW_NUMBER() OVER ( PARTITION BY ReturnStockReceiptItemID ORDER BY Number DESC ) Rno ,
								i.ReturnStockReceiptItemID ,
								RevisionPrice
						FROM    STC.RevisionCost h
								JOIN STC.RevisionCostItem i ON h.RevisionCostID = i.RevisionCostID
						WHERE   ReturnStockReceiptItemID IS NOT NULL
					  ) Revision ON Rno = 1
									AND Revision.ReturnStockReceiptItemID = oi.ReturnStockReceiptItemID
	UNION ALL
	SELECT  'ReturnedOutgoing' DocName ,
			sdtb.StockDocumentTypeID ,
			o.Date ,
			o.Number ,
			o.FinancialPeriodID ,
			o.StockID ,
			StuffID ,
			MainQuantity ,
			SubQuantity ,
			CASE WHEN Revision.RevisionPrice IS NOT NULL
				 THEN Revision.RevisionPrice
				 ELSE oi.Price
			END Amount ,
			o.DlDeliverID DlID ,
			o.ReturnedOutgoingID HeaderID ,
			oi.ReturnedOutgoingItemID ItemID,
			b.CompanyID
	FROM    STC.ReturnedOutgoing o
	join stf.Stock AS s on s.StockID = o.StockID
	join cfg.Branch AS b on b.BranchID = s.BranchID
	JOIN [STC].[StockDocumentTypeBaseEntity] sdtb ON o.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
			INNER JOIN STC.ReturnedOutgoingItem oi ON o.ReturnedOutgoingID = oi.ReturnedOutgoingID
			LEFT JOIN ( SELECT  ROW_NUMBER() OVER ( PARTITION BY ReturnedOutgoingItemID ORDER BY Number DESC ) Rno ,
								ReturnedOutgoingItemID ,
								RevisionPrice
						FROM    STC.RevisionCost h
								JOIN STC.RevisionCostItem i ON h.RevisionCostID = i.RevisionCostID
						WHERE   ReturnedOutgoingItemID IS NOT NULL
					  ) Revision ON Rno = 1
									AND Revision.ReturnedOutgoingItemID = oi.ReturnedOutgoingItemID
	UNION ALL
	SELECT  'StockReceipt' DocName ,
			sdtb.StockDocumentTypeID ,
			o.Date ,
			o.Number ,
			o.FinancialPeriodID ,
			o.StockID ,
			StuffID ,
			MainQuantity ,
			SubQuantity ,
			CASE WHEN Revision.RevisionPrice IS NOT NULL
				 THEN Revision.RevisionPrice
				 ELSE oi.NetPrice
			END Amount ,
			o.DeliverDlID DlID ,
			o.StockReceiptID HeaderID ,
			oi.StockReceiptItemID ItemID,
			b.CompanyID
	FROM    STC.StockReceipt o 
	join stf.Stock AS s on o.StockID = s.StockID
	join cfg.Branch AS b on b.BranchID = s.BranchID
	JOIN [STC].[StockDocumentTypeBaseEntity] sdtb
		ON o.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
			INNER JOIN STC.StockReceiptItem oi ON o.StockReceiptID = oi.StockReceiptID
			LEFT JOIN ( SELECT  ROW_NUMBER() OVER ( PARTITION BY StockReceiptItemID ORDER BY Number DESC ) Rno ,
								StockReceiptItemID ,
								RevisionPrice
						FROM    STC.RevisionCost h
								JOIN STC.RevisionCostItem i ON h.RevisionCostID = i.RevisionCostID
						WHERE   StockReceiptItemID IS NOT NULL
					  ) Revision ON Rno = 1
									AND Revision.StockReceiptItemID = oi.StockReceiptItemID
	UNION ALL
	SELECT  CASE WHEN o.IsReturnInvoice = 0 then  'PosInvoice' else 'PosReturnInvoice' ENd DocName ,
			NULL ,
			o.Date ,
			o.Number ,
			o.FinancialPeriodID ,
			o.StockID ,
			oi.StuffID ,
			CASE WHEN o.IsReturnInvoice = 0 then  -oi.MainQuantity else oi.MainQuantity End ,
			CASE WHEN o.IsReturnInvoice = 0 then   -oi.SubQuantity else oi.SubQuantity End ,
		  0 ,
			p.DlID ,
			o.PosInvoiceID HeaderID ,
			oi.PosInvoiceItemID ItemID,
			b.CompanyID
	FROM    POS.PosInvoice AS o
	join pos.StationShift AS ss on ss.StationShiftID = o.StateShiftID
	join pos.Station AS st on st.StationID = ss.StationID
	join cfg.Branch AS b on b.BranchID = st.BranchID
			INNER JOIN POS.PosInvoiceItem oi ON oi.PosInvoiceID = o.PosInvoiceID
			INNER JOIN CFG.Party AS p ON p.PartyID = o.CustomerID
			LEFT JOIN pos.DeliveryPosInvoice AS dpi ON dpi.PosInvoiceID = o.PosInvoiceID
			LEFT JOIN pos.Delivery AS d ON d.DeliveryID = dpi.DeliveryID
			JOIN STF.Stuff AS s ON s.StuffID = oi.StuffID
			LEFT JOIN ( SELECT  ROW_NUMBER() OVER ( PARTITION BY i.PosInvoiceItemID ORDER BY Number DESC ) Rno ,
								i.PosInvoiceItemID ,
								RevisionPrice
						FROM    STC.RevisionCost h
								JOIN STC.RevisionCostItem i ON h.RevisionCostID = i.RevisionCostID
						WHERE   i.PosInvoiceItemID IS NOT NULL
					  ) Revision ON Rno = 1
									AND Revision.PosInvoiceItemID = oi.PosInvoiceItemID
	WHERE   s.Type = 0 AND o.IsReturnInvoice = 0 AND o.Status <> 3
	AND (dpi.DeliveryPosInvoiceID IS NULL OR d.OutgoingID IS NULL);
