

CREATE    PROC [CFG].[RPT_SaleAndPurchaseBill_VendorGroup]
(
@FromDate Date,
@ToDate Date
)

--with encryption
as

	DECLARE @Culture varchar(25),
		@CultureNo tinyint

	set @Culture = CFG.GetuserCulture() 

	select @CultureNo = CultureNo
	from CFG.CultureInfo 
	where Culture = @Culture


select  Vendorgroupid ID,
		CurrencyID,
		sum(OpeningBalance) OpeningBalance,
		sum(SalePurchase) SalePurchase,
		sum(Returned) Returned,
		sum(Discount) Discount,
		sum(Vat) Vat,
		sum(SalePurchase) + sum(Returned) + sum(Discount) + sum(Vat) Net,
		sum(Received) Received,
		sum(Payed) Payed,
		+(sum(OpeningBalance) + sum(SalePurchase) + sum(Returned) + sum(Discount) + sum(Vat) + sum(Received) + sum(Payed)) Remain
			into #SaleAndPurchaseBill
from (
		select  PartyID,
				CurrencyID, 
				sum(OpeningBalance) + sum(SalePurchase) + sum(Returned) + sum(Discount) + sum(Vat) + sum(Received) + sum(Payed) OpeningBalance,
				0 SalePurchase,
				0 Returned,
				0 Discount,
				0 Vat,
				0 Received,
				0 Payed
		from CFG.[VWSaleAndPurchaseBill]
		where [Type] =  'Vendor'
		and (date is null or date < @FromDate)
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
				-sum(Payed) Payed
		from CFG.[VWSaleAndPurchaseBill]
		where [Type] =  'Vendor'
		and date between @FromDate and @ToDate
		group by PartyID,CurrencyID
	)A
		join CFG.party p on p.PartyID = a.PartyID
		where p.Vendorgroupid is not null
		group by p.Vendorgroupid,CurrencyID



select  ID,
		g.Code GroupCode,
		case when @CultureNo = 1 then g.Title
	         when @CultureNo = 2 then g.Title2
	    end as GroupTitle,
		case when @CultureNo = 1 then c.Title
	         when @CultureNo = 2 then c.Title2
	    end as Currency,
		OpeningBalance,
		SalePurchase,
		Returned,
		Discount,
		Vat,
		Net,
		Received,
		Payed,
		Remain
from #SaleAndPurchaseBill A
join CFG.Currency c on c.CurrencyID = a.CurrencyID
join CFG.[Group] g on g.GroupID = A.ID 
