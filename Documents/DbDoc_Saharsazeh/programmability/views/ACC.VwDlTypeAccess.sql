
--------------------------------------
CREATE   VIEW [ACC].[VwDlTypeAccess]
AS
	SELECT 
		[CFG].GetuserID() UserId,
		dlt.DlTypeID
	FROM 
		ACC.DlType AS dlt
	INNER JOIN 
		CFG.RecordLevelSetting AS rls
	ON 
		rls.Entity = 'DlType'
	LEFT JOIN 
		CFG.TRecordLevelAccess AS tla
	ON 
		dlt.DlTypeID = tla.EntityRef
		AND tla.[Type] = rls.[Type]
		AND tla.UserID = cfg.GetuserID()
	LEFT JOIN 
		CFG.VwUserGroupRecordLevelAccess g 
	ON 
		dlt.DlTypeID = g.EntityID
		AND rls.RecordLevelSettingID = g.RecorLevelSettingID
		AND g.UserID = [CFG].[GetUserID]()
	WHERE 
		cfg.GetuserID() = -1 
		OR rls.AccessType = 2
		OR
		(
			rls.Level = 1
			AND
			(
				(
					rls.AccessType = 1 
					AND tla.RecordLevelAccessID IS NOT NULL
				)
				OR
				(
					rls.AccessType = 0
					AND tla.RecordLevelAccessID IS NULL			
				)
			)
		)
		OR
		(
			rls.Level = 2
			AND
			(
				(
					rls.AccessType = 1 
					AND g.UserID IS NOT NULL
				)
				OR
				(
					rls.AccessType = 0
					AND g.UserID IS NULL			
				)
			)
		);
