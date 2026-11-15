CREATE    PROCEDURE [STC].[GetStuffCompositionStuffsHasIssueOnConvertSpecification]
(@stockReceiptId INT)
AS
BEGIN

    DECLARE @dynColumns NVARCHAR(MAX),
            @query NVARCHAR(MAX),
            @innerJoin NVARCHAR(MAX);

    SELECT @dynColumns = STUFF(
    (
        SELECT ',' + QUOTENAME(t.TraceID)
        FROM STF.Trace AS t
        ORDER BY t.TraceID
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(max)'),
    1   ,
    1   ,
    ''
                              );

    IF @dynColumns IS NULL
       OR @dynColumns = ''
        SET @dynColumns = N'[-1]';


    SELECT @innerJoin = STUFF(
    (
        SELECT ' AND ISNULL(sco.' + QUOTENAME(t.TraceID) + ',0) = ISNULL(src.' + QUOTENAME(t.TraceID) + ',0)'
        FROM STF.Trace AS t
        ORDER BY t.TraceID
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(max)'),
    1   ,
    1   ,
    ''
                             );


    IF @innerJoin IS NULL
       OR @innerJoin = ''
        SET @innerJoin = N'';

    CREATE TABLE #stuffWithProblem
    (
        StuffID INT NOT NULL
    );

    SET @query
        = N'
SELECT sc.StuffID AS CompositionStuffID,
       sri.StuffID,
       sr.StockID,
       sr.[Date],
	   ' + @dynColumns
          + N'
INTO #srcComposition
FROM STC.StuffComposition AS sc
    JOIN STC.StockReceiptItem AS sri
        ON sri.StockReceiptItemID = sc.StockReceiptItemID
    JOIN STC.StockReceipt AS sr
        ON sr.StockReceiptID = sri.StockReceiptID
    LEFT JOIN
    (
        SELECT sct.StuffCompositionID,
               sct.TraceID,
               CASE
                   WHEN sct.TraceItemID IS NOT NULL THEN
                       CAST(sct.TraceItemID AS NVARCHAR(50))
                   WHEN sct.DlID IS NOT NULL THEN
                       CAST(sct.DlID AS NVARCHAR(50))
                   ELSE
                       sct.Value
               END AS [Value]
        FROM STC.StuffCompositionTrace AS sct
    ) AS x
    PIVOT
    (
        MAX(x.[Value])
        FOR x.TraceID IN (' + @dynColumns
          + N')
    ) tr
        ON tr.StuffCompositionID = sc.StuffCompositionID
WHERE sr.StockReceiptID = @stockReceiptId

INSERT INTO #stuffWithProblem
SELECT ConvertSpecificationStuffID AS StuffID FROM (
SELECT oi.StuffID,
       cs.StuffID AS ConvertSpecificationStuffID,
       o.DeliverStockID,
       o.[Date],
	   ' + @dynColumns
          + N'
FROM STC.ConvertSpecification cs
    JOIN STC.OutgoingItem AS oi
        ON oi.OutgoingItemID = cs.OutgoingItemID
    JOIN STC.Outgoing AS o
        ON o.OutgoingID = oi.OutgoingID
    LEFT JOIN
    (
        SELECT cst.ConvertSpecificationID,
               cst.TraceID,
               CASE
                   WHEN cst.TraceItemID IS NOT NULL THEN
                       CAST(cst.TraceItemID AS NVARCHAR(50))
                   WHEN cst.DlID IS NOT NULL THEN
                       CAST(cst.DlID AS NVARCHAR(50))
                   ELSE
                       cst.Value
               END AS [Value]
        FROM STC.ConvertSpecificationTrace AS cst
    ) x
    PIVOT
    (
        MAX(x.[Value])
        FOR x.TraceID IN (' + @dynColumns
          + N')
    ) piv
        ON piv.ConvertSpecificationID = cs.ConvertSpecificationID
		) as src
	JOIN #srcComposition sco ON sco.StuffID = src.StuffID AND sco.Date = src.Date AND src.ConvertSpecificationStuffID = sco.CompositionStuffID 
' + @innerJoin;


    PRINT @query;

    EXEC sys.sp_executesql @query,
                           N'@stockReceiptId int',
                           @stockReceiptId = @stockReceiptId;


    SELECT DISTINCT STF.GetStuffCode(swp.StuffID) AS StuffCode
    FROM #stuffWithProblem AS swp;

END;
