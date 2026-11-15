
---------------------------------------------------------
CREATE    PROCEDURE [REQ].GetNonReturnRequestItems
(
    @date DATE,
    @ids NVARCHAR(MAX) = NULL,
    @financialId INT,
    @stockId INT
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

    IF @listLeftJoin IS NULL
        SET @listLeftJoin = N' ';

    SET @query
        = N'
			SELECT	rri.ReturnRequestItemID ,
					rri.ReturnRequestID ,
					rr.ReturnRequestNumber Number,
					CFG.GetCLRSaturnDate(rr.ReturnRequestDate,@DateFormat,0,@DateType) DateString,
					rri.StuffID ,
					s.Code StuffCode,

					case when ' + CAST(@CultureNo AS CHAR(1)) + N' = 1 then s.Title
	                     when ' + CAST(@CultureNo AS CHAR(1))
          + N' = 2 then s.Title2
	                end as StuffTitle,
                    s.StuffDetailType,
					rri.MainQuantity ,
					rri.SubQuantity ,
					rrr.Non,
					rrr.NonSub
			
			,' + @SelectColumns + N',0' + @CodeAndTitleColumn
          + N'	
			FROM    REQ.ReturnRequestItem rri
					JOIN REQ.ReturnRequest rr ON rr.ReturnRequestID = rri.ReturnRequestID
					JOIN STF.VWStuff s ON s.StuffID = rri.StuffID
					JOIN REQ.ReturnRequest_Remains rrr ON rrr.ReturnRequestItemID = rri.ReturnRequestItemID
					INNER JOIN cfg.vwBranchAccess AS vba ON vba.BranchID = rr.BranchID
					LEFT JOIN (SELECT tr.ReturnRequestItemID ,
								   tr.TraceID ,
								   CASE WHEN tr.DlID IS NOT NULL
								   THEN CAST(tr.DlID AS NVARCHAR(MAX)) 
								   ELSE tr.Value
								   END Value
								   FROM REQ.ReturnRequestItemTrace tr
							) x
							PIVOT (
								MAX(Value)
								FOR TraceID IN ( ' + @DynamicColumns
          + N' )
							) AS piv ON piv.ReturnRequestItemID = rri.ReturnRequestItemID
							' + @LeftJoin + ' ' + @listLeftJoin
          + N'
					WHERE   rr.ReturnRequestDate <= @date
							AND rr.FinancialPeriodID = @financialId
							AND rr.StockID = @stockId
							AND rrr.Non > 0
							--AND ( @ids IS NULL
							--	  OR rri.ReturnRequestItemID NOT IN (
							--	  SELECT    value
							--	  FROM      CFG.R_FnCommaStr2Table(@ids) )
							--	)
			';

    PRINT @query;

    EXEC sp_executesql @query,
                       N'
			@date DATE ,
			@ids NVARCHAR(MAX) = NULL ,
			@financialId INT ,
			@stockId INT,
			@UserID INT,
			@DateFormat nvarchar(20),
			@DateType TINYINT
		',
                       @date = @date,
                       @ids = @ids,
                       @financialId = @financialId,
                       @stockId = @stockId,
                       @UserID = @UserID,
                       @DateFormat = @DateFormat,
                       @DateType = @DateType;

END;
