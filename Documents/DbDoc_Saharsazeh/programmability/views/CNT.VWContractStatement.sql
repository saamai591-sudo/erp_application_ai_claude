
create   view [CNT].[VWContractStatement]
as
		select a.ContractID,SUM(a.Amount) Amount  from 
		(
			select  
					a.ContractID,
					ContractStatementTypeID,
					item.Amount
			from CNT.ContractStatement a
			join
			(
				select ContractStatementID,SUM(Amount) Amount
				from CNT.ContractStatementItem
				group by ContractStatementID
			)item on item.ContractStatementID = a.ContractStatementID
		)a

		join cnt.Contract c
		on a.ContractID = c.ContractID
		where c.StatementDeliverySection = 2
		group by a.ContractID,a.ContractStatementTypeID

		union all

		select a.ContractID,a.Amount from 
		(
			select  
					a.ContractID,
					ContractStatementTypeID,
					a.number,
					ROW_NUMBER() over(partition by ContractStatementTypeID order by a.number desc) Rno,
					item.Amount
			from CNT.ContractStatement a
			join
			(
				select ContractStatementID,SUM(Amount) Amount
				from CNT.ContractStatementItem
				group by ContractStatementID
			)item on item.ContractStatementID = a.ContractStatementID
		)a

		join cnt.Contract c
		on a.ContractID = c.ContractID
		where c.StatementDeliverySection = 1 and Rno = 1

