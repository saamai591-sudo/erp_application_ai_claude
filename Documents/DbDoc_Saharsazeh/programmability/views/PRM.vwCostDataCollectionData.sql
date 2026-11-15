
CREATE   VIEW PRM.vwCostDataCollectionData
as 
SELECT cdcs.CostCalculationPeriodID,
       cdcs.CostStructureID,
       cdcas.CostDataCollectionAccountSettingID,
       cdcas.CostDataCollectionSettingID,
       cdcas.CostBehaviour,
       cdcas.SlID,
       cdcas.CostDriverID,
       ccp.Title,
       ccp.StartDate,
       ccp.EndDate
FROM   prm.CostDataCollectionAccountSetting AS cdcas
       JOIN prm.CostDataCollectionSetting AS cdcs
            ON  cdcs.CostDataCollectionSettingID = cdcas.CostDataCollectionSettingID
       JOIN prm.CostCalculationPeriod AS ccp
            ON  ccp.CostCalculationPeriodID = cdcs.CostCalculationPeriodID    

