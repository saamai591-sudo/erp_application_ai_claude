------------------------------------- 
CREATE    PROC [AST].[GetAssetsForInsurance]
(
	@BranchID int,
	@Date date
)
--WITH ENCRYPTION
AS
	declare @Culture NVARCHAR(100),
			@CultureNo tinyint
	    
	SET @Culture = cfg.GetuserCulture()	

	select @CultureNo = CultureNo
	from CFG.CultureInfo 
	where Culture = @Culture

	SELECT T.AssetID,T.BranchID,T.[Date]
	INTO #LastAssetSetting
    FROM (
			SELECT s.AssetID,a.BranchID,s.Date,
			       ROW_NUMBER() OVER ( PARTITION BY s.AssetID ORDER BY s.Date DESC ) rownum
            FROM AST.AssetSetting s
			join AST.Asset a on s.AssetID = a.AssetID
	     )T
	WHERE T.rownum=1


    SELECT a.AssetID,
           a.Plaque,
		   case @CultureNo 
				when 1 then a.Title
				when 2 then a.Title2
		   end as Title,
           a.BaseValue,
           a.AccumulatedDepreciation,
           a.SalvageValue

    FROM AST.Asset a
    JOIN #LastAssetSetting las ON a.AssetID = las.AssetID
    WHERE a.[Status] = 1 and las.BranchID = @BranchID and las.[Date] <= @Date
