------------------------------------- 
CREATE    PROC [AST].[GetAssetsForSalvage]
(
	@BranchID int = NULL,
	@Date date = NULL
)
--WITH ENCRYPTION
AS
	declare @Culture NVARCHAR(100),
			@CultureNo tinyint
	    
	SET @Culture = cfg.GetuserCulture()	

	select @CultureNo = CultureNo
	from CFG.CultureInfo 
	where Culture = @Culture

	SELECT T.AssetID,T.Deliverer,T.DeployPlaceID,T.BranchID,T.[Date]
	INTO #LastAssetSetting
    FROM (
			SELECT s.AssetID,s.Deliverer,s.DeployPlaceID,a.BranchID,s.[Date],
			       ROW_NUMBER() OVER ( PARTITION BY s.AssetID ORDER BY s.Date DESC ) rownum
            FROM AST.AssetSetting s
			join AST.Asset a on s.AssetID = a.AssetID
	     )T
	WHERE T.rownum=1

	select p.PartyID,
	       CASE WHEN p.[Type] = 1 OR p.[Type] = 2 THEN p.Title
                 WHEN p.[Type] = 0 THEN p.Title + ' ' + p.LastName
            END Title,
			 CASE WHEN p.[Type] = 1 OR p.[Type] = 2 THEN p.Title2
                 WHEN p.[Type] = 0 THEN p.Title2 + ' ' + p.LastName2
            END Title2
	into #Parties
	from CFG.Party p

    SELECT  a.AssetID,
            a.Plaque,
			case @CultureNo 
				when 1 then a.Title
				when 2 then a.Title2
			end as Title,			            
			case @CultureNo 
				when 1 then p.Title
				when 2 then p.Title2
			end as DelivererTitle,
			case @CultureNo 
				when 1 then dp.Title
				when 2 then dp.Title2
			end as DeployPlaceTitle

    FROM AST.Asset a
    JOIN #LastAssetSetting las ON a.AssetID = las.AssetID
    LEFT JOIN #Parties p ON las.Deliverer = p.PartyID
    LEFT JOIN AST.DeployPlace dp ON las.DeployPlaceID = dp.DeployPlaceID

    WHERE a.[Status] = 1 and 
          (@BranchID IS NULL OR las.BranchID = @BranchID) and
          (@Date IS NULL OR las.[Date] <= @Date)


