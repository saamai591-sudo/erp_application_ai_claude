
Create    PROCEDURE [FIN].SpRptFinance_CashFlow
(
    @FromDate DATE,
    @ToDate DATE,
    @SelectedCash NVARCHAR(MAX) = NULL,
    @SelectedCurrency NVARCHAR(MAX) = NULL 
)
--WITH ENCRYPTION 
AS
BEGIN

    IF (@SelectedCash IS NOT NULL)
    BEGIN

        DECLARE @Culture VARCHAR(10),
                @CultureNo TINYINT,
                @User INT,
                @CashId INT,
                @CurrencyId INT;

        SET @Culture = CFG.GetuserCulture();
        SET @User = CFG.GetuserID();

        SELECT @CultureNo = CultureNo
        FROM CFG.CultureInfo
        WHERE Culture = @Culture;
		
        SELECT p.PartyID,
               d.Code PartyCode,
               CASE
                   WHEN p.[Type] = 1
                        OR p.[Type] = 2 THEN
                       p.Title
                   WHEN p.[Type] = 0 THEN
                       p.Title + ' ' + p.LastName
               END PartyTitle,
               CASE
                   WHEN p.[Type] = 1
                        OR p.[Type] = 2 THEN
                       p.Title2
                   WHEN p.[Type] = 0 THEN
                       p.Title2 + ' ' + p.LastName2
               END PartyTitle2
        INTO #Parties
        FROM CFG.Party p
            LEFT JOIN ACC.DL d
                ON p.DlID = d.DLID;

        DECLARE @FirstInventory NVARCHAR(100),
                @Receive NVARCHAR(100),
                @Payment NVARCHAR(100),
                @CashToFund NVARCHAR(100),
                @GetCash NVARCHAR(100),
                @TransferToCash NVARCHAR(100),
                @CashPayment NVARCHAR(100);

        SELECT @FirstInventory = lsv.[Value]
        FROM CFG.LocalizationSQLMessage ls
            JOIN CFG.LocalizationSQLMessageValue lsv
                ON lsv.LocalizationSQLMessageID = ls.LocalizationSQLMessageID
        WHERE ls.SQLMessageCode = 'FirstInventory'
              AND lsv.Culture = @Culture;

        SELECT @Receive = lev.[Value]
        FROM CFG.LocalizeEnum le
            JOIN CFG.LocalizeEnumValue lev
                ON lev.LocalizeEnumID = le.LocalizeEnumID
        WHERE le.Enum = 'ReceivePromissoryCommitmentState'
              AND le.Item = 'Receive'
              AND lev.Culture = @Culture;

        SELECT @Payment = lev.[Value]
        FROM CFG.LocalizeEnum le
            JOIN CFG.LocalizeEnumValue lev
                ON lev.LocalizeEnumID = le.LocalizeEnumID
        WHERE le.Enum = 'PaymentCheqeCommitmentState'
              AND le.Item = 'Payment'
              AND lev.Culture = @Culture;

        SELECT @CashToFund = lev.[Value]
        FROM CFG.LocalizeEnum le
            JOIN CFG.LocalizeEnumValue lev
                ON lev.LocalizeEnumID = le.LocalizeEnumID
        WHERE le.Enum = 'CheqeStateInReceive'
              AND le.Item = 'CashToFund'
              AND lev.Culture = @Culture;

        SELECT @GetCash = lev.[Value]
        FROM CFG.LocalizeEnum le
            JOIN CFG.LocalizeEnumValue lev
                ON lev.LocalizeEnumID = le.LocalizeEnumID
        WHERE le.Enum = 'Others'
              AND le.Item = 'GetCash'
              AND lev.Culture = @Culture;

        SELECT @TransferToCash = lev.[Value]
        FROM CFG.LocalizeEnum le
            JOIN CFG.LocalizeEnumValue lev
                ON lev.LocalizeEnumID = le.LocalizeEnumID
        WHERE le.Enum = 'Others'
              AND le.Item = 'TransferToCash'
              AND lev.Culture = @Culture;

        SELECT @CashPayment = lev.[Value]
        FROM CFG.LocalizeEnum le
            JOIN CFG.LocalizeEnumValue lev
                ON lev.LocalizeEnumID = le.LocalizeEnumID
        WHERE le.Enum = 'Others'
              AND le.Item = 'CashPayment'
              AND lev.Culture = @Culture;

        SELECT @CashId = value
        FROM CFG.R_FnCommaStr2Table(@SelectedCash);
        SELECT @CurrencyId = value
        FROM CFG.R_FnCommaStr2Table(@SelectedCurrency);
        
        SELECT * INTO #vwBranchAccess
        FROM cfg.vwBranchAccess
        

        SELECT c.CashID,
               d.Code CashCode,
               CASE
                   WHEN @CultureNo = 1 THEN
                       c.Title
                   WHEN @CultureNo = 2 THEN
                       c.Title2
               END AS CashTitle,
               cb.CurrencyID,
               CASE
                   WHEN @CultureNo = 1 THEN
                       cu.Title
                   WHEN @CultureNo = 2 THEN
                       cu.Title2
               END AS CurrencyTitle,
               cb.CurrencyRate,
               cu.ExchangeUnit,
               cu.IsBaseCurrencyBasis,
               cb.FirstAmount + ISNULL(rc.Amount, 0) + ISNULL(rcfi.Amount, 0) + ISNULL(ps.Amount, 0)
               + ISNULL(pc.Amount, 0) + ISNULL(pri.Amount, 0) + ISNULL(pri2.Amount, 0) Remain
        INTO #BeginningInventory
        FROM 
             CFG.Cash c
        LEFT JOIN     CFG.CashBalance cb
                ON cb.CashID = c.CashID 
            JOIN CFG.Currency cu
                ON cb.CurrencyID = cu.CurrencyID
            JOIN ACC.DL d
                ON c.DlID = d.DLID
            LEFT JOIN
            (
                SELECT r.CashID,
                       r.CurrencyID,
                       SUM(r.Amount) Amount
                FROM FIN.ReceivedCash r
                    JOIN FIN.ReceiveReceipt rr
                        ON r.ReceiveReceiptID = rr.ReceiveReceiptID
                        INNER JOIN #vwBranchAccess AS vba ON vba.BranchID = rr.BranchID
                WHERE rr.[Date] < @FromDate

                GROUP BY r.CashID,
                         r.CurrencyID
            ) rc
                ON c.CashID = rc.CashID
                   AND cb.CurrencyID = rc.CurrencyID
            LEFT JOIN
            (
                SELECT f.CashID,
                       c.CurrencyID,
                       SUM(c.Amount) Amount
                FROM FIN.ReceiptCheqeFlowItem i
                    JOIN FIN.ReceiptCheqeFlow f
                        ON i.ReceiptCheqeFlowID = f.ReceiptCheqeFlowID
                    JOIN FIN.ReceivedCheqe c
                        ON i.ReceivedCheqeID = c.ReceivedCheqeID
                        JOIN #vwBranchAccess AS vba ON vba.BranchID = f.BranchID
                WHERE f.[Type] = 3
                      AND i.[State] = 3
                      AND f.[Date] < @FromDate

                GROUP BY f.CashID,
                         c.CurrencyID
            ) rcfi
                ON c.CashID = rcfi.CashID
                   AND cb.CurrencyID = rcfi.CurrencyID
            LEFT JOIN
            (
                SELECT c.CashID,
                       s.CurrencyID,
                       SUM(s.Amount) Amount
                FROM FIN.PaymentSubject s
                    JOIN FIN.PaymentReceipt pr
                        ON s.PaymentReceiptID = pr.PaymentReceiptID
                    JOIN FIN.PaymentType t
                        ON s.PaymentTypeID = t.PaymentTypeID
                    JOIN CFG.Cash c
						ON s.DLID = c.DlID
                    JOIN ACC.DL dl
						ON c.DlID = dl.DLID
                        JOIN #vwBranchAccess AS vba ON vba.BranchID = pr.BranchID
                WHERE t.[Type] = 5
                      AND pr.[Date] < @FromDate
					  AND pr.Status <> 2

                GROUP BY c.CashID,
                         s.CurrencyID
            ) ps
                ON c.CashID = ps.CashID
                   AND cb.CurrencyID = ps.CurrencyID
            LEFT JOIN
            (
                SELECT p.CashID,
                       p.CurrencyID,
                       SUM(-p.Amount) Amount
                FROM FIN.PaymentCash p
                    JOIN FIN.PaymentReceipt pr
                        ON p.PaymentReceiptID = pr.PaymentReceiptID
                        JOIN #vwBranchAccess AS vba ON vba.BranchID = pr.BranchID
                WHERE pr.[Date] < @FromDate
					  AND pr.Status <> 2

                GROUP BY p.CashID,
                         p.CurrencyID
            ) pc
                ON c.CashID = pc.CashID
                   AND cb.CurrencyID = pc.CurrencyID
            LEFT JOIN
            (
                SELECT i.CashID,
				       i.CurrencyID,
                       SUM(i.Amount) Amount
                FROM POS.PosReceiptItem i
                    JOIN POS.PosReceipt r
                        ON i.PosReceiptID = r.PosReceiptID
                WHERE i.IsPayed = 0
                      AND r.[Date] < @FromDate
					  AND i.ItemType = 2
                GROUP BY i.CashID, i.CurrencyID
            ) pri
                ON c.CashID = pri.CashID
                   AND cb.CurrencyID = pri.CurrencyID
            LEFT JOIN
            (
                SELECT i.CashID,
					   i.CurrencyID,
                       SUM(-i.Amount) Amount
                FROM POS.PosReceiptItem i
                    JOIN POS.PosReceipt r
                        ON i.PosReceiptID = r.PosReceiptID
                WHERE i.IsPayed = 1
                      AND r.[Date] < @FromDate
					  AND i.ItemType = 2
                GROUP BY i.CashID, i.CurrencyID
            ) pri2
                ON c.CashID = pri2.CashID
                   AND cb.CurrencyID = pri2.CurrencyID
        WHERE c.CashID = @CashId
              AND cb.CurrencyID = @CurrencyId;

        CREATE TABLE #ReportTemp
        (
            RowID BIGINT,
            Operation NVARCHAR(50) NULL,
            DocName NVARCHAR(50),
            DocCode INT,
            DocID INT,
            HederID INT,
            CashID INT,
            CashCode VARCHAR(100) NULL,
            CashTitle NVARCHAR(256) NULL,
            [date] DATE NULL,
            Number INT NULL,
            CurrencyID INT,
            CurrencyTitle NVARCHAR(256) NULL,
            CurrencyRate DECIMAL(36, 10) NULL,
            Amount DECIMAL(36, 10) NULL,
            AmountInBaseCurrency DECIMAL(36, 10) NULL,
            BranchCode INT NULL,
            BranchTitle NVARCHAR(250) NULL,
            PartyCode VARCHAR(100) NULL,
            PartyTitle NVARCHAR(250) NULL,
            RemainInLine DECIMAL(36, 10) NULL,
		CONSTRAINT [PK_#ReportTemp] PRIMARY KEY CLUSTERED 
		(
			[RowID] ASC
		)WITH (PAD_INDEX  = OFF, STATISTICS_NORECOMPUTE  = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS  = ON, ALLOW_PAGE_LOCKS  = ON) ON [PRIMARY]
		) ON [PRIMARY]


        DECLARE @BaseCurrencyPrecision INT;
        SET @BaseCurrencyPrecision = CFG.GetBaseCurrencyPrecision();

		print 1111
        INSERT INTO #ReportTemp
        SELECT ROW_NUMBER() OVER (ORDER BY [date] asc, amount desc) RowID,
               *
        FROM
        (
            SELECT NULL Operation,
                   @FirstInventory DocName,
                   0 DocCode,
                   0 DocID,
                   0 HederID,
                   c.CashID,
                   c.CashCode,
                   c.CashTitle,
                   NULL [date],
                   NULL Number,
                   c.CurrencyID,
                   c.CurrencyTitle,
                   c.CurrencyRate,
                   c.Remain Amount,
                   CASE
                       WHEN c.IsBaseCurrencyBasis = 0 THEN
                           ROUND(Remain * CurrencyRate / c.ExchangeUnit, @BaseCurrencyPrecision)
                       WHEN c.IsBaseCurrencyBasis = 1 THEN
                           ROUND(Remain * c.ExchangeUnit / CurrencyRate, @BaseCurrencyPrecision)
                   END AS AmountInBaseCurrency,
                   NULL BranchCode,
                   NULL BranchTitle,
                   NULL PartyCode,
                   NULL PartyTitle,
                   c.Remain RemainInLine
            FROM #BeginningInventory c
            UNION
            SELECT @Receive Operation,
                   @GetCash DocName,
                   1 DocCode,
                   rc.ReceivedCashID DocID,
                   rc.ReceiveReceiptID HederID,
                   rc.CashID,
                   dl.Code CashCode,
                   CASE
                       WHEN @CultureNo = 1 THEN
                           c.Title
                       WHEN @CultureNo = 2 THEN
                           c.Title2
                   END AS CashTitle,
                   rr.[Date] [date],
                   rr.Number,
                   rc.CurrencyID,
                   CASE
                       WHEN @CultureNo = 1 THEN
                           cu.Title
                       WHEN @CultureNo = 2 THEN
                           cu.Title2
                   END AS CurrencyTitle,
                   rc.CurrencyRate,
                   rc.Amount,
                   CASE
                       WHEN cu.IsBaseCurrencyBasis = 0 THEN
                           ROUND(rc.Amount * rc.CurrencyRate / cu.ExchangeUnit, @BaseCurrencyPrecision)
                       WHEN cu.IsBaseCurrencyBasis = 1 THEN
                           ROUND(rc.Amount * cu.ExchangeUnit / rc.CurrencyRate, @BaseCurrencyPrecision)
                   END AS AmountInBaseCurrency,
                   b.Code BranchCode,
                   CASE
                       WHEN @CultureNo = 1 THEN
                           b.Title
                       WHEN @CultureNo = 2 THEN
                           b.Title2
                   END AS BranchTitle,
                   p.PartyCode,
                   CASE
                       WHEN @CultureNo = 1 THEN
                           p.PartyTitle
                       WHEN @CultureNo = 2 THEN
                           p.PartyTitle2
                   END AS PartyTitle,
                   rc.Amount RemainInLine
            FROM FIN.ReceivedCash rc
                JOIN CFG.Cash c
                    ON rc.CashID = c.CashID
                JOIN ACC.DL dl
                    ON c.DlID = dl.DLID
                JOIN FIN.ReceiveReceipt rr
                    ON rc.ReceiveReceiptID = rr.ReceiveReceiptID
                JOIN CFG.Currency cu
                    ON rc.CurrencyID = cu.CurrencyID
                JOIN CFG.Branch b
                    ON rr.BranchID = b.BranchID
                JOIN #Parties p
                    ON rr.PartyID = p.PartyID
                    JOIN #vwBranchAccess AS vba ON vba.BranchID = rr.BranchID
            WHERE rc.CashID = @CashId
                  AND rc.CurrencyID = @CurrencyId
                  AND rr.[Date]
                  BETWEEN @FromDate AND @ToDate

            UNION
            SELECT @Receive Operation,
                   @CashToFund DocName,
                   2 DocCode,
                   rcfi.ReceiptCheqeFlowItemID DocID,
                   rcfi.ReceiptCheqeFlowID HederID,
                   rcf.CashID,
                   dl.Code CashCode,
                   CASE
                       WHEN @CultureNo = 1 THEN
                           c.Title
                       WHEN @CultureNo = 2 THEN
                           c.Title2
                   END AS CashTitle,
                   rcf.[Date] [date],
                   NULL Number,
                   rc.CurrencyID,
                   CASE
                       WHEN @CultureNo = 1 THEN
                           cu.Title
                       WHEN @CultureNo = 2 THEN
                           cu.Title2
                   END AS CurrencyTitle,
                   rc.CurrencyRate,
                   rc.Amount,
                   CASE
                       WHEN cu.IsBaseCurrencyBasis = 0 THEN
                           ROUND(rc.Amount * rc.CurrencyRate / cu.ExchangeUnit, @BaseCurrencyPrecision)
                       WHEN cu.IsBaseCurrencyBasis = 1 THEN
                           ROUND(rc.Amount * cu.ExchangeUnit / rc.CurrencyRate, @BaseCurrencyPrecision)
                   END AS AmountInBaseCurrency,
                   b.Code BranchCode,
                   CASE
                       WHEN @CultureNo = 1 THEN
                           b.Title
                       WHEN @CultureNo = 2 THEN
                           b.Title2
                   END AS BranchTitle,
                   p.PartyCode,
                   CASE
                       WHEN @CultureNo = 1 THEN
                           p.PartyTitle
                       WHEN @CultureNo = 2 THEN
                           p.PartyTitle2
                   END AS PartyTitle,
                   rc.Amount RemainInLine
            FROM FIN.ReceiptCheqeFlowItem rcfi
                JOIN FIN.ReceiptCheqeFlow rcf
                    ON rcfi.ReceiptCheqeFlowID = rcf.ReceiptCheqeFlowID
                JOIN FIN.ReceivedCheqe rc
                    ON rcfi.ReceivedCheqeID = rc.ReceivedCheqeID
                LEFT JOIN CFG.Cash c
                    ON rcf.CashID = c.CashID
                LEFT JOIN ACC.DL dl
                    ON c.DlID = dl.DLID
                JOIN FIN.ReceiveReceipt rr
                    ON rc.ReceiveReceiptID = rr.ReceiveReceiptID
                JOIN CFG.Currency cu
                    ON rc.CurrencyID = cu.CurrencyID
                JOIN CFG.Branch b
                    ON rr.BranchID = b.BranchID
                JOIN #Parties p
                    ON rr.PartyID = p.PartyID
                    JOIN #vwBranchAccess AS vba ON vba.BranchID = rcf.BranchID
            WHERE rcf.[Type] = 3
                  AND rcfi.[State] = 3
                  AND rcf.CashID = @CashId
                  AND rc.CurrencyID = @CurrencyId
                  AND rcf.[Date]
                  BETWEEN @FromDate AND @ToDate

            UNION
            SELECT @Receive Operation,
                   @TransferToCash DocName,
                   3 DocCode,
                   ps.PaymentSubjectID DocID,
                   ps.PaymentReceiptID HederID,
                   c.CashID,
                   dl.Code CashCode,
                   CASE
                       WHEN @CultureNo = 1 THEN
                           c.Title
                       WHEN @CultureNo = 2 THEN
                           c.Title2
                   END AS CashTitle,
                   pr.[Date] [date],
                   pr.Number,
                   ps.CurrencyID,
                   CASE
                       WHEN @CultureNo = 1 THEN
                           cu.Title
                       WHEN @CultureNo = 2 THEN
                           cu.Title2
                   END AS CurrencyTitle,
                   ps.CurrencyRate,
                   ps.Amount,
                   CASE
                       WHEN cu.IsBaseCurrencyBasis = 0 THEN
                           ROUND(ps.Amount * ps.CurrencyRate / cu.ExchangeUnit, @BaseCurrencyPrecision)
                       WHEN cu.IsBaseCurrencyBasis = 1 THEN
                           ROUND(ps.Amount * cu.ExchangeUnit / ps.CurrencyRate, @BaseCurrencyPrecision)
                   END AS AmountInBaseCurrency,
                   b.Code BranchCode,
                   CASE
                       WHEN @CultureNo = 1 THEN
                           b.Title
                       WHEN @CultureNo = 2 THEN
                           b.Title2
                   END AS BranchTitle,
                   p.PartyCode,
                   CASE
                       WHEN @CultureNo = 1 THEN
                           p.PartyTitle
                       WHEN @CultureNo = 2 THEN
                           p.PartyTitle2
                   END AS PartyTitle,
                   ps.Amount RemainInLine
            FROM FIN.PaymentSubject ps
                JOIN FIN.PaymentReceipt pr
                    ON ps.PaymentReceiptID = pr.PaymentReceiptID
                LEFT JOIN CFG.Cash c
                    ON ps.DLID = c.DlID
                LEFT JOIN ACC.DL dl
                    ON c.DlID = dl.DLID
                JOIN CFG.Currency cu
                    ON ps.CurrencyID = cu.CurrencyID
                JOIN FIN.PaymentType t
                    ON ps.PaymentTypeID = t.PaymentTypeID
                JOIN CFG.Branch b
                    ON pr.BranchID = b.BranchID
                JOIN #Parties p
                    ON pr.PartyID = p.PartyID
                    JOIN #vwBranchAccess AS vba ON vba.BranchID = pr.BranchID
            WHERE t.[Type] = 5
                  AND c.CashID = @CashId
                  AND ps.CurrencyID = @CurrencyId
                  AND pr.[Date]
                  BETWEEN @FromDate AND @ToDate
				  AND pr.Status <> 2

            UNION
            SELECT @Receive Operation,
                   'فروش فروشگاهی' DocName,
                   5 DocCode,
                   i.PosReceiptItemID DocID,
                   i.PosReceiptID HederID,
                   i.CashID,
                   dl.Code CashCode,
                   CASE
                       WHEN @CultureNo = 1 THEN
                           c.Title
                       WHEN @CultureNo = 2 THEN
                           c.Title2
                   END AS CashTitle,
                   r.[Date] [date],
                   r.Number,
                   i.CurrencyID,
                   CASE WHEN @CultureNo = 1 THEN cu.Title else cu.Title2 END AS CurrencyTitle,
                   i.CurrencyRate CurrencyRate,
                   i.Amount,
                   CASE
                       WHEN cu.IsBaseCurrencyBasis = 0 THEN
                           ROUND(i.Amount * i.CurrencyRate / cu.ExchangeUnit, @BaseCurrencyPrecision)
                       WHEN cu.IsBaseCurrencyBasis = 1 THEN
                           ROUND(i.Amount * cu.ExchangeUnit / i.CurrencyRate, @BaseCurrencyPrecision)
                   END AS AmountInBaseCurrency,
                   NULL BranchCode,
                   NULL BranchTitle,
                   p.PartyCode,
                   CASE
                       WHEN @CultureNo = 1 THEN
                           p.PartyTitle
                       WHEN @CultureNo = 2 THEN
                           p.PartyTitle2
                   END AS PartyTitle,
                   i.Amount RemainInLine
            FROM POS.PosReceiptItem i
                JOIN POS.PosReceipt r
                    ON i.PosReceiptID = r.PosReceiptID
                JOIN CFG.Currency cu
                    ON i.CurrencyID = cu.CurrencyID
                LEFT JOIN CFG.Cash c
                    ON i.CashID = c.CashID
                LEFT JOIN ACC.DL dl
                    ON c.DlID = dl.DLID
                JOIN #Parties p
                    ON r.CustomerID = p.PartyID
            WHERE i.IsPayed = 0
                  AND i.CashID = @CashId
                  AND r.[Date] BETWEEN @FromDate AND @ToDate
				  and i.CurrencyID = @CurrencyId
				  AND i.ItemType = 2
            UNION
            SELECT @Payment Operation,
                   @CashPayment DocName,
                   4 DocCode,
                   pc.PaymentCashID DocID,
                   pc.PaymentReceiptID HederID,
                   pc.CashID,
                   dl.Code CashCode,
                   CASE
                       WHEN @CultureNo = 1 THEN
                           c.Title
                       WHEN @CultureNo = 2 THEN
                           c.Title2
                   END AS CashTitle,
                   pr.[Date] [date],
                   pr.Number,
                   pc.CurrencyID,
                   CASE
                       WHEN @CultureNo = 1 THEN
                           cu.Title
                       WHEN @CultureNo = 2 THEN
                           cu.Title2
                   END AS CurrencyTitle,
                   pc.CurrencyRate,
                   -pc.Amount,
                   CASE
                       WHEN cu.IsBaseCurrencyBasis = 0 THEN
                           ROUND(-pc.Amount * pc.CurrencyRate / cu.ExchangeUnit, @BaseCurrencyPrecision)
                       WHEN cu.IsBaseCurrencyBasis = 1 THEN
                           ROUND(-pc.Amount * cu.ExchangeUnit / pc.CurrencyRate, @BaseCurrencyPrecision)
                   END AS AmountInBaseCurrency,
                   b.Code BranchCode,
                   CASE
                       WHEN @CultureNo = 1 THEN
                           b.Title
                       WHEN @CultureNo = 2 THEN
                           b.Title2
                   END AS BranchTitle,
                   p.PartyCode,
                   CASE
                       WHEN @CultureNo = 1 THEN
                           p.PartyTitle
                       WHEN @CultureNo = 2 THEN
                           p.PartyTitle2
                   END AS PartyTitle,
                   -pc.Amount RemainInLine
            FROM FIN.PaymentCash pc
                JOIN CFG.Cash c
                    ON pc.CashID = c.CashID
                JOIN ACC.DL dl
                    ON c.DlID = dl.DLID
                JOIN FIN.PaymentReceipt pr
                    ON pc.PaymentReceiptID = pr.PaymentReceiptID
                JOIN CFG.Currency cu
                    ON pc.CurrencyID = cu.CurrencyID
                JOIN CFG.Branch b
                    ON pr.BranchID = b.BranchID
                JOIN #Parties p
                    ON pr.PartyID = p.PartyID
                    JOIN #vwBranchAccess AS vba ON vba.BranchID = pr.BranchID
            WHERE pc.CashID = @CashId
                  AND pc.CurrencyID = @CurrencyId
                  AND pr.[Date] BETWEEN @FromDate AND @ToDate
				  AND pr.Status <> 2

            UNION
            SELECT @Payment Operation,
                   'فروش فروشگاهی' DocName,
                   6 DocCode,
                   i.PosReceiptItemID DocID,
                   i.PosReceiptID HederID,
                   i.CashID,
                   dl.Code CashCode,
                   CASE
                       WHEN @CultureNo = 1 THEN
                           c.Title
                       WHEN @CultureNo = 2 THEN
                           c.Title2
                   END AS CashTitle,
                   r.[Date] [date],
                   r.Number,
                   i.CurrencyID,
                   CASE WHEN @CultureNo = 1 THEN cu.Title else cu.Title2 END AS CurrencyTitle,
                   i.CurrencyRate CurrencyRate,
                   -i.Amount,
                   CASE
                       WHEN cu.IsBaseCurrencyBasis = 0 THEN
                           ROUND(-i.Amount * i.CurrencyRate / cu.ExchangeUnit, @BaseCurrencyPrecision)
                       WHEN cu.IsBaseCurrencyBasis = 1 THEN
                           ROUND(-i.Amount * cu.ExchangeUnit / i.CurrencyRate, @BaseCurrencyPrecision)
                   END AS AmountInBaseCurrency,
                   NULL BranchCode,
                   NULL BranchTitle,
                   p.PartyCode,
                   CASE
                       WHEN @CultureNo = 1 THEN
                           p.PartyTitle
                       WHEN @CultureNo = 2 THEN
                           p.PartyTitle2
                   END AS PartyTitle,
                   -i.Amount RemainInLine
            FROM POS.PosReceiptItem i
                JOIN POS.PosReceipt r
                    ON i.PosReceiptID = r.PosReceiptID
                JOIN CFG.Currency cu
                    ON i.CurrencyID = cu.CurrencyID
                LEFT JOIN CFG.Cash c
                    ON i.CashID = c.CashID
                LEFT JOIN ACC.DL dl
                    ON c.DlID = dl.DLID
                JOIN #Parties p
                    ON r.CustomerID = p.PartyID
            WHERE i.IsPayed = 1
                  AND i.CashID = @CashId
                  AND r.[Date] BETWEEN @FromDate AND @ToDate
				  and i.CurrencyID = @CurrencyId
				  AND i.ItemType = 2
        ) AS a;

        DECLARE @RemainInLine DECIMAL(30, 4);
        SET @RemainInLine = 0;

        UPDATE #ReportTemp
        SET @RemainInLine = @RemainInLine + ISNULL(RemainInLine, 0),
            RemainInLine = @RemainInLine
        FROM #ReportTemp
		WITH (INDEX([PK_#ReportTemp]))

        DECLARE @UserID INT,
                @DateType TINYINT,
                @DateFormat VARCHAR(10);

        SET @UserID = CFG.GetuserID();

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

        SELECT r.RowID,
               r.Operation,
               r.DocName,
               r.DocCode,
               r.DocID,
               r.HederID,
               r.CashID,
               r.CashCode,
               r.CashTitle,
               r.[date] AS [Date],
               CFG.GetCLRSaturnDate(r.[date], @DateFormat, 0, @DateType) Date_Date,
               r.Number,
               r.CurrencyID,
               r.CurrencyTitle,
               r.CurrencyRate,
               r.Amount,
               r.AmountInBaseCurrency,
               r.BranchCode,
               r.BranchTitle,
               r.PartyCode,
               r.PartyTitle,
               --r.RemainInLine
			   sum(r.Amount) over(order by r.[date] asc, Amount desc) RemainInLine
        FROM #ReportTemp r
		order by r.[date] asc, Amount desc

        DROP TABLE #Parties;
        DROP TABLE #BeginningInventory;
        DROP TABLE #ReportTemp;


    END;

END;

