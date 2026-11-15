CREATE   VIEW STC.vwPricingStage
AS
WITH cte AS (
    SELECT  *, 
            ROW_NUMBER() OVER (ORDER BY [Time]) AS rn
    FROM    STC.PricingStage
)
SELECT  mc.*,
        DATEDIFF(second , mp.[Time], mc.[Time]) Diff
FROM cte mc
LEFT JOIN cte mp
ON mc.rn = mp.rn + 1
