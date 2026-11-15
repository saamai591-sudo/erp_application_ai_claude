CREATE     proc NOC.spCurrencyExchange 
(
@CalculatePeriodID int,
@ReportagePeriodID int
)
--WITH ENCRYPTION
as

BEGIN TRY

if exists(select * from NOC.ConfirmedReport where ReportagePeriodID = @ReportagePeriodID and Type = 2)
begin
	raiserror('NIOCReport.ReportOfThePeriodIsConfirmed',16,12)
	return 
end

if exists(select * from NOC.Analysing where CalculatePeriodID = @CalculatePeriodID and Type = 3)
begin
	raiserror('PeriodAndTypeDup',16,12)
	return 
end

declare @StartDate date,
		@UserID int,
		@AnalysingID int

set @UserID = cfg.GetuserID()

select @StartDate = StartDate
from noc.ReportagePeriod
where ReportagePeriodID = @CalculatePeriodID


	select VoucherItemID,p.partyid,dl.DLID
	into #Party
	from acc.AccountLevelVoucherItem alvi
	join acc.dl 
	on dl.DLID = alvi.DlID
	join cfg.party p
	on p.dlid = dl.dlid

	select VoucherItemID,p.ContractID,dl.DLID ContractDlID
	into #Contract
	from acc.AccountLevelVoucherItem alvi
	join acc.dl 
	on dl.DLID = alvi.DlID
	join cnt.contract p
	on p.dlid = dl.dlid
	where p.CompanyRoll = 1

;WITH cte
AS (	
		select a.SlID BaseSl,
				a.BasePrevoucherID,
				b.VoucherID,
				c.SlID ModifiedSl,
				c.ModificationPercent,
				a.Number,
				a.PreVoucherID,
				a.Date,
				c.ModifiedTopicID,
				c.ReportCurrencyDebitAccrue - c.ReportCurrencyCreditAccrue ReportAccrue,
				c.BaseCurrencyDebitAccrue - c.BaseCurrencyCreditAccrue BaseAccrue,
				a.ModificationID,
				a.VoucherItemID
		from noc.Modification a
		join acc.VoucherItem b 
			on a.VoucherItemID = b.VoucherItemID
		join noc.ModifiedTopic c
			on c.ModificationID = a.ModificationID
		join acc.PreVoucher pv
			on pv.PreVoucherID = a.BasePrevoucherID
		where pv.DocumentNumtypeID <> 90

		union all

		select cte.BaseSl,
				cte.BasePrevoucherID,
				cte.VoucherID,
				c.SlID ModifiedSl,
				c.ModificationPercent,
				a.Number,
				a.PreVoucherID,
				a.Date,
				cte.ModifiedTopicID,
				c.ReportCurrencyDebitAccrue - c.ReportCurrencyCreditAccrue ReportAccrue,
				c.BaseCurrencyDebitAccrue - c.BaseCurrencyCreditAccrue BaseAccrue,
				cte.ModificationID,
				cte.VoucherItemID
		from noc.Modification a
		join acc.VoucherItem b 
			on a.VoucherItemID = b.VoucherItemID
		join noc.ModifiedTopic c
			on c.ModificationID = a.ModificationID
		join cte on cte.PreVoucherID = a.BasePrevoucherID
			and cte.ModifiedSl = a.SlID
		)

select BaseSl BaseSlID,
		BasePrevoucherID,
		VoucherID,
		ModifiedSl SlID,
		ModificationPercent,
		ReportAccrue,
		BaseAccrue,
		ModificationID,
		VoucherItemID
	into #Modification
from
(
SELECT RANK() over(partition by ModifiedTopicID order by date desc) Rno,cte.*
FROM cte 
)A
where Rno = 1

select CashAnalysingItemID,b.SlID,b.ModificationPercent / 100  ModificationPercent
into #CashAndExchangeModification
from noc.CashAndExchangeModification a
join #Modification b
	on a.ModificationID = b.ModificationID	

select VoucherID,PrevoucherID,SlID,DLID,ReportagePeriodID,sum(ReportAmount) ReportAmount,sum(BaseAmount) BaseAmount,MAX(ReportCurrencyRate) ReportCurrencyRate
into #VoucherItem
from 
(
select  c.VoucherID,
		vp.PrevoucherID,
		case when m.VoucherItemID is null then c.SlID else m.SlID end SlID,
		dl.DLID,
		co.ContractID,
		case when m.VoucherItemID is null then
			ROUND(case when pvi.PreVoucherItemID is not null then pvi.Debit - pvi.Credit else c.Debit - c.Credit end / ReportCurrencyRate , 2)
			else m.ReportAccrue
			end ReportAmount, 
		case when m.VoucherItemID is null then
			case when pvi.PreVoucherItemID is not null then pvi.Debit - pvi.Credit else c.Debit - c.Credit end 
			else m.BaseAccrue
			end BaseAmount,
		aa.ReportCurrencyRate,
		an.ReportagePeriodID
from  acc.VoucherItem c
join noc.AccrueAnalysing aa
	on aa.VoucherItemID = c.VoucherItemID
join noc.Analysing an 
	on an.AnalysingID = aa.AnalysingID
left join acc.VoucherPrevoucher vp
	on vp.VoucherItemID = c.VoucherItemID
left join acc.PreVoucherItem pvi
	on pvi.PreVoucherItemID = vp.PrevoucherItemID
left join #Party dl 
	on dl.VoucherItemID = c.VoucherItemID
left join #Contract co
	on co.VoucherItemID = c.VoucherItemID
left join #Modification m
	on m.VoucherItemID = c.VoucherItemID
	and isnull(BasePrevoucherID,0)= isnull(pvi.PrevoucherID,0)
where aa.Status = 1
and ReportCurrencyRate > 0
)A
group by VoucherID,PrevoucherID,SlID,DLID,ReportagePeriodID

select  b.ReportagePeriodID,b.StartDate,d.VoucherID CashVoucherID,
		c.DlID,c.ContractID,e.SlID,e.AccruePreVoucherID,e.AccrueVoucherID,
		e.BaseCurrencyAmount,e.Amount,e.CashAnalysingItemID,Status,CalculatePeriodID,
		ReportCurrencyRate,EffectiveDate
into #Analysing
from noc.Analysing a
join noc.ReportagePeriod b
	on a.ReportagePeriodID = b.ReportagePeriodID
join noc.CashAnalysing c
	on c.AnalysingID = a.AnalysingID
join noc.CashDataCollection d
	on d.CashDataCollectionID = c.CashDataCollectionID
join noc.CashAnalysingItem e
	on e.CashAnalysingID = c.CashAnalysingID

select  a.SlID,
		a.DlID,ToDate,CurrencyRate,a.ReportagePeriodID,
		Debit - credit Amount,
		BaseCurrencyDebit - BaseCurrencyCredit BaseAmount,
		ecf.AccrueVoucherID,
		ecf1.CashVoucherID,
		ou.AccruePreVoucherID,
		ou.ContractID
into #CashFounding
from NOC.CashFounding a
left join 
(
select b.EntityID,b.LookupDataItemID AccrueVoucherID
from cfg.EntityCustomeField a
join cfg.EntityCustomeFieldData b
	on a.EntityCustomeFieldID = b.EntityCustomeFieldID
where a.EntityName = 'CashFounding'
and a.FieldName = 'ReferenceNumber'
) ecf on ecf.EntityID = a.CashFoundingID
left join 
(
select b.EntityID,b.LookupDataItemID CashVoucherID
from cfg.EntityCustomeField a
join cfg.EntityCustomeFieldData b
	on a.EntityCustomeFieldID = b.EntityCustomeFieldID
where a.EntityName = 'CashFounding'
and a.FieldName = 'ReferenceNumber1'
) ecf1 on ecf1.EntityID = a.CashFoundingID
outer apply
(select top 1 *
from #Analysing n
	where n.DlID = a.DlID
	and n.SlID = a.SlID
	and ecf1.CashVoucherID = n.CashVoucherID
	and ecf.AccrueVoucherID = n.AccrueVoucherID
)ou

create table #SumPayed
(
SlID int,
BaseCurrencyAmount decimal(30,4),
Amount decimal(30,4), 
AccruePreVoucherID decimal(30,4),
AccrueVoucherID decimal(30,4),
DlID int
)

select pii.PurchaseInvoiceID,cs.ContractID
into #PurchaseInvoice_Contract
from vnd.PurchaseInvoiceItem pii
join cnt.ContractSubject cs on cs.ContractSubjectID = pii.ContractSubjectID
group by pii.PurchaseInvoiceID,cs.ContractID

insert into  #SumPayed
select   SlID
		,sum(BaseCurrencyAmount)
		,sum(Amount)
		,AccruePreVoucherID
		,AccrueVoucherID
		,DlID
from(
		select 
			case when ce.CashAnalysingItemID is null then a.SlID else ce.SlID end  SlID,
			case when ce.CashAnalysingItemID is null then a.BaseCurrencyAmount else ROUND(a.BaseCurrencyAmount * ce.ModificationPercent , 0) end BaseCurrencyAmount,
			case when ce.CashAnalysingItemID is null then a.Amount else ROUND(a.Amount * ce.ModificationPercent , 2)   end Amount,
			AccruePreVoucherID,
			a.AccrueVoucherID,
			a.DlID,
			a.ContractID
		from #Analysing a
		left join #CashAndExchangeModification ce
			on ce.CashAnalysingItemID = a.CashAnalysingItemID
		where a.StartDate < @StartDate
		and a.Status = 1

		union all

		select 
			C.SlID,
			round(a.Net * c.Share,0) BaseCurrencyAmount,
			round(round(a.Net /  	ou.ReportCurrencyRate , 2) * c.Share,2) Amount,
			AccruePreVoucherID,
			c.VoucherID,
			ri.DlID,
			pc.ContractID
		from vnd.ReturnInvoiceItem a
		JOIN VND.PurchaseInvoiceItem B
			ON A.PurchaseInvoiceItemID = B.PurchaseInvoiceItemID
		JOIN NOC.VWTraceOfPurchaseInvoice C
			ON C.PurchaseInvoiceID = b.PurchaseInvoiceID
		join vnd.ReturnInvoice ri 
			on ri.ReturnInvoiceID = a.ReturnInvoiceID
		join acc.VWVoucherPrevoucher vp
			on vp.PrevoucherID = ri.PreVoucherID
		outer apply
		(
		select top 1 *
		from #VoucherItem
		where VoucherID = vp.VoucherID
		)ou
		join noc.ReportagePeriod r
			on r.ReportagePeriodID = ou.ReportagePeriodID
		left join #PurchaseInvoice_Contract pc
			on pc.PurchaseInvoiceID = b.PurchaseInvoiceID
		where  r.StartDate < @StartDate

		union all

		select 
			a.SlID,
			BaseAmount,
			Amount,
			a.AccruePreVoucherID,
			a.AccrueVoucherID,
			a.DlID,
			a.ContractID
		from #CashFounding a
		join noc.ReportagePeriod b
			on a.ReportagePeriodID = b.ReportagePeriodID
		where b.StartDate < @StartDate
)a
group by 
	SlID,
	AccruePreVoucherID,
	AccrueVoucherID,
	DlID,
	ContractID



create table #CashAnalysing
(
	RowIndex int not null,
	AccruePreVoucherID int,
	AccrueVoucherID int,
	CashVoucherID int,
	SlID int,
	PartyID int,
	DlID int,
	ContractID int,
	ReportCurrencyRate decimal(30,4),
	BaseCurrencyPayed decimal(30,4),
	Payed decimal(30,4),
	BaseCurrencyRunningTotalPayed decimal(30,4),
	RunningTotalPayed decimal(30,4)
)

insert into #CashAnalysing (RowIndex,AccruePreVoucherID,AccrueVoucherID,CashVoucherID,SlID,PartyID,DlID,ContractID,ReportCurrencyRate,BaseCurrencyPayed,Payed)
select 
	ROW_NUMBER() over(order by AccrueVoucherID,CashVoucherID,SlID,EffectiveDate) RowIndex,
	AccruePreVoucherID,
	AccrueVoucherID,
	CashVoucherID,
	SlID,
	partyid,
	DlID,
	ContractID,
	a.ReportCurrencyRate,
	BaseCurrencyAmount,
	Amount		
from
(
select 
	case when ce.CashAnalysingItemID is null then a.BaseCurrencyAmount else ROUND(a.BaseCurrencyAmount * ce.ModificationPercent , 0) end BaseCurrencyAmount,
	case when ce.CashAnalysingItemID is null then a.Amount else ROUND(a.Amount * ce.ModificationPercent , 2)   end Amount,
	case when ce.CashAnalysingItemID is null then a.SlID else ce.SlID end SlID, 
	a.ReportCurrencyRate,
	a.AccrueVoucherID,
	pa.partyid,
	pa.DlID,
	a.AccruePreVoucherID,
	a.CashVoucherID,
	a.EffectiveDate,
	a.ContractID
from #Analysing a
left join cfg.Party pa 
	on pa.DlID = a.dlid
left join #CashAndExchangeModification ce
	on ce.CashAnalysingItemID = a.CashAnalysingItemID
where a.CalculatePeriodID = @CalculatePeriodID
and a.Status = 1


union all

select 
	round(a.Net * c.Share,0) BaseCurrencyAmount,
	round(round(a.Net / ou.ReportCurrencyRate , 2) * c.Share,2) Amount,
	C.SlID,
	ou.ReportCurrencyRate,
	c.VoucherID,
	p.partyid,
	p.DlID,
	c.AccruePreVoucherID,
	c.VoucherID,
	ri.Date,
	pc.ContractID
from vnd.ReturnInvoiceItem a
JOIN VND.PurchaseInvoiceItem B
	ON A.PurchaseInvoiceItemID = B.PurchaseInvoiceItemID
JOIN NOC.VWTraceOfPurchaseInvoice C
	ON C.PurchaseInvoiceID = b.PurchaseInvoiceID
join vnd.ReturnInvoice ri
	on ri.ReturnInvoiceID = a.ReturnInvoiceID
join acc.VWVoucherPrevoucher vp
	on vp.PrevoucherID = ri.PreVoucherID
outer apply
(
select top 1 *
from #VoucherItem
where VoucherID = vp.VoucherID
)ou
join cfg.Party p
	on p.DlID = ri.DlID
left join #PurchaseInvoice_Contract pc
	on pc.PurchaseInvoiceID = b.PurchaseInvoiceID
where ou.ReportagePeriodID = @CalculatePeriodID


union all

select 
	BaseAmount,
	Amount,
	a.SlID, 
	a.CurrencyRate,
	a.AccrueVoucherID,
	pa.partyid,
	a.DlID,
	a.AccruePreVoucherID,
	a.CashVoucherID,
	a.ToDate,
	a.ContractID
from #CashFounding a
join cfg.Party pa on pa.DlID = a.DlID
where a.ReportagePeriodID = @CalculatePeriodID

)A

;with cte
as (
select RowIndex, sum(BaseCurrencyPayed) over(partition by SlID,
															AccruePreVoucherID,
															AccrueVoucherID
															order by RowIndex) BaseCurrencyRunningTotalPayed,	
					sum(Payed) over(partition by SlID,
												AccruePreVoucherID,
												AccrueVoucherID
												order by RowIndex) RunningTotalPayed
from #CashAnalysing
)

update p
set BaseCurrencyRunningTotalPayed = a.BaseCurrencyRunningTotalPayed,							
	RunningTotalPayed = a.RunningTotalPayed
from cte a
join #CashAnalysing p
on a.RowIndex = p.RowIndex

select  
		c.SlID,
		a.PartyID,
		a.DlID,
		a.ContractID,
		a.RowIndex,
		a.Payed,
		isnull(e.Amount,0) A,
		isnull(a.RunningTotalPayed ,0)B,
		c.BaseAmount C1,
		isnull(e.BaseCurrencyAmount,0) + isnull(a.BaseCurrencyRunningTotalPayed,0) C2,
		c.BaseAmount - (isnull(e.BaseCurrencyAmount,0) + isnull(a.BaseCurrencyRunningTotalPayed,0)) c3,
		round((c.BaseAmount - (isnull(e.BaseCurrencyAmount,0) + isnull(a.BaseCurrencyRunningTotalPayed,0))) / a.ReportCurrencyRate,2) C,
		(c.ReportAmount  ) D,
		isnull(ce.value , 0) E,
		isnull(e.Amount,0) + isnull(a.RunningTotalPayed ,0)
		+
		round((c.BaseAmount - (isnull(e.BaseCurrencyAmount,0) + isnull(a.BaseCurrencyRunningTotalPayed,0))) / a.ReportCurrencyRate,2)
		-
		(c.ReportAmount  + isnull(ce.value , 0)) Value,
		a.CashVoucherID,
		a.AccruePreVoucherID,
		a.AccrueVoucherID,
		a.ReportCurrencyRate
	into #CurrencyExchange
	from #CashAnalysing a
	join #VoucherItem c
		on c.VoucherID = a.AccrueVoucherID
		and isnull(c.PreVoucherID,0) = isnull(a.AccruePreVoucherID,0)
		and c.SlID = a.SlID
		and isnull(c.DLID,0) = isnull(a.DLID,0)
	left join #SumPayed e
		on e.SlID = a.SlID
		and isnull(e.AccruePreVoucherID,0) = isnull(a.AccruePreVoucherID,0)
		and e.AccrueVoucherID = a.AccrueVoucherID
		and e.DlID = a.DlID
	left join
	(
	select OriginSlID,AccruePreVoucherID,PartyID,AccrueVoucherID,sum(value) value
	from  NOC.CurrencyExchange a
	join noc.Analysing b on a.AnalysingID = b.AnalysingID
	where b.CalculatePeriodID < @CalculatePeriodID
	group by OriginSlID,AccruePreVoucherID,PartyID,AccrueVoucherID
	)ce
		on ce.OriginSlID = a.SlID
		and isnull(ce.AccruePreVoucherID,0) = isnull(a.AccruePreVoucherID,0)
		and isnull(ce.PartyID,0) = isnull(a.PartyID,0)
		and ce.AccrueVoucherID = a.AccrueVoucherID
	order by RowIndex

	update b	
	set Value = 
				b.Value - isnull((select top 1 Value
				from #CurrencyExchange a1
				where a1.SlID  = b.SlID
				and isnull(a1.AccruePreVoucherID,0) = isnull(b.AccruePreVoucherID,0)
				and a1.AccrueVoucherID = b.AccrueVoucherID
				and a1.PartyID = b.PartyID
				and a1.RowIndex < b.RowIndex
				order by RowIndex desc),0) 
	from  #CurrencyExchange b


		
	select c.AccruePreVoucherID,c.SlID,c.DlID,a.ReportAmount , b.Amount , c.Value,a.ReportAmount - b.Amount + c.Value Diff
	into #Diff
	from 
	(
		select PrevoucherID,SlID,DLID,sum(BaseAmount) BaseAmount,sum(ReportAmount)  ReportAmount
		from #VoucherItem
		group by PrevoucherID,SlID,DLID
	)a
	left join 
	(
		select AccruePreVoucherID,SlID,DlID,SUM(BaseCurrencyAmount)  BaseCurrencyAmount,SUM(Amount) Amount
		from noc.CashAnalysing a
		join noc.CashAnalysingItem b
			on a.CashAnalysingID = b.CashAnalysingID
		join noc.Analysing c
			on c.AnalysingID = a.AnalysingID
		where ReportagePeriodID <= @CalculatePeriodID
		group by AccruePreVoucherID,SlID,DlID
	)b  on  a.PrevoucherID = b.AccruePreVoucherID
		and a.BaseAmount = b.BaseCurrencyAmount
		and a.SlID = b.SlID
		and isnull(a.DLID,0) = ISNULL(b.DlID,0)
	left join 
	(
		select AccruePreVoucherID,SlID,DlID,SUM(Value) Value
		from
		(
			select AccruePreVoucherID,OriginSlID SlID,DlID,SUM(Value) Value
			from noc.CurrencyExchange a
			left join cfg.Party 
				on Party.PartyID = a.PartyID
			group by AccruePreVoucherID,OriginSlID,DlID

			union all

			select AccruePreVoucherID,SlID,DlID,SUM(Value) Value
			from #CurrencyExchange
			group by AccruePreVoucherID,SlID,DlID
		)a
		group by AccruePreVoucherID,SlID,DlID
	)c
		on  a.PrevoucherID = c.AccruePreVoucherID
		and a.SlID = c.SlID
		and isnull(a.dlid,0) =  isnull(c.dlid,0) 
	where a.ReportAmount <> isnull(b.Amount,0) - isnull(c.Value,0)



	select   ROW_NUMBER() over(partition by a.AccruePreVoucherID,a.SlID,a.dlid order by abs(a.value) desc) Rno
			,a.RowIndex
			,b.Diff
		into #Temp
	from #CurrencyExchange a
	join #Diff b 
		on a.AccruePreVoucherID = b.AccruePreVoucherID
		and a.SlID = b.SlID
		and isnull(a.dlid,0) =  isnull(b.dlid,0) 


	update a
	set Value =  Value - Diff 
	from #CurrencyExchange a
	join #Temp b
		on a.RowIndex = b.RowIndex
		and b.Rno = 1

			
	select  
			b.SlID OriginSlID,
			b.SlID,
			rh.ProfitAndLossSlID [ExchangeGainLoss],
			b.Value,
			b.PartyID ,
			b.ContractID,
			b.CashVoucherID ,
			AccruePreVoucherID ,
			AccrueVoucherID
			into #ValueTemp
	from  #CurrencyExchange b
	join noc.ReportHeadline rh
		on rh.SlID = b.SlID
	where b.Value <> 0



	INSERT INTO [NOC].[Analysing]
				([ReportagePeriodID]
				,[Type]
				,[Creator]
				,[CreationDate]
				,[LastEditor]
				,[LastEditionDate]
				,[Version]
				,CalculatePeriodID)
	select 
				@ReportagePeriodID
				,3
				,@UserID
				,GETDATE()
				,@UserID
				,GETDATE()
				,0
				,@CalculatePeriodID
	set @AnalysingID = SCOPE_IDENTITY()

INSERT INTO [NOC].[CurrencyExchange]
			([AnalysingID]
			,[RowIndex]
			,[SlID]
			,[ExchangeGainLoss]
			,[Value]
			,[Creator]
			,[CreationDate]
			,[LastEditor]
			,[LastEditionDate]
			,[Version]
			,PartyID
			,CashVoucherID
			,AccruePreVoucherID
			,OriginSlID
			,AccrueVoucherID
			,ContractID)
select		@AnalysingID
			,ROW_NUMBER() over(order by CashVoucherID)
			,[SlID]
			,[ExchangeGainLoss]
			,SUM([Value])
			,@UserID
			,GETDATE()
			,@UserID
			,GETDATE()
			,0
			,PartyID
			,CashVoucherID
			,AccruePreVoucherID	
			,OriginSlID
			,AccrueVoucherID
			,ContractID
from  #ValueTemp
group by
		SlID,
		PartyID,
		ContractID,
		CashVoucherID,
		AccruePreVoucherID,
		ExchangeGainLoss,
		OriginSlID,
		AccrueVoucherID


	exec NOC.spGetCurrencyExchangeData @AnalysingID

END TRY
BEGIN CATCH

	DECLARE @ErrorMessage NVARCHAR(4000);
	DECLARE @ErrorSeverity INT;
	DECLARE @ErrorState INT;

	SELECT 
		@ErrorMessage = ERROR_MESSAGE(),
		@ErrorSeverity = ERROR_SEVERITY(),
		@ErrorState = ERROR_STATE();

	
	RAISERROR (@ErrorMessage, -- Message text.
				@ErrorSeverity, -- Severity.
				@ErrorState -- State.
				);
				   
END CATCH
