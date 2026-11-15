
create VIEW [VND].[PurchaseContract_Non_StockReceipt]
--with ENCRYPTION
AS
select  a.PurchaseContractItemID,
		a.MainQuantity,
		a.SubQuantity,
		ISNULL(s.MainQuantity,0) + 
		ISNULL(j.MainQuantity,0) +
		ISNULL(p.MainQuantity,0) +
		ISNULL(t.MainQuantity,0) DoMainQuantity,
		ISNULL(s.SubQuantity,0) + 
		ISNULL(j.SubQuantity,0) +
		ISNULL(p.SubQuantity,0) +
		ISNULL(t.SubQuantity,0) DoSubQuantity,
		a.MainQuantity -
		(ISNULL(s.MainQuantity,0) + 
		ISNULL(j.MainQuantity,0) +
		ISNULL(p.MainQuantity,0) +
		ISNULL(t.MainQuantity,0)) Non,
		a.SubQuantity -
		(ISNULL(s.SubQuantity,0) + 
		ISNULL(j.SubQuantity,0) +
		ISNULL(p.SubQuantity,0) +
		ISNULL(t.SubQuantity,0)) SubNon

from vnd.PurchaseContractItem a
left join
	(
	select a.PurchaseContractItemID,sum(MainQuantity) MainQuantity,sum(SubQuantity) SubQuantity
	from stc.StockReceiptItem a
	where PurchaseContractItemID is not null
	group by a.PurchaseContractItemID
	) s
		on a.PurchaseContractItemID = s.PurchaseContractItemID
left join
	(
	select a.PurchaseContractItemID,sum(b.MainQuantity) MainQuantity,sum(b.SubQuantity) SubQuantity
	from stc.JustificationInputItem a
	join stc.StockReceiptItem b
		on a.JustificationInputItemID = b.JustificationInputItemID
	where a.PurchaseContractItemID is not null
	group by a.PurchaseContractItemID
	)J  
		on a.PurchaseContractItemID = j.PurchaseContractItemID
left join
	(
	select a.PurchaseContractItemID,sum(b.MainQuantity) MainQuantity,sum(b.SubQuantity) SubQuantity
	from vnd.PurchaseInvoiceItem a
	join stc.StockReceiptItem b
		on a.PurchaseInvoiceItemID = b.PurchaseInvoiceItemID
	where a.PurchaseContractItemID is not null
	group by a.PurchaseContractItemID
	)p
		on p.PurchaseContractItemID = a.PurchaseContractItemID
left join
	(
	select t.PurchaseContractItemID,sum(b.MainQuantity) MainQuantity,sum(b.SubQuantity) SubQuantity
	from stc.TemporaryStockReceiptItem t
	join stc.JustificationInputItem a 
		on t.TemporaryStockReceiptItemID = a.TemporaryStockReceiptItemID
	join stc.StockReceiptItem b
		on a.JustificationInputItemID = b.JustificationInputItemID
	where t.PurchaseContractItemID is not null
	group by t.PurchaseContractItemID
	) t
		on a.PurchaseContractItemID = t.PurchaseContractItemID