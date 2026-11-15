
CREATE   VIEW CFG.vwCustomActionAccess
AS
WITH cte
AS (
	SELECT cfg.GetuserID() UserID
	),
Company
AS (
	SELECT *
	FROM CFG.vwCompanyAccess
	)
SELECT cte.UserID,
	b.CustomActionID
FROM CFG.CustomAction AS b
CROSS JOIN cte
INNER JOIN CFG.RecordLevelSetting AS rls
	ON rls.Entity = 'CustomAction'
LEFT JOIN CFG.TRecordLevelAccess AS tla
	ON b.CustomActionID = tla.EntityRef
		AND tla.[Type] = rls.[Type]
		AND tla.UserID = cte.UserID
LEFT JOIN CFG.VwUserGroupRecordLevelAccess g
	ON b.CustomActionID = g.EntityID
		AND rls.RecordLevelSettingID = g.RecorLevelSettingID
		AND g.UserID = cte.UserID
WHERE cte.UserID = - 1
	OR rls.AccessType = 2
	OR (
		rls.LEVEL = 1
		AND (
			(
				rls.AccessType = 1
				AND tla.RecordLevelAccessID IS NOT NULL
				)
			OR (
				rls.AccessType = 0
				AND tla.RecordLevelAccessID IS NULL
				)
			)
		)
	OR (
		rls.LEVEL = 2
		AND (
			(
				rls.AccessType = 1
				AND g.UserID IS NOT NULL
				)
			OR (
				rls.AccessType = 0
				AND g.UserID IS NULL
				)
			)
		);
