
	CREATE   view [NOC].[VWConfirmStatementPortion]
	as

	select   a.ConfirmStatementID,
			 SlID,
			 d.Amount / c.Amount Share,
			 VoucherID,
			 a.PreVoucherID

	from cnt.ConfirmStatement a
	join cnt.ContractStatement b
		on a.ContractStatementID = b.ContractStatementID
	join  
	(
		select ContractStatementID,SUM(Amount) Amount
		from cnt.vwContractStatementItem
		group by ContractStatementID
	) c
		on c.ContractStatementID = b.ContractStatementID
	join(
		select a.ConfirmStatementID,
			   d.SlID,
			   sum(c.Amount) Amount
		from cnt.ConfirmStatement a
		join cnt.ContractStatement b
			on a.ContractStatementID = b.ContractStatementID
		join  cnt.vwContractStatementItem c
			on c.ContractStatementID = b.ContractStatementID
		join cnt.ContractSubject d
			on d.ContractSubjectID = c.ContractSubjectID
		where c.amount <> 0
		group by a.ConfirmStatementID,
				 d.SlID
		) d
		on d.ConfirmStatementID = a.ConfirmStatementID
	left join
	(
		select VoucherID,PrevoucherID
		from acc.VoucherPrevoucher
		group by VoucherID,PrevoucherID
	) v
		on v.PrevoucherID = a.PreVoucherID
