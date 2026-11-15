CREATE PROCEDURE [ACC].GetVoucherList
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
            @ViewRelatedToUser INT,
            @ViewRelatedToOthers NVARCHAR(MAX),
            @DateFormat VARCHAR(10),
            @Culture VARCHAR(10),
            @CultureNo VARCHAR(10),
            @NonSys NVARCHAR(10),
            @Sys NVARCHAR(10),
            @UnauthorizedUsers NVARCHAR(MAX),
            @Record NVARCHAR(100),
            @Note NVARCHAR(100),
            @Survey NVARCHAR(100),
            @Confirm NVARCHAR(100);

    SET @UserID = CFG.GetuserID();
    SET @Culture = CFG.GetuserCulture();

    SELECT @Record = LEV.Value
    FROM CFG.LocalizeEnumValue LEV
        INNER JOIN CFG.LocalizeEnum LE
            ON LE.LocalizeEnumID = LEV.LocalizeEnumID
    WHERE LE.Enum = 'VoucherStatuses'
          AND LE.Item = 'Record'
          AND LEV.Culture = @Culture;

    SELECT @Note = LEV.Value
    FROM CFG.LocalizeEnumValue LEV
        INNER JOIN CFG.LocalizeEnum LE
            ON LE.LocalizeEnumID = LEV.LocalizeEnumID
    WHERE LE.Enum = 'VoucherStatuses'
          AND LE.Item = 'Note'
          AND LEV.Culture = @Culture;

    SELECT @Survey = LEV.Value
    FROM CFG.LocalizeEnumValue LEV
        INNER JOIN CFG.LocalizeEnum LE
            ON LE.LocalizeEnumID = LEV.LocalizeEnumID
    WHERE LE.Enum = 'VoucherStatuses'
          AND LE.Item = 'Survey'
          AND LEV.Culture = @Culture;

    SELECT @Confirm = LEV.Value
    FROM CFG.LocalizeEnumValue LEV
        INNER JOIN CFG.LocalizeEnum LE
            ON LE.LocalizeEnumID = LEV.LocalizeEnumID
    WHERE LE.Enum = 'VoucherStatuses'
          AND LE.Item = 'Confirm'
          AND LEV.Culture = @Culture;

    SELECT @NonSys = LEV.Value
    FROM CFG.LocalizeEnumValue LEV
        INNER JOIN CFG.LocalizeEnum LE
            ON LE.LocalizeEnumID = LEV.LocalizeEnumID
    WHERE LE.Enum = 'DocumentTypes'
          AND LE.Item = 'NonSystem'
          AND LEV.Culture = @Culture;

    SELECT @Sys = LEV.Value
    FROM CFG.LocalizeEnumValue LEV
        INNER JOIN CFG.LocalizeEnum LE
            ON LE.LocalizeEnumID = LEV.LocalizeEnumID
    WHERE LE.Enum = 'DocumentTypes'
          AND LE.Item = 'System'
          AND LEV.Culture = @Culture;

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
                            ELSE
                                2
                        END;


    SELECT @DateFormat = us.SettingValue
    FROM CFG.UserSetting us
    WHERE us.SettingKey = 'Date_Format'
          AND us.UserID = @UserID;

    IF @DateFormat IS NULL
        SET @DateFormat = 'YY/MM/DD';

    SELECT @ViewRelatedToUser = UserID
    FROM CFG.vwOperationLevelAccess
    WHERE EntityName = 'Voucher'
          AND AccessKey = 'ViewRelatedToUser'
          AND UserID = @UserID;

    SELECT @ViewRelatedToOthers = UserID,
           @UnauthorizedUsers = Users
    FROM CFG.vwOperationLevelAccess
    WHERE EntityName = 'Voucher'
          AND AccessKey = 'ViewRelatedToOthers'
          AND UserID = @UserID;

    SELECT a.VoucherID
    INTO #hasFlowVouchers
    FROM
    (
        SELECT vi.VoucherID
        FROM ACC.VoucherItem vi
            JOIN ACC.DCNote dc
                ON dc.VoucherItemID = vi.VoucherItemID
        UNION
        SELECT vi.VoucherID
        FROM ACC.VoucherItem vi
            JOIN ACC.VoucherAnalyze va
                ON va.CreditVoucherItemID = vi.VoucherItemID
        UNION
        SELECT vi.VoucherID
        FROM ACC.VoucherItem vi
            JOIN ACC.VoucherAnalyze va2
                ON va2.DebitVoucherItemID = vi.VoucherItemID
        UNION
        SELECT vi.VoucherID
        FROM ACC.VoucherItem vi
            JOIN NOC.AccrueAnalysing AS aa
                ON aa.VoucherItemID = vi.VoucherItemID
        UNION
        SELECT VoucherID
        FROM NOC.CashDataCollection
        UNION
        SELECT AccrueVoucherID
        FROM NOC.CashAnalysingItem
    ) AS a;

    IF @Sort IS NULL
       OR @Sort = ''
        SET @Sort = 'Number ';


    SELECT *
    INTO #vwBranchAccess
    FROM CFG.vwBranchAccess AS vba;

    SELECT *
    INTO #vwFinancialPeriodAccess
    FROM CFG.vwFinancialPeriodAccess AS vfpa;


    SET @Sort = REPLACE(@Sort, 'CreateDateString', '[CreationDate]');
    SET @Sort = REPLACE(@Sort, 'EditionDateString', '[LastEditionDate]');
    SET @Sort = REPLACE(@Sort, 'DateString', '[Date]');
    DECLARE @Query NVARCHAR(MAX);
    SET @Query
        = N'WITH Query_Result 
			As (SELECT v.VoucherID, 
			   v.BranchID, 
			   v.FinancialPeriodID, 
			   v.DocumentTypeID, 
			   v.Number, 
			   v.ReferenceNumber, 
			   v.DailyNumber, 
			   v.SubNumber, 
			   v.[Date], 
			   v.VoucherStatusID, 
			   case when ' + @CultureNo
          + N' = 1 then v.[Description] else v.Description2 end Description , 
			   v.Creator, 
			   v.CreationDate, 
			   v.LastEditionDate,
			   v.[Version],
			   v.Total ,
			   b.Code AS BranchCode,
			   case when ' + @CultureNo
          + N' = 1 then b.Title else b.Title2 end BranchTitle , 
			   CFG.GetCLRSaturnDate(v.[Date],@DateFormat  , 0,@DateType)AS DateString,
			   CFG.GetCLRSaturnDate(v.CreationDate,@DateFormat  , 1,@DateType) AS CreateDateString, 
			   CFG.GetCLRSaturnDate(v.LastEditionDate,@DateFormat , 1,@DateType) AS EditionDateString, 
			   u.Name AS CreatorUserName, 
			   u2.Name AS EditorName ,          
			   ((case when ' + @CultureNo
          + N' = 2 then dt.Title2 else dt.Title end ) + @Seperate + (case when v.AutoGenerated = 0 then @NonSys else @Sys end)) as  DocumentTypeName, 
			   CASE v.VoucherStatusID 
					WHEN 1 THEN @Record
					WHEN 2 THEN @Note
					WHEN 3 THEN @Survey
					WHEN 4 THEN @Confirm
			   END AS VoucherStatusName,
			   v.Reviewer,
		       v.Corroborator,
			   case when reviewer.UserID is not null then reviewer.Name
			        else null
			   end as ReviewerName,
			   case when corroborator.UserID is not null then corroborator.Name
			        else null
			   end as CorroboratorName,
			   v.[AutoGenerated],
              CAST (case when hf.VoucherID is not null then 1 else 0  end AS BIT) HasFlow 
		FROM ACC.Voucher v
            Left Join #hasFlowVouchers hf on v.VoucherID = hf.VoucherID
			JOIN CFG.Branch b ON b.BranchID = v.BranchID
			JOIN ACC.DocumentType dt ON dt.DocumentTypeID = v.DocumentTypeID
			JOIN CFG.[User] AS u ON u.UserID = v.Creator 
			JOIN CFG.[User] AS u2 ON u2.UserID = v.LastEditor
			left JOIN CFG.[User] AS reviewer ON reviewer.UserID = v.Reviewer
			left JOIN CFG.[User] AS corroborator ON corroborator.UserID = v.Corroborator
			Inner Join #vwBranchAccess vba on v.BranchID=vba.BranchID and vba.UserID=@UserID
			Inner Join #vwFinancialPeriodAccess vfpa on v.FinancialPeriodID=vfpa.FinancialPeriodID and vfpa.UserID=@UserID
		WHERE (v.FinancialPeriodID = @FinancialPeriodID	)	
			and (@UserID = -1 
				or  (@ViewRelatedToUser is not null and v.Creator = @UserID)
				or  (@ViewRelatedToOthers is not null and v.Creator not in (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsers) AS rfcst)
			)
		)	
	)';

    IF @Filter IS NULL
       OR @Filter = ''
        SET @Filter = '';
    ELSE
        SET @Filter = 'Where (' + @Filter + ')';


    DECLARE @tableName VARCHAR(100);
    SET @tableName = CFG.getTempTableName(1);

    SET @Query = CFG.ApplyPaging(@tableName, @Query, @PageNumber, @RowspPage, @Filter, @Sort);
    PRINT @Query;

    EXECUTE sys.sp_executesql @Query,
                              N' 
		@dateFormat varchar(10),
		@dateType int,
		@ViewRelatedToOthers NVARCHAR(MAX),
		@FinancialPeriodID int,
		@UserID int,
		@ViewRelatedToUser int,
		@UnauthorizedUsers NVARCHAR(MAX),
		@Seperate NVARCHAR(10),
		@NonSys NVARCHAR(10),
		@Sys NVARCHAR(10),
		@Record NVARCHAR(100),
		@Note NVARCHAR(100),
		@Survey NVARCHAR(100),
		@Confirm NVARCHAR(100)',
                              @DateType = @DateType,
                              @FinancialPeriodID = @FinancialPeriodID,
                              @DateFormat = @DateFormat,
                              @ViewRelatedToUser = @ViewRelatedToUser,
                              @UserID = @UserID,
                              @ViewRelatedToOthers = @ViewRelatedToOthers,
                              @UnauthorizedUsers = @UnauthorizedUsers,
                              @Seperate = ' - ',
                              @NonSys = @NonSys,
                              @Sys = @Sys,
                              @Record = @Record,
                              @Note = @Note,
                              @Survey = @Survey,
                              @Confirm = @Confirm;

    DECLARE @Count INT;

    EXEC ('select * from ' + @tableName + ' order by _RN');

    SET @Query = N'select top 1 @Count=  r_count from ' + @tableName;
    EXECUTE sys.sp_executesql @Query, N'@count int out', @Count = @Count OUT;

    RETURN ISNULL(@Count, 0);

END;
