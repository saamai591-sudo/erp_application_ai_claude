
CREATE   PROCEDURE NOC.RptCashAnalysingDetailReview
(
    @SelectedSlTreeLevel     VARCHAR(MAX) = NULL,
    @SelectedParties     VARCHAR(MAX) = NULL,
	@SelectedContracts     VARCHAR(MAX) = NULL,
	@FromPeriod int,
	@ToPeriod int,
	@Analysing bit,
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
			@BasePrecision int,
			@DateType TINYINT,
            @DateFormat VARCHAR(10)
	
	SET @UserID = CFG.GetuserID()
	SET @Culture =  CFG.GetuserCulture() 
	set @BasePrecision = cfg.GetBaseCurrencyPrecision()

	select @StartDate = StartDate
	from noc.ReportagePeriod
	where ReportagePeriodID = @FromPeriod

	select @EndDate = EndDate
	from noc.ReportagePeriod
	where ReportagePeriodID = @ToPeriod

	SELECT @CultureNo =ISNULL( CultureNo,1)
	FROM   CFG.CultureInfo
	WHERE  Culture = @Culture

	SELECT  @DateType = us.SettingValue
    FROM    CFG.UserSetting us
    WHERE   us.SettingKey = 'Date_Type'
            AND us.UserID = @UserID
	
    IF @DateType IS NULL
        SET @DateType = CASE CFG.GetuserCulture()
                            WHEN 'fa' THEN 0
                            WHEN 'en' THEN 1
                            WHEN 'ar' THEN 2
                        END
	
    SELECT  @DateFormat = us.SettingValue
    FROM    CFG.UserSetting us
    WHERE   us.SettingKey = 'Date_Format'
            AND us.UserID = @UserID
	
    IF @DateFormat IS NULL
        SET @DateFormat = 'YY/MM/DD'

	create table #SlParents
	(
	SlID int,
	Parent int
	)

	select slid,acc.[SlParentString](a.slid) ParentsString into #S from acc.sl a

	declare @MaxOrder int,
			@intFlag INT = 1

	select @MaxOrder = max(LevelOrder)
	from acc.SlTreeLevel

	WHILE (@intFlag <= @MaxOrder)
	BEGIN
		insert into #SlParents
		select slid,[CFG].[GetStringPart](ParentsString,@intFlag) from #S
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


	create table #TMP
	(
	SlID int,
	Amount decimal(30,4),
	BaseCurrencyAmount decimal(30,4),
	CashVoucherID int,
	--ReferenceNumber int,
	--VoucherDate date,
	EffectiveDate date,
	DlID int,
	ReportagePeriod nvarchar(256),
	ReportCurrencyRate decimal(30,4),
	--AccrueReferenceNumber int,
	--AccrueVoucherDate Date,
	DosumentType varchar(256),
	DosumentID int,
	ReportagePeriodOrder int,
	PayVoucharID int,
	AccrueVoucherID int,
	ContractDlID int
	)
	
	if @CashFounding = 1
	insert into #TMP
	select  a.SlID,
			Debit-credit,
			BaseCurrencyDebit-BaseCurrencyCredit,
			ecf1.LookupDataItemID ,
			ToDate,
			DlID,
			case when @CultureNo = 1 then d.Title else d.Title2 end ReportagePeriod,
			a.CurrencyRate,
			'CashFounding',
			a.CashFoundingID,
			d.[Order],
			null,
			ecf.LookupDataItemID ,
			null
	from NOC.CashFounding a
	join noc.ReportagePeriod d
		on d.ReportagePeriodID = a.ReportagePeriodID
	left join #FilteredSlID on a.SlID = #FilteredSlID.SlID
	left join 
	(
		select b.EntityID,b.LookupDataItemID
		from cfg.EntityCustomeField a
		join cfg.EntityCustomeFieldData b
			on a.EntityCustomeFieldID = b.EntityCustomeFieldID
		where a.EntityName = 'CashFounding'
		and a.FieldName = 'ReferenceNumber'
	) ecf on ecf.EntityID = a.CashFoundingID
	left join 
	(
		select b.EntityID,b.LookupDataItemID
		from cfg.EntityCustomeField a
		join cfg.EntityCustomeFieldData b
			on a.EntityCustomeFieldID = b.EntityCustomeFieldID
		where a.EntityName = 'CashFounding'
		and a.FieldName = 'ReferenceNumber1'
	) ecf1 on ecf1.EntityID = a.CashFoundingID
	where (@SelectedSlTreeLevel is null or #FilteredSlID.SlID is not null)
	and d.StartDate >= @StartDate and d.EndDate <= @EndDate


	declare @PayrollDividedOnPersonell bit ,
			@StaffDL int 

	select @PayrollDividedOnPersonell = ConfigValue
	from noc.NIOCSetting
	where ConfigKey = 'PayrollDividedOnPersonell'

	select @StaffDL = ConfigValue
	from noc.NIOCSetting
	where ConfigKey = 'StaffDL'

	if @Analysing = 1
	insert into #TMP
	select i.SlID,
	       i.Amount,   	
		   i.BaseCurrencyAmount,
		   cdc.VoucherID,
		   c.EffectiveDate,
		   c.DlID,
		   case when @CultureNo = 1 then r.Title else r.Title2 end ReportagePeriod,
		   c.ReportCurrencyRate,
		   'CashAnalysing',
		   c.AnalysingID,
		   r.[Order],
		   vw.BaseVoucherID,
		   i.AccrueVoucherID,
		   co.DLID
	from NOC.CashAnalysingItem i
	join NOC.CashAnalysing c on i.CashAnalysingID = c.CashAnalysingID
	join NOC.Analysing a on c.AnalysingID = a.AnalysingID
	join NOC.CashDataCollection cdc on c.CashDataCollectionID = cdc.CashDataCollectionID
	join NOC.ReportagePeriod r on r.ReportagePeriodID = a.ReportagePeriodID
	left join #FilteredSlID on i.SlID = #FilteredSlID.SlID
	left join  NOC.VwPaymentReceipt vw on vw.PaymentSubjectID = cdc.PaymentSubjectID
	left join cnt.Contract co on co.ContractID = c.ContractID
	where c.Status = 1 and
	      r.StartDate >= @StartDate and r.EndDate <= @EndDate and
          (@SelectedSlTreeLevel is null or #FilteredSlID.SlID is not null)
		  and cdc.CalculationID is null and cdc.CalculationResultID is null

	if @Analysing = 1
	insert into #TMP
	select i.SlID,
	       i.Amount,   	
		   i.BaseCurrencyAmount,
		   I.VoucherID,
		   i.EffectiveDate,
		   @StaffDL,
		   case when @CultureNo = 1 then r.Title else r.Title2 end ReportagePeriod,
		   i.ReportCurrencyRate,
		   'CashAnalysing',
		   AnalysingID,
		   r.[Order],
		   null,
		   i.AccrueVoucherID,
		   null
	from 
	(
		select c.AnalysingID,i.SlID, sum(i.Amount) Amount,sum(i.BaseCurrencyAmount) BaseCurrencyAmount,cdc.VoucherID,a.ReportagePeriodID,i.AccrueVoucherID,min(ReportCurrencyRate) ReportCurrencyRate,EffectiveDate
		from NOC.CashAnalysingItem i
		join NOC.CashAnalysing c on i.CashAnalysingID = c.CashAnalysingID
		join NOC.Analysing a on c.AnalysingID = a.AnalysingID
		join NOC.CashDataCollection cdc on c.CashDataCollectionID = cdc.CashDataCollectionID
		left join #FilteredSlID on i.SlID = #FilteredSlID.SlID
		where c.Status = 1 and
			  (@SelectedSlTreeLevel is null or #FilteredSlID.SlID is not null)
		  and (cdc.CalculationID is not null or cdc.CalculationResultID is not null)
		  group by c.AnalysingID,i.SlID,cdc.VoucherID,a.ReportagePeriodID,i.AccrueVoucherID,EffectiveDate
	)i  
	join NOC.ReportagePeriod r on r.ReportagePeriodID = i.ReportagePeriodID
	where r.StartDate >= @StartDate and r.EndDate <= @EndDate 
	
	if @Modification = 1
	begin

		select  c.SlID,
				vP.VoucherID,
				vi.Credit     ,
				vi.Debit      ,
				ReportCurrencyRate,
				c.VoucherItemID,
				c.ModificationID,
				c.ReportagePeriodID,
				c.Date	
			into #Modification
		 from noc.Modification c
		join acc.VoucherItem vi
			on vi.VoucherItemID = c.VoucherItemID
		join noc.ReportagePeriod d
			on d.ReportagePeriodID = c.ReportagePeriodID
		left join
			(
			select PrevoucherID,VoucherID
			from acc.VoucherPrevoucher
			group by PrevoucherID,VoucherID
			)vp
			on vp.PrevoucherID = c.PreVoucherID
		where  d.StartDate >= @StartDate and d.EndDate <= @EndDate

		select VoucherItemID,dl.DlID
		 into #Party
		 from acc.AccountLevelVoucherItem alvi
		 join acc.dl 
			on dl.DLID = alvi.DlID
		 join acc.DlType dt
			on dt.DlTypeID = dl.DlTypeID
		 where dt.code = 103

		select VoucherItemID,dl.DlID
		 into #Contract
		 from acc.AccountLevelVoucherItem alvi
		 join acc.dl 
			on dl.DLID = alvi.DlID
		 join acc.DlType dt
			on dt.DlTypeID = dl.DlTypeID
		 where dt.code = 111


		insert into #TMP
		select m.SlID,
			case when ReportCurrencyDebitCash - ReportCurrencyCreditCash > 0 
				then -1 * (ReportCurrencyDebitCash - ReportCurrencyCreditCash)
				else ReportCurrencyDebitCash - ReportCurrencyCreditCash end,   	
			case when BaseCurrencyDebitCash - BaseCurrencyCreditCash > 0 
				then -1 * (BaseCurrencyDebitCash - BaseCurrencyCreditCash)
				else BaseCurrencyDebitCash - BaseCurrencyCreditCash end,   	
			m.VoucherID,
			m.Date,
			dl.DlID,
			case when @CultureNo = 1 then d.Title else d.Title2 end ReportagePeriod,
			0,
			'Modification',
			m.ModificationID,
			d.[Order],
			null,
			m.VoucherID,
			co.DLID
		 from #Modification m
		 join
		 (
		 select ModificationID,
				sum(BaseCurrencyDebitCash) BaseCurrencyDebitCash,
				sum(BaseCurrencyCreditCash) BaseCurrencyCreditCash,
				sum(ReportCurrencyDebitCash) ReportCurrencyDebitCash,
				sum(ReportCurrencyCreditCash) ReportCurrencyCreditCash
		 from noc.ModifiedTopic
		 group by ModificationID
		 having sum(BaseCurrencyDebitCash) <> 0 or sum(BaseCurrencyCreditCash) <> 0
		 ) mt
			on mt.ModificationID = m.ModificationID
		 join noc.ReportagePeriod d
			on d.ReportagePeriodID = m.ReportagePeriodID
		left join #Party dl
			on dl.VoucherItemID = m.VoucherItemID
		left join #Contract co
			on co.VoucherItemID = m.VoucherItemID
		left join #FilteredSlID on m.SlID = #FilteredSlID.SlID
		where  d.StartDate >= @StartDate and d.EndDate <= @EndDate
		and (@SelectedParties is null or dl.DlID in (select value from CFG.R_FnCommaStr2Table(@SelectedParties)))
		and (@SelectedContracts is null or co.DlID in (select value from CFG.R_FnCommaStr2Table(@SelectedContracts)))
		and (@SelectedSlTreeLevel is null or #FilteredSlID.SlID is not null)


		insert into #TMP
		select mt.SlID,
			ReportCurrencyDebitCash - ReportCurrencyCreditCash,   	
			BaseCurrencyDebitCash - BaseCurrencyCreditCash ,   	
			m.VoucherID,
			m.Date,
			dl.DlID,
			case when @CultureNo = 1 then d.Title else d.Title2 end ReportagePeriod,
			0,
			'Modification',
			m.ModificationID,
			d.[Order],
			null,
			m.VoucherID,
			co.DLID
		from noc.ModifiedTopic mt
		join #Modification m
			on mt.ModificationID = m.ModificationID
		join noc.ReportagePeriod d
			on d.ReportagePeriodID = m.ReportagePeriodID
		left join #Party dl
			on dl.VoucherItemID = m.VoucherItemID
		left join #Contract co
			on co.VoucherItemID = m.VoucherItemID
		left join #FilteredSlID on mt.SlID = #FilteredSlID.SlID
		where  d.StartDate >= @StartDate and d.EndDate <= @EndDate
		and (@SelectedParties is null or dl.DlID in (select value from CFG.R_FnCommaStr2Table(@SelectedParties)))
		and (@SelectedContracts is null or co.DlID in (select value from CFG.R_FnCommaStr2Table(@SelectedContracts)))
		and (@SelectedSlTreeLevel is null or #FilteredSlID.SlID is not null)
		and ToBeReported = 1
		and (mt.BaseCurrencyDebitCash <> 0 or mt.BaseCurrencyCreditCash <> 0)
		end
	
	select t.CashVoucherID,
           d.Code DLCode,
           case when @CultureNo = 1 then d.Title else d.Title2 end DLTitle,
           ACC.SlFullCode(t.SlID) SlCode,
           case when @CultureNo = 1 then s.Title else s.Title2 end SlTitle,
		   CFG.GetCLRSaturnDate(t.EffectiveDate, @DateFormat, 0, @DateType) EffectiveDate,
           ReportCurrencyRate CurrencyRate,
		   Amount,
           BaseCurrencyAmount,
		   ReportagePeriod,
		   DosumentType,
		   DosumentID,
		   ReportagePeriodOrder,
		   PayVoucharID,
		   AccrueVoucherID,
		   T.SlID,
		   d1.Code ContractDlCode,
		   case when @CultureNo = 1 then d1.Title else d1.Title2 end ContractDLTitle
	into #t							
	from #TMP t	
	inner join ACC.SL s on t.SlID = s.SlID
	left join acc.dl	d on d.DLID = t.DLID
	left join acc.dl	d1 on d1.DLID = t.ContractDlID
	where (@SelectedParties is null or t.DlID in (select value from CFG.R_FnCommaStr2Table(@SelectedParties)))
	and  (@SelectedContracts is null or t.ContractDlID in (select value from CFG.R_FnCommaStr2Table(@SelectedContracts)))


	select t.CashVoucherID,
	       V1.ReferenceNumber,
	       CFG.GetCLRSaturnDate(V1.Date, @DateFormat, 0, @DateType) VoucherDate,
		   t.DLCode,
		   t.DLTitle,
		   ContractDlCode,
		   ContractDLTitle,
		   t.SlCode,
		   t.SlTitle,
		   t.EffectiveDate,
		   t.CurrencyRate,
	       case when t.BaseCurrencyAmount > 0 then t.BaseCurrencyAmount
		        else 0
		   end as BaseCurrencyDebit,
		   case when t.BaseCurrencyAmount < 0 then abs(t.BaseCurrencyAmount)
		        else 0
		   end as BaseCurrencyCredit,	
		   case when t.Amount > 0 then t.Amount
		        else 0
		   end as Debit,
		   case when t.Amount < 0 then abs(t.Amount)
		        else 0
		   end as Credit,
		   ReportagePeriod,
		   DosumentType,
		   DosumentID,
		   ROW_NUMBER() over(order by DosumentType,DosumentID,SlCode ) RowID,
		   PayVoucharID,
		   --CASE WHEN RH.HasCashNature = 1 THEN NULL ELSE AccrueVoucherID END AccrueVoucherID,
		   AccrueVoucherID,
		   --CASE WHEN RH.HasCashNature = 1 THEN NULL ELSE V2.ReferenceNumber END AccrueReferenceNumber,
		   V2.ReferenceNumber  AccrueReferenceNumber,
		   --CASE WHEN RH.HasCashNature = 1 THEN NULL ELSE CFG.GetCLRSaturnDate(V2.Date, @DateFormat, 0, @DateType) END AccrueVoucherDate
		   CFG.GetCLRSaturnDate(V2.Date, @DateFormat, 0, @DateType)  AccrueVoucherDate
	from #t t
	JOIN NOC.ReportHeadline RH ON RH.SlID = T.SlID
	LEFT JOIN ACC.Voucher V1 ON V1.VoucherID = T.CashVoucherID
	LEFT JOIN ACC.Voucher V2 ON V2.VoucherID = T.AccrueVoucherID
	order by ReportagePeriodOrder,VoucherDate
