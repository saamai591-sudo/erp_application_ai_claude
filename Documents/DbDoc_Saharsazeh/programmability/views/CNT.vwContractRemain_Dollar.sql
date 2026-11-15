

CREATE   VIEW [CNT].[vwContractRemain_Dollar]
AS 

	select  c.ContractID,
			vw.Price Net,
			ISNULL(ps.Amount, 0)  +
			isnull(dcni.Amount, 0)  +
			isnull(rs.Amount, 0) Done,
			vw.Price  - 
			ISNULL(ps.Amount, 0) -
			isnull(dcni.Amount, 0) -
			isnull(rs.Amount, 0) Remain
	from CNT.[Contract] c
	join (
	select ContractID,sum(price) Price
	from	cnt.VWContractSubject_Dollar
	group by ContractID
	) vw
		on c.ContractID = vw.ContractID
	left join
	(
		select ContractID,SUM(Amount) Amount
		from fin.PaymentSubject 
		where ContractID is not null
		group by ContractID
	) ps
		on ps.ContractID = c.ContractID
	left join
	(
		select ContractID, sum(Amount) Amount
		from CFG.DebitCreditNoteItem 
		where ContractID is not null and [Type] = 0
		group by ContractID
	) dcni
		on c.ContractID = dcni.ContractID
	left join
	(
		select ContractID, sum(Amount) Amount
		from FIN.ReceiveSubject
		where ContractID is not null 
		group by ContractID
	) rs
		on c.ContractID = rs.ContractID













