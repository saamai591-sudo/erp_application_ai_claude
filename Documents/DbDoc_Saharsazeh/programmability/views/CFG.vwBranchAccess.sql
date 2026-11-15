-----------------------------------
--vwBranchAccess.sql:
 
Create   
VIEW CFG.vwBranchAccess
AS 

with cte
as
(
select cfg.GetuserID() UserID
),
Company
as
(
select * from CFG.vwCompanyAccess
)

SELECT cte.UserID,
       b.BranchID
FROM CFG.Branch AS b
cross join cte
INNER JOIN Company c on c.CompanyID = b.CompanyID
INNER JOIN CFG.RecordLevelSetting AS rls
		ON rls.Entity = 'Branch'
LEFT JOIN CFG.TRecordLevelAccess AS tla
        ON b.BranchID = tla.EntityRef
        AND tla.[Type] = rls.[Type]
		AND tla.UserID = cte.UserID
LEFT JOIN CFG.VwUserGroupRecordLevelAccess g 
		ON b.BranchID = g.EntityID
		AND rls.RecordLevelSettingID = g.RecorLevelSettingID
		AND g.UserID = cte.UserID
where cte.UserID = -1 
	OR 
	  rls.AccessType = 2
	OR
	  (rls.Level = 1
		AND
		(
			(
			rls.AccessType = 1 
			AND 
			tla.RecordLevelAccessID is not null
			)
			OR
			(
			rls.AccessType = 0
			AND 
			tla.RecordLevelAccessID is null			
			)
		)
	  )
	OR
	  (rls.Level = 2
		AND
		(
			(
			rls.AccessType = 1 
			AND 
			g.UserID is not null
			)
			OR
			(
			rls.AccessType = 0
			AND 
			g.UserID is null			
			)
		)
	  )
 
