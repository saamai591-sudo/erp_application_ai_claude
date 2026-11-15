-------------------------------------
CREATE   view [AST].vwAssetCategoryHistory
	as

SELECT 'Created'     TYPE,
       CASE
            WHEN a.AssetReceiptID IS NOT NULL THEN
                'Ar' + CAST(a.AssetReceiptID AS nvarchar(250))
                    + '-' + CAST(a.AssetCategoryID AS nvarchar(250))
                    + '-' + CAST(a.AssetID AS nvarchar(250))
            ELSE
                'As-' + CAST(a.AssetCategoryID AS nvarchar(250))
                    + '-' + CAST(a.AssetID AS nvarchar(250))
       END AS AssetFullID, 
       a.AssetID,
       a.AssetCreationDate FromDate,
       ISNULL(b.ChangedDate, '2099-03-21') ToDate,
       a.AssetCategoryID,
       Null          PreviousCategoryID
FROM   ast.Asset a
       left JOIN (
                SELECT DATEADD(DAY, -1, MIN(DATE)) ChangedDate,
                       AssetID
                FROM   ast.ChangeCategoryItem cci
                       JOIN ast.ChangeCategory cc
                            ON  cci.ChangeCategoryID = cc.ChangeCategoryID
                GROUP BY
                       cci.AssetID
            ) b
            ON  a.AssetID = b.AssetID

UNION all


SELECT 'ChangedCategory'             AS TYPE,
       'cc' + CAST(a.ChangeCategoryID as NVARCHAR(250)) + '-' + CAST(a.AssetCategoryID  as NVARCHAR(250)) + '-' + CAST(a.AssetID  as NVARCHAR(250)) 
       AssetFullID,
       a.AssetID,
       a.Date                           FromDate,
       ISNULL(b.Date, '2099-03-21')     ToDate,
       a.AssetCategoryID,
       a.PreviousCategoryID
FROM   (
           SELECT ROW_NUMBER() over(PARTITION by cci.assetid order by DATE) rno,
                  cci.AssetID,
                  cc.ChangeCategoryID,
                  cc.AssetCategoryID,
                  cc.Date,
                  cci.PreviousCategoryID
           FROM   ast.ChangeCategory cc
                  JOIN ast.ChangeCategoryItem cci
                       ON  cc.ChangeCategoryID = cci.ChangeCategoryID
       ) a
       left JOIN (
                SELECT ROW_NUMBER() over(PARTITION by cci.assetid order by DATE) rno,
                       cci.AssetID,
                       cc.ChangeCategoryID,
                       cc.AssetCategoryID,
                       DATEADD(DAY, -1, cc.Date) DATE
                FROM   ast.ChangeCategory cc
                       JOIN ast.ChangeCategoryItem cci
                            ON  cc.ChangeCategoryID = cci.ChangeCategoryID
            ) b
            ON  a.AssetID = b.AssetID
            AND a.rno = b.rno - 1


