
-------------------------------------
CREATE   PROCEDURE NOC.RptAnalysingSlTreeLevelReview
(
    @SlTreeLevelId           INT,
    @SelectedSlTreeLevel     VARCHAR(MAX) = NULL,
    @SelectedParties     VARCHAR(MAX) = NULL,
	@FromPeriod int,
	@ToPeriod int,
	@Analysing bit,
	@CurrencyExchange bit,
	@Modification bit,
	@CashFounding bit
)
--WITH ENCRYPTION
WITH RECOMPILE
AS
	DECLARE @UserID            INT,
	        @Culture           VARCHAR(25),
	        @CultureNo         TINYINT,
			@StartDate date,
			@EndDate Date,
			@ZeroSTR varchar(10)='0000000000',
			@CurrencyReport int
	
	SET @UserID = CFG.GetuserID()
	SET @Culture = CFG.GetuserCulture() 

	select @CurrencyReport = ConfigValue
	from noc.NIOCSetting
	where ConfigKey = 'CurrencyReport'

	select @StartDate = StartDate
	from noc.ReportagePeriod
	where ReportagePeriodID = @FromPeriod

	select @EndDate = EndDate
	from noc.ReportagePeriod
	where ReportagePeriodID = @ToPeriod

	SELECT @CultureNo =ISNULL( CultureNo,1)
	FROM   CFG.CultureInfo
	WHERE  Culture = @Culture


create table #Accrue_Temp
(
slid int,
BaseCurrencyDebit decimal(30,4),
BaseCurrencyCredit decimal(30,4),
Debit decimal(30,4),
Credit decimal(30,4)
) 

select VoucherItemID,a.DlID
into #AccountLevelVoucherItem
from acc.AccountLevelVoucherItem a
join acc.dl on dl.DLID = a.DlID
where DlTypeID = 28

if @Analysing = 1
insert into #Accrue_Temp
select  slid,
	    SUM(a.BaseCurrencyDebit)     ,
	    SUM(a.BaseCurrencyCredit)    ,
		SUM(ReportCurrencyDebit)     ,
		SUM(ReportCurrencyCredit)    
 from noc.AccrueAnalysing a
 join acc.VoucherItem b
	on a.VoucherItemID = b.VoucherItemID
left join #AccountLevelVoucherItem alvi
	on alvi.VoucherItemID = b.VoucherItemID
join noc.Analysing c
	on c.AnalysingID = a.AnalysingID
join noc.ReportagePeriod d
	on d.ReportagePeriodID = c.ReportagePeriodID
where a.Status = 1
and d.StartDate >= @StartDate and d.EndDate <= @EndDate
and (@SelectedParties is null or alvi.DlID in (select value from CFG.R_FnCommaStr2Table(@SelectedParties)))
group by slid



if @CurrencyExchange = 1
insert into #Accrue_Temp
select  slid,
	    0     BaseCurrencyDebit,
	    0    BaseCurrencyCredit,
		SUM(case when a.Value > 0 then Value else 0 end)  Debit,
		SUM(case when a.Value < 0 then abs(Value) else 0 end)  Credit
 from noc.CurrencyExchange a
join noc.Analysing c
	on c.AnalysingID = a.AnalysingID
join noc.ReportagePeriod d
	on d.ReportagePeriodID = c.ReportagePeriodID
left join cfg.Party pa 
	on pa.PartyID = a.PartyID
where  d.StartDate >= @StartDate and d.EndDate <= @EndDate
and (@SelectedParties is null or pa.DlID in (select value from CFG.R_FnCommaStr2Table(@SelectedParties)))
group by slid

if @CurrencyExchange = 1
insert into #Accrue_Temp
select  ExchangeGainLoss,
	    0     BaseCurrencyDebit,
	    0    BaseCurrencyCredit,
		SUM(case when a.Value < 0 then abs(Value) else 0 end)  Debit,
		SUM(case when a.Value > 0 then Value else 0 end)  Credit
 from noc.CurrencyExchange a
join noc.Analysing c
	on c.AnalysingID = a.AnalysingID
join noc.ReportagePeriod d
	on d.ReportagePeriodID = c.ReportagePeriodID
left join cfg.Party pa 
	on pa.PartyID = a.PartyID
where  d.StartDate >= @StartDate and d.EndDate <= @EndDate
and (@SelectedParties is null or pa.DlID in (select value from CFG.R_FnCommaStr2Table(@SelectedParties)))
group by ExchangeGainLoss


if @Modification = 1
insert into #Accrue_Temp
select  c.SlID,
	    SUM(vi.Credit)     ,
	    SUM(vi.Debit)    ,
		SUM(case when vi.CurrencyID = @CurrencyReport then vi.CurrencyCredit else round(vi.Credit / ReportCurrencyRate,2) end)  ,
		SUM(case when vi.CurrencyID = @CurrencyReport then vi.CurrencyDebit else round(vi.Debit / ReportCurrencyRate,2)end)  
 from noc.Modification c
join acc.VoucherItem vi
	on vi.VoucherItemID = c.VoucherItemID
join noc.ReportagePeriod d
	on d.ReportagePeriodID = c.ReportagePeriodID
left join #AccountLevelVoucherItem dl
	on dl.VoucherItemID = c.VoucherItemID
where  d.StartDate >= @StartDate and d.EndDate <= @EndDate
and (@SelectedParties is null or dl.DlID in (select value from CFG.R_FnCommaStr2Table(@SelectedParties)))
group by c.SlID

if @Modification = 1
insert into #Accrue_Temp
select  mt.SlID,
	    SUM(BaseCurrencyDebitAccrue)     ,
	    SUM(BaseCurrencyCreditAccrue)    ,
		SUM(ReportCurrencyDebitAccrue)   ,
		SUM(ReportCurrencyCreditAccrue)  
from noc.ModifiedTopic mt
join noc.Modification m
	on m.ModificationID = mt.ModificationID
join noc.ReportagePeriod d
	on d.ReportagePeriodID = m.ReportagePeriodID
left join #AccountLevelVoucherItem dl
	on dl.VoucherItemID = m.VoucherItemID
where  d.StartDate >= @StartDate and d.EndDate <= @EndDate
and (@SelectedParties is null or dl.DlID in (select value from CFG.R_FnCommaStr2Table(@SelectedParties)))
and ToBeReported = 1
group by mt.SlID


select  slid,
		acc.SlFullCode(SlID) SlCode,
	    SUM(BaseCurrencyDebit)     BaseCurrencyDebit,
	    SUM(BaseCurrencyCredit)    BaseCurrencyCredit,
	    SUM(Debit)     Debit,
	    SUM(Credit)    Credit
into #AccrueAnalysing
 from #Accrue_Temp
group by slid

create table #Cash_Temp
(
slid int,
BaseCurrencyDebit decimal(30,4),
BaseCurrencyCredit decimal(30,4),
Debit decimal(30,4),
Credit decimal(30,4)
)

	declare @PayrollDividedOnPersonell bit ,
			@StaffDL int 

	select @PayrollDividedOnPersonell = ConfigValue
	from noc.NIOCSetting
	where ConfigKey = 'PayrollDividedOnPersonell'

	select @StaffDL = ConfigValue
	from noc.NIOCSetting
	where ConfigKey = 'StaffDL'

select * into #CashAnalysingItem
from (
select
	a.slid,
	b.DlID,
	    case when BaseCurrencyAmount > 0 then BaseCurrencyAmount else 0 end     BaseCurrencyDebit,
	    case when BaseCurrencyAmount < 0 then abs(BaseCurrencyAmount) else 0 end    BaseCurrencyCredit,
		case when a.Amount > 0 then a.Amount else 0 end   Debit,
		case when a.Amount < 0 then abs(a.Amount) else 0 end   Credit		
 from noc.CashAnalysingItem a
join noc.CashAnalysing b on a.CashAnalysingID = b.CashAnalysingID
join noc.Analysing c 	on c.AnalysingID = b.AnalysingID
join noc.ReportagePeriod d 	on d.ReportagePeriodID = c.ReportagePeriodID
join noc.CashDataCollection cdc on b.CashDataCollectionID = cdc.CashDataCollectionID
where b.Status = 1
and d.StartDate >= @StartDate and d.EndDate <= @EndDate
and cdc.CalculationID is null and cdc.CalculationResultID is null

union all

select
	a.slid,
	@StaffDL DlID,
	    case when BaseCurrencyAmount > 0 then BaseCurrencyAmount else 0 end     BaseCurrencyDebit,
	    case when BaseCurrencyAmount < 0 then abs(BaseCurrencyAmount) else 0 end    BaseCurrencyCredit,
		case when a.Amount > 0 then a.Amount else 0 end   Debit,
		case when a.Amount < 0 then abs(a.Amount) else 0 end   Credit		
 from noc.CashAnalysingItem a
join noc.CashAnalysing b on a.CashAnalysingID = b.CashAnalysingID
join noc.Analysing c 	on c.AnalysingID = b.AnalysingID
join noc.ReportagePeriod d 	on d.ReportagePeriodID = c.ReportagePeriodID
join noc.CashDataCollection cdc on b.CashDataCollectionID = cdc.CashDataCollectionID
where b.Status = 1
and d.StartDate >= @StartDate and d.EndDate <= @EndDate
and (cdc.CalculationID is not null or cdc.CalculationResultID is not null)
)a


if @Analysing = 1
insert into #Cash_Temp
select  a.slid,
	    SUM(BaseCurrencyDebit)     BaseCurrencyDebit,
	    SUM(BaseCurrencyCredit)    BaseCurrencyCredit,
		SUM(Debit)   Debit,
		SUM(Credit)   Credit
 from #CashAnalysingItem a
where (@SelectedParties is null or DlID in (select value from CFG.R_FnCommaStr2Table(@SelectedParties)))
group by a.slid

if @CashFounding = 1
insert into #Cash_Temp
select  slid,
	    SUM(BaseCurrencyDebit)     BaseCurrencyDebit,
	    SUM(BaseCurrencyCredit)    BaseCurrencyCredit,
		SUM(Debit)   Debit,
		SUM(credit)   Credit
 from NOC.CashFounding c
 join noc.ReportagePeriod d
	on d.ReportagePeriodID = c.ReportagePeriodID
where  d.StartDate >= @StartDate and d.EndDate <= @EndDate
and (@SelectedParties is null or c.DlID in (select value from CFG.R_FnCommaStr2Table(@SelectedParties)))
 group by slid

if @Modification = 1
insert into #Cash_Temp
 select m.SlID,
		sum(BaseCurrencyCreditCash) BaseCurrencyDebitCash,
		sum(BaseCurrencyDebitCash) BaseCurrencyCreditCash,
		sum(ReportCurrencyCreditCash) ReportCurrencyDebitCash,
		sum(ReportCurrencyDebitCash) ReportCurrencyCreditCash
 from noc.Modification m
 join
 (
 select ModificationID,
		sum(BaseCurrencyDebitCash) BaseCurrencyDebitCash,
		sum(BaseCurrencyCreditCash) BaseCurrencyCreditCash,
		sum(ReportCurrencyDebitCash) ReportCurrencyDebitCash,
		sum(ReportCurrencyCreditCash) ReportCurrencyCreditCash
 from noc.ModifiedTopic
 group by ModificationID
 ) mt
	on mt.ModificationID = m.ModificationID
 join noc.ReportagePeriod d
	on d.ReportagePeriodID = m.ReportagePeriodID
left join #AccountLevelVoucherItem dl
	on dl.VoucherItemID = m.VoucherItemID
where  d.StartDate >= @StartDate and d.EndDate <= @EndDate
and (@SelectedParties is null or dl.DlID in (select value from CFG.R_FnCommaStr2Table(@SelectedParties)))
 group by slid

if @Modification = 1
insert into #Cash_Temp
  select mt.SlID,
		sum(BaseCurrencyDebitCash) BaseCurrencyDebitCash,
		sum(BaseCurrencyCreditCash) BaseCurrencyCreditCash,
		sum(ReportCurrencyDebitCash) ReportCurrencyDebitCash,
		sum(ReportCurrencyCreditCash) ReportCurrencyCreditCash	
  from noc.ModifiedTopic mt
  join noc.Modification m
	on mt.ModificationID = m.ModificationID
 join noc.ReportagePeriod d
	on d.ReportagePeriodID = m.ReportagePeriodID
left join #AccountLevelVoucherItem dl
	on dl.VoucherItemID = m.VoucherItemID
where  d.StartDate >= @StartDate and d.EndDate <= @EndDate
and (@SelectedParties is null or dl.DlID in (select value from CFG.R_FnCommaStr2Table(@SelectedParties)))
and ToBeReported = 1
 group by mt.SlID

		select  slid,
				acc.SlFullCode(SlID) SlCode,
				SUM(BaseCurrencyDebit)     BaseCurrencyDebit,
				SUM(BaseCurrencyCredit)    BaseCurrencyCredit,
				SUM(Debit)     Debit,
				SUM(Credit)    Credit
		into #CashAnalysing
		from #Cash_Temp
		group by slid


create table #SlParents
(
SlID int,
Parent int
)

select  slid,
		acc.[SlParentString](a.slid) ParentsString 
into #S 
from acc.sl a

declare @MaxOrder int,
		@intFlag INT = 1

select @MaxOrder = max(LevelOrder)
from acc.SlTreeLevel

WHILE (@intFlag <= @MaxOrder)
BEGIN
	insert into #SlParents
	select  slid,
			[CFG].[GetStringPart](ParentsString,@intFlag) 
	from #S
    SET @intFlag = @intFlag + 1
END

select SlID
into #FilteredSlID
from 
(
select a.SlID
from #SlParents a
join
(
select value
from cfg.R_FnCommaStr2Table(@SelectedSlTreeLevel)
) b  on a.Parent = b.value
)A
union all
select value
from cfg.R_FnCommaStr2Table(@SelectedSlTreeLevel)

declare @StartSlTreeLevel int

select @StartSlTreeLevel = configvalue 
 from noc.niocsetting
 where configkey = 'StartSlTreeLevel'

 DECLARE @MaxCodeLength INT;

select @MaxCodeLength = sum(CodeLength) from  acc.SlTreeLevel
where LevelOrder <= (select LevelOrder from  acc.SlTreeLevel where SlTreeLevelID = @StartSlTreeLevel)

;WITH cte
AS (SELECT s.SlID,
           NULL AS ParentId,
           case when @CultureNo = 1 then s.Title else s.Title2 end Title,
		   s.SlTreeLevelID,
		   LevelOrder
    FROM ACC.SL AS s
	join acc.SlTreeLevel t
		on s.SlTreeLevelID = t.SlTreeLevelID
    WHERE s.SlID  in (select SlID 
					from  acc.SL
					where  SlTreeLevelID = @StartSlTreeLevel
					and  left(acc.SlFullCode(SlID),@MaxCodeLength) in (select distinct left(acc.SlFullCode(SlID),@MaxCodeLength) from noc.ReportHeadline))
    UNION ALL
    SELECT s.SlID,
           s.ParentID AS ParentId,
           case when @CultureNo = 1 then s.Title else s.Title2 end Title,
		   s.SlTreeLevelID,
		   t.LevelOrder
    FROM ACC.SL AS s
	join acc.SlTreeLevel t
		on s.SlTreeLevelID = t.SlTreeLevelID
        INNER JOIN cte
            ON cte.SlID = s.ParentID)

SELECT cte.SlID,
       cte.ParentId,
	   SlTreeLevelID,
	   LevelOrder,
       cte.Title,
		acc.SlFullCode(cte.SlID)  SlCode,
		c.BaseCurrencyDebit AccrueBaseCurrencyDebit,
		c.BaseCurrencyCredit AccrueBaseCurrencyCredit,
		c.Debit AccrueDebit,
		c.Credit AccrueCredit,
		d.BaseCurrencyDebit CashBaseCurrencyDebit,
		d.BaseCurrencyCredit CashBaseCurrencyCredit,
		d.Debit CashDebit,
		d.Credit CashCredit
into #TT
FROM cte 
left join #AccrueAnalysing c
	on c.SlID = cte.SlID
left join #CashAnalysing d
	on d.SlID = cte.SlID

;with C as
(
  select T.SlID,
		SlTreeLevelID,
		LevelOrder,
		AccrueBaseCurrencyDebit,
		AccrueBaseCurrencyCredit,
		AccrueDebit,
		AccrueCredit,
		CashBaseCurrencyDebit,
		CashBaseCurrencyCredit,
		CashDebit,
		CashCredit,
         T.SlID as RootID
  from #TT T
  union all
  select T.SlID,
		 T.SlTreeLevelID,
		 t.LevelOrder,
		 T.AccrueBaseCurrencyDebit,
		 T.AccrueBaseCurrencyCredit,
		 T.AccrueDebit,
		 T.AccrueCredit,
		 T.CashBaseCurrencyDebit,
		 T.CashBaseCurrencyCredit,
		 T.CashDebit,
		 T.CashCredit,
         C.RootID
  from #TT T
    inner join C 
      on T.ParentId = C.SlID
)
select T.SlID,
       T.ParentId,
	   SlTreeLevelID,
	   LevelOrder,
	   T.SlCode,
       T.Title,
		s.AccrueBaseCurrencyDebit,
		s.AccrueBaseCurrencyCredit,
		s.AccrueDebit,
		s.AccrueCredit,
		s.CashBaseCurrencyDebit,
		s.CashBaseCurrencyCredit,
		s.CashDebit,
		s.CashCredit
into #T
from #TT T
  inner join (
             select RootID,
                    sum(AccrueBaseCurrencyDebit) as AccrueBaseCurrencyDebit,
					sum(AccrueBaseCurrencyCredit) as AccrueBaseCurrencyCredit,
					sum(AccrueDebit) as AccrueDebit,
					sum(AccrueCredit) as AccrueCredit,
					sum(CashBaseCurrencyDebit) as CashBaseCurrencyDebit,
					sum(CashBaseCurrencyCredit) as CashBaseCurrencyCredit,
					sum(CashDebit) as CashDebit,
					sum(CashCredit) as CashCredit
             from C
             group by RootID
             ) as S
    on T.SlID = S.RootID
order by T.SlID
option (maxrecursion 0)

select
	    a.SlID,
        ParentId,
	    SlCode,
        Title,
		isnull(AccrueBaseCurrencyDebit,0) AccrueBaseCurrencyDebit,
		isnull(AccrueBaseCurrencyCredit,0) AccrueBaseCurrencyCredit,
		isnull(AccrueBaseCurrencyDebit,0) - isnull(AccrueBaseCurrencyCredit,0) AccrueBaseCurrencyRemain,
		isnull(AccrueDebit,0) AccrueDebit,
		isnull(AccrueCredit,0) AccrueCredit,
		isnull(AccrueDebit,0) - isnull(AccrueCredit,0) AccrueRemain,
		isnull(CashBaseCurrencyDebit,0) CashBaseCurrencyDebit,
		isnull(CashBaseCurrencyCredit,0) CashBaseCurrencyCredit,
		isnull(CashBaseCurrencyDebit,0) - isnull(CashBaseCurrencyCredit,0)  CashBaseCurrencyRemain,
		isnull(CashDebit,0) CashDebit,
		isnull(CashCredit,0) CashCredit,
		isnull(CashDebit,0) - isnull(CashCredit,0) CashRemain,
		(isnull(AccrueBaseCurrencyDebit,0) - isnull(AccrueBaseCurrencyCredit,0)) - (isnull(CashBaseCurrencyDebit,0) - isnull(CashBaseCurrencyCredit,0)) BaseCurrencyBalance,
		(isnull(AccrueDebit,0) - isnull(AccrueCredit,0)) - (isnull(CashDebit,0) - isnull(CashCredit,0)) Balance

 from #T a
 left join #FilteredSlID b
	on a.SlID = b.SlID

where 
(AccrueBaseCurrencyDebit is not null
or AccrueBaseCurrencyCredit is not null
or AccrueDebit is not null
or AccrueCredit is not null
or CashBaseCurrencyDebit is not null
or CashBaseCurrencyCredit is not null
or CashDebit is not null
or CashCredit is not null
)
and 
(
SlTreeLevelID = @SlTreeLevelId
or 
right(SlCode,10-@SlTreeLevelId) = right(@ZeroSTR,10-@SlTreeLevelId)
)
and
(
@SelectedSlTreeLevel is null
or
b.SlID is not null
)
order by SlCode
