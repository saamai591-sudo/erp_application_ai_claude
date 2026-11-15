CREATE   VIEW cfg.vwManagerSubordinates
AS
WITH GroupTree AS
(
    -- سطح اول: هر گروه به عنوان ریشه‌ی خودش، با مدیرِ همان گروه
    SELECT
        ug.UserGroupID                AS RootGroupID,
        ug.UserAdminID                AS ManagerUserID,
        ug.UserGroupID                AS UserGroupID,
        0                             AS Depth
    FROM cfg.UserGroup ug
    WHERE ug.UserAdminID IS NOT NULL

    UNION ALL

    -- پایین رفتن در درخت: زیرگروه‌های مستقیم و غیرمستقیم
    SELECT
        gt.RootGroupID,
        gt.ManagerUserID,
        child.UserGroupID,
        gt.Depth + 1
    FROM GroupTree gt
    INNER JOIN cfg.UserGroup child
        ON child.ParentUserGroupID = gt.UserGroupID
)
SELECT DISTINCT
    gt.ManagerUserID                  AS ManagerUserID,
    gt.RootGroupID                    AS ManagedGroupID,
    gt.UserGroupID                    AS SubGroupID,
    ugu.UserID                        AS SubordinateUserID,
    gt.Depth                          AS GroupDepth,
    CASE WHEN gt.Depth = 0 THEN 1 ELSE 0 END AS IsDirectGroup
FROM GroupTree gt
INNER JOIN cfg.UserGroupUser ugu
    ON ugu.UserGroupID = gt.UserGroupID
INNER JOIN cfg.[User] u
    ON u.UserID = ugu.UserID
WHERE ugu.UserID <> gt.ManagerUserID;   -- خود مدیر در لیست زیرمجموعه‌ها نیاید
