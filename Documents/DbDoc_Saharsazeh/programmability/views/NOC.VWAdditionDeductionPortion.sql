
CREATE   view [NOC].[VWAdditionDeductionPortion]
as

select a.ConfirmStatementItemID,
	   csii.SlID,
	   h.ContractID,
	   csii.Price / sum(csii.Price) over(partition by a.ConfirmStatementItemID,b.ContractStatementID) Share,
	   VoucherID,
	   h.PreVoucherID
from cnt.ConfirmStatementItem a
join cnt.ConfirmStatement h
	on h.ConfirmStatementID = a.ConfirmStatementID
join cnt.ContractStatement b
	on h.ContractStatementID = b.ContractStatementID
join  
(
select ContractStatementID,d.SlID,sum(c.Amount)Price
from cnt.vwContractStatementItem c	
join cnt.ContractSubject d
	on d.ContractSubjectID = c.ContractSubjectID
where c.amount <> 0
group by ContractStatementID,d.SlID
)csii  on csii.ContractStatementID = b.ContractStatementID
left join
(
select VoucherID,PrevoucherID
from acc.VoucherPrevoucher
group by VoucherID,PrevoucherID
) v
	on v.PrevoucherID = h.PreVoucherID


union all

select a.ConfirmStatementItemID,
	   b.SlID,
	   null ContractID,
	   b.Share,
	   VoucherID,
	   b.AccruePreVoucherID
from cnt.ConfirmStatementItem a
join NOC.VWTraceOfPurchaseInvoice b
	on a.PurchaseInvoiceID = b.PurchaseInvoiceID