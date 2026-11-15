
-- #65329 Return raw UtilizationDate for chronological sort; keep formatted Date_UtilizationDate for display.

CREATE   PROC [AST].AstRpt_Asset
(
@FromDate date,
@EndDate Date,
@SelectedCategories varchar(max) = null,
@SelectedDlTypes varchar(max) = null,
@SelectedBranchs varchar(max) = null,
@SelectedDeployPlaces varchar(max) = null
)
--WITH ENCRYPTION
AS

DECLARE @tableName NVARCHAR(20),
        @query NVARCHAR(MAX),
		@UsedDlType NVARCHAR(MAX),
		@SelectDlType NVARCHAR(MAX),
		@UserID int,
        @Culture VARCHAR(25),
        @CultureNo TINYINT,
		@DateType TINYINT,
        @DateFormat VARCHAR(10)

SET @tableName = CFG.getTempTableName(1);
SET @Culture = CFG.GetuserCulture();
set @UserID = cfg.GetuserID()

SELECT @CultureNo = CultureNo
FROM CFG.CultureInfo
WHERE Culture = @Culture;



	select @UsedDlType = STUFF((SELECT  ',' +  QUOTENAME(DlTypeID )
									from acc.UsedDlType
									where SaturnModuleID = 14
									group by DlTypeID
									FOR XML PATH(''), TYPE
								   ).value('.', 'NVARCHAR(MAX)'),1,1,'')
	if @UsedDlType is null
	set @UsedDlType = '[-1]'

	select @SelectDlType = STUFF((SELECT  ',piv.' +  QUOTENAME(DlTypeID ) +' AS T'+cast(DlTypeID as varchar(25))
									from acc.UsedDlType
									where SaturnModuleID = 14
									group by DlTypeID
									FOR XML PATH(''), TYPE
								   ).value('.', 'NVARCHAR(MAX)'),1,0,'')
	if @SelectDlType is null
	set @SelectDlType = ''

	SELECT  @DateType = us.SettingValue
        FROM    CFG.UserSetting us
        WHERE   us.SettingKey = 'Date_Type'
                AND us.UserID = @UserID

        IF @DateType IS NULL
            SET @DateType = CASE @Culture
                              WHEN 'fa' THEN 0
                              WHEN 'en' THEN 1
                              WHEN 'ar' THEN 2
                            END

        SELECT  @DateFormat = us.SettingValue
        FROM    CFG.UserSetting us
        WHERE   us.SettingKey = 'Date_Format'
                AND us.UserID = @UserID

        IF @DateFormat IS NULL
            SET @DateFormat = 'YY/MM/DD'

exec AST.AstRptAsseGroupReviewDataSource
				@FromDate = @FromDate,
				@EndDate = @EndDate,
				@tableName = @tableName,
				@SelectedCategories = @SelectedCategories,
				@SelectedDlTypes = @SelectedDlTypes,
				@SelectedAssets = null,
				@SelectedBranchs = @SelectedBranchs,
				@SelectedDeployPlaces = @SelectedDeployPlaces,
				@Level = 0
SET @query= N'select a.AssetID,
					 b.Plaque  ,
					 case when @CultureNo = 1 then b.Title else b.Title2 end as Title,
					 b.UtilizationDate,
					 CFG.GetCLRSaturnDate(b.UtilizationDate, @DateFormat, 0, @DateType) Date_UtilizationDate,
					 b.AssetCategoryID,
					 a.BaseValue ,
					 a.Created ,
					 a.SumAdd SumAdded,
					 a.Minus ,
					 a.BetweenBranch,
					 a.AccumulatedDepreciation ,
					 a.Depreciation ,
					 a.MinusDep,
					 a.BetweenBranchDep ,
					 a.SumMinus ,
					 a.Net,
					 case b.DepreciationMethod when 1 then ''نزولی''
										       when 2 then ''مستقیم''
										       when 3 then ''بدون استهلاک'' end DepreciationMethod,
					 b.DepreciationRate,
					 case b.Status when 1 then ''در جریان''
								  when 2 then ''خارج شده''
								  when 3 then ''فروش رفته''
								  when 4 then ''اسقاط شده''
								  when 5 then ''احیاء شده''
								  when 6 then ''اهداء شده''
								  when 7 then ''منتقل شده'' end Status	,
					 case when @CultureNo = 1 then branch.Title else branch.Title2 end as BranchTitle,
					 case when @CultureNo = 1 then ac1.Title else ac1.Title2 end as RootCategory
					 '+@SelectDlType+'
	  from '+@tableName+' a
	  join ast.Asset b on b.AssetID = a.AssetID
	  join ast.AssetCategory ac on b.AssetCategoryID = ac.AssetCategoryID
	  join ast.AssetCategory ac1 on a.RootAssetCategoryID = ac1.AssetCategoryID
	  left join
	  (
	  select AssetSettingID,a.DlTypeID,case when @CultureNo = 1 then b.Title else b.Title2 end Value
	  from ast.AssetSettingDl a
	  join acc.dl b on a.dlid = b.dlid
	  )X
	  pivot
	  (
	  max(value)
	  for DlTypeID in ('+@UsedDlType+')
	  )piv on piv.AssetSettingID = a.AssetSettingID
	  join cfg.branch on branch.BranchID = a.BranchID
'
print @Query
		EXECUTE sp_executeSQL
				@Query,
				N'@CultureNo TinyInt,@DateFormat VARCHAR(10),@DateType TinyInt',
				@CultureNo = @CultureNo,
				@DateFormat = @DateFormat,
				@DateType = @DateType

