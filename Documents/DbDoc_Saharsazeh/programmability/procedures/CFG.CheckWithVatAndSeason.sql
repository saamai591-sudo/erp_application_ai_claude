CREATE     PROCEDURE [CFG].[CheckWithVatAndSeason]
(
    @Date DATE,
    @FinancialPeriodId INT,
    @CompanyId INT=NULL
)
--WITH ENCRYPTION
AS
BEGIN

    DECLARE @maxDate DATE;
    SELECT @maxDate = MAX(EndDate)
    FROM CFG.Vat v
	WHERE v.FinancialPeriodID = @FinancialPeriodId
    AND (@CompanyId IS NULL OR v.CompanyID = @CompanyId);

    IF @maxDate IS NOT NULL
       AND @maxDate >= @Date
    BEGIN
        DECLARE @Message NVARCHAR(MAX);
        SELECT @Message = N'VatHasPublished';
        RAISERROR(@Message, 16, 12);
    END;

    DECLARE @MaxSeason INT;

    SELECT @MaxSeason = MAX(sf.Season)
    FROM CFG.SeasonFile AS sf
    WHERE sf.FinancialPeriodID = @FinancialPeriodId AND (CompanyID IS NULL OR sf.CompanyID = @CompanyId);

    IF @MaxSeason IS NOT NULL
    BEGIN
        DECLARE @PersianCalendarYear INT;
        SELECT @PersianCalendarYear = dd.PersianCalendarYear
        FROM CFG.FinancialPeriod AS fp
            INNER JOIN CFG.DimDate AS dd
                ON fp.StartDate = dd.[Date]
        WHERE fp.FinancialPeriodID = @FinancialPeriodId;


        SELECT @maxDate = MAX(Date)
        FROM CFG.DimDate AS dd
        WHERE dd.PersianMonthNumberOfYear = @MaxSeason * 3
              AND dd.PersianCalendarYear = @PersianCalendarYear;


        IF @maxDate IS NOT NULL
           AND @maxDate >= @Date
        BEGIN
            RAISERROR(N'با توجه به تاریخ خرید و فروش فصلی امکان انجام عملیات نمی باشد', 16, 12);
        END;
    END;

    DECLARE @MaxVatDate DATETIME;

    SELECT @MaxVatDate=MAX(v.EndDate)
    FROM CFG.Vat AS v
    WHERE v.FinancialPeriodID=@FinancialPeriodId AND (CompanyID is NULL OR v.CompanyID=@CompanyId)

        IF @MaxSeason IS NOT NULL
        BEGIN
            IF @MaxVatDate>=@Date
                RAISERROR(N'با توجه به تاریخ ارزش افزوده امکان انجام عملیات نمی باشد', 16, 12);
        END
END;
