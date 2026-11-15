CREATE
VIEW CFG.vwStockDocumentsAccess
 AS

SELECT cfg.GetuserID() UserID,
       sdt.StockDocumentTypeID
FROM STC.StockDocumentType AS sdt
INNER JOIN CFG.RecordLevelSetting AS rls
		ON rls.Entity = 'StockDocuments'
LEFT JOIN CFG.TRecordLevelAccess AS tla
        ON sdt.StockDocumentTypeID = tla.EntityRef
        AND tla.[Type] = rls.[Type]
		AND tla.UserID = cfg.GetuserID()
LEFT JOIN CFG.VwUserGroupRecordLevelAccess g 
		ON sdt.StockDocumentTypeID = g.EntityID
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

