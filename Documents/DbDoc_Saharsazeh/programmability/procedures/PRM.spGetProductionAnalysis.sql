CREATE   proc [PRM].[spGetProductionAnalysis]
(
@ProductionAnalysisID int
)
--WITH ENCRYPTION 
as

declare @IsNotInFlow bit = 1

if exists
(
select 1
from prm.PlanningItem pi
join prm.ProductionPlanningItem ppi
	on pi.PlanningItemID = ppi.PlanningItemID
where ProductionAnalysisID = @ProductionAnalysisID

union all

select 1
from req.StuffRequestItem sri
join prm.RequiredMaterial rm
	on rm.RequiredMaterialID = sri.RequiredMaterialID
where ProductionAnalysisID = @ProductionAnalysisID

union all

select 1
from req.StuffRequestItem sri
join prm.RequiredProduct rp
	on rp.RequiredProductID = sri.RequiredProductID
where ProductionAnalysisID = @ProductionAnalysisID

)
set @IsNotInFlow = 0

select
	ProductionAnalysisID,
	FinancialPeriodID,
	Number,
	Date,
	Version,
	Creator,
	CreationDate,
	@IsNotInFlow IsNotInFlow
from prm.ProductionAnalysis
where ProductionAnalysisID = @ProductionAnalysisID
