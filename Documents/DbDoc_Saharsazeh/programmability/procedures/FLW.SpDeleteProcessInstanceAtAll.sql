
CREATE   PROC flw.SpDeleteProcessInstanceAtAll
(
	@ProcessInstanceID int
)
as

BEGIN
	IF(exists(select 1 from FLW.WfProcessInstance where ParentProcessInstanceID = @ProcessInstanceID))
	Begin
		RAISERROR('WorkFlowManager.Messages.ProcessInstanceHasFlowInAnotherProcessInstances', 16, 12);
        RETURN;
	end
	

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
		where ProcessInstanceID = @ProcessInstanceID
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
	
	
	delete a
	from FLW.WfTransitionInstance a
	join #TransitionForDelete b on a.ID = b.ID
	
	delete a
	from FLW.WfTasks a
	where a.ProcessInstanceID = @ProcessInstanceID
	
	delete a
	from FLW.WfActivityInstance a
	where a.ProcessInstanceID = @ProcessInstanceID
	
	delete from FLW.WfProcessInstance
	where ID = @ProcessInstanceID

END


