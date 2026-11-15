CREATE  
VIEW CFG.vwFinancialPeriodAccess
 AS

SELECT cfg.GetuserID() UserID,
       fp.FinancialPeriodID
FROM CFG.FinancialPeriod AS fp
INNER JOIN CFG.RecordLevelSetting AS rls
		ON rls.Entity = 'FinancialPeriod'
LEFT JOIN CFG.TRecordLevelAccess AS tla
        ON fp.FinancialPeriodID = tla.EntityRef
        AND tla.[Type] = rls.[Type]
		AND tla.UserID = cfg.GetuserID()
LEFT JOIN CFG.VwUserGroupRecordLevelAccess g 
		ON fp.FinancialPeriodID = g.EntityID
		AND rls.RecordLevelSettingID = g.RecorLevelSettingID
		AND g.UserID = cfg.GetuserID()
where cfg.GetuserID() = -1 
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
