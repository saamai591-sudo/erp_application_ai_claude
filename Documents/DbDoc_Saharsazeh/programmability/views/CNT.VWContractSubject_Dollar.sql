
create   view [CNT].[VWContractSubject_Dollar]

as

select ContractSubjectID,
	   case when b.ParentID is null 
				then b.ContractID 
			else b.ParentID 
		end ContractID,
		case	when Currency.code = 'usd' then Price 
				when Currency.CurrencyID = -1 then
				ROUND(Price / [CFG].[GetReportCurrencyRate](b.Date) ,2) 
				else 
				(
				ROUND(
				case when Currency.IsBaseCurrencyBasis = 0 then 
								ROUND(Price * cur.Value / Currency.ExchangeUnit,[CFG].[GetBaseCurrencyPrecision]())
							when Currency.IsBaseCurrencyBasis = 1 then 
								ROUND(Price * Currency.ExchangeUnit / cur.Value,[CFG].[GetBaseCurrencyPrecision]())
					   end
				/ [CFG].[GetReportCurrencyRate](b.Date) ,2) 
				)
				end Price,
		Price OrginalPrice,
	   a.Description Title,
	   a.Description2 Title2,
	   a.stuffid,
	   cast(RowIndex as int) RowIndex,
	   case when b.ParentID is null 
				then 0
			else 1
		end Issupplementary,
	   case when b.ParentID is null 
				then 
				case	when Currency.code = 'usd' then Price 
						when Currency.CurrencyID = -1 then
						ROUND(Price / [CFG].[GetReportCurrencyRate](b.Date) ,2) 
						else 
						(
						ROUND(
						case when Currency.IsBaseCurrencyBasis = 0 then 
										ROUND(Price * cur.Value / Currency.ExchangeUnit,[CFG].[GetBaseCurrencyPrecision]())
									when Currency.IsBaseCurrencyBasis = 1 then 
										ROUND(Price * Currency.ExchangeUnit / cur.Value,[CFG].[GetBaseCurrencyPrecision]())
							   end
						/ [CFG].[GetReportCurrencyRate](b.Date) ,2) 
						)
						end
			else 0 
		end FirstPrice,
		a.CurrencyID
from CNT.ContractSubject a
join cnt.Contract b
	on a.ContractID = b.ContractID
join cfg.Currency
	on Currency.Currencyid = a.CurrencyID
left join
(
select b.EntityID,b.Value from cfg.EntityCustomeField a
join cfg.EntityCustomeFieldData b on a.EntityCustomeFieldID = b.EntityCustomeFieldID
where EntityName = 'ContractDefinition' and FieldName = 'CurrencyRate'
) cur on cur.EntityID = b.ContractID
where ContractSubjectID not in
(
	select isnull(ParentID,0)
	 from CNT.ContractSubject
)
and a.ParentID is null

union all

select  ContractSubjectID,
		ContractID,
		b.Price,
		OrginalPrice,
		Description,
		Description2,
		stuffid,
		cast(RowIndex as int) RowIndex,
		1 Issupplementary,
		FirstPrice,
		CurrencyID
from
(
	select ROW_NUMBER() over(partition by  a.ParentID order by b.date desc) Rno,
		   a.ParentID ContractSubjectID,
		   case	when Currency.code = 'usd' then a.Price 
					when Currency.CurrencyID = -1 then
					ROUND(a.Price / [CFG].[GetReportCurrencyRate](b.Date) ,2) 
					else 
					(
					ROUND(
					case when Currency.IsBaseCurrencyBasis = 0 then 
									ROUND(a.Price * cur.Value / Currency.ExchangeUnit,[CFG].[GetBaseCurrencyPrecision]())
								when Currency.IsBaseCurrencyBasis = 1 then 
									ROUND(a.Price * Currency.ExchangeUnit / cur.Value,[CFG].[GetBaseCurrencyPrecision]())
							end
					/ [CFG].[GetReportCurrencyRate](b.Date) ,2) 
					)
					end Price,
		   a.Price OrginalPrice,
		   b.date,
		   b.ParentID ContractID,
		   a.RowIndex,
		   a.Description,
		   a.Description2,
		   a.StuffID,
		   case	when Currency.code = 'usd' then a.Price 
					when Currency.CurrencyID = -1 then
					ROUND(a.Price / [CFG].[GetReportCurrencyRate](b.Date) ,2) 
					else 
					(
					ROUND(
					case when Currency.IsBaseCurrencyBasis = 0 then 
									ROUND(a.Price * cur.Value / Currency.ExchangeUnit,[CFG].[GetBaseCurrencyPrecision]())
								when Currency.IsBaseCurrencyBasis = 1 then 
									ROUND(a.Price * Currency.ExchangeUnit / cur.Value,[CFG].[GetBaseCurrencyPrecision]())
							end
					/ [CFG].[GetReportCurrencyRate](b.Date) ,2) 
					)
					end FirstPrice,
			a.CurrencyID
	from CNT.ContractSubject a
	join CNT.Contract b
		on a.ContractID = b.ContractID
	join cnt.ContractSubject p
		on p.ContractSubjectID = a.ParentID
	join cfg.Currency
		on Currency.Currencyid = a.CurrencyID
	left join
	(
	select b.EntityID,b.Value from cfg.EntityCustomeField a
	join cfg.EntityCustomeFieldData b on a.EntityCustomeFieldID = b.EntityCustomeFieldID
	where EntityName = 'ContractDefinition' and FieldName = 'CurrencyRate'
	) cur on cur.EntityID = b.ParentID
	where a.ParentID is not null
)b 
where Rno = 1
