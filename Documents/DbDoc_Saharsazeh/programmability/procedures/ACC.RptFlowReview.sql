
CREATE   PROCEDURE [ACC].RptFlowReview
(
    @FinicialPeriodID INT,
    @DocumentTypeIds VARCHAR(500) = NULL,
    @FromNumber INT = NULL,
    @ToNumber INT = NULL,
    @FromSubNumber INT = NULL,
    @ToSubNumber INT = NULL,
    @FromDate DATE = NULL,
    @ToDate DATE = NULL,
    @SelectedSlTreeLevel VARCHAR(MAX) = NULL,
    @SelectedDL VARCHAR(MAX) = NULL,
    @SelectedBranch VARCHAR(MAX) = NULL,
    @FromReferenceNumber INT = NULL,
    @ToReferenceNumber INT = NULL,
    @ApplyOldRemain BIT = 1,
    @PageNumber INT,
    @RowspPage INT,
    @Sort NVARCHAR(MAX) = NULL,
    @Filter NVARCHAR(MAX) = NULL,
    @TotalItems NVARCHAR(MAX) = NULL,
    @IsCurrency BIT = 0,
    @ShowLevels BIT = 0,
    @SelecedDlType VARCHAR(MAX) = NULL,
    @ShowType TINYINT,
    @showAnalyze BIT = 0,
    @voucherStatusIds VARCHAR(500) = NULL
)

--WITH ENCRYPTION
WITH RECOMPILE
AS

--Set Static Variables
BEGIN
    DECLARE @StariFP INT,
            @StariFPDate DATETIME,
            @UserID INT,
            @DateType TINYINT,
            @DateFormat VARCHAR(10),
            @Culture VARCHAR(10),
            @ConstCurrency BIGINT = 100000000,
            @CultureNo TINYINT,
            @SlAccountLevel VARCHAR(10),
            @GlAccountLevel VARCHAR(10),
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

    SELECT @CultureNo = CultureNo
    FROM CFG.CultureInfo
    WHERE Culture = @Culture;

    SELECT @DateType = cfg.GetCurrentUserDateType();


    SELECT @DateFormat = cfg.GetCurrentUserDateFormat();

    SET @StariFP = CFG.GetFinanacialPeriodId(@FromDate);

    SELECT @StariFPDate = fp.StartDate
    FROM CFG.FinancialPeriod fp
    WHERE fp.FinancialPeriodID = @StariFP;

    SELECT TOP (1)
           @SlAccountLevel = SlTreeLevelID
    FROM ACC.SlTreeLevel
    ORDER BY LevelOrder DESC;

    SELECT TOP (1)
           @GlAccountLevel = SlTreeLevelID
    FROM ACC.SlTreeLevel
    WHERE LevelType = 2
    ORDER BY LevelOrder DESC;
END;

--Set Dynamic Variables
BEGIN

    DECLARE @SelectQuery NVARCHAR(MAX),
            @JoinQuery NVARCHAR(MAX),
            @Query NVARCHAR(MAX);

    SELECT @SelectQuery
        = STUFF(
    (
        SELECT CASE
                   WHEN AccountLevelTypeID = 1 THEN
                       ',d' + CAST(AccountLevelID AS VARCHAR(10)) + '.Code AS ALDL'
                       + CAST(AccountLevelID AS VARCHAR(10)) + '_CODE,d' + CAST(AccountLevelID AS VARCHAR(10))
                       + '.Title AS ALDL' + CAST(AccountLevelID AS VARCHAR(10)) + '_TITLE'
                   WHEN AccountLevelTypeID = 2
                        OR AccountLevelTypeID = 3 THEN
                       ',' + 'cast(' + QUOTENAME(AccountLevelID)
                       + ' as decimal(30,4)) * case when Credit>0 then -1.0000 Else 1.0000 END  as AL'
                       + CAST(AccountLevelID AS VARCHAR(10))
                   ELSE
                       ',' + QUOTENAME(AccountLevelID) + ' as AL' + CAST(AccountLevelID AS VARCHAR(10))
               END
        FROM ACC.AccountLevel
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'),
    1   ,
    0   ,
    ''
               );

    IF (@SelectQuery IS NULL)
        SET @SelectQuery = N'';

    SELECT @JoinQuery
        = STUFF(
    (
        SELECT DISTINCT
               ' Left Join acc.dl d' + CAST(AccountLevelID AS VARCHAR(10)) + ' on d'
               + CAST(AccountLevelID AS VARCHAR(10)) + '.DlID = vial.' + QUOTENAME(AccountLevelID)
        FROM ACC.AccountLevel
        WHERE AccountLevelTypeID = 1
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'),
    1   ,
    1   ,
    ''
               );

    DECLARE @Columns VARCHAR(MAX);
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
       OR @Columns = ''
        SET @Columns = '[-1]';



    IF @TotalItems IS NOT NULL
    BEGIN
        SET @TotalItems = 'Cross Join(select ' + @TotalItems + ' from #Result) as tSum';
    END;
    ELSE
        SET @TotalItems = '';

END;

--Create Main Temp Tables
BEGIN
    DECLARE @TempTable VARCHAR(MAX);
    SET @TempTable = CFG.getTempTableName(1);

    IF @IsCurrency = 0
        EXEC (N'
		CREATE TABLE ' + @TempTable + '
		(
			number INT NULL,
			VoucherID INT NULL,
			[Date] DATE NOT NULL,
			Date_Voucher VARCHAR(10)  NULL,
			ReferenceNumber INT NULL,
			SubNumber NVARCHAR(256),
			GlVoucherNumber int null,
			DailyNumber INT NULL,
			DESCRIPTION NVARCHAR(MAX),
			DocumentTypeTitle NVARCHAR(256),
			VoucherStatusTitle NVARCHAR(256),
			Debit DECIMAL(30, 4) NOT NULL,
			Credit DECIMAL(30, 4) NOT NULL,
			SlID int,
			GlID int,
			VoucherItemID INT NULL,
			VoucherItemIndex INT NULL,
			CreatorTitle NVARCHAR(1024)
		)'   );
    IF @IsCurrency = 1
        EXEC (N'
		CREATE TABLE ' + @TempTable + '
		(
			number INT NULL,
			VoucherID INT NULL,
			[Date] DATE NOT NULL,
			Date_Voucher VARCHAR(10)  NULL,
			ReferenceNumber INT NULL,
			SubNumber NVARCHAR(256),
			GlVoucherNumber int null,
			DailyNumber INT NULL,
			DESCRIPTION NVARCHAR(MAX),
			DocumentTypeTitle NVARCHAR(256),
			VoucherStatusTitle NVARCHAR(256),
			Debit DECIMAL(30, 4) NOT NULL,
			Credit DECIMAL(30, 4) NOT NULL,
			CurrencyDebit DECIMAL(30, 4) NOT NULL,
			CurrencyCredit DECIMAL(30, 4) NOT NULL,
			SlID int,
			GlID int,
			VoucherItemID INT NULL,
			CurrencyID INT NULL,
			CurrencyRate DECIMAL(30, 4),
			VoucherItemIndex INT NULL,
			CreatorTitle NVARCHAR(1024),
			CurrencyTitle NVARCHAR(1024)
		)'   );


    CREATE TABLE #Sl
    (
        SlID INT NOT NULL,
        FullCode VARCHAR(256) NULL,
        Title NVARCHAR(1024) NULL
    );

    INSERT INTO #Sl
    (
        SlID,
        FullCode,
        Title
    )
    SELECT SlID,
           ACC.SlFullCode(SlID),
           CASE
               WHEN @CultureNo = 1 THEN
                   Title
               ELSE
                   Title2
           END
    FROM ACC.SL;
END;

--Insert Data Of Duration Of Period
BEGIN
    DECLARE @ResTable VARCHAR(MAX);
    SET @ResTable = CFG.getTempTableName(1);
    PRINT SYSDATETIME();
    EXEC [ACC].SpReportDataSource @FinicialPeriodID,
                                  @DocumentTypeIds,
                                  @FromNumber,
                                  @ToNumber,
                                  @FromSubNumber,
                                  @ToSubNumber,
                                  @FromDate,
                                  @ToDate,
                                  @SelectedBranch,
                                  @FromReferenceNumber,
                                  @ToReferenceNumber,
                                  @ShowType,
                                  @voucherStatusIds,
                                  @SelectedSlTreeLevel,
                                  @SelecedDlType,
                                  @SelectedDL,
                                  @ResTable,
                                  @IsCurrency
								  WITH RECOMPILE;
    PRINT SYSDATETIME();

    IF @IsCurrency = 0
        SET @Query
            = N'
		INSERT INTO ' + @TempTable
              + N'
		SELECT v.Number,
			   v.VoucherID,
			   v.[Date],
			   case when @DateType = 0 then PersianFullDateAlternateKey else FullDateAlternateKey end,
			   v.ReferenceNumber,
			   v.SubNumber,
			g.Number as GlVoucherNumber,
			   v.DailyNumber,
			   CASE WHEN @CultureNo = 1 THEN vi2.[Description] ELSE vi2.[Description2] END,
			   case when @CultureNo = 1 then dt.Title else dt.Title2 end,
			    CASE v.VoucherStatusID 
					WHEN 1 THEN @Record
					WHEN 2 THEN @Note
					WHEN 3 THEN @Survey
					WHEN 4 THEN @Confirm
			   END AS VoucherStatusTitle,
			   vi.Debit,
			   vi.Credit,
			   vi.[' + @SlAccountLevel + N'] SlID,
			   vi.[' + @GlAccountLevel
              + N'] GlID,
			   vi.VoucherItemID,
			   vi2.VoucherItemIndex,
			   CASE when @CultureNo = 1 then u.Name ELSE u.Name2 end CreatorTitle
		FROM ' + @ResTable
              + N' vi
		INNER JOIN ACC.VoucherItem vi2
			ON vi.VoucherItemID = vi2.VoucherItemID
		INNER JOIN ACC.Voucher  v
			on vi2.VoucherID = v.VoucherID		
		left join acc.GIVoucherItem AS gi on v.VoucherID = gi.VoucherID
		left join acc.GIVoucher AS g on g.GlVoucherID = gi.GIVoucherID		
		INNER JOIN ACC.DocumentType dt
			ON dt.DocumentTypeID = v.DocumentTypeID
		INNER JOIN CFG.[User] u
			ON u.UserID = v.Creator
		LEFT JOIN CFG.DimDate dd
			ON dd.Date = v.Date';

    IF @IsCurrency = 1
        SET @Query
            = N'
		INSERT INTO ' + @TempTable
              + N'
		SELECT v.Number,
			   v.VoucherID,
			   v.[Date],
			   case when @DateType = 0 then PersianFullDateAlternateKey else FullDateAlternateKey end,
			   v.ReferenceNumber,
			   v.SubNumber,
			   g.Number GlVoucherNumber,
			   v.DailyNumber,
			   CASE WHEN @CultureNo = 1 THEN vi2.[Description] ELSE vi2.[Description2] END,
			   case when @CultureNo = 1 then dt.Title else dt.Title2 end,
				CASE v.VoucherStatusID 
					WHEN 1 THEN @Record
					WHEN 2 THEN @Note
					WHEN 3 THEN @Survey
					WHEN 4 THEN @Confirm
			   END AS VoucherStatusTitle,
			   vi.Debit,
			   vi.Credit,
			   vi.CurrencyDebit,
			   vi.CurrencyCredit,
			   vi.[' + @SlAccountLevel + N'] SlID,
			   vi.[' + @GlAccountLevel
              + N'] GlID,
			   vi.VoucherItemID,
			   vi.CurrencyID,
			   vi2.CurrencyRate,
			   vi2.VoucherItemIndex,
			   CASE when @CultureNo = 1 then u.Name ELSE u.Name2 end CreatorTitle,
			   CASE WHEN @CultureNo = 1 THEN c.Title ELSE c.Title2 END
		FROM ' + @ResTable
              + N' vi
		INNER JOIN ACC.VoucherItem vi2
			ON vi.VoucherItemID = vi2.VoucherItemID
		INNER JOIN CFG.Currency AS c
			ON c.CurrencyID = vi.CurrencyID
		INNER JOIN ACC.Voucher  v
			on vi2.VoucherID = v.VoucherID
		left join acc.GIVoucherItem AS gi on v.VoucherID = gi.VoucherID
		left join acc.GIVoucher AS g on g.GlVoucherID = gi.GIVoucherID	
		INNER JOIN ACC.DocumentType dt
			ON dt.DocumentTypeID = v.DocumentTypeID
		INNER JOIN CFG.[User] u
			ON u.UserID = v.Creator
		LEFT JOIN CFG.DimDate dd
			ON dd.Date = v.Date';

    EXECUTE sys.sp_executesql @Query,
                              N'	@CultureNo	int,
				@DateType	TINYINT,
				@Record NVARCHAR(100),
				@Note NVARCHAR(100),
				@Survey NVARCHAR(100),
				@Confirm NVARCHAR(100)',
                              @CultureNo = @CultureNo,
                              @DateType = @DateType,
                              @Record = @Record,
                              @Note = @Note,
                              @Survey = @Survey,
                              @Confirm = @Confirm;
    PRINT SYSDATETIME();
END;

--Insert Data Of First Of Period
BEGIN
    DECLARE @FirstDebit DECIMAL(30, 4) = 0,
            @FirstCredit DECIMAL(30, 4) = 0,
            @FirstDebitCurrency DECIMAL(30, 4) = 0,
            @FirstCreditCurrency DECIMAL(30, 4) = 0;

    IF @FromDate <> @StariFPDate
       AND @ApplyOldRemain = 1
    BEGIN

        DECLARE @ResTable1 VARCHAR(MAX),
                @ADayBeforFromDate DATE;
        SET @ResTable1 = CFG.getTempTableName(1);
        SET @ADayBeforFromDate = DATEADD(DAY, -1, @FromDate);
        EXEC [ACC].SpReportDataSource @StariFP,
                                      @DocumentTypeIds,
                                      @FromNumber,
                                      @ToNumber,
                                      @FromSubNumber,
                                      @ToSubNumber,
                                      @StariFPDate,
                                      @ADayBeforFromDate,
                                      @SelectedBranch,
                                      @FromReferenceNumber,
                                      @ToReferenceNumber,
                                      @ShowType,
                                      @voucherStatusIds,
                                      @SelectedSlTreeLevel,
                                      @SelecedDlType,
                                      @SelectedDL,
                                      @ResTable1,
                                      @IsCurrency
								      WITH RECOMPILE;

        SET @Query
            = N'
			SELECT @FirstDebit = ISNULL(SUM(Debit), 0),
				   @FirstCredit = ISNULL(SUM(Credit), 0),
				   @FirstDebitCurrency = ISNULL(SUM(CurrencyDebit), 0),
				   @FirstCreditCurrency = ISNULL(SUM(CurrencyCredit), 0)
			FROM ' + @ResTable1;
        EXECUTE sys.sp_executesql @Query,
                                  N'@FirstDebit DECIMAL(30, 4) out,
					  @FirstCredit DECIMAL(30, 4) out,
					  @FirstDebitCurrency DECIMAL(30, 4) out,
					  @FirstCreditCurrency DECIMAL(30, 4) out',
                                  @FirstDebit = @FirstDebit OUTPUT,
                                  @FirstCredit = @FirstCredit OUTPUT,
                                  @FirstDebitCurrency = @FirstDebitCurrency OUTPUT,
                                  @FirstCreditCurrency = @FirstCreditCurrency OUTPUT;



        DECLARE @Message NVARCHAR(MAX),
                @PersianFromDate VARCHAR(50);

        SELECT @Message = lsv.Value
        FROM CFG.LocalizationSQLMessage ls
            JOIN CFG.LocalizationSQLMessageValue lsv
                ON lsv.LocalizationSQLMessageID = ls.LocalizationSQLMessageID
        WHERE ls.SQLMessageCode = 'FirstInventory'
              AND lsv.Culture = @Culture;

        SELECT @PersianFromDate = CASE
                                      WHEN @DateType = 0 THEN
                                          PersianFullDateAlternateKey
                                      ELSE
                                          FullDateAlternateKey
                                  END
        FROM CFG.DimDate
        WHERE Date = @FromDate;

        IF @IsCurrency = 1
            SET @Query
                = N'
			INSERT INTO ' + @TempTable
                  + N'
			SELECT NULL,
				   NULL,
				   @FromDate,
				   @PersianFromDate,
				   NULL,
				   NULL,
				   NULL,
				   Null,
				   @Message,
				   '''',
				   '''',
				   case when (@FirstDebit - @FirstCredit) > 0 then @FirstDebit - @FirstCredit else 0 end,
				   case when (@FirstDebit - @FirstCredit) < 0 then -1*(@FirstDebit - @FirstCredit) else 0 end,
				   case when @FirstDebitCurrency - @FirstCreditCurrency > 0 then @FirstDebitCurrency - @FirstCreditCurrency else 0 end,
				   case when @FirstDebitCurrency - @FirstCreditCurrency < 0 then -1*(@FirstDebitCurrency - @FirstCreditCurrency) else 0 end,
				   NULL,
				   NULL,
				   NULL,
				   -1,
				   NULL,
				   NULL,
				   NULL,
				   NULL;';
        IF @IsCurrency = 0
            SET @Query
                = N'
			INSERT INTO ' + @TempTable
                  + N'
			SELECT NULL,
				   NULL,
				   @FromDate,
				   @PersianFromDate,
				   NULL,
				   NULL,
				   NULL,
				   Null,
				   @Message,
				   null,
				   null,
				   case when (@FirstDebit - @FirstCredit) > 0 then @FirstDebit - @FirstCredit else 0 end,
				   case when (@FirstDebit - @FirstCredit) < 0 then -1*(@FirstDebit - @FirstCredit) else 0 end,
				   NULL,
				   NULL,
				   NULL,
				   NULL,
				   NULL;';
        EXECUTE sys.sp_executesql @Query,
                                  N'@FirstDebit DECIMAL(30, 4),
					  @FirstCredit DECIMAL(30, 4),
					  @FirstDebitCurrency DECIMAL(30, 4),
					  @FirstCreditCurrency DECIMAL(30, 4),
					  @Message NVARCHAR(MAX),
					  @FromDate Date,
					  @PersianFromDate varchar(50)',
                                  @FirstDebit = @FirstDebit,
                                  @FirstCredit = @FirstCredit,
                                  @FirstDebitCurrency = @FirstDebitCurrency,
                                  @FirstCreditCurrency = @FirstCreditCurrency,
                                  @Message = @Message,
                                  @FromDate = @FromDate,
                                  @PersianFromDate = @PersianFromDate;
    END;
END;
PRINT SYSDATETIME();

IF @ShowLevels = 1
BEGIN
    DECLARE @TempTable1 VARCHAR(MAX);
    SET @TempTable1 = CFG.getTempTableName(1);
    EXEC (N'
			SELECT  alvi.VoucherItemID,
					alvi.AccountLevelID,
					case when DLID	is not null then CAST(DLID as varchar(1024)) else Value end [Value]
				into ' + @TempTable1 + '
			FROM   Acc.AccountLevelVoucherItem alvi			
			join ' + @TempTable + ' T on T.VoucherItemID = alvi.VoucherItemID
	'    );
END;
IF @showAnalyze = 0
BEGIN
    IF @ShowLevels = 1
       AND @IsCurrency = 1
        SET @Query
            = N'select  ROW_NUMBER() OVER (ORDER BY Date, DailyNumber, VoucherItemIndex) Rno,
						#T.number ,
						#T.VoucherID ,
						#T.[Date]  ,
						#T.Date_Voucher ,
						#T.ReferenceNumber ,
						#T.SubNumber ,
						#T.DailyNumber ,
						#T.GlVoucherNumber,						
						#T.DESCRIPTION ,
						#T.DocumentTypeTitle ,
						#T.VoucherStatusTitle ,
						#T.Debit  ,
						#T.Credit  ,
						#T.CurrencyDebit  ,
						#T.CurrencyCredit  ,
						SUM(Debit - Credit) OVER (ORDER BY Date, DailyNumber, VoucherItemIndex) Remain  ,
						SUM(CurrencyDebit - CurrencyCredit) OVER (ORDER BY Date, DailyNumber, VoucherItemIndex) CurrencyRemain  ,
						Sl.FullCode,
						Gl.FullCode KolFullCode,
						Gl.Title KolTitle,
						SL.Title,
						#T.VoucherItemID ,
						#T.CurrencyID ,
						#T.CurrencyRate ,
						#T.VoucherItemIndex ,
						#T.CreatorTitle ,
						#T.CurrencyTitle ' + @SelectQuery + N'  FROM ' + @TempTable
              + N' #T
						INNER JOIN #SL SL
							ON #T.SlID = Sl.SLID
						INNER JOIN #SL GL
							ON #T.GlID = Gl.SLID
						LEFT JOIN 				
						(
							SELECT  * FROM   ' + @TempTable1
              + N' 			
						) x
						PIVOT
						(
							MAX([Value])
							FOR AccountLevelID IN (' + @Columns
              + N')
						) vial		
						ON #T.VoucherItemID=vial.VoucherItemID ' + ISNULL(@JoinQuery, '');
    IF @ShowLevels = 1
       AND @IsCurrency = 0
        SET @Query
            = N'select  ROW_NUMBER() OVER (ORDER BY Date, DailyNumber, VoucherItemIndex) Rno,
						#T.number ,
						#T.VoucherID ,
						#T.[Date]  ,
						#T.Date_Voucher ,
						#T.ReferenceNumber ,
						#T.GlVoucherNumber,
						#T.SubNumber ,
						#T.DailyNumber ,
						#T.DESCRIPTION ,
						#T.DocumentTypeTitle ,
						#T.VoucherStatusTitle ,
						#T.Debit  ,
						#T.Credit  ,
						SUM(Debit - Credit) OVER (ORDER BY Date, DailyNumber, VoucherItemIndex) Remain  ,
						Sl.FullCode,
						Gl.FullCode KolFullCode,
						Gl.Title KolTitle,
						SL.Title,
						#T.VoucherItemID ,
						#T.VoucherItemIndex ,
						#T.CreatorTitle  ' + @SelectQuery + N'  FROM ' + @TempTable
              + N' #T
						INNER JOIN #SL SL
							ON #T.SlID = Sl.SLID
						INNER JOIN #SL GL
							ON #T.GlID = Gl.SLID
						LEFT JOIN 				
						(
							SELECT  * FROM   ' + @TempTable1
              + N'		
						) x
						PIVOT
						(
							MAX([Value])
							FOR AccountLevelID IN (' + @Columns
              + N')
						) vial		
						ON #T.VoucherItemID=vial.VoucherItemID ' + ISNULL(@JoinQuery, '');
    IF @ShowLevels = 0
       AND @IsCurrency = 1
        SET @Query
            = N'
				select  ROW_NUMBER() OVER (ORDER BY Date, DailyNumber, VoucherItemIndex) Rno,
						#T.number ,
						#T.VoucherID ,
						#T.[Date]  ,
						#T.Date_Voucher ,
						#T.ReferenceNumber ,
						#T.SubNumber ,
						#T.DailyNumber ,
						#T.GlVoucherNumber,						
						#T.DESCRIPTION ,
						#T.DocumentTypeTitle ,
						#T.VoucherStatusTitle ,
						#T.Debit  ,
						#T.Credit  ,
						#T.CurrencyDebit  ,
						#T.CurrencyCredit  ,
						SUM(Debit - Credit) OVER (ORDER BY Date, DailyNumber, VoucherItemIndex) Remain  ,
						SUM(CurrencyDebit - CurrencyCredit) OVER (ORDER BY Date, DailyNumber, VoucherItemIndex) CurrencyRemain  ,
						#T.VoucherItemID,
						#T.CurrencyID ,
						#T.CurrencyRate ,
						#T.VoucherItemIndex ,
						#T.CreatorTitle,
						#T.CurrencyTitle
					FROM ' + @TempTable + N' #T';
    IF @ShowLevels = 0
       AND @IsCurrency = 0
        SET @Query
            = N'
				select  ROW_NUMBER() OVER (ORDER BY Date, DailyNumber, VoucherItemIndex) Rno,
						#T.number ,
						#T.VoucherID ,
						#T.[Date]  ,
						#T.Date_Voucher ,
						#T.ReferenceNumber ,
						#T.SubNumber ,
						#T.GlVoucherNumber,
						#T.DailyNumber ,
						#T.DESCRIPTION ,
						#T.DocumentTypeTitle ,
						#T.VoucherStatusTitle ,
						#T.Debit  ,
						#T.Credit  ,
						SUM(Debit - Credit) OVER (ORDER BY Date, DailyNumber, VoucherItemIndex) Remain  ,
						#T.VoucherItemID,
						#T.VoucherItemIndex ,
						#T.CreatorTitle
					FROM ' + @TempTable + N' #T';
END;
ELSE
BEGIN
    SET @Query
        = N'select  ROW_NUMBER() OVER (ORDER BY Date, DailyNumber, VoucherItemIndex) Rno,
						#T.number ,
						#T.VoucherID ,
						#T.[Date]  ,
						#T.Date_Voucher ,
						#T.ReferenceNumber ,
						#T.SubNumber ,
						#T.GlVoucherNumber,
						#T.DailyNumber ,
						#T.DESCRIPTION ,
						#T.DocumentTypeTitle ,
						#T.VoucherStatusTitle ,
						#T.Debit  ,
						#T.Credit  ,
						SUM(Debit - Credit) OVER (ORDER BY Date, DailyNumber, VoucherItemIndex) Remain  ,
						#T.VoucherItemID ,
						#T.VoucherItemIndex ,
						#T.CreatorTitle ,
						r.Remain AS AnalyzeRemain  
				FROM ' + @TempTable
          + N' #T
				join ACC.vwVoucherAnalyzeRemain as r on  r.VoucherItemID = #t.VoucherItemID
				';
END;

IF @Sort IS NULL
    SET @Sort = '[Date]';

SET @Sort = REPLACE(@Sort, 'Date_Voucher', '[Date]');

SET @Query
    = N'
		Select *,ROW_NUMBER() over (order by ' + @Sort + N') as RowOrder
		into #result
		from (' + @Query + N'
				) TOut
			' + CASE
                    WHEN @Filter IS NULL THEN
                        ''
                    ELSE
                        ' WHERE ' + @Filter
                END
      + N'
		select * from 
		#Result 
		Cross Join(select count(*) as Row_Count from #Result) as tCount
		' + @TotalItems + N' '
      + CASE
            WHEN @RowspPage = 0 THEN
                ''
            ELSE
                '	WHERE RowOrder BETWEEN (' + CAST(((@PageNumber - 1) * @RowspPage + 1) AS VARCHAR(20)) + ') AND ('
                + CAST((@PageNumber * @RowspPage) AS VARCHAR(20)) + ')'
        END + N'
			order by #Result.RowOrder;
			';
PRINT @Query;
EXECUTE sys.sp_executesql @Query,
                          N'@DateFormat VARCHAR(10),
			  @DateType TINYINT',
                          @DateFormat = @DateFormat,
                          @DateType = @DateType;

PRINT SYSDATETIME();

