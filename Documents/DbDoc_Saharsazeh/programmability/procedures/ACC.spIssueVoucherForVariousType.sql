
----------------------------------------------------------------
CREATE    PROCEDURE [ACC].spIssueVoucherForVariousType
(
    @rows VARCHAR(MAX) = NULL,
    --0 : يک سند براي يک رديف
    --1 : يک سند براي تمامي رديف ها
    --2 : يک سند  براي يک روز
    @IssueType TINYINT,
    --0 به تفکيک صادر شود
    --1  تجميعي در سطح بيش فاکتور
    --2  تجميعي در سطح تمامي پيش فاکتور ها
    @IsTjmi TINYINT = 1,
    @Creator NVARCHAR(500),
    @Number INT,
    @Subnumber NVARCHAR(256),
    @Date DATETIME,
    @FinancialPeriodID INT,
    @Description NVARCHAR(MAX) = NULL,
    @Description2 NVARCHAR(MAX) = NULL,
	@DocumentTypeID		   int 
)

--With Encryption
AS

DECLARE @CreatorId INT,
        @docTypeId INT,
        @PreVoucherId INT,
        @ErrorMessage NVARCHAR(MAX),
        @FinStartDate DATE,
        @FinEndDate DATE,
        @Message NVARCHAR(MAX),
        @DefaultDesc NVARCHAR(2014),
        @LatestConfirmedVoucherDate DATETIME = NULL;

SELECT @CreatorId = UserID
FROM CFG.[User]
WHERE Username = @Creator;


SELECT TOP 1
    @LatestConfirmedVoucherDate = v.[Date]
FROM ACC.Voucher v
WHERE v.VoucherStatusID = 4
      AND v.FinancialPeriodID = @FinancialPeriodID
ORDER BY v.[Date] DESC; 

DECLARE @StartNum INT = NULL,
        @EndNum INT = NULL,
		@DocumentNumID int

SELECT @StartNum = StartNum,
       @EndNum = EndNum,
			@DocumentNumID = DocumentNumID
FROM CFG.DocumentNum
WHERE DocumentNumTypeID = 1
      AND FinancialPeriodID = @FinancialPeriodID; 



IF @Subnumber = 0
    SET @Subnumber = NULL;

IF @Description = ''
    SET @Description = NULL;

IF @Description2 = ''
    SET @Description2 = NULL;

SELECT @FinStartDate = fp.StartDate,
       @FinEndDate = fp.EndDate
FROM CFG.FinancialPeriod fp
WHERE fp.FinancialPeriodID = @FinancialPeriodID;


	BEGIN TRY
    --BEGIN TRANSACTION;


    DECLARE @ISOne BIT;

    SET @ISOne = 0;

    SELECT [CFG].[GetStringPartBySpliter](value, 1, '#') a,
           [CFG].[GetStringPartBySpliter](value, 2, '#') b
    INTO #a
    FROM [CFG].[Split](@rows, '|');

    SELECT @rows = STUFF(
    (
        SELECT ',' + a + '#' + REPLACE(b, ',', ',' + a + '#')
        FROM #a
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'),
    1   ,
    1   ,
    ''
                        );

    CREATE TABLE #IDs
    (
        DocumentType VARCHAR(256),
        DocumentID INT,
        PreVoucherID INT,
        VoucherID INT,
        RowNumber INT,
        DocDate DATE,
        Number VARCHAR(255)
    );

    INSERT INTO #IDs
    SELECT [CFG].[GetStringPartBySpliter](value, 1, '#'),
           [CFG].[GetStringPartBySpliter](value, 2, '#'),
           NULL,
           -1,
           ROW_NUMBER() OVER (ORDER BY value),
           NULL,
           NULL
    FROM [CFG].[Split](@rows, ',');

    IF
    (
        SELECT COUNT(1) FROM #IDs
    ) = 1
        SET @ISOne = 1;


	CREATE TABLE #IssuePrevoucherResult
	(
	DocumentId int,
	ErrorMessage varchar(max),
	PrevoucherID int,
	DocDate Date,
	Number varchar(256),
	DocumentType varchar(max)
	)


    DECLARE @DocumentIDsForIssuePrevoucher   NVARCHAR(MAX),
            @DocumentType VARCHAR(256);

    DECLARE CursorForIssuePrevoucher CURSOR FOR 
	SELECT DocumentType 
	FROM #IDs
	group by DocumentType;

    OPEN CursorForIssuePrevoucher;

    FETCH NEXT FROM CursorForIssuePrevoucher INTO @DocumentType;
	
    WHILE @@FETCH_STATUS = 0
    BEGIN
	
	SELECT @DocumentIDsForIssuePrevoucher = STUFF((SELECT DISTINCT ',' + cast(DocumentID as varchar(25))
					FROM   #IDs
					where DocumentType = @DocumentType
					FOR XML PATH(''),TYPE).value('.', 'NVARCHAR(MAX)'),1,1,'')
					
	--insert into #IssuePrevoucherResult
		        EXEC [ACC].spIssuePreVoucher 
					 @documentType,	
		             @DocumentIDsForIssuePrevoucher,	
					 1;

				
    FETCH NEXT FROM CursorForIssuePrevoucher INTO @DocumentType;
    END;

    CLOSE CursorForIssuePrevoucher;
    DEALLOCATE CursorForIssuePrevoucher;


		if exists (select * from #IssuePrevoucherResult where ErrorMessage is not null )
		BEGIN
			RAISERROR('ERROE',16,13);		    
		END;
		ELSE
			UPDATE #IDs
			SET    DocDate     = i.DocDate,
					Number      = i.Number,
					PreVoucherID = i.PreVoucherID
			FROM   #IDs
			INNER JOIN #IssuePrevoucherResult i
				ON  i.DocumentId = #IDs.DocumentID and i.DocumentType = #IDs.DocumentType;


    DECLARE @Mindate DATE,
            @maxDate DATE;


    SELECT @maxDate = MAX(DocDate),
           @Mindate = MIN(DocDate)
    FROM #IDs;

    IF (
           @IssueType = 1
           OR @ISOne = 1
       )
       AND CAST(@Date AS DATE) <
       (
           SELECT MAX(DocDate) FROM #IDs
       )
    BEGIN
        SET @Message = N'VoucherDateLittleThanSelectedDocumentDate';
        RAISERROR(@Message, 16, 10);
    END;

    DECLARE @Items NVARCHAR(MAX);

    --Check Sanad
    SELECT @Items = STUFF(
    (
        SELECT DISTINCT TOP 10
            ' ،' + CAST(#IDs.Number AS NVARCHAR(250))
        FROM ACC.VoucherPrevoucher vp
            INNER JOIN #IDs
                ON vp.PrevoucherID = #IDs.PreVoucherID
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'),
    1   ,
    2   ,
    ''
                         );

    IF @Items IS NOT NULL
    BEGIN
        SELECT @Message = lsv.[Value]
        FROM CFG.LocalizationSQLMessage ls
            JOIN CFG.LocalizationSQLMessageValue lsv
                ON lsv.LocalizationSQLMessageID = ls.LocalizationSQLMessageID
        WHERE ls.SQLMessageCode = 'ACC_spVoucherInsert_11'
              AND lsv.Culture = CFG.GetuserCulture();

        SET @Message = @Message + CHAR(13) + CHAR(10) + @Items;
        RAISERROR(@Message, 16, 10);
    END;

    -------------Convert PreVoucher To Voucher

    IF @IssueType = 1
       OR @IssueType = 2
    BEGIN
        DECLARE @BranchIdCount INT;

        SELECT @BranchIdCount = COUNT(DISTINCT pv.BranchID)
        FROM ACC.PreVoucher pv
            INNER JOIN #IDs
                ON pv.PreVoucherID = #IDs.PreVoucherID;

        IF @BranchIdCount <> 1
        BEGIN
            SET @Message = 'Accounting.DifferentBranchDocuments';
            RAISERROR(@Message, 16, 10);
        END;


    END;

    DECLARE @BranchID INT;
    SELECT TOP 1
        @BranchID = pv.BranchID
    FROM ACC.PreVoucher pv
        INNER JOIN #IDs
            ON pv.PreVoucherID = #IDs.PreVoucherID;

	DECLARE @CompanyID int
	select @CompanyID = CompanyID
	from cfg.Branch
	where BranchID = @BranchID
    ------------------------Validate PreVouchers
    SELECT @Items = STUFF(
    (
        SELECT DISTINCT TOP 10
            ' ،' + CAST(#IDs.Number AS NVARCHAR(250))
        FROM ACC.PreVoucherItem pvi
            INNER JOIN #IDs
                ON pvi.PreVoucherID = #IDs.PreVoucherID
        GROUP BY #IDs.PreVoucherID,
                 #IDs.Number
        HAVING (SUM(pvi.Debit) - SUM(Credit) <> 0)
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'),
    1   ,
    2   ,
    ''
                         );


    IF @Items IS NOT NULL
    BEGIN
        SET @Message = 'ACC_spIssueVoucher_3' + CHAR(13) + CHAR(10) + @Items;
        RAISERROR(@Message, 16, 10);
    END;


    SELECT @Items = STUFF(
    (
        SELECT DISTINCT TOP 10
            ' ،' + CAST(#IDs.Number AS NVARCHAR(250))
        FROM #IDs
        WHERE NOT EXISTS
    (
        SELECT pvi.PreVoucherItemID
        FROM ACC.PreVoucherItem pvi
        WHERE pvi.PreVoucherID = #IDs.PreVoucherID
    )
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'),
    1   ,
    2   ,
    ''
                         );


    IF @Items IS NOT NULL
    BEGIN
        SET @Message = 'ACC_spIssueVoucher_4' + CHAR(13) + CHAR(10) + @Items;
        RAISERROR(@Message, 16, 10);
    END;


    SELECT @Items = STUFF(
    (
        SELECT DISTINCT TOP 10
            ' ،' + CAST(#IDs.Number AS NVARCHAR(250))
        FROM ACC.PreVoucherItem pvi
            INNER JOIN #IDs
                ON pvi.PreVoucherID = #IDs.PreVoucherID
        WHERE pvi.[Description] IS NULL
              AND LTRIM(RTRIM(pvi.[Description])) = ''
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'),
    1   ,
    2   ,
    ''
                         );


    IF @Items IS NOT NULL
    BEGIN
        SET @Message = 'ACC_spIssueVoucher_5' + CHAR(13) + CHAR(10) + @Items;
        RAISERROR(@Message, 16, 10);
    END;


    SELECT @Items = STUFF(
    (
        SELECT DISTINCT TOP 10
            ' ،' + CAST(#IDs.Number AS NVARCHAR(250))
        FROM ACC.PreVoucherItem pvi
            INNER JOIN #IDs
                ON pvi.PreVoucherID = #IDs.PreVoucherID
        WHERE pvi.Debit = 0
              AND pvi.Credit = 0
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'),
    1   ,
    2   ,
    ''
                         );

    IF @Items IS NOT NULL
    BEGIN
        SET @Message = 'ACC_spIssueVoucher_6' + CHAR(13) + CHAR(10) + @Items;
        RAISERROR(@Message, 16, 10);
    END;


    IF @IssueType = 1
       OR @ISOne = 1
    BEGIN
        IF NOT @Date
           BETWEEN @FinStartDate AND @FinEndDate
        BEGIN
            SELECT @Message = 'InRangDateValidation';
            RAISERROR(@Message, 16, 10);

        END;
    END;

    --Check AccountLevels
    DECLARE @Columns VARCHAR(MAX),
            @OrColumns VARCHAR(MAX),
            @SourceQuery NVARCHAR(MAX);

    SELECT @Columns = STUFF(
    (
        SELECT DISTINCT
            ',' + QUOTENAME(al.AccountLevelID)
        FROM ACC.AccountLevel al
        WHERE al.IsMandatory = 1
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'),
    1   ,
    1   ,
    ''
                           );


    SELECT @OrColumns = STUFF(
    (
        SELECT DISTINCT
            'or ' + QUOTENAME(al.AccountLevelID) + ' Is Null '
        FROM ACC.AccountLevel al
        WHERE al.IsMandatory = 1
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'),
    1   ,
    2   ,
    ''
                             );

	insert into #IssuePrevoucherResult (DocumentId ,ErrorMessage)
	SELECT  #IDs.DocumentId,
			'ACC_spIssueVoucher_8' ErrorMessage
	FROM ACC.PreVoucherItem pvi
	INNER JOIN #IDs ON #IDs.PreVoucherID = pvi.PreVoucherID
	INNER JOIN ACC.AccountLevelSL als ON als.SlID = pvi.SlID
	INNER JOIN ACC.AccountLevel al ON al.AccountLevelID = als.AccountLevelID
									AND al.IsMandatory = 1
	LEFT JOIN ACC.PreVoucherItemAccountLevel pvial ON pvial.PreVoucherItemID = pvi.PreVoucherItemID
													AND pvial.AccountLevelID = als.AccountLevelID
	where pvial.PreVoucherItemAccountLevelID is null

	if exists (select * from #IssuePrevoucherResult where ErrorMessage is not null )
		BEGIN
			RAISERROR('ERROE',16,13);		 
		END;

    ------------------Numbering
    DECLARE @ReferenceNumber INT,
            @DailyNumber INT,
            @maxVoucherID INT;

	SET @ReferenceNumber = ISNULL(
	        (
	            SELECT MAX(ReferenceNumber)
	            FROM   [ACC].[Voucher] v
				join cfg.Branch b on v.BranchID = b.BranchID
	            WHERE  v.FinancialPeriodID = @FinancialPeriodID
				AND b.CompanyID = @CompanyID
	        ),0);

    SET @DailyNumber = ISNULL(
                       (
                           SELECT MAX(DailyNumber) FROM [ACC].[Voucher] WHERE [Date] = @Date
                       ),
                       0
                             );


    IF @Number = 0
        -- @IssueType <> 1 AND @ISOne
	    SET @Number = ISNULL(
	            (
	                SELECT MAX(Number) + 1
	                FROM   [ACC].[Voucher] v
					join cfg.Branch b on v.BranchID = b.BranchID
					WHERE  v.FinancialPeriodID = @FinancialPeriodID
					AND b.CompanyID = @CompanyID
	            ),
	            @StartNum
	        );



    IF (@Number < @StartNum OR (@EndNum IS NOT NULL AND @Number > @EndNum))
    BEGIN

        RAISERROR('InvalidNumberRange', 16, 10);

    END;

    IF (
           @ISOne = 1
           AND
           (
	               SELECT COUNT(*)
	               FROM   ACC.Voucher v
				   join cfg.Branch b on v.BranchID = b.BranchID
	               WHERE  v.Number = @Number
	                AND v.FinancialPeriodID = @FinancialPeriodID
					AND b.CompanyID = @CompanyID
           ) <> 0
       )
    BEGIN
        SELECT @Message = 'NumberIsDuplicate';
        RAISERROR(@Message, 16, 10);
    END;

    --------------------------------------------

    SET @maxVoucherID = ISNULL(
                        (
                            SELECT MAX(VoucherID) FROM ACC.Voucher
                        ),
                        1
                              );



    CREATE TABLE #Voucher
    (
        [VoucherID] [INT] NOT NULL,
        [BranchID] [INT] NOT NULL,
        [FinancialPeriodID] [INT] NOT NULL,
        [DocumentTypeID] [SMALLINT] NOT NULL,
        [Number] [INT] NOT NULL,
        [ReferenceNumber] [INT] NOT NULL,
        [DailyNumber] [INT] NOT NULL,
        [SubNumber] [NVARCHAR](256) NULL,
        [Date] [DATE] NOT NULL,
        [VoucherStatusID] [SMALLINT] NOT NULL,
        [Description] [NVARCHAR](MAX) NULL,
        [Description2] [VARCHAR](MAX) NULL,
        [Creator] [INT] NOT NULL,
        [CreationDate] [DATETIME] NOT NULL,
        [LastEditor] [INT] NOT NULL,
        [LastEditionDate] [DATETIME] NOT NULL,
        [Version] [INT] NOT NULL,
        PreVoucherID INT
    );

    IF (@IssueType = 1)
        SET @DefaultDesc
            = 'بابت اسناد تجمیعی از تاریخ  ' + CFG.GetCLRSaturnDate(@Mindate, 'YY/MM/DD', 0, 0) + ' تا تاریخ '
              + CFG.GetCLRSaturnDate(@maxDate, 'YY/MM/DD', 0, 0);

    ELSE
        SET @DefaultDesc = 'بابت اسناد تجمیعی در تاریخ  ' 


    IF @IssueType = 0
       OR @IssueType = 1
        INSERT INTO #Voucher
        (
            VoucherID,
            BranchID,
            FinancialPeriodID,
            DocumentTypeID,
            Number,
            ReferenceNumber,
            DailyNumber,
            SubNumber,
            Date,
            VoucherStatusID,
            [Description],
            Description2,
            Creator,
            CreationDate,
            LastEditor,
            LastEditionDate,
            Version,
            PreVoucherID
        )
        SELECT @maxVoucherID + RowNumber,
               pv.BranchID,
               pv.FinancialPeriodID,
               @DocumentTypeID,
               CASE
                   WHEN @IssueType = 1
                        OR @ISOne = 1 THEN
                       @Number
                   ELSE
                       @Number + RowNumber - 1
               END,
               @ReferenceNumber + RowNumber,
               CASE
                   WHEN @IssueType = 1
                        OR @ISOne = 1 THEN
                       @DailyNumber + RowNumber
                   ELSE
                       ISNULL(DailyNumberDate.DailyNumber, 0)
                       + ROW_NUMBER() OVER (PARTITION BY DocDate ORDER BY DocDate)
               END,
               CASE
                   WHEN @IssueType = 1
                        OR @ISOne = 1 THEN
                       @Subnumber
                   ELSE
                       NULL
               END,
               CASE
                   WHEN @IssueType = 1
                        OR @ISOne = 1 THEN
                       @Date
                   ELSE
                       #IDs.DocDate
               END,
               1,
               CASE
                    WHEN @Description IS NOT NULL THEN @Description
					WHEN @Description IS  NULL and @IssueType = 1 THEN @DefaultDesc
                    ELSE
                        pv.[Description]
               END,
               CASE
                    WHEN @Description2 IS NOT NULL THEN @Description2
					WHEN @Description2 IS  NULL and @IssueType = 1 THEN @DefaultDesc
                    ELSE
                        pv.[Description2]
               END,
               @CreatorId,
               GETDATE(),
               @CreatorId,
               GETDATE(),
               1,
               #IDs.PreVoucherID
        FROM ACC.PreVoucher pv
            INNER JOIN #IDs
                ON pv.PreVoucherID = #IDs.PreVoucherID
            LEFT JOIN
            (
                SELECT v.Date,
                       MAX(v.DailyNumber) AS DailyNumber
                FROM ACC.Voucher v
                GROUP BY v.Date
            ) DailyNumberDate
                ON DailyNumberDate.Date = #IDs.DocDate
        WHERE (
                  @IssueType = 0
                  OR
                  (
                      @IssueType = 1
                      AND RowNumber = 1
                  )
              );




    IF @IssueType = 2
        INSERT INTO #Voucher
        (
            VoucherID,
            BranchID,
            FinancialPeriodID,
            DocumentTypeID,
            Number,
            ReferenceNumber,
            DailyNumber,
            SubNumber,
            Date,
            VoucherStatusID,
            [Description],
            Description2,
            Creator,
            CreationDate,
            LastEditor,
            LastEditionDate,
            Version,
            PreVoucherID
        )
        SELECT @maxVoucherID + ROW_NUMBER() OVER (ORDER BY DocDate),
               @BranchID,
               @FinancialPeriodID,
               @DocumentTypeID,
               CASE
                   WHEN @ISOne = 1 THEN
                       @Number
                   ELSE
                       @Number + ROW_NUMBER() OVER (ORDER BY DocDate) - 1
               END,
               @ReferenceNumber + ROW_NUMBER() OVER (ORDER BY DocDate),
               ISNULL(MAX(DailyNumberDate.DailyNumber), 0) + ROW_NUMBER() OVER (PARTITION BY DocDate ORDER BY DocDate),
               NULL,
               DocDate,
               1,
               CASE
                   WHEN @Description IS NOT NULL THEN
                       @Description
                   ELSE
                       @DefaultDesc + cfg.GetCLRSaturnDate(#IDs.[DocDate],'yyyy/mm/dd',0,0)
               END,
               CASE
                   WHEN @Description2 IS NOT NULL THEN
                       @Description2 + cfg.GetCLRSaturnDate(#IDs.[DocDate],'yyyy/mm/dd',0,0)
                   ELSE
                       @DefaultDesc
               END,
               @CreatorId,
               GETDATE(),
               @CreatorId,
               GETDATE(),
               1,
               0
        FROM ACC.PreVoucher pv
            INNER JOIN #IDs
                ON pv.PreVoucherID = #IDs.PreVoucherID
            LEFT JOIN
            (
                SELECT v.Date,
                       MAX(v.DailyNumber) AS DailyNumber
                FROM ACC.Voucher v
                GROUP BY v.Date
            ) DailyNumberDate
                ON DailyNumberDate.Date = #IDs.DocDate
        GROUP BY #IDs.DocDate;


    --ChekNumber

    SET IDENTITY_INSERT ACC.Voucher ON;

    INSERT INTO ACC.Voucher
    (
        VoucherID,
        BranchID,
        FinancialPeriodID,
        DocumentTypeID,
        Number,
        ReferenceNumber,
        DailyNumber,
        SubNumber,
        Date,
        VoucherStatusID,
        [Description],
        Description2,
        Creator,
        CreationDate,
        LastEditor,
        LastEditionDate,
        Version,
        Total,
		[AutoGenerated]
    )
    SELECT VoucherID,
           BranchID,
           FinancialPeriodID,
           DocumentTypeID,
           Number,
           ReferenceNumber,
           DailyNumber,
           SubNumber,
           Date,
           VoucherStatusID,
           [Description],
           Description2,
           Creator,
           CreationDate,
           LastEditor,
           LastEditionDate,
           Version,
           0,
		   1
    FROM #Voucher;

    SET IDENTITY_INSERT ACC.Voucher OFF;



    ---Tajmi Item Ha
    DECLARE @maxVoucherItemID BIGINT;


    SET @maxVoucherItemID = ISNULL(
                            (
                                SELECT MAX(VoucherItemID) FROM ACC.VoucherItem vi
                            ),
                            1
                                  );


    IF OBJECT_ID('tempdb..##mergeItem') IS NOT NULL
        DROP TABLE ##mergeItem;


    IF OBJECT_ID('tempdb..##VoucherPreVoucher') IS NOT NULL
        DROP TABLE ##VoucherPreVoucher;

    IF OBJECT_ID('tempdb..##P') IS NOT NULL
        DROP TABLE ##p;

    CREATE TABLE ##VoucherPreVoucher
    (
        VoucherItemID DECIMAL(18, 0),
        PreVoucherItemID DECIMAL(18, 0)
    );

    IF @IsTjmi = 1
    BEGIN
        DECLARE @RelationJoin NVARCHAR(MAX);

        SELECT @Columns = STUFF(
        (
            SELECT DISTINCT
                ',' + QUOTENAME(al.AccountLevelID)
            FROM ACC.AccountLevel al
            FOR XML PATH(''), TYPE
        ).value('.', 'NVARCHAR(MAX)'),
        1   ,
        1   ,
        ''
                               );

        SELECT @RelationJoin
            = STUFF(
        (
            SELECT DISTINCT
                ' AND IsNull(T.' + QUOTENAME(al.AccountLevelID) + ',-1)=isNull(M.' + QUOTENAME(al.AccountLevelID)
                + ',-1)'
            FROM ACC.AccountLevel al
            FOR XML PATH(''), TYPE
        ).value('.', 'NVARCHAR(MAX)'),
        1   ,
        1   ,
        ''
                   );

        IF @Columns IS NULL
            SET @Columns = '[10000]';


        SET @SourceQuery
            = ' select * into ##P from (
	
	SELECT 	pvi.PreVoucherID	,	
			pvi.RowIndex		,
			pvi.PrevoucherItemID,
			pvi.SlID			,
			pvi.Debit			,
			pvi.Credit			,
			pvi.CurrencyID		,
			pvi.CurrencyRate	,
			pvi.CurrencyDebit	,
			pvi.CurrencyCredit	,	
			pv.Description,
			pv.Description2,
			#IDs.DocDate as Date,
			CASE WHEN pvi.Debit<>0 THEN 1 ELSE 0 END IsDebit,
			' + @Columns+ '
	FROM   acc.PreVoucherItem pvi
	join acc.PreVoucher pv on pv.PreVoucherID = pvi.PreVoucherID
	 INNER JOIN #IDs
	            ON  #Ids.PreVoucherID = pvi.PreVoucherID
	       LEFT JOIN (
	                SELECT pvial.PreVoucherItemID,
	                       pvial.AccountLevelID,
	                       CASE 
	                            WHEN DLID IS NOT NULL THEN Cast( DLID as varchar(10))
	                            WHEN DLID IS NULL THEN VALUE
	                       END VALUE
	                FROM Acc.PreVoucherItemAccountLevel pvial
	            ) x
	            PIVOT(
	                MAX(VALUE)
	                FOR AccountLevelID IN (' + @Columns
              + ')
	            ) p
	            ON pvi.PreVoucherItemID=p.PreVoucherItemID
	
	)T' ;

        EXEC (@SourceQuery);

        SET @SourceQuery
            = ' SELECT T.PreVoucherID,T.Date,T.SlID,MAX(Description) as Description,T.IsDebit,T.CurrencyID,
			T.CurrencyRate,MAX(Description2) AS Description2,MIN(RowIndex) AS RowIndex,';

        IF @Columns <> ''
            SET @SourceQuery = @SourceQuery + @Columns + ',';

        SET @SourceQuery
            = @SourceQuery
              + '
				SUM(CASE WHEN IsDebit=0 THEN 0 ELSE  T.Debit END ) AS Debit,
				SUM(CASE WHEN IsDebit=0 THEN T.Credit ELSE  0 END ) AS Credit,
				SUM(CASE WHEN IsDebit=0 THEN 0 ELSE  T.CurrencyDebit END ) AS CurrencyDebit,
				SUM(CASE WHEN IsDebit=0 THEN T.CurrencyCredit ELSE  0 END ) AS CurrencyCredit,
				ROW_NUMBER() OVER (ORDER BY  T.PreVoucherID) AS VoucherItemID
				INTO ##mergeItem
				 FROM 
				(
					select * from ##P
				)T
				GROUP BY T.PreVoucherID,T.Date,T.SlID,T.CurrencyID,T.CurrencyRate,IsDebit
				 ';


        IF @Columns <> ''
            SET @SourceQuery = @SourceQuery + ',' + @Columns;

        EXEC (@SourceQuery);

        DECLARE @RelationQuery NVARCHAR(MAX);

        SET @RelationQuery
            = 'INSERT INTO ##VoucherPreVoucher 
						select M.VoucherItemID,T.PreVoucherItemID'
              + ' 
	                    from ##P T INNER JOIN ##mergeItem M
	            ON  T.PreVoucherID=M.PreVoucherID AND T.SlID=M.SlID AND T.CurrencyID=M.CurrencyID AND 
	            T.CurrencyRate=M.CurrencyRate AND T.IsDebit=M.IsDebit 
	             ' + @RelationJoin;

        EXEC (@RelationQuery);

    END;

    ELSE IF @IsTjmi = 0
    BEGIN
        SELECT pvi.PreVoucherID,
               SlID,
               [Description],
               CurrencyID,
               CurrencyRate,
               Description2 AS Description2,
               RowIndex AS RowIndex,
               Debit,
               Credit,
               CurrencyDebit,
               CurrencyCredit,
               ROW_NUMBER() OVER (ORDER BY pvi.PreVoucherID, pvi.PreVoucherItemID) AS VoucherItemID,
               pvi.PreVoucherItemID,
               #IDs.DocDate AS DATE
        INTO ##mergeItem
        FROM ACC.PreVoucherItem pvi
            INNER JOIN #IDs
                ON #IDs.PreVoucherID = pvi.PreVoucherID
        ORDER BY pvi.PreVoucherID;

        INSERT INTO ##VoucherPreVoucher
        SELECT VoucherItemID,
               PreVoucherItemID
        FROM ##mergeItem;
    END;
    ELSE
    BEGIN
        SELECT @Columns = STUFF(
        (
            SELECT DISTINCT
                ',' + QUOTENAME(al.AccountLevelID)
            FROM ACC.AccountLevel al
            FOR XML PATH(''), TYPE
        ).value('.', 'NVARCHAR(MAX)'),
        1   ,
        1   ,
        ''
                               );


        IF @Columns IS NULL
            SET @Columns = '[10000]';

        SET @SourceQuery
            = ' select T.* into ##P from (
		
		SELECT pvi.*,#IDs.DocDate as Date,CASE WHEN pvi.Debit<>0 THEN 1 ELSE 0 END IsDebit,' + @Columns
              + '
		FROM   acc.PreVoucherItem pvi
		 INNER JOIN #IDs
					ON  #Ids.PreVoucherID = pvi.PreVoucherID
			   LEFT JOIN (
						SELECT pvial.PreVoucherItemID,
							   pvial.AccountLevelID,
							   CASE 
									WHEN DLID IS NOT NULL THEN Cast( DLID as varchar(10))
									WHEN DLID IS NULL THEN VALUE
							   END VALUE
						FROM Acc.PreVoucherItemAccountLevel pvial
					) x
					PIVOT(
						MAX(VALUE)
						FOR AccountLevelID IN (' + @Columns
              + ')
					) p
					ON pvi.PreVoucherItemID=p.PreVoucherItemID
		)T 	';

        EXEC (@SourceQuery);

        IF @DefaultDesc IS NULL
            SET @DefaultDesc = '';

        IF @IssueType = 0
            SET @SourceQuery
                = '
				SELECT T.SlID,MAX(Description) as Description,T.IsDebit,T.CurrencyID,T.CurrencyRate,MAX(Description2) AS Description2,MIN(RowIndex) AS RowIndex,';
        ELSE
            SET @SourceQuery
                = '
				SELECT T.SlID,''' + @DefaultDesc + ''' as Description,T.IsDebit,T.CurrencyID,T.CurrencyRate,'''
                  + @DefaultDesc + ''' AS Description2,MIN(RowIndex) AS RowIndex,';

        IF @Columns <> ''
            SET @SourceQuery = @SourceQuery + @Columns + ',';

        IF @IssueType = 2
            SET @SourceQuery = @SourceQuery + 'T.Date,';

        SET @SourceQuery
            = @SourceQuery
              + '
		SUM(CASE WHEN IsDebit=0 THEN 0 ELSE  T.Debit END ) AS Debit,
		SUM(CASE WHEN IsDebit=0 THEN T.Credit ELSE  0 END ) AS Credit,
		SUM(CASE WHEN IsDebit=0 THEN 0 ELSE  T.CurrencyDebit END ) AS CurrencyDebit,
		SUM(CASE WHEN IsDebit=0 THEN T.CurrencyCredit ELSE  0 END ) AS CurrencyCredit,
		ROW_NUMBER() OVER (ORDER BY  Max(T.PreVoucherItemID)) AS VoucherItemID
		INTO ##mergeItem
		 FROM  ##P T
		GROUP BY T.SlID,T.CurrencyID,T.CurrencyRate,IsDebit
		
		 ';
        IF @IssueType = 2
            SET @SourceQuery = @SourceQuery + ',T.Date';
        IF @Columns <> ''
            SET @SourceQuery = @SourceQuery + ',' + @Columns;

        EXEC (@SourceQuery);

        SELECT @RelationJoin
            = STUFF(
        (
            SELECT DISTINCT
                ' AND IsNull(T.' + QUOTENAME(al.AccountLevelID) + ',-1)=isNull(M.' + QUOTENAME(al.AccountLevelID)
                + ',-1)'
            FROM ACC.AccountLevel al
            FOR XML PATH(''), TYPE
        ).value('.', 'NVARCHAR(MAX)'),
        1   ,
        1   ,
        ''
                   );

        SET @RelationQuery
            = 'INSERT INTO ##VoucherPreVoucher 
							select M.VoucherItemID,T.PreVoucherItemID'
              + ' 
							from ##P T INNER JOIN ##mergeItem M
					ON   T.SlID=M.SlID AND T.CurrencyID=M.CurrencyID AND 
					T.CurrencyRate=M.CurrencyRate AND T.IsDebit=M.IsDebit 
					  ' + @RelationJoin;

        IF @IssueType = 2
            SET @RelationQuery = @RelationQuery + ' AND T.Date=M.Date';

        EXEC (@RelationQuery);
    END;

    SET IDENTITY_INSERT ACC.VoucherItem ON;

    IF @IssueType = 0
        INSERT INTO ACC.VoucherItem
        (
            VoucherItemID,
            VoucherID,
            VoucherItemIndex,
            SlID,
            [Description],
            Description2,
            Debit,
            Credit,
            CurrencyID,
            CurrencyRate,
            CurrencyDebit,
            CurrencyCredit,
            Creator,
            CreationDate,
            LastEditor,
            LastEditionDate,
            Version
        )
        SELECT pvi.VoucherItemID + @maxVoucherItemID,
               #Voucher.VoucherID,
               ROW_NUMBER() OVER (PARTITION BY #Voucher.VoucherID ORDER BY RowIndex),
               pvi.SlID,
               pvi.[Description],
               pvi.Description2,
               pvi.Debit,
               pvi.Credit,
               pvi.CurrencyID,
               pvi.CurrencyRate,
               pvi.CurrencyDebit,
               pvi.CurrencyCredit,
               @CreatorId,
               GETDATE(),
               @CreatorId,
               GETDATE(),
               1
        FROM ##mergeItem pvi
            INNER JOIN #IDs
                ON pvi.PreVoucherID = #IDs.PreVoucherID
            INNER JOIN #Voucher
                ON #Voucher.PreVoucherID = pvi.PreVoucherID;

    IF @IssueType = 1
        INSERT INTO ACC.VoucherItem
        (
            VoucherItemID,
            VoucherID,
            VoucherItemIndex,
            SlID,
            [Description],
            Description2,
            Debit,
            Credit,
            CurrencyID,
            CurrencyRate,
            CurrencyDebit,
            CurrencyCredit,
            Creator,
            CreationDate,
            LastEditor,
            LastEditionDate,
            Version
        )
        SELECT pvi.VoucherItemID + @maxVoucherItemID,
               @maxVoucherID + 1,
               ROW_NUMBER() OVER (ORDER BY pvi.RowIndex),
               pvi.SlID,
               CASE
                   WHEN @IsTjmi = 2 THEN
                       @DefaultDesc
                   ELSE
                       pvi.[Description]
               END,
               CASE
                   WHEN @IsTjmi = 2 THEN
                       @DefaultDesc
                   ELSE
                       pvi.[Description2]
               END,
               pvi.Debit,
               pvi.Credit,
               pvi.CurrencyID,
               pvi.CurrencyRate,
               pvi.CurrencyDebit,
               pvi.CurrencyCredit,
               @CreatorId,
               GETDATE(),
               @CreatorId,
               GETDATE(),
               1
        FROM ##mergeItem pvi;

    IF @IssueType = 2
        INSERT INTO ACC.VoucherItem
        (
            VoucherItemID,
            VoucherID,
            VoucherItemIndex,
            SlID,
            [Description],
            Description2,
            Debit,
            Credit,
            CurrencyID,
            CurrencyRate,
            CurrencyDebit,
            CurrencyCredit,
            Creator,
            CreationDate,
            LastEditor,
            LastEditionDate,
            Version
        )
        SELECT pvi.VoucherItemID + @maxVoucherItemID,
               #Voucher.VoucherID,
               ROW_NUMBER() OVER (ORDER BY pvi.RowIndex),
               pvi.SlID,
               CASE
                   WHEN @IsTjmi = 2 THEN
                       CASE
                           WHEN @Description IS NOT NULL THEN
                               @Description
                           ELSE
                               @DefaultDesc
                       END
                   ELSE
                       pvi.[Description]
               END,
               CASE
                   WHEN @IsTjmi = 2 THEN
                       CASE
                           WHEN @Description2 IS NOT NULL THEN
                               @Description2
                           ELSE
                               @DefaultDesc
                       END
                   ELSE
                       pvi.[Description2]
               END,
               pvi.Debit,
               pvi.Credit,
               pvi.CurrencyID,
               pvi.CurrencyRate,
               pvi.CurrencyDebit,
               pvi.CurrencyCredit,
               @CreatorId,
               GETDATE(),
               @CreatorId,
               GETDATE(),
               1
        FROM ##mergeItem pvi
            INNER JOIN #Voucher
                ON #Voucher.Date = pvi.DATE;

    IF @IsTjmi = 0
    BEGIN
        SET @SourceQuery
            = ' INSERT INTO ACC.AccountLevelVoucherItem(VoucherItemID, AccountLevelID,
		            DlID, [Value], Creator, CreationDate, LastEditor,
		            LastEditionDate, Version)
		SELECT ##mergeItem.VoucherItemID+' + CAST(@maxVoucherItemID AS VARCHAR(20))
              + ',pvial.AccountLevelID, pvial.DlID,
		       pvial.[Value],' + CAST(@CreatorId AS VARCHAR(10)) + ',GETDATE(),' + CAST(@CreatorId AS VARCHAR(10))
              + ',GETDATE(),1
		  FROM ##mergeItem
		INNER JOIN ACC.PreVoucherItemAccountLevel pvial
		ON ##mergeItem.PreVoucherItemID=pvial.PreVoucherItemID';

        EXEC (@SourceQuery);
    END;
    ELSE
    BEGIN
        SET @SourceQuery
            = '
	
		INSERT INTO Acc.AccountLevelVoucherItem
(VoucherItemID, AccountLevelID, DlID, [Value], Creator, CreationDate,
LastEditor, LastEditionDate, Version)

		SELECT VoucherItemID+' + CAST(@maxVoucherItemID AS VARCHAR(20))
              + ',T.AccountLevelID,case when al.AccountLevelTypeID=1 then  T.DlID else null end,
		case when al.AccountLevelTypeID<>1 then  T.DlID else null end,' + CAST(@CreatorId AS VARCHAR(10))
              + ',GETDATE(),' + CAST(@CreatorId AS VARCHAR(10))
              + ',GETDATE(),1

		FROM   (
           SELECT *
           FROM   (
                      SELECT ' + @Columns
              + ',VoucherItemID
                      FROM   ##mergeItem
	    
                  )P UNPIVOT(DlID FOR AccountLevelID IN (' + @Columns
              + ')) AS unpvt
       ) T
      Inner join ACc.AccountLevel al
      on al.AccountLevelID=T.AccountLevelID
	
	'   ;

        EXEC (@SourceQuery);
    END;

    UPDATE ##VoucherPreVoucher
    SET VoucherItemID = VoucherItemID + @maxVoucherItemID;

    INSERT INTO ACC.VoucherPrevoucher
    (
        VoucherID,
        VoucherItemID,
        PrevoucherID,
        PrevoucherItemID,
        Version,
        Creator,
        CreationDate,
        LastEditor,
        LastEditionDate
    )
    SELECT vi.VoucherID,
           V.VoucherItemID,
           pvi.PreVoucherID,
           V.PreVoucherItemID,
           1,
           @CreatorId,
           GETDATE(),
           @CreatorId,
           GETDATE()
    FROM ##VoucherPreVoucher V
        INNER JOIN ACC.VoucherItem vi
            ON vi.VoucherItemID = V.VoucherItemID
        INNER JOIN ACC.PreVoucherItem pvi
            ON pvi.PreVoucherItemID = V.PreVoucherItemID;

    UPDATE #IDs
    SET VoucherID = ACC.VoucherPrevoucher.VoucherID
    FROM #IDs
        INNER JOIN ACC.VoucherPrevoucher
            ON #IDs.PreVoucherID = ACC.VoucherPrevoucher.PrevoucherID;

    UPDATE ACC.Voucher
    SET Total =
        (
            SELECT SUM(Debit)
            FROM ACC.VoucherItem vi
            WHERE vi.VoucherID = ACC.Voucher.VoucherID
        )
    FROM ACC.Voucher
        INNER JOIN #Voucher
            ON #Voucher.VoucherID = ACC.Voucher.VoucherID;

    DECLARE @voucherIds NVARCHAR(Max);
    SELECT @voucherIds = STUFF(
                         (
                             SELECT ',' + CAST(v.VoucherID AS NVARCHAR(50))
                             FROM #Voucher AS v
                             FOR XML PATH('')
                         ),
                         1,
                         1,
                         ''
                              );

    EXEC ACC.ValidateVouchers @voucherIDs = @voucherIds,                      -- nvarchar(max)
                              @currentFinancialPeriodID = @FinancialPeriodID, -- int
                              @isDelete = 0,                                  -- bit
                              @voucherItemIds = DEFAULT;                      -- nvarchar(max)

	SELECT DocumentId,
           NULL AS ErrorMessage,
	       PreVoucherID,
	       CFG.GetCLRSaturnDate(v.Date,'YYYY/MM/DD', 0,0)  AS VoucherDate,
	       #IDs.VoucherID,
           NULL AS Number,
           NULL AS DocumentType,
	       v.ReferenceNumber
	FROM   #IDs
	INNER JOIN ACC.Voucher v
	    ON  v.VoucherID = #IDs.VoucherID

	END TRY
	BEGIN CATCH
		if exists (select 1 from #IssuePrevoucherResult where ErrorMessage is not null)
        BEGIN
		    SELECT *, 
                null as ReferenceNumber,
                null as VoucherDate ,
                null as VoucherId 
            FROM #IssuePrevoucherResult 
            WHERE ErrorMessage is not null
        END
		ELSE      
		BEGIN
		    DECLARE @ErrorSeverity INT,
				    @ErrorMessage2 NVARCHAR(MAX),
				    @ErrorState INT;

		    SET @ErrorSeverity = ERROR_SEVERITY();
		    SET @ErrorMessage2 = ERROR_MESSAGE();
		    SET @ErrorState = ERROR_STATE();
		    RAISERROR(   @ErrorMessage2, -- Message text.
					     @ErrorSeverity, -- Severity,
					     @ErrorState,    -- State,
					     NULL,           -- First argument.
					     NULL
				     ); -- Second argument. 
		END
END CATCH;
