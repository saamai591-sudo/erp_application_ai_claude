------------------------------------- START #65063
CREATE    PROCEDURE [REQ].GetNonPurchaseRequestItemForTempReceipt
(
    @date DATE,
    @ids NVARCHAR(MAX) = NULL,
    @financialId INT,
    @stockId INT
)
-- WITH ENCRYPTION
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
    ).value('.', 'NVARCHAR(MAX)'),1 ,1 ,'');

    IF (@DynamicColumns IS NULL)
        SET @DynamicColumns = N'[-1]';

    SELECT @SelectColumns = STUFF(
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
    ).value('.', 'NVARCHAR(MAX)'),1   ,1   ,'');

    IF (@SelectColumns IS NULL)
        SET @SelectColumns = N'[-1]';

    SELECT @CodeAndTitleColumn = STUFF(
    (
        SELECT DISTINCT
               ' ,d' + CAST(TraceID AS VARCHAR(10)) + '.Code [TRCode' + CAST(TraceID AS VARCHAR(10)) + '],d'
               + CAST(TraceID AS VARCHAR(10)) + '.Title [TRTitle' + CAST(TraceID AS VARCHAR(10)) + ']'
        FROM STF.Trace
        WHERE DlTypeID IS NOT NULL
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'),1   ,1   ,'');

    IF @CodeAndTitleColumn IS NULL
        SET @CodeAndTitleColumn = N' ';

    SELECT @LeftJoin = STUFF(
    (
        SELECT DISTINCT
               ' Left Join ACC.DL d' + CAST(TraceID AS VARCHAR(10)) + ' on d' + CAST(TraceID AS VARCHAR(10))
               + '.DlID = piv.' + QUOTENAME(TraceID)
        FROM STF.Trace
        WHERE DlTypeID IS NOT NULL
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'),1   ,1   ,'');

    IF @LeftJoin IS NULL
        SET @LeftJoin = N' ';

    DECLARE @listLeftJoin NVARCHAR(MAX);

    SELECT @listLeftJoin = STUFF(
    (
        SELECT DISTINCT
               ' Left Join STF.TraceItem tri' + CAST(TraceID AS VARCHAR(10)) + ' on tri' + CAST(TraceID AS VARCHAR(10))
               + '.TraceItemID = piv.' + QUOTENAME(TraceID)
        FROM STF.Trace
        WHERE AccountLevelTypeID = 6
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'),1   ,1   ,'');

    IF @listLeftJoin IS NULL
        SET @listLeftJoin = N' ';

declare @WhereClose varchar(max) = ''
 if OBJECT_ID('RUL.GetNonPurchaseRequestItemForTempReceipt_WhereClose') is not null
set @WhereClose = RUL.GetNonPurchaseRequestItemForTempReceipt_WhereClose()


    SET @query = N'SELECT  pr.PurchaseRequestID ,
					pri.PurchaseRequestItemID ,
					pri.PurchaseRequestItemIndex RowIndex,
					pri.StuffID ,
					s.Code StuffCode ,					
					case when @CultureNo = 1 then s.Title else s.Title2 end as StuffTitle, 
                    s.StuffDetailType,
					pri.MainQuantity ,
					pri.SubQuantity ,
					prr.Non  ,
					prr.NonSub  ,
					pr.PurchaseRequestNumber Number ,
					CFG.GetCLRSaturnDate(pr.PurchaseRequestDate, @dateFormat, 0, @dateType) RequestDate ,
					ou.Title Requester,' + @SelectColumns + N',0' + @CodeAndTitleColumn + N'	
			FROM    REQ.PurchaseRequestItem pri
					JOIN REQ.PurchaseRequest pr ON pr.PurchaseRequestID = pri.PurchaseRequestID
					JOIN STF.vwStuff s ON s.StuffID = pri.StuffID
					JOIN REQ.PurchaseRequest_Remains prr ON prr.PurchaseRequestItemID = pri.PurchaseRequestItemID
					JOIN CFG.OrganizationUnit ou ON ou.OrganizationUnitID = pr.OrganizationUnitID
					INNER JOIN cfg.vwBranchAccess AS vba ON vba.BranchID = pr.BranchID
					LEFT JOIN (SELECT tr.PurchaseRequestItemID ,
								   tr.TraceID ,
								   CASE WHEN tr.DlID IS NOT NULL THEN CAST(tr.DlID AS NVARCHAR(MAX)) 
										WHEN tr.TraceItemID IS NOT NULL THEN CAST(tr.TraceItemID AS NVARCHAR(MAX)) 
										ELSE tr.Value END Value
								   FROM REQ.PurchaseRequestItemTrace tr
							) x
							PIVOT (
								MAX(Value)
								FOR TraceID IN ( ' + @DynamicColumns + N')
							) AS piv ON piv.PurchaseRequestItemID = pri.PurchaseRequestItemID
							' + @LeftJoin + N' ' + @listLeftJoin + N'
					WHERE   prr.Non > 0
					and pr.PurchaseRequestState = 2
					
							AND pr.BranchID = ( SELECT   BranchID
                                   FROM     STF.Stock
                                   WHERE    StockID = @stockId
                                 )
							AND pr.PurchaseRequestDate <= @date							
                            '+@WhereClose;

    PRINT @query;

    EXEC sp_executesql   @query,
                       N'@Date DATE ,
						 @ids NVARCHAR(MAX) ,	
						 @financialId INT,
						 @UserID INT,
						 @DateFormat nvarchar(20),
						 @DateType TINYINT	,
						 @stockId INT,
						 @CultureNo TinyInt',
                         @date = @date,
                         @stockId = @stockId,
                         @ids = @ids,
                         @financialId = @financialId,
                         @UserID = @UserID,
                         @DateFormat = @DateFormat,
                         @DateType = @DateType,
						 @CultureNo = @CultureNo;

END;
