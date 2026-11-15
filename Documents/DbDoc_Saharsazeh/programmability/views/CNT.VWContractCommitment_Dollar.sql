
CREATE   View [CNT].[VWContractCommitment_Dollar]
as
	select
		a.ContractID,
		'ReceiveCommitment' DocName,
		a.ReceiveCommitmentID DocID, 
		a.Number DocNumber,
		a.Date,
		c.ItemType,
		c.Number ItemNumber,
		C.CurrencyID,
		case when Currency.code = 'usd' then c.Amount else
		round(c.Amount/[CFG].[GetReportCurrencyRate](a.Date),2) end Amount,
		c.CommitmentTypeID
		
	from fin.ReceiveCommitment a
	join
	(
	select 'Cheque' ItemType,Number,CurrencyID,Amount,CommitmentTypeID,ReceiveCommitmentID	
	from fin.ReceiveCheqeCommitment

	union all

	select 'Bond' ItemType,Number,CurrencyID,Amount,CommitmentTypeID	,ReceiveCommitmentID
	from fin.ReceiveGuarantyCommitment

	union all

	select 'Promissory Note' ItemType,Number,CurrencyID,Amount,CommitmentTypeID,ReceiveCommitmentID	
	from fin.ReceivePromissoryCommitment	
	) c
		on a.ReceiveCommitmentID = c.ReceiveCommitmentID
	join cfg.Currency
		on Currency.CurrencyID = c.CurrencyID
	where a.ContractID is not null

	union all

	select
		c.ContractID,
		'ReceiveCommitmentRecall' DocName,
		D.ReceiveCommitmentRecallID DocID, 
		NULL DocNumber,
		D.Date,
		'Cheque' ItemType,
		B.Number ItemNumber,
		B.CurrencyID,
		case when Currency.code = 'usd' then b.Amount else
		-1 * round(b.Amount/[CFG].[GetReportCurrencyRate](d.Date),2) end Amount,
		B.CommitmentTypeID
		
	from fin.ReceiveCommitmentRecallItem a
	join fin.ReceiveCheqeCommitment b
		on a.ReceiveCheqeCommitmentID = b.ReceiveCheqeCommitmentID
	join fin.ReceiveCommitment c
		on c.ReceiveCommitmentID = b.ReceiveCommitmentID
	JOIN fin.ReceiveCommitmentRecall D
		ON D.ReceiveCommitmentRecallID = A.ReceiveCommitmentRecallID
	join cfg.Currency
		on Currency.CurrencyID = b.CurrencyID
	where c.ContractID is not null

	union all

	select
		c.ContractID,
		'ReceiveCommitmentRecall' DocName,
		D.ReceiveCommitmentRecallID DocID, 
		NULL DocNumber,
		D.Date,
		'Promissory Note' ItemType,
		B.Number ItemNumber,
		B.CurrencyID,
		case when Currency.code = 'usd' then b.Amount else
		-1 * round(b.Amount/[CFG].[GetReportCurrencyRate](d.Date),2) end Amount,
		B.CommitmentTypeID
		
	from fin.ReceiveCommitmentRecallItem a
	join fin.ReceivePromissoryCommitment b
		on a.ReceivePromissoryCommitmentID = a.ReceivePromissoryCommitmentID
	join fin.ReceiveCommitment c
		on c.ReceiveCommitmentID = b.ReceiveCommitmentID
	JOIN fin.ReceiveCommitmentRecall D
		ON D.ReceiveCommitmentRecallID = A.ReceiveCommitmentRecallID
	join cfg.Currency
		on Currency.CurrencyID = b.CurrencyID
	where c.ContractID is not null

	union all
	select
		c.ContractID,
		case when a.OperationType = 2 then 'Deduction'
			 when a.OperationType = 3 then 'Revoke' end DocName,
		a.GuarantyOperationID DocID, 
		a.Number DocNumber,
		a.Date,
		'Bond' ItemType,
		B.Number ItemNumber,
		B.CurrencyID,
		-1 *
		case when Currency.code = 'usd' then 
		case when a.OperationType = 2 then a.DeductedAmount
				  when a.OperationType = 3 then b.Amount-isnull(dd.DeductedAmount,0) end
		else
		round(
		case when a.OperationType = 2 then a.DeductedAmount
				  when a.OperationType = 3 then b.Amount-isnull(dd.DeductedAmount,0) end
		/[CFG].[GetReportCurrencyRate](c.Date),2) end Amount,
		B.CommitmentTypeID
		
	from fin.GuarantyOperation a
	join fin.ReceiveGuarantyCommitment b
		on a.ReceiveGuarantyCommitmentID = b.ReceiveGuarantyCommitmentID
	join fin.ReceiveCommitment c
		on c.ReceiveCommitmentID = b.ReceiveCommitmentID
	left join 
	(
	select ReceiveGuarantyCommitmentID,sum(DeductedAmount) DeductedAmount
	from fin.GuarantyOperation
	group by ReceiveGuarantyCommitmentID
	)dd on dd.ReceiveGuarantyCommitmentID = a.ReceiveGuarantyCommitmentID
	join cfg.Currency
		on Currency.CurrencyID = b.CurrencyID
	where c.ContractID is not null
	and a.CommitmentType = 1
	and a.OperationType in (2,3)

	union all

	select
		a.ContractID,
		'PaymentCommitment' DocName,
		a.PaymentCommitmentID DocID, 
		a.Number DocNumber,
		a.Date,
		c.ItemType,
		c.Number ItemNumber,
		C.CurrencyID,
		case when Currency.code = 'usd' then c.Amount else
		round(c.Amount/[CFG].[GetReportCurrencyRate](a.Date),2) end Amount,
		c.CommitmentTypeID
		
	from fin.PaymentCommitment a
	join
	(
	select 'Cheque' ItemType,Number,CurrencyID,Amount,CommitmentTypeID,PaymentCommitmentID	
	from fin.PaymentCheqeCommitment

	union all

	select 'Bond' ItemType,Number,CurrencyID,Amount,CommitmentTypeID	,PaymentCommitmentID
	from fin.PaymentGuarantyCommitment

	union all

	select 'Promissory Note' ItemType,Number,CurrencyID,Amount,CommitmentTypeID,PaymentCommitmentID	
	from fin.PaymentPromissoryCommitment	
	) c
		on a.PaymentCommitmentID = c.PaymentCommitmentID
	join cfg.Currency
		on Currency.CurrencyID = c.CurrencyID
	where a.ContractID is not null

	union all

	select
		c.ContractID,
		'PaymentCommitmentRecall' DocName,
		D.PaymentCommitmentRecallID DocID, 
		NULL DocNumber,
		D.Date,
		'Cheque' ItemType,
		B.Number ItemNumber,
		B.CurrencyID,
		case when Currency.code = 'usd' then b.Amount else
		round(b.Amount/[CFG].[GetReportCurrencyRate](d.Date),2) end Amount,
		B.CommitmentTypeID
		
	from fin.PaymentCommitmentRecallItem a
	join fin.PaymentCheqeCommitment b
		on a.PaymentCheqeCommitmentID = a.PaymentCheqeCommitmentID
	join fin.PaymentCommitment c
		on c.PaymentCommitmentID = b.PaymentCommitmentID
	JOIN fin.PaymentCommitmentRecall D
		ON D.PaymentCommitmentRecallID = A.PaymentCommitmentRecallID
	join cfg.Currency
		on Currency.CurrencyID = b.CurrencyID
	where c.ContractID is not null

	union all

	select
		c.ContractID,
		'PaymentCommitmentRecall' DocName,
		D.PaymentCommitmentRecallID DocID, 
		NULL DocNumber,
		D.Date,
		'Promissory Note' ItemType,
		B.Number ItemNumber,
		B.CurrencyID,
		case when Currency.code = 'usd' then b.Amount else
		round(b.Amount/[CFG].[GetReportCurrencyRate](d.Date),2) end Amount,
		B.CommitmentTypeID
		
	from fin.PaymentCommitmentRecallItem a
	join fin.PaymentPromissoryCommitment b
		on a.PaymentPromissoryCommitmentID = a.PaymentPromissoryCommitmentID
	join fin.PaymentCommitment c
		on c.PaymentCommitmentID = b.PaymentCommitmentID
	JOIN fin.PaymentCommitmentRecall D
		ON D.PaymentCommitmentRecallID = A.PaymentCommitmentRecallID
	join cfg.Currency
		on Currency.CurrencyID = b.CurrencyID
	where c.ContractID is not null