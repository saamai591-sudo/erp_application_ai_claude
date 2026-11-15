-------------------------------------
CREATE    PROCEDURE CFG.GetVoucherDescriptionForms
--WITH ENCRYPTION
AS
BEGIN

    DECLARE @cultureNo INT = 1,
            @lang INT,
            @Culture NVARCHAR(10);

    SET @Culture = CFG.GetuserCulture();

    --SELECT @cultureNo = CultureNo
    --FROM CFG.CultureInfo
    --WHERE Culture = @Culture;

    DECLARE @table TABLE
    (
        MDEntityID INT NOT NULL
    );

    INSERT INTO @table
    (
        MDEntityID
    )
    SELECT DISTINCT
           MDEntityID
    FROM CFG.VoucherDescriptionMetaData;

    SELECT m2.ID AS [Value],
           m.[Value] AS [Value1]
    FROM MDT.DmdEntity m2
        JOIN MDT.DmdRelatedEntityTranslate AS dret
            ON dret.DmdEntityID = m2.ID
        JOIN MDT.DmdTranslateItem AS m
            ON m.ID = dret.DmdTranslateItemID
    WHERE m.Culture = @Culture
          AND EXISTS
    (
        SELECT 1 FROM @table t WHERE m2.ID = t.MDEntityID
    );

END;
