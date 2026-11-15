------------------------------------------------------------------

CREATE    PROCEDURE [FOS].[GetOrderPricingItems]
(
@ID int
)
--WITH ENCRYPTION 
AS
BEGIN

	declare @Culture NVARCHAR(5),
			@CultureNo tinyint
	    
		SET @Culture = cfg.GetuserCulture()	

		select @CultureNo = CultureNo
		from CFG.CultureInfo 
		where Culture = @Culture

	select ClearanceItemID
	into #ClearanceItemIDs
	from STC.StockReceiptItem
	where ClearanceItemID is not null and Price <> 0


	declare @Columns nvarchar(max),@query  nvarchar(max),@Create  nvarchar(max),@SumColumns nvarchar(max)
	SELECT @Columns = STUFF((SELECT DISTINCT ',' + QUOTENAME(SpecialCostID)
					FROM  fos.SpecialCost               
					FOR XML PATH(''),TYPE).value('.', 'NVARCHAR(MAX)'),1,1,'')

	SELECT @Create = STUFF((SELECT DISTINCT 'alter table #SpecialCost add S' + cast(SpecialCostID as nvarchar(50))+' decimal(36,10)'
					FROM  fos.SpecialCost               
					FOR XML PATH(''),TYPE).value('.', 'NVARCHAR(MAX)'),1,0,'')

	SELECT @SumColumns = STUFF((SELECT DISTINCT '+isnull(' + QUOTENAME(SpecialCostID)+',0)'
					FROM  fos.SpecialCost               
					FOR XML PATH(''),TYPE).value('.', 'NVARCHAR(MAX)'),1,1,'')

	create table #SpecialCost
	(
	ClearanceItemID int,
	SumSpecialCosts decimal(36,10)
	)

	print @Create
	exec(@Create)

	set @query = N'
	insert into #SpecialCost
	select ClearanceItemID,
		   '+@SumColumns+',
		   '+@Columns+'
	from
	(
	select a.ClearanceItemID, b.SpecialCostID,sum(a.Share) Share
	from FOS.OrderPricingItem a
	join fos.OrderPricingCost b on a.OrderPricingCostID = b.OrderPricingCostID
	where a.OrderPricingID = @ID
	group by a.ClearanceItemID,b.SpecialCostID
	)x
	pivot
	(
	max(share)
	for SpecialCostID in ('+@Columns+')
	)p'
	print @query
	EXECUTE sp_executeSQL
			@query,
			N'@ID int',
			@ID = @ID


	select a.*,
		   opi.Share + SumSpecialCosts FinishedCost,
		   s.Code StuffCode,
		   case @CultureNo
				when 1 then s.Title
				when 2 then s.Title2
		   end as StuffTitle,
		   b.MainQuantity,
		   b.SubQuantity,		   
		   opi.Share MainCost,
		   cast(case when a.ClearanceItemID in (select * from #ClearanceItemIDs) then 1
		             else 0
				end as bit) as ClearanceItemPriced

	from #SpecialCost a
	join FOS.ClearanceItem ci on a.ClearanceItemID = ci.ClearanceItemID
	join FOS.BillOfLadingItem b on ci.BillOfLadingItemID = b.BillOfLadingItemID
	join VND.PurchaseInvoiceItem p on b.PurchaseInvoiceItemID = p.PurchaseInvoiceItemID
	join STF.VWStuff s on p.StuffID = s.StuffID
	join FOS.OrderPricingItem opi on opi.PurchaseInvoiceItemID = b.PurchaseInvoiceItemID 
									and a.ClearanceItemID = opi.ClearanceItemID     
END

