

	CREATE    view NOC.VWTraceOfReturnInvoice
	as


	select 
		ReturnInvoiceID,
		v.VoucherID,
		a.SlID,
		convert (float ,DonePrice ) / convert (float ,sum(DonePrice) over(partition by ReturnInvoiceID) ) Share,
		Title2,
		a.AccruePreVoucherID,
		DonePrice

	from (

			select 
				a.ReturnInvoiceID,
				a.PreVoucherID AccruePreVoucherID,
				a.SlID,
				Sum(a.DonePrice)  DonePrice
			from (

					select 
						a.ReturnInvoiceID,
						pi.PreVoucherID ,
						case when sag.StuffDetailType = 6 then e.SlID else  sagpt.SlID end SlID,
						a.Price - a.Discount  DonePrice
					from vnd.ReturnInvoiceItem a
					join vnd.ReturnInvoice pi
						on pi.ReturnInvoiceID = a.ReturnInvoiceID
					join stf.StuffDetail e 
						on e.StuffID = a.StuffID 
					join stf.StuffAccountGroup sag on e.StuffAccountGroupID = sag.StuffAccountGroupID
					LEFT JOIN stf.StuffAccountGroupPurchaseType sagpt
	    				ON  sagpt.StuffAccountGroupID = sag.StuffAccountGroupID
	    				AND sagpt.PurchaseTypeID = pi.Type

					)a
			group by 
				a.ReturnInvoiceID,
				a.PreVoucherID,
				a.SlID

			union all

			select 
				ReturnInvoiceID,
				PreVoucherID,
				taxslid SlID,
				TotalTax  

			from vnd.ReturnInvoice h
			join vnd.PurchaseType t
				on t.PurchaseTypeID = h.Type
			where TotalTax > 0

			union all

			select 
				ReturnInvoiceID,
				PreVoucherID,
				dutyslid SlID,
				TotalDuty  

			from vnd.ReturnInvoice h
			join vnd.PurchaseType t
				on t.PurchaseTypeID = h.Type
			where TotalDuty > 0

	)A
	join acc.sl on sl.SlID = a.SlID
	join
	(
	select VoucherID,PrevoucherID
	from acc.VoucherPrevoucher
	group by VoucherID,PrevoucherID
	) v
	on v.PrevoucherID = a.AccruePreVoucherID
