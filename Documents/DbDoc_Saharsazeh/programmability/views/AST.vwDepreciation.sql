CREATE   VIEW ast.vwDepreciation
as 
SELECT d.AssetID,d.[Value] FROM ast.Depreciation AS d
UNION ALL
SELECT a.AssetID,a.AccumulatedDepreciation FROM ast.Asset AS a
UNION ALL
SELECT a.AssetID,a.AccumulatedDepreciation FROM ast.Asset AS a
