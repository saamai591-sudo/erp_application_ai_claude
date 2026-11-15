------------------------------------- START #8961
CREATE   PROCEDURE [CFG].[AddEntityIntoDmdEntityTables]
(
    @schema NVARCHAR(20),
    @ModuleName NVARCHAR(200),
    @entityName NVARCHAR(100),
    @persianTitle NVARCHAR(100),
    @englishTitle NVARCHAR(100),
    @IsAttachementEnabled NVARCHAR(5) = 'false',
    @IsLogEnabled NVARCHAR(5) = 'false',
    @IsCustomFieldEnabled NVARCHAR(5) = 'false',
    @IsTracable NVARCHAR(5) = 'false',
    @PreVoucherable NVARCHAR(5) = 'false',
    @IsFlowable NVARCHAR(5) = 'false',
    @SpecialTableName NVARCHAR(200) = null,
    @Surveyable NVARCHAR(5) = 'false'
)
AS
BEGIN

    DECLARE @DmdModuleID INT;

    SELECT @DmdModuleID = dm.ID
    FROM MDT.DmdModule AS dm
    WHERE dm.Name = @ModuleName;

    DECLARE @firstLangCulture VARCHAR (25);
    DECLARE @secondLangCulture VARCHAR (25);

    SELECT @firstLangCulture = Culture FROM cfg.CultureInfo
    WHERE CultureNo = 1

    SELECT @secondLangCulture = Culture FROM cfg.CultureInfo
    WHERE CultureNo = 2

    IF @firstLangCulture IS NULL
    SET @firstLangCulture = 'fa';

    IF @secondLangCulture IS NULL AND 
    @firstLangCulture = 'fa'
        SET @secondLangCulture = 'en'

    IF @secondLangCulture IS NULL AND 
    @firstLangCulture = 'en'
        SET @secondLangCulture = 'fa'


    IF NOT EXISTS
    (
        SELECT 1
        FROM MDT.DmdEntity AS de
        WHERE de.DmdModuleID = @DmdModuleID
              AND de.Name = @entityName
    )
    BEGIN

        DECLARE @attribute NVARCHAR(MAX);

        SET @attribute
            = N'{"IsAttachementEnabled":"' + @IsAttachementEnabled + N'","IsLogEnabled":"' + @IsLogEnabled
              + N'","IsCustomFieldEnabled":"' + @IsCustomFieldEnabled + N'","IsTracable":"' + @IsTracable
              + N'","PreVoucherable":"' + @PreVoucherable + N'","IsFlowable":"' + @IsFlowable 
              + N'","Surveyable":"' + @Surveyable + N'"}';

        INSERT MDT.DmdEntity
        (
            DmdModuleID,
            Name,
            Type,
            Attributes
        )
        VALUES
        (   @DmdModuleID, -- DmdModuleID - int
            @entityName,  -- Name - nvarchar(100)
            1,            -- Type - tinyint
            @attribute);

    END;

    IF NOT EXISTS
    (
        SELECT 1
        FROM MDT.DmdTranslateItem AS dti
        WHERE dti.Value = @persianTitle
    )
    BEGIN

        INSERT INTO MDT.DmdTranslateItem
        (
            [Value],
            Lang,
            Culture
        )
        VALUES
        (@persianTitle, 1, @firstLangCulture);
    END;

    IF NOT EXISTS
    (
        SELECT 1
        FROM MDT.DmdTranslateItem
        WHERE Value = @englishTitle
    )
    BEGIN

        INSERT INTO MDT.DmdTranslateItem
        (
            [Value],
            Lang, 
            Culture
        )
        VALUES
        (@englishTitle, 2, @secondLangCulture);

    END;

    IF NOT EXISTS
    (
        SELECT 1
        FROM MDT.DmdRelatedEntityTranslate AS dret
        WHERE EXISTS
        (
            SELECT 1
            FROM MDT.DmdEntity AS m
            WHERE m.Name = @entityName
                  AND dret.DmdEntityID = m.ID
        )
              AND EXISTS
        (
            SELECT 1
            FROM MDT.DmdTranslateItem AS mi
            WHERE mi.Value = @persianTitle
                  AND dret.DmdTranslateItemID = mi.ID
        )
    )
        INSERT INTO MDT.DmdRelatedEntityTranslate
        (
            DmdEntityID,
            DmdTranslateItemID
        )
        SELECT
            (
                SELECT m.ID FROM MDT.DmdEntity AS m WHERE m.Name = @entityName
            ),
            (
                SELECT mi.ID
                FROM MDT.DmdTranslateItem AS mi
                WHERE mi.Value = @persianTitle
            );

    IF NOT EXISTS
    (
        SELECT 1
        FROM MDT.DmdRelatedEntityTranslate
        WHERE EXISTS
        (
            SELECT m.ID
            FROM MDT.DmdEntity AS m
            WHERE m.Name = @entityName
                  AND DmdEntityID = m.ID
        )
              AND EXISTS
        (
            SELECT mi.ID
            FROM MDT.DmdTranslateItem AS mi
            WHERE mi.Value = @englishTitle
                  AND DmdTranslateItemID = mi.ID
        )
    )
        INSERT INTO MDT.DmdRelatedEntityTranslate
        (
            DmdEntityID,
            DmdTranslateItemID
        )
        SELECT
            (
                SELECT m.ID FROM MDT.DmdEntity AS m WHERE m.Name = @entityName
            ),
            (
                SELECT mi.ID
                FROM MDT.DmdTranslateItem AS mi
                WHERE mi.Value = @englishTitle
            );


    DECLARE @TargetTableName NVARCHAR(128);
    SET @TargetTableName = ISNULL(@SpecialTableName, @entityName);

    IF NOT EXISTS
    (
        SELECT 1
        FROM MDT.DmdTable AS dt
        WHERE dt.Name = @TargetTableName
    )
    BEGIN

        INSERT MDT.DmdTable
        (
            Name,
            [Schema],
            Type
        )
        SELECT t.TABLE_NAME,
               t.TABLE_SCHEMA,
               1
        FROM INFORMATION_SCHEMA.TABLES AS t
        WHERE t.TABLE_NAME = @TargetTableName;

    END;

    IF NOT EXISTS
    (
        SELECT 1
        FROM MDT.DmdColumn AS dt
        WHERE dt.TableName = @TargetTableName
              AND dt.TableSchema = @schema
    )
    BEGIN

        INSERT MDT.DmdColumn
        (
            TableName,
            TableSchema,
            Name,
            AllowNull,
            DataType,
            DefaultValue,
            IsCalculated,
            IsKey
        )
        SELECT t.TABLE_NAME,
               t.TABLE_SCHEMA,
               t.COLUMN_NAME,
               CASE
                   WHEN t.IS_NULLABLE = 'NO' THEN
                       0
                   ELSE
                       1
               END,
               t.DATA_TYPE,
               NULL,
               0,
               CASE
                   WHEN t.COLUMN_NAME = @TargetTableName + 'ID' THEN
                       1
                   ELSE
                       0
               END
        FROM INFORMATION_SCHEMA.COLUMNS AS t
        WHERE t.TABLE_NAME = @TargetTableName;
    END;

    IF NOT EXISTS
    (
        SELECT 1
        FROM MDT.DmdEntityTableRelation AS detr
        WHERE EXISTS
        (
            SELECT m.ID
            FROM MDT.DmdEntity AS m
            WHERE m.Name = @entityName
                  AND detr.DmdEntityID = m.ID
        )
              AND EXISTS
        (
            SELECT m2.ID
            FROM MDT.DmdTable AS m2
            WHERE detr.DmdTableID = m2.ID AND
                m2.Name = @TargetTableName
        )
    )
        INSERT INTO MDT.DmdEntityTableRelation
        (
            DmdEntityID,
            DmdTableID,
            RelationType
        )
        VALUES
        (
            (
                SELECT m.ID FROM MDT.DmdEntity AS m WHERE m.Name = @entityName
            ),
            ( 
                SELECT m2.ID FROM MDT.DmdTable AS m2 
				WHERE m2.Name = @TargetTableName
            ), 1);
END;
