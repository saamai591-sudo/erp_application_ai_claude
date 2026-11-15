CREATE  PROC [STF].FindStuffTrace
(@StuffId INT)
AS
SELECT *
INTO #StuffTrace
FROM STF.StuffTrace
WHERE StuffID = @StuffId;

DECLARE @culture NVARCHAR(20),
        @Date NVARCHAR(100),
        @DL NVARCHAR(100),
        @FloatNumber NVARCHAR(100),
        @IntegerNumber NVARCHAR(100),
        @List NVARCHAR(100),
        @String NVARCHAR(100);


SET @culture = CFG.GetuserCulture();

SELECT @Date = LV.Value
FROM CFG.LocalizeEnum L
    JOIN CFG.LocalizeEnumValue LV
        ON L.LocalizeEnumID = LV.LocalizeEnumID
WHERE L.Enum = 'AccountLevelTypes'
      AND L.Item = 'Date'
      AND LV.Culture = @culture;

SELECT @DL = LV.Value
FROM CFG.LocalizeEnum L
    JOIN CFG.LocalizeEnumValue LV
        ON L.LocalizeEnumID = LV.LocalizeEnumID
WHERE L.Enum = 'AccountLevelTypes'
      AND L.Item = 'DL'
      AND LV.Culture = @culture;

SELECT @FloatNumber = LV.Value
FROM CFG.LocalizeEnum L
    JOIN CFG.LocalizeEnumValue LV
        ON L.LocalizeEnumID = LV.LocalizeEnumID
WHERE L.Enum = 'AccountLevelTypes'
      AND L.Item = 'FloatNumber '
      AND LV.Culture = @culture;

SELECT @IntegerNumber = LV.Value
FROM CFG.LocalizeEnum L
    JOIN CFG.LocalizeEnumValue LV
        ON L.LocalizeEnumID = LV.LocalizeEnumID
WHERE L.Enum = 'AccountLevelTypes'
      AND L.Item = 'IntegerNumber'
      AND LV.Culture = @culture;

SELECT @String = LV.Value
FROM CFG.LocalizeEnum L
    JOIN CFG.LocalizeEnumValue LV
        ON L.LocalizeEnumID = LV.LocalizeEnumID
WHERE L.Enum = 'AccountLevelTypes'
      AND L.Item = 'String'
      AND LV.Culture = @culture;

SELECT a.TraceID,
       a.Title,
       a.Title2,
       a.Alias,
       CASE a.AccountLevelTypeID
           WHEN 1 THEN
               @DL
           WHEN 2 THEN
               @IntegerNumber
           WHEN 3 THEN
               @FloatNumber
           WHEN 4 THEN
               @String
           WHEN 5 THEN
               @Date
           WHEN 6 THEN
               @List
           ELSE
               N''
       END AccountLevelTypeName,
       a.AccountLevelTypeID,
       a.DlTypeID,
       CAST(CASE
                WHEN c.StuffTraceID IS NOT NULL THEN
                    c.SalePriceBase
                ELSE
                    0
            END AS BIT) SalePriceBase,
       CASE
           WHEN c.StuffTraceID IS NOT NULL THEN
               c.TraceListTypeID
           ELSE
               NULL
       END TraceListTypeID,
       d.Title TraceListTypeName,
       CAST(CASE
                WHEN a.AccountLevelTypeID = 6 THEN
                    1
                ELSE
                    0
            END AS BIT) IsListType,
       a.EffectiveInPricing,
       CASE
           WHEN c.StuffTraceID IS NOT NULL THEN
               c.StuffTraceID
           ELSE
               0
       END RelatedId,
       CAST(CASE
                WHEN c.StuffTraceID IS NOT NULL THEN
                    1
                ELSE
                    0
            END AS BIT) IsSelected,
       CASE
           WHEN c.StuffTraceID IS NOT NULL THEN
               c.Version
           ELSE
               0
       END Version,
       CASE
           WHEN c.StuffTraceID IS NOT NULL THEN
               c.Creator
           ELSE
               0
       END Creator,
       CAST(ROW_NUMBER() OVER (ORDER BY a.TraceID) AS INT) RowIndex
FROM STF.Trace a
    LEFT JOIN #StuffTrace c
        ON c.TraceID = a.TraceID
    LEFT JOIN STF.TraceListType d
        ON d.TraceListTypeID = c.TraceListTypeID;
