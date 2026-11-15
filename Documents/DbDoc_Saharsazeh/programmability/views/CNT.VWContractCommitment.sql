

CREATE   View [CNT].VWContractCommitment
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
		c.Amount,
		c.CommitmentTypeID
		
	from fin.ReceiveCommitment a
	join
	(
	select case when cfg.GetuserCulture() = 'fa' then N'چک' else 'Cheque' end ItemType,Number,CurrencyID,Amount,CommitmentTypeID,ReceiveCommitmentID	
	from fin.ReceiveCheqeCommitment

	union all

	select case when cfg.GetuserCulture() = 'fa' then N'ضمانت نامه' else 'Bond' end ItemType,Number,CurrencyID,Amount,CommitmentTypeID	,ReceiveCommitmentID
	from fin.ReceiveGuarantyCommitment

	union all

	select case when cfg.GetuserCulture() = 'fa' then N'سفته' else 'Promissory Note' end ItemType,Number,CurrencyID,Amount,CommitmentTypeID,ReceiveCommitmentID	
	from fin.ReceivePromissoryCommitment	
	) c
		on a.ReceiveCommitmentID = c.ReceiveCommitmentID
	where a.ContractID is not null

	union all

	select
		c.ContractID,
		'ReceiveCommitmentRecall' DocName,
		D.ReceiveCommitmentRecallID DocID, 
		NULL DocNumber,
		D.Date,
		case when cfg.GetuserCulture() = 'fa' then N'چک' else 'Cheque' end ItemType,
		B.Number ItemNumber,
		B.CurrencyID,
		-1 * B.Amount,
		B.CommitmentTypeID
		
	from fin.ReceiveCommitmentRecallItem a
	join fin.ReceiveCheqeCommitment b
		on a.ReceiveCheqeCommitmentID = b.ReceiveCheqeCommitmentID
	join fin.ReceiveCommitment c
		on c.ReceiveCommitmentID = b.ReceiveCommitmentID
	JOIN fin.ReceiveCommitmentRecall D
		ON D.ReceiveCommitmentRecallID = A.ReceiveCommitmentRecallID
	where c.ContractID is not null

	union all

	select
		c.ContractID,
		'ReceiveCommitmentRecall' DocName,
		D.ReceiveCommitmentRecallID DocID, 
		NULL DocNumber,
		D.Date,
		case when cfg.GetuserCulture() = 'fa' then N'سفته' else 'Promissory Note' end ItemType,
		B.Number ItemNumber,
		B.CurrencyID,
		-1 * B.Amount,
		B.CommitmentTypeID
		
	from fin.ReceiveCommitmentRecallItem a
	join fin.ReceivePromissoryCommitment b
		on a.ReceivePromissoryCommitmentID = a.ReceivePromissoryCommitmentID
	join fin.ReceiveCommitment c
		on c.ReceiveCommitmentID = b.ReceiveCommitmentID
	JOIN fin.ReceiveCommitmentRecall D
		ON D.ReceiveCommitmentRecallID = A.ReceiveCommitmentRecallID
	where c.ContractID is not null

	union all

	select
		c.ContractID,
		case when a.OperationType = 2 then 'Deduction'
			 when a.OperationType = 3 then 'Revoke'
			 when a.OperationType = 5 then 'Increase' end DocName,
		a.GuarantyOperationID DocID, 
		a.Number DocNumber,
		a.Date,
		case when cfg.GetuserCulture() = 'fa' then N'ضمانت نامه' else 'Bond' end ItemType,
		B.Number ItemNumber,
		B.CurrencyID,
		 case when a.OperationType = 2 then -1 *a.DeductedAmount
			 when a.OperationType = 3 then -1 * b.Amount-isnull(dd.DeductedAmount,0) 
			 when a.OperationType = 5 then  b.Amount+isnull(dd.DeductedAmount,0) end,
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
		c.Amount,
		c.CommitmentTypeID
		
	from fin.PaymentCommitment a
	join
	(
	select case when cfg.GetuserCulture() = 'fa' then N'چک' else 'Cheque' end ItemType,Number,CurrencyID,Amount,CommitmentTypeID,PaymentCommitmentID	
	from fin.PaymentCheqeCommitment

	union all

	select case when cfg.GetuserCulture() = 'fa' then N'ضمانت نامه' else 'Bond' end ItemType,Number,CurrencyID,Amount,CommitmentTypeID	,PaymentCommitmentID
	from fin.PaymentGuarantyCommitment

	union all

	select case when cfg.GetuserCulture() = 'fa' then N'سفته' else 'Promissory Note' end ItemType,Number,CurrencyID,Amount,CommitmentTypeID,PaymentCommitmentID	
	from fin.PaymentPromissoryCommitment	
	) c
		on a.PaymentCommitmentID = c.PaymentCommitmentID
	where a.ContractID is not null

	union all

	select
		c.ContractID,
		'PaymentCommitmentRecall' DocName,
		D.PaymentCommitmentRecallID DocID, 
		NULL DocNumber,
		D.Date,
		case when cfg.GetuserCulture() = 'fa' then N'چک' else 'Cheque' end ItemType,
		B.Number ItemNumber,
		B.CurrencyID,
		B.Amount,
		B.CommitmentTypeID
		
	from fin.PaymentCommitmentRecallItem a
	join fin.PaymentCheqeCommitment b
		on a.PaymentCheqeCommitmentID = b.PaymentCheqeCommitmentID
	join fin.PaymentCommitment c
		on c.PaymentCommitmentID = b.PaymentCommitmentID
	JOIN fin.PaymentCommitmentRecall D
		ON D.PaymentCommitmentRecallID = A.PaymentCommitmentRecallID
	where c.ContractID is not null

	union all

	select
		c.ContractID,
		'PaymentCommitmentRecall' DocName,
		D.PaymentCommitmentRecallID DocID, 
		NULL DocNumber,
		D.Date,
		case when cfg.GetuserCulture() = 'fa' then N'سفته' else 'Promissory Note' end ItemType,
		B.Number ItemNumber,
		B.CurrencyID,
		B.Amount,
		B.CommitmentTypeID
		
	from fin.PaymentCommitmentRecallItem a
	join fin.PaymentPromissoryCommitment b
		on a.PaymentPromissoryCommitmentID = b.PaymentPromissoryCommitmentID
	join fin.PaymentCommitment c
		on c.PaymentCommitmentID = b.PaymentCommitmentID
	JOIN fin.PaymentCommitmentRecall D
		ON D.PaymentCommitmentRecallID = A.PaymentCommitmentRecallID
	where c.ContractID is not null
