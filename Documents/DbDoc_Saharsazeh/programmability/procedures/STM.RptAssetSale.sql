

	CREATE    proc [STM].[RptAssetSale]
	(
	@ID varchar(max)
	)

	as 
	CREATE TABLE #Ids
	(
		id            INT,
		itemOrder     INT
	)

	INSERT INTO #Ids
	SELECT [value],
		   Position
	FROM   cfg.R_FnCommaStr2Table(@ID)

	select AssetID,sum(Value) Value
	into #Depreciation
	from ast.Depreciation
	group by AssetID


	select r.AssetID,isnull(sum(rsc1.Price),0)+isnull(sum(rsc2.Price),0) cost
    into #Repair
	from ast.Repair r
	left join ast.RepairServiceCost rsc1 on rsc1.RepairID = r.RepairID
	left join ast.RepairStuffCost  rsc2 on rsc2.RepairID = r.RepairID
    where  r.Type = 2
	group by r.AssetID



	select ai.AssetID,sum(ai.Amount) Amount
	into #Adjustment
	from ast.Adjustment a
	join ast.AdjustmentItem ai on a.AdjustmentID = ai.AdjustmentID
	group by ai.AssetID


	select 
		a.SaleID,
		a.Number,
		cfg.GetCLRSaturnDate(a.Date,'YY/MM/DD',0,0) Date,
		c.Plaque,
		c.Title,
		c.BaseValue + ISNULL(e.cost , 0) + ISNULL(f.Amount , 0) BaseValue,
		c.AccumulatedDepreciation + ISNULL(c.DuringDepreciation,0)  + isnull(d.Value ,0) Depreciation,
		c.BaseValue + ISNULL(e.cost , 0) + ISNULL(f.Amount , 0) - c.AccumulatedDepreciation  - isnull(d.Value ,0) BookValue
	 from ast.Sale a
	join ast.SaleItem b
		on a.SaleID = b.SaleID
	join #Ids on #Ids.id = a.SaleID
	join ast.Asset c
		on b.AssetID = c.AssetID
	left join #Depreciation d
		on d.AssetID = c.AssetID
	left join #Repair e
		on e.AssetID = c.AssetID
	left join #Adjustment f
		on f.AssetID = c.AssetID
