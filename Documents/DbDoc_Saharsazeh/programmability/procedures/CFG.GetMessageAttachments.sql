
CREATE   PROCEDURE [CFG].[GetMessageAttachments]
(
    @engName NVARCHAR(200),
    @entityId NVARCHAR(MAX),
    @metaDataKey NVARCHAR(200)
)
--WITH ENCRYPTION
AS
BEGIN
    DECLARE @userId INT,
            @Culture NVARCHAR(20),
            @DateType VARCHAR(10),
            @DateFormat VARCHAR(10);

    SET @Culture = CFG.GetuserCulture();
    SET @userId = CFG.GetuserID();

    SELECT @DateType = us.SettingValue
    FROM CFG.UserSetting us
    WHERE us.SettingKey = 'Date_Type'
          AND us.UserID = @userId;

    IF @DateType IS NULL
        SET @DateType = CASE @Culture
                            WHEN 'fa' THEN 0
                            WHEN 'en' THEN 1
                            WHEN 'ar' THEN 2
                            ELSE 0
                        END;

    SELECT @DateFormat = us.SettingValue
    FROM CFG.UserSetting us
    WHERE us.SettingKey = 'Date_Format'
          AND us.UserID = @userId;

    IF @DateFormat IS NULL
        SET @DateFormat = 'YY/MM/DD';

    DECLARE @DbName VARCHAR(512);

    SELECT @DbName = c.ConfigValue
    FROM CFG.Configuration AS c
    WHERE c.ConfigKey = 'AttachmentDB';

    IF @DbName IS NULL OR @DbName = ''
        SET @DbName = '';
    ELSE
        SET @DbName = QUOTENAME(@DbName) + '.';

    DECLARE @Query NVARCHAR(MAX);

    SET @Query
        = N'
    SELECT fa.FileAttachmentID,
           fa.MetaDataEntityID,
           fa.EntityRelatedID,
           fa.[FileName],
           fa.[Description],
           fa.[Description2],
           fa.[Date],
           fa.Status,
           fa.Creator,
           fa.CreationDate,
           fa.LastEditor,
           fa.LastEditionDate,
           u1.[Name] CreatorUserName,
           u2.[Name] EditorName,
           fa.[Version],
           CFG.GetCLRSaturnDate(fa.[Date], @DateFormat, 0, @DateType) AS PersianDate,
           CFG.GetCLRSaturnDate(fa.[Date], @DateFormat, 0, @DateType) AS CreateDateString,
           CFG.GetCLRSaturnDate(fa.[Date], @DateFormat, 0, @DateType) AS EditionDateString,
           fa.FileAttachmentTypeID,
           t.title FileAttachmentType,
           '''' AS ModuleKey
    FROM   ' + @DbName
          + N'CFG.FileAttachment AS fa
           JOIN MDT.DmdEntity AS me ON me.Id = fa.MetaDataEntityID
           LEFT JOIN cfg.FileAttachmentType t ON t.FileAttachmentTypeID = fa.FileAttachmentTypeID
           JOIN CFG.[User] u1 ON fa.Creator = u1.UserID
           JOIN CFG.[User] u2 ON fa.LastEditor = u2.UserID
    WHERE  me.[Name] = @metaDataKey
           AND fa.EntityRelatedID = @entityId
           AND (
                   @userId = -1
                   OR EXISTS (
                       SELECT 1
                       FROM CFG.[Message] m
                       WHERE m.MessageID = @entityId
                             AND (m.SenderID = @userId OR m.Creator = @userId)
                   )
                   OR EXISTS (
                       SELECT 1
                       FROM CFG.MessageRecipient mr
                       WHERE mr.MessageID = @entityId
                             AND mr.ReceiverID = @userId
                             AND mr.IsDeleted = 0
                   )
               );';

    EXECUTE sp_executesql @Query,
                          N'@dateFormat varchar(10),
                            @dateType int,
                            @entityId nvarchar(Max),
                            @UserID int,
                            @metaDataKey nvarchar(255)',
                          @DateType = @DateType,
                          @DateFormat = @DateFormat,
                          @UserID = @userId,
                          @entityId = @entityId,
                          @metaDataKey = @metaDataKey;
END;
