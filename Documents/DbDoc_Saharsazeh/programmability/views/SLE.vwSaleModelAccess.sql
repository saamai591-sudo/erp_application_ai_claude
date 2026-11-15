CREATE   
VIEW SLE.vwSaleModelAccess
 AS

SELECT cfg.GetuserID() UserID,
       sm.SaleModelID
FROM SLE.SaleModel AS sm
INNER JOIN CFG.RecordLevelSetting AS rls
		ON rls.Entity = 'SaleModel'
LEFT JOIN CFG.TRecordLevelAccess AS tla
        ON sm.SaleModelID = tla.EntityRef
        AND tla.[Type] = rls.[Type]
		AND tla.UserID = cfg.GetuserID()
LEFT JOIN CFG.VwUserGroupRecordLevelAccess g 
		ON sm.SaleModelID = g.EntityID
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
