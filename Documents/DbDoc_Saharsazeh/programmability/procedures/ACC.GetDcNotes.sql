
------------------------------------------------------------------
CREATE     PROCEDURE [ACC].GetDcNotes
(
    @FinancialPeriodID INT,
    @PageNumber INT,
    @RowspPage INT,
    @Sort NVARCHAR(MAX) = NULL,
    @Filter NVARCHAR(MAX) = NULL
)
AS
BEGIN

    DECLARE @UserID INT,
            @DateType TINYINT,
            @DateFormat VARCHAR(10),
            @ViewRelatedToUser INT,
            @ViewRelatedToOthers NVARCHAR(MAX),
            @UnauthorizedUsers NVARCHAR(MAX);

    SET @UserID = CFG.GetuserID();

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
                            ELSE
                                0
                        END;


    SELECT @DateFormat = us.SettingValue
    FROM CFG.UserSetting us
    WHERE us.SettingKey = 'Date_Format'
          AND us.UserID = @UserID;

    IF @DateFormat IS NULL
        SET @DateFormat = 'YY/MM/DD';

    SELECT @ViewRelatedToUser = UserID
    FROM CFG.vwOperationLevelAccess
    WHERE EntityName = 'DcNote'
          AND AccessKey = 'ViewRelatedToUser'
          AND UserID = @UserID;

    SELECT @ViewRelatedToOthers = UserID,
           @UnauthorizedUsers = Users
    FROM CFG.vwOperationLevelAccess
    WHERE EntityName = 'DcNote'
          AND AccessKey = 'ViewRelatedToOthers'
          AND UserID = @UserID;

    SELECT *
    INTO #vwBranchAccess
    FROM CFG.vwBranchAccess AS vba;

    SELECT T.Number,
           v.BranchID
    INTO #Branch
    FROM
    (
        SELECT Number,
               VoucherItemID,
               ROW_NUMBER() OVER (PARTITION BY Number ORDER BY DCNoteID) AS Rno
        FROM ACC.DCNote
        WHERE FinancialPeriodID = @FinancialPeriodID
    ) T
        INNER JOIN ACC.VoucherItem AS vi
            ON vi.VoucherItemID = T.VoucherItemID
        INNER JOIN ACC.Voucher AS v
            ON v.VoucherID = vi.VoucherID
    WHERE T.Rno = 1;

    DECLARE @query NVARCHAR(MAX);

    SET @query
        = N'
;WITH Query_Result 
AS (
    SELECT T.Number,
           d.Title AS DlTitle,
           d.Title2 AS DlTitle2,
           CFG.GetCLRSaturnDate(T.Date, @DateFormat, 0, @DateType) AS [Date],
           d.Code AS DlCode,
           T.CreationDate,
           T.LastEditionDate,
           CFG.GetCLRSaturnDate(T.CreationDate, @DateFormat, 0, @DateType) AS CreateDateString,
           CFG.GetCLRSaturnDate(T.LastEditionDate, @DateFormat, 0, @DateType) AS EditionDateString,
           u.Name AS CreatorUserName,
           u2.Name AS EditorName,
           T.Creator,
           b2.Title AS BranchTitle,
           b2.Title2 AS BranchTitle2,
		   0 AS Version
    FROM
    (
        SELECT d.Number,
               d.DlID,
               d.Date,
               d.Creator,
               d.CreationDate,
               d.LastEditor,
               d.LastEditionDate
        FROM ACC.DCNote AS d
        WHERE d.FinancialPeriodID = @FinancialPeriodID
        GROUP BY d.Number,
                 d.DlID,
                 d.Date,
                 d.Creator,
                 d.CreationDate,
                 d.LastEditor,
                 d.LastEditionDate
    ) T
        INNER JOIN #Branch b
            ON b.Number = T.Number
        INNER JOIN CFG.Branch b2
            ON b2.BranchID = b.BranchID
        INNER JOIN ACC.DL AS d
            ON T.DlID = d.DLID
        INNER JOIN CFG.[User] AS u
            ON u.UserID = T.Creator
        INNER JOIN CFG.[User] u2
            ON u2.UserID = T.LastEditor
        INNER JOIN #vwBranchAccess AS vba
            ON b.BranchID = vba.BranchID
    WHERE (
              @UserID = -1
              OR
              (
                  @ViewRelatedToUser IS NOT NULL
                  AND T.Creator = @UserID
              )
              OR
              (
                  @ViewRelatedToOthers IS NOT NULL
                  AND NOT EXISTS
    (
        SELECT rfcst.value
        FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsers) AS rfcst
        WHERE rfcst.value = T.Creator
    )
              )
          ))';

    IF @Filter IS NULL
       OR @Filter = ''
        SET @Filter = '';
    ELSE
        SET @Filter = 'Where (' + @Filter + ')';


    IF @Sort IS NULL
       OR @Sort = ''
        SET @Sort = 'Number ';


    DECLARE @tableName VARCHAR(100);
    SET @tableName = CFG.getTempTableName(1);

    SET @query = CFG.ApplyPaging(@tableName, @query, @PageNumber, @RowspPage, @Filter, @Sort);
    PRINT @query;

    EXECUTE sys.sp_executesql @query,
                              N' 
								@dateFormat varchar(10),
								@dateType int,
								@ViewRelatedToUser int,
								@ViewRelatedToOthers NVARCHAR(MAX),
								@UnauthorizedUsers NVARCHAR(MAX),
								@UserID int,
								@FinancialPeriodID INT',
                              @DateFormat = @DateFormat,
                              @DateType = @DateType,
                              @ViewRelatedToUser = @ViewRelatedToUser,
                              @ViewRelatedToOthers = @ViewRelatedToOthers,
                              @UnauthorizedUsers = @UnauthorizedUsers,
                              @UserID = @UserID,
                              @FinancialPeriodID = @FinancialPeriodID;

    DECLARE @Count INT;

    EXEC ('select * from ' + @tableName + ' order by _RN');

    SET @query = N'select top 1 @Count=  r_count from ' + @tableName;
    EXECUTE sys.sp_executesql @query, N'@count int out', @Count = @Count OUT;
END;
