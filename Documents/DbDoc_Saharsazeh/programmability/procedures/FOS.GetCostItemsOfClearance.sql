
--------------------------------------------------------------
CREATE   proc [FOS].GetCostItemsOfClearance
(
@ClearanceID int,
@OrderPricingID int
)
as
begin

declare @BaseDigit int,
		@BillOfLadingDate Date

set @BaseDigit = cfg.GetBaseCurrencyPrecision();

select  ci.ClearanceItemID,
		ci.ClearanceID,
		ci.Amount,
		ci.BillOfLadingItemID,
		bi.BillOfLadingID,
		pii.ProformaInvoiceItemID,
		pii.ProformaInvoiceID,
		b.PurchaseInvoiceItemID,
		ci.RowIndex,
		c.Number,
		b.Number BillOfLadingNumber,
		pi2.Number ProformaInvoiceNumber,
		b.Date,
		bi.SharingAmount
into #ClearanceItem
from fos.ClearanceItem ci
join fos.Clearance c on ci.ClearanceID = c.ClearanceID
join fos.BillOfLadingItem bi on ci.BillOfLadingItemID = bi.BillOfLadingItemID
join fos.BillOfLading b on b.BillOfLadingID = bi.BillOfLadingID
join vnd.PurchaseInvoiceItem pi on pi.PurchaseInvoiceItemID = bi.PurchaseInvoiceItemID
join fos.ProformaInvoiceItem pii on pii.ProformaInvoiceItemID = pi.ProformaInvoiceItemID
join fos.ProformaInvoice pi2 on pi2.ProformaInvoiceID = pii.ProformaInvoiceID
where c.ClearanceID = @ClearanceID
and ci.Amount > 0

select
		pro.ProformaInvoiceItemID,
		bl.Date BillOfLadingDate,
		bl.Number,
		bli.MainQuantity BillOfLadingMainQuantity,
		bli.SubQuantity  BillOfLadingSubQuantity
	into #MainQuantity_Remain
	from fos.ProformaInvoiceItem pro
	left join vnd.PurchaseInvoiceItem pur
		on pro.ProformaInvoiceItemID = pur.ProformaInvoiceItemID
	left join FOS.BillOfLadingItem bli
		on bli.PurchaseInvoiceItemID = pur.PurchaseInvoiceItemID
	left join FOS.BillOfLading bl
		on bl.BillOfLadingID = bli.BillOfLadingID

		select @BillOfLadingDate = MAX(Date)
		from #ClearanceItem

	select
		pro.ProformaInvoiceItemID,
		pro.ProformaInvoiceID,
		pro.MainQuantity,
		pro.SubQuantity,
		pur.MainQuantity DoMainQuantity,
		pur.SubQuantity DoSubQuantity,
		pro.MainQuantity - isnull(pur.MainQuantity,0) Non, 
		pro.SubQuantity - isnull(pur.SubQuantity,0) NonSub
		into #MainQuantity_Remain_2
	from fos.ProformaInvoiceItem pro
	left join 
	(
	select  ProformaInvoiceItemID,
			SUM(BillOfLadingMainQuantity) MainQuantity,
			SUM(BillOfLadingSubQuantity) SubQuantity
		from #MainQuantity_Remain
		where BillOfLadingDate <= @BillOfLadingDate
	group by ProformaInvoiceItemID 
	) pur
		on pro.ProformaInvoiceItemID = pur.ProformaInvoiceItemID




--هزینه های گمرک
INSERT INTO [FOS].[OrderPricingCost]
           ([OrderPricingID]
           ,[SpecialCostID]
           ,[Amount]
           ,[ShareDividingBase]
           ,[Creator]
           ,[CreationDate]
           ,[LastEditor]
           ,[LastEditionDate]
           ,[Version]
           ,[ClearanceCustomsCostID]
           ,[CostOfOrderItemID]
           ,[BillOfLadingID]
           ,[LetterCreditID]
           ,[ShippingInsuranceID]
           ,[RegistrationID]
		   ,[description]
		   ,[description2])
select 
		@OrderPricingID,
		sc.SpecialCostID,
		ccc.Amount,
		null,
		-1,
		GETDATE(),
		-1,
		GETDATE(),
		0,
		ClearanceCustomsCostID,
		null,
		null,
		null,
		null,
		null,
		sc.Title+ N' شماره '+cast(Number as varchar(50)),
		1

 from fos.Clearance c 
join fos.ClearanceCustomsCost ccc on ccc.ClearanceID = c.ClearanceID
join fos.SpecialCost sc on sc.SpecialCostID = ccc.SpecialCostID
where sc.ValueAddedDuty = 0 and sc.ValueAddedTax = 0
and ccc.ClearanceID = @ClearanceID
and ccc.Amount > 0
--هزینه های مبتنی بر ترخیص
INSERT INTO [FOS].[OrderPricingCost]
           ([OrderPricingID]
           ,[SpecialCostID]
           ,[Amount]
           ,[ShareDividingBase]
           ,[Creator]
           ,[CreationDate]
           ,[LastEditor]
           ,[LastEditionDate]
           ,[Version]
           ,[ClearanceCustomsCostID]
           ,[CostOfOrderItemID]
           ,[BillOfLadingID]
           ,[LetterCreditID]
           ,[ShippingInsuranceID]
           ,[RegistrationID]
		   ,[description]
		   ,[description2])
select 
		@OrderPricingID,
		sc.SpecialCostID,
		coi.Amount,
		sc.ShareDividingBase,
		-1,
		GETDATE(),
		-1,
		GETDATE(),
		0,
		null,
		coi.CostOfOrderItemID,
		null,
		null,
		null,
		null,
		sc.Title+ N' شماره '+cast(Number as varchar(50)),
		1

 from fos.CostOfOrder co 
join fos.CostOfOrderItem coi on co.CostOfOrderID = coi.CostOfOrderID
join fos.SpecialCost sc on sc.SpecialCostID = coi.SpecialCostID
where co.ClearanceID = @ClearanceID
and coi.Amount > 0
--هزینه بارنامه
declare @BillOfLadingCostId int

select 
@BillOfLadingCostId = SpecialCostID
from fos.SpecialCost
where code = 103

INSERT INTO [FOS].[OrderPricingCost]
           ([OrderPricingID]
           ,[SpecialCostID]
           ,[Amount]
           ,[ShareDividingBase]
           ,[Creator]
           ,[CreationDate]
           ,[LastEditor]
           ,[LastEditionDate]
           ,[Version]
           ,[ClearanceCustomsCostID]
           ,[CostOfOrderItemID]
           ,[BillOfLadingID]
           ,[LetterCreditID]
           ,[ShippingInsuranceID]
           ,[RegistrationID]
		   ,[description]
		   ,[description2])
select 
		@OrderPricingID,
		@BillOfLadingCostId,
	    sum(a.SharingAmount),
		null ShareDividingBase,
		-1,
		GETDATE(),
		-1,
		GETDATE(),
		0,
		null,
		null,
		a.BillOfLadingID,
		null,
		null,
		null,		
		N'بارنامه شماره '+cast(a.BillOfLadingNumber as varchar(50)),
		1

 from #ClearanceItem a
group by a.BillOfLadingID,a.BillOfLadingNumber
having sum(a.SharingAmount) > 0


--هزینه های مبتنی بر بارنامه
INSERT INTO [FOS].[OrderPricingCost]
           ([OrderPricingID]
           ,[SpecialCostID]
           ,[Amount]
           ,[ShareDividingBase]
           ,[Creator]
           ,[CreationDate]
           ,[LastEditor]
           ,[LastEditionDate]
           ,[Version]
           ,[ClearanceCustomsCostID]
           ,[CostOfOrderItemID]
           ,[BillOfLadingID]
           ,[LetterCreditID]
           ,[ShippingInsuranceID]
           ,[RegistrationID]
		   ,[description]
		   ,[description2])
select 
		@OrderPricingID,
		sc.SpecialCostID,
		coi.Amount,
		sc.ShareDividingBase,
		-1,
		GETDATE(),
		-1,
		GETDATE(),
		0,
		null,
		coi.CostOfOrderItemID,
		null,
		null,
		null,
		null,
		sc.Title + N' شماره '+cast(co.Number as varchar(50)),
		1
 from 
	(select BillOfLadingID
		from #ClearanceItem 
		group by BillOfLadingID
	)b
join fos.CostOfOrder co on co.BillOfLadingID = b.BillOfLadingID
join fos.CostOfOrderItem coi on co.CostOfOrderID = coi.CostOfOrderID
join fos.SpecialCost sc on sc.SpecialCostID = coi.SpecialCostID
where coi.Amount > 0

--هزینه های مبتنی بر پروفرما
INSERT INTO [FOS].[OrderPricingCost]
           ([OrderPricingID]
           ,[SpecialCostID]
           ,[Amount]
           ,[ShareDividingBase]
           ,[Creator]
           ,[CreationDate]
           ,[LastEditor]
           ,[LastEditionDate]
           ,[Version]
           ,[ClearanceCustomsCostID]
           ,[CostOfOrderItemID]
           ,[BillOfLadingID]
           ,[LetterCreditID]
           ,[ShippingInsuranceID]
           ,[RegistrationID]
		   ,[description]
		   ,[description2])
select 
		@OrderPricingID,
		sc.SpecialCostID,
		coi.Amount - isnull(SumShare,0),
		sc.ShareDividingBase,
		-1,
		GETDATE(),
		-1,
		GETDATE(),
		0,
		null,
		coi.CostOfOrderItemID,
		null,
		null,
		null,
		null,
		sc.Title + N' شماره  '+cast(co.Number as varchar(50)),
		case when a.ProformaInvoiceID is not null then 0 else 1 end
 from 
	(select ProformaInvoiceID
		from #ClearanceItem 
		group by ProformaInvoiceID
	)pii
INNER JOIN fos.CostOfOrder co on co.ProformaInvoiceID = pii.ProformaInvoiceID and co.BaseType = 1
INNER JOIN fos.CostOfOrderItem coi on co.CostOfOrderID = coi.CostOfOrderID
INNER JOIN fos.SpecialCost sc on sc.SpecialCostID = coi.SpecialCostID
LEFT JOIN 
	(
	select ProformaInvoiceID
	from #MainQuantity_Remain_2 vw
	where non > 0
	group by ProformaInvoiceID
	)a on a.ProformaInvoiceID = pii.ProformaInvoiceID
left join
(
	select  c.CostOfOrderitemID,
			sum(b.Share) SumShare
	from fos.OrderPricingCost a
	INNER JOIN fos.OrderPricingItem b
		on a.OrderPricingCostID = b.OrderPricingCostID
	INNER JOIN FOS.CostOfOrderItem c
		on c.CostOfOrderitemID = a.CostOfOrderItemID
	INNER JOIN FOS.CostOfOrder d
		on d.CostOfOrderID = c.CostOfOrderID
	where c.CostOfOrderitemID is not null
	group by c.CostOfOrderitemID
)t 
	on t.CostOfOrderitemID = coi.CostOfOrderitemID
where coi.Amount - isnull(SumShare,0) > 0
--هزینه بهره اعتبارات اسنادی
INSERT INTO [FOS].[OrderPricingCost]
           ([OrderPricingID]
           ,[SpecialCostID]
           ,[Amount]
           ,[ShareDividingBase]
           ,[Creator]
           ,[CreationDate]
           ,[LastEditor]
           ,[LastEditionDate]
           ,[Version]
           ,[ClearanceCustomsCostID]
           ,[CostOfOrderItemID]
           ,[BillOfLadingID]
           ,[LetterCreditID]
           ,[ShippingInsuranceID]
           ,[RegistrationID]
		   ,[description]
		   ,[description2])
select 
		@OrderPricingID,
		sc.SpecialCostID,
		lc.ProfitAmount  - isnull(SumShare,0),
		sc.ShareDividingBase,
		-1,
		GETDATE(),
		-1,
		GETDATE(),
		0,
		null,
		null,
		null,
		lc.LetterCreditID,
		null,
		null,
		N'هزینه بهره اعتبارات اسنادی به شماره  '+cast(lc.Number as varchar(50)),
		case when a.ProformaInvoiceID is not null then 0 else 1 end

 from 
	(select ProformaInvoiceID
		from #ClearanceItem 
		group by ProformaInvoiceID
	)pii
join fos.LetterCredit lc on lc.ProformaInvoiceID = pii.ProformaInvoiceID
join fos.SpecialCost sc on sc.code = 102
left join
(
select LetterCreditID,sum(b.Share) SumShare
from fos.OrderPricingCost a
join fos.OrderPricingItem b
	on a.OrderPricingCostID = b.OrderPricingCostID
where LetterCreditID is not null
group by LetterCreditID
)t on t.LetterCreditID = lc.LetterCreditID
LEFT JOIN 
	(
	select ProformaInvoiceID
	from #MainQuantity_Remain_2 vw
	where non > 0
	group by ProformaInvoiceID
	)a on a.ProformaInvoiceID = pii.ProformaInvoiceID
where lc.ProfitAmount  - isnull(SumShare,0) > 0
--هزینه های بانکی اعتبارات اسنادی
INSERT INTO [FOS].[OrderPricingCost]
           ([OrderPricingID]
           ,[SpecialCostID]
           ,[Amount]
           ,[ShareDividingBase]
           ,[Creator]
           ,[CreationDate]
           ,[LastEditor]
           ,[LastEditionDate]
           ,[Version]
           ,[ClearanceCustomsCostID]
           ,[CostOfOrderItemID]
           ,[BillOfLadingID]
           ,[LetterCreditID]
           ,[ShippingInsuranceID]
           ,[RegistrationID]
		   ,[description]
		   ,[description2]
		   ,LetterCreditBankCostID)
select 
		@OrderPricingID,
		sc.SpecialCostID,
		lcbc.Amount - isnull(SumShare,0),
		sc.ShareDividingBase,
		-1,
		GETDATE(),
		-1,
		GETDATE(),
		0,
		null,
		null,
		null,
		null,
		null,
		null,
		N'هزینه های بانکی اعتبارات اسنادی به شماره  '+cast(lc.Number as varchar(50)),
		case when a.ProformaInvoiceID is not null then 0 else 1 end,
		lcbc.LetterCreditBankCostID

 from 
	(select ProformaInvoiceID
		from #ClearanceItem 
		group by ProformaInvoiceID
	)pii
join fos.LetterCredit lc on lc.ProformaInvoiceID = pii.ProformaInvoiceID
join fos.SpecialCost sc on sc.code = 102
join fos.LetterCreditBankCost lcbc on lcbc.LetterCreditID = lc.LetterCreditID
left join
(
select LetterCreditBankCostID,sum(b.Share) SumShare
from fos.OrderPricingCost a
join fos.OrderPricingItem b
	on a.OrderPricingCostID = b.OrderPricingCostID
where LetterCreditBankCostID is not null
group by LetterCreditBankCostID
)t on t.LetterCreditBankCostID = lcbc.LetterCreditBankCostID
LEFT JOIN 
	(
	select ProformaInvoiceID
	from #MainQuantity_Remain_2 vw
	where non > 0
	group by ProformaInvoiceID
	)a on a.ProformaInvoiceID = pii.ProformaInvoiceID
where lcbc.Amount - isnull(SumShare,0) > 0
--هزینه بیمه
INSERT INTO [FOS].[OrderPricingCost]
           ([OrderPricingID]
           ,[SpecialCostID]
           ,[Amount]
           ,[ShareDividingBase]
           ,[Creator]
           ,[CreationDate]
           ,[LastEditor]
           ,[LastEditionDate]
           ,[Version]
           ,[ClearanceCustomsCostID]
           ,[CostOfOrderItemID]
           ,[BillOfLadingID]
           ,[LetterCreditID]
           ,[ShippingInsuranceID]
           ,[RegistrationID]
		   ,[description]
		   ,[description2])
select 
		@OrderPricingID,
		sc.SpecialCostID,
	   case when c.IsBaseCurrencyBasis = 0 then 
	            ROUND(sri.Price * pr.CurrencyRate / c.ExchangeUnit,[CFG].[GetBaseCurrencyPrecision]()) -
		        ROUND(sri.Discount * pr.CurrencyRate / c.ExchangeUnit,[CFG].[GetBaseCurrencyPrecision]()) -
				isnull(sri.AllocationSharingAmount,0)
			when c.IsBaseCurrencyBasis = 1 then 
			    ROUND(sri.Price * c.ExchangeUnit / pr.CurrencyRate,[CFG].[GetBaseCurrencyPrecision]()) -
				ROUND(sri.Discount * c.ExchangeUnit / pr.CurrencyRate,[CFG].[GetBaseCurrencyPrecision]()) -
				isnull(sri.AllocationSharingAmount,0)
	   end - isnull(SumShare,0),
		sc.ShareDividingBase,
		-1,
		GETDATE(),
		-1,
		GETDATE(),
		0,
		null,
		null,
		null,
		null,
		si.ShippingInsuranceID,
		null,
		N'هزینه بیمه به شماره '+cast(si.Number as varchar(50)),
		case when a.ProformaInvoiceID is not null then 0 else 1 end

 from 
	(select ProformaInvoiceID
		from #ClearanceItem 
		group by ProformaInvoiceID
	)pii
INNER JOIN fos.ShippingInsurance si on si.ProformaInvoiceID = pii.ProformaInvoiceID
INNER JOIN fos.SpecialCost sc on sc.code = 101
INNER JOIN VND.PurchaseInvoiceItem AS sri ON  si.PurchaseInvoiceItemID = sri.PurchaseInvoiceItemID 
INNER JOIN VND.PurchaseInvoice pr ON pr.PurchaseInvoiceID = sri.PurchaseInvoiceID
INNER JOIN CFG.Currency c ON pr.CurrencyID = c.CurrencyID
left join 
(
select ShippingInsuranceID,sum(b.Share) SumShare
from fos.OrderPricingCost a
join fos.OrderPricingItem b
	on a.OrderPricingCostID = b.OrderPricingCostID
where ShippingInsuranceID is not null
group by ShippingInsuranceID
)t on t.ShippingInsuranceID = si.ShippingInsuranceID
LEFT JOIN 
	(
	select ProformaInvoiceID
	from #MainQuantity_Remain_2 vw
	where non > 0
	group by ProformaInvoiceID
	)a on a.ProformaInvoiceID = pii.ProformaInvoiceID

--هزینه ثبت سفارش
INSERT INTO [FOS].[OrderPricingCost]
           ([OrderPricingID]
           ,[SpecialCostID]
           ,[Amount]
           ,[ShareDividingBase]
           ,[Creator]
           ,[CreationDate]
           ,[LastEditor]
           ,[LastEditionDate]
           ,[Version]
           ,[ClearanceCustomsCostID]
           ,[CostOfOrderItemID]
           ,[BillOfLadingID]
           ,[LetterCreditID]
           ,[ShippingInsuranceID]
           ,[RegistrationID]
		   ,[description]
		   ,[description2])
select 
		@OrderPricingID,
		sc.SpecialCostID,
		r.WageAmount - isnull(SumShare,0),
		sc.ShareDividingBase,
		-1,
		GETDATE(),
		-1,
		GETDATE(),
		0,
		null,
		null,
		null,
		null,
		null,
		r.RegistrationID,
		N'هزینه ثبت سفارش '+cast( r.Number as varchar(50)),
		case when a.ProformaInvoiceID is not null then 0 else 1 end

 from 
	(select ProformaInvoiceID
		from #ClearanceItem 
		group by ProformaInvoiceID
	)pii
join fos.Registration r on r.ProformaInvoiceID = pii.ProformaInvoiceID
join fos.SpecialCost sc on sc.code = 100
left join
(
	select RegistrationID,sum(b.Share) SumShare
	from fos.OrderPricingCost a
	join fos.OrderPricingItem b
		on a.OrderPricingCostID = b.OrderPricingCostID
	where RegistrationID is not null
	group by RegistrationID
)t
	on t.RegistrationID = r.RegistrationID
LEFT JOIN 
	(
	select ProformaInvoiceID
	from #MainQuantity_Remain_2 vw
	where non > 0
	group by ProformaInvoiceID
	)a on a.ProformaInvoiceID = pii.ProformaInvoiceID
where r.WageAmount - isnull(SumShare,0) > 0
--هزینه های مبتنی بر ثبت سفارش
	INSERT INTO [FOS].[OrderPricingCost]
           ([OrderPricingID]
           ,[SpecialCostID]
           ,[Amount]
           ,[ShareDividingBase]
           ,[Creator]
           ,[CreationDate]
           ,[LastEditor]
           ,[LastEditionDate]
           ,[Version]
           ,[ClearanceCustomsCostID]
           ,[CostOfOrderItemID]
           ,[BillOfLadingID]
           ,[LetterCreditID]
           ,[ShippingInsuranceID]
           ,[RegistrationID]
		   ,[description]
		   ,[description2])
select 
		@OrderPricingID,
		sc.SpecialCostID,
		coi.Amount - isnull(SumShare,0),
		sc.ShareDividingBase,
		-1,
		GETDATE(),
		-1,
		GETDATE(),
		0,
		null,
		coi.CostOfOrderItemID,
		null,
		null,
		null,
		null,
		sc.Title + N' شماره  '+cast(co.Number as varchar(50)),
		case when a.ProformaInvoiceID is not null then 0 else 1 end
 from 
	(select ProformaInvoiceID
		from #ClearanceItem 
		group by ProformaInvoiceID
	)pii
INNER JOIN fos.Registration r on r.ProformaInvoiceID = pii.ProformaInvoiceID
INNER JOIN fos.CostOfOrder co on co.RegistrationID = r.RegistrationID
INNER JOIN fos.CostOfOrderItem coi on co.CostOfOrderID = coi.CostOfOrderID
INNER JOIN fos.SpecialCost sc on sc.SpecialCostID = coi.SpecialCostID
LEFT JOIN 
	(
	select ProformaInvoiceID
	from #MainQuantity_Remain_2 vw
	where non > 0
	group by ProformaInvoiceID
	)a on a.ProformaInvoiceID = pii.ProformaInvoiceID
left join
(
	select  c.CostOfOrderitemID,
			sum(b.Share) SumShare
	from fos.OrderPricingCost a
	INNER JOIN fos.OrderPricingItem b
		on a.OrderPricingCostID = b.OrderPricingCostID
	INNER JOIN FOS.CostOfOrderItem c
		on c.CostOfOrderitemID = a.CostOfOrderItemID
	INNER JOIN FOS.CostOfOrder d
		on d.CostOfOrderID = c.CostOfOrderID
	where c.CostOfOrderitemID is not null
	group by c.CostOfOrderitemID
)t 
	on t.CostOfOrderitemID = coi.CostOfOrderitemID
where coi.Amount - isnull(SumShare,0) > 0
end

