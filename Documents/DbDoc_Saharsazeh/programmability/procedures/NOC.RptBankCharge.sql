create    proc [NOC].[RptBankCharge]
(
@ReportagePeriodID int
)

as
SET NOCOUNT ON;  

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
		 ReportagePeriodID int,
		 slid int ,
		 CurrentMonth decimal(30,4)
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

		DECLARE @ReportagePeriodIDForCursorC int
		DECLARE CursorForC CURSOR FOR   
		SELECT ReportagePeriodID 
		FROM  noc.ReportagePeriod 
		where EndDate <= @Enadate
		ORDER BY [Order];  
  
		OPEN CursorForC  
  
		FETCH NEXT FROM CursorForC   INTO @ReportagePeriodIDForCursorC
  
		WHILE @@FETCH_STATUS = 0  
		BEGIN  
  
		  insert into #CashAnalysing 
		  select 
				@ReportagePeriodIDForCursorC,
				a.slid,
				sum(CurrentMonth) CurrentMonth
		  from (
					select  slid,
							sum(Debit - credit) CurrentMonth
					 from noc.CashFounding c
					 where ReportagePeriodID <= @ReportagePeriodIDForCursorC
					 group by slid

					 union all

					select  slid,
							sum(Amount) CurrentMonth
					 from noc.CashAnalysing a
					 join noc.CashAnalysingItem b
						on a.CashAnalysingID = b.CashAnalysingID
					join noc.Analysing c
						on c.AnalysingID = a.AnalysingID
					where a.Status = 1
					and ReportagePeriodID <= @ReportagePeriodIDForCursorC
					 group by slid

					 union all

					select m.SlID,
							sum(Amount) CurrentMonth
					from #Modification m
					 where ReportagePeriodID <= @ReportagePeriodIDForCursorC
					 group by slid

					 union all

					select mt.SlID,
							sum(ReportCurrencyDebitCash - ReportCurrencyCreditCash) CurrentMonth
					from noc.ModifiedTopic mt
					join #Modification m
					on mt.ModificationID = m.ModificationID
					where ToBeReported = 1
					and ReportagePeriodID <= @ReportagePeriodIDForCursorC
						group by mt.slid

		)a
		 join noc.ReportHeadline b
			on a.SlID = b.SlID
		where b.OnlyInPeriodReview  = 0
		group by a.slid


			FETCH NEXT FROM CursorForC   INTO @ReportagePeriodIDForCursorC
		END   
		CLOSE CursorForC;  
		DEALLOCATE CursorForC;


		DECLARE @MaxCodeLength INT;

		select @MaxCodeLength = sum(CodeLength) from  acc.SlTreeLevel
		where LevelOrder <= (select LevelOrder from  acc.SlTreeLevel where SlTreeLevelID = @StartSlTreeLevel)

		;WITH cte
		AS (SELECT s.SlID,
				   NULL AS ParentId,
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
				   l.LevelOrder
			FROM ACC.SL AS s
			join acc.SlTreeLevel l on s.SlTreeLevelID = l.SlTreeLevelID
			INNER JOIN cte
					ON cte.SlID = s.ParentID)
		select cte.SlID,ParentId,cte.LevelOrder,rp.ReportagePeriodID
		into #sl
		from cte
		cross join noc.ReportagePeriod rp 
		where rp.EndDate <= @Enadate

		SELECT  #sl.ReportagePeriodID,
				#sl.SlID,
				#sl.ParentId,
				CurrentMonth,
				LevelOrder
		into #TT
		FROM #sl 
		left join #CashAnalysing c
			on c.SlID = #sl.SlID and c.ReportagePeriodID = #sl.ReportagePeriodID


		;with C as
		(
		  select T.SlID,
				 T.CurrentMonth,
				 T.SlID as RootID,
				 LevelOrder,
				 ReportagePeriodID
		  from #TT T
		  union all
		  select T.SlID,
				 T.CurrentMonth,
				 C.RootID,
				 T.LevelOrder,
				 T.ReportagePeriodID
		  from #TT T
			inner join C 
			  on T.ParentId = C.SlID and T.ReportagePeriodID = C.ReportagePeriodID
		)

		select  ReportagePeriodID,
				RootID,
				sum(CurrentMonth) as CurrentMonth
			into #C
		from C
		group by ReportagePeriodID,RootID



		select T.SlID,
			   T.ParentId,
			   S.CurrentMonth,
			   T.LevelOrder,
			   T.ReportagePeriodID
		into #T
		from #TT T
		left join #C as S on T.SlID = S.RootID and T.ReportagePeriodID = S.ReportagePeriodID
		order by T.ReportagePeriodID,T.SlID
		option (maxrecursion 0)


		select  EntityID,
				Libor,
				case when Libor - 2 > 0 then Libor - 2 else 0 end MonthlyRate ,
				POWER((case when Libor - 2 > 0 then Libor - 2 else 0 end)/100.0000 + 1.0000,1.0000/12.0000) - 1.000 [Root]
		into #Libor
		from
		(
		select EntityID,cast(Value as float) Libor
		from cfg.EntityCustomeField a
		join cfg.EntityCustomeFielddata b on a.EntityCustomeFieldID = b.EntityCustomeFieldID
		where a.EntityName = 'ReportagePeriod' and a.FieldName = 'LIBORRate'
		)A

		--select EntityID,Value
		--from cfg.EntityCustomeField a
		--join cfg.EntityCustomeFielddata b on a.EntityCustomeFieldID = b.EntityCustomeFieldID
		--where a.EntityName = 'ReportagePeriod' and a.FieldName = 'Rem'

	create table #BankCharge
	(
	ReportagePeriodID int,
	[Order] int,
	SlID int,
	CumulativeOpeningBalance decimal(36,10),
	InterestChargedPerMonth decimal(36,10),
	CostOfTheMonth decimal(36,10),
	[Recovery] decimal(36,10),
	CumulativeClosingBalance decimal(36,10)
	)
  
	DECLARE @ReportagePeriodIDForCursor INT,
			@Order int,
			@CumulativeOpeningBalance decimal(36,10),
			@InterestChargedPerMonth decimal(36,10),
			@CostOfTheMonth decimal(36,10),
			@Recovery decimal(36,10),
			@CumulativeClosingBalance decimal(36,10),
			@Libor decimal(36,10),
			@SlID int
  
	DECLARE CursorForT CURSOR FOR   
	SELECT a.ReportagePeriodID ,[Order],SlID
	FROM #T a
	join noc.ReportagePeriod b on a.ReportagePeriodID = b.ReportagePeriodID
	where LevelOrder = 3
	ORDER BY [Order];  
  
	OPEN CursorForT  
  
	FETCH NEXT FROM CursorForT   INTO @ReportagePeriodIDForCursor,@Order,@SlID
  
	WHILE @@FETCH_STATUS = 0  
	BEGIN  
  
		select @Libor = [Root]
		from #Libor
		where EntityID = @ReportagePeriodIDForCursor
		set @Libor= ISNULL(@Libor,0)

		select TOP 1 @CumulativeOpeningBalance = CumulativeClosingBalance
		from #BankCharge
		where [Order] < @Order and SlID = @SlID
		order by [Order] desc
		set @CumulativeOpeningBalance = ISNULL(@CumulativeOpeningBalance,0)

		set @InterestChargedPerMonth = @CumulativeOpeningBalance * @Libor

		select @CostOfTheMonth = CurrentMonth
		from #T
		where ReportagePeriodID = @ReportagePeriodIDForCursor and SlID = @SlID
		set @CostOfTheMonth = ISNULL(@CostOfTheMonth,0)

		set @Recovery = isnull(@Recovery,0)

		set @CumulativeClosingBalance = @CumulativeOpeningBalance + @InterestChargedPerMonth + @CostOfTheMonth - @Recovery

		insert into #BankCharge
		select @ReportagePeriodIDForCursor,@Order,@SlID,@CumulativeOpeningBalance,@InterestChargedPerMonth,@CostOfTheMonth,@Recovery,@CumulativeClosingBalance


		FETCH NEXT FROM CursorForT   INTO @ReportagePeriodIDForCursor,@Order,@SlID
	END   
	CLOSE CursorForT;  
	DEALLOCATE CursorForT;

	select 
		DATEPART(year,rp.EndDate) [Year],
		rp.Title ReportagePeriodTitle,
		DATEDIFF(day,startdate,enddate)+1 [CountOfDays],
		c.Libor,
		MonthlyRate ,
		[Root],
		acc.SlFullCode(a.SlID)  SlCode,
		sl.Title SlTitle,
		a.CumulativeOpeningBalance,
		a.InterestChargedPerMonth,
		a.CostOfTheMonth,
		a.Recovery,
		a.CumulativeClosingBalance,
		a.[Order],
		a.SlID,
		@CurrentPeriod CurrentPeriod,
		a.ReportagePeriodID
	from #BankCharge a
	join noc.ReportagePeriod rp on a.ReportagePeriodID = rp.ReportagePeriodID
	join acc.sl on sl.SlID = a.SlID
	left join  #Libor c on c.EntityID = a.ReportagePeriodID
	where a.CumulativeClosingBalance <> 0
	order by a.[Order],SlCode
