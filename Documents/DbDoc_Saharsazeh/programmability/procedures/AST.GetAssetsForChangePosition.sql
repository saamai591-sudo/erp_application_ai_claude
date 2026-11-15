
CREATE   PROC [AST].GetAssetsForChangePosition
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

	select a.*,
		   case @CultureNo 
				when 1 then dl.Title
				when 2 then dl.Title2
		   end as CostCenter,		
		   ROW_NUMBER() over (partition by AssetID order by date desc) rownum
	into #LastAssetSetting
	from ast.AssetSetting a
	left join ast.AssetSettingDl b on a.AssetSettingID = b.AssetSettingID and b.DlTypeID = 27
	left join acc.dl on dl.DLID = b.DlID

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
		   ast.DeployPlaceFullTitle(las.DeployPlaceID) DeployPlaceTitle, 
		   las.AssetSettingID,
		   CostCenter

	from AST.Asset a
	join #LastAssetSetting las on a.AssetID = las.AssetID and las.rownum = 1
	left join CFG.Party p on p.PartyID = las.Deliverer
	left join CFG.Party p1 on p1.PartyID = las.Responsible
	where a.BranchID = @BranchID and a.[Status] = 1 and a.AccountingStatus = 2 and a.HeadAssetID is null and las.Date < @Date


