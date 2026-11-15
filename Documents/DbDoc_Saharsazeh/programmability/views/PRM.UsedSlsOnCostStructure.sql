
 CREATE   VIEW [PRM].[UsedSlsOnCostStructure]
 AS

SELECT csa.CostStructureID,csai.SlID
FROM   prm.CostStructureAccount   AS csa
       JOIN prm.CostCalculationPeriod  AS ccp
            ON  ccp.CostCalculationPeriodID = csa.CostCalculationPeriodID
       JOIN (
                SELECT MAX(ccp.EndDate) AS [EndDate],
                       csa.CostStructureID
                FROM   prm.CostStructureAccount AS csa
                       JOIN prm.CostCalculationPeriod AS ccp
                            ON  ccp.CostCalculationPeriodID = csa.CostCalculationPeriodID
                GROUP BY
                       csa.CostStructureID
            ) a
            ON  csa.CostStructureID = a.CostStructureID
            AND ccp.EndDate = a.EndDate
       JOIN prm.CostStructureAccountItem AS csai ON csai.CostStructureAccountID = csa.CostStructureAccountID
