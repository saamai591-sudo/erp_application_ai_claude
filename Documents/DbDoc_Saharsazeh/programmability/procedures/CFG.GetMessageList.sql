------------------------------------- START GetMessageList exclude sender from received inbox (idempotent)
-- Received list no longer shows messages the current user sent (unless BCC).
-- Sent list still shows only the latest non-draft message the user sent in each thread.

CREATE   PROCEDURE [CFG].[GetMessageList]
(
    @ListMode INT,
    @PageNumber INT,
    @RowspPage INT,
    @Sort NVARCHAR(MAX) = NULL,
    @Filter NVARCHAR(MAX) = NULL
)
--WITH ENCRYPTION
AS
BEGIN
    DECLARE @UserID					INT,
            @DateType				TINYINT,
            @DateFormat				VARCHAR(10),
            @Culture				VARCHAR(10),
			@CultureNo				TINYINT,
			@New	                NVARCHAR(100),
			@Opened	                NVARCHAR(100),
			@DMDEntityID			INT,
			@DbName					VARCHAR(512),
			@Query					NVARCHAR(MAX),
			@SentMessagesQuery		NVARCHAR(MAX),
			@ReceivedMessagesQuery	NVARCHAR(MAX),
			@DraftMessagesQuery		NVARCHAR(MAX);

    SET @UserID = CFG.GetuserID();
    SET @Culture = CFG.GetuserCulture();
		
	SELECT @CultureNo = CultureNo
	FROM CFG.CultureInfo 
	WHERE Culture = @Culture;

    SELECT @DateType = us.SettingValue
    FROM CFG.UserSetting us
    WHERE us.SettingKey = 'Date_Type'
          AND us.UserID = @UserID;

    IF @DateType IS NULL
        SET @DateType = CASE @Culture 
							WHEN 'fa' THEN 0
							WHEN 'en' THEN 1
                            WHEN 'ar' THEN 2
                        END;

    SELECT @DateFormat = us.SettingValue
    FROM CFG.UserSetting us
    WHERE us.SettingKey = 'Date_Format'
          AND us.UserID = @UserID;

    IF @DateFormat IS NULL
        SET @DateFormat = 'YY/MM/DD';

    IF @Sort IS NULL OR @Sort = ''
        SET @Sort = 'Date DESC';

	SELECT @New = LV.Value
	FROM cfg.LocalizeEnum L
	JOIN cfg.LocalizeEnumValue LV
		ON L.LocalizeEnumID = LV.LocalizeEnumID
	WHERE L.Enum = 'MessageStatusEnum' 
		AND L.Item = 'New' AND LV.Culture = @Culture

	SELECT @Opened = LV.Value
	FROM cfg.LocalizeEnum L
	JOIN cfg.LocalizeEnumValue LV
		ON L.LocalizeEnumID = LV.LocalizeEnumID
	WHERE L.Enum = 'MessageStatusEnum' 
		AND L.Item = 'Opened' AND LV.Culture = @Culture

	SELECT @DMDEntityID = me.Id 
	FROM MDT.DmdEntity AS me 
	WHERE me.[Name] = 'Message'

	SELECT @DbName = c.ConfigValue
	FROM CFG.Configuration AS c
	WHERE c.ConfigKey = 'AttachmentDB';

	IF @DbName IS NULL or @DbName = ''
		SET @DbName = '';
	ELSE
		SET @DbName = QUOTENAME(@DbName) + '.';

    SET @SentMessagesQuery= N'
		;WITH Query_Result 
		(
			MessageID, Receiver, Sender, Subject, Body, IsDeleted, IsRead, UnreadCount,
			[Date], Date_Date, HasAttachment, EntityName, ModuleName, StatusString,
			Creator, CreatorUserName, CreationDate, CreateDateString, EditorName, EditionDateString, Version
		)
		AS
		(
			SELECT
				latest.MessageID,
				ISNULL(r.Receiver, '' '') AS Receiver,
				CASE WHEN @CultureNo = 1 THEN sender.Name ELSE sender.Name2 END AS Sender,
				latest.Subject,
				latest.Body,
				CAST(0 AS BIT) AS IsDeleted,
				CAST(1 AS BIT) AS IsRead,
				CAST(0 AS INT) AS UnreadCount,
				latest.CreationDate AS [Date],
				CFG.GetCLRSaturnDate(latest.CreationDate, @DateFormat, 0, @DateType) AS Date_Date,
				CAST(CASE WHEN EXISTS (
					SELECT 1 FROM ' + @DbName + N'CFG.FileAttachment fa
					INNER JOIN MDT.DmdEntity me ON me.Id = fa.MetaDataEntityID
					INNER JOIN CFG.[Message] tm ON tm.MessageID = fa.EntityRelatedID AND tm.IsDraft = 0
					WHERE me.[Name] = ''Message''
						AND (tm.MessageID = latest.ThreadRootId OR tm.RootParentID = latest.ThreadRootId)
				) THEN 1 ELSE 0 END AS BIT) AS HasAttachment,
				CASE WHEN latest.ModuleName IS NOT NULL AND latest.EntityName IS NOT NULL
					THEN latest.ModuleName + ''.'' + latest.EntityName + ''.'' + ''_title'' ELSE NULL END AS EntityName,
				latest.ModuleName AS ModuleName,
				'' '' AS StatusString,
				latest.Creator AS Creator,
				CASE WHEN @CultureNo = 1 THEN creator.Name ELSE creator.Name2 END AS CreatorUserName,
				latest.CreationDate AS CreationDate,
				CFG.GetCLRSaturnDate(latest.CreationDate, @DateFormat, 1, @DateType) AS CreateDateString,
				CASE WHEN @CultureNo = 1 THEN editor.Name ELSE editor.Name2 END AS EditorName,
				CFG.GetCLRSaturnDate(latest.LastEditionDate, @DateFormat, 1, @DateType) AS EditionDateString,
				latest.Version AS Version
			FROM (
				SELECT msg.MessageID, msg.Subject, msg.Body, msg.CreationDate, msg.Creator, msg.LastEditor,
					msg.LastEditionDate, msg.Version, msg.ModuleName, msg.EntityName, msg.SenderID,
					COALESCE(
						msg.RootParentID,
						parent.RootParentID,
						parent.MessageID,
						msg.MessageID
					) AS ThreadRootId,
					ROW_NUMBER() OVER (
						PARTITION BY COALESCE(
							msg.RootParentID,
							parent.RootParentID,
							parent.MessageID,
							msg.MessageID
						)
						ORDER BY msg.CreationDate DESC, msg.MessageID DESC
					) AS RowNum
				FROM CFG.Message msg
				LEFT JOIN CFG.Message parent ON parent.MessageID = msg.ParentID
				WHERE msg.SenderID = @UserID AND msg.IsDraft = 0 AND msg.IsSenderDeleted = 0
			) latest
			JOIN CFG.[User] sender ON latest.SenderID = sender.UserID
			JOIN CFG.[User] creator ON latest.Creator = creator.UserID
			JOIN CFG.[User] editor ON latest.LastEditor = editor.UserID
			OUTER APPLY (
				SELECT STUFF((
					SELECT '', '' + CASE WHEN @CultureNo = 1 THEN u2.Name ELSE u2.Name2 END
					FROM [CFG].[MessageRecipient] mr2
					JOIN [CFG].[User] u2 ON mr2.ReceiverID = u2.UserID
					WHERE mr2.MessageID = latest.MessageID
						AND mr2.IsDeleted = 0
						AND mr2.RecipientType IN (0, 1)
					ORDER BY mr2.RecipientType, CASE WHEN @CultureNo = 1 THEN u2.Name ELSE u2.Name2 END
					FOR XML PATH(''''), TYPE
				).value(''.'', ''NVARCHAR(MAX)''), 1, 2, '''') AS Receiver
			) r
			WHERE latest.RowNum = 1
		)';

	SET @ReceivedMessagesQuery = N'
		;WITH Query_Result 
		(
			MessageID, Receiver, Sender, Subject, Body, IsDeleted, IsRead, UnreadCount,
			[Date], Date_Date, HasAttachment, EntityName, ModuleName, StatusString,
			Creator, CreatorUserName, CreationDate, CreateDateString, EditorName, EditionDateString, Version
				)
		AS
		(
			SELECT latest.MessageID, '' '' AS Receiver,
				CASE WHEN @CultureNo = 1 THEN sender.Name ELSE sender.Name2 END AS Sender,
				latest.Subject, latest.Body,
				latest.IsDeleted,
				CAST(CASE WHEN ts.UnreadCount > 0 THEN 0 ELSE 1 END AS BIT) AS IsRead,
				ts.UnreadCount AS UnreadCount,
				latest.CreationDate AS [Date],
				CFG.GetCLRSaturnDate(latest.CreationDate, @DateFormat, 0, @DateType) AS Date_Date,
				CAST(CASE WHEN EXISTS (
					SELECT 1 FROM ' + @DbName + N'CFG.FileAttachment fa
					INNER JOIN MDT.DmdEntity me ON me.Id = fa.MetaDataEntityID
					INNER JOIN CFG.[Message] tm ON tm.MessageID = fa.EntityRelatedID AND tm.IsDraft = 0
					WHERE me.[Name] = ''Message''
						AND (tm.MessageID = latest.ThreadRootId OR tm.RootParentID = latest.ThreadRootId)
				) THEN 1 ELSE 0 END AS BIT) AS HasAttachment,
				CASE WHEN latest.ModuleName IS NOT NULL AND latest.EntityName IS NOT NULL
					THEN latest.ModuleName + ''.'' + latest.EntityName + ''.'' + ''_title'' ELSE NULL END AS EntityName,
				latest.ModuleName AS ModuleName,
				CAST(CASE WHEN ts.UnreadCount > 0 THEN @New ELSE @Opened END AS NVARCHAR(100)) AS StatusString,
				latest.Creator AS Creator,
				CASE WHEN @CultureNo = 1 THEN creator.Name ELSE creator.Name2 END AS CreatorUserName,
				latest.CreationDate AS CreationDate,
				CFG.GetCLRSaturnDate(latest.CreationDate, @DateFormat, 1, @DateType) AS CreateDateString,
				CASE WHEN @CultureNo = 1 THEN editor.Name ELSE editor.Name2 END AS EditorName,
				CFG.GetCLRSaturnDate(latest.LastEditionDate, @DateFormat, 1, @DateType) AS EditionDateString,
				latest.Version AS Version
			FROM (
				SELECT m.MessageID, m.Subject, m.Body, m.CreationDate, m.Creator, m.LastEditor, m.LastEditionDate,
					m.Version, m.ModuleName, m.EntityName, m.SenderID,
					CAST(mr.IsDeleted AS BIT) AS IsDeleted,
					ISNULL(m.RootParentID, m.MessageID) AS ThreadRootId,
					ROW_NUMBER() OVER (PARTITION BY ISNULL(m.RootParentID, m.MessageID) ORDER BY m.CreationDate DESC) AS RowNum
				FROM CFG.Message m
				JOIN CFG.MessageRecipient mr ON m.MessageID = mr.MessageID
				WHERE mr.ReceiverID = @UserID AND mr.IsDeleted = 0 AND m.IsDraft = 0
					AND NOT (m.SenderID = @UserID AND m.IsSenderDeleted = 1)
					AND (m.SenderID <> @UserID OR mr.RecipientType = 2)
			) latest
			JOIN (
				SELECT ISNULL(m.RootParentID, m.MessageID) AS ThreadRootId,
					SUM(CASE WHEN mr.IsRead = 0 THEN 1 ELSE 0 END) AS UnreadCount
				FROM CFG.Message m
				JOIN CFG.MessageRecipient mr ON m.MessageID = mr.MessageID
				WHERE mr.ReceiverID = @UserID AND mr.IsDeleted = 0 AND m.IsDraft = 0
					AND NOT (m.SenderID = @UserID AND m.IsSenderDeleted = 1)
					AND (m.SenderID <> @UserID OR mr.RecipientType = 2)
				GROUP BY ISNULL(m.RootParentID, m.MessageID)
			) ts ON ts.ThreadRootId = latest.ThreadRootId
			JOIN CFG.[User] sender ON latest.SenderID = sender.UserID
			JOIN CFG.[User] creator ON latest.Creator = creator.UserID
			JOIN CFG.[User] editor ON latest.LastEditor = editor.UserID
			WHERE latest.RowNum = 1
		)';

	SET @DraftMessagesQuery = N'
		;WITH Query_Result 
			(
			MessageID, Receiver, Sender, Subject, Body, IsDeleted, IsRead, UnreadCount,
			[Date], Date_Date, HasAttachment, EntityName, ModuleName, StatusString,
			Creator, CreatorUserName, CreationDate, CreateDateString, EditorName, EditionDateString, Version
			)
			AS
			(
			SELECT m.MessageID, '' '' AS Receiver,
				CASE WHEN @CultureNo = 1 THEN sender.Name ELSE sender.Name2 END AS Sender,
				m.Subject, m.Body,
				CAST(0 AS BIT) AS IsDeleted,
				CAST(1 AS BIT) AS IsRead,
				CAST(0 AS INT) AS UnreadCount,
				m.CreationDate AS [Date],
				CFG.GetCLRSaturnDate(m.CreationDate, @DateFormat, 0, @DateType) AS Date_Date,
				CAST(CASE WHEN EXISTS (
					SELECT 1 FROM ' + @DbName + N'CFG.FileAttachment fa
					INNER JOIN MDT.DmdEntity me ON me.Id = fa.MetaDataEntityID
					INNER JOIN CFG.[Message] tm ON tm.MessageID = fa.EntityRelatedID AND tm.IsDraft = 0
					WHERE me.[Name] = ''Message''
						AND (tm.MessageID = m.MessageID OR tm.RootParentID = ISNULL(m.RootParentID, m.MessageID))
				) THEN 1 ELSE 0 END AS BIT) AS HasAttachment,
				NULL AS EntityName,
				m.ModuleName AS ModuleName,
				'' '' AS StatusString,
				m.Creator AS Creator,
					CASE WHEN @CultureNo = 1 THEN creator.Name ELSE creator.Name2 END AS CreatorUserName,
				m.CreationDate AS CreationDate,
				CFG.GetCLRSaturnDate(m.CreationDate, @DateFormat, 1, @DateType) AS CreateDateString,
					CASE WHEN @CultureNo = 1 THEN editor.Name ELSE editor.Name2 END AS EditorName,
				CFG.GetCLRSaturnDate(m.LastEditionDate, @DateFormat, 1, @DateType) AS EditionDateString,
				m.Version AS Version
				FROM CFG.Message m
			JOIN CFG.[User] sender ON m.SenderID = sender.UserID
			JOIN CFG.[User] creator ON m.Creator = creator.UserID
			JOIN CFG.[User] editor ON m.LastEditor = editor.UserID
			WHERE m.IsDraft = 1 AND m.SenderID = @UserID AND m.IsSenderDeleted = 0
			)';

	IF @ListMode = 1
		SET @Query = @SentMessagesQuery
	ELSE IF @ListMode = 2
		SET @Query = @DraftMessagesQuery
	ELSE 
		SET @Query = @ReceivedMessagesQuery

    PRINT @Query;

    IF @Filter IS NULL OR @Filter = ''
        SET @Filter = '';
    ELSE
        SET @Filter = 'Where (' + @Filter + ')';

    DECLARE @tableName VARCHAR(100);
    SET @tableName = CFG.getTempTableName(1);

    SET @Query = CFG.ApplyPaging(@tableName, @Query, @PageNumber, @RowspPage, @Filter, @Sort);

    PRINT SYSDATETIME();
    EXECUTE sp_executesql @Query,
		N'@UserID INT, @DateType TINYINT, @DateFormat VARCHAR(10), @Culture VARCHAR(10),
		  @CultureNo TINYINT, @DMDEntityID INT, @New NVARCHAR(100), @Opened NVARCHAR(100)',
        @UserID = @UserID, @DateType = @DateType, @DateFormat = @DateFormat,
		@Culture = @Culture, @CultureNo = @CultureNo, @DMDEntityID = @DMDEntityID,
		@New = @New, @Opened = @Opened;

    PRINT SYSDATETIME();
    DECLARE @Count INT;
    EXEC ('SELECT * FROM ' + @tableName + ' ORDER BY _RN');

    SET @Query = N'select top 1 @Count= r_count from ' + @tableName;
    EXECUTE sp_executesql @Query, N'@count int out', @Count = @Count OUT;

    RETURN ISNULL(@Count, 0);
END;
