
CREATE   VIEW [AST].VWAssetDepreciation
AS

WITH cte AS (
    SELECT * FROM ast.vwAssetCategoryHistory
),

-- All depreciation "sources" per asset: depreciation at creation + ordinary depreciation.
-- Used to calculate the accumulated depreciation transferred when an asset's category changes.
src AS (
    SELECT a.AssetID,
           a.AssetCreationDate AS [Date],
           ISNULL(a.AccumulatedDepreciation, 0) + ISNULL(a.DuringDepreciation, 0) AS [Value]
    FROM   ast.Asset a
    WHERE  ISNULL(a.AccumulatedDepreciation, 0) + ISNULL(a.DuringDepreciation, 0) <> 0

    UNION ALL

    SELECT d.AssetID,
           d.[Date],
           d.[Value]
    FROM   ast.Depreciation d
)

-- 1) Depreciation carried in at creation / establishment
SELECT a.AssetID,
       a.AssetCategoryID,
       'ar' + CAST(a.AssetReceiptID AS NVARCHAR(250)) + '-' + CAST(a.AssetCategoryID AS NVARCHAR(250)) + '-' + CAST(a.AssetID AS NVARCHAR(250)) AS AssetFullID,
       a.AssetCreationDate AS [Date],
       ISNULL(a.AccumulatedDepreciation, 0) + ISNULL(a.DuringDepreciation, 0) AS [Value],
       'Establishment' AS ValueType
FROM   ast.Asset a
WHERE  ISNULL(a.AccumulatedDepreciation, 0) + ISNULL(a.DuringDepreciation, 0) > 0

UNION ALL

-- 2) Ordinary depreciation, assigned to the category that was valid on the depreciation date
SELECT d.AssetID,
       vach.AssetCategoryID,
       vach.AssetFullID,
       d.[Date],
       d.[Value],
       'Ordinary' AS ValueType
FROM   ast.Depreciation d
       JOIN cte vach
            ON  vach.AssetID = d.AssetID
            AND d.[Date] BETWEEN vach.FromDate AND vach.ToDate

UNION ALL

-- 3) Category change: accumulated depreciation so far is ADDED to the NEW category
SELECT vach.AssetID,
       vach.AssetCategoryID,
       vach.AssetFullID,
       vach.FromDate AS [Date],
       SUM(s.[Value]) AS [Value],
       'ChangedCategory' AS ValueType
FROM   cte vach
       JOIN src s
            ON  s.AssetID = vach.AssetID
            AND s.[Date] < vach.FromDate
WHERE  vach.[TYPE] = 'ChangedCategory'
GROUP BY
       vach.AssetID,
       vach.AssetCategoryID,
       vach.AssetFullID,
       vach.FromDate
HAVING SUM(s.[Value]) <> 0

UNION ALL

-- 4) Category change: the same amount is REMOVED from the PREVIOUS category
SELECT vach.AssetID,
       vach2.AssetCategoryID,
       vach2.AssetFullID,
       vach.FromDate AS [Date],
       -SUM(s.[Value]) AS [Value],
       'ChangedCategory' AS ValueType
FROM   cte vach
       JOIN cte vach2
            ON  vach2.AssetID = vach.AssetID
            AND DATEADD(DAY, 1, vach2.ToDate) = vach.FromDate
       JOIN src s
            ON  s.AssetID = vach.AssetID
            AND s.[Date] < vach.FromDate
WHERE  vach.[TYPE] = 'ChangedCategory'
GROUP BY
       vach.AssetID,
       vach2.AssetCategoryID,
       vach2.AssetFullID,
       vach.FromDate
HAVING SUM(s.[Value]) <> 0

