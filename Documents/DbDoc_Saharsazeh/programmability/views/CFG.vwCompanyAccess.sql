-----------------------------------
--vwCompanyAccess.sql:
 

Create   
VIEW CFG.vwCompanyAccess
AS 
with cte
as (
select cfg.GetuserID() UserID)

SELECT cfg.GetuserID() UserID,
       c.CompanyID
FROM CFG.Company AS c
cross join cte
inner JOIN CFG.RecordLevelSetting AS rls
		ON rls.Entity = 'Company'
left JOIN CFG.TRecordLevelAccess AS tla
        ON c.CompanyID = tla.EntityRef
        AND tla.[Type] = rls.[Type]
		AND tla.UserID = cte.UserID
left JOIN CFG.VwUserGroupRecordLevelAccess g 
		ON c.CompanyID = g.EntityID
		AND rls.RecordLevelSettingID = g.RecorLevelSettingID
		AND g.UserID = cte.userid
where cte.userid = -1 
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
 
-------------------------------------vwReservedStuffs.sql:
