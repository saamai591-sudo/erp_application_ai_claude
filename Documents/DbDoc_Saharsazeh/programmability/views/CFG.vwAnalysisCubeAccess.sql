CREATE   VIEW CFG.vwAnalysisCubeAccess
AS

-- when user is -1 and IsAdmin
SELECT -1 AS UserID,
       ba.AnalysisCubeID
FROM APS.AnalysisCube AS ba
WHERE cfg.GetuserID() = -1
UNION ALL
-------------------------------------------------------------------
--- when we do not need any access check
SELECT u.UserID,
       c.AnalysisCubeID
FROM APS.AnalysisCube AS c
    CROSS JOIN CFG.[User] AS u
    JOIN CFG.RecordLevelSetting AS rls
        ON rls.Type = 15
WHERE rls.AccessType = 2
      AND u.UserID = cfg.GetuserID()
      AND u.UserID <> -1
UNION ALL
---------------------------------------------------------------------
--- when we have access and its related to user -- AccessType =1  and level = 1
SELECT tla.UserID,
       ba.AnalysisCubeID
FROM APS.AnalysisCube AS ba
    JOIN CFG.RecordLevelSetting AS rls
        ON rls.[Type] = 15
    JOIN CFG.TRecordLevelAccess AS tla
        ON ba.AnalysisCubeID = tla.EntityRef
           AND tla.[Type] = rls.[Type]
WHERE rls.AccessType = 1
      AND rls.Level = 1
      AND tla.UserID = cfg.GetuserID()
      AND cfg.GetuserID() <> -1
UNION ALL

---------------------------------------------------------------------
--- when we have access and its related to group    -- AccessType =1  and level = 2

SELECT ugu.UserID,
       CAST(ugra.EntityID AS INT) AS AnalysisCubeID
FROM CFG.UserGroupRecordAccess AS ugra
    JOIN CFG.UserGroupUser AS ugu
        ON ugu.UserGroupID = ugra.UserGroupID
    JOIN CFG.RecordLevelSetting AS rls
        ON rls.RecordLevelSettingID = ugra.RecorLevelSettingID
WHERE rls.AccessType = 1
      AND rls.Type = 15
      AND ugu.UserID = cfg.GetuserID()
      AND cfg.GetuserID() <> -1
      AND rls.Level = 2
GROUP BY ugu.UserID,
         ugra.EntityID
UNION ALL


---------------------------------------------------------------------
--- when we have no-access and its related to user  --AccessType =0  and level = 1

SELECT u.UserID,
       ba.AnalysisCubeID
FROM APS.AnalysisCube AS ba
    CROSS JOIN CFG.[User] AS u
    JOIN CFG.RecordLevelSetting AS rls
        ON rls.[Type] = 15
    LEFT JOIN CFG.TRecordLevelAccess AS tla
        ON ba.AnalysisCubeID = tla.EntityRef
           AND tla.[Type] = rls.[Type]
           AND u.UserID = tla.UserID
WHERE rls.AccessType = 0
      AND rls.Level = 1
      AND u.UserID = cfg.GetuserID()
      AND tla.RecordLevelAccessID IS NULL
      AND u.UserID <> -1
UNION ALL

---------------------------------------------------------------------
--- when we have no-access and its related to group -- AccessType =0  and level = 2
SELECT u.UserID,
       p.AnalysisCubeID
FROM APS.AnalysisCube AS p
    JOIN CFG.RecordLevelSetting AS rls
        ON rls.Type = 15
    CROSS JOIN CFG.[User] AS u
    LEFT JOIN CFG.UserGroupUser AS ugu
        ON ugu.UserID = u.UserID
    LEFT JOIN CFG.UserGroupRecordAccess AS ugra
        ON ugra.UserGroupID = ugu.UserGroupID
           AND ugra.RecorLevelSettingID = rls.RecordLevelSettingID
WHERE rls.AccessType = 0
      AND rls.Level = 2
      AND u.UserID = cfg.GetuserID()
      AND ugra.UserGroupRecordAccessID IS NULL
      AND u.UserID <> -1
GROUP BY u.UserID,
         p.AnalysisCubeID;
