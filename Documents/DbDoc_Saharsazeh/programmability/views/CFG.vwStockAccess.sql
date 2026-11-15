Create   
VIEW CFG.vwStockAccess
AS
with cte
as(
select cfg.GetuserID() userID
),
Branch as(
select * from cfg.vwBranchAccess
)
SELECT cte.UserID,
       s.StockID
FROM STF.Stock AS s
cross join cte
INNER JOIN branch c on c.BranchID = s.BranchID
INNER JOIN CFG.RecordLevelSetting AS rls
		ON rls.Entity = 'Stock'
LEFT JOIN CFG.TRecordLevelAccess AS tla
        ON s.StockID = tla.EntityRef
        AND tla.[Type] = rls.[Type]
		and tla.UserID = cte.userID

LEFT JOIN CFG.VwUserGroupRecordLevelAccess g 
		ON s.StockID = g.EntityID
		AND rls.RecordLevelSettingID = g.RecorLevelSettingID
		AND g.UserID = cte.userID
where cte.userID = -1 
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

