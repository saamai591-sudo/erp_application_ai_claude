

CREATE       VIEW [CFG].[RecordLevelAccess]
AS
	SELECT ROW_NUMBER() OVER(ORDER BY u.UserID) AS RNo,
			u.UserID,
			CAST(rls.Type AS TINYINT) AS [Type],
			b.BranchID             AS EntityRef
        FROM   CFG.[User] u
                CROSS JOIN CFG.Branch     b
				join cfg.RecordLevelSetting rls
				on rls.Entity = 'Branch'
				LEFT JOIN CFG.TRecordLevelAccess r
					ON  u.UserID = r.UserID
					AND rls.Type = r.Type
					AND b.BranchID = r.EntityRef
        where (rls.AccessType = 2 
				or 
				(rls.AccessType = 0  AND r.RecordLevelAccessID IS NOT NULL)
				or
				(rls.AccessType = 1  AND r.RecordLevelAccessID IS NULL)
				)
        UNIon all

	SELECT ROW_NUMBER() OVER(ORDER BY u.UserID) AS RNo,
			u.UserID,
			CAST(rls.Type AS TINYINT) AS [Type],
			b.ReportID             AS EntityRef
        FROM   CFG.[User] u
                CROSS JOIN CFG.SaturnReport     b
				join cfg.RecordLevelSetting rls
				on rls.Entity = 'SaturnReport'
				LEFT JOIN CFG.TRecordLevelAccess r
					ON  u.UserID = r.UserID
					AND rls.Type = r.Type
					AND b.ReportID = r.EntityRef
        where (rls.AccessType = 2 
				or 
				(rls.AccessType = 0  AND r.RecordLevelAccessID IS NOT NULL)
				or
				(rls.AccessType = 1  AND r.RecordLevelAccessID IS NULL)
				)
        UNIon all

	SELECT ROW_NUMBER() OVER(ORDER BY u.UserID) AS RNo,
			u.UserID,
			CAST(rls.Type AS TINYINT) AS [Type],
			b.BankAccountID             AS EntityRef
        FROM   CFG.[User] u
                CROSS JOIN CFG.BankAccount     b
				join cfg.RecordLevelSetting rls
				on rls.Entity = 'BankAccount'
				LEFT JOIN CFG.TRecordLevelAccess r
					ON  u.UserID = r.UserID
					AND rls.Type = r.Type
					AND b.BankAccountID = r.EntityRef
        where (rls.AccessType = 2 
				or 
				(rls.AccessType = 0  AND r.RecordLevelAccessID IS NOT NULL)
				or
				(rls.AccessType = 1  AND r.RecordLevelAccessID IS NULL)
				)
        UNIon all


	SELECT ROW_NUMBER() OVER(ORDER BY u.UserID) AS RNo,
			u.UserID,
			CAST(rls.Type AS TINYINT) AS [Type],
			b.CashID             AS EntityRef
        FROM   CFG.[User] u
                CROSS JOIN CFG.Cash     b
				join cfg.RecordLevelSetting rls
				on rls.Entity = 'Cash'
				LEFT JOIN CFG.TRecordLevelAccess r
					ON  u.UserID = r.UserID
					AND rls.Type = r.Type
					AND b.CashID = r.EntityRef
        where (rls.AccessType = 2 
				or 
				(rls.AccessType = 0  AND r.RecordLevelAccessID IS NOT NULL)
				or
				(rls.AccessType = 1  AND r.RecordLevelAccessID IS NULL)
				)
        UNIon all

	SELECT ROW_NUMBER() OVER(ORDER BY u.UserID) AS RNo,
			u.UserID,
			CAST(rls.Type AS TINYINT) AS [Type],
			b.StockID             AS EntityRef
        FROM   CFG.[User] u
                CROSS JOIN STF.Stock     b
				join cfg.RecordLevelSetting rls
				on rls.Entity = 'Stock'
				LEFT JOIN CFG.TRecordLevelAccess r
					ON  u.UserID = r.UserID
					AND rls.Type = r.Type
					AND b.StockID = r.EntityRef
        where (rls.AccessType = 2 
				or 
				(rls.AccessType = 0  AND r.RecordLevelAccessID IS NOT NULL)
				or
				(rls.AccessType = 1  AND r.RecordLevelAccessID IS NULL)
				)
        UNIon all

	SELECT ROW_NUMBER() OVER(ORDER BY u.UserID) AS RNo,
			u.UserID,
			CAST(rls.Type AS TINYINT) AS [Type],
			b.StockDocumentTypeID             AS EntityRef
        FROM   CFG.[User] u
                CROSS JOIN STC.StockDocumentType     b
				join cfg.RecordLevelSetting rls
				on rls.Entity = 'StockDocuments'
				LEFT JOIN CFG.TRecordLevelAccess r
					ON  u.UserID = r.UserID
					AND rls.Type = r.Type
					AND b.StockDocumentTypeID = r.EntityRef
        where (rls.AccessType = 2 
				or 
				(rls.AccessType = 0  AND r.RecordLevelAccessID IS NOT NULL)
				or
				(rls.AccessType = 1  AND r.RecordLevelAccessID IS NULL)
				)
        UNIon all

	SELECT ROW_NUMBER() OVER(ORDER BY u.UserID) AS RNo,
			u.UserID,
			CAST(rls.Type AS TINYINT) AS [Type],
			b.StationShiftID             AS EntityRef
        FROM   CFG.[User] u
                CROSS JOIN POS.StationShift     b
				join cfg.RecordLevelSetting rls
				on rls.Entity = 'StationShift'
				LEFT JOIN CFG.TRecordLevelAccess r
					ON  u.UserID = r.UserID
					AND rls.Type = r.Type
					AND b.StationShiftID = r.EntityRef
        where (rls.AccessType = 2 
				or 
				(rls.AccessType = 0  AND r.RecordLevelAccessID IS NOT NULL)
				or
				(rls.AccessType = 1  AND r.RecordLevelAccessID IS NULL)
				)
        UNIon all

	SELECT ROW_NUMBER() OVER(ORDER BY u.UserID) AS RNo,
			u.UserID,
			CAST(rls.Type AS TINYINT) AS [Type],
			b.AnalysisCubeID             AS EntityRef
        FROM   CFG.[User] u
                CROSS JOIN APS.AnalysisCube     b
				join cfg.RecordLevelSetting rls
				on rls.Entity = 'Cube'
				LEFT JOIN CFG.TRecordLevelAccess r
					ON  u.UserID = r.UserID
					AND rls.Type = r.Type
					AND b.AnalysisCubeID = r.EntityRef
        where (rls.AccessType = 2 
				or 
				(rls.AccessType = 0  AND r.RecordLevelAccessID IS NOT NULL)
				or
				(rls.AccessType = 1  AND r.RecordLevelAccessID IS NULL)
				)
        UNIon all

	SELECT ROW_NUMBER() OVER(ORDER BY u.UserID) AS RNo,
			u.UserID,
			CAST(rls.Type AS TINYINT) AS [Type],
			b.SaleAreaID             AS EntityRef
        FROM   CFG.[User] u
                CROSS JOIN SLE.SaleArea     b
				join cfg.RecordLevelSetting rls
				on rls.Entity = 'SaleArea'
				LEFT JOIN CFG.TRecordLevelAccess r
					ON  u.UserID = r.UserID
					AND rls.Type = r.Type
					AND b.SaleAreaID = r.EntityRef
        where (rls.AccessType = 2 
				or 
				(rls.AccessType = 0  AND r.RecordLevelAccessID IS NOT NULL)
				or
				(rls.AccessType = 1  AND r.RecordLevelAccessID IS NULL)
				)
        UNIon all

	SELECT ROW_NUMBER() OVER(ORDER BY u.UserID) AS RNo,
			u.UserID,
			CAST(rls.Type AS TINYINT) AS [Type],
			b.InternalAuditID             AS EntityRef
        FROM   CFG.[User] u
                CROSS JOIN CFG.InternalAudit     b
				join cfg.RecordLevelSetting rls
				on rls.Entity = 'InternalAudit'
				LEFT JOIN CFG.TRecordLevelAccess r
					ON  u.UserID = r.UserID
					AND rls.Type = r.Type
					AND b.InternalAuditID = r.EntityRef
        where (rls.AccessType = 2 
				or 
				(rls.AccessType = 0  AND r.RecordLevelAccessID IS NOT NULL)
				or
				(rls.AccessType = 1  AND r.RecordLevelAccessID IS NULL)
				)
        UNIon all

	SELECT ROW_NUMBER() OVER(ORDER BY u.UserID) AS RNo,
			u.UserID,
			CAST(rls.Type AS TINYINT) AS [Type],
			b.FinancialPeriodID             AS EntityRef
        FROM   CFG.[User] u
                CROSS JOIN CFG.FinancialPeriod     b
				join cfg.RecordLevelSetting rls
				on rls.Entity = 'FinancialPeriod'
				LEFT JOIN CFG.TRecordLevelAccess r
					ON  u.UserID = r.UserID
					AND rls.Type = r.Type
					AND b.FinancialPeriodID = r.EntityRef
        where (rls.AccessType = 2 
				or 
				(rls.AccessType = 0  AND r.RecordLevelAccessID IS NOT NULL)
				or
				(rls.AccessType = 1  AND r.RecordLevelAccessID IS NULL)
				)
        UNIon all

	SELECT ROW_NUMBER() OVER(ORDER BY u.UserID) AS RNo,
			u.UserID,
			CAST(rls.Type AS TINYINT) AS [Type],
			b.CardReaderID             AS EntityRef
        FROM   CFG.[User] u
                CROSS JOIN POS.CardReader     b
				join cfg.RecordLevelSetting rls
				on rls.Entity = 'CardReader'
				LEFT JOIN CFG.TRecordLevelAccess r
					ON  u.UserID = r.UserID
					AND rls.Type = r.Type
					AND b.CardReaderID = r.EntityRef
        where (rls.AccessType = 2 
				or 
				(rls.AccessType = 0  AND r.RecordLevelAccessID IS NOT NULL)
				or
				(rls.AccessType = 1  AND r.RecordLevelAccessID IS NULL)
				)







