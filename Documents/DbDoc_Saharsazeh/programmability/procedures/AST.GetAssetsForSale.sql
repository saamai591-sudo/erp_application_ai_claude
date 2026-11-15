------------------------------------- 
CREATE     PROC [AST].[GetAssetsForSale]
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

	select s.AssetID,s.Deliverer,s.DeployPlaceID,a.BranchID,s.Date,
			ROW_NUMBER() over (partition by s.assetid order by s.date desc) rownum
	into #LastAssetSetting
	from ast.AssetSetting s
	join AST.Asset a on s.AssetID = a.AssetID


	SELECT 
		a.AssetID,
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
		end as DeployPlaceTitle,
		cp.OldPlauqe
	FROM AST.Asset a
	join #LastAssetSetting las on a.AssetID = las.AssetID and las.rownum = 1
	left join cfg.Party p on p.PartyID = las.Deliverer
	left join ast.DeployPlace dp on dp.DeployPlaceID = las.DeployPlaceID
	left join (
	select ROW_NUMBER() over(partition by assetid order by date desc) Rno,assetid,OldPlauqe
	from ast.ChangePlauqe
				)CP on CP.Rno = 1 and cp.AssetID = a.AssetID
	where (a.[Status] = 1 or a.[Status] = 2 or a.[Status] = 4)
	and las.BranchID = @BranchID and las.[Date] <= @Date

