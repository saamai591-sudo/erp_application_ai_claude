------------------------------------- START #8186_QC
CREATE   VIEW [CFG].[vwOperationLevelAccess]
AS
    SELECT src.UserID,
           src.EntityName, 
		  case 
                when AccessKey like '{%' 
                    THEN   JSON_VALUE(AccessKey, '$.a') 
                ELSE 
                    AccessKey 
          END AS  AccessKey ,
		   case 
                when AccessKey like '{%' 
                    THEN  JSON_VALUE(AccessKey, '$.u')
                ELSE 
                    NULL 
          END AS Users 
    FROM
    (
        SELECT a.UserID,
               a.EntityName,
               CASE
                   WHEN oj.Value IS NULL THEN
                       a.EntityName
                   ELSE
                       oj.Value
               END AS AccessKey
        FROM
        (
            SELECT u.UserID,
                   JSON_VALUE(child_value.Value, '$.e') AS EntityName,
                   child_value.Value,
                   u.AccessInfo
            FROM CFG.[User] AS u
                CROSS APPLY OPENJSON(u.AccessInfo, '$') AS child_value
        ) a
            OUTER APPLY OPENJSON(a.Value, '$.i') AS oj
        UNION
        SELECT a.UserID,
               a.EntityName,
               CASE
                   WHEN oj.Value IS NULL THEN
                       a.EntityName
                   ELSE
                       oj.Value
               END AS Access
        FROM
        (
            SELECT ugu.UserID,
                   JSON_VALUE(da.[Value], '$.e') AS EntityName,
                   da.[Value]
            FROM CFG.[UserGroup] AS u
                CROSS APPLY OPENJSON(u.AccessInfo, '$') AS da
                JOIN CFG.UserGroupUser AS ugu
                    ON ugu.UserGroupID = u.UserGroupID
            WHERE u.IsActive = 1
                  AND u.ApplyAllUser = 0
        ) a
            OUTER APPLY OPENJSON(a.Value, '$.i') AS oj
        UNION
        SELECT a.UserID,
               a.EntityName,
               CASE
                   WHEN oj.Value IS NULL THEN
                       a.EntityName
                   ELSE
                       oj.Value
               END AS Access
        FROM
        (
            SELECT u2.UserID,
                   JSON_VALUE(da.[Value], '$.e') AS EntityName,
                   da.[Value]
            FROM CFG.[UserGroup] AS u
                CROSS APPLY OPENJSON(u.AccessInfo, '$') AS da
                CROSS APPLY CFG.[User] AS u2
            WHERE u.IsActive = 1
                  AND u.ApplyAllUser = 1
        ) a
            OUTER APPLY OPENJSON(a.Value, '$.i') AS oj
        EXCEPT
        SELECT a.UserID,
               a.EntityName,
               CASE
                   WHEN oj.Value IS NULL THEN
                       a.EntityName
                   ELSE
                       oj.Value
               END AS Access
        FROM
        (
            SELECT u.UserID,
                   JSON_VALUE(da.[Value], '$.e') AS EntityName,
                   da.[Value]
            FROM CFG.[User] AS u
                CROSS APPLY OPENJSON(u.DenyAccessInfo, '$') AS da
        ) a
            OUTER APPLY OPENJSON(a.Value, '$.i') AS oj
    ) AS src

