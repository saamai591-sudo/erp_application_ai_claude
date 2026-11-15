CREATE VIEW CFG.vwDashboardAccess
AS
SELECT CFG.GetuserID() UserID,
       sr.ReportID DashboardID
FROM CFG.SaturnReport AS sr
    INNER JOIN CFG.RecordLevelSetting AS rls
        ON rls.Entity = 'Dashboard'
    LEFT JOIN CFG.TRecordLevelAccess AS tla
        ON sr.ReportID = tla.EntityRef
           AND tla.[Type] = rls.[Type]
           AND tla.UserID = CFG.GetuserID()
    LEFT JOIN CFG.VwUserGroupRecordLevelAccess g
        ON sr.ReportID = g.EntityID
           AND rls.RecordLevelSettingID = g.RecorLevelSettingID
           AND g.UserID = CFG.GetuserID()
WHERE CFG.GetuserID() = -1
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
