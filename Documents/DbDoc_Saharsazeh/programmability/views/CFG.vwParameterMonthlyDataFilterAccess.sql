CREATE  
VIEW CFG.vwParameterMonthlyDataFilterAccess
 AS

SELECT cfg.GetuserID() UserID,
       pmdf.ParameterMonthlyDataFilterID
FROM PAY.ParameterMonthlyDataFilter AS pmdf
INNER JOIN CFG.RecordLevelSetting AS rls
		ON rls.Entity = 'ParameterMonthlyDataFilter'
LEFT JOIN CFG.TRecordLevelAccess AS tla
        ON pmdf.ParameterMonthlyDataFilterID = tla.EntityRef
        AND tla.[Type] = rls.[Type]
		AND tla.UserID = cfg.GetuserID()
LEFT JOIN CFG.VwUserGroupRecordLevelAccess g 
		ON pmdf.ParameterMonthlyDataFilterID = g.EntityID
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
