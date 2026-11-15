CREATE   PROC [STM].[SpRptLetterCredit]
(@ID VARCHAR(MAX))
AS
BEGIN

    CREATE TABLE #Ids
    (
        id INT
    );

    INSERT INTO #Ids
    SELECT DISTINCT
           d.LetterCreditID
    FROM CFG.R_FnCommaStr2Table(@ID) t
        INNER JOIN FOS.CreditAllocation d
            ON d.CreditAllocationID = t.value;

    DECLARE @UserID INT,
            @DateType VARCHAR(10),
            @DateFormat VARCHAR(10),
            @Culture VARCHAR(10);


    SET @UserID = CFG.GetuserID();
    SET @Culture = CFG.GetuserCulture();

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

    SELECT ConfirmStatementID,
           c2.Title,
           cs.Number,
           cs.EndDate
    INTO #ConfirmStatement
    FROM CNT.ConfirmStatement cs1
        JOIN CNT.ContractStatement cs
            ON cs.ContractStatementID = cs1.ContractStatementID
        JOIN CFG.Currency c2
            ON c2.CurrencyID = cs.CurrencyID;


    SELECT ConfirmStatementItemID,
           Currency.Title
    INTO #ConfirmStatementItem
    FROM CNT.ConfirmStatementItem i
        JOIN CNT.ConfirmStatement h
            ON i.ConfirmStatementID = h.ConfirmStatementID
        JOIN CNT.ContractStatement cs
            ON cs.ContractStatementID = h.ContractStatementID
        LEFT JOIN CFG.Currency
            ON Currency.CurrencyID = cs.CurrencyID;

    SELECT ContractStatementID,
           cs.Number,
           cs.EndDate,
           Currency.Title
    INTO #ContractStatement
    FROM CNT.ContractStatement cs
        JOIN CFG.Currency
            ON Currency.CurrencyID = cs.CurrencyID;

    SELECT lc.LetterCreditID,
           lc.LetterCreditNumber,
           CFG.GetCLRSaturnDate(lc.OpeningCreditDate, @DateFormat, 0, @DateType) OpeningCreditDate,
           lc.CreditAmount,
           CFG.GetCLRSaturnDate(lc.DueDate, @DateFormat, 0, @DateType) DueDate,
           p.Title OpeningCreditBank,
           lct.Title LetterCreditType,
           Party.Title + ' ' + ISNULL(Party.LastName, '') Party,
           Currency.Title2 Currency,
           ca.CreditAllocationID,
           ca.Number AllocationNumber,
           CFG.GetCLRSaturnDate(ca.Date, @DateFormat, 0, @DateType) AllocationDate,
           ca.Amount AllocationAmount,
           ca.Description,
           CASE
               WHEN cai.PurchaseInvoiceID IS NOT NULL THEN
                   N'فاکتور خرید'
               WHEN cai.ConfirmStatementID IS NOT NULL THEN
                   N'خالص صورت وضعیت'
               WHEN cai.ConfirmStatementItemID IS NOT NULL THEN
                   N'کسور صورت وضعیت'
               WHEN cai.ContractStatementID IS NOT NULL THEN
                   N'ارزش افزوده صورت وضعیت'
           END BaseType,
           CASE
               WHEN cai.PurchaseInvoiceID IS NOT NULL THEN
                   CASE
                       WHEN p1.InvoiceNumber IS NOT NULL THEN
                           p1.InvoiceNumber
                       ELSE
                           p1.Number
                   END
               WHEN cai.ConfirmStatementID IS NOT NULL THEN
                   cs1.Number
               WHEN cai.ConfirmStatementItemID IS NOT NULL THEN
                   ''
               WHEN cai.ContractStatementID IS NOT NULL THEN
                   cs3.Number
           END BaseNumber,
           CFG.GetCLRSaturnDate(   CASE
                                       WHEN cai.PurchaseInvoiceID IS NOT NULL THEN
                                           CASE
                                               WHEN p1.InvoiceDate IS NOT NULL THEN
                                                   p1.InvoiceDate
                                               ELSE
                                                   p1.Date
                                           END
                                       WHEN cai.ConfirmStatementID IS NOT NULL THEN
                                           cs1.EndDate
                                       WHEN cai.ConfirmStatementItemID IS NOT NULL THEN
                                           NULL
                                       WHEN cai.ContractStatementID IS NOT NULL THEN
                                           cs3.EndDate
                                   END,
                                   @DateFormat,
                                   0,
                                   @DateType
                               ) BaseDate,
           cai.Amount
    FROM FOS.LetterCredit lc
        INNER JOIN #Ids
            ON #Ids.id = lc.LetterCreditID
        INNER JOIN FOS.ProformaInvoice po
            ON po.ProformaInvoiceID = lc.ProformaInvoiceID
        INNER JOIN CFG.Currency
            ON Currency.CurrencyID = po.CurrencyID
        INNER JOIN CFG.Party
            ON Party.PartyID = po.Vendor
        INNER JOIN FOS.LetterCreditType lct
            ON lc.LetterCreditTypeID = lct.LetterCreditTypeID
        LEFT JOIN FOS.CreditAllocation ca
            ON lc.LetterCreditID = ca.LetterCreditID
        LEFT JOIN FOS.CreditAllocationItem cai
            ON ca.CreditAllocationID = cai.CreditAllocationID
        LEFT JOIN CFG.Party p
            ON p.PartyID = lc.OpeningCreditBank
        LEFT JOIN VND.PurchaseInvoice p1
            ON p1.PurchaseInvoiceID = cai.PurchaseInvoiceID
        LEFT JOIN CFG.Currency c1
            ON c1.CurrencyID = p1.CurrencyID
        LEFT JOIN #ConfirmStatement cs1
            ON cs1.ConfirmStatementID = cai.ConfirmStatementID
        LEFT JOIN #ConfirmStatementItem cs2
            ON cs2.ConfirmStatementItemID = cai.ConfirmStatementItemID
        LEFT JOIN #ContractStatement cs3
            ON cs3.ContractStatementID = cai.ContractStatementID;

END;
