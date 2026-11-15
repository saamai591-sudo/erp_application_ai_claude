-------------------------------------
CREATE      proc [AST].AstRpt_DlType
(
@DlType int,
@Branches varchar(max) = null,
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
	 
	 SELECT * INTO #vwBranchAccess
	 FROM cfg.vwBranchAccess AS vba

if @SelectedDlTypes is not null or  @SelectedDlTypes <> ''
begin	

	 insert into #FilteredDlTypes
	 select [CFG].[GetStringPartBySpliter](value,1,'#') ,
	        [CFG].[GetStringPartBySpliter](value,2,'#') 
	 from [CFG].[Split] (@SelectedDlTypes,'|')
	 
end

select * 
into #LastAssetSettingTemp
from (
select s.AssetSettingID,s.DeployPlaceID,a.BranchID,
		ROW_NUMBER() over(partition by s.assetid order by s.date desc) rownum

 from ast.AssetSetting s
 join AST.Asset a on s.AssetID = a.AssetID
 ) T
 where T.rownum = 1
	
select asd.AssetSettingID,d.DLID,d.Code,
       case @CultureNo
			when 1 then d.Title
			when 2 then d.Title2
	   end as Title
into #AssetSettingDlTemp
from acc.DL d
join ast.AssetSettingDl asd on d.DLID = asd.DlID
 where asd.DlTypeID = @DlType

 select d.DLID,
		d.Code,
		d.Title
    from #LastAssetSettingTemp ast
 join #AssetSettingDlTemp d on d.AssetSettingID = ast.AssetSettingID
INNER JOIN #vwBranchAccess AS vba ON vba.BranchID = ast.BranchID

 where (@Branches is null or ast.BranchID in (SELECT VALUE FROM   CFG.R_FnCommaStr2Table(@Branches)))
 and (@SelectedDlTypes  is null or ast.AssetSettingID in (	 select distinct AssetSettingID from ast.AssetSettingDl
															 where DlTypeID in (select distinct DlTypeID from #FilteredDlTypes )
															 and DlID in (select distinct DlID from #FilteredDlTypes )))
and (@SelectedDeployPlaces is null or ast.DeployPlaceID in (SELECT VALUE FROM CFG.R_FnCommaStr2Table(@SelectedDeployPlaces)))
group by d.DLID,d.Code,d.Title

