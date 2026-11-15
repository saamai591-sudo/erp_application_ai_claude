
CREATE   PROCEDURE [FIN].SpRptFinance_ReceivedCheqeFlow
(@SelectedReceivedCheqe NVARCHAR(MAX))
--WITH ENCRYPTION 
AS
BEGIN

    DECLARE @ReceivedCheqeID INT;
    SELECT @ReceivedCheqeID = value
    FROM CFG.R_FnCommaStr2Table(@SelectedReceivedCheqe);

    DECLARE @Receive NVARCHAR(10),
            @AssignToBank NVARCHAR(25),
            @DrawBack NVARCHAR(25),
            @CashToFund NVARCHAR(25),
            @CashToBank NVARCHAR(25),
            @Spend NVARCHAR(10),
            @CashFromBank NVARCHAR(25),
            @Protest NVARCHAR(10),
            @DeliverToSupplier NVARCHAR(25),
            @ReturnedOfSpend NVARCHAR(25),
            @CashAndProtest NVARCHAR(25),
            @Spending NVARCHAR(25),
            @InitialAssignToBank NVARCHAR(25),
            @InitialProtest NVARCHAR(25),
            @ReturnFromAssignment NVARCHAR(25),
            @DateType TINYINT,
            @DateFormat VARCHAR(10),
            @UserID INT,
            @Culture VARCHAR(10),
            @CultureNo TINYINT,
			@Send nvarchar(10),
			@Delivery nvarchar(10)

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
                            WHEN 'ar' THEN
                                2
                        END;


    SELECT @DateFormat = us.SettingValue
    FROM CFG.UserSetting us
    WHERE us.SettingKey = 'Date_Format'
          AND us.UserID = @UserID;

    IF @DateFormat IS NULL
        SET @DateFormat = 'YY/MM/DD';

    SELECT @InitialProtest = lev.[Value]
    FROM CFG.LocalizeEnum le
        JOIN CFG.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'CheqeOperationTypeInReceive'
          AND le.Item = 'InitialProtest'
          AND lev.Culture = CFG.GetuserCulture();

    SELECT @InitialAssignToBank = lev.[Value]
    FROM CFG.LocalizeEnum le
        JOIN CFG.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'CheqeOperationTypeInReceive'
          AND le.Item = 'InitialAssignToBank'
          AND lev.Culture = CFG.GetuserCulture();

    SELECT @Spending = lev.[Value]
    FROM CFG.LocalizeEnum le
        JOIN CFG.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'CheqeOperationTypeInReceive'
          AND le.Item = 'Spending'
          AND lev.Culture = CFG.GetuserCulture();

    SELECT @CashAndProtest = lev.[Value]
    FROM CFG.LocalizeEnum le
        JOIN CFG.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'CheqeOperationTypeInReceive'
          AND le.Item = 'CashAndProtest'
          AND lev.Culture = CFG.GetuserCulture();

    SELECT @ReturnedOfSpend = lev.[Value]
    FROM CFG.LocalizeEnum le
        JOIN CFG.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'CheqeOperationTypeInReceive'
          AND le.Item = 'ReturnedOfSpend'
          AND lev.Culture = CFG.GetuserCulture();

    SELECT @Receive = lev.[Value]
    FROM CFG.LocalizeEnum le
        JOIN CFG.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'ReceivePromissoryCommitmentState'
          AND le.Item = 'Receive'
          AND lev.Culture = CFG.GetuserCulture();

    SELECT @AssignToBank = lev.[Value]
    FROM CFG.LocalizeEnum le
        JOIN CFG.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'CheqeStateInReceive'
          AND le.Item = 'AssignToBank'
          AND lev.Culture = CFG.GetuserCulture();

    SELECT @DrawBack = lev.[Value]
    FROM CFG.LocalizeEnum le
        JOIN CFG.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'CheqeStateInReceive'
          AND le.Item = 'DrawBack'
          AND lev.Culture = CFG.GetuserCulture();

    SELECT @CashToFund = lev.[Value]
    FROM CFG.LocalizeEnum le
        JOIN CFG.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'CheqeStateInReceive'
          AND le.Item = 'CashToFund'
          AND lev.Culture = CFG.GetuserCulture();

    SELECT @CashToBank = lev.[Value]
    FROM CFG.LocalizeEnum le
        JOIN CFG.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'CheqeStateInReceive'
          AND le.Item = 'CashToBank'
          AND lev.Culture = CFG.GetuserCulture();

    SELECT @Spend = lev.[Value]
    FROM CFG.LocalizeEnum le
        JOIN CFG.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'CheqeStateInReceive'
          AND le.Item = 'Spend'
          AND lev.Culture = CFG.GetuserCulture();

    SELECT @CashFromBank = lev.[Value]
    FROM CFG.LocalizeEnum le
        JOIN CFG.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'CheqeStateInReceive'
          AND le.Item = 'CashFromBank'
          AND lev.Culture = CFG.GetuserCulture();

    SELECT @Protest = lev.[Value]
    FROM CFG.LocalizeEnum le
        JOIN CFG.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'CheqeStateInReceive'
          AND le.Item = 'Protest'
          AND lev.Culture = CFG.GetuserCulture();

    SELECT @DeliverToSupplier = lev.[Value]
    FROM CFG.LocalizeEnum le
        JOIN CFG.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'CheqeStateInReceive'
          AND le.Item = 'DeliverToSupplier'
          AND lev.Culture = CFG.GetuserCulture();

    SELECT @ReturnFromAssignment = lev.[Value]
    FROM CFG.LocalizeEnum le
        JOIN CFG.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'CheqeOperationTypeInReceive'
          AND le.Item = 'ReturnFromAssignment'
          AND lev.Culture = CFG.GetuserCulture();

	SELECT @Send = lev.[Value]
    FROM CFG.LocalizeEnum le
        JOIN CFG.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'CashTransferTypes'
          AND le.Item = 'Send'
          AND lev.Culture = CFG.GetuserCulture();

	SELECT @Delivery = lev.[Value]
    FROM CFG.LocalizeEnum le
        JOIN CFG.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'CashTransferTypes'
          AND le.Item = 'Delivery'
          AND lev.Culture = CFG.GetuserCulture();

    IF OBJECT_ID('tempdb..#Parties') IS NOT NULL
        DROP TABLE #Parties;

    IF OBJECT_ID('tempdb..#result') IS NOT NULL
        DROP TABLE #result;

    SELECT p.PartyID,
           d.Code,
           CASE
               WHEN p.[Type] = 1
                    OR p.[Type] = 2 THEN
                   p.Title
               WHEN p.[Type] = 0 THEN
                   p.Title + ' ' + p.LastName
           END AS Title,
           CASE
               WHEN p.[Type] = 1
                    OR p.[Type] = 2 THEN
                   p.Title2
               WHEN p.[Type] = 0 THEN
                   p.Title2 + ' ' + p.LastName2
           END AS Title2
    INTO #Parties
    FROM CFG.Party p
        LEFT JOIN ACC.DL d
            ON p.DlID = d.DLID;

    SELECT ROW_NUMBER() OVER (ORDER BY HederID, DocumentID) RowID,
           a.DocumentID,
           a.HederID,
           a.DocumentName,
		   Status,
           a.EngName,
           a.ReceivedCheqeID,
           a.CheqeNumber,
           a.Date,
           a.Number,
           a.PreviousFlow,
           a.CheqeState,
           a.BranchCode,
           a.BranchTitle,
           a.BankAccountCode,
           a.BankAccountTitle,
           a.CashCode,
           a.CashTitle,
           a.PartyCode,
           a.PartyTitle
    INTO #result
    FROM
    (
        SELECT 100 as Status,
				rc.ReceivedCheqeID DocumentID,
               rc.ReceiveReceiptID HederID,
               @Receive DocumentName,
               'ReceiveReceipt' EngName,
               rc.ReceivedCheqeID,
               rc.Number CheqeNumber,
               rr.Date,
               rr.Number,
               NULL PreviousFlow,
               @Receive CheqeState,
               b.Code BranchCode,
               CASE
                   WHEN @CultureNo = 1 THEN
                       b.Title
                   WHEN @CultureNo = 2 THEN
                       b.Title2
               END AS BranchTitle,
               NULL BankAccountCode,
               NULL BankAccountTitle,
               dlcash.Code CashCode,
               CASE
                   WHEN @CultureNo = 1 THEN
                       c.Title
                   WHEN @CultureNo = 2 THEN
                       c.Title2
               END AS CashTitle,
               p.Code PartyCode,
               CASE
                   WHEN @CultureNo = 1 THEN
                       p.Title
                   WHEN @CultureNo = 2 THEN
                       p.Title2
               END AS PartyTitle
        FROM FIN.ReceivedCheqe rc
            JOIN FIN.ReceiveReceipt rr
                ON rc.ReceiveReceiptID = rr.ReceiveReceiptID
            JOIN CFG.Branch b
                ON rr.BranchID = b.BranchID
            JOIN CFG.Cash c
                ON rc.CashID = c.CashID
            JOIN ACC.DL dlcash
                ON c.DlID = dlcash.DLID
            JOIN #Parties p
                ON rr.PartyID = p.PartyID
                JOIN cfg.vwFinancialPeriodAccess AS vfpa ON vfpa.FinancialPeriodID = rr.FinancialPeriodID
        WHERE rc.ReceivedCheqeID = @ReceivedCheqeID
        UNION
        SELECT rcf.[Type],
				rcfi.ReceiptCheqeFlowItemID DocumentID,
               CASE
                   WHEN rcf.[Type] = 9 THEN
                       poc.PaymentReceiptID
                   ELSE
                       rcf.ReceiptCheqeFlowID
               END AS HederID,
               CASE rcf.[Type]
                   WHEN 0 THEN
                       @AssignToBank
                   WHEN 1 THEN
                       @DrawBack
                   WHEN 2 THEN
                       @CashToBank
                   WHEN 3 THEN
                       @CashToFund
                   WHEN 4 THEN
                       @ReturnedOfSpend
                   WHEN 5 THEN
                       @CashAndProtest
                   WHEN 6 THEN
                       @DeliverToSupplier
                   WHEN 7 THEN
                       @InitialAssignToBank
                   WHEN 8 THEN
                       @InitialProtest
                   WHEN 9 THEN
                       @Spending
                   WHEN 10 THEN
                       'برگشت از واگذاری'
               END DocumentName,
               CASE rcf.[Type]
                   WHEN 0 THEN
                       'BankOperation'
                   WHEN 1 THEN
                       'DrawBackReceivedCheqe'
                   WHEN 2 THEN
                       'ReceivedCheqeCashing'
                   WHEN 3 THEN
                       'ReceivedCheqeCashing'
                   WHEN 4 THEN
                       'DrawBackReceivedCheqe'
                   WHEN 5 THEN
                       'BankOperation'
                   WHEN 6 THEN
                       'DeliverToSupplier'
                   WHEN 7 THEN
                       'BankOperation'
                   WHEN 8 THEN
                       'BankOperation'
                   WHEN 9 THEN
                       'PaymentReceipt'
                   WHEN 10 THEN
                       'BankOperation'
               END EngName,
               rcfi.ReceivedCheqeID,
               rc.Number CheqeNumber,
               CASE
                   WHEN rcf.[Type] = 9 THEN
                       poc.Date
                   ELSE
                       rcf.Date
               END AS Date,
               rcf.InnerNumber Number,
               rcfi.PreviousFlow,
               CASE rcfi.[State]
                   WHEN 0 THEN
                       @Receive
                   WHEN 1 THEN
                       @AssignToBank
                   WHEN 2 THEN
                       @DrawBack
                   WHEN 3 THEN
                       @CashToFund
                   WHEN 4 THEN
                       @CashToBank
                   WHEN 5 THEN
                       @Spend
                   WHEN 6 THEN
                       @CashFromBank
                   WHEN 7 THEN
                       @Protest
                   WHEN 8 THEN
                       @DeliverToSupplier
               END CheqeState,
               br.Code BranchCode,
               CASE
                   WHEN @CultureNo = 1 THEN
                       br.Title
                   WHEN @CultureNo = 2 THEN
                       br.Title2
               END AS BranchTitle,
               dl.Code BankAccountCode,
               CASE
                   WHEN @CultureNo = 1 THEN
                       dl.Title
                   WHEN @CultureNo = 2 THEN
                       dl.Title2
               END AS BankAccountTitle,
               dl2.Code CashCode,
               CASE
                   WHEN @CultureNo = 1 THEN
                       c.Title
                   WHEN @CultureNo = 2 THEN
                       c.Title2
               END AS CashTitle,
               p.Code PartyCode,
               CASE
                   WHEN @CultureNo = 1 THEN
                       p.Title
                   WHEN @CultureNo = 2 THEN
                       p.Title2
               END AS PartyTitle
        FROM FIN.ReceiptCheqeFlowItem rcfi
            JOIN FIN.ReceiptCheqeFlow rcf
                ON rcfi.ReceiptCheqeFlowID = rcf.ReceiptCheqeFlowID
            JOIN FIN.ReceivedCheqe rc
                ON rcfi.ReceivedCheqeID = rc.ReceivedCheqeID
            JOIN CFG.Branch br
                ON rcf.BranchID = br.BranchID
            LEFT JOIN CFG.BankAccount ba
                ON rcf.BankAccountID = ba.BankAccountID
            LEFT JOIN ACC.DL dl
                ON ba.DlID = dl.DLID
            LEFT JOIN CFG.Cash c
                ON rcf.CashID = c.CashID
            LEFT JOIN ACC.DL dl2
                ON c.DlID = dl2.DLID
            LEFT JOIN #Parties p
                ON rcf.PartyID = p.PartyID
            LEFT JOIN
            (
                SELECT ReceiptCheqeFlowItemID,
                       a.PaymentReceiptID,
                       b.Date
                FROM FIN.PaymentOtherCheqe a
                    JOIN FIN.PaymentReceipt b
                        ON a.PaymentReceiptID = b.PaymentReceiptID
            ) poc
                ON rcfi.ReceiptCheqeFlowItemID = poc.ReceiptCheqeFlowItemID
                   AND rcfi.State = 5
                   AND rcf.Type = 9
                   JOIN cfg.vwFinancialPeriodAccess AS vfpa ON vfpa.FinancialPeriodID = rcf.FinancialPeriodID
        WHERE rcfi.ReceivedCheqeID = @ReceivedCheqeID
		  union
		  SELECT 100 as Status,
				i.CashTransferItemID DocumentID,
                 i.CashTransferID HederID,
                 case t.Type when 1 then @Send when 2 then @Delivery end as DocumentName,
                'CashTransfer' EngName,
                 i.ReceivedCheqeID,
                 rc.Number CheqeNumber,
                 t.Date,
                 t.Number,
                 NULL PreviousFlow,
                 @Receive CheqeState,
                 b.Code BranchCode,
                 CASE @CultureNo WHEN 2 THEN b.Title2 else b.Title END AS BranchTitle,
                 NULL BankAccountCode,
                 NULL BankAccountTitle,
				 case t.Type when 1 then dlcash.Code when 2 then dlcash2.Code end as CashCode,
				 case t.Type when 1 then case @CultureNo when 2 then c.Title2 else c.Title end
				             when 2 then case @CultureNo when 2 then c2.Title2 else c2.Title end				 
				 end as CashTitle,              
                 null PartyCode,
                 null PartyTitle
        FROM FIN.CashTransferItem i
            JOIN FIN.CashTransfer t
                ON i.CashTransferID = t.CashTransferID
			join FIN.ReceivedCheqe rc on i.ReceivedCheqeID = rc.ReceivedCheqeID
            JOIN CFG.Branch b
                ON t.BranchID = b.BranchID
            JOIN CFG.Cash c
                ON t.SourceCashID = c.CashID
            JOIN ACC.DL dlcash
                ON c.DlID = dlcash.DLID
			JOIN CFG.Cash c2
                ON t.TargetCashID = c2.CashID
            JOIN ACC.DL dlcash2
                ON c2.DlID = dlcash2.DLID
                JOIN cfg.vwFinancialPeriodAccess AS vfpa ON vfpa.FinancialPeriodID = t.FinancialPeriodID
        WHERE i.ReceivedCheqeID = @ReceivedCheqeID		 
    ) AS a;

    SELECT RowID,
           DocumentID,
           HederID,
           DocumentName,
           EngName,
		   Status,
           ReceivedCheqeID,
           CheqeNumber,
           Date,
           Number,
           PreviousFlow,
           CheqeState,
           BranchCode,
           BranchTitle,
           BankAccountCode,
           BankAccountTitle,
           CashCode,
           CashTitle,
           PartyCode,
           PartyTitle,
           CFG.GetCLRSaturnDate([Date], @DateFormat, 0, @DateType) Date_Date
    FROM #result;

    IF OBJECT_ID('tempdb..#Parties') IS NOT NULL
        DROP TABLE #Parties;

    IF OBJECT_ID('tempdb..#result') IS NOT NULL
        DROP TABLE #result;

END;

