create   view [CNT].[VwContractStatementItem_Remain]
as

select a.ContractStatementItemID,a.amount,a.amount - ISNULL(b.Amount,0) Remain
from cnt.VwContractStatementItem a
left join
(
select BaseDocumentID,Amount
from ast.AdjustmentItem
where BaseDocumentType = 3
) b
	on a.ContractStatementItemID = b.BaseDocumentID