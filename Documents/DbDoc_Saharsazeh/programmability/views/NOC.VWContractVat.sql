
create   view [NOC].[VWContractVat]
as

select cs1.ContractStatementID,VoucherID,i.Share,cst.TaxSLID SlID,cs2.PreVoucherID
from cnt.ContractStatement cs1
join cnt.ContractStatementType cst
	on cst.ContractStatementTypeID = cs1.ContractStatementTypeID
join cnt.ConfirmStatement cs2
	on cs1.ContractStatementID = cs2.ContractStatementID
join
(
select ContractStatementID,convert (float,sum(Tax))/convert (float,sum(Tax + Duty)) Share
from cnt.ContractStatementItem 
where tax > 0
group by ContractStatementID
)i
on i.ContractStatementID = cs1.ContractStatementID
left join
(
select VoucherID,PrevoucherID
from acc.VoucherPrevoucher
group by VoucherID,PrevoucherID
) v
	on v.PrevoucherID = cs2.PreVoucherID

union all


select cs1.ContractStatementID,VoucherID,i.Share,cst.DutySLID SlID,cs2.PreVoucherID
from cnt.ContractStatement cs1
join cnt.ContractStatementType cst
	on cst.ContractStatementTypeID = cs1.ContractStatementTypeID
join cnt.ConfirmStatement cs2
	on cs1.ContractStatementID = cs2.ContractStatementID
join
(
select ContractStatementID,convert (float,sum(Duty))/convert (float,sum(Tax + Duty)) Share
from cnt.ContractStatementItem
where Duty > 0
group by ContractStatementID
)i
on i.ContractStatementID = cs1.ContractStatementID
left join
(
select VoucherID,PrevoucherID
from acc.VoucherPrevoucher
group by VoucherID,PrevoucherID
) v
	on v.PrevoucherID = cs2.PreVoucherID