CREATE    PROC CFG.GetLookupQueryInfo
    (
        @LookupDataID INT
    )
AS
    BEGIN

        DECLARE @qury NVARCHAR(MAX) ,
                @valueField NVARCHAR(150) ,
                @attribute NVARCHAR(MAX) ,
                @displayField NVARCHAR(150);

        SELECT @qury = JSON_VALUE(ld.Attribute, '$.Query') ,
               @valueField = JSON_VALUE(ld.Attribute, '$.MainTableKey') ,
               @attribute = ld.Attribute
        FROM   CFG.LookupData AS ld
        WHERE  ld.LookupDataID = @LookupDataID;


        SELECT [Value]
        INTO   #cols
        FROM   OPENJSON((   SELECT Value
                            FROM   OPENJSON(@attribute)
                            WHERE  [Key] = 'Columns' ));


        IF @valueField IS NULL
            BEGIN

                SELECT @valueField = JSON_VALUE(c.[Value], '$.Name')
                FROM   #cols AS c
                WHERE  JSON_VALUE(c.[Value], '$.IsKey') = 'true';
            END;

        SELECT @displayField = JSON_VALUE(c.[Value], '$.Name')
        FROM   #cols AS c
        WHERE  JSON_VALUE(c.[Value], '$.ShowInLookup') = 'true'
               AND JSON_VALUE(c.[Value], '$.MainKey') = 'true';

        IF @displayField IS NULL
            BEGIN
                SELECT TOP 1 @displayField = JSON_VALUE(c.[Value], '$.Name')
                FROM   #cols AS c
                WHERE  JSON_VALUE(c.[Value], '$.ShowInLookup') = 'true';
            END;



        SELECT LOWER(@qury) AS [Value] ,
               LOWER(@valueField) AS Value1 ,
               LOWER(@displayField) AS Value2;
    END;
