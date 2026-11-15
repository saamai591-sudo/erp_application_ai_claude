
CREATE   VIEW [AST].VWAssetValue
 --WITH ENCRYPTION

AS		

with cte as(


select * from ast.vwAssetCategoryHistory
)

SELECT a.AssetID,
       a.AssetCategoryID,
	   'ar'+cast(a.AssetReceiptID as nvarchar(250))+'-'+CAST(a.AssetCategoryID as nvarchar(250))+'-'+CAST(a.AssetID as nvarchar(250)) AssetFullID,
       a.AssetCreationDate As Date,
       a.BaseValue AS VALUE,
       ISNULL(CASE WHEN a.Nature = 3 then a.BaseValue else 0 END,0) EstablishmentValue,
       'Creation' ValueType
FROM   AST.Asset a

UNION all

SELECT r.AssetID,
       vach.AssetCategoryID,
	   vach.AssetFullID,
       r.Date,
       ISNULL(r1.price, 0) + ISNULL(r2.price, 0),
       0 EstablishmentValue,
       'Repair' ValueType
FROM   ast.Repair r
       JOIN cte AS vach
            ON  vach.AssetID = r.AssetID
            AND r.[Date] between vach.FromDate and vach.ToDate
       left JOIN ast.RepairServiceCost r1
            ON  r1.RepairID = r.RepairID
       left JOIN ast.RepairStuffCost r2
            ON  r2.RepairID = r.RepairID
WHERE  r.Type = 2 

UNION all

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
       JOIN cte AS vach
            ON  vach.AssetID = r1.AssetID
            AND r.[Date] between vach.FromDate and vach.ToDate 

UNION all
	
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
       JOIN cte AS vach
            ON  vach.AssetID = r1.AssetID
            AND r.[Date] between vach.FromDate and vach.ToDate

UNION ALL
	
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
		join cte vach on  'cc'+cast(Cc.ChangeCategoryID as nvarchar(250))+'-'+CAST(cc.AssetCategoryID as nvarchar(250))+'-'+CAST(cci.AssetID as nvarchar(250)) = vach.AssetFullID and cci.AssetID = vach.AssetID
       JOIN (
                SELECT a.AssetID,
                       a.AssetCategoryID,
					  'ar'+cast(a.AssetReceiptID as nvarchar(250)) AssetFullID,
                       a.AssetCreationDate AS Date,
                       CASE 
                            WHEN a.Nature = 3 THEN a.BaseValue -a.AccumulatedDepreciation -a.DuringDepreciation
                            ELSE a.BaseValue
                       END VALUE
                FROM   AST.Asset a
                       
                UNION all
                
                SELECT r.AssetID,
                       vach.AssetCategoryID,
					   vach.AssetFullID,
                       r.Date,
                       ISNULL(r1.price, 0) + ISNULL(r2.price, 0)
                FROM   ast.Repair r
                       JOIN cte AS vach
                            ON  vach.AssetID = r.AssetID
                            AND r.[Date] between vach.FromDate and vach.ToDate
                       left JOIN ast.RepairServiceCost r1
                            ON  r1.RepairID = r.RepairID
                       left JOIN ast.RepairStuffCost r2
                            ON  r2.RepairID = r.RepairID
                WHERE  r.Type = 2 
                UNION all
                SELECT r1.AssetID,
                       vach.AssetCategoryID,
					   vach.AssetFullID,
                       r.Date,
                       ISNULL(r1.Amount, 0)
                FROM   ast.Adjustment r
                       JOIN ast.AdjustmentItem r1
                            ON  r1.AdjustmentID = r.AdjustmentID
                       JOIN cte AS vach
                            ON  vach.AssetID = r1.AssetID
                            AND r.[Date] between vach.FromDate and vach.ToDate 
                UNION all
                SELECT r1.AssetID,
                       vach.AssetCategoryID,
					   vach.AssetFullID,
                       r.Date,
                       ISNULL(r1.Value, 0)
                FROM   ast.Revaluation r
                       JOIN ast.RevaluationItem r1
                            ON  r1.RevaluationID = r.RevaluationID
                       JOIN cte AS vach
                            ON  vach.AssetID = r1.AssetID
                            AND r.[Date] between vach.FromDate and vach.ToDate
            ) src
            ON  cci.AssetID = src.AssetID
            AND src.[Date] < cc.[Date]
GROUP BY
       cci.AssetID,
       cc.AssetCategoryID,
       cc.[Date],
	   cc.ChangeCategoryID
       
       
  UNION ALL
  
  
	
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
	   join cte vach on 'cc'+cast(Cc.ChangeCategoryID as nvarchar(250))+'-'+CAST(cc.AssetCategoryID as nvarchar(250))+'-'+CAST(cci.AssetID as nvarchar(250)) = vach.AssetFullID and cci.AssetID = vach.AssetID
	   join cte AS vach2 on vach.AssetID = vach2.AssetID and DATEADD(DAY,1,vach2.ToDate) = vach.FromDate
       JOIN (
                SELECT a.AssetID,
                       a.AssetCategoryID,		
					   'ar'+cast(a.AssetReceiptID as nvarchar(250)) as AssetFullID,
                       a.AssetCreationDate AS Date,
                       CASE 
                            WHEN a.Nature = 3 THEN a.BaseValue -a.AccumulatedDepreciation -a.DuringDepreciation
                            ELSE a.BaseValue
                       END VALUE
                FROM   AST.Asset a
                
                UNION all
                
                SELECT r.AssetID,
                       vach.AssetCategoryID,
					   vach.AssetFullID,
                       r.Date,
                       ISNULL(r1.price, 0) + ISNULL(r2.price, 0)
                FROM   ast.Repair r
                       JOIN cte AS vach
                            ON  vach.AssetID = r.AssetID
                            AND r.[Date] between vach.FromDate and vach.ToDate
                       left JOIN ast.RepairServiceCost r1
                            ON  r1.RepairID = r.RepairID
                       left JOIN ast.RepairStuffCost r2
                            ON  r2.RepairID = r.RepairID
                WHERE  r.Type = 2 
                UNION all
                SELECT r1.AssetID,
                       vach.AssetCategoryID,
					   vach.AssetFullID,
                       r.Date,
                       ISNULL(r1.Amount, 0)
                FROM   ast.Adjustment r
                       JOIN ast.AdjustmentItem r1
                            ON  r1.AdjustmentID = r.AdjustmentID
                       JOIN cte AS vach
                            ON  vach.AssetID = r1.AssetID
                            AND r.[Date] between vach.FromDate and vach.ToDate 
                UNION all
                SELECT r1.AssetID,
                       vach.AssetCategoryID,
					   vach.AssetFullID,
                       r.Date,
                       ISNULL(r1.Value, 0)
                FROM   ast.Revaluation r
                       JOIN ast.RevaluationItem r1
                            ON  r1.RevaluationID = r.RevaluationID
                       JOIN cte AS vach
                            ON  vach.AssetID = r1.AssetID
                            AND r.[Date] between vach.FromDate and vach.ToDate
            ) src
            ON     cci.AssetID = src.AssetID
            AND src.[Date] < cc.[Date]
GROUP BY
       cci.AssetID,
       cci.PreviousCategoryID,
       cc.[Date]   ,
	   vach2.AssetFullID

