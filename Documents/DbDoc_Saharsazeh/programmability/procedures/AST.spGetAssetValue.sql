-------------------------------------
CREATE   proc [AST].spGetAssetValue 
(@SelectedAssets Nvarchar(MAX) = null,
@TableName nvarchar(MAX))
as

Declare @Query nvarchar(MAx)
 SELECT VALUE AssetID
	INTO   #SelectedAssets
	FROM   CFG.R_FnCommaStr2Table(@SelectedAssets)

	SELECT a.AssetID into #Asset
	FROM ast.Asset AS a
	left join #SelectedAssets sa on a.AssetID = sa.AssetID
	WHERE (@SelectedAssets is null or sa.AssetID is NOT NULL)


	select * into #vwAssetCategoryHistory
	from ast.vwAssetCategoryHistory

Create table #Src
(AssetID				int,
AssetCategoryID			int,
AssetFullID				nvarchar(400),
Date					Date,
Value					Decimal(36,10),
EstablishmentValue		Decimal(36,10),
ValueType				Nvarchar(250))


insert into #Src
(AssetID			,
AssetCategoryID		,
AssetFullID			,
Date				,
Value				,
EstablishmentValue	,
ValueType			)
	
SELECT a.AssetID,
       a.AssetCategoryID,
	   CASE
            WHEN a.AssetReceiptID IS NOT NULL THEN
                'Ar' + CAST(a.AssetReceiptID AS nvarchar(250))
                    + '-' + CAST(a.AssetCategoryID AS nvarchar(250))
                    + '-' + CAST(a.AssetID AS nvarchar(250))
            ELSE
                'As-' + CAST(a.AssetCategoryID AS nvarchar(250))
                    + '-' + CAST(a.AssetID AS nvarchar(250))
       END AS AssetFullID,
       a.AssetCreationDate,
       a.BaseValue VALUE,
       ISNULL(CASE WHEN a.Nature = 1 then a.BaseValue else 0 END,0) EstablishmentValue,
       CASE WHEN a.Nature <> 3 then 'Creation' else 'BetweenBranch' end ValueType
FROM   AST.Asset a
join #Asset ast on a.AssetID = ast.AssetID

insert into #Src
(AssetID			,
AssetCategoryID		,
AssetFullID			,
Date				,
Value				,
EstablishmentValue	,
ValueType			)

SELECT r.AssetID,
       vach.AssetCategoryID,
	   vach.AssetFullID,
       r.Date,
       ISNULL(r1.price, 0) + ISNULL(r2.price, 0),
       0 EstablishmentValue,
       'Repair' ValueType
FROM   ast.Repair r
join #Asset ast on r.AssetID = ast.AssetID
       JOIN #vwAssetCategoryHistory AS vach
            ON  vach.AssetID = r.AssetID
            AND r.[Date] between vach.FromDate and vach.ToDate
       left JOIN ast.RepairServiceCost r1
            ON  r1.RepairID = r.RepairID
       left JOIN ast.RepairStuffCost r2
            ON  r2.RepairID = r.RepairID
WHERE  r.Type = 2 



insert into #Src
(AssetID			,
AssetCategoryID		,
AssetFullID			,
Date				,
Value				,
EstablishmentValue	,
ValueType			)

SELECT r1.AssetID,
       vach.AssetCategoryID,
	   vach.AssetFullID,
       r.Date,
       ISNULL(r1.Amount, 0),
       0 EstablishmentValue,
       'Adjustment' ValueType
FROM   ast.Adjustment r
       JOIN ast.AdjustmentItem r1
            ON  r1.AdjustmentID = r.AdjustmentID			
join #Asset ast on r1.AssetID = ast.AssetID
       JOIN #vwAssetCategoryHistory AS vach
            ON  vach.AssetID = r1.AssetID
            AND r.[Date] between vach.FromDate and vach.ToDate 

insert into #Src
(AssetID			,
AssetCategoryID		,
AssetFullID			,
Date				,
Value				,
EstablishmentValue	,
ValueType			)
	
SELECT r1.AssetID,
       vach.AssetCategoryID,
	   vach.AssetFullID,
       r.Date,
       ISNULL(r1.Value, 0),
       0 EstablishmentValue,
       'Revaluation' ValueType
FROM   ast.Revaluation r
       JOIN ast.RevaluationItem r1
            ON  r1.RevaluationID = r.RevaluationID
					
join #Asset ast on r1.AssetID = ast.AssetID
       JOIN #vwAssetCategoryHistory AS vach
            ON  vach.AssetID = r1.AssetID
            AND r.[Date] between vach.FromDate and vach.ToDate

insert into #Src
(AssetID			,
AssetCategoryID		,
AssetFullID			,
Date				,
Value				,
EstablishmentValue	,
ValueType			)
	
SELECT cci.AssetID,
       cc.AssetCategoryID,
	   'cc'+Cast(cc.ChangeCategoryID as Nvarchar(250))+'-'+CAST(cc.AssetCategoryID as nvarchar(250))+'-'+CAST(cci.AssetID as nvarchar(250)) AssetFullID,
       cc.[Date],
       SUM(src.[value])                VALUE,
       0 EstablishmentValue,
       'ChangeCategory' ValueType
FROM   ast.ChangeCategory           AS cc
       JOIN ast.ChangeCategoryItem  AS cci
            ON  cci.ChangeCategoryID = cc.ChangeCategoryID		
		join #Asset ast on cci.AssetID = ast.AssetID
		join #vwAssetCategoryHistory vach on  'cc'+cast(Cc.ChangeCategoryID as nvarchar(250))+'-'+CAST(cc.AssetCategoryID as nvarchar(250))+'-'+CAST(cci.AssetID as nvarchar(250)) = vach.AssetFullID and cci.AssetID = vach.AssetID
       JOIN #Src src
            ON  cci.AssetID = src.AssetID
            AND src.[Date] < cc.[Date]
GROUP BY
       cci.AssetID,
       cc.AssetCategoryID,
       cc.[Date],
	   cc.ChangeCategoryID
       
Union All
  
	
SELECT cci.AssetID,
       cci.PreviousCategoryID,
	   vach2.AssetFullID,
       cc.[Date],
       -SUM(src.[value])                VALUE,
       0 EstablishmentValue,
       'ChangeCategory' ValueType
FROM   ast.ChangeCategory           AS cc
       JOIN ast.ChangeCategoryItem  AS cci
            ON  cci.ChangeCategoryID = cc.ChangeCategoryID
					
join #Asset ast on cci.AssetID = ast.AssetID
	   join #vwAssetCategoryHistory vach on 'cc'+cast(Cc.ChangeCategoryID as nvarchar(250))+'-'+CAST(cc.AssetCategoryID as nvarchar(250))+'-'+CAST(cci.AssetID as nvarchar(250)) = vach.AssetFullID and cci.AssetID = vach.AssetID
	   join #vwAssetCategoryHistory AS vach2 on vach.AssetID = vach2.AssetID and DATEADD(DAY,1,vach2.ToDate) = vach.FromDate
       JOIN #Src src
            ON     cci.AssetID = src.AssetID
            AND src.[Date] < cc.[Date]
GROUP BY
       cci.AssetID,
       cci.PreviousCategoryID,
       cc.[Date]   ,
	   vach2.AssetFullID



set @Query = N'select * into '+@Tablename+N' from #Src'

Exec (@Query)
