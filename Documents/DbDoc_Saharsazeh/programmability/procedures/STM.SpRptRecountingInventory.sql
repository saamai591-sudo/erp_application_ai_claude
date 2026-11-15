
------------------------------[STM].SpRptRecountingInventory-----------------------------------------------------------------------------------------------
CREATE    proc	[STM].SpRptRecountingInventory
    @ID NVARCHAR(MAX)
--WITH ENCRYPTION 
AS 

SELECT [value] into #ids FROM   cfg.R_FnCommaStr2Table(@ID)


select *
from 
(	select
		a.RecountingInventoryID,
		RII.Type,
		MainQuantity,
		STF.Title,
		STF.Code,
		sto.Title StockTitle,
		sto.Code StockCode,
		cfg.getsaturndate(rip.Date,0) [Date],
		rip.Number,
		c.Title UnitTitle,
		im.Title InventoryMethod,
		RITI.TagNumber,
		b.Title Branch,
		sto.Supervisor
	From STC.RecountingInventory a
	join STC.RecountingInventoryItem RII on RII.RecountingInventoryID = a.RecountingInventoryID
	join stc.RecountingInventoryTagItem RITI on RII.RecountingInventoryTagItemID = RITI.RecountingInventoryTagItemID
	join STC.RecountingInventoryTag l on l.RecountingInventoryTagID = a.RecountingInventoryTagID
	join STC.RecountingInventoryPeriod rip on l.RecountingInventoryPeriodID = rip.RecountingInventoryPeriodID 
	join STF.Stock sto on sto.StockID = rip.StockID
	join cfg.Branch b on b.BranchID = sto.BranchID 
	join STF.vwStuff STF on STF.StuffID = RITI.StuffID
	join stf.MeasureUnit c on c.MeasureUnitID = STF.MainMeasureUnitID
	join stc.InventoryMethod im on im.InventoryMethodID = rip.InventoryMethodID
	join #Ids on #Ids.value = a.RecountingInventoryID
  ) x
pivot 
(
	 max(MainQuantity)
	for [type] in ([1],[2],[3])
)  PivTag
