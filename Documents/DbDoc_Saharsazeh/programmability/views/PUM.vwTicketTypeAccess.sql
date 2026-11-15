
--====================================================Create vwTicketTypeAccess

CREATE   VIEW [PUM].[vwTicketTypeAccess]
AS
	SELECT 
		[CFG].GetuserID() UserId,
		ty.TicketTypeId
	FROM 
		PUM.TicketType AS ty
	INNER JOIN 
		CFG.RecordLevelSetting AS rls
	ON 
		rls.Entity = 'TicketType'
	LEFT JOIN 
		CFG.TRecordLevelAccess AS tla
	ON 
		ty.TicketTypeId = tla.EntityRef
		AND tla.[Type] = rls.[Type]
		AND tla.UserID = cfg.GetuserID()
	LEFT JOIN 
		CFG.VwUserGroupRecordLevelAccess g 
	ON 
		ty.TicketTypeId = g.EntityID
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
		)
