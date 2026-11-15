CREATE
VIEW CFG.vwStationShiftAccess
 AS

SELECT cfg.GetuserID() UserID,
       ss.StationShiftID
FROM POS.StationShift AS ss
INNER JOIN POS.Station s on s.StationID = ss.StationID
INNER JOIN CFG.vwBranchAccess c on c.BranchID = s.BranchID
INNER JOIN CFG.RecordLevelSetting AS rls
		ON rls.Entity = 'StationShift'
LEFT JOIN CFG.TRecordLevelAccess AS tla
        ON ss.StationShiftID = tla.EntityRef
        AND tla.[Type] = rls.[Type]
		AND tla.UserID = cfg.GetuserID()
LEFT JOIN CFG.VwUserGroupRecordLevelAccess g 
		ON ss.StationShiftID = g.EntityID
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
