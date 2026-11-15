
--------------------------------------------------------------
CREATE   proc [FOS].DividCostToClearanceItems
(
@ClearanceID int,
@OrderPricingID int
)
as
begin

if exists (select 1 from FOS.OrderPricingItem where OrderPricingID = @OrderPricingID)
	return

declare @UserId int,
		@BaseDigit int

set @UserId = cfg.GetuserID();
set @BaseDigit = cfg.GetBaseCurrencyPrecision();


-- سهم از  هزینه های گمرک
INSERT INTO [FOS].[OrderPricingItem]
           ([OrderPricingID]
           ,[ClearanceItemID]
           ,[OrderPricingCostID]
           ,[Share]
           ,[Creator]
           ,[CreationDate]
           ,[LastEditor]
           ,[LastEditionDate]
           ,[Version])

select [OrderPricingID]
           ,a.[ClearanceItemID]
           ,[OrderPricingCostID]
           ,a.Amount
           ,@UserId
           ,GETDATE()
           ,@UserId
           ,GETDATE()
           ,0
from fos.ClearanceCustomsCost a
join fos.OrderPricingCost opc on opc.ClearanceCustomsCostID = a.ClearanceCustomsCostID
where a.ClearanceID = @ClearanceID and opc.OrderPricingID = @OrderPricingID


-- سهم از  هزینه های بر مبنای ترخیص
INSERT INTO [FOS].[OrderPricingItem]
           ([OrderPricingID]
           ,[ClearanceItemID]
           ,[OrderPricingCostID]
           ,[Share]
           ,[Creator]
           ,[CreationDate]
           ,[LastEditor]
           ,[LastEditionDate]
           ,[Version])

select [OrderPricingID]
           ,ci.[ClearanceItemID]
           ,[OrderPricingCostID]
           ,round(a.Amount * case ShareDividingBase 
											when 0 then 1
											when 1 then bi.MainQuantity
											when 2 then bi.SubQuantity
											when 3 then pi.Price
											end,@BaseDigit)
           ,@UserId
           ,GETDATE()
           ,@UserId
           ,GETDATE()
           ,0

from
	(select d.ClearanceID, d.Amount / case ShareDividingBase 
											when 0 then ItemCount
											when 1 then SumMainQuantity
											when 2 then SumSubQuantity
											when 3 then SumPrice
											end Amount ,[OrderPricingID],OrderPricingCostID,ShareDividingBase
		from
		(
			select a.ClearanceID,b.Amount,[OrderPricingID],OrderPricingCostID,ShareDividingBase
			from fos.CostOfOrderItem i
			join fos.CostOfOrder a on i.CostOfOrderID = a.CostOfOrderID
			join fos.OrderPricingCost b on b.CostOfOrderItemID = i.CostOfOrderItemID
			where a.ClearanceID is not null
			and b.OrderPricingID = @OrderPricingID
		)d
		join
		(
			select ClearanceID,sum(bi.MainQuantity) SumMainQuantity,sum(bi.SubQuantity) SumSubQuantity,
					SUM(pi.Price) SumPrice,count(0) ItemCount
			from fos.ClearanceItem ci
			join fos.BillOfLadingItem bi on ci.BillOfLadingItemID = bi.BillOfLadingItemID
			join vnd.PurchaseInvoiceItem pi on pi.PurchaseInvoiceItemID = bi.PurchaseInvoiceItemID
			group by ci.ClearanceID
		)c on c.ClearanceID = d.ClearanceID
	)a 
join fos.ClearanceItem ci on a.ClearanceID = ci.ClearanceID
join fos.BillOfLadingItem bi on ci.BillOfLadingItemID = bi.BillOfLadingItemID
join vnd.PurchaseInvoiceItem pi on pi.PurchaseInvoiceItemID = bi.PurchaseInvoiceItemID
where ci.ClearanceID = @ClearanceID

-- سهم از  هزینه بارنامه
INSERT INTO [FOS].[OrderPricingItem]
           ([OrderPricingID]
           ,[ClearanceItemID]
           ,[OrderPricingCostID]
           ,[Share]
           ,[Creator]
           ,[CreationDate]
           ,[LastEditor]
           ,[LastEditionDate]
           ,[Version])

select		@OrderPricingID
           ,ci.[ClearanceItemID]
           ,[OrderPricingCostID]
           ,bi.SharingAmount
           ,@UserId
           ,GETDATE()
           ,@UserId
           ,GETDATE()
           ,0

from fos.BillOfLadingItem bi 
join fos.ClearanceItem ci on ci.BillOfLadingItemID = bi.BillOfLadingItemID
join fos.OrderPricingCost o on o.BillOfLadingID = bi.BillOfLadingID
where ci.ClearanceID = @ClearanceID and o.OrderPricingID= @OrderPricingID

-- سهم از  هزینه های بر مبنای بارنامه
INSERT INTO [FOS].[OrderPricingItem]
           ([OrderPricingID]
           ,[ClearanceItemID]
           ,[OrderPricingCostID]
           ,[Share]
           ,[Creator]
           ,[CreationDate]
           ,[LastEditor]
           ,[LastEditionDate]
           ,[Version])

select [OrderPricingID]
           ,ci.[ClearanceItemID]
           ,[OrderPricingCostID]
           ,round(a.Amount *  case ShareDividingBase 
											when 0 then bi.MainQuantity / bi.MainQuantity
											when 1 then bi.MainQuantity
											when 2 then bi.SubQuantity
											when 3 then pi.Price *  bi.MainQuantity / bi.MainQuantity
											end , @BaseDigit)
           ,@UserId
           ,GETDATE()
           ,@UserId
           ,GETDATE()
           ,0

from
	(select d.BillOfLadingID, d.Amount / case ShareDividingBase 
											when 0 then ItemCount
											when 1 then SumMainQuantity
											when 2 then SumSubQuantity
											when 3 then SumPrice
											end Amount ,[OrderPricingID],OrderPricingCostID,ShareDividingBase
		from
			(
				select a.BillOfLadingID,b.Amount,[OrderPricingID],OrderPricingCostID,ShareDividingBase
				from fos.CostOfOrderItem i
				join fos.CostOfOrder a on i.CostOfOrderID = a.CostOfOrderID
				join fos.OrderPricingCost b on b.CostOfOrderItemID = i.CostOfOrderItemID
				where a.BillOfLadingID is not null
				and b.OrderPricingID = @OrderPricingID
			)d
			join
			(
				select BillOfLadingID,sum(bi.MainQuantity) SumMainQuantity,sum(bi.SubQuantity) SumSubQuantity, SUM(pi.Price) SumPrice,count(0) ItemCount
				from fos.BillOfLadingItem bi 
				join vnd.PurchaseInvoiceItem pi on pi.PurchaseInvoiceItemID = bi.PurchaseInvoiceItemID
				group by BillOfLadingID
			)c on c.BillOfLadingID = d.BillOfLadingID
	)a
join fos.BillOfLadingItem bi on bi.BillOfLadingID = a.BillOfLadingID
join fos.ClearanceItem ci on ci.BillOfLadingItemID = bi.BillOfLadingItemID
join vnd.PurchaseInvoiceItem pi on pi.PurchaseInvoiceItemID = bi.PurchaseInvoiceItemID
where ci.ClearanceID = @ClearanceID

-- سهم از  هزینه های بر مبنای پروفرما
INSERT INTO [FOS].[OrderPricingItem]
           ([OrderPricingID]
           ,[ClearanceItemID]
           ,[OrderPricingCostID]
           ,[Share]
           ,[Creator]
           ,[CreationDate]
           ,[LastEditor]
           ,[LastEditionDate]
           ,[Version])

select [OrderPricingID]
           ,ci.[ClearanceItemID]
           ,[OrderPricingCostID]
           ,round(a.Amount *  case ShareDividingBase 
											when 0 then bi.MainQuantity / pi.MainQuantity
											when 1 then bi.MainQuantity
											when 2 then bi.SubQuantity
											when 3 then pi.Price *  bi.MainQuantity / pi.MainQuantity
											end , @BaseDigit)
           ,@UserId
           ,GETDATE()
           ,@UserId
           ,GETDATE()
           ,0

from
	(select d.ProformaInvoiceID, d.Amount / case ShareDividingBase 
											when 0 then ItemCount
											when 1 then SumMainQuantity
											when 2 then SumSubQuantity
											when 3 then SumPrice
											end Amount ,[OrderPricingID],OrderPricingCostID,ShareDividingBase
		from
			(
				select a.ProformaInvoiceID,b.Amount,[OrderPricingID],OrderPricingCostID,ShareDividingBase
				from fos.CostOfOrderItem i
				join fos.CostOfOrder a on i.CostOfOrderID = a.CostOfOrderID
				join fos.OrderPricingCost b on b.CostOfOrderItemID = i.CostOfOrderItemID
				where a.ProformaInvoiceID is not null and a.BaseType = 1
				and b.OrderPricingID = @OrderPricingID
			)d
			join
			(
				select  ProformaInvoiceID,
						sum(pi.MainQuantity) SumMainQuantity,
						sum(pi.SubQuantity) SumSubQuantity, 
						SUM(pi.Price) SumPrice,
						count(0) ItemCount
				from fos.ProformaInvoiceItem pi
				join stf.Stuff s on s.StuffID = pi.StuffID
				where s.Type = 0
				group by ProformaInvoiceID
			)c on c.ProformaInvoiceID = d.ProformaInvoiceID
	)a
join fos.ProformaInvoiceItem pi on pi.ProformaInvoiceID = a.ProformaInvoiceID
join vnd.PurchaseInvoiceItem pi2 on pi2.ProformaInvoiceItemid = pi.ProformaInvoiceItemid
join fos.BillOfLadingItem bi on bi.PurchaseInvoiceItemID = pi2.PurchaseInvoiceItemID
join fos.ClearanceItem ci on ci.BillOfLadingItemID = bi.BillOfLadingItemID
where ci.ClearanceID = @ClearanceID

-- سهم از  هزینه بیمه
INSERT INTO [FOS].[OrderPricingItem]
           ([OrderPricingID]
           ,[ClearanceItemID]
           ,[OrderPricingCostID]
           ,[Share]
           ,[Creator]
           ,[CreationDate]
           ,[LastEditor]
           ,[LastEditionDate]
           ,[Version])

select [OrderPricingID]
           ,ci.[ClearanceItemID]
           ,[OrderPricingCostID]
           ,round(a.Amount *  case ShareDividingBase 
											when 0 then bi.MainQuantity / pi.MainQuantity
											when 1 then bi.MainQuantity
											when 2 then bi.SubQuantity
											when 3 then pi.Price *  bi.MainQuantity / pi.MainQuantity
											end , @BaseDigit)
           ,@UserId
           ,GETDATE()
           ,@UserId
           ,GETDATE()
           ,0

from
	(select d.ProformaInvoiceID, d.Amount / case ShareDividingBase 
											when 0 then ItemCount
											when 1 then SumMainQuantity
											when 2 then SumSubQuantity
											when 3 then SumPrice
											end Amount ,[OrderPricingID],OrderPricingCostID,ShareDividingBase
		from
			(
				select a.ProformaInvoiceID,b.Amount,[OrderPricingID],OrderPricingCostID,ShareDividingBase
				from fos.shippinginsurance a
				join fos.OrderPricingCost b on a.shippinginsuranceID = b.shippinginsuranceID
				where b.OrderPricingID = @OrderPricingID
		   )d
			join
			(
				select  ProformaInvoiceID,
						sum(pi.MainQuantity) SumMainQuantity,
						sum(pi.SubQuantity) SumSubQuantity, 
						SUM(pi.Price) SumPrice,
						count(0) ItemCount				
				from fos.ProformaInvoiceItem pi
				join stf.Stuff s on s.StuffID = pi.StuffID
				where s.Type = 0
				group by ProformaInvoiceID
			)c on c.ProformaInvoiceID = d.ProformaInvoiceID
	)a
join fos.ProformaInvoiceItem pi on pi.ProformaInvoiceID = a.ProformaInvoiceID
join vnd.PurchaseInvoiceItem pi2 on pi2.ProformaInvoiceItemid = pi.ProformaInvoiceItemid
join fos.BillOfLadingItem bi on bi.PurchaseInvoiceItemID = pi2.PurchaseInvoiceItemID
join fos.ClearanceItem ci on ci.BillOfLadingItemID = bi.BillOfLadingItemID
where ci.ClearanceID = @ClearanceID

-- سهم از  هزینه بهره اعتبارات اسنادی
INSERT INTO [FOS].[OrderPricingItem]
           ([OrderPricingID]
           ,[ClearanceItemID]
           ,[OrderPricingCostID]
           ,[Share]
           ,[Creator]
           ,[CreationDate]
           ,[LastEditor]
           ,[LastEditionDate]
           ,[Version])

select [OrderPricingID]
           ,ci.[ClearanceItemID]
           ,[OrderPricingCostID]
           ,round(a.Amount *  case ShareDividingBase 
											when 0 then bi.MainQuantity / pi.MainQuantity
											when 1 then bi.MainQuantity
											when 2 then bi.SubQuantity
											when 3 then pi.Price *  bi.MainQuantity / pi.MainQuantity
											end , @BaseDigit)
           ,@UserId
           ,GETDATE()
           ,@UserId
           ,GETDATE()
           ,0

from
	(select d.ProformaInvoiceID, d.Amount / case ShareDividingBase 
											when 0 then ItemCount
											when 1 then SumMainQuantity
											when 2 then SumSubQuantity
											when 3 then SumPrice
											end Amount ,[OrderPricingID],OrderPricingCostID,ShareDividingBase
		from
			(
				select lc.ProformaInvoiceID,b.Amount,[OrderPricingID],OrderPricingCostID,ShareDividingBase
				from fos.OrderPricingCost b 
				join fos.LetterCredit lc on lc.LetterCreditID = b.LetterCreditID
				where b.OrderPricingID = @OrderPricingID
			)d
			join
			(
				select  ProformaInvoiceID,
						sum(pi.MainQuantity) SumMainQuantity,
						sum(pi.SubQuantity) SumSubQuantity, 
						SUM(pi.Price) SumPrice,
						count(0) ItemCount				
				from fos.ProformaInvoiceItem pi
				join stf.Stuff s on s.StuffID = pi.StuffID
				where s.Type = 0
				group by ProformaInvoiceID
			)c on c.ProformaInvoiceID = d.ProformaInvoiceID
	)a
join fos.ProformaInvoiceItem pi on pi.ProformaInvoiceID = a.ProformaInvoiceID
join vnd.PurchaseInvoiceItem pi2 on pi2.ProformaInvoiceItemid = pi.ProformaInvoiceItemid
join fos.BillOfLadingItem bi on bi.PurchaseInvoiceItemID = pi2.PurchaseInvoiceItemID
join fos.ClearanceItem ci on ci.BillOfLadingItemID = bi.BillOfLadingItemID
where ci.ClearanceID = @ClearanceID

-- سهم از  هزینه های بانکی اعتبارات اسنادی
INSERT INTO [FOS].[OrderPricingItem]
           ([OrderPricingID]
           ,[ClearanceItemID]
           ,[OrderPricingCostID]
           ,[Share]
           ,[Creator]
           ,[CreationDate]
           ,[LastEditor]
           ,[LastEditionDate]
           ,[Version])

select [OrderPricingID]
           ,ci.[ClearanceItemID]
           ,[OrderPricingCostID]
           ,round(a.Amount *  case ShareDividingBase 
											when 0 then bi.MainQuantity / pi.MainQuantity
											when 1 then bi.MainQuantity
											when 2 then bi.SubQuantity
											when 3 then pi.Price *  bi.MainQuantity / pi.MainQuantity
											end , @BaseDigit)
           ,@UserId
           ,GETDATE()
           ,@UserId
           ,GETDATE()
           ,0

from
	(select d.ProformaInvoiceID, d.Amount / case ShareDividingBase 
											when 0 then ItemCount
											when 1 then SumMainQuantity
											when 2 then SumSubQuantity
											when 3 then SumPrice
											end Amount ,[OrderPricingID],OrderPricingCostID,ShareDividingBase
		from
			(
				select lc.ProformaInvoiceID,b.Amount,[OrderPricingID],OrderPricingCostID,ShareDividingBase
				from fos.OrderPricingCost b 
				join fos.LetterCreditBankCost lcbc on lcbc.LetterCreditBankCostID = b.LetterCreditBankCostID
				join fos.LetterCredit lc on lc.LetterCreditID = lcbc.LetterCreditID					 
				where b.OrderPricingID = @OrderPricingID
			)d
			join
			(
				select  ProformaInvoiceID,
						sum(pi.MainQuantity) SumMainQuantity,
						sum(pi.SubQuantity) SumSubQuantity, 
						SUM(pi.Price) SumPrice,
						count(0) ItemCount				
				from fos.ProformaInvoiceItem pi
				join stf.Stuff s on s.StuffID = pi.StuffID
				where s.Type = 0
				group by ProformaInvoiceID
			)c on c.ProformaInvoiceID = d.ProformaInvoiceID
	)a
join fos.ProformaInvoiceItem pi on pi.ProformaInvoiceID = a.ProformaInvoiceID
join vnd.PurchaseInvoiceItem pi2 on pi2.ProformaInvoiceItemid = pi.ProformaInvoiceItemid
join fos.BillOfLadingItem bi on bi.PurchaseInvoiceItemID = pi2.PurchaseInvoiceItemID
join fos.ClearanceItem ci on ci.BillOfLadingItemID = bi.BillOfLadingItemID
where ci.ClearanceID = @ClearanceID


-- سهم از هزینه ثبت سفارش
INSERT INTO [FOS].[OrderPricingItem]
           ([OrderPricingID]
           ,[ClearanceItemID]
           ,[OrderPricingCostID]
           ,[Share]
           ,[Creator]
           ,[CreationDate]
           ,[LastEditor]
           ,[LastEditionDate]
           ,[Version])

select [OrderPricingID]
           ,ci.[ClearanceItemID]
           ,[OrderPricingCostID]
           ,round(a.Amount *  case ShareDividingBase 
											when 0 then bi.MainQuantity / pi.MainQuantity
											when 1 then bi.MainQuantity
											when 2 then bi.SubQuantity
											when 3 then pi.Price *  bi.MainQuantity / pi.MainQuantity
											end , @BaseDigit)
           ,@UserId
           ,GETDATE()
           ,@UserId
           ,GETDATE()
           ,0

from
	(select d.ProformaInvoiceID, d.Amount / case ShareDividingBase 
											when 0 then ItemCount
											when 1 then SumMainQuantity
											when 2 then SumSubQuantity
											when 3 then SumPrice
											end Amount ,[OrderPricingID],OrderPricingCostID,ShareDividingBase
		from
			(
				select a.ProformaInvoiceID,b.Amount,[OrderPricingID],OrderPricingCostID,ShareDividingBase
				from fos.Registration a
				join fos.OrderPricingCost b on a.RegistrationID = b.RegistrationID
				where b.OrderPricingID = @OrderPricingID
			)d
			join
			(
				select  ProformaInvoiceID,
						sum(pi.MainQuantity) SumMainQuantity,
						sum(pi.SubQuantity) SumSubQuantity, 
						SUM(pi.Price) SumPrice,
						count(0) ItemCount				
				from fos.ProformaInvoiceItem pi
				join stf.Stuff s on s.StuffID = pi.StuffID
				where s.Type = 0
				group by ProformaInvoiceID
			)c on c.ProformaInvoiceID = d.ProformaInvoiceID
	)a
join fos.ProformaInvoiceItem pi on pi.ProformaInvoiceID = a.ProformaInvoiceID
join vnd.PurchaseInvoiceItem pi2 on pi2.ProformaInvoiceItemid = pi.ProformaInvoiceItemid
join fos.BillOfLadingItem bi on bi.PurchaseInvoiceItemID = pi2.PurchaseInvoiceItemID
join fos.ClearanceItem ci on ci.BillOfLadingItemID = bi.BillOfLadingItemID
where ci.ClearanceID = @ClearanceID

-- سهم از  هزینه های بر مبنای ثبت سفارش
INSERT INTO [FOS].[OrderPricingItem]
           ([OrderPricingID]
           ,[ClearanceItemID]
           ,[OrderPricingCostID]
           ,[Share]
           ,[Creator]
           ,[CreationDate]
           ,[LastEditor]
           ,[LastEditionDate]
           ,[Version])

select [OrderPricingID]
           ,ci.[ClearanceItemID]
           ,[OrderPricingCostID]
           ,round(a.Amount *  case ShareDividingBase 
											when 0 then bi.MainQuantity / pi.MainQuantity
											when 1 then bi.MainQuantity
											when 2 then bi.SubQuantity
											when 3 then pi.Price *  bi.MainQuantity / pi.MainQuantity
											end , @BaseDigit)
           ,@UserId
           ,GETDATE()
           ,@UserId
           ,GETDATE()
           ,0

from
	(select d.ProformaInvoiceID, d.Amount / case ShareDividingBase 
											when 0 then ItemCount
											when 1 then SumMainQuantity
											when 2 then SumSubQuantity
											when 3 then SumPrice
											end Amount ,[OrderPricingID],OrderPricingCostID,ShareDividingBase
		from
			(
				select r.ProformaInvoiceID,b.Amount,[OrderPricingID],OrderPricingCostID,ShareDividingBase
				from fos.CostOfOrderItem i
				join fos.CostOfOrder a on i.CostOfOrderID = a.CostOfOrderID
				join fos.OrderPricingCost b on b.CostOfOrderItemID = i.CostOfOrderItemID
				join fos.Registration r on r.RegistrationID = a.RegistrationID
				where a.RegistrationID is not null and a.BaseType = 2
				and b.OrderPricingID = @OrderPricingID
			)d
			join
			(
				select  ProformaInvoiceID,
						sum(pi.MainQuantity) SumMainQuantity,
						sum(pi.SubQuantity) SumSubQuantity, 
						SUM(pi.Price) SumPrice,
						count(0) ItemCount
				from fos.ProformaInvoiceItem pi
				join stf.Stuff s on s.StuffID = pi.StuffID
				where s.Type = 0
				group by ProformaInvoiceID
			)c on c.ProformaInvoiceID = d.ProformaInvoiceID
	)a
join fos.ProformaInvoiceItem pi on pi.ProformaInvoiceID = a.ProformaInvoiceID
join vnd.PurchaseInvoiceItem pi2 on pi2.ProformaInvoiceItemid = pi.ProformaInvoiceItemid
join fos.BillOfLadingItem bi on bi.PurchaseInvoiceItemID = pi2.PurchaseInvoiceItemID
join fos.ClearanceItem ci on ci.BillOfLadingItemID = bi.BillOfLadingItemID
where ci.ClearanceID = @ClearanceID


select row_number() over(partition by a.orderpricingcostID order by a.orderpricingitemid) Rno,
	   a.orderpricingitemid,
	   b.Diff
	into #orderpricingitem
from fos.orderpricingitem a
join 
(
	select a.orderpricingcostID,a.amount - b.share Diff
	 from fos.orderpricingcost a
	join 
	(select orderpricingcostID,sum(share)  share
	from fos.orderpricingitem 
	group by orderpricingcostID
	)b
			on a.orderpricingcostID = b.orderpricingcostID
	where a.amount <> b.share
	and a.Description2 = 1
) b 
	on a.orderpricingcostID = b.orderpricingcostID


	update a
	set share = share + diff
	 from fos.orderpricingitem a
	join #orderpricingitem b on a.orderpricingitemid = b.orderpricingitemid
	where b.rno = 1

	--درج بهای اصلی سفارش
INSERT INTO [FOS].[OrderPricingItem]
           ([OrderPricingID]
           ,[ClearanceItemID]
           ,[OrderPricingCostID]
           ,[Share]
           ,[Creator]
           ,[CreationDate]
           ,[LastEditor]
           ,[LastEditionDate]
           ,[Version]
		   ,[PurchaseInvoiceItemID])

select     @OrderPricingID
           ,ci.[ClearanceItemID]
           ,null
           ,ROUND(bi.MainQuantity / pi.NonPricedQuantity * pi.Non , cfg.GetBaseCurrencyPrecision())
           ,@UserId
           ,GETDATE()
           ,@UserId
           ,GETDATE()
           ,0
		   ,bi.PurchaseInvoiceItemID
from
fos.ClearanceItem ci 
join fos.BillOfLadingItem bi on ci.BillOfLadingItemID = bi.BillOfLadingItemID
join vnd.PurchaseInvoice_PriceRemains pi on pi.PurchaseInvoiceItemID = bi.PurchaseInvoiceItemID
where ci.ClearanceID = @ClearanceID
end;


