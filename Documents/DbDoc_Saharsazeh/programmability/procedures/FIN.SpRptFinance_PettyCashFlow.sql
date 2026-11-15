
-------------Start of #7807
CREATE     PROCEDURE FIN.SpRptFinance_PettyCashFlow
(
    @FromDate DATE,
    @ToDate DATE,
    @SelectedPettyCash NVARCHAR(MAX)
)
--WITH ENCRYPTION 
AS
BEGIN

    DECLARE @FirstInventory NVARCHAR(100),
            @Receive NVARCHAR(100),
            @Payment NVARCHAR(100),
            @PettyCashCost NVARCHAR(100),
            @TransferToPettyCash NVARCHAR(100),
            @UserID INT,
            @DateType TINYINT,
            @DateFormat VARCHAR(10),
            @Culture VARCHAR(25),
            @CultureNo TINYINT,
            @Columns NVARCHAR(MAX),
            @ColumnsInSelectList NVARCHAR(MAX),
            @query NVARCHAR(MAX),
            @param NVARCHAR(MAX),
            @CodeAndTitleColumn NVARCHAR(MAX),
            @LeftJoin NVARCHAR(MAX),
            @ColumnsInCreateTable NVARCHAR(MAX),
            @CodeAndTitleColumnInCreateTable NVARCHAR(MAX);

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
                            ELSE
                                2
                        END;

    SELECT @DateFormat = us.SettingValue
    FROM CFG.UserSetting us
    WHERE us.SettingKey = 'Date_Format'
          AND us.UserID = @UserID;

    IF @DateFormat IS NULL
        SET @DateFormat = 'YY/MM/DD';

    SELECT @FirstInventory = lsv.Value
    FROM CFG.LocalizationSQLMessage ls
        JOIN CFG.LocalizationSQLMessageValue lsv
            ON lsv.LocalizationSQLMessageID = ls.LocalizationSQLMessageID
    WHERE ls.SQLMessageCode = 'FirstInventory'
          AND lsv.Culture = @Culture;

    SELECT @Receive = lev.Value
    FROM CFG.LocalizeEnum le
        JOIN CFG.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'ReceivePromissoryCommitmentState'
          AND le.Item = 'Receive'
          AND lev.Culture = @Culture;

    SELECT @Payment = N'''' + lev.Value + N''''
    FROM CFG.LocalizeEnum le
        JOIN CFG.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'PaymentCheqeCommitmentState'
          AND le.Item = 'Payment'
          AND lev.Culture = @Culture;

    SELECT @PettyCashCost = N'''' + lev.Value + N''''
    FROM CFG.LocalizeEnum le
        JOIN CFG.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'DocumentNumTypes'
          AND le.Item = 'PettyCashCost'
          AND lev.Culture = @Culture;

    SELECT @TransferToPettyCash = lev.Value
    FROM CFG.LocalizeEnum le
        JOIN CFG.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'Others'
          AND le.Item = 'TransferToPettyCash'
          AND lev.Culture = @Culture;

    SELECT @Columns = STUFF(
    (
        SELECT DISTINCT
               ',' + QUOTENAME(AccountLevelID)
        FROM ACC.AccountLevel
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'),
    1   ,
    1   ,
    ''
                           );

    IF (@Columns IS NULL)
        SET @Columns = N'[-1]';

    SELECT @ColumnsInSelectList = STUFF(
    (
        SELECT DISTINCT
               ',p.' + QUOTENAME(AccountLevelID)
        FROM ACC.AccountLevel
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'),
    1   ,
    0   ,
    ''
                                       );

    IF (@ColumnsInSelectList IS NULL)
        SET @ColumnsInSelectList = N'[-1]';

    SELECT @CodeAndTitleColumn
        = STUFF(
    (
        SELECT ' ,d' + CAST(AccountLevelID AS VARCHAR(10)) + '.Code [ALDL' + CAST(AccountLevelID AS VARCHAR(10))
               + '_CODE],d' + CAST(AccountLevelID AS VARCHAR(10)) + '.Title [ALDL'
               + CAST(AccountLevelID AS VARCHAR(10)) + '_TITLE]'
        FROM ACC.AccountLevel
        WHERE AccountLevelTypeID = 1
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'),
    1   ,
    1   ,
    ''
               );

    IF (@CodeAndTitleColumn IS NULL)
        SET @CodeAndTitleColumn = N'';


    SELECT @LeftJoin
        = STUFF(
    (
        SELECT ' Left Join acc.dl d' + CAST(AccountLevelID AS VARCHAR(10)) + ' on d'
               + CAST(AccountLevelID AS VARCHAR(10)) + '.DlID = p.' + QUOTENAME(AccountLevelID)
        FROM ACC.AccountLevel
        WHERE AccountLevelTypeID = 1
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'),
    1   ,
    1   ,
    ''
               );
    IF (@LeftJoin IS NULL)
        SET @LeftJoin = N'';

    SELECT @ColumnsInCreateTable = STUFF(
    (
        SELECT DISTINCT
               QUOTENAME(AccountLevelID) + ' NVARCHAR(MAX),'
        FROM ACC.AccountLevel
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'),
    1   ,
    0   ,
    ''
                                        );

    IF (@ColumnsInCreateTable IS NULL)
        SET @ColumnsInCreateTable = N'[-1] int,';

    SELECT @CodeAndTitleColumnInCreateTable
        = STUFF(
    (
        SELECT ',[ALDL' + CAST(AccountLevelID AS VARCHAR(10)) + '_CODE] NVARCHAR(MAX), ' + '[ALDL'
               + CAST(AccountLevelID AS VARCHAR(10)) + '_TITLE] NVARCHAR(MAX)'
        FROM ACC.AccountLevel
        WHERE AccountLevelTypeID = 1
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'),
    1   ,
    0   ,
    ''
               );

    IF (@CodeAndTitleColumnInCreateTable IS NULL)
        SET @CodeAndTitleColumnInCreateTable = N'';


    IF OBJECT_ID('tempdb..#PettyCashReportTemp') IS NOT NULL
        DROP TABLE #PettyCashReportTemp;

    CREATE TABLE #PettyCashReportTemp
    (
        RowID BIGINT NOT NULL,
        Operation NVARCHAR(50) NULL,
        DocName NVARCHAR(50) NULL,
        DocCode INT NULL,
        HederID INT NULL,
        PettyCashTitle NVARCHAR(256) NULL,
        PettyCashTitle2 NVARCHAR(256) NULL,
        [Date] DATE NULL,
        HederNumber INT NULL,
        CurrencyTitle NVARCHAR(256) NULL,
        CurrencyRate DECIMAL(10, 4) NULL,
        Amount DECIMAL(30, 4) NULL,
        BranchCode INT NULL,
        BranchTitle NVARCHAR(250) NULL,
        PartyCode VARCHAR(100) NULL,
        PartyTitle NVARCHAR(250) NULL,
        Description NVARCHAR(MAX) NULL,
        Description2 NVARCHAR(MAX) NULL,
        SlCode NVARCHAR(50) NULL,
        SlName NVARCHAR(256) NULL,
        RemainInLine DECIMAL(30, 4) NULL,
        CONSTRAINT [PK_#PettyCashReportTemp]
            PRIMARY KEY CLUSTERED ([RowID] ASC)
            WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON,
                  ALLOW_PAGE_LOCKS = ON
                 ) ON [PRIMARY]
    ) ON [PRIMARY];


    SET @query = N'alter TABLE #PettyCashReportTemp
		add ' + @ColumnsInCreateTable + STUFF(@CodeAndTitleColumnInCreateTable, 1, 1, '') + N'';
    EXEC (@query);

    INSERT INTO #PettyCashReportTemp
    (
        RowID,
        DocName,
        DocCode,
        HederID,
        Amount,
        RemainInLine
    )
    SELECT 1,
           @FirstInventory DocName,
           0 DocCode,
           0 HederID,
           SUM(vw.Amount),
           SUM(vw.Amount) RemainInLine
    FROM [FIN].[VWPettyCash] vw
    WHERE vw.PettyCashID = @SelectedPettyCash
          AND
          (
              vw.Date IS NULL
              OR vw.Date < @FromDate
          )
    GROUP BY vw.PettyCashID;


    INSERT INTO #PettyCashReportTemp
    (
        RowID,
        Operation,
        DocName,
        DocCode,
        HederID,
        PettyCashTitle,
        PettyCashTitle2,
        [Date],
        HederNumber,
        CurrencyTitle,
        CurrencyRate,
        Amount,
        BranchCode,
        BranchTitle,
        PartyCode,
        PartyTitle,
        Description,
        Description2,
        SlCode,
        SlName,
        RemainInLine
    )
    SELECT ROW_NUMBER() OVER (ORDER BY ps.PaymentSubjectID) + 1000,
           @Receive Operation,
           @TransferToPettyCash DocName,
           1 DocCode,
           pr.PaymentReceiptID HederID,
           ptc.Title PettyCashTitle,
           ptc.Title2 PettyCashTitle2,
           pr.Date,
           pr.Number HederNumber,
           CASE
               WHEN @CultureNo = 2 THEN
                   c.Title2
               ELSE
                   c.Title
           END AS CurrencyTitle,
           ps.CurrencyRate,
           ps.Amount Amount,
           b.Code BranchCode,
           CASE
               WHEN @CultureNo = 2 THEN
                   b.Title2
               ELSE
                   b.Title
           END AS BranchTitle,
           dl.Code PartyCode,
           CASE
               WHEN @CultureNo = 2 THEN
                   dl.Title2
               ELSE
                   dl.Title
           END AS PartyTitle,
           ps.Description,
           ps.Description2,
           s.Code SlCode,
           CASE
               WHEN @CultureNo = 2 THEN
                   s.Title2
               ELSE
                   s.Title
           END AS SlName,
           ps.Amount RemainInLine
    FROM FIN.PaymentSubject ps
        JOIN FIN.PaymentType t
            ON ps.PaymentTypeID = t.PaymentTypeID
        JOIN FIN.PaymentReceipt pr
            ON ps.PaymentReceiptID = pr.PaymentReceiptID
        LEFT JOIN ACC.DL dl
            ON ps.DLID = dl.DLID
        LEFT JOIN
        (
            SELECT pc.PettyCashID,
                   pc.CurrencyID,
                   f.Title2 + ' ' + d.Title2 AS Title2,
                   f.Title + ' ' + d.Title Title
            FROM FIN.PettyCash pc
                LEFT JOIN CFG.Party AS p
                    ON p.PartyID = pc.PartyID
                JOIN ACC.DL AS d
                    ON d.DLID = p.DlID
                LEFT JOIN FIN.Fund AS f
                    ON f.FundId = pc.FundID
        ) AS ptc
            ON ptc.PettyCashID = ps.PettyCashID
        JOIN CFG.Branch b
            ON pr.BranchID = b.BranchID
        JOIN CFG.Currency c
            ON ps.CurrencyID = c.CurrencyID
        LEFT JOIN ACC.SL s
            ON t.SLID = s.SlID
    WHERE t.Type = 6
          AND ps.CurrencyID = ptc.CurrencyID
          AND pr.Date
          BETWEEN @FromDate AND @ToDate
          AND ptc.PettyCashID = @SelectedPettyCash;


		  ----BankingPettyCashCharging

		  
    INSERT INTO #PettyCashReportTemp
    (
        RowID,
        Operation,
        DocName,
        DocCode,
        HederID,
        PettyCashTitle,
        PettyCashTitle2,
        [Date],
        HederNumber,
        CurrencyTitle,
        CurrencyRate,
        Amount,
        BranchCode,
        BranchTitle,
        PartyCode,
        PartyTitle,
        Description,
        Description2,
        SlCode,
        SlName,
        RemainInLine
    )
    SELECT ROW_NUMBER() OVER (ORDER BY ps.PettyCashChargingItemID) + 1000,
           @Receive Operation,
           @TransferToPettyCash DocName,
           1 DocCode,
           pr.PettyCashChargingID HederID,
           ptc.Title PettyCashTitle,
           ptc.Title2 PettyCashTitle2,
           pr.Date,
           pr.Number HederNumber,
           CASE
               WHEN @CultureNo = 2 THEN
                   c.Title2
               ELSE
                   c.Title
           END AS CurrencyTitle,
           0,
           ps.Amount Amount,
           b.Code BranchCode,
           CASE
               WHEN @CultureNo = 2 THEN
                   b.Title2
               ELSE
                   b.Title
           END AS BranchTitle,
           dl.Code PartyCode,
           CASE
               WHEN @CultureNo = 2 THEN
                   dl.Title2
               ELSE
                   dl.Title
           END AS PartyTitle,
           ps.Description,
           ps.Description2,
           s.Code SlCode,
           CASE
               WHEN @CultureNo = 2 THEN
                   s.Title2
               ELSE
                   s.Title
           END AS SlName,
           ps.Amount RemainInLine
    FROM FIN.PettyCashChargingItem ps
	join fin.PettyCash pc on ps.PettyCashID = pc.PettyCashID
	join fin.Fund f on pc.FundID = f.FundID
        JOIN FIN.PettyCashCharging pr
            ON ps.PettyCashChargingID = pr.PettyCashChargingID
        LEFT JOIN ACC.DL dl
            ON f.DLID = dl.DLID
        LEFT JOIN
        (
            SELECT pc.PettyCashID,
                   pc.CurrencyID,
                   f.Title2 + ' ' + d.Title2 AS Title2,
                   f.Title + ' ' + d.Title Title
            FROM FIN.PettyCash pc
                LEFT JOIN CFG.Party AS p
                    ON p.PartyID = pc.PartyID
                JOIN ACC.DL AS d
                    ON d.DLID = p.DlID
                LEFT JOIN FIN.Fund AS f
                    ON f.FundId = pc.FundID
        ) AS ptc
            ON ptc.PettyCashID = ps.PettyCashID
        JOIN CFG.Branch b
            ON pr.BranchID = b.BranchID
        JOIN CFG.Currency c
            ON pc.CurrencyID = c.CurrencyID
        LEFT JOIN ACC.SL s
            ON pc.SLID = s.SlID
    WHERE  pc.CurrencyID = ptc.CurrencyID
          AND pr.Date     BETWEEN @FromDate AND @ToDate
          AND ptc.PettyCashID = @SelectedPettyCash;




    INSERT INTO #PettyCashReportTemp
    (
        RowID,
        Operation,
        DocName,
        DocCode,
        HederID,
        PettyCashTitle,
        PettyCashTitle2,
        [Date],
        HederNumber,
        CurrencyTitle,
        CurrencyRate,
        Amount,
        BranchCode,
        BranchTitle,
        PartyCode,
        PartyTitle,
        Description,
        Description2,
        SlCode,
        SlName,
        RemainInLine
    )
    SELECT ROW_NUMBER() OVER (ORDER BY i.DebitCreditNoteItemID) + 10000,
           @Receive Operation,
           @TransferToPettyCash DocName,
           4 DocCode,
           d.DebitCreditNoteID HederID,
           ptc.Title PettyCashTitle,
           ptc.Title2 PettyCashTitle2,
           d.Date,
           d.Number HederNumber,
           CASE
               WHEN @CultureNo = 2 THEN
                   c.Title2
               ELSE
                   c.Title
           END AS CurrencyTitle,
           i.CurrencyRate,
           i.Amount Amount,
           b.Code BranchCode,
           CASE
               WHEN @CultureNo = 2 THEN
                   b.Title2
               ELSE
                   b.Title
           END AS BranchTitle,
           dl.Code PartyCode,
           CASE
               WHEN @CultureNo = 2 THEN
                   dl.Title2
               ELSE
                   dl.Title
           END AS PartyTitle,
           i.Description,
           i.Description2,
           s.Code SlCode,
           CASE
               WHEN @CultureNo = 2 THEN
                   s.Title2
               ELSE
                   s.Title
           END AS SlName,
           i.Amount RemainInLine
    FROM CFG.DebitCreditNoteItem i
        JOIN FIN.PaymentType t
            ON i.PaymentTypeID = t.PaymentTypeID
        JOIN CFG.DebitCreditNote d
            ON i.DebitCreditNoteID = d.DebitCreditNoteID
        JOIN CFG.Party AS p
            ON p.PartyID = i.PartyID
        JOIN ACC.DL AS dl
            ON dl.DLID = p.DlID
        LEFT JOIN
        (
            SELECT pc.PettyCashID,
                   pc.CurrencyID,
                   f.Title2 + ' ' + d.Title2 AS Title2,
                   f.Title + ' ' + d.Title Title
            FROM FIN.PettyCash pc
                LEFT JOIN CFG.Party AS p
                    ON p.PartyID = pc.PartyID
                JOIN ACC.DL AS d
                    ON d.DLID = p.DlID
                LEFT JOIN FIN.Fund AS f
                    ON f.FundId = pc.FundID
        ) AS ptc
            ON ptc.PettyCashID = i.PettyCashID
        JOIN CFG.Branch b
            ON d.BranchID = b.BranchID
        JOIN CFG.Currency c
            ON i.CurrencyID = c.CurrencyID
        LEFT JOIN ACC.SL s
            ON t.SLID = s.SlID
    WHERE t.Type = 6
          AND i.CurrencyID = ptc.CurrencyID
          AND d.Date
          BETWEEN @FromDate AND @ToDate
          AND ptc.PettyCashID = @SelectedPettyCash;



    INSERT INTO #PettyCashReportTemp
    (
        RowID,
        Operation,
        DocName,
        DocCode,
        HederID,
        PettyCashTitle,
        PettyCashTitle2,
        [Date],
        HederNumber,
        CurrencyTitle,
        CurrencyRate,
        Amount,
        BranchCode,
        BranchTitle,
        PartyCode,
        PartyTitle,
        Description,
        Description2,
        SlCode,
        SlName,
        RemainInLine
    )
    SELECT ROW_NUMBER() OVER (ORDER BY i.PettyCashCostItemID) + 100000,
           @Receive Operation,
           N'تنخواه به تنخواه' DocName,
           2 DocCode,
           i.PettyCashCostID HederID,
           ptc.Title PettyCashTitle,
           ptc.Title2 PettyCashTitle2,
           i.[Date],
           c.Number HederNumber,
           CASE
               WHEN @CultureNo = 2 THEN
                   cu.Title2
               ELSE
                   cu.Title
           END AS CurrencyTitle,
           c.CurrencyRate,
           i.Amount Amount,
           b.Code BranchCode,
           CASE
               WHEN @CultureNo = 2 THEN
                   b.Title2
               ELSE
                   b.Title
           END AS BranchTitle,
           d.Code PartyCode,
           CASE
               WHEN @CultureNo = 2 THEN
                   d.Title2
               ELSE
                   d.Title
           END AS PartyTitle,
           i.Description,
           i.Description2,
           s.Code SlCode,
           CASE
               WHEN @CultureNo = 2 THEN
                   s.Title2
               ELSE
                   s.Title
           END AS SlName,
           i.Amount RemainInLine
    FROM FIN.PettyCashCostItem i
        JOIN FIN.PaymentType t
            ON i.PaymentTypeID = t.PaymentTypeID
        JOIN FIN.PettyCashCost c
            ON i.PettyCashCostID = c.PettyCashCostID
        JOIN FIN.PettyCash p
            ON c.PettyCashID = p.PettyCashID
        LEFT JOIN
        (
            SELECT pc.PettyCashID,
                   pc.CurrencyID,
                   f.Title2 + ' ' + d.Title2 AS Title2,
                   f.Title + ' ' + d.Title Title
            FROM FIN.PettyCash pc
                LEFT JOIN CFG.Party AS p
                    ON p.PartyID = pc.PartyID
                JOIN ACC.DL AS d
                    ON d.DLID = p.DlID
                LEFT JOIN FIN.Fund AS f
                    ON f.FundId = pc.FundID
        ) AS ptc
            ON ptc.PettyCashID = i.PettyCashID
        LEFT JOIN CFG.Party pa
            ON p.PartyID = pa.PartyID
        LEFT JOIN ACC.DL d
            ON pa.DlID = d.DLID
        JOIN CFG.Branch b
            ON c.BranchID = b.BranchID
        JOIN CFG.Currency cu
            ON p.CurrencyID = cu.CurrencyID
        LEFT JOIN ACC.SL s
            ON t.SLID = s.SlID
    WHERE t.Type = 6
          AND c.[Date]
          BETWEEN @FromDate AND @ToDate
          AND ptc.PettyCashID = @SelectedPettyCash;

    INSERT INTO #PettyCashReportTemp
    (
        RowID,
        Operation,
        DocName,
        DocCode,
        HederID,
        PettyCashTitle,
        PettyCashTitle2,
        [Date],
        HederNumber,
        CurrencyTitle,
        CurrencyRate,
        Amount,
        BranchCode,
        BranchTitle,
        PartyCode,
        PartyTitle,
        Description,
        Description2,
        SlCode,
        SlName,
        RemainInLine
    )
    SELECT ROW_NUMBER() OVER (ORDER BY rs.ReceiveSubjectID) + 1000000,
           @Payment Operation,
           'دریافت از تنخواه' DocName,
           3 DocCode,
           rr.ReceiveReceiptID HederID,
           ptc.Title PettyCashTitle,
           ptc.Title2 PettyCashTitle2,
           rr.Date,
           rr.Number HederNumber,
           CASE
               WHEN @CultureNo = 2 THEN
                   c.Title2
               ELSE
                   c.Title
           END AS CurrencyTitle,
           rs.CurrencyRate,
           -rs.Amount Amount,
           b.Code BranchCode,
           CASE
               WHEN @CultureNo = 2 THEN
                   b.Title2
               ELSE
                   b.Title
           END AS BranchTitle,
           dl.Code PartyCode,
           CASE
               WHEN @CultureNo = 2 THEN
                   dl.Title2
               ELSE
                   dl.Title
           END AS PartyTitle,
           rs.Description,
           rs.Description2,
           s.Code SlCode,
           CASE
               WHEN @CultureNo = 2 THEN
                   s.Title2
               ELSE
                   s.Title
           END AS SlName,
           -rs.Amount RemainInLine
    FROM FIN.ReceiveSubject rs
        JOIN FIN.ReceiveReceipt rr
            ON rs.ReceiveReceiptID = rr.ReceiveReceiptID
        JOIN FIN.ReceiptType r
            ON rs.ReceiptTypeID = r.ReceiptTypeID
        LEFT JOIN ACC.DL dl
            ON rs.DLID = dl.DLID
        LEFT JOIN CFG.Party p
            ON dl.DLID = p.DlID
        LEFT JOIN
        (
            SELECT pc.PettyCashID,
                   pc.CurrencyID,
                   f.Title2 + ' ' + d.Title2 AS Title2,
                   f.Title + ' ' + d.Title Title
            FROM FIN.PettyCash pc
                LEFT JOIN CFG.Party AS p
                    ON p.PartyID = pc.PartyID
                JOIN ACC.DL AS d
                    ON d.DLID = p.DlID
                LEFT JOIN FIN.Fund AS f
                    ON f.FundId = pc.FundID
        ) AS ptc
            ON ptc.PettyCashID = rs.PettyCashID
        JOIN CFG.Branch b
            ON rr.BranchID = b.BranchID
        JOIN CFG.Currency c
            ON rs.CurrencyID = c.CurrencyID
        LEFT JOIN ACC.SL s
            ON r.SLID = s.SlID
    WHERE r.[Type] = 5
          AND rs.CurrencyID = ptc.CurrencyID
          AND rr.Date
          BETWEEN @FromDate AND @ToDate
          AND EXISTS
    (
        SELECT 1
        FROM CFG.R_FnCommaStr2Table(@SelectedPettyCash)
        WHERE value = ptc.PettyCashID
    );


    DECLARE @MaxID INT;
    SELECT @MaxID = MAX(RowID)
    FROM #PettyCashReportTemp;

    DECLARE @CodeAndTitleColumns NVARCHAR(MAX);
    SELECT @CodeAndTitleColumns
        = STUFF(
    (
        SELECT ' , [ALDL' + CAST(AccountLevelID AS VARCHAR(10)) + '_CODE], [ALDL' + CAST(AccountLevelID AS VARCHAR(10))
               + '_TITLE]'
        FROM ACC.AccountLevel
        WHERE AccountLevelTypeID = 1
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'),
    1   ,
    1   ,
    ''
               );

    IF (@CodeAndTitleColumns IS NULL)
        SET @CodeAndTitleColumns = N'';

    SET @query
        = N'INSERT INTO #PettyCashReportTemp (RowID,Operation,DocName,DocCode,HederID,PettyCashTitle,PettyCashTitle2,
		[Date],HederNumber,CurrencyTitle,CurrencyRate,Amount,BranchCode,BranchTitle,PartyCode,PartyTitle,
		Description,Description2,SlCode,SlName,RemainInLine,' + @Columns + N'' + @CodeAndTitleColumns
          + N')
		SELECT 
				ROW_NUMBER() OVER (ORDER BY pcci.PettyCashCostItemID) + @pMaxID,
				' + @Payment + N' Operation,
				' + @PettyCashCost
          + N' DocName,2 DocCode,
				pcc.PettyCashCostID HederID,
				f.Title + '' '' + d.Title PettyCashTitle,
				f.Title2 + '' '' + d.Title2 PettyCashTitle2,
				pcci.[Date],pcc.Number HederNumber,				 
				case when ' + CAST(@CultureNo AS CHAR(1)) + N' = 1 then c.Title
	                 when ' + CAST(@CultureNo AS CHAR(1))
          + N' = 2 then c.Title2
	            end as CurrencyTitle, 		
				pc.CurrencyRate,
				-pcci.Amount Amount,
				b.Code BranchCode,
				case when ' + CAST(@CultureNo AS CHAR(1)) + N' = 1 then b.Title
	                 when ' + CAST(@CultureNo AS CHAR(1))
          + N' = 2 then b.Title2
	            end as BranchTitle,
				d.Code PartyCode,
				case when ' + CAST(@CultureNo AS CHAR(1)) + N' = 1 then d.Title
	                 when ' + CAST(@CultureNo AS CHAR(1))
          + N' = 2 then d.Title2
	            end as PartyTitle,
				pcci.Description,pcci.Description2,s.Code SlCode,
				case when ' + CAST(@CultureNo AS CHAR(1)) + N' = 1 then s.Title
	                 when ' + CAST(@CultureNo AS CHAR(1))
          + N' = 2 then s.Title2
	            end as SlName,-pcci.Amount RemainInLine' + @ColumnsInSelectList + N'' + @CodeAndTitleColumn
          + N'		
		FROM FIN.PettyCashCostItem pcci
		JOIN FIN.PettyCashCost pcc on pcci.PettyCashCostID = pcc.PettyCashCostID
		JOIN FIN.PettyCash pc on pcc.PettyCashID = pc.PettyCashID
		JOIN CFG.Party pa on pc.PartyID = pa.PartyID 
		JOIN CFG.Currency c on pc.CurrencyID = c.CurrencyID
		LEFT JOIN ACC.DL d on pa.DlID = d.DLID
		JOIN FIN.Fund f on f.FundID = pc.FundID
		JOIN FIN.PaymentType t on pcci.PaymentTypeID = t.PaymentTypeID
		JOIN CFG.Branch b on pcc.BranchID = b.BranchID 
		LEFT JOIN ACC.SL s ON t.SLID = s.SlID  
		LEFT JOIN 
			(
				select  PettyCashCostItemID,
						pccial.AccountLevelID,
						case when AccountLevelTypeID = 1 
								then  cast (DLID as nvarchar(max))
							 when AccountLevelTypeID = 5 
								then CFG.GetSaturnDate(value,0)
							 else Value end value
				from FIN.PettyCashCostItemAccountLevel pccial
				join ACC.AccountLevel al 
					on al.AccountLevelID = pccial.AccountLevelID
			)x pivot
			(
			max(value)
			for AccountLevelID in (' + @Columns + N')
			)p on p.PettyCashCostItemID = pcci.PettyCashCostItemID	' + @LeftJoin
          + N'		
		WHERE pcci.[Date] BETWEEN @pFromDate AND @pToDate
		AND (pc.PettyCashID in (SELECT VALUE FROM CFG.R_FnCommaStr2Table(@pSelectedPettyCash)))
	';


    SET @param = N'@pFromDate date, @pToDate date ,@pMaxID int,@pSelectedPettyCash nvarchar(max),@userId int';

    EXECUTE sys.sp_executesql @query,
                              @param,
                              @pFromDate = @FromDate,
                              @pToDate = @ToDate,
                              @pMaxID = @MaxID,
                              @pSelectedPettyCash = @SelectedPettyCash,
                              @UserID = @UserID;


    DECLARE @RemainInLine DECIMAL(30, 4);
    SET @RemainInLine = 0;


    SELECT ROW_NUMBER() OVER (ORDER BY Date, DocCode, HederNumber) AS ID,
           RowID,
           Operation,
           DocName,
           DocCode,
           HederID,
           PettyCashTitle,
           PettyCashTitle2,
           Date,
           HederNumber,
           CurrencyTitle,
           CurrencyRate,
           Amount,
           BranchCode,
           BranchTitle,
           PartyCode,
           PartyTitle,
           Description,
           Description2
    INTO #a
    FROM #PettyCashReportTemp;

    UPDATE b
    SET b.RowID = a.ID
    FROM #a a
        JOIN #PettyCashReportTemp b
            ON a.RowID = b.RowID;

    UPDATE #PettyCashReportTemp
    SET @RemainInLine = @RemainInLine + ISNULL(RemainInLine, 0),
        RemainInLine = @RemainInLine
    FROM #PettyCashReportTemp WITH (INDEX(PK_#PettyCashReportTemp));

    SELECT *,
           CFG.GetCLRSaturnDate(r.Date, @DateFormat, 0, @DateType) Date_Date
    FROM #PettyCashReportTemp r;

    IF OBJECT_ID('tempdb..#PettyCashReportTemp') IS NOT NULL
        DROP TABLE #PettyCashReportTemp;



END;
