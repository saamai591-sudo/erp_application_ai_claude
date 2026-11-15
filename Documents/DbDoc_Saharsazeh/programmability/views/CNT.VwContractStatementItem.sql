
Create    view cnt.VwContractStatementItem
as


select a.ContractStatementID,a.ContractStatementItemID,a.contractsubjectid,a.amount - isnull(d.amount,0) amount,a.BaseOfAdditionDeduction
from cnt.ContractStatementItem a
join cnt.ContractStatement b
	on a.ContractStatementID = b.ContractStatementID
join cnt.ContractStatementType t 
	on t.ContractStatementTypeID = b.ContractStatementTypeID
join cnt.Contract c
	on c.ContractID = b.Contractid
outer apply
(
	select top 1 a1.*
	from cnt.ContractStatementItem a1
	join cnt.ContractStatement b1
		on a1.ContractStatementID = b1.ContractStatementID
	join cnt.ContractStatementType t 
		on t.ContractStatementTypeID = b1.ContractStatementTypeID
	where b1.contractid = c.contractid
	and b1.number < b.number
	and a1.contractsubjectid = a.contractsubjectid
	and t.Type = 1
	order by b1.number desc
)d 

where StatementDeliverySection = 1
and t.Type in (1,4)


union all

select a.ContractStatementID,a.ContractStatementItemID,a.contractsubjectid,a.amount ,a.BaseOfAdditionDeduction
from cnt.ContractStatementItem a
join cnt.ContractStatement b
	on a.ContractStatementID = b.ContractStatementID
join cnt.Contract c
	on c.ContractID = b.Contractid
join cnt.ContractStatementType t 
	on t.ContractStatementTypeID = b.ContractStatementTypeID
where (StatementDeliverySection = 2
		or
		t.Type in (2,3)
	  )

