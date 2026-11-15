
create     proc [NOC].GetReferenceForModification
(
@Slid int,
@Date Date,
@ReportagePeriodID int
)
as



	DECLARE @UserID INT,
	        @DateType TINYINT,
	        @DateFormat VARCHAR(10),
			@Culture NVARCHAR(10),
			@CultureNo tinyint,
			@EndDate date
	    
	SET @UserID = CFG.GetuserID()
	SET @Culture = cfg.GetuserCulture()	

	select @CultureNo = CultureNo
	from CFG.CultureInfo 
	where Culture = @Culture	
	
	SELECT @DateType = us.SettingValue
	FROM   CFG.UserSetting us
	WHERE  us.SettingKey = 'Date_Type'
	       AND us.UserID = @UserID
	
	IF @DateType IS NULL
	    SET @DateType = CASE @Culture
	                         WHEN 'fa' THEN 0
	                         WHEN 'en' THEN 1
	                         WHEN 'ar' THEN 2
	                    END
	
	SELECT @DateFormat = us.SettingValue
	FROM   CFG.UserSetting us
	WHERE  us.SettingKey = 'Date_Format'
	       AND us.UserID = @UserID
	
	IF @DateFormat IS NULL
	    SET @DateFormat = 'YY/MM/DD'

select @EndDate  = EndDate
from noc.ReportagePeriod
where ReportagePeriodID = @ReportagePeriodID

select 
	 c.VoucherID
	,b.VoucherItemID
	,c.ReferenceNumber
	,CFG.GetCLRSaturnDate(c.[Date], @DateFormat, 0, @DateType) Date
	,b.SlID
	,a.BaseCurrencyDebit Debit
	,a.BaseCurrencyCredit Credit
	,a.ReportCurrencyRate
	,a.ReportCurrencyDebit
	,a.ReportCurrencyCredit
	,vp.PrevoucherID BasePrevoucherID
from noc.AccrueAnalysing  a
join acc.VoucherItem b
	on a.VoucherItemID = b.VoucherItemID
join acc.Voucher c
	on c.VoucherID = b.VoucherID
join noc.Analysing d
	on d.AnalysingID = a.AnalysingID
join noc.ReportagePeriod e
	on e.ReportagePeriodID = d.ReportagePeriodID
join noc.ConfirmedReport f
	on e.ReportagePeriodID = f.ReportagePeriodID
	and f.Type = 2
left join noc.Modification m
	on m.VoucherItemID = b.VoucherItemID
left join acc.VoucherPrevoucher vp
	on vp.VoucherItemID = a.VoucherItemID
where a.Status = 1
and b.slid = @Slid
and c.Date <= @Date
and e.EndDate <= @EndDate
and m.ModificationID is null

union all

select 
	 c.VoucherID
	,c.VoucherItemID
	,v.ReferenceNumber
	,CFG.GetCLRSaturnDate(v.[Date], @DateFormat, 0, @DateType) Date
	,b.SlID
	,aa.BaseCurrencyDebit Debit 
	,aa.BaseCurrencyCredit Credit 
	,aa.ReportCurrencyRate
	,aa.ReportCurrencyDebit
	,aa.ReportCurrencyCredit,
	vp.PrevoucherID BasePrevoucherID
from noc.Modification  a
join noc.ModifiedTopic b
	on a.ModificationID = b.ModificationID
join 
(
select PrevoucherID,VoucherID
from acc.VoucherPrevoucher
group by PrevoucherID,VoucherID
)vp
	on a.PreVoucherID = vp.PreVoucherID
join acc.voucher v
	on v.VoucherID = vp.VoucherID
join acc.VoucherItem c
	on c.VoucherID = vp.VoucherID
	and b.SlID = c.SlID
join noc.ReportagePeriod e
	on e.ReportagePeriodID = a.ReportagePeriodID
join noc.ConfirmedReport f
	on e.ReportagePeriodID = f.ReportagePeriodID
	and f.Type = 2
join noc.AccrueAnalysing aa
	on aa.VoucherItemID = a.VoucherItemID
left join noc.Modification m2
	on m2.VoucherItemID = c.VoucherItemID
where b.slid = @Slid
and a.Date <= @Date
and e.EndDate <= @EndDate
and m2.ModificationID is null

