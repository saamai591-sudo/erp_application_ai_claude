-------------------------------------
CREATE     proc [AST].AstRpt_DeployPlaces
(
@Branches varchar(max) = null,
@SelectedDlTypes varchar(max) = null,
@SelectedAssets varchar(max) = null
)
--WITH ENCRYPTION 
as

declare @UserID int,
        @Culture NVARCHAR(5),
		@CultureNo tinyint
	   
	set @UserID = cfg.GetuserID() 
	SET @Culture = cfg.GetuserCulture()	

	select @CultureNo = CultureNo
	from CFG.CultureInfo 
	where Culture = @Culture
	
	
SELECT * INTO #vwBranchAccess
FROM cfg.vwBranchAccess


IF OBJECT_ID('tempdb..#FilteredDlTypes') IS Not NULL
	DROP TABLE #FilteredDlTypes

create table #FilteredDlTypes
(
	DlTypeID int,
	DlID int
)

if @SelectedDlTypes is not null and @SelectedDlTypes <> ''
begin	

	 insert into #FilteredDlTypes
	 select [CFG].[GetStringPartBySpliter](value,1,'#'),
	        [CFG].[GetStringPartBySpliter](value,2,'#') 
	 from [CFG].[Split] (@SelectedDlTypes,'|')
	 
end

select * 
into #LastAssetSettingTemp
from (
select s.AssetSettingID,s.AssetID,s.DeployPlaceID,a.BranchID,
       ROW_NUMBER() over(partition by s.AssetID order by s.Date desc) rownum
from ast.AssetSetting s
join AST.Asset a on s.AssetID = a.AssetID
) T
where T.rownum = 1

select d.DeployPlaceID,[AST].[DeployPlaceFullCode](d.DeployPlaceID) Code,
       [AST].[DeployPlaceFullTitle](d.DeployPlaceID)  Title
from #LastAssetSettingTemp ast
left join ast.DeployPlace d on ast.DeployPlaceID = d.DeployPlaceID
INNER JOIN #vwBranchAccess AS vba ON vba.BranchID = ast.BranchID
where (@Branches is null or ast.BranchID in (SELECT VALUE FROM CFG.R_FnCommaStr2Table(@Branches)))
 and (@SelectedDlTypes is null or ast.AssetSettingID in (select distinct AssetSettingID from ast.AssetSettingDl
		                                                 where DlTypeID in (select distinct DlTypeID from #FilteredDlTypes)
		                                                 and DlID in (select distinct DlID from #FilteredDlTypes)))
 and (@SelectedAssets is null or ast.AssetID in (SELECT VALUE FROM CFG.R_FnCommaStr2Table(@SelectedAssets)))
 and d.DeployPlaceID is not null
 group by d.DeployPlaceID,d.Title,d.Title2

IF OBJECT_ID('tempdb..#FilteredDlTypes') IS Not NULL
	DROP TABLE #FilteredDlTypes

