            
CREATE   PROCEDURE [FIN].SpRptFinance_ReceivedCheqe
(
    @FromDate DATE = NULL,
    @ToDate DATE = NULL,
    @LastState_Receive BIT,
    @LastState_AssignToBank BIT,
    @LastState_DrawBack BIT,
    @LastState_CashToFund BIT,
    @LastState_CashToBank BIT,
    @LastState_Spend BIT,
    @LastState_CashFromBank BIT,
    @LastState_Protest BIT,
    @LastState_DeliverToSupplier BIT
)
--WITH ENCRYPTION
AS
BEGIN

    DECLARE @Receive NVARCHAR(100),
            @AssignToBank NVARCHAR(100),
            @DrawBack NVARCHAR(100),
            @CashToFund NVARCHAR(100),
            @CashToBank NVARCHAR(100),
            @Spend NVARCHAR(100),
            @CashFromBank NVARCHAR(100),
            @Protest NVARCHAR(100),
            @DeliverToSupplier NVARCHAR(100),
            @DateType TINYINT,
            @DateFormat VARCHAR(10),
            @UserID INT,
            @Culture VARCHAR(10),
            @CultureNo TINYINT;


    SET @UserID = CFG.GetuserID();
    SET @Culture = CFG.GetuserCulture();

    SELECT @CultureNo = CultureNo
    FROM CFG.CultureInfo
    WHERE Culture = @Culture;

    SELECT @DateType = us.SettingValue
    FROM CFG.UserSetting us
    WHERE us.SettingKey = 'Date_Type'
          AND us.UserID = @UserID;
          
          
    SELECT * INTo #vwReceivedCheque FROM fin.vwReceivedCheque AS vrc      

    IF @DateType IS NULL
        SET @DateType = CASE @Culture
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
        SET @DateFormat = 'YY/MM/DD';
        
        
        SELECT * into #vwEnums
        FROM cfg.VwEnums AS ve
        WHERE ve.Enum IN ('CheqeStateInReceive')

    SELECT @Receive = lev.Value
    FROM CFG.LocalizeEnum le
        JOIN CFG.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'ReceivePromissoryCommitmentState'
          AND le.Item = 'Receive'
          AND lev.Culture = @Culture;

    SELECT @AssignToBank = lev.Value
    FROM CFG.LocalizeEnum le
        JOIN CFG.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'CheqeStateInReceive'
          AND le.Item = 'AssignToBank'
          AND lev.Culture = @Culture;

    SELECT @DrawBack = lev.Value
    FROM CFG.LocalizeEnum le
        JOIN CFG.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'CheqeStateInReceive'
          AND le.Item = 'DrawBack'
          AND lev.Culture = @Culture;

    SELECT @CashToFund = lev.Value
    FROM CFG.LocalizeEnum le
        JOIN CFG.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'CheqeStateInReceive'
          AND le.Item = 'CashToFund'
          AND lev.Culture = @Culture;

    SELECT @CashToBank = lev.Value
    FROM CFG.LocalizeEnum le
        JOIN CFG.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'CheqeStateInReceive'
          AND le.Item = 'CashToBank'
          AND lev.Culture = @Culture;

    SELECT @Spend = lev.Value
    FROM CFG.LocalizeEnum le
        JOIN CFG.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'CheqeStateInReceive'
          AND le.Item = 'Spend'
          AND lev.Culture = @Culture;

    SELECT @CashFromBank = lev.Value
    FROM CFG.LocalizeEnum le
        JOIN CFG.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'CheqeStateInReceive'
          AND le.Item = 'CashFromBank'
          AND lev.Culture = @Culture;

    SELECT @Protest = lev.Value
    FROM CFG.LocalizeEnum le
        JOIN CFG.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'CheqeStateInReceive'
          AND le.Item = 'Protest'
          AND lev.Culture = @Culture;

    SELECT @DeliverToSupplier = lev.Value
    FROM CFG.LocalizeEnum le
        JOIN CFG.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'CheqeStateInReceive'
          AND le.Item = 'DeliverToSupplier'
          AND lev.Culture = @Culture;
          
		SELECT * INTO #vwBranchAccess
        FROM cfg.vwBranchAccess AS vba	          

    DECLARE @BaseCurrencyPrecision INT;
    SET @BaseCurrencyPrecision = CFG.GetBaseCurrencyPrecision();

    SELECT rc.ReceivedCheqeID,
           rc.ReceiveReceiptID,
           rc.Number,
           rc.ReceiveDate AS ReceivedDate,
           CFG.GetCLRSaturnDate(rc.ReceiveDate, @DateFormat, 0, @DateType) AS Date_ReceivedDate,
           CFG.GetCLRSaturnDate(rc.[Date], @DateFormat, 0, @DateType) AS Date_Date,
           rc.[Date],
           rc.CurrencyID,
           c.ExchangeUnit,
           CASE
               WHEN @CultureNo = 1 THEN
                   c.Title
               WHEN @CultureNo = 2 THEN
                   c.Title2
           END AS CurrencyTitle,
           rc.CurrencyRate,
           rc.Amount,
           CASE
               WHEN c.IsBaseCurrencyBasis = 0 THEN
                   ROUND(rc.Amount * rc.CurrencyRate / c.ExchangeUnit, @BaseCurrencyPrecision)
               WHEN c.IsBaseCurrencyBasis = 1 THEN
                   ROUND(rc.Amount * c.ExchangeUnit / rc.CurrencyRate, @BaseCurrencyPrecision)
           END AS AmountInBaseCurrency,
           CASE
               WHEN @CultureNo = 1 THEN
                   b.Title
               WHEN @CultureNo = 2 THEN
                   b.Title2
           END AS BankTitle,
           rc.BankBranchCode,
           rc.BankBranchName,
           rc.AccountNumber,
           rc.Commercial,
           CASE rc.LastState
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
           END LastState,
           CASE
               WHEN trn.ReceivedCheqeID IS NOT NULL THEN
                   trn.CashCode
               ELSE
                   cash.Code
           END AS CashCode,
           CASE
               WHEN trn.ReceivedCheqeID IS NOT NULL THEN
                   trn.CashTitle
               ELSE
                   cash.Title
           END AS CashTitle,
           br.Code BranchCode,
           CASE
               WHEN @CultureNo = 1 THEN
                   br.Title
               WHEN @CultureNo = 2 THEN
                   br.Title2
           END AS BranchTitle,
           d.Code PartyCode,
           CASE
               WHEN @CultureNo = 2 THEN
                   d.Title2
               ELSE
                   d.Title
           END AS PartyTitle,
           CASE
               WHEN rc.LastState = 4
                    OR rc.LastState = 1 THEN
                   tt.Code
               WHEN rc.LastState = 6 THEN
                   cfb.Code
               ELSE
                   spend.Code
           END DelivererCode,
           CASE
               WHEN rc.LastState = 4
                    OR rc.LastState = 1 THEN
                   tt.Title
               WHEN rc.LastState = 6 THEN
                   cfb.Title
               WHEN @CultureNo = 2 THEN
                   spend.Title2
               ELSE
                   spend.Title
           END AS DelivererTitle,
           spend.[Date] AS SpendDate,
           CFG.GetCLRSaturnDate(spend.[Date], @DateFormat, 0, @DateType) Date_SpendDate
    FROM FIN.vwReceivedCheque  rc
    join #VwEnums AS ve on rc.LastState = ve.KeyValue and ve.Enum = 'CheqeStateInReceive'
        JOIN CFG.Branch br
            ON rc.BranchID = br.BranchID
        LEFT JOIN ACC.DL d
            ON rc.DlID = d.DLID
        JOIN CFG.Currency c
            ON rc.CurrencyID = c.CurrencyID
        JOIN CFG.Bank b
            ON rc.BankID = b.BankID
        LEFT JOIN
        (
            SELECT vw.ReceivedCheqeID,
                   d.Code CashCode,
                   CASE
                       WHEN @CultureNo = 2 THEN
                           ca.Title2
                       ELSE
                           ca.Title
                   END AS CashTitle
            FROM FIN.vwLatestCashTransfersStatus vw
                JOIN CFG.Cash ca
                    ON vw.TargetCashID = ca.CashID
                JOIN ACC.DL d
                    ON ca.DlID = d.DLID
            WHERE vw.Status = 2
        ) trn
            ON rc.ReceivedCheqeID = trn.ReceivedCheqeID
        JOIN
        (
            SELECT c.CashID,
                   d.Code,
                   CASE
                       WHEN @CultureNo = 2 THEN
                           c.Title2
                       ELSE
                           c.Title
                   END AS Title
            FROM CFG.Cash c
                JOIN ACC.DL d
                    ON c.DlID = d.DLID
        ) cash
            ON rc.CashID = cash.CashID
        LEFT JOIN
        (
            SELECT i.ReceiptCheqeFlowItemID,
                   i.ReceivedCheqeID,
                   dl.Code,
                   CASE
                       WHEN pa.[Type] = 1
                            OR pa.[Type] = 2 THEN
                           pa.Title
                       WHEN pa.[Type] = 0 THEN
                           pa.Title + ' ' + pa.LastName
                   END Title,
                   CASE
                       WHEN pa.[Type] = 1
                            OR pa.[Type] = 2 THEN
                           pa.Title2
                       WHEN pa.[Type] = 0 THEN
                           pa.Title2 + ' ' + pa.LastName2
                   END Title2,
                   f.Date
            FROM FIN.ReceiptCheqeFlowItem i
                JOIN FIN.ReceiptCheqeFlow f
                    ON i.ReceiptCheqeFlowID = f.ReceiptCheqeFlowID
                JOIN CFG.Party pa
                    ON f.PartyID = pa.PartyID
                LEFT JOIN ACC.DL dl
                    ON pa.DlID = dl.DLID
            WHERE i.State = 5
        ) spend
            ON spend.ReceiptCheqeFlowItemID = rc.LastFlow
               AND spend.ReceivedCheqeID = rc.ReceivedCheqeID
        LEFT JOIN
        (
            SELECT rc.ReceivedCheqeID,
                   d.Code,
                   CASE @CultureNo
                       WHEN 2 THEN
                           d.Title2
                       ELSE
                           d.Title
                   END AS Title
            FROM FIN.ReceivedCheqe AS rc
                JOIN FIN.ReceiptCheqeFlowItem AS rcfi
                    ON rcfi.ReceiptCheqeFlowItemID = rc.LastFlow
                JOIN FIN.ReceiptCheqeFlow AS rcf
                    ON rcf.ReceiptCheqeFlowID = rcfi.ReceiptCheqeFlowID
                JOIN CFG.BankAccount AS ba
                    ON ba.BankAccountID = rcf.BankAccountID
                JOIN ACC.DL AS d
                    ON d.DLID = ba.DlID
            WHERE rcf.Type IN ( 0, 2 )
                  AND rc.LastState IN ( 1, 4 )
        ) AS tt
            ON tt.ReceivedCheqeID = rc.ReceivedCheqeID
        LEFT JOIN
        (
            SELECT rc.ReceivedCheqeID,
                   d.Code,
                   CASE @CultureNo
                       WHEN 2 THEN
                           d.Title2
                       ELSE
                           d.Title
                   END AS Title
            FROM FIN.ReceivedCheqe AS rc
                JOIN FIN.ReceiptCheqeFlowItem AS rcfi
                    ON rcfi.ReceiptCheqeFlowItemID = rc.LastFlow
                JOIN FIN.ReceiptCheqeFlow AS rcf
                    ON rcf.ReceiptCheqeFlowID = rcfi.ReceiptCheqeFlowID
                LEFT JOIN CFG.BankAccount AS ba
                    ON ba.BankAccountID = rcf.BankAccountID
                LEFT JOIN ACC.DL AS d
                    ON d.DLID = ba.DlID
            WHERE rc.LastState = 6
                  AND rcf.Type = 0
        ) cfb
            ON cfb.ReceivedCheqeID = rc.ReceivedCheqeID		
        INNER JOIN #vwBranchAccess AS vba
            ON vba.BranchID = rc.BranchID
    WHERE (
              (
                  @LastState_Receive = 1
                  AND rc.LastState = 0
              )
              OR
              (
                  @LastState_AssignToBank = 1
                  AND rc.LastState = 1
              )
              OR
              (
                  @LastState_DrawBack = 1
                  AND rc.LastState = 2
              )
              OR
              (
                  @LastState_CashToFund = 1
                  AND rc.LastState = 3
              )
              OR
              (
                  @LastState_CashToBank = 1
                  AND rc.LastState = 4
              )
              OR
              (
                  @LastState_Spend = 1
                  AND rc.LastState = 5
              )
              OR
              (
                  @LastState_CashFromBank = 1
                  AND rc.LastState = 6
              )
              OR
              (
                  @LastState_Protest = 1
                  AND rc.LastState = 7
              )
              OR
              (
                  @LastState_DeliverToSupplier = 1
                  AND rc.LastState = 8
              )
          )
          AND
          (
              @FromDate IS NULL
              OR rc.[Date] >= @FromDate
          )
          AND
          (
              @ToDate IS NULL
              OR rc.[Date] <= @ToDate
          )
		;

END;
