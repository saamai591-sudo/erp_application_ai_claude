
-------------------------------------
CREATE   PROC [NOC].[RptAccrue_Well]
(
@ReportagePeriodID int
)

as
	SET NOCOUNT ON;  

declare @Enadate date,
		@StartDate date,
		@CurrentYear int,
		@CurrentPeriod Nvarchar(256),
		@LocationDlTypeID int,
		@CurrencyReport int

select  @StartDate = StartDate ,
		@Enadate = EndDate,
		@CurrentYear = cfg.GetCLRSaturnDate(StartDate,'YYYY',0,1),
		@CurrentPeriod = Title
from  noc.ReportagePeriod 
where ReportagePeriodID = @ReportagePeriodID

select @CurrencyReport = ConfigValue
from noc.NIOCSetting
where ConfigKey = 'CurrencyReport'


select @LocationDlTypeID = DlTypeID
from acc.DlType
where Code = 112

DECLARE @WellMaster int
DECLARE @WellMasterLevelOrder int
DECLARE @FTPPeriod int 

select @FTPPeriod = ConfigValue
from noc.NIOCSetting
where ConfigKey = 'FTPReportagePeriodID'

if @FTPPeriod = 0 set @FTPPeriod = null
DECLARE @FTPDate Date

select @FTPDate = ConfigValue
from noc.NIOCSetting
where ConfigKey = 'FTPDate'



declare @EndSlTreeLevel int,
		@StartSlTreeLevel int

select @EndSlTreeLevel = configvalue 
 from noc.niocsetting
 where configkey = 'EndSlTreeLevel'

select @StartSlTreeLevel = configvalue 
 from noc.niocsetting
 where configkey = 'StartSlTreeLevel'

select  a.slid,
		WellDlID,
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
		case when @FTPPeriod is not null then 
											sum(case when a.ReportagePeriodID <  @FTPPeriod then debit - Credit else 0 end)
			 when @FTPDate is not null then 
											sum(case when a.Date <  @FTPDate then debit - Credit else 0 end)
			 when @FTPPeriod is null and @FTPDate is  null then
											sum(debit - Credit)											
										 end PreFTP,
		case when @FTPPeriod is not null then 
											sum(case when a.ReportagePeriodID >= @FTPPeriod then debit - Credit else 0 end) 
			 when @FTPDate is not null then 				
											sum(case when a.Date >=  @FTPDate then debit - Credit else 0 end)
										 end PostFTP,
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
			a.ReportCurrencyDebit debit,
			a.ReportCurrencyCredit Credit,
			alvi.DlID WellDlID,
			v.Date
	 from noc.AccrueAnalysing a
	 join acc.VoucherItem b
		on a.VoucherItemID = b.VoucherItemID
	join acc.Voucher v
		on v.VoucherID = b.VoucherID
	join noc.Analysing c
		on c.AnalysingID = a.AnalysingID
	join noc.ReportagePeriod d
		on d.ReportagePeriodID = c.ReportagePeriodID
	left join 
	(
	select alvi.VoucherItemID,dl.DlID
	from acc.AccountLevelVoucherItem  alvi
	join acc.dl dl on alvi.DlID = dl.DLID and dl.DlTypeID = @LocationDlTypeID 
	)alvi
		on b.VoucherItemID = alvi.VoucherItemID
	where a.Status = 1
	and d.EndDate <= @Enadate


	union all

	select  a.slid,
			d.ReportagePeriodID,
			StartDate,
			EndDate,
			case when a.Value > 0 then Value else 0 end  Debit,
			case when a.Value < 0 then abs(Value) else 0 end  Credit,
			(
				select top 1 dl.DlID
				from acc.PreVoucherItem pvi
				join acc.PreVoucherItemAccountLevel pvial
					on pvi.PreVoucherItemID = pvial.PreVoucherItemID
					and pvi.PreVoucherID = a.AccruePreVoucherID
					and pvi.SlID = a.SlID
				join acc.dl  on pvial.DlID = dl.DLID and dl.DlTypeID = @LocationDlTypeID 
				group by pvi.PreVoucherID,pvi.SlID,dl.DlID
			) WellDlID,
			StartDate
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
			round(vi.Debit / ReportCurrencyRate,2),
			null WellDlID,
			c.Date
	from noc.Modification c
	join acc.VoucherItem vi
		on vi.VoucherItemID = c.VoucherItemID
	join noc.ReportagePeriod d
		on d.ReportagePeriodID = c.ReportagePeriodID
	where  d.EndDate <= @Enadate

	union all

	select  mt.SlID,
			rp.ReportagePeriodID,
			StartDate,
			EndDate,
			ReportCurrencyDebitAccrue,
			ReportCurrencyCreditAccrue,
			null WellDlID,
			m.Date
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
group by a.slid,WellDlID


DECLARE @MaxCodeLength INT;

select @MaxCodeLength = sum(CodeLength) 
from  acc.SlTreeLevel
where LevelOrder <= (select LevelOrder 
					 from  acc.SlTreeLevel 
					 where SlTreeLevelID = @StartSlTreeLevel)



;WITH cte
AS (SELECT s.SlID,
           NULL AS ParentId,
		   LevelOrder
    FROM ACC.SL AS s
	join acc.SlTreeLevel l on s.SlTreeLevelID = l.SlTreeLevelID
    WHERE SlID in (select SlID 
					from  acc.SL
					where SlTreeLevelID = @StartSlTreeLevel
					and left(acc.SlFullCode(SlID),@MaxCodeLength) in (select distinct left(acc.SlFullCode(SlID),@MaxCodeLength) from noc.ReportHeadline))
    UNION ALL
    SELECT s.SlID,
           s.ParentID AS ParentId,
		   l.LevelOrder
    FROM ACC.SL AS s
	join acc.SlTreeLevel l on s.SlTreeLevelID = l.SlTreeLevelID
    INNER JOIN cte
            ON cte.SlID = s.ParentID)
SELECT  cte.SlID,
        cte.ParentId,
		cte.LevelOrder,
		EndOfPreviousMonth,
		CurrentMonth,
		YearToDate,
		ProjectToDate,
		PreFTP,
		PostFTP,
		ProjectToPreviousYear,
		WellDlID
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
		 T.PreFTP,
		 T.PostFTP,
		 T.ProjectToPreviousYear,
         T.SlID as RootID,
		 WellDlID,
		 LevelOrder
  from #TT T
  union all
  select T.SlID,
         T.EndOfPreviousMonth,
		 T.CurrentMonth,
		 T.YearToDate,
		 T.ProjectToDate,
		 T.PreFTP,
		 T.PostFTP,
		 T.ProjectToPreviousYear,
         C.RootID,
		 null WellDlID,
		 T.LevelOrder
  from #TT T
    inner join C 
      on T.ParentId = C.SlID 
)


select S.RootID SlID,
       T.ParentId,
	   S.WellDlID,
       S.EndOfPreviousMonth,
	   S.CurrentMonth,
	   S.YearToDate,
	   S.ProjectToDate,
	   S.PreFTP,
	   S.PostFTP,
	   S.ProjectToPreviousYear,
	   LevelOrder
into #T
from #TT T
  left join (
            select RootID,
				WellDlID,
                sum(EndOfPreviousMonth) as EndOfPreviousMonth,
				sum(CurrentMonth) as CurrentMonth,
				sum(YearToDate) as YearToDate,
				sum(ProjectToDate) as ProjectToDate,
				sum(PreFTP) as PreFTP,
				sum(PostFTP) as PostFTP,
				sum(ProjectToPreviousYear) as ProjectToPreviousYear
            from C
				 where 
					(
					EndOfPreviousMonth is not null
					or CurrentMonth is not null
					or YearToDate is not null
					or ProjectToDate is not null
					or ProjectToPreviousYear is not null
					)
            group by RootID,WellDlID
      ) as S  on T.SlID = S.RootID AND (T.WellDlID is null or T.WellDlID = S.WellDlID)
order by S.RootID
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


	SELECT distinct ParentID Slid,LevelOrder,acc.SlFullCode(ParentID) SlCode,LEN(acc.SlFullCode(ParentID)) LenCode
	into #NeedDetectionIntoWell
	FROM acc.sl
	join acc.SlTreeLevel t on sl.SlTreeLevelID = t.SlTreeLevelID
	join acc.AccountLevelSL als on als.SlID = sl.SlID and DlTypeID = @LocationDlTypeID



	 select 
			a.SlID,
			a.ParentId,
			acc.SlFullCode(a.SlID) SlCode,
		    sl.Title,
			LevelOrder,
		    SUM(isnull(EndOfPreviousMonth,0)) EndOfPreviousMonth,
		    SUM(isnull(CurrentMonth,0)) CurrentMonth,
		    SUM(isnull(YearToDate,0)) YearToDate,
		    SUM(isnull(ProjectToDate,0)) ProjectToDate,
			SUM(isnull(PreFTP,0)) PreFTP,
			SUM(isnull(PostFTP,0)) PostFTP,
		    SUM(isnull(ProjectToPreviousYear,0)) ProjectToPreviousYear,
			Null WellDlID
		into #Result
	 from #T  a
	 join acc.sl on a.SlID = sl.SlID
	 where 
		(
		EndOfPreviousMonth is not null
		or CurrentMonth is not null
		or YearToDate is not null
		or ProjectToDate is not null
		or ProjectToPreviousYear is not null
		)
	and 
	( a.SlID in (select distinct SlID from #T where WellDlID is null) or a.slid in (select slid from #NeedDetectionIntoWell))
	group by a.SlID,
			 a.ParentId,
			 sl.Title,
			 LevelOrder

			


	DECLARE @WellDlID INT
    DECLARE @MaxSlID int
	DECLARE @WellMasterCode nvarchar(50)
	DECLARE @WellMasterCodeLen int

	select @MaxSlID = max(SlID) from acc.sl




	DECLARE Sl_Well_Cursor CURSOR FOR   
	select SlID,LevelOrder,SlCode,LenCode
	from #NeedDetectionIntoWell
  
	OPEN Sl_Well_Cursor  
  
	FETCH NEXT FROM Sl_Well_Cursor   INTO @WellMaster ,@WellMasterLevelOrder,@WellMasterCode,@WellMasterCodeLen
  
	WHILE @@FETCH_STATUS = 0  
	BEGIN  


			DECLARE Well_Cursor CURSOR FOR   
			SELECT WellDlID
			FROM #T 
			WHERE WellDlID is not null
			group by WellDlID;  
  
			OPEN Well_Cursor  
  
			FETCH NEXT FROM Well_Cursor   INTO @WellDlID 
  
			WHILE @@FETCH_STATUS = 0  
			BEGIN  

			declare @WellDlCode varchar(50)

			select @WellDlCode = code from acc.dl where DLID = @WellDlID
		

			set @MaxSlID = @MaxSlID + 1
			insert into #Result
			 select 
					@MaxSlID,
					@WellMaster,
					@WellMasterCode+dl.Code,
					dl.Title,
					@WellMasterLevelOrder + 1,
					SUM(isnull(EndOfPreviousMonth,0)) EndOfPreviousMonth,
					SUM(isnull(CurrentMonth,0)) CurrentMonth,
					SUM(isnull(YearToDate,0)) YearToDate,
					SUM(isnull(ProjectToDate,0)) ProjectToDate,
					SUM(isnull(PreFTP,0)) PreFTP,
					SUM(isnull(PostFTP,0)) PostFTP,
					SUM(isnull(ProjectToPreviousYear,0)) ProjectToPreviousYear,
					@WellDlID WellDlID
			 from #T  a
			 join acc.dl on dl.DLID = a.WellDlID
			 where a.ParentId = @WellMaster and WellDlID = @WellDlID
			 group by WellDlID,
					  dl.Code,
					  dl.Title

			update #T
			set LevelOrder = LevelOrder + 1
			where WellDlID = @WellDlID and LevelOrder > @WellMasterLevelOrder and RIGHT(acc.SlFullCode(SlID),@WellMasterCodeLen) = @WellMasterCode
	

			insert into #Result	 
			 select 
					a.SlID,
					@MaxSlID,
					acc.SlFullCode(a.ParentId)+@WellDlCode+sl.Code SlCode,
					sl.Title,
					LevelOrder + 1,
					isnull(EndOfPreviousMonth,0) EndOfPreviousMonth,
					isnull(CurrentMonth,0) CurrentMonth,
					isnull(YearToDate,0) YearToDate,
					isnull(ProjectToDate,0) ProjectToDate,
					isnull(PreFTP,0) PreFTP,
					isnull(PostFTP,0) PostFTP,
					isnull(ProjectToPreviousYear,0) ProjectToPreviousYear,
					@WellDlID WellDlID
			 from #T   a
			 join acc.sl on a.SlID = sl.SlID
			 where a.ParentId = @WellMaster and WellDlID  = @WellDlID

			FETCH NEXT FROM Well_Cursor   INTO @WellDlID 
			END   
			CLOSE Well_Cursor;  
			DEALLOCATE Well_Cursor;

	FETCH NEXT FROM Sl_Well_Cursor   INTO @WellMaster ,@WellMasterLevelOrder,@WellMasterCode,@WellMasterCodeLen
	END   
	CLOSE Sl_Well_Cursor;  
	DEALLOCATE Sl_Well_Cursor;

	select
		   a.SlID,
		   WellDlID,
		   a.ParentId,
		   SlCode,
		   Title,
		   @CurrentPeriod PeriodTitle,
		   isnull(EndOfPreviousMonth,0) EndOfPreviousMonth,
		   isnull(CurrentMonth,0) CurrentMonth,
		   isnull(YearToDate,0) YearToDate,
		   isnull(ProjectToDate,0) ProjectToDate,
		   isnull(PreFTP,0) PreFTP,
		   isnull(PostFTP,0) PostFTP,
		   isnull(ProjectToPreviousYear,0) ProjectToPreviousYear,
		   @IsFinal IsFinal,
		   LevelOrder,
		   case when @ReportagePeriodID >= isnull(@FTPPeriod,0) then REPLACE(b.NIOCCode,'x','1') else REPLACE(b.NIOCCode,'x','0') end NIOCCode
	 from #Result  a
	  left join NOC.NIOCAccountCode b on a.SlID = b.SlID and (b.dlid is null or isnull(a.WellDlID,0) = isnull(b.dlid,0))
	where 
	(
	EndOfPreviousMonth is not null
	or CurrentMonth is not null
	or YearToDate is not null
	or ProjectToDate is not null
	or ProjectToPreviousYear is not null
	)

	order by WellDlID
