
------------------------------------- modify PRM.CheckDuplicateInProductionTiming ----------------------------------------
--PRM.CheckDuplicateInProductionTiming.StoredProcedure.sql
CREATE    PROC PRM.CheckDuplicateInProductionTiming 
(
@ProductionTimingID int
)

as

declare @Stuffid int,
		@CostCenterId int,
		@CostDriverID int

select  @Stuffid = a.StuffID,
		@CostCenterId = CostCenterId,
		@CostDriverID = CostDriverID
from prm.ProductionTiming a
where ProductionTimingID = @ProductionTimingID

if exists
(
select *
from prm.ProductionTiming a
left join prm.ProductionTimingTrace b
	on a.ProductionTimingID = b.ProductionTimingID
left join prm.ProductionTimingTrace c
	on c.ProductionTimingID = @ProductionTimingID and b.TraceID = c.TraceID and (b.DlID = c.DlID or b.Value = c.Value or b.TraceItemID = c.TraceItemID)
where a.ProductionTimingID <> @ProductionTimingID
and a.StuffID = @Stuffid
and a.CostCenterId = @CostCenterId
and a.CostDriverID = @CostDriverID
)
RAISERROR(N'ProductionManagement.Messages.Unique_stuff_traces_costCenter_costDriver', 16, 12);
