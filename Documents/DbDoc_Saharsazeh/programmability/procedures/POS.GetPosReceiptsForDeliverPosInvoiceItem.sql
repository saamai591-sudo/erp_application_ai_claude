
----------------End of #8030
CREATE   PROC POS.GetPosReceiptsForDeliverPosInvoiceItem
(
    @StationShiftId INT,
    @selected NVARCHAR(500),
    @currentFinancialPeriodId INT,
    @date DATE,
    @type INT,
    @basePrecisionCount INT
)
AS
BEGIN

    DECLARE @DateFormat NVARCHAR(10),
            @cultureNo INT,
            @UserID INT,
            @DateType NVARCHAR(10),
            @Culture NVARCHAR(10);

    SET @UserID = CFG.GetuserID();
    SET @Culture = CFG.GetuserCulture();


    SELECT @cultureNo = CultureNo
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
                            ELSE
                                0
                        END;

    SELECT @DateFormat = us.SettingValue
    FROM CFG.UserSetting us
    WHERE us.SettingKey = 'Date_Format'
          AND us.UserID = @UserID;

    IF @DateFormat IS NULL
        SET @DateFormat = N'YY/MM/DD';

    DECLARE @selectedIds TABLE
    (
        PosReceiptItemID INT NOT NULL PRIMARY KEY
    );

    INSERT @selectedIds
    (
        PosReceiptItemID
    )
    SELECT value
    FROM CFG.R_FnCommaStr2Table(@selected);


    DECLARE @CardReaderInfos TABLE
    (
        CardReaderID INT NOT NULL PRIMARY KEY,
        Title NVARCHAR(MAX) NOT NULL,
        DlCode NVARCHAR(MAX) NOT NULL,
        DlTitle NVARCHAR(MAX) NOT NULL
    );



    INSERT @CardReaderInfos
    (
        CardReaderID,
        Title,
        DlCode,
        DlTitle
    )
    SELECT cr.CardReaderID,
           cr.Title,
           d.Code,
           CASE @cultureNo
               WHEN 2 THEN
                   d.Title2
               ELSE
                   d.Title
           END
    FROM POS.CardReader AS cr
        LEFT JOIN ACC.DL AS d
            ON d.DLID = cr.DlID;

    DECLARE @banckAccountsInfos TABLE
    (
        BankAccountID INT NOT NULL PRIMARY KEY,
        DlTitle NVARCHAR(MAX) NOT NULL
    );

    INSERT @banckAccountsInfos
    (
        BankAccountID,
        DlTitle
    )
    SELECT ba.BankAccountID,
           CASE @cultureNo
               WHEN 2 THEN
                   d.Title2
               ELSE
                   d.Title
           END
    FROM CFG.BankAccount ba
        LEFT JOIN ACC.DL AS d
            ON d.DLID = ba.DlID;


    DECLARE @CashInfos TABLE
    (
        CashID INT NOT NULL PRIMARY KEY,
        Title NVARCHAR(MAX) NOT NULL,
        DlCode NVARCHAR(MAX) NOT NULL,
        DlTitle NVARCHAR(MAX) NOT NULL
    );


    INSERT @CashInfos
    (
        CashID,
        Title,
        DlCode,
        DlTitle
    )
    SELECT cr.CashID,
           CASE @cultureNo
               WHEN 2 THEN
                   cr.Title2
               ELSE
                   cr.Title
           END,
           d.Code,
           CASE @cultureNo
               WHEN 2 THEN
                   d.Title2
               ELSE
                   d.Title
           END
    FROM CFG.Cash AS cr
        LEFT JOIN ACC.DL AS d
            ON d.DLID = cr.DlID;

    DECLARE @subscriptionCardInfos TABLE
    (
        SubscribeCardChargeID INT NOT NULL PRIMARY KEY,
        Number NVARCHAR(MAX) NOT NULL,
        DlCode NVARCHAR(MAX) NOT NULL,
        DlTitle NVARCHAR(MAX) NOT NULL
    );


    INSERT @subscriptionCardInfos
    (
        SubscribeCardChargeID,
        Number,
        DlCode,
        DlTitle
    )
    SELECT s.SubscribeCardChargeID,
           sc.Number,
           d.Code,
           CASE @cultureNo
               WHEN 2 THEN
                   d.Title2
               ELSE
                   d.Title
           END
    FROM CTM.SubscribeCardCharge AS s
        LEFT JOIN CTM.SubscribeCard AS sc
            ON sc.SubscribeCardID = s.SubscribeCardID
        LEFT JOIN CFG.Party AS p
            ON p.PartyID = sc.PartyID
        LEFT JOIN ACC.DL AS d
            ON d.DLID = p.DlID;

    SELECT pri.PosReceiptItemID AS PosReceiptItemId,
           pri.TracingNumber,
           CAST((CASE
                     WHEN pr.IsPayed = 1
                          OR pri.IsPayed = 1 THEN
                         1
                     ELSE
                         0
                 END
                ) AS BIT) AS IsPayed,
           CFG.GetCLRSaturnDate(pr.Date, @DateFormat, 0, @DateType) AS DateString,
           CFG.GetCLRSaturnDate(pri.Date, @DateFormat, 0, @DateType) AS PosReceiptItemDateString,
           CASE
               WHEN pr.IsPayed = 1
                    OR pri.IsPayed = 1 THEN
                   -1
               ELSE
                   1
           END * pri.Amount AS Amount,
           CASE @cultureNo
               WHEN 2 THEN
                   c.Title2
               ELSE
                   c.Title
           END CurrencyTitle,
           pri.CurrencyRate,
           (CASE
                WHEN pr.IsPayed = 1
                     OR pri.IsPayed = 1 THEN
                    -1
                ELSE
                    1
            END
           ) * (CASE c.IsBaseCurrencyBasis
                    WHEN 1 THEN
                        ROUND(pri.Amount * c.ExchangeUnit / pri.CurrencyRate, @basePrecisionCount)
                    ELSE
                        ROUND(pri.Amount * pri.CurrencyRate / c.ExchangeUnit, @basePrecisionCount)
                END
               ) AmountInBaseCurrency,
           CASE
               WHEN pri.CardReaderID IS NOT NULL THEN
                   cr.DlCode
               WHEN pri.CashID IS NOT NULL THEN
                   ch.DlCode
               WHEN pri.SubscribeCardChargeID IS NOT NULL THEN
                   sc.DlCode
               ELSE
                   ''
           END DlCode,
           CASE
               WHEN pri.CardReaderID IS NOT NULL THEN
                   cr.DlTitle
               WHEN pri.CashID IS NOT NULL THEN
                   ch.DlTitle
               WHEN pri.SubscribeCardChargeID IS NOT NULL THEN
                   sc.DlTitle
               ELSE
                   ''
           END DlTitle,
           CASE
               WHEN pr.PosInvoiceID IS NOT NULL THEN
                   pi.Number
               ELSE
                   NULL
           END PosInvoiceNumber,
           CASE
               WHEN pri.CashID IS NOT NULL THEN
                   ch.Title
               ELSE
                   ''
           END CashTitle,
           CASE
               WHEN pri.CardReaderID IS NOT NULL THEN
                   cr.Title
               ELSE
                   ''
           END CardReaderTitle,
           pr.Number,
           CASE
               WHEN pri.ShoppingCartID IS NOT NULL THEN
                   pri.TracingNumber
               WHEN pri.SubscribeCardChargeID IS NOT NULL THEN
                   sc.Number
               ELSE
                   ''
           END ShoppingCardSerial,
           CASE
               WHEN pr.IsPayed = 1
                    OR pri.IsPayed = 1 THEN
                   N'پرداخت'
               ELSE
                   N'دریافت'
           END TypeString,
           u.[Name] AS CreatorName,
           pr.CreationDate AS ItemCreationDate,
           b.Title BankTitle,
           bai.DlTitle BankAccountName,
           pri.AccountNumber
    FROM POS.PosReceiptItem AS pri
        JOIN POS.PosReceipt AS pr
            ON pr.PosReceiptID = pri.PosReceiptID
        JOIN CFG.[User] AS u
            ON u.UserID = pr.Creator
        LEFT JOIN POS.PosInvoice AS pi
            ON pi.PosInvoiceID = pr.PosInvoiceID
        LEFT JOIN @CardReaderInfos cr
            ON cr.CardReaderID = pri.CardReaderID
        LEFT JOIN @CashInfos ch
            ON ch.CashID = pri.CashID
        LEFT JOIN @subscriptionCardInfos sc
            ON sc.SubscribeCardChargeID = pri.SubscribeCardChargeID
        LEFT JOIN CFG.Bank b
            ON b.BankID = pri.BankID
        LEFT JOIN @banckAccountsInfos AS bai
            ON bai.BankAccountID = pri.BankAccountID
        JOIN CFG.Currency AS c
            ON c.CurrencyID = pri.CurrencyID
        LEFT JOIN @selectedIds AS rfcst
            ON rfcst.PosReceiptItemID = pri.PosReceiptItemID
        LEFT JOIN POS.DeliveryPosReceiptItem AS dpri
            ON dpri.PosReceiptItemID = pri.PosReceiptItemID
    WHERE pr.StationShiftID = @StationShiftId
          AND rfcst.PosReceiptItemID IS NULL
          AND dpri.DeliveryPosReceiptItemID IS NULL
          AND pr.FinancialPeriodID = @currentFinancialPeriodId
          AND pr.Date <= @date
          AND
          (
              pr.PosInvoiceID IS NULL
              OR
              (
                  pi.Status <> 2
                  AND pi.Status <> 3
              )
          )
          AND pri.ItemType = @type
END;
