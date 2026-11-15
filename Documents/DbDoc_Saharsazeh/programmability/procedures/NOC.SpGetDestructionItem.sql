-------------------------------------
create    proc NOC.SpGetDestructionItem

as
BEGIN

	select  b.DestructionItemID,
			c.AssetCreationDate EffectiveDate,
			a.Number DocumentNumber,
			g.ReferenceNumber,
			g.VoucherID,
			g.Date VoucherDate,
			c.BaseValue Amount,
			a.PreVoucherID,
			c.AssetCategoryID,
			pi.DlID
	from ast.Destruction a
	join ast.DestructionItem b
		on a.DestructionID = b.DestructionID
	join ast.Asset c
		on c.AssetID = b.AssetID
	join acc.VWVoucherPrevoucher g
		on g.PrevoucherID = a.PreVoucherID
	LEFT JOIN ast.AssetReceiptItem ari
		on ari.AssetReceiptID = c.AssetReceiptID
	left join vnd.PurchaseInvoiceItem pii
		on pii.PurchaseInvoiceItemID = ari.PurchaseInvoiceItemID
	left join vnd.PurchaseInvoice pi
		on pi.PurchaseInvoiceID = pii.PurchaseInvoiceID

END

