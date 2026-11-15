
CREATE   PROC PRM.spCostReview_Detail
(
@SelectedCostCalculationPeriodIDs		NVARCHAR(MAX),
@SelectedCostCenterIDs					NVARCHAR(MAX),
@SelectedStuffIDs						NVARCHAR(MAX),
@FinancialPeriodID						INT
)
as 


 SELECT f.value CostCenterID into #SelectedCostCenters
FROM CFG.R_FnCommaStr2Table(@SelectedCostCenterIDs) f


 SELECT f.value StuffID into #SelectedStuffs
FROM CFG.R_FnCommaStr2Table(@SelectedStuffIDs) f

 SELECT f.value CostCalculationPeriodID into #SelectedCostCalculationPeriod
FROM CFG.R_FnCommaStr2Table(@SelectedCostCalculationPeriodIDs) f

 SELECT vccs.*,row_number() OVER (PARTITION BY vccs.CostCalculationPeriodID,vccs.CostCenterId,vccs.ProductionID ORDER BY
 vccs.CostCalculationPeriodID,vccs.CostCenterId,vccs.ProductionID
 ) As RNoBasedOnCostCenterAndStuff
 into #vwCostCalculationSource
  FROM prm.vwCostCalculationSource AS vccs
  left join #SelectedCostCenters scc on vccs.CostCenterId = scc.CostCenterId
  left join #SelectedCostCalculationPeriod sccp on vccs.CostCalculationPeriodID = sccp.CostCalculationPeriodID 
    left join #SelectedStuffs ss on vccs.ProductionID = ss.StuffID   
 WHERE (@SelectedCostCenterIDs is NULL or scc.CostCenterID Is NOT NULL)
 and (@SelectedCostCalculationPeriodIDs is NULL or sccp.CostCalculationPeriodID is NOT NULL)
  and (@SelectedStuffIDs is NULL or ss.StuffID is NOT NULL)
 and vccs.FinancialPeriodID = @FinancialPeriodID
 
 SELECT * into #vwStuff
 FROM stf.VWStuff AS v
 
 SELECT * into #vwAccounts
 FROM acc.vwaccounts AS v

 SELECT * into #vwEnums
  FROM cfg.VwEnums AS ve
 WHERE ve.Enum IN ('costStructureType')
 

SELECT vccs.CostStructureType,
       ve.[Value]                      CostType,
       ISNULL(v.code, s.SlCode)        Code,
       ISNULL(v.Title, s.SlTitle)      Title,
       ISNULL(v.Title2,s.SlTitle2) Title2,
       vccs.StandardCost,
       vccs.DeviationShare,
       vccs.Cost
       
FROM   #vwCostCalculationSource  AS vccs
       left JOIN #vwStuff           AS v
            ON  vccs.MaterialID = v.StuffID
       left JOIN #vwAccounts        AS s
            ON  vccs.SlID = s.SlID
       JOIN #vwEnums ve
            ON  vccs.CostStructureType = ve.KeyValue
