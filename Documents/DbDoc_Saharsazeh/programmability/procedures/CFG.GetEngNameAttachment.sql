
-------------------------------------
CREATE    PROCEDURE [CFG].[GetEngNameAttachment]
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
            @DateFormat VARCHAR(10);;

    SET @Culture = CFG.GetuserCulture();
    SET @userId = CFG.GetuserID();

    SELECT @DateType = us.SettingValue
    FROM CFG.UserSetting us
    WHERE us.SettingKey = 'Date_Type'
          AND us.UserID = @userId;

    IF @DateType IS NULL
        SET @DateType = CASE @Culture
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

    DECLARE @ViewRelatedToUser INT,
            @ViewRelatedToOthers NVARCHAR(MAX)
    
	SELECT @ViewRelatedToUser = UserID
	FROM CFG.vwOperationLevelAccess
	WHERE EntityName =  @engName
		  AND AccessKey = 'ViewAttachmentRelatedToUser'
		  AND UserID = @UserID;

	SELECT @ViewRelatedToOthers = Users
	FROM CFG.vwOperationLevelAccess
	WHERE EntityName =  @engName
		  AND AccessKey = 'ViewAttachmentRelatedToOthers'
		  AND UserID = @UserID;

    DECLARE @DbName VARCHAR(512),
        @AccessKey nvarchar(200)

        set @AccessKey =@engName + '_ViewAttachmentRelatedToOthers'

    SELECT @DbName = c.ConfigValue
    FROM CFG.Configuration AS c
    WHERE c.ConfigKey = 'AttachmentDB';

    IF @DbName IS NULL or @DbName = ''
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
		   u2.[Name] EditorName ,
	       fa.[Version],
	       CFG.GetCLRSaturnDate(fa.[Date], @DateFormat, 0, @DateType) AS PersianDate,
	       CFG.GetCLRSaturnDate(fa.[Date], @DateFormat, 0, @DateType) AS CreateDateString,
	       CFG.GetCLRSaturnDate(fa.[Date], @DateFormat, 0, @DateType) AS EditionDateString,
		   fa.FileAttachmentTypeID,
		   t.title FileAttachmentType,
           '''' AS ModuleKey
	FROM   ' + @DbName
          + N'CFG.FileAttachment  AS fa
	       JOIN MDT.DmdEntity  AS me ON  me.Id = fa.MetaDataEntityID
           left join cfg.vwFileAttachmentTypeAccess AS vfata on vfata.FileAttachmentTypeID = fa.FileAttachmentTypeID
		   LEFT JOIN cfg.FileAttachmentType t on t.FileAttachmentTypeID = fa.FileAttachmentTypeID
		   JOIN CFG.[User] u1 ON fa.Creator = u1.UserID
		   JOIN CFG.[User] u2 ON fa.LastEditor = u2.UserID
	WHERE  me.[Name] = @metaDataKey
	       AND fa.EntityRelatedID = @entityId 
           AND (fa.FileAttachmentTypeID IS NULL or vfata.UserID is NOT NULL)
	       AND (
	               @userId = -1
	               OR (@ViewRelatedToUser IS NOT NULL AND fa.Creator = @userId)
	               OR ( @ViewRelatedToOthers IS NULL OR fa.Creator NOT IN (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@ViewRelatedToOthers) AS rfcst) )
	           ); ';

    EXECUTE sp_executesql @Query,
                          N'@dateFormat varchar(10),
	      @engName NVARCHAR(200),
	      @dateType int,
	      @ViewRelatedToOthers NVARCHAR(MAX),
	      @entityId nvarchar(Max),
		  @UserID int,
		  @ViewRelatedToUser int,
		  @metaDataKey nvarchar(255),
          @AccessKey nvarchar(200)',
                          @DateType = @DateType,
                          @engName = @engName,
                          @DateFormat = @DateFormat,
                          @ViewRelatedToUser = @ViewRelatedToUser,
                          @UserID = @userId,
                          @entityId = @entityId,
                          @ViewRelatedToOthers = @ViewRelatedToOthers,
                          @metaDataKey = @metaDataKey,
                          @AccessKey = @AccessKey;
END;
