CREATE PROCEDURE [STF].[CheckExistSameLengthBarcodeInterpretation]
(@BarcodeInterpretationID INT)
AS
BEGIN
    DECLARE @currentPatternLength INT;

    SET @currentPatternLength = ISNULL(
                                (
                                    SELECT SUM(bii.Length)
                                    FROM STF.BarcodeInterpretationItem AS bii
                                    WHERE bii.BarcodeInterpretationID = @BarcodeInterpretationID
                                ),
                                0
                                      );

    SELECT 1
    FROM
    (
        SELECT SUM(bii.Length) codeLen
        FROM STF.BarcodeInterpretationItem AS bii
        WHERE bii.BarcodeInterpretationID <> @BarcodeInterpretationID
        GROUP BY BarcodeInterpretationID
    ) AS src
    WHERE src.codeLen = @currentPatternLength;

END;
