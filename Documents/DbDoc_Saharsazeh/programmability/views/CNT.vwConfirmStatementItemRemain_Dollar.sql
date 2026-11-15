

CREATE   VIEW [CNT].[vwConfirmStatementItemRemain_Dollar]
AS 

select *,
		Net - Done Remain
from
(
	select 
		cs.ConfirmStatementID,
		cs.ContractID,
		csi.ConfirmStatementItemID,
		csi.AdditionDeductionTypeID,
		case when Currency.code = 'usd' then (csi.Deduction - csi.Addition - csi.Paid) else
		ROUND( (csi.Deduction - csi.Addition - csi.Paid) / [CFG].[GetReportCurrencyRate](cs.Date) , 2) end Net,
		isnull(ps.Amount,0) + isnull(ca.Amount,0) + isnull(dcni.Amount,0) + isnull(rs.Amount,0) Done,
		ContractStatement.CurrencyID
	from CNT.ConfirmStatementItem csi
	join cnt.ConfirmStatement cs
		on cs.ConfirmStatementID = csi.ConfirmStatementID
	join cnt.ContractStatement
		on ContractStatement.ContractID = cs.ContractID
	join cfg.Currency
		on Currency.Currencyid = ContractStatement.CurrencyID
	left join
	(
		select ConfirmStatementItemID,SUM(case when Currency.code = 'usd' then Amount else ROUND(Amount/ [CFG].[GetReportCurrencyRate](b.Date) , 2) end) Amount
		from fin.PaymentSubject a
		join FIN.PaymentReceipt b
			on a.PaymentReceiptID = b.PaymentReceiptID
		join cfg.Currency
			on Currency.Currencyid = a.CurrencyID
		where ConfirmStatementItemID is not null
		group by ConfirmStatementItemID
	) ps
		on ps.ConfirmStatementItemID = csi.ConfirmStatementItemID
	left join
	(
		select ConfirmStatementItemID,SUM(case when Currency.code = 'usd' then a.Amount else ROUND(a.Amount/ [CFG].[GetReportCurrencyRate](b.Date) , 2) end) Amount
		from fos.CreditAllocationItem a
		join fos.CreditAllocation b
			on a.CreditAllocationID = b.CreditAllocationID
		join fos.LetterCredit c
			on c.LetterCreditID = b.LetterCreditID
		join fos.ProformaInvoice d
			on d.ProformaInvoiceID = c.ProformaInvoiceID
		join cfg.Currency
			on Currency.Currencyid = d.CurrencyID
		where ConfirmStatementItemID is not null
		group by ConfirmStatementItemID
	) ca
		on ca.ConfirmStatementItemID = csi.ConfirmStatementItemID
	left join
	(
		select ConfirmStatementItemID, sum(case when Currency.code = 'usd' then a.Amount else ROUND(Amount/ [CFG].[GetReportCurrencyRate](b.Date) , 2) end) Amount
		from CFG.DebitCreditNoteItem  a
		join CFG.DebitCreditNote b
			on a.DebitCreditNoteID = b.DebitCreditNoteID
		join cfg.Currency
			on Currency.Currencyid = a.CurrencyID
		where ConfirmStatementItemID is not null and [Type] = 0
		group by ConfirmStatementItemID
	) dcni
		on csi.ConfirmStatementItemID = dcni.ConfirmStatementItemID
	left join
	(
		select ConfirmStatementItemID, sum(case when Currency.code = 'usd' then a.Amount else ROUND(Amount/ [CFG].[GetReportCurrencyRate](b.Date) , 2) end) Amount
		from FIN.ReceiveSubject a
		join FIN.ReceiveReceipt b
			on a.ReceiveReceiptID = b.ReceiveReceiptID
		join cfg.Currency
			on Currency.Currencyid = a.CurrencyID
		where ConfirmStatementItemID is not null 
		group by ConfirmStatementItemID
	) rs
		on csi.ConfirmStatementItemID = rs.ConfirmStatementItemID
)A