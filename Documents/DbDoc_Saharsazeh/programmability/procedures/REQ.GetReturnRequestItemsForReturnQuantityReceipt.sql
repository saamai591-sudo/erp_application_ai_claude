
CREATE   PROCEDURE [REQ].GetReturnRequestItemsForReturnQuantityReceipt
(
    @date DATE,
    @stockID INT,
    @ids NVARCHAR(MAX) = NULL
)
--WITH ENCRYPTION
AS
IF (@ids = '')
    SET @ids = NULL;

DECLARE @SelectColumns NVARCHAR(MAX),
        @UserID INT,
        @DateType TINYINT,
        @DateFormat VARCHAR(10),
        @DynamicColumns NVARCHAR(MAX),
        @CodeAndTitleColumn NVARCHAR(MAX),
        @LeftJoin NVARCHAR(MAX),
        @query NVARCHAR(MAX),
        @IsReturnRequestSurveyable BIT = 0,
        @Culture NVARCHAR(100),
        @CultureNo TINYINT;

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
           ' Left Join ACC.DL d' + CAST(TraceID AS VARCHAR(10)) + ' on d' + CAST(TraceID AS VARCHAR(10)) + '.DlID = piv.'
           + QUOTENAME(TraceID)
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

IF
(
    SELECT ConfigValue
    FROM CFG.Configuration
    WHERE ConfigKey = 'IsReturnRequestSurveyable'
) = 'True'
BEGIN
    SET @IsReturnRequestSurveyable = 1;
END;

SET @query
    = N'
		SELECT  rri.ReturnRequestItemID ,
				rri.ReturnRequestID ,
				rri.ReturnRequestItemIndex RowIndex,
				rri.StuffID ,
                s.IsStuffSerializable,
				rri.MainQuantity ,
				rri.SubQuantity ,
				rr.ReturnRequestNumber Number ,
				CASE WHEN rri.StockReceiptItemID IS NOT NULL THEN
					sri.Fee
				ELSE
				0
				END  Fee ,
				CFG.GetCLRSaturnDate(rr.ReturnRequestDate,@DateFormat, 0, @DateType) DateString ,
				s.Code StuffCode ,
				case when @CultureNo = 1 then s.Title else s.Title2 end as StuffTitle ,
                s.StuffDetailType,
				case when @CultureNo = 1 then ou.Title else ou.Title2 end as Requester ,
				rrr.Non ,
				rrr.NonSub,' + @SelectColumns + N',0' + @CodeAndTitleColumn  + N'	
			FROM    REQ.ReturnRequestItem rri
					JOIN REQ.ReturnRequest rr ON rr.ReturnRequestID = rri.ReturnRequestID
					LEFT JOIN STC.StockReceiptItem sri ON  sri.StockReceiptItemID = rri.StockReceiptItemID
					JOIN CFG.OrganizationUnit ou ON ou.OrganizationUnitID = rr.OrganizationUnitID
					JOIN STF.vwStuff s ON s.StuffID = rri.StuffID
					JOIN [REQ].[ReturnRequest_Return_Remain] rrr ON rrr.ReturnRequestItemID = rri.ReturnRequestItemID
					LEFT JOIN (SELECT tr.ReturnRequestItemID ,
								   tr.TraceID ,
								   CASE WHEN tr.DlID IS NOT NULL THEN CAST(tr.DlID AS NVARCHAR(MAX)) 
										WHEN tr.TraceItemID IS NOT NULL THEN CAST(tr.TraceItemID AS NVARCHAR(MAX)) 
										ELSE tr.Value
								   END Value
								   FROM REQ.ReturnRequestItemTrace tr
							) x
							PIVOT (
								MAX(Value)
								FOR TraceID IN ( ' + @DynamicColumns+ N')
							) AS piv ON piv.ReturnRequestItemID = rri.ReturnRequestItemID
							' + @LeftJoin + N' ' + @listLeftJoin
      + N'
		WHERE   rrr.Non > 0
				and rr.ReturnRequestDate <= @date
				AND rr.StockID = @stockId
				AND ( @IsReturnRequestSurveyable = 0 OR rr.ReturnRequestState = 2)
';


EXEC sp_executesql @query,
                  N'@StockId int,
					@IsReturnRequestSurveyable bit,
					@ids nvarchar(max),
					@date Date,
					@DateFormat VARCHAR(10),
					@DateType TinyInt,
					@CultureNo TinyInt',
                   @stockID = @stockID,
                   @ids = @ids,
                   @date = @date,
                   @IsReturnRequestSurveyable = @IsReturnRequestSurveyable,
				   @DateFormat = @DateFormat,
				   @DateType = @DateType,
				   @CultureNo = @CultureNo

