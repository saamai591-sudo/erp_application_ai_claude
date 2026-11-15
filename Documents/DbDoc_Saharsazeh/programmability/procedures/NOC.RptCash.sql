


CREATE 
proc [NOC].RptCash
(
@ReportagePeriodID int
)

as

declare @Enadate date,
		@StartDate date,
		@CurrentYear int,
		@CurrentPeriod Nvarchar(256)

select  @StartDate = StartDate ,
		@Enadate = EndDate,
		@CurrentYear = cfg.GetCLRSaturnDate(StartDate,'YYYY',0,1),
		@CurrentPeriod = Title
from  noc.ReportagePeriod 
where ReportagePeriodID = @ReportagePeriodID



declare @EndSlTreeLevel int,
		@StartSlTreeLevel int

select @EndSlTreeLevel = configvalue 
 from noc.niocsetting
 where configkey = 'EndSlTreeLevel'

select @StartSlTreeLevel = configvalue 
 from noc.niocsetting
 where configkey = 'StartSlTreeLevel'

 create table #CashAnalysing
 (
 slid int ,
 EndOfPreviousMonth decimal(30,4),
 CurrentMonth decimal(30,4),
 YearToDate decimal(30,4),
 ProjectToDate decimal(30,4),
 ProjectToPreviousYear decimal(30,4)
 )


 select  c.SlID,
		 d.EndDate	,
		 d.StartDate,
		 case when CustomeField.LookupDataItemID is not null then  CustomeField.LookupDataItemID else c.ReportagePeriodID end ReportagePeriodID,
		 c.ModificationID,
		case when ReportCurrencyDebitCash - ReportCurrencyCreditCash > 0 
			then -1 * (ReportCurrencyDebitCash - ReportCurrencyCreditCash)
			else ReportCurrencyDebitCash - ReportCurrencyCreditCash end Amount
	into #Modification
 from noc.Modification c
join
(
select ModificationID,
	sum(BaseCurrencyDebitCash) BaseCurrencyDebitCash,
	sum(BaseCurrencyCreditCash) BaseCurrencyCreditCash,
	sum(ReportCurrencyDebitCash) ReportCurrencyDebitCash,
	sum(ReportCurrencyCreditCash) ReportCurrencyCreditCash
from noc.ModifiedTopic
group by ModificationID
) mt on c.ModificationID = mt.ModificationID
left join
(
select b.EntityID,LookupDataItemID
from cfg.EntityCustomeField a
join cfg.EntityCustomeFieldData b
	on a.EntityCustomeFieldID = b.EntityCustomeFieldID
where a.FieldName = 'CashReportagePeriod'
) CustomeField on CustomeField.EntityID = c.ModificationID
join noc.ReportagePeriod d
	on d.ReportagePeriodID = case when CustomeField.LookupDataItemID is not null then  CustomeField.LookupDataItemID else c.ReportagePeriodID end
where   d.EndDate <= @Enadate

  insert into #CashAnalysing 
  select 
		a.slid,
		sum(EndOfPreviousMonth) EndOfPreviousMonth,
		sum(CurrentMonth) CurrentMonth,
		sum(YearToDate) YearToDate,
		sum(ProjectToDate) ProjectToDate,
		sum(ProjectToPreviousYear) ProjectToPreviousYear	
  from (
			select  slid,
					sum(case when d.EndDate < @StartDate then Debit - credit else 0 end) EndOfPreviousMonth,
					sum(case when d.ReportagePeriodID >= @ReportagePeriodID then Debit - credit else 0 end) CurrentMonth,
					sum(case when cfg.GetCLRSaturnDate(StartDate,'YYYY',0,1) = @CurrentYear then Debit - credit else 0 end) YearToDate,
					sum(Debit - credit) ProjectToDate,
					sum(case when cfg.GetCLRSaturnDate(StartDate,'YYYY',0,1) < @CurrentYear 
		 		 				then Debit - credit  else 0 end) ProjectToPreviousYear

			 from noc.CashFounding c
			 join noc.ReportagePeriod d
				on d.ReportagePeriodID = c.ReportagePeriodID
			where d.EndDate <= @Enadate
			 group by slid

			 union all

			select  slid,
					sum(case when d.EndDate < @StartDate then Amount else 0 end) EndOfPreviousMonth,
					sum(case when d.ReportagePeriodID >= @ReportagePeriodID  then Amount else 0 end) CurrentMonth,
					sum(case when cfg.GetCLRSaturnDate(StartDate,'YYYY',0,1) = @CurrentYear then Amount else 0 end) YearToDate,
					sum(Amount) ProjectToDate,
					sum(case when cfg.GetCLRSaturnDate(StartDate,'YYYY',0,1) < @CurrentYear 
		 		 				then Amount else 0 end) ProjectToPreviousYear

			 from noc.CashAnalysing a
			 join noc.CashAnalysingItem b
				on a.CashAnalysingID = b.CashAnalysingID
			join noc.Analysing c
				on c.AnalysingID = a.AnalysingID
			join noc.ReportagePeriod d
				on d.ReportagePeriodID = c.ReportagePeriodID
			where a.Status = 1
			and d.EndDate <= @Enadate
			group by slid

			 union all

			select m.SlID,
					sum(case when EndDate < @StartDate then Amount else 0 end) EndOfPreviousMonth,
					sum(case when ReportagePeriodID >= @ReportagePeriodID  then Amount else 0 end) CurrentMonth,
					sum(case when cfg.GetCLRSaturnDate(StartDate,'YYYY',0,1) = @CurrentYear then Amount else 0 end) YearToDate,
					sum(Amount) ProjectToDate,
					sum(case when cfg.GetCLRSaturnDate(StartDate,'YYYY',0,1) < @CurrentYear 
		 		 				then Amount else 0 end) ProjectToPreviousYear  	

			from #Modification m
			group by m.SlID

			 union all

		select mt.SlID,
					sum(case when EndDate < @StartDate then ReportCurrencyDebitCash - ReportCurrencyCreditCash else 0 end) EndOfPreviousMonth,
					sum(case when ReportagePeriodID >= @ReportagePeriodID  then ReportCurrencyDebitCash - ReportCurrencyCreditCash else 0 end) CurrentMonth,
					sum(case when cfg.GetCLRSaturnDate(StartDate,'YYYY',0,1) = @CurrentYear then ReportCurrencyDebitCash - ReportCurrencyCreditCash else 0 end) YearToDate,
					sum(ReportCurrencyDebitCash - ReportCurrencyCreditCash) ProjectToDate,
					sum(case when cfg.GetCLRSaturnDate(StartDate,'YYYY',0,1) < @CurrentYear 
		 		 				then ReportCurrencyDebitCash - ReportCurrencyCreditCash else 0 end) ProjectToPreviousYear  	

		  from noc.ModifiedTopic mt
		  join #Modification m
			on mt.ModificationID = m.ModificationID
			where ToBeReported = 1
			group by mt.SlID

)a
 join noc.ReportHeadline b
	on a.SlID = b.SlID
where b.OnlyInPeriodReview  = 0
group by a.slid



DECLARE @MaxCodeLength INT;

select @MaxCodeLength = sum(CodeLength) from  acc.SlTreeLevel
where LevelOrder <= (select LevelOrder from  acc.SlTreeLevel where SlTreeLevelID = @StartSlTreeLevel)

;WITH cte
AS (SELECT s.SlID,
           NULL AS ParentId,
           s.Title,
		   l.LevelOrder
    FROM ACC.SL AS s
	join acc.SlTreeLevel l on s.SlTreeLevelID = l.SlTreeLevelID
    WHERE s.SlID in (select SlID 
					from  acc.SL
					where SlTreeLevelID = (select SlTreeLevelID from  acc.SlTreeLevel where LevelType = 2)
					and left(acc.SlFullCode(SlID),@MaxCodeLength) in (select distinct left(acc.SlFullCode(SlID),@MaxCodeLength) from noc.ReportHeadline))
    UNION ALL
    SELECT s.SlID,
           s.ParentID AS ParentId,
           s.Title,
		   l.LevelOrder
    FROM ACC.SL AS s
	join acc.SlTreeLevel l on s.SlTreeLevelID = l.SlTreeLevelID
    INNER JOIN cte
            ON cte.SlID = s.ParentID)
SELECT cte.SlID,
       cte.ParentId,
       cte.Title,
		acc.SlFullCode(cte.SlID)  SlCode,
		EndOfPreviousMonth,
		CurrentMonth,
		YearToDate,
		ProjectToDate,
		ProjectToPreviousYear,
		@CurrentPeriod PeriodTitle,
		LevelOrder
into #TT
FROM cte 
left join #CashAnalysing c
	on c.SlID = cte.SlID


;with C as
(
  select T.SlID,
         T.EndOfPreviousMonth,
		 T.CurrentMonth,
		 T.YearToDate,
		 T.ProjectToDate,
		 T.ProjectToPreviousYear,
         T.SlID as RootID,
		 LevelOrder
  from #TT T
  union all
  select T.SlID,
         T.EndOfPreviousMonth,
		 T.CurrentMonth,
		 T.YearToDate,
		 T.ProjectToDate,
		 T.ProjectToPreviousYear,
         C.RootID,
		 T.LevelOrder
  from #TT T
    inner join C 
      on T.ParentId = C.SlID
)
select T.SlID,
       T.ParentId,
	   T.SlCode,
       T.Title,
	   T.PeriodTitle,
       S.EndOfPreviousMonth,
	   S.CurrentMonth,
	   S.YearToDate,
	   S.ProjectToDate,
	   S.ProjectToPreviousYear,
	   T.LevelOrder
into #T
from #TT T
  inner join (
             select RootID,
                    sum(EndOfPreviousMonth) as EndOfPreviousMonth,
					sum(CurrentMonth) as CurrentMonth,
					sum(YearToDate) as YearToDate,
					sum(ProjectToDate) as ProjectToDate,
					sum(ProjectToPreviousYear) as ProjectToPreviousYear
             from C
             group by RootID
             ) as S
    on T.SlID = S.RootID
order by T.SlID
option (maxrecursion 0)

declare @IsFinal bit = 0

	if exists 
		(
			select *
			from noc.ConfirmedReport 
			where ReportagePeriodID = @ReportagePeriodID
			and type = 1
		)
		begin
			set @IsFinal = 1
		end



select
	   a.SlID,
       ParentId,
	   SlCode,
       Title,
	   PeriodTitle,
       isnull(EndOfPreviousMonth,0) EndOfPreviousMonth,
	   isnull(CurrentMonth,0) CurrentMonth,
	   isnull(YearToDate,0) YearToDate,
	   isnull(ProjectToDate,0) ProjectToDate,
	   isnull(ProjectToPreviousYear,0) ProjectToPreviousYear,
	   @IsFinal IsFinal,
	   LevelOrder
 from #T a
where 
(EndOfPreviousMonth is not null
or CurrentMonth is not null
or YearToDate is not null
or ProjectToDate is not null
or ProjectToPreviousYear is not null)
