
--------------------------------------
CREATE   VIEW CFG.vwBankAccountAccess
AS

with cte as 
(SELECT * FROM cfg.vwCompanyAccess AS vca)

SELECT cfg.GetuserID() UserID,
       b.BankAccountID
FROM CFG.BankAccount AS b
INNER JOIN cte c on c.CompanyID = b.CompanyID
INNER JOIN CFG.RecordLevelSetting AS rls
		ON rls.Entity = 'BankAccount'
LEFT JOIN CFG.TRecordLevelAccess AS tla
        ON b.BankAccountID = tla.EntityRef
        AND tla.[Type] = rls.[Type]
		AND tla.UserID = cfg.GetuserID()
LEFT JOIN CFG.VwUserGroupRecordLevelAccess g 
		ON b.BankAccountID = g.EntityID
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
