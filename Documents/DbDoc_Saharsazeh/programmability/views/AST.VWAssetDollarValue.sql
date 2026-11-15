-------------------------------------
CREATE   view [AST].[VWAssetDollarValue]
 --WITH ENCRYPTION
AS



			select  b.AssetID,
					a.date,
					ROUND(b.BaseValue/g.ReportCurrencyRate , 2)  Value
			from ast.AssetReceipt a
			join ast.Asset b
				on b.AssetReceiptID = a.AssetReceiptID
			join
			(
			select PrevoucherID,VoucherID
			from acc.VoucherPrevoucher
			group by PrevoucherID,VoucherID
			)c
				on c.PrevoucherID = a.PreVoucherID
			join
			(select a.VoucherID,ReportCurrencyRate
			from acc.VoucherItem a
			join noc.AccrueAnalysing b
				on a.VoucherItemID = b.VoucherItemID
			group by a.VoucherID,ReportCurrencyRate
			)g
				on g.VoucherID = c.VoucherID

			union all

			select  a.AssetID,
					h.date,
					ROUND(a.Amount/g.ReportCurrencyRate , 2) 
			from ast.AdjustmentItem a
			join ast.Adjustment h
				on h.AdjustmentID = a.AdjustmentID
			join
			(
			select PrevoucherID,VoucherID
			from acc.VoucherPrevoucher
			group by PrevoucherID,VoucherID
			)c
				on c.PrevoucherID = h.PreVoucherID
			join
			(select a.VoucherID,ReportCurrencyRate
			from acc.VoucherItem a
			join noc.AccrueAnalysing b
				on a.VoucherItemID = b.VoucherItemID
			group by a.VoucherID,ReportCurrencyRate
			)g
				on g.VoucherID = c.VoucherID
