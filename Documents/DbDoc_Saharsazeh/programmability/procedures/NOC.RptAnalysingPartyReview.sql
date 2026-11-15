
-------------------------------------
create   proc [NOC].RptAnalysingPartyReview
(
	@SelectedSlTreeLevel     VARCHAR(MAX) = NULL,
	@SelectedContracts     VARCHAR(MAX) = NULL,
	@FromPeriod int = 1,
	@ToPeriod int = 1,
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
dlid int,
BaseCurrencyDebit decimal(30,4),
BaseCurrencyCredit decimal(30,4),
Debit decimal(30,4),
Credit decimal(30,4)
) 

select VoucherItemID,DL.DLID
into #Party
from acc.AccountLevelVoucherItem a
join acc.DL on dl.DLID = a.DlID
join acc.DlType dt on dt.DlTypeID = dl.DlTypeID
where dt.Code = 103

select VoucherItemID,DL.DLID
into #Contract
from acc.AccountLevelVoucherItem a
join 
(
select value DLID from CFG.R_FnCommaStr2Table(@SelectedContracts)
)DL on dl.DLID = a.DlID

select ContractID
into #Contract2
from cnt.Contract a
join 
(
select value DLID from CFG.R_FnCommaStr2Table(@SelectedContracts)
)DL on dl.DLID = a.DlID

if @Analysing = 1
insert into #Accrue_Temp
select  slid,
		alvi.DLID,
	    SUM(a.BaseCurrencyDebit)     ,
	    SUM(a.BaseCurrencyCredit)    ,
		SUM(a.ReportCurrencyDebit) ,
		SUM(a.ReportCurrencyCredit)
 from noc.AccrueAnalysing a
 join acc.VoucherItem b
	on a.VoucherItemID = b.VoucherItemID
 join #Party alvi 
	on alvi.VoucherItemID = b.VoucherItemID  
 join noc.Analysing c
	on c.AnalysingID = a.AnalysingID
 join noc.ReportagePeriod d
	on d.ReportagePeriodID = c.ReportagePeriodID
 left join #Contract co
	on co.VoucherItemID = b.VoucherItemID
where a.Status = 1
and d.StartDate >= @StartDate and d.EndDate <= @EndDate
and (@SelectedContracts is null or co.VoucherItemID is not null)
group by slid,alvi.DLID

if @CurrencyExchange = 1
insert into #Accrue_Temp
select  slid,pa.DlID,
	    0     BaseCurrencyDebit,
	    0    BaseCurrencyCredit,
		SUM(case when a.Value > 0 then Value else 0 end)  Debit,
		SUM(case when a.Value < 0 then abs(Value) else 0 end)  Credit
 from noc.CurrencyExchange a
 join cfg.Party pa on pa.PartyID = a.PartyID
join noc.Analysing c
	on c.AnalysingID = a.AnalysingID
join noc.ReportagePeriod d
	on d.ReportagePeriodID = c.ReportagePeriodID
left join #Contract2 co
	on co.ContractID = a.ContractID
where  d.StartDate >= @StartDate and d.EndDate <= @EndDate and a.PartyID is not null
and (@SelectedContracts is null or co.ContractID is not null)
group by slid,pa.DlID


if @CurrencyExchange = 1
insert into #Accrue_Temp
select  ExchangeGainLoss,pa.DlID,
	    0     BaseCurrencyDebit,
	    0    BaseCurrencyCredit,
		SUM(case when a.Value < 0 then Value else 0 end)  Debit,
		SUM(case when a.Value > 0 then abs(Value) else 0 end)  Credit
 from noc.CurrencyExchange a
 join cfg.Party pa on pa.PartyID = a.PartyID
join noc.Analysing c
	on c.AnalysingID = a.AnalysingID
join noc.ReportagePeriod d
	on d.ReportagePeriodID = c.ReportagePeriodID
left join #Contract2 co
	on co.ContractID = a.ContractID
where  d.StartDate >= @StartDate and d.EndDate <= @EndDate and a.PartyID is not null
and ExchangeGainLoss is not null
and (@SelectedContracts is null or co.ContractID is not null)
group by ExchangeGainLoss,pa.DlID

if @Modification = 1
insert into #Accrue_Temp
select  c.SlID,dl.DLID,
	    SUM(vi.Credit)     BaseCurrencyDebit,
	    SUM(vi.Debit)    BaseCurrencyCredit,
		SUM(case when vi.CurrencyID = @CurrencyReport then vi.CurrencyCredit else round(vi.Credit / ReportCurrencyRate,2) end)  Debit,
		SUM(case when vi.CurrencyID = @CurrencyReport then vi.CurrencyDebit else round(vi.Debit / ReportCurrencyRate,2) end)  Credit
 from noc.Modification c
join acc.VoucherItem vi
	on vi.VoucherItemID = c.VoucherItemID
join noc.ReportagePeriod d
	on d.ReportagePeriodID = c.ReportagePeriodID
join #Party dl on dl.VoucherItemID = vi.VoucherItemID  
 left join #Contract co
	on co.VoucherItemID = vi.VoucherItemID
where  d.StartDate >= @StartDate and d.EndDate <= @EndDate
and (@SelectedContracts is null or co.VoucherItemID is not null)
group by c.SlID,dl.DLID

if @Modification = 1
insert into #Accrue_Temp
select  mt.SlID,dl.DLID,
	    SUM(BaseCurrencyDebitAccrue)     BaseCurrencyDebit,
	    SUM(BaseCurrencyCreditAccrue)    BaseCurrencyCredit,
		SUM(ReportCurrencyDebitAccrue)   Debit,
		SUM(ReportCurrencyCreditAccrue)  Credit
from noc.ModifiedTopic mt
join noc.Modification m
	on m.ModificationID = mt.ModificationID
join noc.ReportagePeriod d
	on d.ReportagePeriodID = m.ReportagePeriodID
join #Party dl on dl.VoucherItemID = m.VoucherItemID  
 left join #Contract co
	on co.VoucherItemID = m.VoucherItemID
where  d.StartDate >= @StartDate and d.EndDate <= @EndDate and ToBeReported = 1
and (@SelectedContracts is null or co.VoucherItemID is not null)
group by mt.SlID,dl.DLID

select  slid,DlID,
	    SUM(BaseCurrencyDebit)     BaseCurrencyDebit,
	    SUM(BaseCurrencyCredit)    BaseCurrencyCredit,
	    SUM(Debit)     Debit,
	    SUM(Credit)    Credit
into #AccrueAnalysing
 from #Accrue_Temp
group by slid,DlID

	declare @PayrollDividedOnPersonell bit ,
			@StaffDL int 

	select @PayrollDividedOnPersonell = ConfigValue
	from noc.NIOCSetting
	where ConfigKey = 'PayrollDividedOnPersonell'

	select @StaffDL = ConfigValue
	from noc.NIOCSetting
	where ConfigKey = 'StaffDL'

create table #Cash_Temp
(
slid int,
dlid int,
BaseCurrencyDebit decimal(30,4),
BaseCurrencyCredit decimal(30,4),
Debit decimal(30,4),
Credit decimal(30,4)
)



select * into #Temp_CashAnalysing from 
(
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
left join #Contract2 co
	on co.ContractID = b.ContractID
where b.Status = 1
and d.StartDate >= @StartDate and d.EndDate <= @EndDate
and cdc.CalculationID is null and cdc.CalculationResultID is null
and (@SelectedContracts is null or co.ContractID is not null)
union all

select
	a.slid,
	case when @PayrollDividedOnPersonell = 0 then @StaffDL else b.DlID end DlID,
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
and @SelectedContracts is null
)a

if @Analysing = 1
insert into #Cash_Temp
select  slid, DlID,SUM(BaseCurrencyDebit) BaseCurrencyDebit,SUM(BaseCurrencyCredit) BaseCurrencyCredit,SUM(Debit) Debit,SUM(Credit) Credit
from #Temp_CashAnalysing where DlID is not null
group by slid,DlID

if @CashFounding = 1
insert into #Cash_Temp
select  slid,DlID,
	    SUM(BaseCurrencyDebit)     BaseCurrencyDebit,
	    SUM(BaseCurrencyCredit)    BaseCurrencyCredit,
		SUM(Debit)   Debit,
		SUM(credit)   Credit
 from NOC.CashFounding c
 join noc.ReportagePeriod d
	on d.ReportagePeriodID = c.ReportagePeriodID
where  d.StartDate >= @StartDate and d.EndDate <= @EndDate
and @SelectedContracts is null
 group by slid,DlID

if @Modification = 1
insert into #Cash_Temp
 select m.SlID,dl.DLID,
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
join #Party dl on dl.VoucherItemID = m.VoucherItemID  
left join #Contract co on co.VoucherItemID = m.VoucherItemID
where  d.StartDate >= @StartDate and d.EndDate <= @EndDate
and (@SelectedContracts is null or co.VoucherItemID is not null)
 group by slid,dl.DLID

if @Modification = 1
insert into #Cash_Temp
  select mt.SlID,dl.DLID,
		sum(BaseCurrencyDebitCash) BaseCurrencyDebitCash,
		sum(BaseCurrencyCreditCash) BaseCurrencyCreditCash,
		sum(ReportCurrencyDebitCash) ReportCurrencyDebitCash,
		sum(ReportCurrencyCreditCash) ReportCurrencyCreditCash	
  from noc.ModifiedTopic mt
  join noc.Modification m
	on mt.ModificationID = m.ModificationID
 join noc.ReportagePeriod d
	on d.ReportagePeriodID = m.ReportagePeriodID
join #Party dl on dl.VoucherItemID = m.VoucherItemID   
left join #Contract co on co.VoucherItemID = m.VoucherItemID
where  d.StartDate >= @StartDate and d.EndDate <= @EndDate and ToBeReported = 1
and (@SelectedContracts is null or co.VoucherItemID is not null)
 group by mt.SlID,dl.DLID

		select  slid,dlid,
				acc.SlFullCode(SlID) SlCode,
				SUM(BaseCurrencyDebit)     BaseCurrencyDebit,
				SUM(BaseCurrencyCredit)    BaseCurrencyCredit,
				SUM(Debit)     Debit,
				SUM(Credit)    Credit
		into #CashAnalysing
		from #Cash_Temp
		group by slid,dlid






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

select  slid,dlid,
		sum(AccrueBaseCurrencyDebit) AccrueBaseCurrencyDebit,
		sum(AccrueBaseCurrencyCredit) AccrueBaseCurrencyCredit,
		sum(AccrueDebit) AccrueDebit,
		sum(AccrueCredit) AccrueCredit,
		sum(CashBaseCurrencyDebit) CashBaseCurrencyDebit,
		sum(CashBaseCurrencyCredit) CashBaseCurrencyCredit,
		sum(CashDebit) CashDebit,
		sum(CashCredit) CashCredit
into #Dl
FROM 
(
select slid,dlid,
		c.BaseCurrencyDebit AccrueBaseCurrencyDebit,
		c.BaseCurrencyCredit AccrueBaseCurrencyCredit,
		c.Debit AccrueDebit,
		c.Credit AccrueCredit,
		0 CashBaseCurrencyDebit,
		0 CashBaseCurrencyCredit,
		0 CashDebit,
		0 CashCredit
from #AccrueAnalysing c
union all
select  slid,dlid,
		0 AccrueBaseCurrencyDebit,
		0 AccrueBaseCurrencyCredit,
		0 AccrueDebit,
		0 AccrueCredit,
		d.BaseCurrencyDebit CashBaseCurrencyDebit,
		d.BaseCurrencyCredit CashBaseCurrencyCredit,
		d.Debit CashDebit,
		d.Credit CashCredit
from #CashAnalysing d
)a
group by slid,dlid


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
		   s.SlTreeLevelID,
		   LevelOrder
    FROM ACC.SL AS s
	join acc.SlTreeLevel t
		on s.SlTreeLevelID = t.SlTreeLevelID
    WHERE s.SlID in (select SlID 
					from  acc.SL
					where SlTreeLevelID = @StartSlTreeLevel
					and left(acc.SlFullCode(SlID),@MaxCodeLength) in (select distinct left(acc.SlFullCode(SlID),@MaxCodeLength) from noc.ReportHeadline))
    UNION ALL
    SELECT s.SlID,
           s.ParentID AS ParentId,
		   s.SlTreeLevelID,
		   t.LevelOrder
    FROM ACC.SL AS s
	join acc.SlTreeLevel t
		on s.SlTreeLevelID = t.SlTreeLevelID
        INNER JOIN cte
            ON cte.SlID = s.ParentID)
SELECT  cte.SlID,
        cte.ParentId,
	    SlTreeLevelID,
	    LevelOrder,
		acc.SlFullCode(cte.SlID)  SlCode,
		dlid,
		AccrueBaseCurrencyDebit,
		AccrueBaseCurrencyCredit,
		AccrueDebit,
		AccrueCredit,
		CashBaseCurrencyDebit,
		CashBaseCurrencyCredit,
		CashDebit,
		CashCredit
into #TT
FROM cte 
 join #Dl dl on cte.SlID = dl.slid



select
	    a.SlID,
        ParentId,
	    SlCode,
		dlid,
		AccrueBaseCurrencyDebit,
		AccrueBaseCurrencyCredit,
		AccrueDebit,
		AccrueCredit,
		CashBaseCurrencyDebit,
		CashBaseCurrencyCredit,
		CashDebit,
		CashCredit
		into #a
 from #TT a
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
@SelectedSlTreeLevel is null
or
b.SlID is not null
)


select   a.*
		,dl.Code
		,case when @CultureNo = 1 then dl.Title else dl.Title2 end Title
from (
select 
		dlid,
		isnull(sum(AccrueBaseCurrencyDebit),0) AccrueBaseCurrencyDebit,
		isnull(sum(AccrueBaseCurrencyCredit),0)  AccrueBaseCurrencyCredit,
		isnull(sum(AccrueBaseCurrencyDebit),0)  - isnull(sum(AccrueBaseCurrencyCredit),0)  AccrueBaseCurrencyRemain,

		isnull(sum(AccrueDebit),0)  AccrueDebit,
		isnull(sum(AccrueCredit),0)  AccrueCredit,
		isnull(sum(AccrueDebit),0)  - isnull(sum(AccrueCredit),0)  AccrueRemain,

		isnull(sum(CashBaseCurrencyDebit),0)  CashBaseCurrencyDebit,
		isnull(sum(CashBaseCurrencyCredit),0)  CashBaseCurrencyCredit,
		isnull(sum(CashBaseCurrencyDebit),0)   - isnull(sum(CashBaseCurrencyCredit),0)   CashBaseCurrencyRemain,

		isnull(sum(CashDebit),0)  CashDebit,
		isnull(sum(CashCredit),0)  CashCredit,
		isnull(sum(CashDebit),0)  - isnull(sum(CashCredit),0)  CashRemain,

		(isnull(sum(AccrueBaseCurrencyDebit),0)  - isnull(sum(AccrueBaseCurrencyCredit),0))  - (isnull(sum(CashBaseCurrencyDebit),0)   - isnull(sum(CashBaseCurrencyCredit),0) ) BaseCurrencyBalance,
		(isnull(sum(AccrueDebit),0)  - isnull(sum(AccrueCredit),0) ) - (isnull(sum(CashDebit),0)  - isnull(sum(CashCredit),0) ) Balance

		from #a 
group by dlid

)a
join acc.dl on dl.DLID = a.dlid 
