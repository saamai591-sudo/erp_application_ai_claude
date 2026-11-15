CREATE   PROCEDURE [CFG].[GetEntityAuditingInfo]
(
    @engName VARCHAR(128),
    @id BIGINT
)
AS
BEGIN

    DECLARE @UserID INT,
            @DateType TINYINT,
            @DateFormat VARCHAR(10),
            @Query NVARCHAR(MAX);

    SET @UserID = CFG.GetuserID();

    IF @engName = 'QuantityOutgoing'
       OR @engName = 'AmountOutgoing'
        SET @engName = 'Outgoing';

    SELECT @DateType = us.SettingValue
    FROM CFG.UserSetting us
    WHERE us.SettingKey = 'Date_Type'
          AND us.UserID = @UserID;

    IF @DateType IS NULL
        SET @DateType = CASE CFG.GetuserCulture()
                            WHEN 'fa' THEN
                                0
                            WHEN 'en' THEN
                                1
                            WHEN 'ar' THEN
                                2
                        END;

    SELECT @DateFormat = us.SettingValue
    FROM CFG.UserSetting us
    WHERE us.SettingKey = 'Date_Format'
          AND us.UserID = @UserID;

    IF @DateFormat IS NULL
        SET @DateFormat = 'YY/MM/DD';
        
    if @engName = 'ProcessDefList'
    BEGIN
    	SELECT TOP 1 
	       u.Name AS CreatorUserName,
	       u2.Name AS EditorName,
	       CFG.GetCLRSaturnDate(v.CreationDate, @DateFormat, 1, @DateType) AS CreateDateString,
	       CFG.GetCLRSaturnDate(v.LastEditionDate, @DateFormat, 1, @DateType) AS EditionDateString
	    FROM   [FLW].[WfProcess] AS v
	       INNER JOIN cfg.[User]  AS u ON  u.UserID = v.Creator
	       INNER JOIN cfg.[User]  AS u2 ON  u2.UserID = v.LastEditor
	    WHERE  v.ID =  @id
        RETURN 
    END

    DECLARE @TableName NVARCHAR(128),
            @tableKey NVARCHAR(129);

    SELECT @TableName = QUOTENAME(m2.[Schema]) + N'.' + QUOTENAME(m2.Name)
    FROM MDT.DmdEntity AS m
        JOIN MDT.DmdEntityTableRelation AS mtr
            ON m.ID = mtr.DmdEntityID
        JOIN MDT.DmdTable AS m2
            ON m2.ID = mtr.DmdTableID
    WHERE m.Name = @engName
          AND mtr.RelationType = 1;

    SELECT @tableKey = m2.Name
    FROM MDT.DmdColumn AS m2
    WHERE QUOTENAME(m2.TableSchema) + '.' + QUOTENAME(m2.TableName) = @TableName
          AND m2.IsKey = 1;

    if @TableName IS NULL
    BEGIN
        SELECT @TableName =  QUOTENAME(TABLE_SCHEMA) + N'.' + QUOTENAME(TABLE_NAME)
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_TYPE = 'BASE TABLE' and TABLE_NAME = @engName and TABLE_SCHEMA <> 'dbo'

		SET @tableKey = @engName + 'ID'
    END

    SET @Query
        = N'
	SELECT TOP 1 
	       u.Name AS CreatorUserName,
	       u2.Name AS EditorName,
	       CFG.GetCLRSaturnDate(v.CreationDate, ''' + CAST(@DateFormat AS VARCHAR(100)) + N''', 1, '
          + CAST(@DateType AS VARCHAR(100))
          + N') AS CreateDateString,
	       CFG.GetCLRSaturnDate(v.LastEditionDate, ''' + CAST(@DateFormat AS VARCHAR(100)) + N''', 1, '
          + CAST(@DateType AS VARCHAR(100)) + N') AS EditionDateString
	FROM   ' + @TableName
          + N' AS v
	       INNER JOIN cfg.[User]  AS u ON  u.UserID = v.Creator
	       INNER JOIN cfg.[User]  AS u2 ON  u2.UserID = v.LastEditor
	WHERE  v.' + @tableKey + N' =  ' + CAST(@id AS VARCHAR(100));

    print @Query

    EXEC (@Query);

END;
