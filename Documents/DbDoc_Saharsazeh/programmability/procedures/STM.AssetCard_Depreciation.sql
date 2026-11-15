-------------------------------------
CREATE     proc [STM].AssetCard_Depreciation
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


        SELECT CFG.GetCLRSaturnDate(d.date, @DateFormat, 0, @DateType) date ,
               d.Value ,
               CASE d.DepreciationType
                    WHEN 1 THEN N'عادی'
                    WHEN 2 THEN N'تعمیر'
                    WHEN 3 THEN N'تغییر بهاء'
                    WHEN 4 THEN N'مازاد ناشی از تجدید ارزیابی'
               END Depreciationtype
        FROM   AST.Depreciation d
        WHERE  d.AssetID = @AssetID

		union all

        SELECT CFG.GetCLRSaturnDate(a.AssetCreationDate, @DateFormat, 0, @DateType) date ,
               a.DuringDepreciation Value ,
                N'عادی' Depreciationtype
        FROM   AST.Asset a
        WHERE  a.AssetID = @AssetID
        and a.DuringDepreciation > 0
end
