

CREATE   VIEW [CNT].[vwContractStatementNonRequestedRemain]
AS 

	select 
		cs.ContractID,
		cs.ContractStatementID,
		item.Amount NetAmount,
		Tax + Duty CurrenctNetVat,
		case
				when IsBaseCurrencyBasis = 0
					then ROUND(Tax * currencyrate / ExchangeUnit , CFG.GetBaseCurrencyPrecision()) 
				when IsBaseCurrencyBasis = 1
					then ROUND(Tax * ExchangeUnit / currencyrate, CFG.GetBaseCurrencyPrecision())
				end
				+
		case
				when IsBaseCurrencyBasis = 0
					then ROUND(Duty * currencyrate / ExchangeUnit , CFG.GetBaseCurrencyPrecision()) 
				when IsBaseCurrencyBasis = 1
					then ROUND(Duty * ExchangeUnit / currencyrate, CFG.GetBaseCurrencyPrecision())
				end				
				 NetVat,
		isnull(pri.Amount,0)  Done,
		case
				when IsBaseCurrencyBasis = 1
					then ROUND(isnull(pri.Amount,0) * ExchangeUnit / currencyrate  , CFG.GetBaseCurrencyPrecision()) 
				when IsBaseCurrencyBasis = 0
					then ROUND(isnull(pri.Amount,0) * currencyrate / ExchangeUnit, CFG.GetBaseCurrencyPrecision())
				end CurrencyDone,
		case
				when IsBaseCurrencyBasis = 0
					then ROUND(Tax * currencyrate / ExchangeUnit , CFG.GetBaseCurrencyPrecision()) 
				when IsBaseCurrencyBasis = 1
					then ROUND(Tax * ExchangeUnit / currencyrate, CFG.GetBaseCurrencyPrecision())
				end
				+
		case
				when IsBaseCurrencyBasis = 0
					then ROUND(Duty * currencyrate / ExchangeUnit , CFG.GetBaseCurrencyPrecision()) 
				when IsBaseCurrencyBasis = 1
					then ROUND(Duty * ExchangeUnit / currencyrate, CFG.GetBaseCurrencyPrecision())
				end	 -  isnull(pri.Amount,0) VatRemain

	from CNT.ContractStatement cs
	join CNT.ConfirmStatement s 
		on s.ContractStatementID = cs.ContractStatementID
	join CFG.Currency 
		on Currency.CurrencyID = cs.CurrencyID
	join
	(
		select  ContractStatementID,
				SUM(Amount) Amount,
				SUM(Tax) Tax,
				SUM(Duty) Duty
		from cnt.ContractStatementItem
		group by ContractStatementID
	) item
		on item.ContractStatementID = cs.ContractStatementID
	
	left join (select i.BaseDocumentID,sum(i.Amount) Amount 
						from REQ.PaymentRequestItem i	
						join REQ.PaymentRequest h on i.PaymentRequestID = h.PaymentRequestID
						where i.BaseDocumentType = 5 and i.BaseDocumentID is not null 
						and h.Status not in (3,4)
						group by i.BaseDocumentID					
					) pri on cs.ContractStatementID = pri.BaseDocumentID


