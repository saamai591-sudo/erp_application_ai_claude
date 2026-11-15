create 
view CFG.VwUserGroupRecordLevelAccess
AS
	SELECT *
	FROM
	 (
	SELECT case when ug.ApplyAllUser = 1 then cfg.GetuserID() else ugu.UserID end UserID,
		   ugra.EntityID,
		   ugra.RecorLevelSettingID
	FROM CFG.UserGroupRecordAccess ugra
	INNER JOIN CFG.UserGroup ug 
			ON ug.UserGroupID  = ugra.UserGroupID
	LEFT  JOIN CFG.UserGroupUser  ugu
			ON ugu.UserGroupID = ugra.UserGroupID
	)a
	group by UserID,EntityID,RecorLevelSettingID
