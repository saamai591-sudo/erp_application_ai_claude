
CREATE   VIEW [PUM].[vwTicketTypeExpert]
AS
	SELECT
		u.UserID,
		u.Name,
		u.Name2,
		u.Username,
		ty.TicketTypeId
	FROM
		CFG.[User] AS u
	CROSS JOIN
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
		AND tla.UserID = u.UserID
	LEFT JOIN
		CFG.VwUserGroupRecordLevelAccess g
	ON
		ty.TicketTypeId = g.EntityID
		AND rls.RecordLevelSettingID = g.RecorLevelSettingID
		AND g.UserID = u.UserID
	WHERE
		u.IsActive = 1
		AND u.UserID > 0
		AND (
			LOWER(u.Username) = 'admin'
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
		)
