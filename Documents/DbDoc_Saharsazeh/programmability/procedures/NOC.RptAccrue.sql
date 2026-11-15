

CREATE  
proc [NOC].RptAccrue
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

select  a.slid,
		acc.SlFullCode(a.SlID) SlCode,
		sum(case when EndDate < @StartDate
					then debit - Credit
				 else 0 end) EndOfPreviousMonth,
		sum(case when a.ReportagePeriodID >= @ReportagePeriodID 
					then debit - Credit
				 else 0 end) CurrentMonth,
		sum(case when cfg.GetCLRSaturnDate(StartDate,'YYYY',0,1) = @CurrentYear 
		 			then debit - Credit
				 else 0 end) YearToDate,
		sum(debit - Credit ) ProjectToDate,
		sum(case when cfg.GetCLRSaturnDate(StartDate,'YYYY',0,1) < @CurrentYear 
		 		 	then debit - Credit
				 else 0 end) ProjectToPreviousYear
into #AccrueAnalysing
from
(
	select  slid,
			d.ReportagePeriodID,
			StartDate,
			EndDate,
			round(b.debit / ReportCurrencyRate,2) debit,
			round(b.Credit / ReportCurrencyRate,2) Credit
	 from noc.AccrueAnalysing a
	 join acc.VoucherItem b
		on a.VoucherItemID = b.VoucherItemID
	join noc.Analysing c
		on c.AnalysingID = a.AnalysingID
	join noc.ReportagePeriod d
		on d.ReportagePeriodID = c.ReportagePeriodID
	where a.Status = 1
	and d.EndDate <= @Enadate


	union all

	select  a.slid,
			d.ReportagePeriodID,
			StartDate,
			EndDate,
			case when a.Value > 0 then Value else 0 end  Debit,
			case when a.Value < 0 then abs(Value) else 0 end  Credit
	 from noc.CurrencyExchange a
	join noc.Analysing c
		on c.AnalysingID = a.AnalysingID
	join noc.ReportagePeriod d
		on d.ReportagePeriodID = c.ReportagePeriodID
	where  d.EndDate <= @Enadate

	union all

	select  c.SlID,
			d.ReportagePeriodID,
			StartDate,
			EndDate,
			round(vi.Credit / ReportCurrencyRate,2),
			round(vi.Debit / ReportCurrencyRate,2)
	from noc.Modification c
	join acc.VoucherItem vi
		on vi.VoucherItemID = c.VoucherItemID
	--join noc.AccrueAnalysing aa
	--	on vi.VoucherItemID = aa.VoucherItemID
	join noc.ReportagePeriod d
		on d.ReportagePeriodID = c.ReportagePeriodID
	where  d.EndDate <= @Enadate

	union all

	select  mt.SlID,
			rp.ReportagePeriodID,
			StartDate,
			EndDate,
			ReportCurrencyDebitAccrue,
			ReportCurrencyCreditAccrue
	from noc.ModifiedTopic mt
	join noc.Modification m
		on m.ModificationID = mt.ModificationID
	join noc.ReportagePeriod rp
		on rp.ReportagePeriodID = m.ReportagePeriodID
	where  rp.EndDate <= @Enadate
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
		   LevelOrder
    FROM ACC.SL AS s
	join acc.SlTreeLevel l on s.SlTreeLevelID = l.SlTreeLevelID
    WHERE SlID in (select SlID 
					from  acc.SL
					where SlTreeLevelID = (select SlTreeLevelID from  acc.SlTreeLevel where LevelType = 2)
					and left(acc.SlFullCode(SlID),@MaxCodeLength) in (select distinct left(acc.SlFullCode(SlID),@MaxCodeLength) from noc.ReportHeadline))
    UNION ALL
    SELECT s.SlID,
           s.ParentID AS ParentId,
           s.Title,
		   l.LevelOrder
    FROM ACC.SL AS s
	INNER JOIN acc.SlTreeLevel l on s.SlTreeLevelID = l.SlTreeLevelID
    INNER JOIN cte
            ON cte.SlID = s.ParentID)
SELECT cte.SlID,
	   cte.LevelOrder,
       cte.ParentId,
       cte.Title,
		acc.SlFullCode(cte.SlID)  SlCode,
		EndOfPreviousMonth,
		CurrentMonth,
		YearToDate,
		ProjectToDate,
		ProjectToPreviousYear,
		@CurrentPeriod PeriodTitle
into #TT
FROM cte 
left join #AccrueAnalysing c
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
	   LevelOrder
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
			and type = 2
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
 from #T  a
where 
(EndOfPreviousMonth is not null
or CurrentMonth is not null
or YearToDate is not null
or ProjectToDate is not null
or ProjectToPreviousYear is not null
)
