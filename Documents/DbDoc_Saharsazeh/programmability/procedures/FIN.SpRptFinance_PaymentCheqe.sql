
-------------------------------------
CREATE   PROCEDURE [FIN].SpRptFinance_PaymentCheqe
(
    @FromDate DATE = NULL,
    @ToDate DATE = NULL,
    @LastState_TodayCheqe BIT,
    @LastState_Cashed BIT,
    @LastState_Term BIT,
    @LastState_DrawBacked BIT,
    @Canceled BIT
)
--WITH ENCRYPTION 
AS
BEGIN

    DECLARE @DrawBacked NVARCHAR(100),
            @Term NVARCHAR(100),
            @TodayCheqe NVARCHAR(100),
            @Revoked NVARCHAR(100),
            @Cashed NVARCHAR(100),
            @user INT,
            @Culture VARCHAR(10),
            @DateType TINYINT,
            @DateFormat VARCHAR(10),
            @CultureNo TINYINT;

    SET @user = CFG.GetuserID();
    SET @Culture = CFG.GetuserCulture();

    SELECT @CultureNo = CultureNo
    FROM CFG.CultureInfo
    WHERE Culture = @Culture;

    SELECT @DateType = us.SettingValue
    FROM CFG.UserSetting us
    WHERE us.SettingKey = 'Date_Type'
          AND us.UserID = @user;

    IF @DateType IS NULL
        SET @DateType = CASE CFG.GetuserCulture()
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
          AND us.UserID = @user;

    IF @DateFormat IS NULL
        SET @DateFormat = 'YY/MM/DD';

    SELECT @TodayCheqe = lev.[Value]
    FROM CFG.LocalizeEnum le
        JOIN CFG.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'CheqeStateInPayment'
          AND le.Item = 'TodayCheqe'
          AND lev.Culture = @Culture;

    SELECT @Term = lev.[Value]
    FROM CFG.LocalizeEnum le
        JOIN CFG.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'CheqeStateInPayment'
          AND le.Item = 'Term'
          AND lev.Culture = @Culture;

    SELECT @DrawBacked = lev.[Value]
    FROM CFG.LocalizeEnum le
        JOIN CFG.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'CheqeStateInPayment'
          AND le.Item = 'DrawBacked'
          AND lev.Culture = @Culture;

    SELECT @Cashed = lev.[Value]
    FROM CFG.LocalizeEnum le
        JOIN CFG.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'Others'
          AND le.Item = 'Cashed'
          AND lev.Culture = @Culture;

    SELECT @Revoked = lev.[Value]
    FROM CFG.LocalizeEnum le
        JOIN CFG.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'StatusOfReceipt'
          AND le.Item = 'Revoke'
          AND lev.Culture = @Culture;
          
          	SELECT * INTO #vwBranchAccess
FROM cfg.vwBranchAccess AS vba	

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

    DECLARE @BaseCurrencyPrecision INT;
    SET @BaseCurrencyPrecision = CFG.GetBaseCurrencyPrecision();

    SELECT pc.PaymentCheqeID,
           pc.PaymentReceiptID,
           pc.Number,
           pr.[Date] AS PaymentDate,
           CFG.GetCLRSaturnDate(pr.[Date], @DateFormat, 0, @DateType) Date_PaymentDate,
           CFG.GetCLRSaturnDate(pc.[Date], @DateFormat, 0, @DateType) Date_Date,
           pc.[Date],
           dl.Code BankAccountCode,
           CASE
               WHEN @CultureNo = 1 THEN
                   dl.Title
               WHEN @CultureNo = 2 THEN
                   dl.Title2
           END AS BankAccountTitle,
           CASE
               WHEN @CultureNo = 1 THEN
                   cu.Title
               WHEN @CultureNo = 2 THEN
                   cu.Title2
           END AS CurrencyTitle,
           cu.ExchangeUnit,
           pc.CurrencyRate,
           pc.Amount,
           CASE
               WHEN cu.IsBaseCurrencyBasis = 0 THEN
                   ROUND(pc.Amount * pc.CurrencyRate / cu.ExchangeUnit, @BaseCurrencyPrecision)
               WHEN cu.IsBaseCurrencyBasis = 1 THEN
                   ROUND(pc.Amount * cu.ExchangeUnit / pc.CurrencyRate, @BaseCurrencyPrecision)
           END AS AmountInBaseCurrency,
           pct.Today,
           CASE
			   WHEN pr.Status = 2 then @Revoked
               WHEN pc.LastState = 0 AND pct.Today = 1 THEN
                   @TodayCheqe
               WHEN pc.LastState = 0 AND pct.Today = 0 THEN
                   @Cashed
               WHEN pc.LastState = 1 THEN
                   @Term
               WHEN pc.LastState = 2 THEN
                   @DrawBacked
           END LastState,
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
           pc.[Description],
           pc.Description2
    FROM FIN.PaymentCheqe pc
        JOIN FIN.PaymentCheqeType pct
            ON pct.PaymentCheqeTypeID = pc.PaymentCheqeTypeID
        JOIN FIN.PaymentReceipt pr
            ON pc.PaymentReceiptID = pr.PaymentReceiptID
        JOIN CFG.BankAccount ba
            ON pc.BankAccountID = ba.BankAccountID
        JOIN ACC.DL dl
            ON ba.DlID = dl.DLID
        JOIN CFG.Currency cu
            ON pc.CurrencyID = cu.CurrencyID
        JOIN CFG.Branch b
            ON pr.BranchID = b.BranchID
        JOIN #Parties p
            ON pr.PartyID = p.PartyID
        LEFT JOIN FIN.CheqeBook cb
            ON pc.CheqeBookID = cb.CheqeBookID
         INNER JOIN #vwBranchAccess AS vba ON vba.BranchID = pr.BranchID   
         
    WHERE (
              (
                  @LastState_TodayCheqe = 1
                  AND
                  (
                      pc.LastState = 0
                      AND pct.Today = 1
					  and pr.Status <> 2
                  )
              )
              OR
              (
                  @LastState_Cashed = 1
                  AND
                  (
                      pc.LastState = 0
                      AND pct.Today = 0
					  and pr.Status <> 2
                  )
              )
              OR
              (
                  @LastState_Term = 1
                  AND pc.LastState = 1
				  and pr.Status <> 2
				  AND pct.Today = 0
              )
              OR
              (
                  @LastState_DrawBacked = 1
                  AND pc.LastState = 2
				  and pr.Status <> 2
              )
              OR
              (
                  @Canceled = 1
                  AND pr.Status = 2
              )
          )
          AND
          (
              @FromDate IS NULL
              OR pc.[Date] >= @FromDate
          )
          AND
          (
              @ToDate IS NULL
              OR pc.[Date] <= @ToDate
          )
	 
    ORDER BY pc.PaymentCheqeID;

    DROP TABLE #Parties;

END;
