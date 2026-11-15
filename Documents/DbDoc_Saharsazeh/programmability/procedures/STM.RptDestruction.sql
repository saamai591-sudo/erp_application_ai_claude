CREATE   proc [STM].RptDestruction
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
		a.DestructionID,
		a.Number,
		cfg.GetCLRSaturnDate(a.Date,'YY/MM/DD',0,0) Date,
		b2.Code BranchCode,b2.Title BranchTitle,
		c.Plaque,
		c.Title,
		c.BaseValue + ISNULL(e.cost , 0) + ISNULL(f.Amount , 0) BaseValue,
		c.AccumulatedDepreciation  + isnull(d.Value ,0) Depreciation,
		c.BaseValue + ISNULL(e.cost , 0) + ISNULL(f.Amount , 0) - c.AccumulatedDepreciation  - isnull(d.Value ,0) BookValue,
		a.Description,
		a.Description2,
		dr.Title DestructionReason,
		dr.Title2 DestructionReason2
	 from ast.Destruction a
	 JOIN cfg.Branch AS b2 ON b2.BranchID = a.BranchID
	join ast.DestructionItem b
		on a.DestructionID = b.DestructionID
		join ast.DestructionReason dr on dr.DestructionReasonID=a.DestructionReasonID
	join #Ids on #Ids.id = a.DestructionID
	join ast.Asset c
		on b.AssetID = c.AssetID
	left join #Depreciation d
		on d.AssetID = c.AssetID
	left join #Repair e
		on e.AssetID = c.AssetID
	left join #Adjustment f
		on f.AssetID = c.AssetID
