
CREATE   PROC flw.SpWorkflowImprovement
(
@ActivityInstanceID int
)
as

BEGIN
	if OBJECT_ID('tempdb..#TransitionForDelete') is not null
	drop table #TransitionForDelete
	
	if OBJECT_ID('tempdb..#TaskForDelete') is not null
	drop table #TaskForDelete
	
	if OBJECT_ID('tempdb..#ActivityForDelete') is not null
	drop table #ActivityForDelete
	
	if OBJECT_ID('tempdb..#SubFlowsForDelete') is not null
	drop table #SubFlowsForDelete
	
	;with cte 
	as
	(
	select  id,
			FromActivityInstanceID,
			ToActivityInstanceID 
	from FLW.WfTransitionInstance  
	where FromActivityInstanceID = @ActivityInstanceID
	union all
	select  a.id,
			a.FromActivityInstanceID,
			a.ToActivityInstanceID RootId
	from FLW.WfTransitionInstance  a
	join cte b on a.FromActivityInstanceID = b.ToActivityInstanceID
	
	)
	select * 
	into #TransitionForDelete 
	from cte
	
	
	select b.ID
	into #TaskForDelete
	from #TransitionForDelete a
	join FLW.WfTasks b on a.ToActivityInstanceID = b.ActivityInstanceID
	
	select b.ID
	into #ActivityForDelete
	from #TransitionForDelete a
	join FLW.WfActivityInstance b on a.ToActivityInstanceID = b.id
	
	select a.ID
	into #SubFlowsForDelete
	from FLW.WfProcessInstance a
	join #ActivityForDelete b on a.ParentActivityInstanceId = b.ID
	
	
	
	delete a
	from FLW.WfTransitionInstance a
	join #SubFlowsForDelete b on a.ProcessInstanceID = b.ID
	
	
	delete a
	from FLW.WfTasks a
	join #SubFlowsForDelete b on a.ProcessInstanceID = b.ID
	
	
	delete a
	from FLW.WfActivityInstance a
	join #SubFlowsForDelete b on a.ProcessInstanceID = b.ID
	
	delete a
	from FLW.WfProcessInstance a
	join #SubFlowsForDelete b on a.id = b.ID
	
	
	delete a
	from FLW.WfTransitionInstance a
	join #TransitionForDelete b on a.id = b.ID
	
	
	delete a
	from FLW.WfTasks a
	join #TaskForDelete b on a.id = b.ID
	
	
	delete a
	from FLW.WfActivityInstance a
	join #ActivityForDelete b on a.id = b.ID
	
	update  FLW.WfTasks
	set TaskState = 1, EndedByUserID = null,EndedByUserName=null,EndedDateTime=null 
	where ActivityInstanceID = @ActivityInstanceID
	
	update FLW.WfActivityInstance
	set ActivityState = 1,LastUpdatedByUserID=null,LastUpdatedByUserName=null,LastUpdatedDateTime=null,EndedByUserID=null,EndedByUserName=null,EndedDateTime=null
	where id = @ActivityInstanceID

	declare @ProcessInstanceID  int

	select @ProcessInstanceID = ProcessInstanceID
	from flw.WfActivityInstance
	where id = @ActivityInstanceID

	update flw.WfProcessInstance 
	set ProcessState = 2
	where id = @ProcessInstanceID

END
