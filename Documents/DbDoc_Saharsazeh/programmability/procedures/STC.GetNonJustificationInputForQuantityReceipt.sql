
CREATE   PROCEDURE [STC].GetNonJustificationInputForQuantityReceipt
(
    @stockDocumentTypeBaseEntityID INT,
    @stockId INT,
    @date DATE,
    @ids NVARCHAR(MAX),
    @deliverDlId BIGINT
)
--WITH ENCRYPTION
AS
BEGIN

    DECLARE @SelectColumns NVARCHAR(MAX),
            @UserID INT,
            @DateType TINYINT,
            @DateFormat VARCHAR(10),
            @DynamicColumns NVARCHAR(MAX),
            @CodeAndTitleColumn NVARCHAR(MAX),
            @LeftJoin NVARCHAR(MAX),
            @query NVARCHAR(MAX),
            @Culture NVARCHAR(100),
            @CultureNo TINYINT;

    IF (@ids = '')
        SET @ids = NULL;

    SET @UserID = CFG.GetuserID();
    SET @Culture = CFG.GetuserCulture();

    SELECT @CultureNo = CultureNo
    FROM CFG.CultureInfo
    WHERE Culture = @Culture;

    SELECT @DateType = us.SettingValue
    FROM CFG.UserSetting us
    WHERE us.SettingKey = 'Date_Type'
          AND us.UserID = @UserID;

    IF @DateType IS NULL
        SET @DateType = CASE CFG.GetuserCulture()
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

    SELECT @DynamicColumns = STUFF(
    (
        SELECT DISTINCT
               ',' + QUOTENAME(CAST(TraceID AS VARCHAR(5)))
        FROM STF.Trace
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'),
    1   ,
    1   ,
    ''
                                  );

    IF (@DynamicColumns IS NULL)
        SET @DynamicColumns = N'[-1]';

    SELECT @SelectColumns
        = STUFF(
    (
        SELECT DISTINCT
               CASE
                   WHEN AccountLevelTypeID <> 5 THEN
                       ',Piv.' + QUOTENAME(CAST(TraceID AS VARCHAR(5))) + ' AS TR' + CAST(TraceID AS VARCHAR(5))
                       + CASE AccountLevelTypeID
                             WHEN 6 THEN
                                 ',tri' + CAST(TraceID AS VARCHAR(5)) + '.Item' + CASE @CultureNo
                                                                                     WHEN 2 THEN
                                                                                         '2'
                                                                                     ELSE
                                                                                         ''
                                                                                 END + ' AS TRCode'
                                 + CAST(TraceID AS VARCHAR(5))
                             ELSE
                                 ''
                         END
                   ELSE
                       ',Piv.' + QUOTENAME(CAST(TraceID AS VARCHAR(5))) + ' AS TR' + CAST(TraceID AS VARCHAR(5))
                       + ',CFG.GetCLRSaturnDate(Piv.' + QUOTENAME(CAST(TraceID AS VARCHAR(5)))
                       + ', @DateFormat, 0, @DateType) AS TRDate' + CAST(TraceID AS VARCHAR(5))
               END
        FROM STF.Trace
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'),
    1   ,
    1   ,
    ''
               );

    IF (@SelectColumns IS NULL)
        SET @SelectColumns = N'[-1]';

    SELECT @CodeAndTitleColumn
        = STUFF(
    (
        SELECT DISTINCT
               ' ,d' + CAST(TraceID AS VARCHAR(10)) + '.Code [TRCode' + CAST(TraceID AS VARCHAR(10)) + '],d'
               + CAST(TraceID AS VARCHAR(10)) + '.Title [TRTitle' + CAST(TraceID AS VARCHAR(10)) + ']'
        FROM STF.Trace
        WHERE DlTypeID IS NOT NULL
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'),
    1   ,
    1   ,
    ''
               );

    IF @CodeAndTitleColumn IS NULL
        SET @CodeAndTitleColumn = N' ';

    SELECT @LeftJoin
        = STUFF(
    (
        SELECT DISTINCT
               ' Left Join ACC.DL d' + CAST(TraceID AS VARCHAR(10)) + ' on d' + CAST(TraceID AS VARCHAR(10))
               + '.DlID = piv.' + QUOTENAME(TraceID)
        FROM STF.Trace
        WHERE DlTypeID IS NOT NULL
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'),
    1   ,
    1   ,
    ''
               );

    IF @LeftJoin IS NULL
        SET @LeftJoin = N' ';

	DECLARE @listLeftJoin NVARCHAR(MAX)

    SELECT @listLeftJoin
        = STUFF(
    (
        SELECT DISTINCT
               ' Left Join STF.TraceItem tri' + CAST(TraceID AS VARCHAR(10)) + ' on tri' + CAST(TraceID AS VARCHAR(10))
               + '.TraceItemID = piv.' + QUOTENAME(TraceID)
        FROM STF.Trace
        WHERE AccountLevelTypeID = 6
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'),
    1   ,
    1   ,
    ''
               );


select * into #JustificationInput_Remains
 from stc.JustificationInput_Remains
where date<=@date and DeliverDlID = @deliverDlId and Non>0 and stockid = @stockId
select * into #vwStockAccess 
from cfg.vwStockAccess



    IF @listLeftJoin IS NULL
        SET @listLeftJoin = N' ';



    SET @query
        = N'
			SELECT  jii.JustificationInputItemID ,
					ji.JustificationInputID ,
					jii.RowIndex,
					ji.Number ,
					CFG.GetCLRSaturnDate(ji.[Date], @dateFormat, 0, @dateType) DateString ,
					jii.StuffID ,
					s.Code StuffCode ,
					case when ' + CAST(@CultureNo AS CHAR(1)) + N' = 1 then s.Title
	                     when ' + CAST(@CultureNo AS CHAR(1))
          + N' = 2 then s.Title2
	                end as  StuffTitle ,
                    s.StuffDetailType,
					jii.MainQuantity ,
					jii.SubQuantity ,
					jir.Non ,
					jir.NonSub,' + @SelectColumns + N',0' + @CodeAndTitleColumn
          + N'	
			FROM    STC.JustificationInputItem jii
					JOIN STC.JustificationInput ji ON ji.JustificationInputID = jii.JustificationInputID
					JOIN STF.[VWStuff] s ON s.StuffID = jii.StuffID
					JOIN #JustificationInput_Remains jir ON jir.JustificationInputItemID = jii.JustificationInputItemID
					INNER JOIN #vwStockAccess AS vsa on ji.StockID=vsa.StockID
					LEFT JOIN ( SELECT  tr.JustificationInputItemID ,
										tr.TraceID ,
										CASE WHEN tr.DlID IS NOT NULL
												THEN CAST(tr.DlID AS NVARCHAR(MAX))
											 WHEN tr.TraceItemID IS NOT NULL
												THEN CAST(tr.TraceItemID AS NVARCHAR(MAX)) 
											 ELSE tr.Value
										END Value
								FROM    STC.JustificationInputItemTrace tr
							  ) x 
							PIVOT (
								MAX(Value)
								FOR TraceID IN ( ' + @DynamicColumns
          + N')
							) AS piv ON piv.JustificationInputItemID = jii.JustificationInputItemID
							' + @LeftJoin + ' ' +@listLeftJoin
          + N'
				Where	ji.StockDocumentTypeBaseEntityID in(
																	SELECT DISTINCT sdtb2.StockDocumentTypeBaseEntityID
																	FROM stc.StockDocumentTypeBaseEntity sdtb
																	JOIN stc.StockDocumentTypeBaseEntity sdtb2
																			ON sdtb.StockDocumentTypeID = sdtb2.StockDocumentTypeID
																	WHERE sdtb2.Entity = 4 --مجوز ورود
																	AND sdtb2.StockDocumentTypeID = (
																										SELECT StockDocumentTypeID
																										FROM stc.StockDocumentTypeBaseEntity
																										WHERE StockDocumentTypeBaseEntityID = @stockDocumentTypeBaseEntityId
																									)
																	) 
						AND ji.StockID = @stockId
						AND ji.[Date] <= @date
						AND ji.DeliverDlID = @deliverDlId
						--AND ( @ids IS NULL
						--	  OR jii.JustificationInputItemID NOT IN (
						--	  SELECT    value
						--	  FROM      CFG.R_FnCommaStr2Table(@ids) )
						--	)
									';

    PRINT @query;

    EXEC sp_executesql @query,
                       N'
			@stockDocumentTypeBaseEntityID INT ,
			@stockId INT ,
			@date DATE ,
			@ids NVARCHAR(MAX) ,
			@deliverDlId BIGINT,
			@UserID INT,
			@DateFormat nvarchar(20),
			@DateType TINYINT
		',
                       @stockDocumentTypeBaseEntityID = @stockDocumentTypeBaseEntityID,
                       @stockId = @stockId,
                       @date = @date,
                       @ids = @ids,
                       @deliverDlId = @deliverDlId,
                       @UserID = @UserID,
                       @DateFormat = @DateFormat,
                       @DateType = @DateType;

END;
