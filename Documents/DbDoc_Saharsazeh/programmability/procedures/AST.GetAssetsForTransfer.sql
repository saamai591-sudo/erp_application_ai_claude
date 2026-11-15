-------------------------------------
CREATE    PROC [AST].[GetAssetsForTransfer]
(
@BranchID int
)
--WITH ENCRYPTION
AS
	
	declare @Culture NVARCHAR(100),
			@CultureNo tinyint
	    
	SET @Culture = cfg.GetuserCulture()	

	select @CultureNo = CultureNo
	from CFG.CultureInfo 
	where Culture = @Culture

	select *,ROW_NUMBER() over (partition by AssetID order by date desc) rownum
	into #LastAssetSetting
	from ast.AssetSetting

	select a.AssetID,
		   a.Plaque,
		   case @CultureNo 
				when 1 then a.Title
				when 2 then a.Title2
		   end as Title,		
		   a.[Status],
		   case @CultureNo 
				when 1 then p.Title+' '+p.LastName
				when 2 then p.Title2+' '+p.LastName2
		   end as DelivererTitle,
		   case @CultureNo 
				when 1 then dp.Title
				when 2 then dp.Title2
		   end as DeployPlaceTitle

	from AST.Asset a
	join #LastAssetSetting las on a.AssetID = las.AssetID and las.rownum = 1
	left join CFG.Party p on p.PartyID = las.Deliverer
	left join AST.DeployPlace dp on dp.DeployPlaceID = las.DeployPlaceID
	where a.BranchID = @BranchID and a.[Status] = 1

