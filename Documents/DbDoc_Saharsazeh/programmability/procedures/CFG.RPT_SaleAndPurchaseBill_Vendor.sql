

CREATE    PROC [CFG].[RPT_SaleAndPurchaseBill_Vendor]
(
@FromDate Date,
@ToDate Date,
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

select ROW_NUMBER() over(order by A.PartyID,A.CurrencyID) ID,
		PartyID,
		CurrencyID,
		sum(OpeningBalance) OpeningBalance,
		sum(SalePurchase) Sale,
		sum(Returned) Returned,
		sum(Discount) Discount,
		sum(Vat) Vat,
		sum(SalePurchase) + sum(Returned) + sum(Discount) + sum(Vat) Net,
		sum(Received) Received,
		sum(Payed) Payed,
		+(sum(OpeningBalance) + sum(SalePurchase) + sum(Returned) + sum(Discount) + sum(Vat) + sum(Received) + sum(Payed)) Remain
		 into #Vendor 
		 from (
				select  PartyID,
						CurrencyID, 
							sum(OpeningBalance)
							+ sum(SalePurchase) 
							+ sum(Returned) 
							+  sum(Discount)
							+ sum(Vat) 
							+ sum(Received) 
							+ sum(Payed) OpeningBalance,
						0 SalePurchase,
						0 Returned,
						0 Discount,
						0 Vat,
						0 Received,
						0 Payed
				from CFG.[VWSaleAndPurchaseBill]
				where (date is null or date < @FromDate)
				and Type = 'Vendor'
				group by PartyID,CurrencyID

				union all

				select  PartyID,
						CurrencyID, 
						0 OpeningBalance,
						sum(SalePurchase) SalePurchase,
						sum(Returned) Returned,
						sum(Discount) Discount,
						sum(Vat) Vat,
						sum(Received) Received,
						+sum(Payed) Payed
				from CFG.[VWSaleAndPurchaseBill]
				where date between @FromDate and @ToDate
				and Type = 'Vendor'
				group by PartyID,CurrencyID
		)A
		group by PartyID,CurrencyID


select  ID,
        a.PartyID,
		a.CurrencyID,
		dl.Code,
		dl.Title,
		dl.Title2,
		case when @CultureNo = 1 then c.Title
	         when @CultureNo = 2 then c.Title2
	    end as Currency,
		OpeningBalance,
		Sale,
		Returned,
		Discount,
		Vat,
		Net,
		Received,
		Payed,
		Remain
from #Vendor A
		join cfg.Party p on a.PartyID = p.PartyID
		join cfg.Currency c on c.CurrencyID = a.CurrencyID
		join acc.dl on dl.DLID = p.DlID
		where @SelectedVendorGroups is null
				or 
			  p.VendorGroupID in (SELECT VALUE
									 FROM   CFG.R_FnCommaStr2Table(@SelectedVendorGroups))
