
CREATE   PROC PRM.spCostReview_CostCenter
(
@SelectedStuffIDs						NVARCHAR(MAX),
@SelectedCostCalculationPeriodIDs					NVARCHAR(MAX),
@FinancialPeriodID						INT
)
as 


 SELECT f.value CostCalculationPeriodID into #SelectedCostCalculationPeriods
FROM CFG.R_FnCommaStr2Table(@SelectedCostCalculationPeriodIDs) f


 SELECT f.value StuffID into #SelectedStuffs
FROM CFG.R_FnCommaStr2Table(@SelectedStuffIDs) f

 SELECT vccs.*,row_number() OVER (PARTITION BY vccs.CostCalculationPeriodID,vccs.CostCenterId,vccs.ProductionID ORDER BY
 vccs.CostCalculationPeriodID,vccs.CostCenterId,vccs.ProductionID
 ) As RNoBasedOnCostCenterAndStuff
 into #vwCostCalculationSource
  FROM prm.vwCostCalculationSource AS vccs
  left join #SelectedCostCalculationPeriods scc on vccs.CostCalculationPeriodID = scc.CostCalculationPeriodID
  left join #SelectedStuffs sccp on vccs.ProductionID = sccp.StuffID  
 WHERE (@SelectedCostCalculationPeriodIDs is NULL or scc.CostCalculationPeriodID Is NOT NULL)
 and (@SelectedStuffIDs is NULL or sccp.StuffID is NOT NULL)
 and vccs.FinancialPeriodID = @FinancialPeriodID


SELECT cc.CostCenterID,
		d.Code,
       cc.Title,
       cc.Title2,
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
           SELECT vccs.CostCenterID,
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
                  vccs.CostCenterID
       ) src
       JOIN cfg.CostCenter AS cc on cc.CostCenterID = src.CostCenterID
       join acc.DL AS d on d.DLID = cc.DlID
