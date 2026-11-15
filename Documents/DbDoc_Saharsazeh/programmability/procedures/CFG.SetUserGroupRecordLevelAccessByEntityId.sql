
create   proc [CFG].[SetUserGroupRecordLevelAccessByEntityId]
(
@entityId int,
@entityType varchar(50),
@userGroupIds varchar(max)
)
as

declare @RecordLevelSetting int

select @RecordLevelSetting = RecordLevelSettingID
from cfg.RecordLevelSetting
where Entity = @entityType


select value 
into #value
from cfg.R_FnCommaStr2Table(@userGroupIds)

INSERT INTO [CFG].[UserGroupRecordAccess]
           ([RecorLevelSettingID]
           ,[EntityID]
           ,[UserGroupID])
select
           @RecordLevelSetting
           ,@entityId
		   ,value
from #value a
left join [CFG].[UserGroupRecordAccess] b
	on  b.[UserGroupID] = a.value 
	and b.[RecorLevelSettingID] = @RecordLevelSetting
	and b.EntityID = @entityId
where b.RecorLevelSettingID is  null



delete b
from [CFG].[UserGroupRecordAccess] b
left join #value a
	on  b.[UserGroupID] = a.value 
where a.value is  null
	and b.[RecorLevelSettingID] = @RecordLevelSetting
	and b.EntityID = @entityId

