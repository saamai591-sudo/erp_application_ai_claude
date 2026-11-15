
---------------------------------------------------------
CREATE    PROCEDURE [STC].[GetNonTemporaryOutging]
(
    @date DATE,
    @ids NVARCHAR(MAX) = NULL,
    @dlId INT = NULL,
    @stockId INT
)
--WITH ENCRYPTION
AS
BEGIN

    DECLARE @SelectColumns NVARCHAR(MAX),
            @UserID INT,
            @DateType TINYINT,
            @DateFormat VARCHAR(10),
            @Culture VARCHAR(10),
            @DynamicColumns NVARCHAR(MAX),
            @CodeAndTitleColumn NVARCHAR(MAX),
            @LeftJoin NVARCHAR(MAX),
            @query NVARCHAR(MAX),
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
        SET @DateType = CASE @Culture
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

    DECLARE @listLeftJoin NVARCHAR(MAX);

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

    IF @listLeftJoin IS NULL
        SET @listLeftJoin = N' ';

    SET @query
        = N'
			SELECT  toi.TemporaryOutgoingItemID,
					toi.TemporaryOutgoingID,
					CFG.GetCLRSaturnDate(tout.[Date], @dateFormat ,0,@dateType) DateString,
					tout.Number,
					toi.RowIndex,
					r.Number ReceptionNumber,
					s.StuffID,
					case when ' + CAST(@CultureNo AS CHAR(1)) + N' = 1 then s.Title
	                     when ' + CAST(@CultureNo AS CHAR(1))
          + N' = 2 then s.Title2
	                end StuffTitle,
                    s.StuffDetailType,
					s.Code StuffCode,
					toi.MainQuantity,
					toi.SubQuantity,
					tor.Non,
					tor.NonSub,' + @SelectColumns + N',0' + @CodeAndTitleColumn
          + N'	
			FROM     STC.TemporaryOutgoingItem toi
					JOIN STC.TemporaryOutgoing tout ON tout.TemporaryOutgoingID = toi.TemporaryOutgoingID
					JOIN STC.TemporaryOutgoing_Remain tor ON tor.TemporaryOutgoingItemID = toi.TemporaryOutgoingItemID
					LEFT JOIN CTM.Reception r ON r.ReceptionID = toi.ReceptionID
					JOIN STF.[vwStuff] s ON s.StuffID = toi.StuffID
					LEFT JOIN (SELECT tr.TemporaryOutgoingItemID ,
								   tr.TraceID ,
								   CASE WHEN tr.DlID IS NOT NULL  THEN  CAST(tr.DlID AS NVARCHAR(MAX)) 
										WHEN tr.TraceItemID IS NOT NULL THEN CAST(tr.TraceItemID AS NVARCHAR(MAX))
										ELSE tr.Value
								   END Value
								   FROM STC.TemporaryOutgoingItemTrace tr
							) x
							PIVOT (
								MAX(Value)
								FOR TraceID IN ( ' + @DynamicColumns
          + N' )
							) AS piv ON piv.TemporaryOutgoingItemID = toi.TemporaryOutgoingItemID
							' + @LeftJoin + N' ' + @listLeftJoin
          + N'
					WHERE	tor.Non > 0  
							AND s.[Type] = 0 
							AND tout.[Date] <= @date 
							AND ( @dlId IS NULL
								OR tout.DlID = @dlId 
							)
							AND tout.StockID = @stockId 
							--AND ( @ids IS NULL
							--	  OR  toi.TemporaryOutgoingItemID NOT IN (
							--	  SELECT    value
							--	  FROM      CFG.R_FnCommaStr2Table(@ids) )
							--	)
			';

    PRINT @query;

    EXEC sp_executesql @query,
                       N'
			@date DATE ,	
			@dlId BIGINT,
			@stockId INT ,
			@ids NVARCHAR(MAX),
			@dateFormat nvarchar(20),
			@dateType TINYINT	
		',
                       @date = @date,
                       @dlId = @dlId,
                       @stockId = @stockId,
                       @ids = @ids,
                       @DateFormat = @DateFormat,
                       @DateType = @DateType;

END;
