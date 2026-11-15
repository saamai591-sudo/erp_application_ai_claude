CREATE   PROC [CFG].[SaveInUserSetting]
(
    @User INT,
    @Key NVARCHAR(500),
    @SubKey NVARCHAR(500) = NULL,
    @Value NVARCHAR(max)
)

--with encryption


AS
DECLARE @UserSetting INT;

SELECT @UserSetting = UserSettingID
FROM CFG.UserSetting
WHERE UserID = @User
      AND SettingKey = @Key
      AND
      (
          @SubKey IS NULL
          OR SettingSubKey = @SubKey
      );

IF @UserSetting IS NULL
    INSERT INTO [CFG].[UserSetting]
    (
        [UserID],
        [SettingKey],
        [SettingSubKey],
        [SettingValue],
        [Version],
        [Creator],
        [CreationDate],
        [LastEditor],
        [LastEditionDate]
    )
    VALUES
    (@User, @Key, @SubKey, @Value, 0, @User, GETDATE(), @User, GETDATE());

IF @UserSetting IS NOT NULL
    UPDATE [CFG].[UserSetting]
    SET SettingValue = @Value
    WHERE UserSettingID = @UserSetting
          AND
          (
              @SubKey IS NULL
              OR SettingSubKey = @SubKey
          );
