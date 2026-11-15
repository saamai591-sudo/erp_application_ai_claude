	
CREATE   VIEW PRM.vwCostStructureParents
as
WITH cte as 
     (
         SELECT cs.CostStructureID,
                1                   AS Layer,
                cs.CostStructureID  AS ParentID
         FROM   prm.CostStructure   AS cs
         --WHERE cs.ParentID is NULL
         UNION ALL
         SELECT cs.CostStructureID,
                c.Layer + 1             AS Layer,
                c.ParentID
         FROM   cte                     AS c
                JOIN prm.CostStructure  AS cs
                     ON  c.CostStructureID = cs.ParentID
     )

           SELECT ROW_NUMBER() OVER(PARTITION BY cs.CostStructureID ORDER BY layer desc) [Level],
                  c.CostStructureID,c.Layer,c.ParentID,
                  cs.Code,
                  cs.Title,
                  cs.Title2,
                  cs.[Type],
                  cs2.Title ParentStructureTitle,
                  cs2.[Type] ParentStructureType
           FROM   cte c
                  JOIN prm.CostStructure AS cs
                       ON  c.CoststructureID = cs.CostStructureID
                  join  prm.CostStructure AS cs2 on c.ParentID = cs2.CostStructureID     

