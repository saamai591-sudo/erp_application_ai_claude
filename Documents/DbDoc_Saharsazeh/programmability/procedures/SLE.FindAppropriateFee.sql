
-------------------------------------
CREATE   PROC [SLE].FindAppropriateFee
(
    @TraceObject NVARCHAR(MAX),
    @Stuff INT,
    @SaleModel INT,
    @Currency INT,
    @Date DATE,
    @EngName NVARCHAR(255),
    @Fee DECIMAL(30,6) OUTPUT,
    @IsAppropriateFeeEditable BIT OUTPUT,
    @CreationDate DATETIME = NULL
)
--WITH ENCRYPTION
AS

DECLARE @Columns AS NVARCHAR(MAX),
        @SourceQuery AS NVARCHAR(MAX),
        @WhereClose NVARCHAR(MAX),
        @Sourceparam NVARCHAR(MAX),
        @Targetparam NVARCHAR(MAX),
        @TargetQuery AS NVARCHAR(MAX),
        @SourceTemp NVARCHAR(MAX),
        @TargetTemp NVARCHAR(MAX) ;





SET @SourceTemp = cfg.getTempTableName(1);
SET @TargetTemp = cfg.getTempTableName(1);



SELECT pli.StuffID,
       pli.Fee,
       pli.PriceListItemID,
       pl.EffectiveDate,
	   pl.IsAppropriateFeeEditable
INTO   #SourceData
FROM   sle.PriceList           AS pl
       JOIN sle.PriceListItem  AS pli
            ON  pli.PriceListID = pl.PriceListID
WHERE  pli.StuffID = @Stuff
       AND pl.EffectiveDate <= @Date
       AND pl.SaleModelID = @SaleModel
       AND pl.IsActive = 1
       AND pl.CurrencyID = @Currency


SELECT @Columns = STUFF(
(
    SELECT DISTINCT
           ',' + QUOTENAME(st.TraceID)
    FROM STF.StuffTraceDocumentNum AS stdn
        JOIN STF.StuffTrace AS st
            ON st.StuffTraceID = stdn.StuffTraceID
        JOIN STF.TraceDocumentNumType AS tdnt
            ON tdnt.TraceDocumentNumTypeID = stdn.TraceDocumentNumTypeID
        JOIN CFG.DocumentNumType AS dnt
            ON dnt.DocumentNumTypeID = tdnt.DocumentNumTypeID
    WHERE stdn.IsMandetory = 1
          AND st.SalePriceBase = 1
          AND dnt.EngName = @EngName
    FOR XML PATH(''), TYPE
).value('.', 'NVARCHAR(MAX)'),1   ,1   ,'');
                       


IF (@Columns IS NULL)
    SET @Columns = N'[-1]';

SET @SourceQuery
    = N'
			SELECT *
			INTO '+@SourceTemp+N'
			FROM   (   SELECT A.value ,
							  CASE WHEN ( LOWER(LEFT(A.TraceID, 4)) = ''trdl'' ) THEN
								   (   SELECT TraceID
									   FROM   STF.Trace
									   WHERE  AccountLevelTypeID = 1
											  AND TraceID = RIGHT(A.TraceID, 1))
								   WHEN ( LOWER(LEFT(A.TraceID, 2)) = ''tr'' ) THEN
								   (   SELECT TraceID
									   FROM   STF.Trace
									   WHERE  AccountLevelTypeID <> 1
											  AND TraceID = RIGHT(A.TraceID, 1))
							  END [TraceID]
					   FROM   (   SELECT CFG.GetStringPart(VALUE, 1) TraceID ,
										 CFG.GetStringPart(VALUE, 2) value
								  FROM   CFG.R_FnStr2TableBySplitor(@pTraceObject, ''|'') ) A
					   WHERE  A.value <> ''null'' ) x
			PIVOT (   MAX(value)
					  FOR TraceID IN ( ' + @Columns + N' )) p
		';
	
SET @Sourceparam = N'@pTraceObject AS NVARCHAR(MAX)';
EXECUTE sp_executesql @SourceQuery,
                      @Sourceparam,
                      @pTraceObject = @TraceObject;


					   

SELECT @WhereClose = STUFF(
(
    SELECT ' AND ' + QUOTENAME(st.TraceID) + '= (SELECT ' + QUOTENAME(st.TraceID) + ' FROM '+@SourceTemp+N') '
    FROM STF.StuffTraceDocumentNum AS stdn
        JOIN STF.StuffTrace AS st
            ON st.StuffTraceID = stdn.StuffTraceID
        JOIN STF.TraceDocumentNumType AS tdnt
            ON tdnt.TraceDocumentNumTypeID = stdn.TraceDocumentNumTypeID
        JOIN CFG.DocumentNumType AS dnt
            ON dnt.DocumentNumTypeID = tdnt.DocumentNumTypeID
    WHERE stdn.IsMandetory = 1
          AND st.SalePriceBase = 1
          AND dnt.EngName = @EngName
          AND StuffID = @Stuff
    FOR XML PATH(''), TYPE
).value('.', 'NVARCHAR(MAX)'),
1   ,
1   ,
''
                          );

IF (@WhereClose IS NULL)
    SET @WhereClose = N'';
    
                   CREATE TABLE #Fee(
                      	Fee DECIMAL(36,10),
						IsAppropriateFeeEditable BIT,
                   Rno int)
    
SET @TargetQuery
    = N'
    
    INSERT INTO #Fee
    SELECT a.Fee,
		   a.IsAppropriateFeeEditable,
           ROW_NUMBER() OVER(
               PARTITION BY a.StuffID,
               '+@Columns+N' ORDER BY EffectiveDate DESC,
               a.PriceListItemID DESC
           ) rno
    FROM   #SourceData a
           LEFT JOIN (
                    SELECT PriceListItemID,
                           TraceID,
                           CASE 
                                WHEN DlID IS NOT NULL THEN CAST(DlID AS NVARCHAR(MAX))
                                WHEN TraceItemID IS NOT NULL THEN CAST(TraceItemID AS NVARCHAR(MAX))
                                ELSE VALUE
                           END VALUE
                    FROM   SLE.PriceListItemTrace
                ) x
                PIVOT(MAX(VALUE) FOR TraceID IN (' + @Columns       + N')) plit
                ON  a.PriceListItemID = plit.PriceListItemID 
                    ' + @WhereClose;



	EXEC (@TargetQuery)
                      
       
SELECT @Fee =  fee ,
		@IsAppropriateFeeEditable = IsAppropriateFeeEditable
FROM #Fee AS f
WHERE f.Rno = 1
