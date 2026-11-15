CREATE     PROC [STC].[FindStuffBySearchString]
(@searchText NVARCHAR(MAX))
AS
BEGIN

    IF EXISTS
    (
        SELECT 1
        FROM STF.StuffDetail AS sd
        WHERE sd.Barcode = @searchText
    )
    BEGIN
       SELECT s.StuffID,
               STF.GetStuffCode(s.StuffID) Code,
               s.Title,
               s.Title2,
               CAST(1 AS DECIMAL(30, 4)) AS MainQuantity,
               CAST(NULL AS DECIMAL(30, 4)) AS SubQuantity
        FROM STF.[Stuff] AS s
            JOIN STF.StuffDetail AS sd
                ON sd.StuffID = s.StuffID
                WHERE sd.Barcode = @searchText

        SELECT TOP(0) NULL AS TraceId,
               NULL AS [Key],
               NULL AS [Value];
    END;
    ELSE
    BEGIN

        DECLARE @searchTextLength INT = LEN(@searchText),
                @BarcodeInterpretationID INT;

        SELECT @BarcodeInterpretationID = a.BarcodeInterpretationID,
               @searchTextLength = a.TotalLength
        FROM
        (
            SELECT BarcodeInterpretationID,
                   SUM(bii.Length) AS TotalLength
            FROM STF.BarcodeInterpretationItem AS bii
            GROUP BY bii.BarcodeInterpretationID
        ) AS a
        WHERE a.TotalLength = @searchTextLength;

        IF @BarcodeInterpretationID IS NOT NULL
        BEGIN
            PRINT 'Find Match Barcode Interpretation';
            DECLARE @codePosition INT,
                    @codeLength INT,
                    @barCodePosition INT,
                    @barCodeLength INT,
                    @mainQuantityLength INT,
                    @mainQuantityPosition INT,
                    @subQuantityLength INT,
                    @subQuantityPosition INT,
                    @codeStr NVARCHAR(200),
                    @barcodeStr NVARCHAR(200),
                    @mainQuantityStr NVARCHAR(200),
                    @subQuantityStr NVARCHAR(200);

            -- code type 1
            SELECT @codeLength = bii.[Length],
                   @codePosition = bii.Position
            FROM STF.BarcodeInterpretationItem AS bii
            WHERE bii.Type = 1
                  AND bii.BarcodeInterpretationID = @BarcodeInterpretationID;

            -- mainQuantity type 3
            SELECT @mainQuantityLength = bii.[Length],
                   @mainQuantityPosition = bii.Position
            FROM STF.BarcodeInterpretationItem AS bii
            WHERE bii.Type = 3
                  AND bii.BarcodeInterpretationID = @BarcodeInterpretationID;

            -- SubQuantity type 4
            SELECT @subQuantityLength = bii.[Length],
                   @subQuantityPosition = bii.Position
            FROM STF.BarcodeInterpretationItem AS bii
            WHERE bii.Type = 4
                  AND bii.BarcodeInterpretationID = @BarcodeInterpretationID;

            -- barcode type 6
            SELECT @barCodeLength = bii.[Length],
                   @barCodePosition = bii.Position
            FROM STF.BarcodeInterpretationItem AS bii
            WHERE bii.Type = 6
                  AND bii.BarcodeInterpretationID = @BarcodeInterpretationID;

            SET @codeStr = SUBSTRING(@searchText, @codePosition - 1, @codePosition + @codeLength);
            SET @barcodeStr = SUBSTRING(@searchText, @barCodePosition - 1, @barCodePosition + @barCodeLength);
            SET @mainQuantityStr
                = SUBSTRING(@searchText, @mainQuantityPosition - 1, @mainQuantityPosition + @mainQuantityLength);
            SET @subQuantityStr
                = SUBSTRING(@searchText, @subQuantityPosition - 1, @subQuantityPosition + @barCodeLength);

            IF EXISTS
            (
                SELECT 1
                FROM STF.Stuff AS s
                    JOIN STF.StuffDetail AS sd
                        ON sd.StuffID = s.StuffID
                WHERE (
                          @codeStr IS NULL
                          OR s.Code = @codeStr
                      )
                      AND
                      (
                          @barcodeStr IS NULL
                          OR sd.Barcode = @barcodeStr
                      )
            )
            BEGIN

                SELECT s.StuffID,
                       STF.GetStuffCode(s.StuffID) Code,
                       s.Title,
                       s.Title2,
                      CAST(ISNULL(@mainQuantityStr, '1') AS DECIMAL(30, 4)) AS MainQuantity,
                       CAST(ISNULL(@subQuantityStr, NULL) AS DECIMAL(30, 4)) AS SubQuantity
                FROM STF.Stuff AS s
                    JOIN STF.StuffDetail AS sd
                        ON sd.StuffID = s.StuffID
                WHERE (
                          @codeStr IS NULL
                          OR s.Code = @codeStr
                      )
                      AND
                      (
                          @barcodeStr IS NULL
                          OR sd.Barcode = @barcodeStr
                      );


                SELECT bii.TraceID AS TraceId,
                       N'TR' + CAST(bii.TraceID AS NVARCHAR(20)) AS [Key],
                       SUBSTRING(@searchText, bii.Position, bii.[Length]) AS [Value]
                FROM STF.BarcodeInterpretationItem AS bii
                WHERE bii.[Type] = 5
                      AND bii.BarcodeInterpretationID = @BarcodeInterpretationID;

            END;

        END;
    END;
END;
