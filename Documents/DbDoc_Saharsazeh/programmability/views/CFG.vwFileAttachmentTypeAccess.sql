CREATE  
VIEW CFG.vwFileAttachmentTypeAccess
 AS

SELECT cfg.GetuserID() UserID,
       fat.FileAttachmentTypeID
FROM CFG.FileAttachmentType AS fat
INNER JOIN CFG.RecordLevelSetting AS rls
		ON rls.Entity = 'FileAttachmentType'
LEFT JOIN CFG.TRecordLevelAccess AS tla
        ON fat.FileAttachmentTypeID = tla.EntityRef
        AND tla.[Type] = rls.[Type]
		AND tla.UserID = cfg.GetuserID()
LEFT JOIN CFG.VwUserGroupRecordLevelAccess g 
		ON fat.FileAttachmentTypeID = g.EntityID
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
	OR (
		fat.MetaDataEntityID = 0
		AND fat.IsSystem = 1
	)


