-------------------------------------
CREATE   VIEW [VND].PurchaseInvoice_Remains
AS 

SELECT item.PurchaseInvoiceItemID,
		item.MainQuantity,
		item.SubQuantity,
        ISNULL(used.MainQuantity, 0) AS DoMainQuantity,
        ISNULL(used.SubQuantity, 0) AS DoSubQuantity,
		item.MainQuantity - ISNULL(used.MainQuantity, 0)  AS Non,
		item.SubQuantity -  ISNULL(used.SubQuantity, 0)    AS NonSub

FROM   VND.PurchaseInvoiceItem AS item
LEFT JOIN (
			select 
			PurchaseInvoiceItemID,
			SUM(MainQuantity) MainQuantity,
			SUM(SubQuantity) SubQuantity
			from (
                SELECT PurchaseInvoiceItemID,
                        MainQuantity,
                        SubQuantity
                FROM   Stc.StockReceiptItem AS pri
				where PurchaseInvoiceItemID is not null

                union all

                SELECT PurchaseInvoiceItemID,
                        ari.MainQuantity AS MainQuantity,
                        0 AS SubQuantity
                FROM  AST.AssetReceiptItem AS ari
				where PurchaseInvoiceItemID is not null

				union all

                SELECT PurchaseInvoiceItemID,
                        MainQuantity,
                        SubQuantity
                FROM   FOS.BillOfLadingItem AS pri
				where PurchaseInvoiceItemID is not null

				union all

                SELECT PurchaseInvoiceItemID,
                        MainQuantity,
                        SubQuantity
                FROM   ast.RepairStuffCost 
				where PurchaseInvoiceItemID is not null

				union all

                SELECT PurchaseInvoiceItemID,
                        MainQuantity,
                        SubQuantity
                FROM   ast.UtilizationCost 
				where PurchaseInvoiceItemID is not null

				union all

                SELECT PurchaseInvoiceItemID,
                        MainQuantity,
                        SubQuantity
                FROM   ast.AssetReceiptUtilizationCost 
				where PurchaseInvoiceItemID is not null

				) A 
			group by PurchaseInvoiceItemID
			) AS used
    ON  item.PurchaseInvoiceItemID = used.PurchaseInvoiceItemID
