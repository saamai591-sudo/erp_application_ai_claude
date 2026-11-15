

CREATE       proc [NOC].[SpRptModification]
(
 @entityid varchar(max) 
	 )
	as
	CREATE TABLE #Ids
	(
		id            INT,
		itemOrder     INT
	)
	INSERT INTO #Ids
	SELECT [value],
		   Position
	FROM   cfg.R_FnCommaStr2Table(@entityid)


    DECLARE @Culture VARCHAR(25),
            @CultureNo TINYINT,
            @userId INT,
            @DateType VARCHAR(10) ,
            @DateFormat VARCHAR(10) ;

    SET @Culture = CFG.GetuserCulture();
    SET @userId = CFG.GetuserID();

    SELECT @CultureNo = CultureNo
    FROM CFG.CultureInfo
    WHERE Culture = @Culture;

    SELECT @DateType = us.SettingValue
    FROM   CFG.UserSetting us
    WHERE  us.SettingKey = 'Date_Type'
           AND us.UserID = @UserID;

    IF @DateType IS NULL
        SET @DateType = CASE @Culture
                             WHEN 'fa' THEN 0
                             WHEN 'en' THEN 1
                             WHEN 'ar' THEN 2
                        END;

    SELECT @DateFormat = us.SettingValue
    FROM   CFG.UserSetting us
    WHERE  us.SettingKey = 'Date_Format'
           AND us.UserID = @UserID;

    IF @DateFormat IS NULL
        SET @DateFormat = 'YY/MM/DD';

select
m.ModificationID,
m.Number,
cfg.GetCLRSaturnDate(m.Date,'YYYY-MM-DD',0,1) Date,
m.Description,
m.Description2,
acc.SlFullCode(m.SlID) SlCode,
case when @CultureNo = 1 then sl.Title else sl.Title2 end SlTitle,
c.ReferenceNumber,
c.BaseCurrencyCreditCash,
c.BaseCurrencyDebitCash, 
case when @CultureNo = 1 then rr.Title else rr.Title2 end  ReportagePeriodTitle,
m.ReportCurrencyRate,
c.ReportCurrencyRate ReportCurrencyRateC,
c.ReportCurrencyDebitCash,
c.ReportCurrencyCreditCash,
c.ReportCurrencyDebitExchange,
c.ReportCurrencyCreditExchange,
vi.Debit,
vi.Credit,
v.ReferenceNumber ReferenceNumber1, 
ROW_NUMBER() over( order by m.ModificationID)rno
from noc.Modification m
left join noc.CashAndExchangeModification c on c.ModificationID=m.ModificationID
join acc.SL on sl.SlID=m.SlID
join noc.ReportagePeriod rr on rr.ReportagePeriodid=m.ReportagePeriodid
join acc.voucheritem vi on vi.voucheritemid=m.voucheritemid
join acc.Voucher v on v.VoucherID=vi.VoucherID
join #Ids i on i.id=m.ModificationID



