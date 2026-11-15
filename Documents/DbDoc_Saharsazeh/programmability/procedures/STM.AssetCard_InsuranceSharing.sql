
CREATE proc [STM].[AssetCard_InsuranceSharing]
(
@AssetID nvarchar(max)
)

as
begin

DECLARE @UserID INT,
                @DateType TINYINT,
                @DateFormat VARCHAR(10)

        SET @UserID = CFG.GetuserID()
	
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

select CFG.GetCLRSaturnDate(ish.Date, @DateFormat, 0, @DateType) date,ish.SharingValue
from ast.InsuranceSharing ish
join ast.AssetSetting ass on ass.AssetSettingID = ish.AssetSettingID
where ass.AssetID = @AssetID
end

 
