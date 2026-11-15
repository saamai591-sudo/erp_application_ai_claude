CREATE   PROC [STM].DCNote @Number INT
AS
declare
		@UserName    nvarchar(560),
		@DlTitle     nvarchar(560),		
		@Date        date,
		@Type        tinyint,
		@FinancialPeriod int,
		@Culture           VARCHAR(25),
	    @CultureNo         TINYINT,
		@DateType TINYINT,
		@DateFormat VARCHAR(10),
		@UserID int

	SET @UserID = cfg.GetuserID();
	SET @Culture = CFG.GetuserCulture() ;
	SELECT @CultureNo = ISNULL(CultureNo, 1)
	FROM   CFG.CultureInfo
	WHERE  Culture = @Culture

    SELECT @DateType = us.SettingValue
    FROM CFG.UserSetting us
    WHERE us.SettingKey = 'Date_Type'
          AND us.UserID = @UserID;

    IF @DateType IS NULL
        SET @DateType = CASE @Culture
                            WHEN 'fa' THEN
                                0
                            WHEN 'en' THEN
                                1
                            ELSE
                                2
                        END;


    SELECT @DateFormat = us.SettingValue
    FROM CFG.UserSetting us
    WHERE us.SettingKey = 'Date_Format'
          AND us.UserID = @UserID;

    IF @DateFormat IS NULL
        SET @DateFormat = 'YY/MM/DD';

	select @FinancialPeriod = SettingValue from cfg.UserSetting
	where SettingKey = 'DEFAULT_FININCIAL_PERIOD'
	and UserID = @UserID

	SELECT  TOP 1   @DlTitle= case when @CultureNo = 1 then d2.Title else d2.Title2 end,
					@UserName=case when @CultureNo = 1 then u.Name else u.Name2 end ,
					@Date=d.[Date]
	FROM acc.DCNote AS d
	INNER JOIN acc.DL AS d2
							ON d.DlID=d2.DLID
	INNER JOIN cfg.[User] AS u
							ON u.UserID = d.Creator
	WHERE d.Number=@Number and FinancialPeriodID = @FinancialPeriod


	SELECT VoucherItemID
	into #voucheritem 
	from acc.DCNote
	WHERE Number=@Number and FinancialPeriodID = @FinancialPeriod


	select @Type = case when sum(debit) > 0 and sum(credit) = 0 then 1
						when sum(debit) = 0 and sum(credit) > 0 then 2
						else 3 end
	from acc.voucheritem vi1
	join #voucheritem vi2 on vi1.voucheritemid = vi2.voucheritemid




	select 
		@DlTitle DlTitle,
		@UserName Creator,
		d.DCNoteID,
		case when @CultureNo = 1 then vi1.Description else vi1.Description2 end Description,
		vi1.Debit,
		vi1.Credit,
		@Number Number,
		cfg.GetCLRSaturnDate(@Date,@DateFormat,0,@DateType) Date,
		@Type Type,
		case when @CultureNo = 1 then b.Title else b.Title2 end  BranchName,
		case when @CultureNo = 1 then c.Title else c.Title2 end  currency
	from acc.voucheritem vi1
	join acc.Voucher v on v.VoucherID = vi1.VoucherID
	join #voucheritem vi2 on vi1.voucheritemid = vi2.voucheritemid
	join cfg.Branch b on b.BranchID = v.BranchID
	JOIN acc.DCNote AS d ON d.VoucherItemID = vi1.VoucherItemID
	join cfg.Currency c on c.CurrencyID = vi1.CurrencyID
