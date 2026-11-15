
CREATE    PROC [FIN].RPT_LiquidityPerspective_Detail
(
    @ToDate DATE,
    @SelectedBranches VARCHAR(250) = NULL,
    @Analysis VARCHAR(MAX) = NULL
)
--WITH ENCRYPTION
AS
BEGIN
    SELECT [CFG].[GetStringPartBySpliter](value, 1, '*') BranchID,
           [CFG].[GetStringPartBySpliter](value, 2, '*') Date
    INTO #Analysis_Source
    FROM CFG.Split(@Analysis, '|');


    DECLARE @DateType VARCHAR(10),
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

        select * into #vwBranchAccess
        from cfg.vwBranchAccess




    IF EXISTS
    (
        SELECT 1
        FROM #Analysis_Source
        WHERE Date = CAST(GETDATE() AS DATE)
    )
        SELECT CASE
                   WHEN Type = 'ReceivedCheqe' THEN
                       N'چک دریافتی'
                   WHEN Type = 'ReceivedInstallment' THEN
                       N'اقساط دریافتنی'
                   WHEN Type = 'PaymentCheqe' THEN
                       N'چک پرداختی'
                   WHEN Type = 'PaymentInstallment' THEN
                       N'اقساط پرداختی'
               END Type,
               a.Date,
               CFG.GetCLRSaturnDate(a.Date, @DateFormat, 0, @DateType) Date_Date,
               Amount,
               DlCode,
               CASE
                   WHEN @CultureNo = 1 THEN
                       DlTitle
                   WHEN @CultureNo = 2 THEN
                       DlTitle2
               END AS DlTitle,
               BranchCode,
               CASE
                   WHEN @CultureNo = 1 THEN
                       BranchTitle
                   WHEN @CultureNo = 2 THEN
                       BranchTitle2
               END AS BranchTitle,
               a.BranchID,
               Number
        FROM FIN.VWLiquidityPerspective a
        join #vwBranchAccess vba on a.BranchID = vba.BranchID
            LEFT JOIN #Analysis_Source b
                ON a.BranchID = b.BranchID
                   AND a.Date <= b.Date
                   INNER JOIN cfg.vwFinancialPeriodAccess AS vfpa ON vfpa.FinancialPeriodID = a.FinancialPeriodID
        WHERE (
                  @SelectedBranches IS NULL
                  OR a.BranchID IN
                     (
                         SELECT value FROM CFG.R_FnCommaStr2Table(@SelectedBranches)
                     )
              )
              AND
              (
                  @Analysis IS NULL
                  OR b.BranchID IS NOT NULL
              );

    ELSE
        SELECT CASE
                   WHEN Type = 'ReceivedCheqe' THEN
                       N'چک دریافتی'
                   WHEN Type = 'ReceivedInstallment' THEN
                       N'اقساط دریافتنی'
                   WHEN Type = 'PaymentCheqe' THEN
                       N'چک پرداختی'
                   WHEN Type = 'PaymentInstallment' THEN
                       N'اقساط پرداختی'
               END Type,
               a.Date,
               CFG.GetCLRSaturnDate(a.Date, @DateFormat, 0, @DateType) Date_Date,
               Amount,
               DlCode,
               CASE
                   WHEN @CultureNo = 1 THEN
                       DlTitle
                   WHEN @CultureNo = 2 THEN
                       DlTitle2
               END AS DlTitle,
               BranchCode,
               CASE
                   WHEN @CultureNo = 1 THEN
                       BranchTitle
                   WHEN @CultureNo = 2 THEN
                       BranchTitle2
               END AS BranchTitle,
               a.BranchID,
               Number
        FROM FIN.VWLiquidityPerspective a
        join #vwBranchAccess vba on a.BranchID = vba.BranchID
            LEFT JOIN #Analysis_Source b
                ON a.BranchID = b.BranchID
                   AND a.Date = b.Date --and a.date between GETDATE() and  b.date
                   INNER JOIN cfg.vwFinancialPeriodAccess AS vfpa ON vfpa.FinancialPeriodID = a.FinancialPeriodID
        WHERE (
                  @SelectedBranches IS NULL
                  OR a.BranchID IN
                     (
                         SELECT value FROM CFG.R_FnCommaStr2Table(@SelectedBranches)
                     )
              )
              AND
              (
                  @Analysis IS NULL
                  OR b.BranchID IS NOT NULL
              );

END;
