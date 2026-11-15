
create   proc [CFG].[GetUserGroupRecordLevelAccessByEntityId]
(
@entityType varchar(50),
@entityId int
)
as

declare @RecordLevelSetting int

select @RecordLevelSetting = RecordLevelSettingID
from cfg.RecordLevelSetting
where Entity = @entityType

select UserGroupID
from cfg.UserGroupRecordAccess
where RecorLevelSettingID = @RecordLevelSetting
and EntityID = @entityId
