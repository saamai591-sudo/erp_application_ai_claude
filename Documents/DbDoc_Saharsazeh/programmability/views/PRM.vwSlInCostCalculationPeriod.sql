
CREATE   VIEW PRM.vwSlInCostCalculationPeriod
as
WITH cte as (
         SELECT *
         FROM   prm.vwCostDataCollectionData AS vcdcd
     ),
     cte2 as (
         SELECT ROW_NUMBER() OVER(
                    PARTITION BY c.CostStructureID,
                    c.SlID,
                    ccp.CostCalculationPeriodID ORDER BY c.StartDate
                ) rno,
                c.CostStructureID,
                c.CostDataCollectionAccountSettingID,
                c.CostDataCollectionSettingID,
                c.CostBehaviour,
                c.SlID,
                c.CostDriverID,
                c.Title,
                ccp.StartDate,
                ccp.EndDate,
                ccp.CostCalculationPeriodID
         FROM   prm.CostCalculationPeriod AS ccp
                JOIN cte c
                     ON  ccp.StartDate >= c.StartDate
     )

SELECT *
FROM   cte2
WHERE  rno = 1

