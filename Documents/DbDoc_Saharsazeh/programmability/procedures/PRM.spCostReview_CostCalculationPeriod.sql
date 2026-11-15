       
CREATE   PROC PRM.spCostReview_CostCalculationPeriod
(
@SelectedStuffIDs						NVARCHAR(MAX),
@SelectedCostCenterIDs					NVARCHAR(MAX),
@FinancialPeriodID						INT
)
as 


 SELECT f.value CostCenterID into #SelectedCostCenters
FROM CFG.R_FnCommaStr2Table(@SelectedCostCenterIDs) f


 SELECT f.value StuffID into #SelectedStuffs
FROM CFG.R_FnCommaStr2Table(@SelectedStuffIDs) f

 SELECT vccs.*,row_number() OVER (PARTITION BY vccs.CostCalculationPeriodID,vccs.CostCenterId,vccs.ProductionID ORDER BY
 vccs.CostCalculationPeriodID,vccs.CostCenterId,vccs.ProductionID
 ) As RNoBasedOnCostCenterAndStuff
 into #vwCostCalculationSource
  FROM prm.vwCostCalculationSource AS vccs
  left join #SelectedCostCenters scc on vccs.CostCenterId = scc.CostCenterId
  left join #SelectedStuffs sccp on vccs.ProductionID = sccp.StuffID  
 WHERE (@SelectedCostCenterIDs is NULL or scc.CostCenterID Is NOT NULL)
 and (@SelectedStuffIDs is NULL or sccp.StuffID is NOT NULL)
 and vccs.FinancialPeriodID = @FinancialPeriodID


SELECT ccp.CostCalculationPeriodID,
       ccp.Title,
       ccp.Title2,
       src.ProductionQuantity,
       src.MaterialStandardCost,
       src.MaterialDeviation,
       src.MaterialCost,
       src.SemiProductStandardCost,
       src.SemiProductDeviation,
       src.SemiProductCost,
       src.PayrollCost,
       src.OverheadCost,
       src.Cost
FROM   (
           SELECT vccs.CostCalculationPeriodID,
           SUM(CASE WHEN vccs.RNoBasedOnCostCenterAndStuff = 1 then ProductionQuantity else 0 END) ProductionQuantity,
                  SUM(
                      CASE 
                           WHEN vccs.CostStructureType = 1 THEN vccs.StandardCost
                           ELSE 0
                      END
                  )             MaterialStandardCost,
                  SUM(
                      CASE 
                           WHEN vccs.CostStructureType = 1 THEN vccs.DeviationShare
                           ELSE 0
                      END
                  )             MaterialDeviation,
                  SUM(
                      CASE 
                           WHEN vccs.CostStructureType = 1 THEN vccs.Cost
                           ELSE 0
                      END
                  )             MaterialCost,
                  SUM(
                      CASE 
                           WHEN vccs.CostStructureType = 2 THEN vccs.StandardCost
                           ELSE 0
                      END
                  )             SemiProductStandardCost,
                  SUM(
                      CASE 
                           WHEN vccs.CostStructureType = 2 THEN vccs.DeviationShare
                           ELSE 0
                      END
                  )             SemiProductDeviation,
                  SUM(
                      CASE 
                           WHEN vccs.CostStructureType = 2 THEN vccs.Cost
                           ELSE 0
                      END
                  )             SemiProductCost,
                  SUM(
                      CASE 
                           WHEN vccs.CostStructureType = 3 THEN vccs.Cost
                           ELSE 0
                      END
                  )             PayrollCost,
                  SUM(
                      CASE 
                           WHEN vccs.CostStructureType = 4 THEN vccs.Cost
                           ELSE 0
                      END
                  )             OverheadCost,
                  SUM(Cost)     Cost
           FROM   #vwCostCalculationSource AS vccs
           GROUP BY
                  vccs.CostCalculationPeriodID
       ) src
       JOIN prm.CostCalculationPeriod AS ccp 
            ON  src.CostCalculationPeriodID = ccp.CostCalculationPeriodID
