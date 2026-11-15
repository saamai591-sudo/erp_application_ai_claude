------------------------------------- 
CREATE    PROC [AST].[GetAssetsForAdjustment]
(
	@BranchID int,
	@Date date
)
--WITH ENCRYPTION
AS
	DECLARE @Culture NVARCHAR(100),
			@CultureNo TINYINT
	    
	SET @Culture = cfg.GetuserCulture()	

	SELECT @CultureNo = CultureNo
	FROM CFG.CultureInfo 
	WHERE Culture = @Culture

	SELECT T.AssetID,T.BranchID,T.[Date]
	INTO #LastAssetSetting
    FROM (
			SELECT s.AssetID,a.BranchID,s.Date,
			       ROW_NUMBER() OVER ( PARTITION BY s.AssetID ORDER BY s.Date DESC ) rownum
            FROM AST.AssetSetting s
			JOIN AST.Asset a ON s.AssetID = a.AssetID
	     )T
	WHERE T.rownum=1

    SELECT a.AssetID,
           a.Plaque,
		   CASE @CultureNo 
				WHEN 1 THEN A.Title
				WHEN 2 THEN A.Title2
		   END AS Title,
		   las.BranchID
    FROM AST.Asset a
    JOIN #LastAssetSetting las ON a.AssetID = las.AssetID
    WHERE a.[Status] = 1 AND las.BranchID = @BranchID AND las.[Date] <= @Date
