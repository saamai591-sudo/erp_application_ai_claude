
create     proc [NOC].SpRptModifiedTopic
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
        mt.ModificationID,
        mt.ModificationPercent,
		acc.SlFullCode(mt.SlID) SlCode,
		case when @CultureNo = 1 then sl.Title else sl.Title2 end SlTitle,
		mt.BaseCurrencyCreditAccrue,
		mt.BaseCurrencyDebitAccrue,
		mt.ReportCurrencyCreditAccrue,
		mt.ReportCurrencyDebitAccrue,
		mt.BaseCurrencyDebitCash,
		mt.BaseCurrencyCreditCash,
		mt.ReportCurrencyDebitCash,
		mt.ReportCurrencyCreditCash,
		mt.ReportCurrencyCreditExchange,
		mt.ReportCurrencyDebitExchange,
		ROW_NUMBER() over( order by mt.ModificationID)rno
from  noc.ModifiedTopic mt
join ACC.SL on sl.SlID=mt.SlID
join #Ids i on i.id=ModificationID


