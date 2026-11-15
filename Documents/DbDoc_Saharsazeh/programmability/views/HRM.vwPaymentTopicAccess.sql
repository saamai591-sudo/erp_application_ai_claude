
---------------------------------------
CREATE   VIEW [HRM].[vwPaymentTopicAccess]
AS 
with cte
as
(
select cfg.GetuserID() UserID
)

SELECT cte.UserID,
       b.PaymentTopicID
FROM HRM.PaymentTopic AS b
cross join cte
INNER JOIN CFG.RecordLevelSetting AS rls
		ON rls.Entity = 'PaymentTopic'
LEFT JOIN CFG.TRecordLevelAccess AS tla
        ON b.PaymentTopicID = tla.EntityRef
        AND tla.[Type] = rls.[Type]
		AND tla.UserID = cte.UserID
LEFT JOIN CFG.VwUserGroupRecordLevelAccess g 
		ON b.PaymentTopicID = g.EntityID
		AND rls.RecordLevelSettingID = g.RecorLevelSettingID
		AND g.UserID = cte.UserID
where cte.UserID = -1 
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
	  );
