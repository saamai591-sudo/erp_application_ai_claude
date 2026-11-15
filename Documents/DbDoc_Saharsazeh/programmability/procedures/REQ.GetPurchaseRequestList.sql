CREATE PROC REQ.GetPurchaseRequestList
(
    @FinancialPeriodID INT,
    @PageNumber INT,
    @RowspPage INT,
    @Sort NVARCHAR(MAX) = NULL,
    @Filter NVARCHAR(MAX) = NULL
)
AS
BEGIN

    DECLARE @culture NVARCHAR(10),
            @CultureNo INT,
            @userId INT,
            @DateType INT,
            @DateFormat NVARCHAR(20),
            @ViewRelatedToUser INT,
            @ViewRelatedToOthers NVARCHAR(MAX),
            @UnauthorizedUsers NVARCHAR(MAX),
            @withoutBase NVARCHAR(100),
            @stuffRequest NVARCHAR(100),
            @order NVARCHAR(100),
            @justification NVARCHAR(100),
            @quotation NVARCHAR(100),
            @saleContract NVARCHAR(100),
            @transferRequest NVARCHAR(100),
            @serviceRequest NVARCHAR(100),
            @submitted NVARCHAR(100),
            @confirmed NVARCHAR(100),
            @rejected NVARCHAR(100),
            @ended NVARCHAR(100);

    SET @userId = CFG.GetuserID();
    SET @culture = CFG.GetuserCulture();

    SELECT @CultureNo = ISNULL(CultureNo, 1)
    FROM CFG.CultureInfo
    WHERE Culture = @culture;

    SELECT @DateType = us.SettingValue
    FROM CFG.UserSetting us
    WHERE us.SettingKey = 'Date_Type'
          AND us.UserID = @userId;

    IF @DateType IS NULL
        SET @DateType = CASE @culture
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
          AND us.UserID = @userId;

    IF @DateFormat IS NULL
        SET @DateFormat = N'YY/MM/DD';

    SELECT @ended = lev.Value
    FROM CFG.LocalizeEnum AS le
        JOIN CFG.LocalizeEnumValue AS lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'RequestStates'
          AND le.Item = 'Ended'
          AND lev.Culture = @culture;

    SELECT @rejected = lev.Value
    FROM CFG.LocalizeEnum AS le
        JOIN CFG.LocalizeEnumValue AS lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'RequestStates'
          AND le.Item = 'Rejected'
          AND lev.Culture = @culture;

    SELECT @confirmed = lev.Value
    FROM CFG.LocalizeEnum AS le
        JOIN CFG.LocalizeEnumValue AS lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'RequestStates'
          AND le.Item = 'Confirmed'
          AND lev.Culture = @culture;

    SELECT @submitted = lev.Value
    FROM CFG.LocalizeEnum AS le
        JOIN CFG.LocalizeEnumValue AS lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'RequestStates'
          AND le.Item = 'Submitted'
          AND lev.Culture = @culture;

    SELECT @withoutBase = lev.Value
    FROM CFG.LocalizeEnum AS le
        JOIN CFG.LocalizeEnumValue AS lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'RequestDocumentBase'
          AND le.Item = 'WithoutBase'
          AND lev.Culture = @culture;

    SELECT @stuffRequest = lev.Value
    FROM CFG.LocalizeEnum AS le
        JOIN CFG.LocalizeEnumValue AS lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'RequestDocumentBase'
          AND le.Item = 'StuffRequest'
          AND lev.Culture = @culture;

     SELECT @serviceRequest = lev.Value
     FROM CFG.LocalizeEnum AS le
         JOIN CFG.LocalizeEnumValue AS lev
             ON lev.LocalizeEnumID = le.LocalizeEnumID
     WHERE le.Enum = 'RequestDocumentBase'
           AND le.Item = 'ServiceRequest'
           AND lev.Culture = @culture;

    SELECT @order = lev.Value
    FROM CFG.LocalizeEnum AS le
        JOIN CFG.LocalizeEnumValue AS lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'RequestDocumentBase'
          AND le.Item = 'Order'
          AND lev.Culture = @culture;

    SELECT @justification = lev.Value
    FROM CFG.LocalizeEnum AS le
        JOIN CFG.LocalizeEnumValue AS lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'RequestDocumentBase'
          AND le.Item = 'Justification'
          AND lev.Culture = @culture;

    SELECT @quotation = lev.Value
    FROM CFG.LocalizeEnum AS le
        JOIN CFG.LocalizeEnumValue AS lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'RequestDocumentBase'
          AND le.Item = 'Quotation'
          AND lev.Culture = @culture;

    SELECT @saleContract = lev.Value
    FROM CFG.LocalizeEnum AS le
        JOIN CFG.LocalizeEnumValue AS lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'RequestDocumentBase'
          AND le.Item = 'SaleContract'
          AND lev.Culture = @culture;

    SELECT @transferRequest = lev.Value
    FROM CFG.LocalizeEnum AS le
        JOIN CFG.LocalizeEnumValue AS lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'RequestDocumentBase'
          AND le.Item = 'TransferRequest'
          AND lev.Culture = @culture;

    DROP TABLE IF EXISTS #branchAccess;
    DROP TABLE IF EXISTS #organizationUnitAccess;

    SELECT vba.BranchID
    INTO #branchAccess
    FROM CFG.vwBranchAccess AS vba;

    SELECT voua.OrganizationUnitID
    INTO #organizationUnitAccess
    FROM CFG.vwOrganizationUnitAccess AS voua;


    SELECT @ViewRelatedToUser = UserID
    FROM CFG.vwOperationLevelAccess
    WHERE EntityName = 'PurchaseRequest'
          AND AccessKey = 'ViewRelatedToUser'
          AND UserID = @userId;

    SELECT @ViewRelatedToOthers = UserID,
           @UnauthorizedUsers = Users
    FROM CFG.vwOperationLevelAccess
    WHERE EntityName = 'PurchaseRequest'
          AND AccessKey = 'ViewRelatedToOthers'
          AND UserID = @userId;

    IF @Sort IS NULL
       OR @Sort = ''
        SET @Sort = N' PurchaseRequestDate desc ';

    DECLARE @query NVARCHAR(MAX);

    SET @query
        = N';WITH Query_Result 
			(
				PurchaseRequestID,
				BranchID,
				BaseDocument,
				BaseDocumentString,
				StateString,
				PurchaseRequestNumber,
				PurchaseRequestDate,
				PurchaseRequestState,
				PurchaseRequester,
				OrganizationUnitID,
				Creator,
				CreationDate,
				LastEditor,
				LastEditionDate,
				Version,
				FinancialPeriodID,
				BranchCode,
				BranchTitle,
				Date_PurchaseRequestDate,
				CreateDateString,
				EditionDateString,
				CreatorUserName,
				EditorName,
				EditorNameRelatedToState,
				LastUpdateDateRelatedToState,
                ReviewerName,
                Reviewer,
                ReviewDate,
                Date_ReviewDate
			)
			AS 
			(
				SELECT pr.PurchaseRequestID,
					   pr.BranchID,
					   pr.BaseDocument,
					   CASE pr.BaseDocument
						   WHEN 2 THEN @stuffRequest
						   WHEN 5 THEN @order
						   WHEN 6 THEN @justification
						   WHEN 7 THEN @quotation
						   WHEN 8 THEN @saleContract
						   WHEN 9 THEN @transferRequest
						   WHEN 10 THEN @serviceRequest
						   ELSE @withoutBase
					   END AS BaseDocumentString,
					   CASE pr.PurchaseRequestState
							WHEN 2 THEN @Confirmed
							WHEN 3 THEN @Rejected
							WHEN 4 THEN @Ended
							ELSE @submitted 
					   END AS StateString,
					   pr.PurchaseRequestNumber,
					   pr.PurchaseRequestDate,
					   pr.PurchaseRequestState,
					   CASE @CultureNo
						   WHEN 2 THEN ou.Title2
						   ELSE ou.Title
					   END AS PurchaseRequester,
					   pr.OrganizationUnitID,
					   pr.Creator,
					   pr.CreationDate,
					   pr.LastEditor,
					   pr.LastEditionDate,
					   pr.[Version],
					   pr.FinancialPeriodID,
					   b.Code AS BranchCode,
					   CASE @CultureNo
						   WHEN 2 THEN b.Title2
						   ELSE b.Title
					   END AS BranchTitle,
					   CFG.GetCLRSaturnDate(pr.PurchaseRequestDate, @DateFormat, 0, @DateType) AS Date_PurchaseRequestDate,
					   CFG.GetCLRSaturnDate(pr.CreationDate, @DateFormat, 1, @DateType) AS CreateDateString,
					   CFG.GetCLRSaturnDate(pr.LastEditionDate, @DateFormat, 1, @DateType) AS EditionDateString,
					   u.Name AS CreatorUserName,
					   lu.Name AS EditorName,
					   CASE WHEN pr.PurchaseRequestState <> 1  THEN lu.Name ELSE '''' END  AS EditorNameRelatedToState,
					   CASE WHEN pr.PurchaseRequestState <> 1  THEN 
							CFG.GetCLRSaturnDate(pr.LastEditionDate, @DateFormat, 1, @DateType)
					   ELSE '''' END  AS LastUpdateDateRelatedToState,
                        u3.Name ReviewerName,
                        pr.Reviewer,
                        pr.ReviewDate,
                        CFG.GetCLRSaturnDate(pr.ReviewDate, @DateFormat, 1, @DateType) Date_ReviewDate
				FROM REQ.PurchaseRequest AS pr
                     LEFT JOIN CFG.[User] u3 
                        on u3.UserID=pr.Reviewer
					JOIN CFG.[User] AS u
						ON u.UserID = pr.Creator
					JOIN CFG.[User] AS lu
						ON lu.UserID = pr.LastEditor
					JOIN CFG.Branch AS b
						ON b.BranchID = pr.BranchID
					JOIN CFG.OrganizationUnit AS ou
						ON ou.OrganizationUnitID = pr.OrganizationUnitID
					JOIN #branchAccess AS ba
						ON ba.BranchID = pr.BranchID
					JOIN #organizationUnitAccess AS oua
						ON oua.OrganizationUnitID = pr.OrganizationUnitID
				WHERE pr.FinancialPeriodID = @FinancialPeriodID
					AND (
						@UserID = -1
						OR (@ViewRelatedToUser IS NOT NULL AND pr.Creator = @UserID)
						OR ( @ViewRelatedToOthers IS NOT NULL AND pr.Creator NOT IN (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsers) AS rfcst) )
					)
		)';


    IF @Filter IS NULL
       OR @Filter = ''
        SET @Filter = N'';
    ELSE
        SET @Filter = N'Where (' + @Filter + N')';


    DECLARE @tableName VARCHAR(100);
    SET @tableName = CFG.getTempTableName(1);

    SET @query = CFG.ApplyPaging(@tableName, @query, @PageNumber, @RowspPage, @Filter, @Sort);

    --PRINT @Query

    EXECUTE sys.sp_executesql @query,
                              N'
		 @FinancialPeriodID INT,
		 @CultureNo INT,
		 @userId INT,
		 @DateType INT,
		 @DateFormat NVARCHAR(20),
		 @ViewRelatedToUser INT,
		 @ViewRelatedToOthers NVARCHAR(MAX),
		 @UnauthorizedUsers NVARCHAR(MAX),
		 @withoutBase NVARCHAR(100),
		 @stuffRequest NVARCHAR(100),
		 @order NVARCHAR(100),
		 @justification NVARCHAR(100),
		 @quotation NVARCHAR(100),
		 @saleContract NVARCHAR(100),
		 @transferRequest NVARCHAR(100),
         @submitted NVARCHAR(100),
         @confirmed NVARCHAR(100),
         @rejected NVARCHAR(100),
         @ended NVARCHAR(100),
         @serviceRequest NVARCHAR(100)
	 ',
        @CultureNo = @CultureNo,
        @userId = @userId,
        @DateType = @DateType,
        @DateFormat = @DateFormat,
        @ViewRelatedToUser = @ViewRelatedToUser,
        @ViewRelatedToOthers = @ViewRelatedToOthers,
        @UnauthorizedUsers = @UnauthorizedUsers,
        @withoutBase = @withoutBase,
        @stuffRequest = @stuffRequest,
        @order = @order,
        @justification = @justification,
        @quotation = @quotation,
        @saleContract = @saleContract,
        @transferRequest = @transferRequest,
        @FinancialPeriodID = @FinancialPeriodID,
        @submitted = @submitted,
        @confirmed = @confirmed,
        @rejected = @rejected,
        @ended = @ended,
        @serviceRequest = @serviceRequest;

    DECLARE @Count INT;

    EXEC ('select * from ' + @tableName + ' ORDER BY _RN');

    SET @query = N'select top 1 @Count=  r_count from ' + @tableName;
    EXECUTE sys.sp_executesql @query, N'@count int out', @Count = @Count OUT;

    RETURN ISNULL(@Count, 0);
END;
