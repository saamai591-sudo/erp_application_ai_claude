CREATE   FUNCTION [AST].fnAssetStatusAtDate
(
	@Date DATE,
	@AssetIDs VARCHAR(MAX) = NULL	-- comma separated AssetIDs, NULL = all assets
)
RETURNS TABLE
AS
-- Status of the assets at @Date, calculated from the operation documents instead of ast.Asset.Status
-- OperationType: 2 destruction, 3 salvage, 4 sale, 5 transfer (the same numbers as @Subject of ast.GetDepreciationInfo)
-- IsActive = 1 : no operation document dated on or before @Date
-- OperationType / OperationDate : the last operation dated on or before @Date
-- NextOperationDate : the first operation dated after @Date
RETURN
(
	WITH Op AS
	(
		SELECT i.AssetID, 2 AS OperationType, h.[Date] AS OperationDate
		FROM ast.DestructionItem i
		JOIN ast.Destruction h ON h.DestructionID = i.DestructionID

		UNION ALL

		SELECT i.AssetID, 3, h.[Date]
		FROM ast.SalvageItem i
		JOIN ast.Salvage h ON h.SalvageID = i.SalvageID

		UNION ALL

		SELECT i.AssetID, 4, h.[Date]
		FROM ast.SaleItem i
		JOIN ast.Sale h ON h.SaleID = i.SaleID

		UNION ALL

		SELECT i.AssetID, 5, h.[Date]
		FROM ast.TransferItem i
		JOIN ast.[Transfer] h ON h.TransferID = i.TransferID
	)
	SELECT a.AssetID,
		   CASE WHEN o.OperationDate IS NULL THEN CAST(1 AS BIT) ELSE CAST(0 AS BIT) END AS IsActive,
		   o.OperationType,
		   o.OperationDate,
		   n.NextOperationDate
	FROM ast.Asset a
	OUTER APPLY
	(
		SELECT TOP 1 x.OperationType, x.OperationDate
		FROM Op x
		WHERE x.AssetID = a.AssetID
			  AND x.OperationDate <= @Date
		ORDER BY x.OperationDate DESC
	) o
	OUTER APPLY
	(
		SELECT MIN(x.OperationDate) AS NextOperationDate
		FROM Op x
		WHERE x.AssetID = a.AssetID
			  AND x.OperationDate > @Date
	) n
	WHERE @AssetIDs IS NULL
		  OR a.AssetID IN (SELECT [value] FROM CFG.R_FnCommaStr2Table(@AssetIDs))
)