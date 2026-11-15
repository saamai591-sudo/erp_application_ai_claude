CREATE 
view [CNT].VWReceiptAndPayment_Dollar
as


select  a.*,
		case when Currency.code = 'usd' then 1 else [CFG].[GetReportCurrencyRate](a.Date) end DollarRate,
		case when Currency.code = 'usd' then a.amount 
			else
				ROUND(
					 case when Currency.IsBaseCurrencyBasis = 0 
						     then ROUND(a.Amount * a.CurrencyRate / Currency.ExchangeUnit , CFG.GetBaseCurrencyPrecision())
						  when Currency.IsBaseCurrencyBasis = 1
							 then ROUND(a.Amount * Currency.ExchangeUnit / a.CurrencyRate , CFG.GetBaseCurrencyPrecision())
					END
				/
				[CFG].[GetReportCurrencyRate](a.Date) ,2) end DollarAmount
from [CNT].VWReceiptAndPayment a
join cfg.Currency on a.CurrencyID = Currency.CurrencyID

