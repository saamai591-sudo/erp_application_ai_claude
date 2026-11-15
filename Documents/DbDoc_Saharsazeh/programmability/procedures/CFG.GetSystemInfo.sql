
--------------------------------------------------------CFG.GetSystemInfo-------------------------------------------
CREATE    PROCEDURE CFG.GetSystemInfo
(@userName NVARCHAR(250))
--WITH ENCRYPTION
AS
	DECLARE @userId INT,
			@userTitle NVARCHAR(256),
			@CurrentFinancialPeriodID INT,
			@CurrentFinancialPeriodStartDate DATETIME,
			@CurrentFinancialPeriodeEndDate DATETIME,
			@CurrencyID INT,
			@CurrencyTitle NVARCHAR(256),
			@CurrencyTitle2 VARCHAR(256),
			@ExchangeUnit DECIMAL(8, 2),
			@PrecisionCount SMALLINT,
			@PrecisionTitle NVARCHAR(256),
			@PrecisionTitle2 VARCHAR(256),
			@BaseCurrencyTitle NVARCHAR(156),
			@QuickNavigateData VARCHAR(MAX),
			@SaturnVersion VARCHAR(256),
			@LastVersionDate VARCHAR(256),
			@DateType TINYINT,
			@DateFormat VARCHAR(50),
			@DefaultFontFa INT,
			@Theme INT,
			@DefaultFontEn INT,
			@CultureNo TINYINT,
			@Culture VARCHAR(5),
			@PartyID bigint,
			@PersonnelID int,
			@PersonnelCode nvarchar(100),
			@PersonnelName nvarchar(512),
			@ApplyDate varchar(50),
			@SessionTimeoutID int,
			@sessionTimeout int
			
	SELECT @userId = u.UserID,
		   @userTitle = u.[Name],
		   @PartyID = u.PartyID
	FROM CFG.[User] u
	WHERE u.Username = @userName;

	select top 1 @PersonnelID = PersonelID
	from HRM.Personel
	where PartyID = @PartyID

	SET @Culture = CFG.GetuserCulture();

	SELECT @CultureNo = CultureNo
	FROM CFG.CultureInfo
	WHERE Culture = @Culture;

	select @PersonnelCode = p.Code, 
		   @PersonnelName = case when @CultureNo = 2 then pa.Title2 + ' ' + pa.LastName2 else pa.Title + ' ' + pa.LastName end
	from HRM.Personel p
	join CFG.Party pa on p.PartyID = pa.PartyID
	where p.PersonelID = @PersonnelID

	IF NOT EXISTS
	(
		SELECT 1
		FROM CFG.UserSetting
		WHERE UserID = @userId
			  AND SettingKey = 'DEFAULT_FININCIAL_PERIOD'
	)
	   OR NOT EXISTS
	(
		SELECT 1
		FROM CFG.UserSetting us
		INNER JOIN CFG.FinancialPeriod fp
			ON fp.FinancialPeriodID = us.SettingValue
		INNER JOIN CFG.vwFinancialPeriodAccess vw 
			on vw.FinancialPeriodID = fp.FinancialPeriodID
		WHERE us.SettingKey = 'DEFAULT_FININCIAL_PERIOD'
			  AND us.UserID = @userId
	)
	BEGIN
		SELECT TOP (1)
			   @CurrentFinancialPeriodID = fp.FinancialPeriodID,
			   @CurrentFinancialPeriodStartDate = fp.StartDate,
			   @CurrentFinancialPeriodeEndDate = fp.EndDate
		FROM CFG.FinancialPeriod fp
		INNER JOIN CFG.vwFinancialPeriodAccess vw 
			on vw.FinancialPeriodID = fp.FinancialPeriodID
		ORDER BY StartDate DESC;
	END;
	ELSE
	BEGIN
		SELECT @CurrentFinancialPeriodID = fp.FinancialPeriodID,
			   @CurrentFinancialPeriodStartDate = fp.StartDate,
			   @CurrentFinancialPeriodeEndDate = fp.EndDate
		FROM CFG.UserSetting us
		INNER JOIN CFG.FinancialPeriod fp
			ON fp.FinancialPeriodID = us.SettingValue
		INNER JOIN CFG.vwFinancialPeriodAccess vw 
			on vw.FinancialPeriodID = fp.FinancialPeriodID
		WHERE us.SettingKey = 'DEFAULT_FININCIAL_PERIOD'
			  AND us.UserID = @userId
	END;
	
	SELECT @DateType = us.SettingValue
	FROM CFG.UserSetting us
	WHERE us.SettingKey = 'Date_Type'
		  AND us.UserID = @userId;

    IF @DateType IS NULL
        SET @DateType = CASE CFG.GetuserCulture()
                            WHEN 'fa' THEN
                                0
                            WHEN 'en' THEN
                                1
                            WHEN 'ar' THEN
                                2
                            ELSE
                                0
                        END;

	SELECT @DateFormat = us.SettingValue
	FROM CFG.UserSetting us
	WHERE us.SettingKey = 'Date_Format'
		  AND us.UserID = @userId;
		  
    IF @DateFormat IS NULL
        SET @DateFormat = 'YY/MM/DD';

	SELECT @DefaultFontFa = us.SettingValue
	FROM CFG.UserSetting us
	WHERE us.SettingKey = 'DEFAULT_Font_Fa'
		  AND us.UserID = @userId;
		  
	SELECT @Theme = us.SettingValue
	FROM CFG.UserSetting us
	WHERE us.SettingKey = 'Theme'
		  AND us.UserID = @userId;

	IF @Theme IS NULL
	   OR @Theme = ''
	   SET @Theme = 1

	IF @DefaultFontFa IS NULL
	   OR @DefaultFontFa = ''
		SET @DefaultFontFa = 0;

	SELECT @DefaultFontEn = us.SettingValue
	FROM CFG.UserSetting us
	WHERE us.SettingKey = 'DEFAULT_Font_en'
		  AND us.UserID = @userId;

	IF @DefaultFontEn IS NULL
	   OR @DefaultFontEn = ''
		SET @DefaultFontEn = 2;

	SELECT @QuickNavigateData = us.SettingValue
	FROM CFG.UserSetting us
	WHERE us.SettingKey = 'UserQuickNavigate'
		  AND us.UserID = @userId;

	SELECT @CurrencyID = CurrencyID,
		   @CurrencyTitle = Title,
		   @CurrencyTitle2 = Title2,
		   @ExchangeUnit = ExchangeUnit,
		   @PrecisionCount = PrecisionCount,
		   @PrecisionTitle = PrecisionTitle,
		   @PrecisionTitle2 = PrecisionTitle2,
		   @BaseCurrencyTitle = CASE
									WHEN @CultureNo = 1 THEN
										c.Title
									ELSE
										c.Title2
								END
	FROM CFG.Currency AS c
	WHERE (CurrencyID = -1);

	SELECT TOP 1
		   @SaturnVersion = SaturnVersion
	FROM CFG.DbSchema
	ORDER BY VersionDate DESC;

	SELECT TOP 1 
		@LastVersionDate = [CFG].GetCLRSaturnDate( [Date], @DateFormat, 0, @DateType)
	FROM CFG.DbMigration
	ORDER BY [Date] DESC

	SELECT TOP 1
		   @ApplyDate = ApplyDate
	FROM CFG.VersionInfo
	ORDER BY VersionInfoID DESC;
 
	SELECT @SessionTimeoutID = SystemPolicyID FROM cfg.SystemPolicy
	WHERE IsDefault = 1 AND IsActive = 1 AND PolicyType = 5
 
	IF (@SessionTimeoutID IS NULL)
	BEGIN
		SELECT @SessionTimeoutID = SessionTimeOutPolicyID FROM cfg.[User]
		WHERE SessionTimeOutPolicyID IS NOT NULL AND UserID = @userId
	END

	SELECT @sessionTimeout = CAST(PolicyContent AS int) FROM cfg.SystemPolicy
	WHERE SystemPolicyID = @SessionTimeoutID

	IF (@sessionTimeout is null)
		SET @sessionTimeout = 0; 

	SELECT 1 AS ID,
		   @userId AS UserID,
		   @userTitle AS UserTitle,
		   @sessionTimeout AS SessionTimeOutMinute,
		   @CurrentFinancialPeriodID AS CurrentFinancialPeriodID,
		   @CurrentFinancialPeriodStartDate AS CurrentFinancialPeriodStartDate,
		   @CurrentFinancialPeriodeEndDate AS CurrentFinancialPeriodeEndDate,
		   GETDATE() AS CurrentDate,
		   CFG.GetSaturnDate(GETDATE(), 0) AS CurrentDateString,
		   @CurrencyID AS CurrencyID,
		   @CurrencyTitle AS CurrencyTitle,
		   @CurrencyTitle2 AS CurrencyTitle2,
		   @PrecisionCount AS PrecisionCount,
		   @PrecisionTitle AS PrecisionTitle,
		   @PrecisionTitle2 AS PrecisionTitle2,
		   @ExchangeUnit AS ExchangeUnit,
		   @QuickNavigateData AS QuickNavigateData,
		   @SaturnVersion AS SaturnVersion,
		   @LastVersionDate AS LastVersionDate,
		   @DateType AS DateType,
		   @DateFormat AS [DateFormat],
		   @DefaultFontFa AS DefaultFontFa,
		   @DefaultFontEn AS DefaultFontEn,
		   @BaseCurrencyTitle AS BaseCurrencyTitle,
		   @PersonnelID as PersonnelID,
		   @PersonnelCode as PersonnelCode,
		   @PersonnelName as PersonnelName,
		   @ApplyDate as ApplyDate,
		   @Theme AS Theme
