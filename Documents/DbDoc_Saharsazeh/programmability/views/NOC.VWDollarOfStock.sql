
create   view [NOC].[VWDollarOfStock]

as

		select  'stockreceiptitem' DocumentName,
				ii.StockReceiptItemID DocumentID,
				case when Revision.RevisionPrice is not null then round(Revision.RevisionPrice / [CFG].[GetReportCurrencyRate] (Revision.date),2)  
					 else round(ii.netprice / [CFG].[GetReportCurrencyRate] (i.date),2)  
					 end AS Price
		from STC.StockReceipt i 
		INNER JOIN STC.StockReceiptItem ii on i.StockReceiptID = ii.StockReceiptID
		LEFT JOIN (
					select  ROW_NUMBER() over(partition by StockReceiptItemID order by number desc) Rno,
							StockReceiptItemID,RevisionPrice,RevisionFee ,h.Date
					from stc.RevisionCost h
					join stc.RevisionCostItem i on h.RevisionCostID = i.RevisionCostID
					where StockReceiptItemID is not null 
					) Revision on Rno = 1 and Revision.StockReceiptItemID = ii.StockReceiptItemID 


		union all

		select  'ReturnStockReceiptItem' DocumentName,
				ii.ReturnStockReceiptItemID DocumentID,
				case when Revision.RevisionPrice is not null then round(Revision.RevisionPrice / [CFG].[GetReportCurrencyRate] (Revision.date),2)  
					 else round(ii.price / [CFG].[GetReportCurrencyRate] (i.date),2)  
					 end AS Price
		from STC.ReturnStockReceipt i 
		JOIN STC.ReturnStockReceiptItem ii on i.ReturnStockReceiptID = ii.ReturnStockReceiptID
		LEFT JOIN (
				select  ROW_NUMBER() over(partition by ReturnStockReceiptItemID order by number desc) Rno,
						ReturnStockReceiptItemID,RevisionPrice,RevisionFee ,h.Date
				from stc.RevisionCost h
				join stc.RevisionCostItem i on h.RevisionCostID = i.RevisionCostID
				where ReturnStockReceiptItemID is not null 
				) Revision on Rno = 1 and Revision.ReturnStockReceiptItemID = ii.ReturnStockReceiptItemID


		union all

		select  'OutgoingItem' DocumentName,
				ii.OutgoingItemID DocumentID,
				case when Revision.RevisionPrice is not null then round(Revision.RevisionPrice / [CFG].[GetReportCurrencyRate] (Revision.date),2)  
					 else round(ii.price / [CFG].[GetReportCurrencyRate] (i.date),2)  
					 end AS Price
		from STC.Outgoing i 
		JOIN STC.OutgoingItem ii on i.OutgoingID = ii.OutgoingID
		LEFT JOIN (
						select  ROW_NUMBER() over(partition by OutgoingItemID order by number desc) Rno,
								OutgoingItemID,RevisionPrice,RevisionFee ,h.Date
						from stc.RevisionCost h
						join stc.RevisionCostItem i on h.RevisionCostID = i.RevisionCostID
						where OutgoingItemID is not null 
					) Revision on Rno = 1 and Revision.OutgoingItemID = ii.OutgoingItemID


		union all

		select  'ReturnedOutgoingItem' DocumentName,
				ii.ReturnedOutgoingItemID DocumentID,
				case when Revision.RevisionPrice is not null then round(Revision.RevisionPrice / [CFG].[GetReportCurrencyRate] (Revision.date),2)  
					 else round(ii.price / [CFG].[GetReportCurrencyRate] (i.date),2)  
					 end AS Price
		from STC.ReturnedOutgoing i 
		JOIN STC.ReturnedOutgoingItem ii on i.ReturnedOutgoingID = ii.ReturnedOutgoingID
		LEFT JOIN (
					select  ROW_NUMBER() over(partition by ReturnedOutgoingItemID order by number desc) Rno,
							ReturnedOutgoingItemID,RevisionPrice,RevisionFee ,h.Date
					from stc.RevisionCost h
					join stc.RevisionCostItem i on h.RevisionCostID = i.RevisionCostID
					where ReturnedOutgoingItemID is not null 
		) Revision on Rno = 1 and Revision.ReturnedOutgoingItemID = ii.ReturnedOutgoingItemID

		union all

		select  DocumentName,
				DocumentID,
				ShareOfBalancing Price
		from NOC.InventoryAnalysis 