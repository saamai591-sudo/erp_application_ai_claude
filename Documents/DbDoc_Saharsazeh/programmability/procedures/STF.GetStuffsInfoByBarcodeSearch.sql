
-----------------------------------------------------------
CREATE   PROCEDURE STF.GetStuffsInfoByBarcodeSearch
(@barcodes dbo.BarcodeList READONLY)
AS
BEGIN

    CREATE TABLE #result
    (
        ID UNIQUEIDENTIFIER NOT NULL,
        StuffID INT NOT NULL,
        Code NVARCHAR(500) NOT NULL,
        Title NVARCHAR(500) NOT NULL,
        Title2 NVARCHAR(500) NOT NULL,
        MainQuantity DECIMAL(30, 4) NOT NULL,
        SubQuantity DECIMAL(30, 4) NULL,
        BarCode NVARCHAR(MAX) NULL,
        Price DECIMAL(30, 4) NOT NULL
    );

    INSERT #result
    (
        ID,
        StuffID,
        Code,
        Title,
        Title2,
        MainQuantity,
        SubQuantity,
        BarCode,
        Price
    )
    SELECT td.ID,
           s.StuffID,
           s.code,
           s.Title,
           s.Title2,
           CAST(1 AS DECIMAL(30, 4)) AS MainQuantity,
           CAST(NULL AS DECIMAL(30, 4)) AS SubQuantity,
           td.Code,
           0
    FROM STF.[VWStuff] AS s
        JOIN @barcodes AS td
            ON s.Barcode = td.Code;
            

    INSERT #result
    (
        ID,
        StuffID,
        Code,
        Title,
        Title2,
        MainQuantity,
        SubQuantity,
        BarCode,
        Price
    )
    SELECT td.ID,
           s.StuffID,
           s.Code,
           s.Title,
           s.Title2,
           CAST(1 AS DECIMAL(30, 4)) AS MainQuantity,
           CAST(NULL AS DECIMAL(30, 4)) AS SubQuantity,
           sd.IranCode,
           0
    FROM STF.[Stuff] AS s
    JOIN stf.StuffDetail AS sd ON s.StuffID = sd.StuffID
        JOIN @barcodes AS td
            ON sd.IranCode = td.Code
        LEFT JOIN #result ol
            ON ol.StuffID = s.StuffID
    WHERE ol.StuffID IS NULL;



    INSERT #result
    (
        ID,
        StuffID,
        Code,
        Title,
        Title2,
        MainQuantity,
        SubQuantity,
        BarCode,
        Price
    )
    SELECT td.ID,
           s.StuffID,
           s.code,
           s.Title,
           s.Title2,
           CAST(1 AS DECIMAL(30, 4)) AS MainQuantity,
           CAST(NULL AS DECIMAL(30, 4)) AS SubQuantity,
           s.code,
           0
    FROM STF.[VWStuff] AS s
        JOIN @barcodes AS td
            ON s.code = td.Code
        LEFT JOIN #result ol
            ON ol.StuffID = s.StuffID
    WHERE ol.StuffID IS NULL;


    IF
    (
        SELECT COUNT(1)FROM @barcodes
    ) <>
    (
        SELECT COUNT(1)FROM #result
    )
    BEGIN


        SELECT p.BarcodeInterpretationID,
               p.[1],
               p.[3],
               p.[4],
               p.[6],
               p.[7],
               p.[8]
        INTO #Interpretet
        FROM
        (
            SELECT BarcodeInterpretationID,
                   Type,
                   CAST(Position AS VARCHAR(10)) + ',' + CAST(Length AS VARCHAR(10)) value
            FROM STF.BarcodeInterpretationItem
            WHERE TraceID IS NULL --type in (1,3,4,6,7,8)
        ) x
        PIVOT
        (
            MAX(value)
            FOR Type IN ([1], [3], [4], [6], [7], [8])
        ) p;

        INSERT #result
        (
            ID,
            StuffID,
            Code,
            Title,
            Title2,
            MainQuantity,
            SubQuantity,
            BarCode,
            Price
        )
        SELECT td.ID,
               s.StuffID,
               s.code,
               s.Title,
               s.Title2,
               (CASE
                    WHEN bii.[3] IS NOT NULL THEN
                        CAST(SUBSTRING(
                                          td.Code,
                                          CAST([CFG].[GetStringPart](bii.[3], 1) AS INT),
                                          CAST([CFG].[GetStringPart](bii.[3], 2) AS INT)
                                      ) AS DECIMAL(30, 4))
                    WHEN bii.[4] IS NOT NULL THEN
                        CAST(SUBSTRING(
                                          td.Code,
                                          CAST([CFG].[GetStringPart](bii.[4], 1) AS INT),
                                          CAST([CFG].[GetStringPart](bii.[4], 2) AS INT)
                                      ) AS DECIMAL(30, 4)) * s.ConvertRatio
                    ELSE
                        1
                END
               )
               +
               ----------------decimal value---------
               (CASE
                    WHEN bii.[8] IS NOT NULL THEN
                        CAST(SUBSTRING(
                                          td.Code,
                                          CAST([CFG].[GetStringPart](bii.[8], 1) AS INT),
                                          CAST([CFG].[GetStringPart](bii.[8], 2) AS INT)
                                      ) AS DECIMAL(30, 4)) / POWER(10, CAST([CFG].[GetStringPart](bii.[8], 2) AS INT))
                    ELSE
                        0
                END
               )
               ----------------------
               AS MainQuantity,
               CASE
                   WHEN bii.[4] IS NULL THEN
                       NULL
                   ELSE
                       CAST(SUBSTRING(
                                         td.Code,
                                         CAST([CFG].[GetStringPart](bii.[4], 1) AS INT),
                                         CAST([CFG].[GetStringPart](bii.[4], 2) AS INT)
                                     ) AS DECIMAL(30, 4))
               END AS SubQuantity,
               td.Code,
               CASE
                   WHEN bii.[7] IS NULL THEN
                       0
                   ELSE
                       CAST(SUBSTRING(
                                         td.Code,
                                         CAST([CFG].[GetStringPart](bii.[7], 1) AS INT),
                                         CAST([CFG].[GetStringPart](bii.[7], 2) AS INT)
                                     ) AS DECIMAL(30, 4))
               END AS Price
        FROM @barcodes AS td
            JOIN
            (
                SELECT bii.BarcodeInterpretationID,
                       SUM(bii.Length) AS TotalLength
                FROM STF.BarcodeInterpretationItem AS bii
                GROUP BY bii.BarcodeInterpretationID
            ) l
                ON l.TotalLength = LEN(td.Code)
            JOIN #Interpretet AS bii
                ON bii.BarcodeInterpretationID = l.BarcodeInterpretationID
            JOIN STF.VWStuff s
                ON s.code = SUBSTRING(
                                         td.Code,
                                         CAST([CFG].[GetStringPart](bii.[1], 1) AS INT),
                                         CAST([CFG].[GetStringPart](bii.[1], 2) AS INT)
                                     );
                                     

        INSERT #result
        (
            ID,
            StuffID,
            Code,
            Title,
            Title2,
            MainQuantity,
            SubQuantity,
            BarCode,
            Price
        )
        SELECT td.ID,
               s.StuffID,
               s.code,
               s.Title,
               s.Title2,(
               CASE
                   WHEN bii.[3] IS NOT NULL THEN
                       CAST(SUBSTRING(
                                         td.Code,
                                         CAST([CFG].[GetStringPart](bii.[3], 1) AS INT),
                                         CAST([CFG].[GetStringPart](bii.[3], 2) AS INT)
                                     ) AS DECIMAL(30, 4))
                   WHEN bii.[4] IS NOT NULL THEN
                       CAST(SUBSTRING(
                                         td.Code,
                                         CAST([CFG].[GetStringPart](bii.[4], 1) AS INT),
                                         CAST([CFG].[GetStringPart](bii.[4], 2) AS INT)
                                     ) AS DECIMAL(30, 4)) * s.ConvertRatio
                   ELSE
                       1
               END)
               +  (CASE
                    WHEN bii.[8] IS NOT NULL THEN
                        CAST(SUBSTRING(
                                          td.Code,
                                          CAST([CFG].[GetStringPart](bii.[8], 1) AS INT),
                                          CAST([CFG].[GetStringPart](bii.[8], 2) AS INT)
                                      ) AS DECIMAL(30, 4)) / POWER(10, CAST([CFG].[GetStringPart](bii.[8], 2) AS INT))
                    ELSE
                        0
                END
               )
               
                AS MainQuantity,
               CASE
                   WHEN bii.[4] IS NULL THEN
                       NULL
                   ELSE
                       CAST(SUBSTRING(
                                         td.Code,
                                         CAST([CFG].[GetStringPart](bii.[4], 1) AS INT),
                                         CAST([CFG].[GetStringPart](bii.[4], 2) AS INT)
                                     ) AS DECIMAL(30, 4))
               END AS SubQuantity,
               td.Code,
               CASE
                   WHEN bii.[7] IS NULL THEN
                       0
                   ELSE
                       CAST(SUBSTRING(
                                         td.Code,
                                         CAST([CFG].[GetStringPart](bii.[7], 1) AS INT),
                                         CAST([CFG].[GetStringPart](bii.[7], 2) AS INT)
                                     ) AS DECIMAL(30, 4))
               END AS Price
               
        FROM @barcodes AS td
            JOIN
            (
                SELECT bii.BarcodeInterpretationID,
                       SUM(bii.Length) AS TotalLength
                FROM STF.BarcodeInterpretationItem AS bii
                GROUP BY bii.BarcodeInterpretationID
            ) l
                ON l.TotalLength = LEN(td.Code)
            JOIN #Interpretet AS bii
                ON bii.BarcodeInterpretationID = l.BarcodeInterpretationID
            JOIN STF.VWStuff s
                ON s.Barcode = SUBSTRING(
                                             td.Code,
                                             CAST([CFG].[GetStringPart](bii.[6], 1) AS INT),
                                             CAST([CFG].[GetStringPart](bii.[6], 2) AS INT)
                                         )  ;
										 PRINT 222222
    END;



    CREATE TABLE #result1
    (
        ID UNIQUEIDENTIFIER,
        TraceId INT,
        [Key] NVARCHAR(500),
        [Value] NVARCHAR(500)
    );





    INSERT #result1
    (
        ID,
        TraceId,
        [Key],
        Value
    )
    SELECT td.ID,
           bii.TraceID AS TraceId,
           N'TR' + CAST(bii.TraceID AS NVARCHAR(20)) AS [Key],
           CASE  t.AccountLevelTypeID WHEN 2 then CAST(CAST( SUBSTRING(td.Code, bii.Position, bii.Length) as INT) as NVARCHAR(50))  
           	when 3 then  FORMAT(CAST( SUBSTRING(td.Code, bii.Position, bii.Length) as DECIMAL(36,10)) ,'0.##########')
           	else CAST(SUBSTRING(td.Code, bii.Position, bii.Length) as NVARCHAR(50)) END
           	 AS [Value]
    FROM @barcodes AS td
        JOIN
        (
            SELECT bii.BarcodeInterpretationID,
                   SUM(bii.Length) AS TotalLength
            FROM STF.BarcodeInterpretationItem AS bii
            GROUP BY bii.BarcodeInterpretationID
        ) l
            ON l.TotalLength = LEN(td.Code)
        JOIN STF.BarcodeInterpretationItem AS bii
            ON l.BarcodeInterpretationID = bii.BarcodeInterpretationID
               AND bii.Type = 5
               AND bii.TraceID IS NOT NULL
               join stf.Trace AS t on t.TraceID = bii.TraceID               ;


    SELECT ID,
           StuffID,
           Code,
           Title,
           Title2,
           MainQuantity,
           SubQuantity,
           BarCode,
           Price
    FROM #result;
    SELECT ID,
           TraceId,
           [Key],
           Value
    FROM #result1;


END;
