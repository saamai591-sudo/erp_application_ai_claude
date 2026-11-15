

CREATE   PROC [CFG].[RPT_SaleAndPurchaseBill_Party]
(
@FromDate Date,
@ToDate Date,
@SelectedCustomerGroups varchar(1024) = null,
@SelectedVendorGroups varchar(1024) = null
)

--with encryption
as

	DECLARE @Culture varchar(25),
		@CultureNo tinyint

	set @Culture = CFG.GetuserCulture() 

	select @CultureNo = CultureNo
	from CFG.CultureInfo 
	where Culture = @Culture

		select  ROW_NUMBER() over(order by A.PartyID,A.CurrencyID) ID,A.PartyID,A.CurrencyID,
				sum(OpeningBalance) OpeningBalance,
				sum(Sale) Sale,
				sum(Purchase) Purchase,
				sum(Received) Received,
				sum(Payed) Payed,
				sum(OpeningBalance) + sum(Sale) + sum(Purchase) + sum(Received) +sum(Payed) Remain
		into #Party
		from (
				select  PartyID,
						CurrencyID, 
						sum(OpeningBalance) + sum(SalePurchase) + sum(Returned) + sum(Discount) + sum(Vat) + sum(Received) + sum(Payed) OpeningBalance,
						0 Sale,
						0 Purchase,
						0 Received,
						0 Payed
				from CFG.[VWSaleAndPurchaseBill]
				where (date is null or date < @FromDate)
				group by PartyID,CurrencyID

				union all

				select  PartyID,
						CurrencyID, 
						0 OpeningBalance,
						sum(case when Type = 'Customer'
								 then SalePurchase + Returned + Discount + Vat
								 else 0 end) Sale,
						sum(case when Type = 'Vendor'
								 then  SalePurchase + Returned + Discount + Vat
								 else 0 end) Purchase,
						sum(Received) Received,
						sum(Payed) Payed
				from CFG.[VWSaleAndPurchaseBill]
				where date between @FromDate and @ToDate
				group by PartyID,CurrencyID
		)A
		group by PartyID,CurrencyID


select  ID,
		p.PartyID,
		c.CurrencyID,
		dl.Code,
		dl.Title,
		dl.Title2,
		case when @CultureNo = 1 then c.Title
	         when @CultureNo = 2 then c.Title2
	    end as Currency,
		OpeningBalance,
		Sale,
		Purchase,
		Received,
		Payed,
		Remain
from #Party A
		join cfg.Party p on a.PartyID = p.PartyID
		join cfg.Currency c on c.CurrencyID = a.CurrencyID
		join acc.dl on dl.DLID = p.DlID
		where 
			(
				@SelectedVendorGroups is null
				or 
				p.VendorGroupID in (SELECT VALUE
									 FROM   CFG.R_FnCommaStr2Table(@SelectedVendorGroups))
			)
			 AND
			(
				@SelectedCustomerGroups is null
				or 
				p.CustomerGroupID in (SELECT VALUE
									 FROM   CFG.R_FnCommaStr2Table(@SelectedCustomerGroups))
			)

