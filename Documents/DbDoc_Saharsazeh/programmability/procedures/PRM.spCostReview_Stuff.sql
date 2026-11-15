
CREATE   PROC PRM.spCostReview_Stuff
(
@SelectedCostCalculationPeriodIDs		NVARCHAR(MAX),
@SelectedCostCenterIDs					NVARCHAR(MAX),
@FinancialPeriodID						INT
)
as 


 SELECT f.value CostCenterID into #SelectedCostCenters
FROM CFG.R_FnCommaStr2Table(@SelectedCostCenterIDs) f


 SELECT f.value CostCalculationPeriodID into #SelectedCostCalculationPeriod
FROM CFG.R_FnCommaStr2Table(@SelectedCostCalculationPeriodIDs) f

 SELECT vccs.*,row_number() OVER (PARTITION BY vccs.CostCalculationPeriodID,vccs.CostCenterId,vccs.ProductionID ORDER BY
 vccs.CostCalculationPeriodID,vccs.CostCenterId,vccs.ProductionID
 ) As RNoBasedOnCostCenterAndStuff
 into #vwCostCalculationSource
  FROM prm.vwCostCalculationSource AS vccs
  left join #SelectedCostCenters scc on vccs.CostCenterId = scc.CostCenterId
  left join #SelectedCostCalculationPeriod sccp on vccs.CostCalculationPeriodID = sccp.CostCalculationPeriodID  
 WHERE (@SelectedCostCenterIDs is NULL or scc.CostCenterID Is NOT NULL)
 and (@SelectedCostCalculationPeriodIDs is NULL or sccp.CostCalculationPeriodID is NOT NULL)
 and vccs.FinancialPeriodID = @FinancialPeriodID
 
 SELECT * into #vwStuff
 FROM stf.VWStuff AS v

SELECT v.StuffID,
	   v.code,
       v.Title,
       v.Title2,
       v.MainMeasureUnit,
       v.MainMeasureUnit2,
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
           SELECT vccs.ProductionID,
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
                  vccs.ProductionID
       ) src
       JOIN #VWStuff AS v
            ON  src.ProductionID = v.StuffID
