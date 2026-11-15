
CREATE   VIEW PRM.vwCostCalculationSource
as

with cte as (
    SELECT *
    FROM   prm.vwCostStructureParents AS vcsp
),
cte2 as (
    SELECT *
    FROM   prm.vwSlInCostCalculationPeriod AS vsiccp
) 



SELECT 1                 AS CostStructureType,
       pp.StuffID                    ProductionID,
       ppb.StuffID                   MaterialID,
       Null As SlID,
       ppb.Quantity,
       ppb.StandardCost,
       ppb.DeviationShare,
       ppb.Cost,
       pp.CostCenterId,
       pp.CostCalculationPeriodID,
       pp.Quantity ProductionQuantity,
       ccp.FinancialPeriodID
FROM   prm.PeriodProductionBOM    AS ppb
       JOIN stf.VWStuff           AS v
            ON  v.StuffID = ppb.StuffID
       JOIN prm.PeriodProduction  AS pp
            ON  ppb.PeriodProductionID = pp.PeriodProductionID
       join prm.CostCalculationPeriod AS ccp on pp.CostCalculationPeriodID = ccp.CostCalculationPeriodID       
WHERE  v.StuffDetailType = 0

UNION ALL


SELECT 2              AS CostStructureType,
       pp.StuffID                    ProductionID,
       ppb.StuffID                   MaterialID,
       Null                       AS SlID,    
       ppb.Quantity,
       ppb.StandardCost,
       ppb.DeviationShare,
       ppb.Cost,
       pp.CostCenterId,
       pp.CostCalculationPeriodID,
       pp.Quantity ProductionQuantity,
       ccp.FinancialPeriodID
FROM   prm.PeriodProductionBOM    AS ppb
       JOIN stf.VWStuff           AS v
            ON  v.StuffID = ppb.StuffID
       JOIN prm.PeriodProduction  AS pp
            ON  ppb.PeriodProductionID = pp.PeriodProductionID
       join prm.CostCalculationPeriod AS ccp on pp.CostCalculationPeriodID = ccp.CostCalculationPeriodID     
WHERE  v.StuffDetailType = 1
UNION ALL

SELECT 4 CostStructureType,
       pp.StuffID,
       Null,
       ppb.SlID,
       Null,
       ppb.ShareOfCost,
       0,
       ppb.ShareOfCost,
       pp.CostCenterId,
       pp.CostCalculationPeriodID,
       pp.Quantity ProductionQuantity,
       ccp.FinancialPeriodID
FROM   prm.PeriodProductionOtherCost  AS ppb
       JOIN prm.PeriodProduction      AS pp
            ON  ppb.PeriodProductionID = pp.PeriodProductionID
       join prm.CostCalculationPeriod AS ccp on pp.CostCalculationPeriodID = ccp.CostCalculationPeriodID       
       JOIN cte2                      AS vsiccp
            ON  vsiccp.SlID = ppb.SlID
            AND pp.CostCalculationPeriodID = vsiccp.CostCalculationPeriodID
       JOIN cte                       AS vcsp
            ON  vcsp.CostStructureID = vsiccp.CostStructureID
            AND vcsp.[Level] = 1
WHERE  vcsp.ParentStructureType = 4

UNION ALL

SELECT 3 CostStructureType,
       pp.StuffID,
       Null,
       ppb.SlID,
       Null,
       ppb.ShareOfCost,
       0,
       ppb.ShareOfCost,
       pp.CostCenterId,
       pp.CostCalculationPeriodID,
       pp.Quantity ProductionQuantity,
       ccp.FinancialPeriodID
FROM   prm.PeriodProductionOtherCost  AS ppb
       JOIN prm.PeriodProduction      AS pp
            ON  ppb.PeriodProductionID = pp.PeriodProductionID
       JOIN prm.CostCalculationPeriod AS ccp on pp.CostCalculationPeriodID = ccp.CostCalculationPeriodID       
       JOIN cte2                      AS vsiccp
            ON  vsiccp.SlID = ppb.SlID
            AND pp.CostCalculationPeriodID = vsiccp.CostCalculationPeriodID
       JOIN cte                       AS vcsp
            ON  vcsp.CostStructureID = vsiccp.CostStructureID
            AND vcsp.[Level] = 1
WHERE  vcsp.ParentStructureType = 3
             
       
