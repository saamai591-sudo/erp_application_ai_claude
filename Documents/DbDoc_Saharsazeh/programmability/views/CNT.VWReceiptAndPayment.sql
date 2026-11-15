
CREATE   VIEW [CNT].VWReceiptAndPayment
AS

	select
		'impelementation' Type,
		UnDepreciatedPaymentID DocID,
		null Number,
		null Date,
		N' قرارداد شماره' +cast(b.Number as varchar(250)) as BaseDocument,
		a.PrePayment Amount,
		N'استقرار دریافت و پرداخت' Description,
		N'استقرار دریافت و پرداخت' Description2,
		-1 CurrencyID,
		1 CurrencyRate,
		a.ContractID,
		'Contract' BaseDocumentType,
		null as ItemType,
		null as ItemID,
		case when b.CompanyRoll = 1 then N'DownPayment'
			 else N'AdvanceReceive'
			end ReceiptAndPaymentType,
		null BaseDocID,
		null OriginVatCurrency,
		null ItemCurrencyID,
		null ItemCurrencyRate,
		null ItemAmount
	from cnt.UnDepreciatedPayment a
	join cnt.Contract b
		on a.ContractID = b.ContractID

	union all

	select
		'impelementation' Type,
		UnDepreciatedPaymentID DocID,
		null Number,
		null Date,
		N' قرارداد شماره' +cast(b.Number as varchar(250)) as BaseDocument,
		a.OnAccount Amount,
		N'استقرار دریافت و پرداخت' Description,
		N'استقرار دریافت و پرداخت' Description2,
		-1 CurrencyID,
		1 CurrencyRate,
		a.ContractID,
		'Contract' BaseDocumentType,
		null as ItemType,
		null as ItemID,
		N'OnAccount' ReceiptAndPaymentType,
		null BaseDocID,
		null OriginVatCurrency,
		null ItemCurrencyID,
		null ItemCurrencyRate,
		null ItemAmount

	from cnt.UnDepreciatedPayment a
	join cnt.Contract b
		on a.ContractID = b.ContractID

	union all

	select
		'payment' Type,
		C.PaymentReceiptID DocID,
		c.Number,
		c.Date,
		N' قرارداد شماره' +cast(b.Number as varchar(250)) as BaseDocument,
		case when b.CompanyRoll = 1 then a.Amount when b.CompanyRoll = 2 then -a.Amount end Amount ,
		a.Description,
		a.Description2,
		a.CurrencyID,
		a.CurrencyRate,
		a.ContractID,
		'Contract' BaseDocumentType,
		case when a.PaymentBankDraftID is not null then 'BankDraft'
			 when a.PaymentCashID is not null then 'Cash'
			 when a.PaymentCheqeID is not null then 'Cheque'
			 End as ItemType,
		case when a.PaymentBankDraftID is not null then a.PaymentBankDraftID
			 when a.PaymentCashID is not null then a.PaymentCashID
			 when a.PaymentCheqeID is not null then a.PaymentCheqeID
			 End as ItemID,
		case when pt.Type = 10 then N'DownPayment'
			 when pt.Type = 12 then N'OnAccount'
			end ReceiptAndPaymentType,
		a.ContractID BaseDocID,
		null OriginVatCurrency,
		case when pc.CurrencyID is not null then pc.CurrencyID
			 when pb.CurrencyID is not null then pb.CurrencyID
			 when pca.CurrencyID is not null then pca.CurrencyID
			 end ItemCurrencyID,
		case when pc.CurrencyID is not null then pc.CurrencyRate
			 when pb.CurrencyID is not null then pb.CurrencyRate
			 when pca.CurrencyID is not null then pca.CurrencyRate
			 end ItemCurrencyRate,
		case when pc.CurrencyID is not null then pc.Amount
			 when pb.CurrencyID is not null then pb.Amount
			 when pca.CurrencyID is not null then pca.Amount
			 end ItemAmount
	from fin.paymentsubject a
	join cnt.Contract b
		on a.ContractID = b.ContractID
	join fin.paymentreceipt c
		on c.paymentreceiptid = a.paymentreceiptid
	join fin.PaymentType pt on pt.PaymentTypeID = a.PaymentTypeID
	left join fin.PaymentCheqe pc on pc.PaymentCheqeID = a.PaymentCheqeID
	left join fin.PaymentBankDraft pb on pb.PaymentBankDraftID = a.PaymentBankDraftID
	left join fin.PaymentCash pca on pca.PaymentCashID = a.PaymentCashID
	where c.Status <> 2

	union all

	select
		'payment' Type,
		C.PaymentReceiptID DocID,
		c.Number,
		c.Date,
		N'خالص صورت وضعیت شماره ' +cast(d.Number as varchar(250)) as BaseDocument,
		case when Contract.CompanyRoll = 1 then a.Amount when Contract.CompanyRoll = 2 then -a.Amount end Amount ,
		a.Description,
		a.Description2,
		a.CurrencyID,
		a.CurrencyRate,
		d.ContractID,
		'confirmstatement' BaseDocumentType,
		case when a.PaymentBankDraftID is not null then 'BankDraft'
			 when a.PaymentCashID is not null then 'Cash'
			 when a.PaymentCheqeID is not null then 'Cheque'
			 End as ItemType,
		case when a.PaymentBankDraftID is not null then a.PaymentBankDraftID
			 when a.PaymentCashID is not null then a.PaymentCashID
			 when a.PaymentCheqeID is not null then a.PaymentCheqeID
			 End as ItemID,
		N'Settlement' ReceiptAndPaymentType,
		a.confirmstatementid BaseDocID,
		null OriginVatCurrency,
		case when pc.CurrencyID is not null then pc.CurrencyID
			 when pb.CurrencyID is not null then pb.CurrencyID
			 when pca.CurrencyID is not null then pca.CurrencyID
			 end ItemCurrencyID,
		case when pc.CurrencyID is not null then pc.CurrencyRate
			 when pb.CurrencyID is not null then pb.CurrencyRate
			 when pca.CurrencyID is not null then pca.CurrencyRate
			 end ItemCurrencyRate,
		case when pc.CurrencyID is not null then pc.Amount
			 when pb.CurrencyID is not null then pb.Amount
			 when pca.CurrencyID is not null then pca.Amount
			 end ItemAmount

	from fin.paymentsubject a
	join cnt.confirmstatement b
		on a.confirmstatementid = b.confirmstatementid
	join fin.paymentreceipt c
		on c.paymentreceiptid = a.paymentreceiptid
	join cnt.contractStatement d
		on d.contractStatementid = b.contractStatementid
	join cnt.Contract on Contract.ContractID = b.ContractID
	left join fin.PaymentCheqe pc on pc.PaymentCheqeID = a.PaymentCheqeID
	left join fin.PaymentBankDraft pb on pb.PaymentBankDraftID = a.PaymentBankDraftID
	left join fin.PaymentCash pca on pca.PaymentCashID = a.PaymentCashID
	where c.Status <> 2

	union all

	select
		'payment' Type,
		C.PaymentReceiptID DocID,
		c.Number,
		c.Date,
		N'خالص صورتحساب شماره ' +cast(d.Number as varchar(250)) as BaseDocument,
		a.Amount ,
		a.Description,
		a.Description2,
		a.CurrencyID,
		a.CurrencyRate,
		i.ContractID,
		'ConfirmPurchaseInvoice' BaseDocumentType,
		case when a.PaymentBankDraftID is not null then 'BankDraft'
			 when a.PaymentCashID is not null then 'Cash'
			 when a.PaymentCheqeID is not null then 'Cheque'
			 End as ItemType,
		case when a.PaymentBankDraftID is not null then a.PaymentBankDraftID
			 when a.PaymentCashID is not null then a.PaymentCashID
			 when a.PaymentCheqeID is not null then a.PaymentCheqeID
			 End as ItemID,
		N'Settlement' ReceiptAndPaymentType,
		a.confirmstatementid BaseDocID,
		null OriginVatCurrency,
		case when pc.CurrencyID is not null then pc.CurrencyID
			 when pb.CurrencyID is not null then pb.CurrencyID
			 when pca.CurrencyID is not null then pca.CurrencyID
			 end ItemCurrencyID,
		case when pc.CurrencyID is not null then pc.CurrencyRate
			 when pb.CurrencyID is not null then pb.CurrencyRate
			 when pca.CurrencyID is not null then pca.CurrencyRate
			 end ItemCurrencyRate,
		case when pc.CurrencyID is not null then pc.Amount
			 when pb.CurrencyID is not null then pb.Amount
			 when pca.CurrencyID is not null then pca.Amount
			 end ItemAmount

	from fin.paymentsubject a
	join vnd.ConfirmPurchaseInvoice b
		on a.ConfirmPurchaseInvoiceID = b.ConfirmPurchaseInvoiceID
	join fin.paymentreceipt c
		on c.paymentreceiptid = a.paymentreceiptid
	join vnd.PurchaseInvoice d
		on d.PurchaseInvoiceID = b.PurchaseInvoiceID
	join
	(
		select a.PurchaseInvoiceID,ContractID
		from vnd.PurchaseInvoiceItem a
		join cnt.ContractSubject b
			on a.ContractSubjectID = b.ContractSubjectID
		group by a.PurchaseInvoiceID,ContractID
	)i
		on i.PurchaseInvoiceID = b.PurchaseInvoiceID
	left join fin.PaymentCheqe pc on pc.PaymentCheqeID = a.PaymentCheqeID
	left join fin.PaymentBankDraft pb on pb.PaymentBankDraftID = a.PaymentBankDraftID
	left join fin.PaymentCash pca on pca.PaymentCashID = a.PaymentCashID
	union all

	select
		'payment' Type,
		C.PaymentReceiptID DocID,
		c.Number,
		c.Date,
		adt.title + N' - صورت وضعیت شماره ' +cast(d.Number as varchar(250)) as BaseDocument,
		case when Contract.CompanyRoll = 1 then a.Amount when Contract.CompanyRoll = 2 then -a.Amount end Amount ,
		a.Description,
		a.Description2,
		a.CurrencyID,
		a.CurrencyRate,
		b.ContractID,
		'additiondeduction' BaseDocumentType,
		case when a.PaymentBankDraftID is not null then 'BankDraft'
			 when a.PaymentCashID is not null then 'Cash'
			 when a.PaymentCheqeID is not null then 'Cheque'
			 End as ItemType,
		case when a.PaymentBankDraftID is not null then a.PaymentBankDraftID
			 when a.PaymentCashID is not null then a.PaymentCashID
			 when a.PaymentCheqeID is not null then a.PaymentCheqeID
			 End as ItemID,
		N'Settlement' ReceiptAndPaymentType,
		a.confirmstatementItemId BaseDocID,
		null OriginVatCurrency,
		case when pc.CurrencyID is not null then pc.CurrencyID
			 when pb.CurrencyID is not null then pb.CurrencyID
			 when pca.CurrencyID is not null then pca.CurrencyID
			 end ItemCurrencyID,
		case when pc.CurrencyID is not null then pc.CurrencyRate
			 when pb.CurrencyID is not null then pb.CurrencyRate
			 when pca.CurrencyID is not null then pca.CurrencyRate
			 end ItemCurrencyRate,
		case when pc.CurrencyID is not null then pc.Amount
			 when pb.CurrencyID is not null then pb.Amount
			 when pca.CurrencyID is not null then pca.Amount
			 end ItemAmount

	from fin.paymentsubject a
	join cnt.confirmstatementItem i
		on i.confirmstatementItemId = a.confirmstatementItemID
	join cnt.additiondeductionType adt 
		on adt.additiondeductionTypeID = i.additiondeductionTypeID
	join cnt.confirmstatement b
		on i.confirmstatementid = b.confirmstatementid
	join fin.paymentreceipt c
		on c.paymentreceiptid = a.paymentreceiptid
	join cnt.contractStatement d
		on d.contractStatementid = b.contractStatementid
	join cnt.Contract on Contract.ContractID = d.ContractID
	left join fin.PaymentCheqe pc on pc.PaymentCheqeID = a.PaymentCheqeID
	left join fin.PaymentBankDraft pb on pb.PaymentBankDraftID = a.PaymentBankDraftID
	left join fin.PaymentCash pca on pca.PaymentCashID = a.PaymentCashID
	where c.Status <> 2

	union all

	select
		'payment' Type,
		C.PaymentReceiptID DocID,
		c.Number,
		c.Date,
		adt.title + N' - صورتحساب شماره ' +cast(b.Number as varchar(250)) as BaseDocument,
		a.Amount ,
		a.Description,
		a.Description2,
		a.CurrencyID,
		a.CurrencyRate,
		pii.ContractID,
		'additiondeduction' BaseDocumentType,
		case when a.PaymentBankDraftID is not null then 'BankDraft'
			 when a.PaymentCashID is not null then 'Cash'
			 when a.PaymentCheqeID is not null then 'Cheque'
			 End as ItemType,
		case when a.PaymentBankDraftID is not null then a.PaymentBankDraftID
			 when a.PaymentCashID is not null then a.PaymentCashID
			 when a.PaymentCheqeID is not null then a.PaymentCheqeID
			 End as ItemID,
		N'Settlement' ReceiptAndPaymentType,
		a.confirmstatementItemId BaseDocID,
		null OriginVatCurrency,
		case when pc.CurrencyID is not null then pc.CurrencyID
			 when pb.CurrencyID is not null then pb.CurrencyID
			 when pca.CurrencyID is not null then pca.CurrencyID
			 end ItemCurrencyID,
		case when pc.CurrencyID is not null then pc.CurrencyRate
			 when pb.CurrencyID is not null then pb.CurrencyRate
			 when pca.CurrencyID is not null then pca.CurrencyRate
			 end ItemCurrencyRate,
		case when pc.CurrencyID is not null then pc.Amount
			 when pb.CurrencyID is not null then pb.Amount
			 when pca.CurrencyID is not null then pca.Amount
			 end ItemAmount

	from fin.paymentsubject a
	join vnd.ConfirmPurchaseInvoiceItem i
		on i.ConfirmPurchaseInvoiceItemID = a.ConfirmPurchaseInvoiceItemID
	join vnd.ConfirmPurchaseInvoice h
		on h.ConfirmPurchaseInvoiceID = i.ConfirmPurchaseInvoiceID
	join cnt.additiondeductionType adt 
		on adt.additiondeductionTypeID = i.additiondeductionTypeID
	join vnd.PurchaseInvoice b
		on h.PurchaseInvoiceID = b.PurchaseInvoiceID
	join fin.paymentreceipt c
		on c.paymentreceiptid = a.paymentreceiptid
	join
	(
		select a.PurchaseInvoiceID,ContractID
		from vnd.PurchaseInvoiceItem a
		join cnt.ContractSubject b
			on a.ContractSubjectID = b.ContractSubjectID
		group by a.PurchaseInvoiceID,ContractID
	)pii
		on pii.PurchaseInvoiceID = b.PurchaseInvoiceID
	left join fin.PaymentCheqe pc on pc.PaymentCheqeID = a.PaymentCheqeID
	left join fin.PaymentBankDraft pb on pb.PaymentBankDraftID = a.PaymentBankDraftID
	left join fin.PaymentCash pca on pca.PaymentCashID = a.PaymentCashID

	union all

	select
		'payment' Type,
		C.PaymentReceiptID DocID,
		c.Number,
		c.Date,
		N'ارزش افزوده صورت وضعیت شماره ' +cast(b.Number as varchar(250)) as BaseDocument,
		case when Contract.CompanyRoll = 1 then a.Amount when Contract.CompanyRoll = 2 then -a.Amount end Amount ,
		a.Description,
		a.Description2,
		a.CurrencyID,
		a.CurrencyRate,
		b.ContractID,
		'Vat' BaseDocumentType,
		case when a.PaymentBankDraftID is not null then 'BankDraft'
			 when a.PaymentCashID is not null then 'Cash'
			 when a.PaymentCheqeID is not null then 'Cheque'
			 End as ItemType,
		case when a.PaymentBankDraftID is not null then a.PaymentBankDraftID
			 when a.PaymentCashID is not null then a.PaymentCashID
			 when a.PaymentCheqeID is not null then a.PaymentCheqeID
			 End as ItemID,
		N'Settlement' ReceiptAndPaymentType,
		a.ContractStatementID BaseDocID,
		b.CurrencyID OriginVatCurrency,
		case when pc.CurrencyID is not null then pc.CurrencyID
			 when pb.CurrencyID is not null then pb.CurrencyID
			 when pca.CurrencyID is not null then pca.CurrencyID
			 end ItemCurrencyID,
		case when pc.CurrencyID is not null then pc.CurrencyRate
			 when pb.CurrencyID is not null then pb.CurrencyRate
			 when pca.CurrencyID is not null then pca.CurrencyRate
			 end ItemCurrencyRate,
		case when pc.CurrencyID is not null then pc.Amount
			 when pb.CurrencyID is not null then pb.Amount
			 when pca.CurrencyID is not null then pca.Amount
			 end ItemAmount

	from fin.paymentsubject a
	join cnt.contractstatement b
		on a.ContractStatementID = b.ContractStatementID
	join fin.paymentreceipt c
		on c.paymentreceiptid = a.paymentreceiptid
	join cnt.Contract on Contract.ContractID = b.ContractID
	left join fin.PaymentCheqe pc on pc.PaymentCheqeID = a.PaymentCheqeID
	left join fin.PaymentBankDraft pb on pb.PaymentBankDraftID = a.PaymentBankDraftID
	left join fin.PaymentCash pca on pca.PaymentCashID = a.PaymentCashID
	where c.Status <> 2

	union all

	select
		'payment' Type,
		C.PaymentReceiptID DocID,
		c.Number,
		c.Date,
		case when t.HasConfirmStatement = 0 then N' صورتحساب شماره' else N'ارزش افزوده صورتحساب شماره ' end
			+ case when b.InvoiceNumber is not null 
											then b.InvoiceNumber 
										else cast(b.Number as varchar(250)) end  as BaseDocument,
		a.Amount ,
		a.Description,
		a.Description2,
		a.CurrencyID,
		a.CurrencyRate,
		i.ContractID,
		case when t.HasConfirmStatement = 0 then 'PurchaseInvoice' else 'Vat' end BaseDocumentType,
		case when a.PaymentBankDraftID is not null then 'BankDraft'
			 when a.PaymentCashID is not null then 'Cash'
			 when a.PaymentCheqeID is not null then 'Cheque'
			 End as ItemType,
		case when a.PaymentBankDraftID is not null then a.PaymentBankDraftID
			 when a.PaymentCashID is not null then a.PaymentCashID
			 when a.PaymentCheqeID is not null then a.PaymentCheqeID
			 End as ItemID,
		N'Settlement' ReceiptAndPaymentType,
		a.PurchaseInvoiceID BaseDocID,
		case when t.HasConfirmStatement = 1 then b.CurrencyID end OriginVatCurrency,
		case when pc.CurrencyID is not null then pc.CurrencyID
			 when pb.CurrencyID is not null then pb.CurrencyID
			 when pca.CurrencyID is not null then pca.CurrencyID
			 end ItemCurrencyID,
		case when pc.CurrencyID is not null then pc.CurrencyRate
			 when pb.CurrencyID is not null then pb.CurrencyRate
			 when pca.CurrencyID is not null then pca.CurrencyRate
			 end ItemCurrencyRate,
		case when pc.CurrencyID is not null then pc.Amount
			 when pb.CurrencyID is not null then pb.Amount
			 when pca.CurrencyID is not null then pca.Amount
			 end ItemAmount

	from fin.paymentsubject a
	join vnd.PurchaseInvoice b
		on a.PurchaseInvoiceID = b.PurchaseInvoiceID
	join fin.paymentreceipt c
		on c.paymentreceiptid = a.paymentreceiptid
	join
	(
		select a.PurchaseInvoiceID,ContractID
		from vnd.PurchaseInvoiceItem a
		join cnt.ContractSubject b
			on a.ContractSubjectID = b.ContractSubjectID
		group by a.PurchaseInvoiceID,ContractID
	)i
		on i.PurchaseInvoiceID = b.PurchaseInvoiceID
	join cnt.Contract on Contract.ContractID = i.ContractID
	join vnd.PurchaseType t on t.PurchaseTypeID = b.Type
	left join fin.PaymentCheqe pc on pc.PaymentCheqeID = a.PaymentCheqeID
	left join fin.PaymentBankDraft pb on pb.PaymentBankDraftID = a.PaymentBankDraftID
	left join fin.PaymentCash pca on pca.PaymentCashID = a.PaymentCashID
	where c.Status <> 2 

	union all

	select
		'Receive' Type,
		C.ReceiveReceiptID DocID,
		c.Number,
		c.Date,
		N' قرارداد شماره' +cast(Contract.Number as varchar(250)) BaseDocument,
		case when Contract.CompanyRoll = 1 then -a.Amount when Contract.CompanyRoll = 2 then a.Amount end Amount ,
		a.Description,
		a.Description2,
		a.CurrencyID,
		a.CurrencyRate,
		a.ContractID,
		'Contract' BaseDocumentType,
		case when a.ReceivedBankDraftID is not null then 'BankDraft'
			 when a.ReceivedCashID is not null then 'Cash'
			 when a.ReceivedCheqeID is not null then 'Cheque'
			 End as ItemType,
		case when a.ReceivedBankDraftID is not null then a.ReceivedBankDraftID
			 when a.ReceivedCashID is not null then a.ReceivedCashID
			 when a.ReceivedCheqeID is not null then a.ReceivedCheqeID
			 End as ItemID,
		case when rt.Type = 1 then N'AdvanceReceive'
			 when rt.Type = 10 then N'OnAccount'
			end ReceiptAndPaymentType,
		a.ContractID BaseDocID,
		null OriginVatCurrency,
		null ItemCurrencyID,
		null ItemCurrencyRate,
		null ItemAmount

	from fin.ReceiveSubject a
	join cnt.Contract on a.ContractID = Contract.ContractID
	join fin.ReceiveReceipt c on c.ReceiveReceiptID = a.ReceiveReceiptID
	join fin.ReceiptType rt on rt.ReceiptTypeID = a.ReceiptTypeID

	union all

	select
		'Receive' Type,
		C.ReceiveReceiptID DocID,
		c.Number,
		c.Date,
		N'خالص صورت وضعیت شماره ' +cast(d.Number as varchar(250)) BaseDocument,
		case when Contract.CompanyRoll = 1 then -a.Amount when Contract.CompanyRoll = 2 then a.Amount end Amount ,
		a.Description,
		a.Description2,
		a.CurrencyID,
		a.CurrencyRate,
		d.ContractID,
		'confirmstatement' BaseDocumentType,
		case when a.ReceivedBankDraftID is not null then 'BankDraft'
			 when a.ReceivedCashID is not null then 'Cash'
			 when a.ReceivedCheqeID is not null then 'Cheque'
			 End as ItemType,
		case when a.ReceivedBankDraftID is not null then a.ReceivedBankDraftID
			 when a.ReceivedCashID is not null then a.ReceivedCashID
			 when a.ReceivedCheqeID is not null then a.ReceivedCheqeID
			 End as ItemID,
		N'Settlement' ReceiptAndPaymentType,
		a.confirmstatementid BaseDocID,
		null OriginVatCurrency,
		null ItemCurrencyID,
		null ItemCurrencyRate,
		null ItemAmount

	from fin.ReceiveSubject a
	join cnt.confirmstatement b
		on a.confirmstatementid = b.confirmstatementid
	join fin.ReceiveReceipt c
		on c.ReceiveReceiptID = a.ReceiveReceiptID
	join cnt.contractStatement d
		on d.contractStatementid = b.contractStatementid
	join cnt.Contract on b.ContractID = Contract.ContractID

	union all

	select
		'Receive' Type,
		C.ReceiveReceiptID DocID,
		c.Number,
		c.Date,
		adt.title + N' صورت وضعیت شماره ' +cast(d.Number as varchar(250)) BaseDocument,
		case when Contract.CompanyRoll = 1 then -a.Amount when Contract.CompanyRoll = 2 then a.Amount end Amount ,
		a.Description,
		a.Description2,
		a.CurrencyID,
		a.CurrencyRate,
		b.ContractID,
		'additiondeduction' BaseDocumentType,
		case when a.ReceivedBankDraftID is not null then 'BankDraft'
			 when a.ReceivedCashID is not null then 'Cash'
			 when a.ReceivedCheqeID is not null then 'Cheque'
			 End as ItemType,
		case when a.ReceivedBankDraftID is not null then a.ReceivedBankDraftID
			 when a.ReceivedCashID is not null then a.ReceivedCashID
			 when a.ReceivedCheqeID is not null then a.ReceivedCheqeID
			 End as ItemID,
		N'Settlement' ReceiptAndPaymentType,
		a.confirmstatementItemId BaseDocID,
		null OriginVatCurrency,
		null ItemCurrencyID,
		null ItemCurrencyRate,
		null ItemAmount

	from fin.ReceiveSubject a
	join cnt.confirmstatementItem i
		on i.confirmstatementItemId = a.confirmstatementItemID
	join cnt.additiondeductionType adt 
		on adt.additiondeductionTypeID = i.additiondeductionTypeID
	join cnt.confirmstatement b
		on i.confirmstatementid = b.confirmstatementid
	join fin.ReceiveReceipt c
		on c.ReceiveReceiptID = a.ReceiveReceiptID
	join cnt.contractStatement d
		on d.contractStatementid = b.contractStatementid
	join cnt.Contract on b.ContractID = Contract.ContractID

	union all

	select
		'Receive' Type,
		C.ReceiveReceiptID DocID,
		c.Number,
		c.Date,
		N'ارزش افزوده صورت وضعیت شماره ' +cast(b.Number as varchar(250)) BaseDocument,
		case when Contract.CompanyRoll = 1 then -a.Amount when Contract.CompanyRoll = 2 then a.Amount end Amount ,
		a.Description,
		a.Description2,
		a.CurrencyID,
		a.CurrencyRate,
		b.ContractID,
		'Vat' BaseDocumentType,
		case when a.ReceivedBankDraftID is not null then 'BankDraft'
			 when a.ReceivedCashID is not null then 'Cash'
			 when a.ReceivedCheqeID is not null then 'Cheque'
			 End as ItemType,
		case when a.ReceivedBankDraftID is not null then a.ReceivedBankDraftID
			 when a.ReceivedCashID is not null then a.ReceivedCashID
			 when a.ReceivedCheqeID is not null then a.ReceivedCheqeID
			 End as ItemID,
		N'Settlement' ReceiptAndPaymentType,
		a.ContractStatementID BaseDocID,
		b.CurrencyID OriginVatCurrency,
		null ItemCurrencyID,
		null ItemCurrencyRate,
		null ItemAmount

	from fin.ReceiveSubject a
	join cnt.contractstatement b
		on a.ContractStatementID = b.ContractStatementID
	join fin.ReceiveReceipt c
		on c.ReceiveReceiptID = a.ReceiveReceiptID
	join cnt.Contract on b.ContractID = Contract.ContractID

	union all

	select
		'Receive' Type,
		C.ReceiveReceiptID DocID,
		c.Number,
		c.Date,
		N' صورتحساب شماره' + case when b.InvoiceNumber is not null 
											then b.InvoiceNumber 
										else cast(b.Number as varchar(250)) end BaseDocument,
		case when Contract.CompanyRoll = 1 then -a.Amount when Contract.CompanyRoll = 2 then a.Amount end Amount ,
		a.Description,
		a.Description2,
		a.CurrencyID,
		a.CurrencyRate,
		i.ContractID,
		'PurchaseInvoice' BaseDocumentType,
		case when a.ReceivedBankDraftID is not null then 'BankDraft'
			 when a.ReceivedCashID is not null then 'Cash'
			 when a.ReceivedCheqeID is not null then 'Cheque'
			 End as ItemType,
		case when a.ReceivedBankDraftID is not null then a.ReceivedBankDraftID
			 when a.ReceivedCashID is not null then a.ReceivedCashID
			 when a.ReceivedCheqeID is not null then a.ReceivedCheqeID
			 End as ItemID,
		N'Settlement' ReceiptAndPaymentType,
		a.PurchaseInvoiceID BaseDocID,
		null OriginVatCurrency,
		null ItemCurrencyID,
		null ItemCurrencyRate,
		null ItemAmount

	from fin.ReceiveSubject a
	join vnd.PurchaseInvoice b
		on a.PurchaseInvoiceID = b.PurchaseInvoiceID
	join fin.ReceiveReceipt c
		on c.ReceiveReceiptID = a.ReceiveReceiptID
	join
	(
		select a.PurchaseInvoiceID,ContractID
		from vnd.PurchaseInvoiceItem a
		join cnt.ContractSubject b
			on a.ContractSubjectID = b.ContractSubjectID
		group by a.PurchaseInvoiceID,ContractID
	)i
		on i.PurchaseInvoiceID = b.PurchaseInvoiceID
	join cnt.Contract on i.ContractID = Contract.ContractID

	union all

	select
		'CreditAllocation' Type,
		C.CreditAllocationID DocID,
		c.Number,
		c.Date,
		N'خالص صورت وضعیت شماره ' +cast(d.Number as varchar(250)) BaseDocument,
		a.Amount,
		null Description,
		null Description2,
		pi.CurrencyID,
		c.CurrencyRate,
		b.ContractID,
		'confirmstatement' BaseDocumentType,
		'CreditAllocationItem' ItemType,
		a.CreditAllocationItemID ItemID,
		N'Settlement' ReceiptAndPaymentType,
		a.confirmstatementid BaseDocID,
		null OriginVatCurrency,
		null ItemCurrencyID,
		null ItemCurrencyRate,
		null ItemAmount

		
	from fos.CreditAllocationItem a
	join cnt.confirmstatement b
		on a.confirmstatementid = b.confirmstatementid
	join fos.CreditAllocation c
		on c.CreditAllocationID = a.CreditAllocationID
	join cnt.contractStatement d
		on d.contractStatementid = b.contractStatementid
	join fos.LetterCredit lc
		on lc.LetterCreditID = c.LetterCreditID
	join fos.ProformaInvoice pi
		on pi.ProformaInvoiceID = lc.ProformaInvoiceID


	union all

	select
		'CreditAllocation' Type,
		C.CreditAllocationID DocID,
		c.Number,
		c.Date,
		adt.title + N' صورت وضعیت شماره ' +cast(d.Number as varchar(250)) BaseDocument,
		a.Amount,
		null Description,
		null Description2,
		pi.CurrencyID,
		c.CurrencyRate,
		b.ContractID,
		'additiondeduction' BaseDocumentType,
		'CreditAllocationItem' ItemType,
		a.CreditAllocationItemID ItemID,
		N'Settlement' ReceiptAndPaymentType,
		a.confirmstatementItemId BaseDocID,
		null OriginVatCurrency,
		null ItemCurrencyID,
		null ItemCurrencyRate,
		null ItemAmount
		
	from fos.CreditAllocationItem a
	join cnt.confirmstatementItem i
		on i.confirmstatementItemId = a.confirmstatementItemID
	join cnt.additiondeductionType adt 
		on adt.additiondeductionTypeID = i.additiondeductionTypeID
	join cnt.confirmstatement b
		on i.confirmstatementid = b.confirmstatementid
	join fos.CreditAllocation c
		on c.CreditAllocationID = a.CreditAllocationID
	join cnt.contractStatement d
		on d.contractStatementid = b.contractStatementid
	join fos.LetterCredit lc
		on lc.LetterCreditID = c.LetterCreditID
	join fos.ProformaInvoice pi
		on pi.ProformaInvoiceID = lc.ProformaInvoiceID


	union all

	select
		'CreditAllocation' Type,
		C.CreditAllocationID DocID,
		c.Number,
		c.Date,
		N'ارزش افزوده صورت وضعیت شماره ' +cast(b.Number as varchar(250)) BaseDocument,
		a.Amount,
		null Description,
		null Description2,
		pi.CurrencyID,
		c.CurrencyRate,
		b.ContractID,
		'Vat' BaseDocumentType,
		'CreditAllocationItem' ItemType,
		a.CreditAllocationItemID ItemID,
		N'Settlement' ReceiptAndPaymentType,
		a.ContractStatementID BaseDocID,
		b.CurrencyID OriginVatCurrency,
		null ItemCurrencyID,
		null ItemCurrencyRate,
		null ItemAmount
		
	from fos.CreditAllocationItem a
	join cnt.contractstatement b
		on a.ContractStatementID = b.ContractStatementID
	join fos.CreditAllocation c
		on c.CreditAllocationID = a.CreditAllocationID
	join fos.LetterCredit lc
		on lc.LetterCreditID = c.LetterCreditID
	join fos.ProformaInvoice pi
		on pi.ProformaInvoiceID = lc.ProformaInvoiceID


	union all

	select
		'CreditAllocation' Type,
		C.CreditAllocationID DocID,
		c.Number,
		c.Date,
		N' صورتحساب شماره' + case when b.InvoiceNumber is not null 
											then b.InvoiceNumber
										else cast(b.Number as varchar(250)) end BaseDocument,
		a.Amount,
		null Description,
		null Description2,
		b.CurrencyID,
		c.CurrencyRate,
		i.ContractID,
		'PurchaseInvoice' BaseDocumentType,
		'CreditAllocationItem' ItemType,
		a.CreditAllocationItemID ItemID,
		N'Settlement' ReceiptAndPaymentType,
		a.PurchaseInvoiceID BaseDocID,
		null OriginVatCurrency,
		null ItemCurrencyID,
		null ItemCurrencyRate,
		null ItemAmount
		
	from fos.CreditAllocationItem a
	join vnd.PurchaseInvoice b
		on a.PurchaseInvoiceID = b.PurchaseInvoiceID
	join fos.CreditAllocation c
		on c.CreditAllocationID = a.CreditAllocationID
	join
	(
		select a.PurchaseInvoiceID,ContractID
		from vnd.PurchaseInvoiceItem a
		join cnt.ContractSubject b
			on a.ContractSubjectID = b.ContractSubjectID
		group by a.PurchaseInvoiceID,ContractID
	)i
		on i.PurchaseInvoiceID = b.PurchaseInvoiceID


	union all

	select
		'DebitCreditNote' Type,
		C.DebitCreditNoteID DocID,
		c.Number,
		c.Date,
		N' قرارداد شماره' +cast(Contract.Number as varchar(250)) BaseDocument,
		case when a.ReceiptTypeID is not null 
				then case when Contract.CompanyRoll = 1 then -a.Amount else a.Amount end
				else 
					 case when Contract.CompanyRoll = 1 then a.Amount else -a.Amount end 
			end 	Amount	,
		a.Description,
		a.Description2,
		a.CurrencyID,
		a.CurrencyRate,
		a.ContractID,
		'Contract' BaseDocumentType,
		'DebitCreditNoteItem' ItemType,
		a.DebitCreditNoteItemID ItemID,
		case when rt.Type = 1  then N'AdvanceReceive'
			 when pt.Type = 10 then N'DownPayment'
			 when rt.Type = 10 or pt.Type = 12 then N'OnAccount'
			end ReceiptAndPaymentType,
		a.ContractID BaseDocID,
		null OriginVatCurrency,
		null ItemCurrencyID,
		null ItemCurrencyRate,
		null ItemAmount

	from cfg.DebitCreditNoteItem a
	join cnt.Contract on a.ContractID = Contract.ContractID
	join cfg.DebitCreditNote c on c.DebitCreditNoteID = a.DebitCreditNoteID
	left join fin.PaymentType pt on pt.PaymentTypeID = a.PaymentTypeID
	left join fin.ReceiptType rt on rt.ReceiptTypeID = a.ReceiptTypeID


	union all

	select
		'DebitCreditNote' Type,
		C.DebitCreditNoteID DocID,
		c.Number,
		c.Date,
		N'خالص صورت وضعیت شماره ' +cast(d.Number as varchar(250)) BaseDocument,
		case when a.ReceiptTypeID is not null 
				then case when Contract.CompanyRoll = 1 then -a.Amount else a.Amount end
				else 
					 case when Contract.CompanyRoll = 1 then a.Amount else -a.Amount end end 	Amount	,
		a.Description,
		a.Description2,
		a.CurrencyID,
		a.CurrencyRate,
		b.ContractID,
		'confirmstatement' BaseDocumentType,
		'DebitCreditNoteItem' ItemType,
		a.DebitCreditNoteItemID ItemID,
		N'Settlement' ReceiptAndPaymentType,
		a.confirmstatementid BaseDocID,
		null OriginVatCurrency,
		null ItemCurrencyID,
		null ItemCurrencyRate,
		null ItemAmount

	from cfg.DebitCreditNoteItem a
	join cnt.confirmstatement b
		on a.confirmstatementid = b.confirmstatementid
	join cfg.DebitCreditNote c
		on c.DebitCreditNoteID = a.DebitCreditNoteID
	join cnt.contractStatement d
		on d.contractStatementid = b.contractStatementid
	join cnt.Contract on b.ContractID = Contract.ContractID

	union all

	select
		'DebitCreditNote' Type,
		C.DebitCreditNoteID DocID,
		c.Number,
		c.Date,
		adt.title + N' صورت وضعیت شماره ' +cast(d.Number as varchar(250)) BaseDocument,
		case when a.ReceiptTypeID is not null 
				then case when Contract.CompanyRoll = 1 then -a.Amount else a.Amount end
				else 
					 case when Contract.CompanyRoll = 1 then a.Amount else -a.Amount end end 	Amount	,
		a.Description,
		a.Description2,
		a.CurrencyID,
		a.CurrencyRate,
		b.ContractID,
		'additiondeduction' BaseDocumentType,
		'DebitCreditNoteItem' ItemType,
		a.DebitCreditNoteItemID ItemID,
		N'Settlement' ReceiptAndPaymentType,
		a.confirmstatementItemId BaseDocID,
		null OriginVatCurrency,
		null ItemCurrencyID,
		null ItemCurrencyRate,
		null ItemAmount

	from cfg.DebitCreditNoteItem a
	join cnt.confirmstatementItem i
		on i.confirmstatementItemId = a.confirmstatementItemID
	join cnt.additiondeductionType adt 
		on adt.additiondeductionTypeID = i.additiondeductionTypeID
	join cnt.confirmstatement b
		on i.confirmstatementid = b.confirmstatementid
	join cfg.DebitCreditNote c
		on c.DebitCreditNoteID = a.DebitCreditNoteID
	join cnt.contractStatement d
		on d.contractStatementid = b.contractStatementid
	join cnt.Contract on b.ContractID = Contract.ContractID

	union all

	select
		'DebitCreditNote' Type,
		C.DebitCreditNoteID DocID,
		c.Number,
		c.Date,
		N'ارزش افزوده صورت وضعیت شماره ' +cast(b.Number as varchar(250)) BaseDocument,
		case when a.ReceiptTypeID is not null 
				then case when Contract.CompanyRoll = 1 then -a.Amount else a.Amount end
				else 
					 case when Contract.CompanyRoll = 1 then a.Amount else -a.Amount end end 	Amount	,
		a.Description,
		a.Description2,
		a.CurrencyID,
		a.CurrencyRate,
		b.ContractID,
		'Vat' BaseDocumentType,
		'DebitCreditNoteItem' ItemType,
		a.DebitCreditNoteItemID ItemID,
		N'Settlement' ReceiptAndPaymentType,
		a.ContractStatementID BaseDocID,
		b.CurrencyID OriginVatCurrency,
		null ItemCurrencyID,
		null ItemCurrencyRate,
		null ItemAmount

	from cfg.DebitCreditNoteItem a
	join cnt.contractstatement b
		on a.ContractStatementID = b.ContractStatementID
	join cfg.DebitCreditNote c
		on c.DebitCreditNoteID = a.DebitCreditNoteID
	join cnt.Contract on b.ContractID = Contract.ContractID

	union all

	select
		'DebitCreditNote' Type,
		C.DebitCreditNoteID DocID,
		c.Number,
		c.Date,
		N' صورتحساب شماره' + case when b.InvoiceNumber is not null 
											then b.InvoiceNumber
										else cast(b.Number as varchar(250)) end BaseDocument,
		case when a.ReceiptTypeID is not null 
				then case when Contract.CompanyRoll = 1 then -a.Amount else a.Amount end
				else 
					 case when Contract.CompanyRoll = 1 then a.Amount else -a.Amount end end 	Amount	,
		a.Description,
		a.Description2,
		a.CurrencyID,
		a.CurrencyRate,
		i.ContractID,
		'PurchaseInvoice' BaseDocumentType,
		'DebitCreditNoteItem' ItemType,
		a.DebitCreditNoteItemID ItemID,
		N'Settlement' ReceiptAndPaymentType,
		a.PurchaseInvoiceID BaseDocID,
		null OriginVatCurrency,
		null ItemCurrencyID,
		null ItemCurrencyRate,
		null ItemAmount

	from cfg.DebitCreditNoteItem a
	join vnd.PurchaseInvoice b
		on a.PurchaseInvoiceID = b.PurchaseInvoiceID
	join cfg.DebitCreditNote c
		on c.DebitCreditNoteID = a.DebitCreditNoteID
	join
	(
		select a.PurchaseInvoiceID,ContractID
		from vnd.PurchaseInvoiceItem a
		join cnt.ContractSubject b
			on a.ContractSubjectID = b.ContractSubjectID
		group by a.PurchaseInvoiceID,ContractID
	)i
		on i.PurchaseInvoiceID = b.PurchaseInvoiceID
	join cnt.Contract on i.ContractID = Contract.ContractID

	union all

	select
		'DebitCreditNote' Type,
		C.DebitCreditNoteID DocID,
		c.Number,
		c.Date,
		N'استهلاک ' + case when pt.Type = 12 then N'علی الحساب '
						   when pt.Type = 10 then N'پیش پرداخت ' end BaseDocument,
		case when Contract.CompanyRoll = 1 then -a.Amount else a.Amount end Amount,
		a.Description,
		a.Description2,
		a.CurrencyID,
		a.CurrencyRate,
		b.ContractID,
		'Contract' BaseDocumentType,
		'DebitCreditNoteItem' ItemType,
		a.DebitCreditNoteItemID ItemID,
		case when pt.Type = 10 then N'DownPayment'
			 when pt.Type = 12 then N'OnAccount'
			end ReceiptAndPaymentType,
		b.ContractID BaseDocID,
		null OriginVatCurrency,
		null ItemCurrencyID,
		null ItemCurrencyRate,
		null ItemAmount

	from cfg.DebitCreditNoteItem a
	join fin.PaymentSubject b on a.PaymentSubjectID = b.PaymentSubjectID
	join cfg.DebitCreditNote c on c.DebitCreditNoteID = a.DebitCreditNoteID
	join fin.PaymentType pt on pt.PaymentTypeID = a.PaymentTypeID
	join cnt.Contract on b.ContractID = Contract.ContractID

	union all

	select
		'DebitCreditNote' Type,
		C.DebitCreditNoteID DocID,
		c.Number,
		c.Date,
		N'استهلاک ' + case  when pt.Type = 12 or rt.Type = 10 then N'علی الحساب '
						   when pt.Type = 10 then N'پیش پرداخت ' 
						   when rt.Type = 1 then N'پیش دریافت 'end  BaseDocument,
		case when rt.ReceiptTypeID is not null then
			case when Contract.CompanyRoll = 1 then a.Amount else -a.Amount end
			else
			case when Contract.CompanyRoll = 1 then a.Amount else -a.Amount end
			end Amount,
		a.Description,
		a.Description2,
		a.CurrencyID,
		a.CurrencyRate,
		b.ContractID,
		'Contract' BaseDocumentType,
		'DebitCreditNoteItem' ItemType,
		a.DebitCreditNoteItemID ItemID,
		case when pt.Type = 10 then N'DownPayment'
			 when pt.Type = 12 or rt.Type = 10 then N'OnAccount'
			 when rt.Type = 1 then N'AdvanceReceive'
			end ReceiptAndPaymentType,
		b.ContractID BaseDocID,
		null OriginVatCurrency,
		null ItemCurrencyID,
		null ItemCurrencyRate,
		null ItemAmount

	from cfg.DebitCreditNoteItem a
	join cfg.DebitCreditNoteItem  b on a.DebitCreditID = b.DebitCreditNoteItemID
	join cfg.DebitCreditNote c on c.DebitCreditNoteID = a.DebitCreditNoteID
	join cnt.Contract on b.ContractID = Contract.ContractID
	left join fin.PaymentType pt on pt.PaymentTypeID = a.PaymentTypeID
	left join fin.ReceiptType rt on rt.ReceiptTypeID = a.ReceiptTypeID
	where
		(
			(pt.PaymentTypeID is not null and a.type = 1)
			or
			(rt.ReceiptTypeID is not null and a.type = 0)
		)

	union all

	select
		'DebitCreditNote' Type,
		C.DebitCreditNoteID DocID,
		c.Number,
		c.Date,
		N'استهلاک ' + case when pt.Type = 10 then N'علی الحساب '
						   when pt.Type = 1 then N'پیش دریافت ' end BaseDocument,
		case when Contract.CompanyRoll = 1 then a.Amount else -a.Amount end Amount,
		a.Description,
		a.Description2,
		a.CurrencyID,
		a.CurrencyRate,
		b.ContractID,
		'Contract' BaseDocumentType,
		'DebitCreditNoteItem' ItemType,
		a.DebitCreditNoteItemID ItemID,
		case when pt.Type = 1 then N'AdvanceReceive'
			 when pt.Type = 10 then N'OnAccount'
			end ReceiptAndPaymentType,
		b.ContractID BaseDocID,
		null OriginVatCurrency,
		null ItemCurrencyID,
		null ItemCurrencyRate,
		null ItemAmount

	from cfg.DebitCreditNoteItem a
	join fin.ReceiveSubject b on a.ReceiveSubjectID = b.ReceiveSubjectID
	join cfg.DebitCreditNote c on c.DebitCreditNoteID = a.DebitCreditNoteID
	join fin.ReceiptType pt on pt.ReceiptTypeID = a.ReceiptTypeID
	join cnt.Contract on b.ContractID = Contract.ContractID
