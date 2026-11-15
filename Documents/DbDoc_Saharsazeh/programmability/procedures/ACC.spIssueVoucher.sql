CREATE   PROCEDURE [ACC].spIssueVoucher
(
    @documentType          VARCHAR(50),
    @documentIds           NVARCHAR(MAX) = NULL,
    --0 : يک سند براي يک رديف
    --1 : يک سند براي تمامي رديف ها
    --2 : يک سند  براي يک روز
    @IssueType             TINYINT,
    --0 به تفکيک صادر شود
    --1  تجميعي در سطح بيش نویس
    --2  تجميعي در سطح تمامي پيش نویس ها
    @IsTjmi                TINYINT = 1,
    @Creator               NVARCHAR(500),
    @Number                INT,
    @Subnumber             NVARCHAR(256),
    @Date                  DATE,
    @FinancialPeriodID     INT,
    @Description           NVARCHAR(MAX) = NULL,
    @Description2          NVARCHAR(MAX) = NULL,
	@DocumentTypeID		   int
)

--With Encryption
AS
	SET NOCOUNT ON

	/*if @IssueType = 0  then @IsTjmi can not be 2*/
	if @IssueType = 0 and @IsTjmi = 2
	set @IsTjmi = 1

	create table #IssuePrevoucherResult
	(
		DocumentId int,
		ErrorMessage varchar(max),
		PreVoucherID int,
		DocDate Date,
		Number varchar(256),
		DocumentType varchar(max)
	)

	create table #IDs
	(
	DocumentId int,
	PrevoucherID int,
	VoucherID int,
	RowNumber int,
	DocDate Date,
	Number varchar(256)
	)

	INSERT INTO  #IDs (DocumentId,PrevoucherID,RowNumber)
	SELECT CASE 
		        WHEN @documentType = 'PreVoucher' THEN 0
		        ELSE VALUE
		    END DocumentId,
		    CASE 
		        WHEN @documentType = 'PreVoucher' THEN VALUE
		        ELSE -1
		    END PreVoucherID,
		    ROW_NUMBER() OVER(ORDER BY VALUE) AS RowNumber
	FROM   CFG.R_FnCommaStr2Table(@documentIds);

		-------------Convert PreVoucher To Voucher
		IF @IssueType = 1
		   OR @IssueType = 2
		BEGIN
			DECLARE @BranchIdCount INT;
	    
			SELECT @BranchIdCount = COUNT(1)
			FROM   ACC.PreVoucher pv
			INNER JOIN #IDs
				ON  pv.PreVoucherID = #IDs.PreVoucherID
			group by  pv.BranchID
			IF @BranchIdCount <> 1
			BEGIN
				RAISERROR ('Accounting.DifferentBranchDocuments', 16, 13);
			END;
	    

		END;

		
	DECLARE @CreatorId        INT,
	        @docTypeId        INT,
	        @PreVoucherId     INT,
	        @ErrorMessage     NVARCHAR(MAX),
	        @FinStartDate     DATE,
	        @FinEndDate       DATE,
			@Culture          VARCHAR(10),
			@Message NVARCHAR(MAX);

	SELECT @CreatorId = UserID
	FROM   CFG.[User]
	WHERE  Username = @Creator;

	SET @Culture = CFG.GetuserCulture()	

	-- Date settings are needed by both the TRY and the CATCH block, so they are resolved before the TRY
	DECLARE @DateType                  tinyint ,
			@DateFormat                VARCHAR(10)

	SELECT @DateType = us.SettingValue
	FROM   cfg.UserSetting us
	WHERE  us.SettingKey = 'Date_Type'
		   AND us.UserID = @CreatorId

	IF @DateType IS NULL
		SET @DateType = CASE @Culture
							 WHEN 'fa' THEN 0
							 WHEN 'en' THEN 1
							 WHEN 'ar' THEN 2
							 ELSE 0
						END

	SELECT @DateFormat = us.SettingValue
	FROM   cfg.UserSetting us
	WHERE  us.SettingKey = 'Date_Format'
		   AND us.UserID = @CreatorId

	IF @DateFormat IS NULL
		SET @DateFormat = 'YY/MM/DD'

	
	DECLARE @StartNum     INT = NULL,
	        @EndNum       INT = NULL,
			@DocumentNumID int
	
	SELECT @StartNum = StartNum,
	       @EndNum                   = EndNum,
			@DocumentNumID = DocumentNumID
	FROM   CFG.DocumentNum
	WHERE  DocumentNumTypeID         = 1
	       AND FinancialPeriodID     = @FinancialPeriodID;


	
	IF @Subnumber = 0
	    SET @Subnumber = NULL;
	
	IF @Description = ''
	    SET @Description = NULL;
	
	IF @Description2 = ''
	    SET @Description2 = NULL;
	
	SELECT @FinStartDate = fp.StartDate,
	       @FinEndDate = fp.EndDate
	FROM   CFG.FinancialPeriod fp
	WHERE  fp.FinancialPeriodID = @FinancialPeriodID;
	
		DECLARE @ISOne BIT;
		
		SET @ISOne = 0;
		

		IF (
		       SELECT COUNT(*)
		       FROM   #IDs
		   ) = 1
		    SET @ISOne = 1;
		

		
	BEGIN TRY

		
		IF @documentType <> 'PreVoucher'
		BEGIN
		        EXEC [ACC].spIssuePreVoucher 
					 @documentType,	
		             @documentIds,	
					 1;


			
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
						ON  i.DocumentId = #IDs.DocumentId;
		END;

		IF @documentType = 'PreVoucher'
		BEGIN
		    UPDATE #IDs
		    SET    DocDate     = i.Date,
		           Number      = 'پيش نويس جاري'
		    FROM   #IDs
		           INNER JOIN ACC.PreVoucher i
		                ON  i.PreVoucherID = #IDs.PreVoucherID;
		END; 			


		------------------------Validate PreVouchers
		DECLARE @BranchID INT;
		SELECT TOP 1
	           @BranchID = pv.BranchID
	    FROM   ACC.PreVoucher pv
	    INNER JOIN #IDs
	        ON  pv.PreVoucherID = #IDs.PreVoucherID;

		DECLARE @CompanyID int
		select @CompanyID = CompanyID
		from cfg.Branch
		where BranchID = @BranchID


		IF (@IssueType = 1 OR @ISOne = 1)
		   AND CAST(@Date AS DATE) < (SELECT MAX(DocDate)FROM   #IDs)
		BEGIN
			RAISERROR ( 'VoucherDateLittleThanSelectedDocumentDate', 16, 13);
		END;
	
		DECLARE @Items NVARCHAR(MAX);
	
		--Check Sanad
		SELECT @Items = STUFF(
				   (
					   SELECT DISTINCT TOP 10
							  ' ،'
							  + CAST(#IDs.Number AS NVARCHAR(250))
					   FROM   ACC.VoucherPrevoucher vp
							  INNER JOIN #IDs
								   ON  vp.PrevoucherID = #IDs.PreVoucherID
									   FOR XML PATH(''),
							  TYPE
				   ).value('.', 'NVARCHAR(MAX)'),
				   1,
				   2,
				   ''
			   );
		IF @Items IS NOT NULL
		BEGIN
    
			SET @Message = 'ACC_spVoucherInsert_11^' + CHAR(13) + CHAR(10) + @Items; 
			RAISERROR (@Message, 16, 13);
		END;
	


	--Check balance
	SELECT @Items = STUFF(
	           (
	               SELECT DISTINCT TOP 10
	                      ' ،'
	                      + CAST(#IDs.Number AS NVARCHAR(250))
	               FROM   ACC.PreVoucherItem pvi
	                      INNER JOIN #IDs
	                           ON  pvi.PreVoucherID = #IDs.PreVoucherID
	               GROUP BY
	                      #IDs.PreVoucherID,
	                      #IDs.Number
	               HAVING (SUM(pvi.Debit) - SUM(Credit) <> 0)
	                      FOR XML PATH(''),
	                      TYPE
	           ).value('.', 'NVARCHAR(MAX)'),
	           1,
	           2,
	           ''
	       );
	
	IF @Items IS NOT NULL
	BEGIN
    
	    SET @Message =  'ACC_spIssueVoucher_3^' + CHAR(13) + CHAR(10) + @Items; 
	    RAISERROR (@Message, 16, 13);
	END; 
	
	SELECT @Items = STUFF(
	           (
	               SELECT DISTINCT ' ،' + CAST(#IDs.Number AS NVARCHAR(250))
	               FROM   #IDs
				   left join ACC.PreVoucherItem pvi on  pvi.PreVoucherID = #IDs.PreVoucherID
	               WHERE  pvi.PreVoucherItemID is null
	                      FOR XML PATH('') ,
	                      TYPE
	           ).value('.', 'NVARCHAR(MAX)'),1,2,'');
	
	IF @Items IS NOT NULL
	BEGIN
	    SET @Message =  'ACC_spIssueVoucher_4^' + CHAR(13) + CHAR(10) + @Items; 
	    RAISERROR (@Message, 16, 13);
	END; 
	
	SELECT @Items = STUFF(
	           (
	               SELECT DISTINCT ' ،'+ CAST(#IDs.Number AS NVARCHAR(250))
	               FROM   ACC.PreVoucherItem pvi
	                INNER JOIN #IDs
	                    ON  pvi.PreVoucherID = #IDs.PreVoucherID
	               WHERE  pvi.[Description] IS NULL
	                   or LTRIM(RTRIM(pvi.[Description])) = ''
					 --  or pvi.[Description2] IS NULL
					   --or LTRIM(RTRIM(pvi.[Description2])) = ''
	                          FOR XML PATH('') ,TYPE).value('.', 'NVARCHAR(MAX)'),1,2,'');
	
	IF @Items IS NOT NULL
	BEGIN
    
	    SET @Message =  'ACC_spIssueVoucher_5^' + CHAR(13) + CHAR(10) + @Items; 
	    RAISERROR (@Message, 16, 13);
	END; 
	
	SELECT @Items = STUFF(
	           (
	               SELECT DISTINCT ' ،'+ CAST(#IDs.Number AS NVARCHAR(250))
	               FROM   ACC.PreVoucherItem pvi
	                INNER JOIN #IDs
	                    ON  pvi.PreVoucherID = #IDs.PreVoucherID
	               WHERE  pvi.Debit = 0
	                      AND pvi.Credit = 0
	                          FOR XML PATH('') ,TYPE).value('.', 'NVARCHAR(MAX)'),1,2,'');
	
	IF @Items IS NOT NULL
	BEGIN
	    SET @Message = 'ACC_spIssueVoucher_6^' + CHAR(13) + CHAR(10) + @Items; 
	    RAISERROR (@Message, 16, 13);
	END; 
	
	IF @IssueType = 1
	   OR @ISOne = 1
	BEGIN
	    IF NOT @Date BETWEEN @FinStartDate AND @FinEndDate
	    BEGIN
	        
	        RAISERROR ( 'InRangDateValidation', 16, 13);
	    END;
	END;
	
	--Check AccountLevels
	DECLARE @Columns         VARCHAR(MAX),
	        @OrColumns       VARCHAR(MAX),
	        @SourceQuery     NVARCHAR(MAX);
	
	SELECT @Columns = STUFF(
	           (
	               SELECT DISTINCT
	                      ',' + QUOTENAME(al.AccountLevelID)
	               FROM   ACC.AccountLevel al
	               WHERE  al.IsMandatory = 1
	                      FOR XML PATH('') ,
	                      TYPE
	           ).value('.', 'NVARCHAR(MAX)'),
	           1,
	           1,
	           ''
	       );
	
	SELECT @OrColumns = STUFF(
	           (
	               SELECT DISTINCT
	                      'or ' + QUOTENAME(al.AccountLevelID) + ' Is Null '
	               FROM   ACC.AccountLevel al
	               WHERE  al.IsMandatory = 1
	                      FOR XML PATH('') ,
	                      TYPE
	           ).value('.', 'NVARCHAR(MAX)'),
	           1,
	           2,
	           ''
	       );
	
			insert into #IssuePrevoucherResult (DocumentId ,ErrorMessage,PreVoucherID)
	        SELECT  #IDs.DocumentId,
					'ACC_spIssueVoucher_8' ErrorMessage,
					#IDs.PreVoucherID
	        FROM ACC.PreVoucherItem pvi
	        INNER JOIN #IDs ON #IDs.PreVoucherID = pvi.PreVoucherID
	        INNER JOIN ACC.AccountLevelSL als ON als.SlID = pvi.SlID
	        INNER JOIN ACC.AccountLevel al ON al.AccountLevelID = als.AccountLevelID
	        AND al.IsMandatory = 1
	            LEFT JOIN ACC.PreVoucherItemAccountLevel pvial ON pvial.PreVoucherItemID = 
	            pvi.PreVoucherItemID
	        AND pvial.AccountLevelID = als.AccountLevelID
			where pvial.PreVoucherItemAccountLevelID is null
			group by #IDs.DocumentId,#IDs.PreVoucherID

			if exists (select * from #IssuePrevoucherResult where ErrorMessage is not null )
				BEGIN
					RAISERROR('ERROE',16,13);		 
				END;


	DECLARE @ReferenceNumber     INT,
	        @DailyNumber         INT,
	        @maxVoucherID        INT;	
	
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
	            SELECT MAX(DailyNumber)
	            FROM   [ACC].[Voucher]
	            WHERE  [Date] = @Date
	        ),
	        0
	    );
	
	IF @Number = 0
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

	IF (
	       @Number < @StartNum
	       OR (@EndNum IS NOT NULL AND @Number > @EndNum)
	   )
	BEGIN
	  
	    RAISERROR ('InvalidNumberRange', 16, 13);
	END;	
	IF (
	       @ISOne = 1
	       AND (
	               SELECT COUNT(*)
	               FROM   ACC.Voucher v
				   join cfg.Branch b on v.BranchID = b.BranchID
	               WHERE  v.Number = @Number
	                AND v.FinancialPeriodID = @FinancialPeriodID
					AND b.CompanyID = @CompanyID
	           ) <> 0
	   )
	BEGIN
	    RAISERROR ( 'NumberIsDuplicate' , 16, 13);
	END;
	
	--------------------------------------------
	
	SET @maxVoucherID = ISNULL(
	        (
	            SELECT MAX(VoucherID)
	            FROM   ACC.Voucher
	        ),
	        1
	    );
	
	CREATE TABLE #Voucher
	(
		[VoucherID]             [INT] NOT NULL,
		[BranchID]              [INT] NOT NULL,
		[FinancialPeriodID]     [INT] NOT NULL,
		[DocumentTypeID]        [SMALLINT] NOT NULL,
		[Number]                [INT] NOT NULL,
		[ReferenceNumber]       [INT] NOT NULL,
		[DailyNumber]           [INT] NOT NULL,
		[SubNumber]             [NVARCHAR](256) NULL,
		[Date]                  [DATE] NOT NULL,
		[VoucherStatusID]       [SMALLINT] NOT NULL,
		[Description]           [NVARCHAR](MAX) NULL,
		[Description2]          [VARCHAR](MAX) NULL,
		[Creator]               [INT] NOT NULL,
		[CreationDate]          [DATETIME] NOT NULL,
		[LastEditor]            [INT] NOT NULL,
		[LastEditionDate]       [DATETIME] NOT NULL,
		[Version]               [INT] NOT NULL,
		PreVoucherID            INT
	);
	
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
	        DATE,
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
	                WHEN @IssueType = 1 OR @ISOne = 1 THEN @Number
	                ELSE @Number + RowNumber - 1
	           END,
	           @ReferenceNumber + RowNumber,
	           CASE 
	                WHEN @IssueType = 1
	                     OR @ISOne = 1 THEN @DailyNumber + RowNumber
	                ELSE ISNULL(DailyNumberDate.DailyNumber, 0)
	                     + ROW_NUMBER() OVER(PARTITION BY DocDate ORDER BY DocDate)
	           END,
	           CASE 
	                WHEN @IssueType = 1
	                     OR @ISOne = 1 THEN @Subnumber
	                ELSE NULL
	           END,
	           CASE 
	                WHEN @IssueType = 1
	                     OR @ISOne = 1 THEN @Date
	                ELSE #IDs.DocDate
	           END,
	           1,
	           isnull(@Description,pv.[Description]),
	           isnull(@Description2,pv.[Description2]),
	           @CreatorId,
	           GETDATE(),
	           @CreatorId,
	           GETDATE(),
	           1,
	           #IDs.PreVoucherID
	    FROM   ACC.PreVoucher pv
	           INNER JOIN #IDs
	                ON  pv.PreVoucherID = #IDs.PreVoucherID
	           LEFT JOIN (
	                    SELECT v.Date,
	                           MAX(v.DailyNumber) AS DailyNumber
	                    FROM   ACC.Voucher v
	                    GROUP BY
	                           v.Date
						) DailyNumberDate
	                ON  DailyNumberDate.Date = #IDs.DocDate
	    WHERE  (@IssueType = 0 OR (@IssueType = 1 AND RowNumber = 1));
	
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
	        DATE,
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
	    SELECT @maxVoucherID
	           + ROW_NUMBER() OVER(ORDER BY DocDate),
	           @BranchID,
	           @FinancialPeriodID,
	           @DocumentTypeID,
	           CASE 
	                WHEN @ISOne = 1 THEN @Number
	                ELSE @Number
	                     + ROW_NUMBER() OVER(ORDER BY DocDate)
	                     - 1
	           END,
	           @ReferenceNumber + ROW_NUMBER() OVER(ORDER BY DocDate),
	           ISNULL(MAX(DailyNumberDate.DailyNumber), 0)
	           + ROW_NUMBER() OVER(PARTITION BY DocDate ORDER BY DocDate),
	           NULL,
	           DocDate,
	           1,
	           isnull(@Description,DocDate),
	           isnull(@Description2,DocDate),
	           @CreatorId,
	           GETDATE(),
	           @CreatorId,
	           GETDATE(),
	           1,
	           0
	    FROM   ACC.PreVoucher pv
	           INNER JOIN #IDs
	                ON  pv.PreVoucherID = #IDs.PreVoucherID
	           LEFT JOIN (
	                    SELECT v.Date,
	                           MAX(v.DailyNumber) AS DailyNumber
	                    FROM   ACC.Voucher v
	                    GROUP BY
	                           v.Date
	                ) DailyNumberDate
	                ON  DailyNumberDate.Date = #IDs.DocDate
	    GROUP BY
	           #IDs.DocDate;
	

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
	    DATE,
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
	       DATE,
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
	FROM   #Voucher;
	SET IDENTITY_INSERT ACC.Voucher OFF;
	
	---Tajmi Item Ha
	DECLARE @maxVoucherItemID BIGINT;
	
	SET @maxVoucherItemID = ISNULL(
	        (
	            SELECT MAX(VoucherItemID)
	            FROM   ACC.VoucherItem vi
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
		VoucherItemID        DECIMAL(18, 0),
		PreVoucherItemID     DECIMAL(18, 0)
	);
	
	IF @IsTjmi = 1
	BEGIN
	    DECLARE @RelationJoin NVARCHAR(MAX);
	    
	    SELECT @Columns = STUFF(
	               (
	                   SELECT DISTINCT
	                          ',' + QUOTENAME(al.AccountLevelID)
	                   FROM   ACC.AccountLevel al
	                          FOR XML PATH(''),
	                          TYPE
	               ).value('.', 'NVARCHAR(MAX)'),
	               1,
	               1,
	               ''
	           );
	    
	    SELECT @RelationJoin = STUFF(
	               (
	                   SELECT DISTINCT
	                          ' AND IsNull(T.' + QUOTENAME(al.AccountLevelID)
	                          + ',-1)=isNull(M.' + QUOTENAME(al.AccountLevelID)
	                          + ',-1)'
	                   FROM   ACC.AccountLevel al
	                          FOR XML PATH(''),
	                          TYPE
	               ).value('.', 'NVARCHAR(MAX)'),
	               1,
	               1,
	               ''
	           );
	    
	    IF @Columns IS NULL
	        SET @Columns = '[10000]';
	    
	    
	    SET @SourceQuery = 
	        'select * into ##P from (	
			SELECT pvi.*,pv.Description HeaderDescription,pv.Description2 HeaderDescription2,
			#IDs.DocDate as Date,CASE WHEN pvi.Debit<>0 THEN 1 ELSE 0 END IsDebit,'+ @Columns+ '
			FROM   acc.PreVoucherItem pvi
			join acc.PreVoucher pv on pv.PreVoucherid = pvi.PreVoucherid
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
	                FOR AccountLevelID IN (' + @Columns + 
	        ')
	            ) p
	            ON pvi.PreVoucherItemID=p.PreVoucherItemID
	
	)T';		
	    
	    EXEC (@SourceQuery);
	    
	    
	    SET @SourceQuery = 
	        '
			SELECT T.PreVoucherID,T.Date,T.SlID,MAX(HeaderDescription) as Description,T.IsDebit,T.CurrencyID,T.CurrencyRate,MAX(HeaderDescription2) AS Description2,MIN(RowIndex) AS RowIndex,';
	    
	    IF @Columns <> ''
	        SET @SourceQuery = @SourceQuery + @Columns + ',';
	    
	    SET @SourceQuery = @SourceQuery
	        + 
	        '
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
	    
	    
	    
	    SET @RelationQuery = 'INSERT INTO ##VoucherPreVoucher 
							  SELECT M.VoucherItemID,T.PreVoucherItemID
							  FROM ##P T 
							  INNER JOIN ##mergeItem M
									ON  T.PreVoucherID=M.PreVoucherID AND T.SlID=M.SlID AND T.CurrencyID=M.CurrencyID AND T.CurrencyRate=M.CurrencyRate AND T.IsDebit=M.IsDebit 
							  ' + @RelationJoin;
	    
	    EXEC (@RelationQuery);
	END;
	
	ELSE
	IF @IsTjmi = 0
	BEGIN
	    SELECT pvi.PreVoucherID,
	           SlID,
	           [Description],
	           CurrencyID,
	           CurrencyRate,
	           Description2  AS Description2,
	           RowIndex      AS RowIndex,
	           Debit,
	           Credit,
	           CurrencyDebit,
	           CurrencyCredit,
	           ROW_NUMBER() OVER(ORDER BY pvi.PreVoucherItemID) AS VoucherItemID,
	           pvi.PreVoucherItemID,
	           #IDs.DocDate  AS DATE
	    INTO   ##mergeItem
	    FROM   ACC.PreVoucherItem pvi
	           INNER JOIN #IDs
	                ON  #IDs.PreVoucherID = pvi.PreVoucherID;	
	    
	    INSERT INTO ##VoucherPreVoucher
	    SELECT VoucherItemID,
	           PreVoucherItemID
	    FROM   ##mergeItem;
	END;
	ELSE
	BEGIN
	
		SELECT @Columns = STUFF(
		           (
		               SELECT DISTINCT
		                      ',' + QUOTENAME(al.AccountLevelID)
		               FROM   ACC.AccountLevel al
		                      FOR XML PATH(''),
		                      TYPE
		           ).value('.', 'NVARCHAR(MAX)'),
		           1,
		           1,
		           ''
		       );
		
		
		IF @Columns IS NULL
		    SET @Columns = '[10000]';
		
		SET @SourceQuery = 
		    ' select T.* into ##P 
			  from (		
				SELECT pvi.*,#IDs.DocDate as Date,CASE WHEN pvi.Debit<>0 THEN 1 ELSE 0 END IsDebit,'+ @Columns+ '
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
						FOR AccountLevelID IN (' + @Columns + 
						')
						) p
					ON pvi.PreVoucherItemID=p.PreVoucherItemID		
				    )T 	';
		
		EXEC (@SourceQuery);
		
		
		
		
		IF @IssueType = 0
		    SET @SourceQuery = 
		        '
				SELECT T.SlID,MAX(Description) as Description,T.IsDebit,T.CurrencyID,T.CurrencyRate,MAX(Description2) AS Description2,MIN(RowIndex) AS RowIndex,';
		ELSE
		SET @SourceQuery = '
				SELECT T.SlID, @Description  as Description,T.IsDebit,T.CurrencyID,T.CurrencyRate,@Description2 AS Description2,MIN(RowIndex) AS RowIndex,';
		
		IF @Columns <> ''
		    SET @SourceQuery = @SourceQuery + @Columns + ',';
		
		IF @IssueType = 2
		    SET @SourceQuery = @SourceQuery + 'T.Date,'; 
		
		SET @SourceQuery = @SourceQuery
		    + 
		    '
		SUM(CASE WHEN IsDebit=0 THEN 0 ELSE  T.Debit END ) AS Debit,
		SUM(CASE WHEN IsDebit=0 THEN T.Credit ELSE  0 END ) AS Credit,
		SUM(CASE WHEN IsDebit=0 THEN 0 ELSE  T.CurrencyDebit END ) AS CurrencyDebit,
		SUM(CASE WHEN IsDebit=0 THEN T.CurrencyCredit ELSE  0 END ) AS CurrencyCredit,
		ROW_NUMBER() OVER (ORDER BY  Max(T.PreVoucherItemID)) AS VoucherItemID
		INTO ##mergeItem
		 FROM 
		(
			select * from ##P
		)T
		GROUP BY T.SlID,T.CurrencyID,T.CurrencyRate,IsDebit
		
		 ';
		IF @IssueType = 2
		    SET @SourceQuery = @SourceQuery + ',T.Date'; 
		IF @Columns <> ''
		    SET @SourceQuery = @SourceQuery + ',' + @Columns;
		

		EXECUTE sp_executeSQL     
				@SourceQuery,
				N'@Description nvarchar(max),
				@Description2 nvarchar(max)',
				@Description = @Description,
				@Description2 = @Description2
		

		SELECT @RelationJoin = STUFF(
		           (
		               SELECT DISTINCT
		                      ' AND IsNull(T.' + QUOTENAME(al.AccountLevelID)
		                      + ',-1)=isNull(M.' + QUOTENAME(al.AccountLevelID)
		                      + ',-1)'
		               FROM   ACC.AccountLevel al
		                      FOR XML PATH(''),
		                      TYPE
		           ).value('.', 'NVARCHAR(MAX)'),
		           1,
		           1,
		           ''
		       );
		
		
		SET @RelationQuery = 'INSERT INTO ##VoucherPreVoucher 
							  select M.VoucherItemID,T.PreVoucherItemID
							  from ##P T 
							  INNER JOIN ##mergeItem M
									ON   T.SlID=M.SlID AND T.CurrencyID=M.CurrencyID AND T.CurrencyRate=M.CurrencyRate AND T.IsDebit=M.IsDebit 
					          ' + @RelationJoin;
		
		IF @IssueType = 2
		    SET @RelationQuery = @RelationQuery
		        + ' AND T.Date=M.Date'; 
		
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
	           ROW_NUMBER() OVER(PARTITION BY #Voucher.VoucherID ORDER BY RowIndex),
	           pvi.SlID,
	           CASE 
	                WHEN @IsTjmi = 0 THEN pvi.[Description] 
	                WHEN @IsTjmi = 1 THEN #Voucher.Description
					ELSE isnull(@Description,#Voucher.Description)
	           END,
	           CASE 
	                WHEN @IsTjmi = 0 THEN pvi.[Description2]
	                WHEN @IsTjmi = 1 THEN #Voucher.Description2
					ELSE isnull(@Description2,#Voucher.Description2)
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
	    FROM   ##mergeItem pvi
	    INNER JOIN #IDs
	        ON  pvi.PreVoucherID = #IDs.PreVoucherID
	    INNER JOIN #Voucher
	        ON  #Voucher.PreVoucherID = pvi.PreVoucherID;
	
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
	           ROW_NUMBER() OVER(ORDER BY pvi.RowIndex),
	           pvi.SlID,
	           CASE 
	                WHEN @IsTjmi <> 2 THEN pvi.[Description] 
					ELSE isnull(@Description,@date)
	           END,
	           CASE 
	                WHEN @IsTjmi <> 2 THEN pvi.[Description2]
					ELSE isnull(@Description2,@date)
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
	    FROM   ##mergeItem pvi;
	
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
	           ROW_NUMBER() OVER(ORDER BY pvi.RowIndex),
	           pvi.SlID,
	           CASE 
	                WHEN @IsTjmi = 0 THEN pvi.[Description] 
	                WHEN @IsTjmi = 1 THEN #Voucher.Description
					ELSE isnull(@Description,@date)
	           END,
	           CASE 
	                WHEN @IsTjmi = 0 THEN pvi.[Description2]
	                WHEN @IsTjmi = 1 THEN #Voucher.Description2
					ELSE isnull(@Description2,@date)
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
	    FROM   ##mergeItem pvi
	           INNER JOIN #Voucher
	                ON  #Voucher.Date = pvi.Date;
	
	IF @IsTjmi = 0
	BEGIN
	    SET @SourceQuery = 
	        '
		
		INSERT INTO ACC.AccountLevelVoucherItem(VoucherItemID, AccountLevelID,
		            DlID, [Value], Creator, CreationDate, LastEditor,
		            LastEditionDate, Version)
		SELECT ##mergeItem.VoucherItemID+'
	        + CAST(@maxVoucherItemID AS VARCHAR(20))
	        + ',pvial.AccountLevelID, pvial.DlID,
		       pvial.[Value],' + CAST(@CreatorId AS VARCHAR(10))
	        + ',GETDATE(),' + CAST(@CreatorId AS VARCHAR(10))
	        + 
	        ',GETDATE(),1
		  FROM ##mergeItem
		INNER JOIN ACC.PreVoucherItemAccountLevel pvial
		ON ##mergeItem.PreVoucherItemID=pvial.PreVoucherItemID';
	    
	    
	    EXEC (@SourceQuery);
	END;
	ELSE
	BEGIN
		SET @SourceQuery = 
		    '
	
		INSERT INTO Acc.AccountLevelVoucherItem
(VoucherItemID, AccountLevelID, DlID, [Value], Creator, CreationDate,
LastEditor, LastEditionDate, Version)

		SELECT VoucherItemID+' + CAST(@maxVoucherItemID AS VARCHAR(20))
		    + 
		    ',T.AccountLevelID,case when al.AccountLevelTypeID=1 then  T.DlID else null end,
		case when al.AccountLevelTypeID<>1 then  T.DlID else null end,'
		    + CAST(@CreatorId AS VARCHAR(10)) + ',GETDATE(),'
		    + CAST(@CreatorId AS VARCHAR(10)) + 
		    ',GETDATE(),1

		FROM   (
           SELECT *
           FROM   (
                      SELECT ' + @Columns + 
		    ',VoucherItemID
                      FROM   ##mergeItem
	    
                  )P UNPIVOT(DlID FOR AccountLevelID IN (' + @Columns
		    + 
		    ')) AS unpvt
       ) T
      Inner join ACc.AccountLevel al
      on al.AccountLevelID=T.AccountLevelID
	
	';
		
		EXEC (@SourceQuery);
	END;
	
	UPDATE ##VoucherPreVoucher
	SET    VoucherItemID = VoucherItemID + @maxVoucherItemID;


	
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
	FROM   ##VoucherPreVoucher V
	       INNER JOIN ACC.VoucherItem vi
	            ON  vi.VoucherItemID = V.VoucherItemID
	       INNER JOIN ACC.PreVoucherItem pvi
	            ON  pvi.PreVoucherItemID = V.PreVoucherItemID;
	
	UPDATE #IDs
	SET    VoucherID = ACC.VoucherPrevoucher.VoucherID
	FROM   #IDs
	       INNER JOIN ACC.VoucherPrevoucher
	            ON  #IDs.PreVoucherID = ACC.VoucherPrevoucher.PrevoucherID;
	
	
	UPDATE ACC.Voucher
	SET    Total = (
	           SELECT SUM(Debit)
	           FROM   ACC.VoucherItem vi
	           WHERE  vi.VoucherID = ACC.Voucher.VoucherID
	       )
	FROM   ACC.Voucher
	       INNER JOIN #Voucher
	            ON  #Voucher.VoucherID = ACC.Voucher.VoucherID;
	
	DECLARE @voucherIds NVARCHAR(1500)
	SELECT @voucherIds = STUFF(
                            (   SELECT ',' + CAST(v.VoucherID AS NVARCHAR(50))
                                FROM   #Voucher AS v
                                FOR XML PATH('')) ,1 ,1 ,'');

	EXEC ACC.ValidateVouchers @voucherIDs = @voucherIds ,           
	                          @currentFinancialPeriodID = @FinancialPeriodID, 
	                          @isDelete = 0 ,            
	                          @voucherItemIds = DEFAULT       

		


	
	SELECT	DocumentId,
			'' AS ErrorMessage,
			PreVoucherID,
			CFG.GetCLRSaturnDate(v.Date,@DateFormat, 0,@DateType)  AS VoucherDate,
			#IDs.VoucherID,
			null  as Number,
			null  as DocumentType,
			v.ReferenceNumber
	FROM   #IDs
	INNER JOIN ACC.Voucher v
	    ON  v.VoucherID = #IDs.VoucherID

	END TRY
	BEGIN CATCH

		if exists (select * from #IssuePrevoucherResult where ErrorMessage is not null)
		begin
			select	DocumentId ,
					ErrorMessage, 
					PreVoucherID , 
					CFG.GetCLRSaturnDate(DocDate,@DateFormat, 0,@DateType) AS VoucherDate  , 
					null as VoucherID ,
					Number,
					DocumentType,
					null ReferenceNumber
			from #IssuePrevoucherResult where ErrorMessage is not null
		end
		else
		begin
			DECLARE @ErrorSeverity     INT,
					@ErrorMessage2     NVARCHAR(MAX),
					@ErrorState        INT;

			SET @ErrorSeverity = ERROR_SEVERITY();
			SET @ErrorMessage2 = ERROR_MESSAGE();
			SET @ErrorState = ERROR_STATE();
		
			RAISERROR (
				@ErrorMessage2,	
				@ErrorSeverity,
				@ErrorState,	
				NULL,	
				NULL
			); 		
		end
	END CATCH; 
