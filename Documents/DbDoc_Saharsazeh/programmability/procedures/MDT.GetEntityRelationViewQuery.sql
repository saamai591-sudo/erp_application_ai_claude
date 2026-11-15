-------------------------------------
CREATE   PROC [MDT].GetEntityRelationViewQuery
(
    @entityId INT,
    @parentID NVARCHAR(MAX) = NULL,
    @Attribute NVARCHAR(MAX),
    @queryValue NVARCHAR(MAX) OUTPUT
)
--WITH ENCRYPTION
AS
BEGIN

    IF OBJECT_ID('tempdb..#t') IS NOT NULL
        DROP TABLE #t;

    IF OBJECT_ID('tempdb..#tt') IS NOT NULL
        DROP TABLE #tt;

    DECLARE @query NVARCHAR(MAX),
            @Culture VARCHAR(10),
            @UserID INT,
            @DateType TINYINT,
            @DateFormat VARCHAR(10);

    SET @Culture = CFG.GetuserCulture();
    SET @UserID = CFG.GetuserID();

    SELECT m.[Table],
           m.IsActive,
           m.ViewKey,
           m.Childrens,
           mt.[Schema],
           col.ColName AS KeyField,
           mev.Attribute,
           mev.[Name],
           mt.EngName,
           mt.TranslateTitle
    INTO #tt
    FROM
    (SELECT oj.[Key], oj.[Value] FROM OPENJSON(@Attribute) AS oj) AS A
    PIVOT
    (
        MAX([Value])
        FOR [Key] IN ([Table], [IsActive], [ViewKey], [Childrens])
    ) m
        JOIN
        (
            SELECT mt1.Name,
                   mt1.[Schema],
                   me.Name EngName,
                   mti.[Value] AS TranslateTitle
            FROM MDT.DmdTable AS mt1
                JOIN MDT.DmdEntityTableRelation AS mr
                    ON mt1.ID = mr.DmdTableID
                JOIN MDT.DmdEntity AS me
                    ON me.ID = mr.DmdEntityID
                JOIN MDT.DmdRelatedEntityTranslate AS mr2
                    ON mr2.DmdEntityID = me.ID
                JOIN MDT.DmdTranslateItem AS mti
                    ON mti.ID = mr2.DmdTranslateItemID
            WHERE mti.[Culture] = @Culture
        ) AS mt
            ON mt.[Name] = m.[Table]
        JOIN
        (
            SELECT mc.TableName,
                   mc.Name ColName
            FROM MDT.DmdColumn AS mc
            WHERE mc.IsKey = 1
        ) col
            ON col.TableName = m.[Table]
        LEFT JOIN MDT.DmdEntityView AS mev
            ON mev.[Key] = m.ViewKey
    WHERE m.IsActive = 'true';

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
                            WHEN 'ar' THEN
                                2
                        END;

    SELECT @DateFormat = us.SettingValue
    FROM CFG.UserSetting us
    WHERE us.SettingKey = 'Date_Format'
          AND us.UserID = @UserID;

    IF @DateFormat IS NULL
        SET @DateFormat = 'YY/MM/DD';

    SELECT @query
        = N'SELECT  ''' + #tt.TranslateTitle + N''' As FormTitle , ''' + CAST(Attribute AS NVARCHAR(MAX))
          + N''' As Columns ,''' + CAST(@Attribute AS NVARCHAR(MAX)) + N''' As Attribute ,'''
          + CAST(EngName AS NVARCHAR(MAX)) + N''' as EngName ,'
          + CASE
                WHEN @parentID IS NOT NULL THEN
                    '''' + CAST(@parentID AS NVARCHAR(100)) + ''' AS parent,'
                ELSE
                    ''
            END
          +
    (
        SELECT STUFF(
    (
        SELECT DISTINCT
               ', '
               + CASE
                     WHEN m.[Table] IS NOT NULL THEN
                         '(SELECT ' + CASE
                                          WHEN m.DataType = 'date' THEN
                                              ' CFG.GetCLRSaturnDate(' + m.[Name] + ',''YYYY/MM/DD'',0,0)  AS ' + m.[Name]
                                          ELSE
                                              m.[Name]
                                      END + +' FROM ' + mt.[Schema] + '.' + m.[Table] + ' WHERE ' + c.fromCol + ' = '
                         + c.toCol + ' ) AS ' + m.Name
                     ELSE
                         CASE
                             WHEN m.DataType = 'date' THEN
                                 ' CFG.GetCLRSaturnDate(' + m.[Name] + ',''YYYY/MM/DD'',0,0)  AS ' + m.[Name]
                             WHEN m.IsKey = 1 THEN
                                 m.Name + ' AS [ViewModelID] ,' + '''' + #tt.[Table] + '''+ cast(' + m.Name
                                 + ' as nvarchar(100)) As [key]'
                             ELSE
                                 m.Name
                         END
                 END
        FROM
        (
            SELECT SalesOrderJsonData.[Table],
                   SalesOrderJsonData.Name,
                   SalesOrderJsonData.Title,
                   SalesOrderJsonData.DataType,
                   SalesOrderJsonData.IsKey
            FROM
                OPENJSON(Attribute)
                WITH
                (
                    [Table] NVARCHAR(200) N'$.Table',
                    [Name] NVARCHAR(200) N'$.Name',
                    [Title] NVARCHAR(200) N'$.Title',
                    [DataType] NVARCHAR(200) N'$.dataType',
                    [IsKey] BIT N'$.IsKey'
                ) AS SalesOrderJsonData
        ) m
            LEFT JOIN MDT.DmdTable AS mt
                ON mt.Name = m.[Table]
            LEFT JOIN
            (
                SELECT dc.TableName,
                       dc.[Name]
                FROM MDT.DmdColumn AS dc
                WHERE IsKey = 1
            ) AS mc
                ON mc.TableName = mt.Name
            LEFT JOIN
            (
                SELECT mt2.Name srcTable,
                       mt.Name refCol,
                       mt2.Name + '.' + metr.FromColumn fromCol,
                       mt.Name + '.' + metr.ToColumn toCol
                FROM MDT.DmdTable AS mt
                    JOIN MDT.DmdTableRelation AS metr
                        ON metr.FromTableID = mt.ID
                    JOIN MDT.DmdTable AS mt2
                        ON metr.ToTableID = mt2.ID
            ) c
                ON c.refCol = m.[Table]
                   AND c.srcTable = #tt.[Table]
        FOR XML PATH(''), TYPE
    ).value('.', 'nvarchar(max)'),
    1       ,
    1       ,
    ''
                    )
    )     + N' FROM ' + [Schema] + N'.' + [Table] + N' WHERE ' + KeyField + N' = ' + CAST(@entityId AS NVARCHAR(100))
    FROM #tt;

    SET @queryValue = @query;

END;
