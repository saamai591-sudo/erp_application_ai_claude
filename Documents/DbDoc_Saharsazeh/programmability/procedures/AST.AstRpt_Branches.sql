------------------------------------- 
CREATE   proc [AST].AstRpt_Branches
(
@SelectedDlTypes varchar(max) = null,
@SelectedDeployPlaces varchar(max) = null
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

  IF OBJECT_ID('tempdb..#FilteredDlTypes') IS Not NULL
	 DROP TABLE #FilteredDlTypes

	 create table #FilteredDlTypes
	 (
	 DlTypeID int,
	 DlID int
	 )

if @SelectedDlTypes is not null or  @SelectedDlTypes <> ''
begin	

	 insert into #FilteredDlTypes
	 select [CFG].[GetStringPartBySpliter](value,1,'#') ,
	        [CFG].[GetStringPartBySpliter](value,2,'#') 
	 from [CFG].[Split] (@SelectedDlTypes,'|')
	 
end

SELECT * INTO #vwBranchAccess
FROM cfg.vwBranchAccess AS vba


select * 
into #LastAssetSettingTemp
from (
select s.AssetSettingID,s.DeployPlaceID,a.BranchID,
		ROW_NUMBER() over(partition by s.assetid order by s.date desc) rownum

 from ast.AssetSetting s
 join AST.Asset a on s.AssetID = a.AssetID
 ) T
 where T.rownum = 1
	
	

 select b.BranchID,
		b.Code,
		case @CultureNo
			when 1 then b.Title
			when 2 then b.Title2
		end as Title	
    from #LastAssetSettingTemp ast
 join cfg.branch b on b.BranchID = ast.BranchID
JOIN #vwBranchAccess AS vba ON vba.BranchID = b.BranchID

 where  (@SelectedDlTypes  is null or ast.AssetSettingID in (	 select distinct AssetSettingID from ast.AssetSettingDl
															 where DlTypeID in (select distinct DlTypeID from #FilteredDlTypes )
															 and DlID in (select distinct DlID from #FilteredDlTypes )))
and (@SelectedDeployPlaces is null or ast.DeployPlaceID in (SELECT VALUE FROM CFG.R_FnCommaStr2Table(@SelectedDeployPlaces)))
group by b.BranchID,b.Code,b.Title,b.Title2

  IF OBJECT_ID('tempdb..#FilteredDlTypes') IS Not NULL
	 DROP TABLE #FilteredDlTypes

