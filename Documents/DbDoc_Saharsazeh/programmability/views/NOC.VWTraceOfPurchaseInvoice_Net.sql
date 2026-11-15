

CREATE   VIEW NOC.VWTraceOfPurchaseInvoice_Net
	as

	with cte as
	(
		select 
			a.PurchaseInvoiceItemID,
			a.PurchaseInvoiceID,
			c.FixAsset SlID,
			b.BaseValue DonePrice,
			b.PreVoucherID
		from vnd.PurchaseInvoiceItem a
		join ast.Creation b
			on a.PurchaseInvoiceItemID = b.PurchaseInvoiceItemID
		join ast.AssetCategory ac
			on ac.AssetCategoryID = b.AssetCategoryID
		join ast.CategoryAccount c
			on c.AssetCategoryID = ac.ParentID

		union all

		select 
			a.PurchaseInvoiceItemID,
			a.PurchaseInvoiceID,
			c.FixAsset SlID,
			d.Price DonePrice,
			b.PreVoucherID
		from vnd.PurchaseInvoiceItem a
		join ast.UtilizationCost d
			on d.PurchaseInvoiceItemID = a.PurchaseInvoiceItemID
		join ast.Creation b
			on d.CreationID = b.CreationID
		join ast.AssetCategory ac
			on ac.AssetCategoryID = b.AssetCategoryID
		join ast.CategoryAccount c
			on c.AssetCategoryID = ac.ParentID

		union all

		select 
			a.PurchaseInvoiceItemID,
			a.PurchaseInvoiceID,
			c.FixAsset SlID,
			d.Amount DonePrice,
			ad.PreVoucherID
		from vnd.PurchaseInvoiceItem a
		join ast.AdjustmentItem d
			on d.BaseDocumentID = a.PurchaseInvoiceItemID
			and d.BaseDocumentType = 2
		join ast.Adjustment ad
			on ad.AdjustmentID = d.AdjustmentID
		join ast.Asset b
			on d.AssetID = b.AssetID
		join ast.AssetCategory ac
			on ac.AssetCategoryID = b.AssetCategoryID
		join ast.CategoryAccount c
			on c.AssetCategoryID = ac.ParentID

		union all

		select 
			a.PurchaseInvoiceItemID,
			a.PurchaseInvoiceID,
			case when st.Type = 1 then e.SlID else  sagpt.SlID end SlID,
			a.Price - a.Discount - isnull(b.DonePrice,0) DonePrice,
			case when pt.HasConfirmStatement = 1 then cpi.PreVoucherID else pi.PreVoucherID end PreVoucherID
		from vnd.PurchaseInvoiceItem a
		join vnd.PurchaseInvoice pi
			on pi.PurchaseInvoiceID = a.PurchaseInvoiceID
		join vnd.PurchaseType pt
			on pt.PurchaseTypeID = pi.Type
		left join vnd.ConfirmPurchaseInvoice cpi 
			on cpi.PurchaseInvoiceID = pi.PurchaseInvoiceID
		join stf.Stuff st on st.StuffID = a.StuffID
		join stf.StuffDetail e 
			on e.StuffID = a.StuffID 
		left join stf.StuffAccountGroup sag on e.StuffAccountGroupID = sag.StuffAccountGroupID
		LEFT JOIN stf.StuffAccountGroupPurchaseType sagpt
	    	ON  sagpt.StuffAccountGroupID = sag.StuffAccountGroupID
	    	AND sagpt.PurchaseTypeID = pi.Type
		left join 
		(
		select PurchaseInvoiceItemID,sum(DonePrice) DonePrice
		from
			(
			select PurchaseInvoiceItemID,BaseValue DonePrice 
			from ast.Creation
			where PurchaseInvoiceItemID is not null
			union all
			select PurchaseInvoiceItemID,Price DonePrice 
			from ast.UtilizationCost
			where PurchaseInvoiceItemID is not null
			union all
			select BaseDocumentID,Amount DonePrice 
			from ast.AdjustmentItem
			where BaseDocumentType = 2
			)a
			group by PurchaseInvoiceItemID
		)B
			ON A.PurchaseInvoiceItemID = B.PurchaseInvoiceItemID
		where (a.Price - a.Discount - isnull(b.DonePrice,0)) <> 0	
	),
	vp as
	(
	select VoucherID,PrevoucherID
	from acc.VoucherPrevoucher
	group by VoucherID,PrevoucherID
	) 

	select 
		PurchaseInvoiceID,
		v.VoucherID,
		a.SlID,
		convert (float ,DonePrice ) / convert (float ,sum(DonePrice) over(partition by PurchaseInvoiceID) ) Share,
		Title2,
		a.AccruePreVoucherID,
		DonePrice,
		CurrencyID,
		ConfirmPurchaseInvoiceID,
		HasConfirmStatement
	from (

			select 
				a.PurchaseInvoiceID,
				a.PreVoucherID AccruePreVoucherID,
				a.SlID,
				Sum(a.DonePrice)  DonePrice,
				CurrencyID,
				cpi.ConfirmPurchaseInvoiceID,
				pt.HasConfirmStatement
			from cte a
			join vnd.PurchaseInvoice b on a.PurchaseInvoiceID = b.PurchaseInvoiceID
			join vnd.PurchaseType pt on pt.PurchaseTypeID = b.Type
			left join vnd.ConfirmPurchaseInvoice cpi on cpi.PurchaseInvoiceID = b.PurchaseInvoiceID
			where (pt.HasConfirmStatement = 0 or cpi.PurchaseInvoiceID is not null)
			group by 
					a.PurchaseInvoiceID,
					a.PreVoucherID,
					a.SlID,
					CurrencyID,
					cpi.ConfirmPurchaseInvoiceID,
					pt.HasConfirmStatement
		)A
	join acc.sl on sl.SlID = a.SlID
	join vp v on v.PrevoucherID = a.AccruePreVoucherID
