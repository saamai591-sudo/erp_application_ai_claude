-------------------------------------
CREATE     PROC [AST].sprptGetAssetsForChangePosition
(
@entityid nvarchar(max)
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
				when 1 then p1.Title+' '+p1.LastName
				when 2 then p1.Title2+' '+p1.LastName2
		   end as Responsible,
		   case @CultureNo 
				when 1 then dp.Title
				when 2 then dp.Title2
		   end as DeployPlaceTitle,
		   las.AssetSettingID,
		   cp.Description
		   
		   
	from AST.Asset a
	join #LastAssetSetting las on a.AssetID = las.AssetID and las.rownum = 1
	left join CFG.Party p on p.PartyID = las.Deliverer
	left join CFG.Party p1 on p1.PartyID = las.Responsible
	left join AST.DeployPlace dp on dp.DeployPlaceID = las.DeployPlaceID
	left join ast.ChangePosition cp on cp.ChangePositionID=las.ChangePositionID
