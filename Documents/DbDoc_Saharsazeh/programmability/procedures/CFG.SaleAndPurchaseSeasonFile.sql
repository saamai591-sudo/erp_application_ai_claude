
---------------------------------------------------------
CREATE    PROC [CFG].SaleAndPurchaseSeasonFile
    @fromDate DATE,
    @toDate DATE,
    @FinancialPeriod INT,
    @CompanyId INT,
    @returnError BIT = 0
--WITH ENCRYPTION
AS
set NOCOUNT ON
BEGIN
    DECLARE @Season TINYINT,
            @baseCurrenncyPercisionCount INT,
            @DateInPurchaseDocuments INT;

    SELECT @baseCurrenncyPercisionCount = c.PrecisionCount
    FROM CFG.Currency AS c
    WHERE c.CurrencyID = -1;

    SELECT @DateInPurchaseDocuments = c.ConfigValue
    FROM CFG.Configuration AS c
    WHERE c.ConfigKey = 'DateInPurchaseDocuments';

    IF EXISTS
    (
        SELECT 1
        FROM CFG.SeasonFile AS sf
        WHERE (@fromDate BETWEEN sf.StartDate AND sf.FinishDate
              OR @toDate BETWEEN sf.StartDate AND sf.FinishDate)
              and sf.CompanyID = @CompanyId

    )
    BEGIN
        RAISERROR(N'برای بازه انتخاب شده اطلاعات وجود دارد.', 16, 12);
        RETURN;
    END;


    SELECT DISTINCT
           dd2.PersianCalendarSeason
    INTO #seasons
    FROM CFG.DimDate AS dd2
    WHERE dd2.FullDateAlternateKey
    BETWEEN @fromDate AND @toDate;

    IF
    (
        SELECT COUNT(*)FROM #seasons
    ) > 1
    BEGIN
        RAISERROR(N'بازه انتخاب شده شامل چند فصل می باشد.', 16, 12);
        RETURN;
    END;

    DECLARE @dateFinancialPeriod INT;

    SELECT TOP (1)
           @dateFinancialPeriod = fp.FinancialPeriodID
    FROM CFG.FinancialPeriod AS fp
    WHERE @fromDate
          BETWEEN fp.StartDate AND fp.EndDate
          AND @toDate
          BETWEEN fp.StartDate AND fp.EndDate;

    IF (
           @dateFinancialPeriod IS NULL
           OR @dateFinancialPeriod <> @FinancialPeriod
       )
    BEGIN
        RAISERROR(N'دوره مالی بازه انتخاب شده را چک نمایید', 16, 12);
        RETURN;
    END;

    SELECT TOP (1)
           @Season = s.PersianCalendarSeason
    FROM #seasons AS s;

    BEGIN TRY
        DECLARE @Month VARCHAR(50),
                @CurrentDate DATETIME,
                @User INT,
                @UserID INT,
                @Culture NVARCHAR(5),
                @CultureNo TINYINT;


        SET @CurrentDate = GETDATE();
        SET @User = CFG.GetuserID();
        SET @UserID = CFG.GetuserID();

        SET @Culture = CFG.GetuserCulture();

        SELECT @CultureNo = CultureNo
        FROM CFG.CultureInfo
        WHERE Culture = @Culture;

        IF (@Season = 1)
            SET @Month = '01,02,03';

        IF (@Season = 2)
            SET @Month = '04,05,06';

        IF (@Season = 3)
            SET @Month = '07,08,09';

        IF (@Season = 4)
            SET @Month = '10,11,12';

        SELECT ecfd.EntityID,
               ldi.Code AS [Value]
        INTO #HCType1Code
        FROM CFG.EntityCustomeField AS ecf
            INNER JOIN CFG.EntityCustomeFieldData AS ecfd
                ON ecfd.EntityCustomeFieldID = ecf.EntityCustomeFieldID
            INNER JOIN CFG.LookupDataItem AS ldi
                ON ldi.LookupDataItemID = ecfd.LookupDataItemID
        WHERE ecf.EntityName = 'party'
              AND ecf.FieldName = 'HCType1Code';

        SELECT ecfd.EntityID,
               ldi.Code AS [Value]
        INTO #HCForoushandeType1Code
        FROM CFG.EntityCustomeField AS ecf
            INNER JOIN CFG.EntityCustomeFieldData AS ecfd
                ON ecfd.EntityCustomeFieldID = ecf.EntityCustomeFieldID
            INNER JOIN CFG.LookupDataItem AS ldi
                ON ldi.LookupDataItemID = ecfd.LookupDataItemID
        WHERE ecf.EntityName = 'party'
              AND ecf.FieldName = 'HCForoushandeType1Code';

        SELECT ecfd.EntityID,
               ldi.Code AS [Value]
        INTO #ArzType
        FROM CFG.EntityCustomeField AS ecf
            INNER JOIN CFG.EntityCustomeFieldData AS ecfd
                ON ecfd.EntityCustomeFieldID = ecf.EntityCustomeFieldID
            INNER JOIN CFG.LookupDataItem AS ldi
                ON ldi.LookupDataItemID = ecfd.LookupDataItemID
        WHERE ecf.EntityName = 'Currency'
              AND ecf.FieldName = 'ArzType';

        SELECT ecfd.EntityID,
               ldi.Code AS [Value]
        INTO #KalaType
        FROM CFG.EntityCustomeField AS ecf
            INNER JOIN CFG.EntityCustomeFieldData AS ecfd
                ON ecfd.EntityCustomeFieldID = ecf.EntityCustomeFieldID
            INNER JOIN CFG.LookupDataItem AS ldi
                ON ldi.LookupDataItemID = ecfd.LookupDataItemID
        WHERE ecf.EntityName IN ( 'Stuff', 'Service', 'StoreProduction' )
              AND ecf.FieldName = 'KalaType';

        --** DOCType = 1 فروشهاي داراي کد ملي يا شناسه ملي يا کد اقتصادي
        --** DOCType = 2 برگشت فروشهاي داراي کد ملي يا شناسه ملي يا کد اقتصادي
        --** DOCType = 3 خريد
        --** DOCType = 4 برگشت خريد
        --** DOCType = 5 فروشهاي فاقد کد ملي يا شناسه ملي يا کد اقتصادي
        --** DOCType = 6 برگشت فروشهاي فاقد کد ملي يا شناسه ملي يا کد اقتصادي
        --** DOCType = 7 خریدهائی که از طریق سفارشات خارجی انجام می شوند
        --** DOCType = 8 خریدهائی که وارداتی بوده ولی بر مبنای ترخیص نمی باشند
        --** DOCType = 9 تایید مالی - پیمانکار
        --** DOCType = 10 تایید مالی - کارفرما

        CREATE TABLE #PartyType
        (
            RealType TINYINT,
            MapType TINYINT
        );

        INSERT INTO #PartyType
        SELECT 0,
               0;

        INSERT INTO #PartyType
        SELECT 1,
               1;

        INSERT INTO #PartyType
        SELECT 2,
               1;

        SELECT T.StuffID,
               T.Number
        INTO #UsedStuf
        FROM
        (
            SELECT pii.StuffID,
                   i.Date,
                   i.Number AS Number
            FROM POS.PosInvoice AS i
                INNER JOIN POS.PosInvoiceItem AS pii
                    ON pii.PosInvoiceID = i.PosInvoiceID
                JOIN POS.StationShift AS SS on ss.StationShiftID=i.StateShiftID
                join POS.Station as s on s.StationID=ss.StationID
                join CFG.Branch as b on b.BranchID=s.BranchID
            join CFG.vwCompanyAccess as vwca 
                on vwca.CompanyID=b.CompanyID
            WHERE i.FinancialPeriodID = @FinancialPeriod
                  and b.CompanyID=@CompanyId
                  and vwca.UserID=@UserID
				  and i.Date between @fromDate and @toDate
            UNION
            SELECT ii.StuffID,
                   i.Date,
                   i.Number AS Number
            FROM SLE.Invoice AS i
                join CFG.Branch as b on b.BranchID=i.BranchID
            join CFG.vwCompanyAccess as vwca 
                on vwca.CompanyID=b.CompanyID
                JOIN SLE.InvoiceItem AS ii
                    ON ii.InvoiceID = i.InvoiceID
                JOIN SLE.SaleType AS st
                    ON st.SaleTypeID = i.SaleTypeID
            WHERE st.Type = 1
                  AND i.FinancialPeriodID = @FinancialPeriod
                  and b.CompanyID=@CompanyId
                  and vwca.UserID=@UserID
				  and i.Date between @fromDate and @toDate
            UNION
            SELECT rsii.StuffID,
                   i.Date,
                   i.Number AS Number
            FROM SLE.ReturnedSaleInvoice AS i
                JOIN SLE.ReturnedSaleInvoiceItem AS rsii
                    ON rsii.ReturnedSaleInvoiceID = i.ReturnedSaleInvoiceID
                JOIN SLE.SaleType AS st2
                    ON st2.SaleTypeID = i.SaleTypeID
                join CFG.Branch as b
                    on b.BranchID=i.BranchID
            join CFG.vwCompanyAccess as vwca 
                on vwca.CompanyID=b.CompanyID
            WHERE st2.Type = 1
                  AND i.FinancialPeriodID = @FinancialPeriod
                  and b.CompanyID=@CompanyId
                  and vwca.UserID=@UserID
				  and i.Date between @fromDate and @toDate
            UNION
            SELECT pii.StuffID,
                   i.Date,
                   i.Number AS Number
            FROM VND.PurchaseInvoice AS i
                INNER JOIN CFG.Party AS p
                    ON p.DlID = i.DlID
                INNER JOIN VND.PurchaseType AS pt
                    ON pt.PurchaseTypeID = i.[Type]
                JOIN VND.PurchaseInvoiceItem AS pii
                    ON pii.PurchaseInvoiceID = i.PurchaseInvoiceID
                join CFG.Branch as b
                    on b.BranchID=i.BranchID
            join CFG.vwCompanyAccess as vwca 
                on vwca.CompanyID=b.CompanyID
            WHERE i.FinancialPeriodID = @FinancialPeriod
                   and b.CompanyID=@CompanyId
                   and vwca.UserID=@UserID
				   and i.Date between @fromDate and @toDate
            UNION
            SELECT rii.StuffID,
                   i.Date,
                   i.Number AS Number
            FROM VND.ReturnInvoice AS i
                JOIN VND.ReturnInvoiceItem AS rii
                    ON rii.ReturnInvoiceID = i.ReturnInvoiceID
                INNER JOIN CFG.Party AS p
                    ON p.DlID = i.DlID
                INNER JOIN VND.PurchaseType AS pt
                    ON pt.PurchaseTypeID = i.[Type]
                join CFG.Branch as b
                    on b.BranchID=i.BranchID
            join CFG.vwCompanyAccess as vwca 
                on vwca.CompanyID=b.CompanyID
            WHERE pt.[Type] = 0
                  AND i.FinancialPeriodID = @FinancialPeriod
                  and b.CompanyID=@CompanyId
                  and vwca.UserID=@UserID
				  and i.Date between @fromDate and @toDate
        ) T
            INNER JOIN CFG.DimDate AS dd
                ON dd.[Date] = T.[Date]
        WHERE dd.PersianMonthNumberOfYear IN
              (
                  SELECT value FROM CFG.R_FnCommaStr2Table(@Month)
              );

        IF EXISTS
        (
            SELECT 1
            FROM #UsedStuf AS us
                LEFT JOIN #KalaType
                    ON us.StuffID = EntityID
            WHERE EntityID IS NULL
        )
        BEGIN
            IF @returnError = 1
            BEGIN
                SELECT distinct s.Code,
                       CASE @CultureNo
                           WHEN 1 THEN
                               s.Title
                           WHEN 2 THEN
                               s.Title2
                       END
                FROM #UsedStuf AS us
                    INNER JOIN STF.[Stuff] AS s
                        ON s.StuffID = us.StuffID
                    LEFT JOIN #KalaType
                        ON us.StuffID = EntityID
                WHERE EntityID IS NULL;

                RETURN;
            END;
            ELSE
            BEGIN
                RAISERROR('E_برای برخی از کالاها نوع کالا یا خدمت  مشخص نشده است', 16, 12);
                RETURN;
            END;
        END;


        IF EXISTS (SELECT 1 FROM #UsedStuf AS us WHERE LEN(us.Number) > 50)
        BEGIN
            IF @returnError = 1
            BEGIN
                SELECT  distinct us.Number
                FROM #UsedStuf AS us
                WHERE LEN(us.Number) > 50;

                RETURN;
            END;
            ELSE
            BEGIN
                RAISERROR('E_طول شماره فاکتور خرید بیشتر از مقدا مجاز است', 16, 12);
                RETURN;
            END;
        END;

        SELECT T.CustomerID AS PartyID,
               T.FinancialPeriodID,
               T.Type,
               T.HCType1Code,
               T.HCForoushandeType1Code,
               T.date,
               T.addressId,
               T.CurrencyID
        INTO #parties
        FROM CFG.vwSaleAndPurchaseParty AS T
		    JOIN cfg.Branch b on b.BranchID = T.BranchID
        WHERE b.CompanyID = @CompanyId
		    AND T.date BETWEEN @fromDate AND @toDate;

        --برای برخی از ارزها معادل خرید و فروش فصلی مشخص نشده است
        IF EXISTS
        (
            SELECT 1
            FROM #parties sp
                LEFT JOIN #ArzType at
                    ON sp.CurrencyID = at.EntityID
            WHERE at.Value IS NULL
                  AND sp.CurrencyID <> -1
        )
        BEGIN
            IF @returnError = 1
            BEGIN
                SELECT DISTINCT
                       CASE @CultureNo
                           WHEN 1 THEN
                               p.Title
                           WHEN 2 THEN
                               p.Title2
                       END
                FROM #parties
                    LEFT JOIN #ArzType
                        ON #parties.CurrencyID = EntityID
                    INNER JOIN CFG.Currency AS p
                        ON #parties.CurrencyID = p.CurrencyID
                WHERE Value IS NULL
                      AND #parties.CurrencyID <> -1;

                RETURN;
            END;
            ELSE
            BEGIN
                RAISERROR('E_برای برخی از ارزها معادل خرید و فروش فصلی مشخص نشده است', 16, 12);
                RETURN;
            END;
        END;

        -- برای برخی از افراد نوع فروشنده مشخص نشده است
        IF EXISTS
        (
            SELECT 1
            FROM #parties
            WHERE [Type] IN ( 'Sale', 'AccumulatedSale' )
                  AND HCType1Code IS NULL
        )
        BEGIN
            IF @returnError = 1
            BEGIN
                SELECT DISTINCT
                       p.PartyID,
                       CASE @CultureNo
                           WHEN 1 THEN
                               p.Title
                           WHEN 2 THEN
                               p.Title2
                       END,
                       CASE @CultureNo
                           WHEN 1 THEN
                               p.LastName
                           WHEN 2 THEN
                               p.LastName2
                       END,
                       d.Code
                FROM #parties sp
                    INNER JOIN CFG.Party AS p
                        ON sp.PartyID = p.PartyID
                    INNER JOIN ACC.DL AS d
                        ON d.DLID = p.DlID
                WHERE sp.[Type] IN ( 'Sale', 'AccumulatedSale' )
                      AND sp.HCType1Code IS NULL;

                RETURN;
            END;
            ELSE
            BEGIN
                RAISERROR('E_برای برخی از افراد نوع فروشنده مشخص نشده است', 16, 12);
                RETURN;
            END;
        END;

        --برای برخی از افراد نوع تامین کننده مشخص نشده است
        IF EXISTS
        (
            SELECT 1
            FROM #parties
            WHERE [Type] IN ( N'Purchase', N'AccumulatedPurchase', N'ConfirmStatement' )
                  AND HCForoushandeType1Code IS NULL
        )
        BEGIN
            IF @returnError = 1
            BEGIN
                SELECT DISTINCT
                       p.PartyID,
                       CASE @CultureNo
                           WHEN 1 THEN
                               p.Title
                           WHEN 2 THEN
                               p.Title2
                       END,
                       CASE @CultureNo
                           WHEN 1 THEN
                               p.LastName
                           WHEN 2 THEN
                               p.LastName2
                       END,
                       d.Code
                FROM #parties sp
                    INNER JOIN CFG.Party AS p
                        ON sp.PartyID = p.PartyID
                    INNER JOIN ACC.DL AS d
                        ON d.DLID = p.DlID
                WHERE sp.[Type] IN ( N'Purchase', N'AccumulatedPurchase', N'ConfirmStatement' )
                      AND sp.HCForoushandeType1Code IS NULL;

                RETURN;
            END;
            ELSE
            BEGIN
                RAISERROR('E_برای برخی از افراد نوع تامین کننده مشخص نشده است', 16, 12);
                RETURN;
            END;
        END;

        --بررسی کد پستی
        IF EXISTS
        (
            SELECT 1
            FROM #parties
                JOIN CFG.FULLAddressForAllParties() AS fafap
                    ON fafap.AddressID = #parties.addressId
            WHERE ISNULL(fafap.ZipCode, '') <> ''
                  AND LEN(fafap.ZipCode) <> 10
        )
        BEGIN
            IF @returnError = 1
            BEGIN
                SELECT DISTINCT
                       p.PartyID,
                       CASE @CultureNo
                           WHEN 1 THEN
                               p.Title
                           WHEN 2 THEN
                               p.Title2
                       END,
                       CASE @CultureNo
                           WHEN 1 THEN
                               p.LastName
                           WHEN 2 THEN
                               p.LastName2
                       END,
                       d.Code
                FROM #parties sp
                    INNER JOIN CFG.Party AS p
                        ON sp.PartyID = p.PartyID
                    INNER JOIN ACC.DL AS d
                        ON d.DLID = p.DlID
                    JOIN CFG.FULLAddressForAllParties() AS fafap
                        ON fafap.AddressID = sp.addressId
                WHERE ISNULL(fafap.ZipCode, '') <> ''
                      AND LEN(fafap.ZipCode) <> 10;

                RETURN;
            END;
            ELSE
            BEGIN
                RAISERROR('E_برای برخی از افراد طول کد پستی بیشتر از طول مجاز می باشد', 16, 12);
                RETURN;
            END;
        END;

        --بررسی شهر و استان
        IF EXISTS
        (
            SELECT 1
            FROM #parties
                JOIN CFG.FULLAddressForAllParties() AS fafap
                    ON fafap.AddressID = #parties.addressId
            WHERE ISNULL(fafap.cityMinistryCode, '') = ''
                  OR ISNULL(fafap.provinceMinistryCode, '') = ''
        )
        BEGIN
            IF @returnError = 1
            BEGIN
                SELECT DISTINCT
                       p.PartyID,
                       CASE @CultureNo
                           WHEN 1 THEN
                               p.Title
                           WHEN 2 THEN
                               p.Title2
                       END,
                       CASE @CultureNo
                           WHEN 1 THEN
                               p.LastName
                           WHEN 2 THEN
                               p.LastName2
                       END,
                       d.Code
                FROM #parties sp
                    INNER JOIN CFG.Party AS p
                        ON sp.PartyID = p.PartyID
                    INNER JOIN ACC.DL AS d
                        ON d.DLID = p.DlID
                    JOIN CFG.FULLAddressForAllParties() AS fafap
                        ON fafap.AddressID = sp.addressId
                WHERE ISNULL(fafap.cityMinistryCode, '') = ''
                      OR ISNULL(fafap.provinceMinistryCode, '') = '';

                RETURN;
            END;
            ELSE
            BEGIN
                RAISERROR('E_برای برخی از افراد کد شهر یا استان تعریف نشده است', 16, 12);
                RETURN;
            END;
        END;

        IF EXISTS
        (
            SELECT 1
            FROM #parties AS p2
                INNER JOIN CFG.Party AS p
                    ON p.PartyID = p2.PartyID
                INNER JOIN #PartyType AS pt
                    ON p.[Type] = pt.RealType
                LEFT JOIN CFG.VwAddress AS a
                    ON a.PartyID = p.PartyID
            WHERE (
                      p2.HCType1Code = 5
                      OR p2.HCForoushandeType1Code = 5
                  )
                  AND p2.FinancialPeriodID = @FinancialPeriod
                  AND
                  (
                      (
                          pt.RealType = 0
                          AND
                          (
                              p.LastName IS NULL
                              OR p.Title IS NULL
                          )
                      )
                      OR
                      (
                          pt.RealType = 1
                          AND (p.Title IS NULL)
                      )
                      OR
                      (
                          pt.RealType = 0
                          AND p.IdentificationCode IS NULL
                          AND p.EconomicCode IS NULL
                          AND p.FidaCode IS NULL
                      )
                      OR
                      (
                          pt.RealType = 1
                          AND p.NationalID IS NULL
                          AND p.EconomicCode IS NULL
                          AND p.FidaIdCode IS NULL
                      )
                      OR a.AddressID IS NULL
                      OR a.country IS NULL
                      OR a.city IS NULL
                  )
        )
        BEGIN
            IF @returnError = 1
            BEGIN
                SELECT DISTINCT
                       p.PartyID,
                       CASE @CultureNo
                           WHEN 1 THEN
                               p.Title
                           WHEN 2 THEN
                               p.Title2
                       END,
                       CASE @CultureNo
                           WHEN 1 THEN
                               p.LastName
                           WHEN 2 THEN
                               p.LastName2
                       END,
                       d.Code,
                       a.city,
                       a.country,
                       p.IdentificationCode,
                       p.EconomicCode,
                       p.NationalID
                FROM #parties AS p2
                    INNER JOIN CFG.Party AS p
                        ON p.PartyID = p2.PartyID
                    INNER JOIN ACC.DL AS d
                        ON d.DLID = p.DlID
                    INNER JOIN #PartyType AS pt
                        ON p.[Type] = pt.RealType
                    LEFT JOIN CFG.VwAddress AS a
                        ON a.PartyID = p.PartyID
                WHERE (
                          p2.HCType1Code = 5
                          OR p2.HCForoushandeType1Code = 5
                      )
                      AND p2.FinancialPeriodID = @FinancialPeriod
                      AND
                      (
                          (
                              pt.RealType = 0
                              AND
                              (
                                  p.LastName IS NULL
                                  OR p.Title IS NULL
                              )
                          )
                          OR
                          (
                              pt.RealType = 1
                              AND (p.Title IS NULL)
                          )
                          OR
                          (
                              pt.RealType = 0
                              AND p.IdentificationCode IS NULL
                              AND p.EconomicCode IS NULL
                              AND p.FidaCode IS NULL
                          )
                          OR
                          (
                              pt.RealType = 1
                              AND p.NationalID IS NULL
                              AND p.EconomicCode IS NULL
                              AND p.FidaIdCode IS NULL
                          )
                          OR a.AddressID IS NULL
                          OR a.country IS NULL
                          OR a.city IS NULL
                      );

                RETURN;
            END;
            ELSE
            BEGIN
                RAISERROR('E_برای برخی از افراد اطلاعات کامل نمی باشد', 16, 12);
                RETURN;
            END;
        END;

        IF @returnError = 1
            RETURN;

        --- POS_INVOICE  6-7-8---
        INSERT INTO [CFG].[SeasonFile]
        (
            [FinancialPeriodID],
            [Season],
            [AutoGenerated],
            [DOCType],
            [DocName],
            [ID],
            [StuffTitle],
            [LessThanQuorum],
            [Amount],
            [Tax],
            [Duty],
            [Discount],
            [PartyFirstName],
            [PartyLastName],
            [EconomicCode],
            [NationalID],
            [HCType1Code],
            [provinceCode],
            [cityCode],
            [Type],
            [Number],
            [Date],
            [TradeType],
            [Version],
            [Creator],
            [CreationDate],
            [LastEditor],
            [LastEditionDate],
            ArzType,
            Arz_Price,
            Arz_MaliatArzeshAfzoodeh,
            Arz_AvarezArzeshAfzoodeh,
            Arz_SayerAvarez,
            Arz_TakhfifPrice,
            ArzBarabari_Price,
            ArzBarabari_MaliatArzeshAfzoodeh,
            ArzBarabari_AvarezArzeshAfzoodeh,
            ArzBarabari_SayerAvarez,
            ArzBarabari_TakhfifPrice,
            FactorNo,
            FactorDate,
            SarFaslType,
            BranchCode,
            BranchTitle,
            IsArzi,
            KalaType,
            SaleTypeTitle,
            StartDate,
            FinishDate,
            CompanyID
        )
        SELECT @FinancialPeriod,
               @Season,
               1,
               1 DOCType,
               'PosInvoice',
               0 ID,
               '' StuffTitle,
               1,
               ISNULL((i.TotalPrice), 0) Amount,
               ISNULL(i.TotalTax, 0) + ISNULL(i.TotalDuty, 0) Tax,
               0 Duty,
               ISNULL(i.TotalDiscount, 0) ,
               '' PartyFirstName,
               '' PartyLastName,
               '' AS EconomicCode,
               '' NationalID,
               hc.Value HCKharidarType1Code,
               '' provinceCode,
               '' cityCode,
               1,
               i.Number,
               CFG.GetCLRSaturnDate(i.Date, 'YYYY/MM/DD', 0, 0) [Date],
               CAST(CASE
                        WHEN MapType = 0 THEN
                            1
                        ELSE
                            2
                    END AS TINYINT) AS TradeType,
               0,
               @User,
               @CurrentDate,
               @User,
               @CurrentDate,
               NULL,
               NULL,
               NULL,
               NULL,
               0,
               NULL,
               NULL,
               NULL,
               NULL,
               NULL,
               NULL,
               NULL, -- 0,
               NULL, -- CFG.GetCLRSaturnDate(GETDATE(), 'YYYY/MM/DD', 0, 0),
               0,
               b.Code,
               CASE @CultureNo
                   WHEN 1 THEN
                       b.Title
                   WHEN 2 THEN
                       b.Title2
               END AS BranchTitle,
               0,
               12,
               N'فروش فروشگاهی',
               @fromDate,
               @toDate,
               @CompanyId
        FROM POS.PosInvoice i
            join POS.StationShift as ss 
                on i.StateShiftID=ss.StationShiftID
            join POS.Station as s 
                on s.StationID=ss.StationID
            join CFG.Branch as b
                on b.BranchID=s.BranchID
            join CFG.vwCompanyAccess as vwca 
                on vwca.CompanyID=b.CompanyID
            JOIN CFG.Party p
                ON p.PartyID = i.CustomerID
            JOIN #PartyType
                ON RealType = p.Type
            LEFT JOIN #HCType1Code AS hc
                ON hc.EntityID = p.PartyID
        WHERE i.IsReturnInvoice = 0
              AND hc.Value IN ( 6, 7, 8 )
              AND i.Date
              BETWEEN @fromDate AND @toDate
              AND i.FinancialPeriodID = @FinancialPeriod
              AND i.Status = 1
              and b.CompanyID=@CompanyId
              and vwca.UserID=@UserID

        ---RETUREN POS_INVOICE  6-7-8---
        INSERT INTO [CFG].[SeasonFile]
        (
            [FinancialPeriodID],
            [Season],
            [AutoGenerated],
            [DOCType],
            [DocName],
            [ID],
            [StuffTitle],
            [LessThanQuorum],
            [Amount],
            [Tax],
            [Duty],
            [Discount],
            [PartyFirstName],
            [PartyLastName],
            [EconomicCode],
            [NationalID],
            [HCType1Code],
            [provinceCode],
            [cityCode],
            [Type],
            [Number],
            [Date],
            [TradeType],
            [Version],
            [Creator],
            [CreationDate],
            [LastEditor],
            [LastEditionDate],
            ArzType,
            Arz_Price,
            Arz_MaliatArzeshAfzoodeh,
            Arz_AvarezArzeshAfzoodeh,
            Arz_SayerAvarez,
            Arz_TakhfifPrice,
            ArzBarabari_Price,
            ArzBarabari_MaliatArzeshAfzoodeh,
            ArzBarabari_AvarezArzeshAfzoodeh,
            ArzBarabari_SayerAvarez,
            ArzBarabari_TakhfifPrice,
            FactorNo,
            FactorDate,
            SarFaslType,
            BranchCode,
            BranchTitle,
            IsArzi,
            KalaType,
            SaleTypeTitle,
            StartDate,
            FinishDate,
            CompanyID
        )
        SELECT @FinancialPeriod,
               @Season,
               1,
               2 DOCType,
               'PosInvoice',
               0 ID,
               '' StuffTitle,
               1,
               ISNULL(i.TotalPrice, 0),
               ISNULL(i.TotalTax, 0) + ISNULL(i.TotalDuty, 0),
               0 Duty,
               ISNULL(i.TotalDiscount, 0),
               '' PartyFirstName,
               '' PartyLastName,
               '' AS EconomicCode,
               '' NationalID,
               hc.Value HCKharidarType1Code,
               '' provinceCode,
               '' cityCode,
               1,
               i.Number,
               CFG.GetCLRSaturnDate(i.Date, 'YYYY/MM/DD', 0, 0) [Date],
               CAST(CASE
                        WHEN MapType = 0 THEN
                            1
                        ELSE
                            2
                    END AS TINYINT) AS TradeType,
               0,
               @User,
               @CurrentDate,
               @User,
               @CurrentDate,
               NULL,
               NULL,
               NULL,
               NULL,
               0,
               NULL,
               NULL,
               NULL,
               NULL,
               NULL,
               NULL,
               NULL, -- 0,
               NULL, -- CFG.GetCLRSaturnDate(GETDATE(), 'YYYY/MM/DD', 0, 0),
               0,
               b.Code,
               CASE @CultureNo
                   WHEN 1 THEN
                       b.Title
                   WHEN 2 THEN
                       b.Title2
               END AS BranchTitle,
               0,
               12,
               N'فروش فروشگاهی',
               @fromDate,
               @toDate,
               @CompanyId
        FROM POS.PosInvoice i
			join POS.StationShift as ss 
				on i.StateShiftID=ss.StationShiftID
			join POS.Station as s 
					on s.StationID=ss.StationID
            join CFG.Branch as b
                on b.BranchID=s.BranchID
            join CFG.vwCompanyAccess as vwca 
                on vwca.CompanyID=b.CompanyID
            JOIN CFG.Party p
                ON p.PartyID = i.CustomerID
            JOIN #PartyType
                ON RealType = p.Type
            LEFT JOIN #HCType1Code AS hc
                ON hc.EntityID = p.PartyID
        WHERE i.IsReturnInvoice = 1
              AND hc.Value IN ( 6, 7, 8 )
              AND i.Date
              BETWEEN @fromDate AND @toDate
              AND i.FinancialPeriodID = @FinancialPeriod
              AND i.Status = 1
              and b.CompanyID=@CompanyId
              and vwca.UserID=@UserID

        -------------------------POSINVOCIE_5
        INSERT INTO [CFG].[SeasonFile]
        (
            [FinancialPeriodID],
            [Season],
            [AutoGenerated],
            [DOCType],
            [DocName],
            [ID],
            [StuffTitle],
            [LessThanQuorum],
            [Amount],
            [Tax],
            [Duty],
            [Discount],
            [ZipCode],
            [PreNumberOfCity],
            [Phone],
            [Address],
            [PartyFirstName],
            [PartyLastName],
            [EconomicCode],
            [NationalID],
            [HCType1Code],
            [provinceCode],
            [cityCode],
            [Type],
            [Number],
            [Date],
            [TradeType],
            [BranchCode],
            [BranchTitle],
            [Version],
            [Creator],
            [CreationDate],
            [LastEditor],
            [LastEditionDate],
            ArzType,
            Arz_Price,
            Arz_MaliatArzeshAfzoodeh,
            Arz_AvarezArzeshAfzoodeh,
            Arz_SayerAvarez,
            Arz_TakhfifPrice,
            ArzBarabari_Price,
            ArzBarabari_MaliatArzeshAfzoodeh,
            ArzBarabari_AvarezArzeshAfzoodeh,
            ArzBarabari_SayerAvarez,
            ArzBarabari_TakhfifPrice,
            FactorNo,
            FactorDate,
            SarFaslType,
            IsArzi,
            KalaType,
            SaleTypeTitle,
            StartDate,
            FinishDate,
            CompanyID
        )
        SELECT @FinancialPeriod,
               @Season,
               1,
               CASE
                   WHEN i.IsReturnInvoice = 0 THEN
                       1
                   ELSE
                       2
               END DOCType,
               'POS_Invoice5',
               CAST(i.PosInvoiceID AS BIGINT) ID,
               CASE @CultureNo
                   WHEN 1 THEN
                       s.Title
                   WHEN 2 THEN
                       s.Title2
               END AS StuffTitle,
               1,
               ISNULL((ii.Price), 0) Amount,
               ISNULL(ii.Tax, 0) + ISNULL(ii.Duty, 0) Tax,
               0 Duty,
               ISNULL(ii.Discount, 0) Duty,
               a.ZipCode,
               a.PreNumber PreNumberOfCity,
               ph.Phone,
               a.Address,
               CASE p.Type
                   WHEN 0 THEN
                       CASE @CultureNo
                           WHEN 1 THEN
                               p.Title
                           WHEN 2 THEN
                               p.Title2
                       END
               END PartyFirstName,
               CASE p.Type
                   WHEN 1 THEN
                       CASE @CultureNo
                           WHEN 1 THEN
                               p.Title
                           WHEN 2 THEN
                               p.Title2
                       END
                   WHEN 2 THEN
                       CASE @CultureNo
                           WHEN 1 THEN
                               p.Title
                           WHEN 2 THEN
                               p.Title2
                       END
                   WHEN 0 THEN
                       CASE @CultureNo
                           WHEN 1 THEN
                               p.LastName
                           WHEN 2 THEN
                               p.LastName2
                       END
               END PartyLastName,
               p.EconomicCode,
               CASE
                   WHEN p.Type = 1 THEN
                       CAST(p.NationalID AS VARCHAR(MAX))
                   WHEN p.Type = 0 THEN
                       p.IdentificationCode
               END NationalID,
               hc.Value AS HCKharidarType1Code,
               a.provinceMinistryCode provinceCode,
               a.cityMinistryCode cityCode,
               1,
               i.Number,
               CFG.GetCLRSaturnDate(i.Date, 'YYYY/MM/DD', 0, 0) [Date],
               CAST(CASE
                        WHEN p.Type = 0 THEN
                            1
                        ELSE
                            2
                    END AS TINYINT) AS TradeType,
               b.Code AS BranchCode,
               CASE @CultureNo
                   WHEN 1 THEN
                       b.Title
                   WHEN 2 THEN
                       b.Title2
               END AS BranchTitle,
               0,
               @User,
               @CurrentDate,
               @User,
               @CurrentDate,
               NULL,
               NULL,
               NULL,
               NULL,
               0,
               NULL,
               NULL,
               NULL,
               NULL,
               NULL,
               NULL,
               NULL, --  i.Number,
               NULL, --   CFG.GetCLRSaturnDate(i.[Date], 'YYYY/MM/DD', 0, 0),
               1,
               0,
               12,
               N'فروش فروشگاهی',
               @fromDate,
               @toDate,
               @CompanyId
        FROM POS.PosInvoice i
            JOIN POS.PosInvoiceItem ii
                ON i.PosInvoiceID = ii.PosInvoiceID
            JOIN SLE.SaleModel sm
                ON sm.SaleModelID = ii.SaleModelID
            JOIN POS.StationShift AS ss
                ON ss.StationShiftID = i.StateShiftID
            JOIN POS.Station AS s0
                ON s0.StationID = ss.StationID
            JOIN STF.VWStuff s
                ON s.StuffID = ii.StuffID
            JOIN STF.StuffDetail AS sd
                ON sd.StuffID = s.StuffID
            JOIN CFG.Party p
                ON p.PartyID = i.CustomerID
            JOIN CFG.Branch b
                ON b.BranchID = s0.BranchID
            join CFG.vwCompanyAccess as vwca 
                on vwca.CompanyID=b.CompanyID
            LEFT JOIN CFG.FULLAddressForAllParties() a
                ON a.PartyID = p.PartyID
                   AND a.IsMain = 1
            LEFT JOIN CFG.Phone ph
                ON ph.PartyID = i.CustomerID
                   AND ph.IsMain = 1
            LEFT JOIN #HCType1Code AS hc
                ON hc.EntityID = p.PartyID
        WHERE hc.Value IN ( 5 )
              AND
              (
                  p.NationalID IS NOT NULL
                  OR p.IdentificationCode IS NOT NULL
                  OR p.EconomicCode IS NOT NULL
              )
              AND i.Date
              BETWEEN @fromDate AND @toDate
              AND i.FinancialPeriodID = @FinancialPeriod
              AND i.Status <> 3 
              AND b.CompanyID=@CompanyId
              and vwca.UserID=@UserID;
              
             --- SALE ---
        INSERT INTO [CFG].[SeasonFile]
        (
            [FinancialPeriodID],
            [Season],
            [AutoGenerated],
            [DOCType],
            [DocName],
            [ID],
            [StuffTitle],
            [LessThanQuorum],
            [Amount],
            [Tax],
            [Duty],
            [Discount],
            [ZipCode],
            [PreNumberOfCity],
            [Phone],
            [Address],
            [PartyFirstName],
            [PartyLastName],
            [EconomicCode],
            [NationalID],
            [HCType1Code],
            [provinceCode],
            [cityCode],
            [Type],
            [Number],
            [Date],
            [TradeType],
            [BranchCode],
            [BranchTitle],
            [Version],
            [Creator],
            [CreationDate],
            [LastEditor],
            [LastEditionDate],
            ArzType,
            Arz_Price,
            Arz_MaliatArzeshAfzoodeh,
            Arz_AvarezArzeshAfzoodeh,
            Arz_SayerAvarez,
            Arz_TakhfifPrice,
            ArzBarabari_Price,
            ArzBarabari_MaliatArzeshAfzoodeh,
            ArzBarabari_AvarezArzeshAfzoodeh,
            ArzBarabari_SayerAvarez,
            ArzBarabari_TakhfifPrice,
            FactorNo,
            FactorDate,
            SarFaslType,
            IsArzi,
            KalaType,
            SaleTypeTitle,
            StartDate,
            FinishDate,
            CompanyID
        )
        SELECT @FinancialPeriod,
               @Season,
               1,
               1 DOCType,
               'Invoice',
               CAST(i.InvoiceID AS BIGINT) ID,
               CASE @CultureNo
                   WHEN 1 THEN
                       s.Title
                   WHEN 2 THEN
                       s.Title2
               END AS StuffTitle,
               CASE
                   WHEN hc.Value = 8 THEN
                       1
                   ELSE
                       0
               END,
               ISNULL((ii.Price) * i.CurrencyRate, 0) Amount,
               ISNULL(ii.Tax * i.CurrencyRate, 0) + ISNULL(ii.Duty * i.CurrencyRate, 0) Tax,
               0 Duty,
               ISNULL(ii.Discount * i.CurrencyRate, 0) Discount,
               a.ZipCode,
               a.PreNumber PreNumberOfCity,
               ph.Phone,
               a.Address,
               CASE p.Type
                   WHEN 0 THEN
                       CASE @CultureNo
                           WHEN 1 THEN
                               p.Title
                           WHEN 2 THEN
                               p.Title2
                       END
               END PartyFirstName,
              CASE p.Type
                   WHEN 1 THEN
                       CASE @CultureNo
                           WHEN 1 THEN
                               p.Title
                           WHEN 2 THEN
                               p.Title2
                       END
                   WHEN 2 THEN
                       CASE @CultureNo
                           WHEN 1 THEN
                               p.Title
                           WHEN 2 THEN
                               p.Title2
                       END
                   WHEN 0 THEN
                       CASE @CultureNo
                           WHEN 1 THEN
                               p.LastName
                           WHEN 2 THEN
                               p.LastName2
                       END
                         WHEN 4 THEN
                       CASE @CultureNo
                           WHEN 1 THEN
                               p.Title
                           WHEN 2 THEN
                               p.Title2
                       END   
                       
               END PartyLastName,
               p.EconomicCode,
               CASE
                   WHEN p.Type = 1 THEN
                       CAST(p.NationalID AS VARCHAR(MAX))
                   WHEN p.Type = 0 THEN
                       p.IdentificationCode
               END NationalID,
               hc.Value AS HCKharidarType1Code,
               a.provinceMinistryCode provinceCode,
               a.cityMinistryCode cityCode,
               st.[Type],
               i.Number,
               CFG.GetCLRSaturnDate(i.Date, 'YYYY/MM/DD', 0, 0) [Date],
               CAST(CASE
                        WHEN p.Type = 0 THEN
                            1
                        ELSE
                            2
                    END AS TINYINT) AS TradeType,
               b.Code AS BranchCode,
               CASE @CultureNo
                   WHEN 1 THEN
                       b.Title
                   WHEN 2 THEN
                       b.Title2
               END AS BranchTitle,
               0,
               @User,
               @CurrentDate,
               @User,
               @CurrentDate,
               CASE
                   WHEN i.CurrencyID = -1 THEN
                       NULL
                   ELSE
                       atype.Value
               END,
               CASE
                   WHEN i.CurrencyID = -1 THEN
                       NULL
                   ELSE
                       ISNULL(   (ii.Price), --* i.CurrencyRate
                                 0
                             )
               END,
               CASE
                   WHEN i.CurrencyID = -1 THEN
                       NULL
                   ELSE
                       ii.Tax --* i.CurrencyRate
               END + CASE
                         WHEN i.CurrencyID = -1 THEN
                             NULL
                         ELSE
                             ii.Duty --* i.CurrencyRate
                     END,
               0,
               0,
               CASE
                   WHEN i.CurrencyID = -1 THEN
                       NULL
                   ELSE
                       ii.Discount --*i.CurrencyRate
               END,
               CASE
                   WHEN i.CurrencyID = -1 THEN
                       NULL
                   ELSE
                       i.CurrencyRate
               END,
               CASE
                   WHEN i.CurrencyID = -1 THEN
                       NULL
                   ELSE
                       i.CurrencyRate
               END,
               CASE
                   WHEN i.CurrencyID = -1 THEN
                       NULL
                   ELSE
                       i.CurrencyRate
               END,
               CASE
                   WHEN i.CurrencyID = -1 THEN
                       NULL
                   ELSE
                       i.CurrencyRate
               END,
               CASE
                   WHEN i.CurrencyID = -1 THEN
                       NULL
                   ELSE
                       i.CurrencyRate
               END,
               i.Number,
               CFG.GetCLRSaturnDate(i.Date, 'YYYY/MM/DD', 0, 0),
               1,
               CASE
                   WHEN i.CurrencyID = -1 THEN
                       0
                   ELSE
                       1
               END,
               #KalaType.Value,
               CASE @CultureNo
                   WHEN 1 THEN
                       st.Title
                   WHEN 2 THEN
                       st.Title2
               END,
               @fromDate,
               @toDate,
               @CompanyId
        FROM SLE.Invoice i
            JOIN SLE.InvoiceItem ii
                ON i.InvoiceID = ii.InvoiceID
            JOIN SLE.SaleType AS st
                ON st.SaleTypeID = i.SaleTypeID
            JOIN SLE.SaleModel sm
                ON sm.SaleModelID = ii.SaleModelID
            JOIN STF.VWStuff s
                ON s.StuffID = ii.StuffID
            JOIN STF.StuffDetail AS sd
                ON sd.StuffID = s.StuffID
            JOIN CFG.Party p
                ON p.PartyID = i.CustomerID
            JOIN CFG.Branch b
                ON b.BranchID = i.BranchID
            join CFG.vwCompanyAccess as vwca 
                on vwca.CompanyID=b.CompanyID
            LEFT JOIN CFG.FULLAddressForAllParties() a
                ON a.PartyID = i.CustomerID
                   AND a.IsMain = 1
            LEFT JOIN CFG.Phone ph
                ON ph.PartyID = i.CustomerID
                   AND ph.IsMain = 1
            LEFT JOIN #HCType1Code AS hc
                ON hc.EntityID = p.PartyID
            LEFT JOIN #ArzType AS atype
                ON atype.EntityID = i.CurrencyID
            LEFT JOIN #KalaType
                ON #KalaType.EntityID = ii.StuffID
        WHERE st.[Type] = 1
              AND i.Date
              BETWEEN @fromDate AND @toDate
              AND i.FinancialPeriodID = @FinancialPeriod
              AND i.SaleInvoiceStatus <> 5
              AND b.CompanyID=@CompanyId
              and vwca.UserID=@UserID;

        --- RETURNEDSALE ---
        INSERT INTO [CFG].[SeasonFile]
        (
            [FinancialPeriodID],
            [Season],
            [AutoGenerated],
            [DOCType],
            [DocName],
            [ID],
            [StuffTitle],
            [LessThanQuorum],
            [Amount],
            [Tax],
            [Duty],
            [Discount],
            [ZipCode],
            [PreNumberOfCity],
            [Phone],
            [Address],
            [PartyFirstName],
            [PartyLastName],
            [EconomicCode],
            [NationalID],
            [HCType1Code],
            [provinceCode],
            [cityCode],
            [Type],
            [Number],
            [Date],
            [TradeType],
            [BranchCode],
            [BranchTitle],
            [Version],
            [Creator],
            [CreationDate],
            [LastEditor],
            [LastEditionDate],
            ArzType,
            Arz_Price,
            Arz_MaliatArzeshAfzoodeh,
            Arz_AvarezArzeshAfzoodeh,
            Arz_SayerAvarez,
            Arz_TakhfifPrice,
            ArzBarabari_Price,
            ArzBarabari_MaliatArzeshAfzoodeh,
            ArzBarabari_AvarezArzeshAfzoodeh,
            ArzBarabari_SayerAvarez,
            ArzBarabari_TakhfifPrice,
            FactorNo,
            FactorDate,
            SarFaslType,
            IsArzi,
            KalaType,
            SaleTypeTitle,
            StartDate,
            FinishDate,
            CompanyID
        )
        SELECT @FinancialPeriod,
               @Season,
               1,
               2 DOCType,
               'ReturnedSaleInvoice',
               CAST(i.ReturnedSaleInvoiceID AS BIGINT) ID,
               CASE @CultureNo
                   WHEN 1 THEN
                       s.Title
                   WHEN 2 THEN
                       s.Title2
               END AS StuffTitle,
               CASE
                   WHEN hc.Value = 8 THEN
                       1
                   ELSE
                       0
               END,
               ISNULL(ii.Price * i.CurrencyRate, 0) Amount,
               ISNULL(ii.Tax * i.CurrencyRate, 0) + ISNULL(ii.Duty * i.CurrencyRate, 0) Tax,
               0 Duty,
               ISNULL(ii.Discount * i.CurrencyRate, 0) Discount,
               a.ZipCode,
               a.PreNumber PreNumberOfCity,
               ph.Phone,
               a.Address,
               CASE p.Type
                   WHEN 0 THEN
                       CASE @CultureNo
                           WHEN 1 THEN
                               p.Title
                           WHEN 2 THEN
                               p.Title2
                       END
                   ELSE
                       ''
               END PartyFirstName,
               CASE p.Type
                   WHEN 1 THEN
                       CASE @CultureNo
                           WHEN 1 THEN
                               p.Title
                           WHEN 2 THEN
                               p.Title2
                       END
                   WHEN 2 THEN
                       CASE @CultureNo
                           WHEN 1 THEN
                               p.Title
                           WHEN 2 THEN
                               p.Title2
                       END
                   WHEN 0 THEN
                       CASE @CultureNo
                           WHEN 1 THEN
                               p.LastName
                           WHEN 2 THEN
                               p.LastName2
                       END
                         WHEN 4 THEN
                       CASE @CultureNo
                           WHEN 1 THEN
                               p.Title
                           WHEN 2 THEN
                               p.Title2
                       END   
                       
               END PartyLastName,
               p.EconomicCode,
               CASE
                   WHEN p.Type = 1 THEN
                       CAST(p.NationalID AS VARCHAR(MAX))
                   WHEN p.Type = 0 THEN
                       p.IdentificationCode
               END NationalID,
               hc.Value AS HCKharidarType1Code,
               a.provinceMinistryCode provinceCode,
               a.cityMinistryCode cityCode,
               st.[Type],
               i.Number,
               CFG.GetCLRSaturnDate(i.Date, 'YYYY/MM/DD', 0, 0) [Date],
               CAST(CASE
                        WHEN p.Type = 0 THEN
                            1
                        ELSE
                            2
                    END AS TINYINT) AS TradeType,
               b.Code AS BranchCode,
               CASE @CultureNo
                   WHEN 1 THEN
                       b.Title
                   WHEN 2 THEN
                       b.Title2
               END AS BranchTitle,
               0,
               @User,
               @CurrentDate,
               @User,
               @CurrentDate,
               CASE
                   WHEN i.CurrencyID = -1 THEN
                       NULL
                   ELSE
                       atype.Value
               END,
               CASE
                   WHEN i.CurrencyID = -1 THEN
                       NULL
                   ELSE
                       ii.Price -- * i.CurrencyRate
               END,
               CASE
                   WHEN i.CurrencyID = -1 THEN
                       NULL
                   ELSE
                       ii.Tax --* i.CurrencyRate
               END + CASE
                         WHEN i.CurrencyID = -1 THEN
                             NULL
                         ELSE
                             ii.Duty --* i.CurrencyRate
                     END,
               0,
               0,
               CASE
                   WHEN i.CurrencyID = -1 THEN
                       NULL
                   ELSE
                       ii.Discount -- * i.CurrencyRate
               END,
               CASE
                   WHEN i.CurrencyID = -1 THEN
                       NULL
                   ELSE
                       i.CurrencyRate
               END,
               CASE
                   WHEN i.CurrencyID = -1 THEN
                       NULL
                   ELSE
                       i.CurrencyRate
               END,
               CASE
                   WHEN i.CurrencyID = -1 THEN
                       NULL
                   ELSE
                       i.CurrencyRate
               END,
               CASE
                   WHEN i.CurrencyID = -1 THEN
                       NULL
                   ELSE
                       i.CurrencyRate
               END,
               CASE
                   WHEN i.CurrencyID = -1 THEN
                       NULL
                   ELSE
                       i.CurrencyRate
               END,
               i.Number,
               CFG.GetCLRSaturnDate(i.Date, 'YYYY/MM/DD', 0, 0),
              1,
               CASE
                   WHEN i.CurrencyID = -1 THEN
                       0
                   ELSE
                       1
               END,
               #KalaType.Value,
               CASE @CultureNo
                   WHEN 1 THEN
                       st.Title
                   WHEN 2 THEN
                       st.Title2
               END,
               @fromDate,
               @toDate,
               @CompanyId
        FROM SLE.ReturnedSaleInvoice i
            JOIN SLE.SaleType AS st
                ON st.SaleTypeID = i.SaleTypeID
            JOIN SLE.ReturnedSaleInvoiceItem ii
                ON i.ReturnedSaleInvoiceID = ii.ReturnedSaleInvoiceID
            JOIN SLE.SaleModel sm
                ON sm.SaleModelID = ii.SaleModelID
            JOIN STF.VWStuff s
                ON s.StuffID = ii.StuffID
            JOIN STF.StuffDetail AS sd
                ON sd.StuffID = s.StuffID
            JOIN CFG.Party p
                ON p.PartyID = i.CustomerID
            JOIN CFG.Branch b
                ON b.BranchID = i.BranchID
            join CFG.vwCompanyAccess as vwca 
                on vwca.CompanyID=b.CompanyID
            LEFT JOIN CFG.FULLAddressForAllParties() a
                ON p.PartyID = a.PartyID
                   AND a.IsMain = 1
            LEFT JOIN CFG.Phone ph
                ON ph.PartyID = i.CustomerID
                   AND ph.IsMain = 1
            LEFT JOIN #HCType1Code AS hc
                ON hc.EntityID = p.PartyID
            LEFT JOIN #ArzType AS atype
                ON atype.EntityID = i.CurrencyID
            LEFT JOIN #KalaType
                ON #KalaType.EntityID = ii.StuffID
        WHERE st.[Type] = 1
              AND SUBSTRING(
                               CFG.GetCLRSaturnDate(i.Date, 'YYYY/MM/DD', 1, 0),
                               CHARINDEX('/', CFG.GetCLRSaturnDate(i.Date, 'YYYY/MM/DD', 1, 0), 1) + 1,
                               2
                           )IN
                  (
                      SELECT value FROM CFG.R_FnCommaStr2Table(@Month)
                  )
              AND i.Date
              BETWEEN @fromDate AND @toDate
              AND i.FinancialPeriodID = @FinancialPeriod
              AND b.CompanyID=@CompanyId
              and vwca.UserID=@UserID;

        --- PURCHASE ---
        INSERT INTO [CFG].[SeasonFile]
        (
            [FinancialPeriodID],
            [Season],
            [AutoGenerated],
            [DOCType],
            [DocName],
            [ID],
            [StuffTitle],
            [LessThanQuorum],
            [Amount],
            [Tax],
            [Duty],
            Discount,
            [ZipCode],
            [PreNumberOfCity],
            [Phone],
            [Address],
            [PartyFirstName],
            [PartyLastName],
            [EconomicCode],
            [NationalID],
            [HCType1Code],
            [provinceCode],
            [cityCode],
            [Type],
            [Number],
            [Date],
            [TradeType],
            [BranchCode],
            [BranchTitle],
            [Version],
            [Creator],
            [CreationDate],
            [LastEditor],
            [LastEditionDate],
            ArzType,
            Arz_Price,
            Arz_MaliatArzeshAfzoodeh,
            Arz_AvarezArzeshAfzoodeh,
            Arz_SayerAvarez,
            Arz_TakhfifPrice,
            ArzBarabari_Price,
            ArzBarabari_MaliatArzeshAfzoodeh,
            ArzBarabari_AvarezArzeshAfzoodeh,
            ArzBarabari_SayerAvarez,
            ArzBarabari_TakhfifPrice,
            FactorNo,
            FactorDate,
            SarFaslType,
            IsArzi,
            KalaType,
            StartDate,
            FinishDate,
            IsHagholAmalKari,
            Nationality,
            CompanyID
        )
        SELECT @FinancialPeriod,
               @Season,
               1,
               CAST(3 AS TINYINT) DOCType,
               'PurchaseInvoice',
               CAST(i.PurchaseInvoiceID AS BIGINT) ID,
               CASE @CultureNo
                   WHEN 1 THEN
                       s.Title
                   WHEN 2 THEN
                       s.Title2
               END AS StuffTitle,
               0,
               ISNULL(ROUND(ii.Price * i.CurrencyRate, @baseCurrenncyPercisionCount), 0) Amount,
               ISNULL(ROUND(ii.Tax * i.CurrencyRate, @baseCurrenncyPercisionCount), 0)
               + ISNULL(ROUND(ii.Duty * i.CurrencyRate, @baseCurrenncyPercisionCount), 0) Tax,
               0 Duty,
               ISNULL(ROUND(ii.Discount * i.CurrencyRate, @baseCurrenncyPercisionCount), 0) Discount,
               a.ZipCode,
               a.PreNumber PreNumberOfCity,
               ph.Phone,
               a.Address,
               CASE p.Type
                   WHEN 0 THEN
                       CASE @CultureNo
                           WHEN 1 THEN
                               p.Title
                           WHEN 2 THEN
                               p.Title2
                       END
                   ELSE
                       NULL
               END PartyFirstName,
               CASE p.Type
                   WHEN 0 THEN
                       CASE @CultureNo
                           WHEN 1 THEN
                               p.LastName
                           WHEN 2 THEN
                               p.LastName2
                       END
                   ELSE
                       CASE @CultureNo
                           WHEN 1 THEN
                               p.Title
                           WHEN 2 THEN
                               p.Title2
                       END
               END PartyLastName,
               CASE p.TYPE when 0 then '' when 2 then  p.EconomicCode when 3 then p.EconomicCode when 4 then p.EconomicCode end,
               CASE
                   WHEN p.Type = 1 THEN
                       CAST(p.NationalID AS VARCHAR(MAX))
                   WHEN p.Type = 0 THEN
                       p.IdentificationCode
               END NationalID,
               hc.Value AS HcForoushandeType1Code,
               a.provinceMinistryCode provinceCode,
               a.cityMinistryCode cityCode,
               CAST(CASE
                        WHEN pt.[Type] = 0 THEN
                            1
                        ELSE
                            0
                    END AS BIT) [Type],
               i.Number,
               CFG.GetCLRSaturnDate(i.[Date], 'YYYY/MM/DD', 0, 0) [Date],
               CAST(CASE
                        WHEN p.Type = 0 THEN
                            1
                        ELSE
                            2
                    END AS TINYINT) AS TradeType,
               b.Code AS BranchCode,
               CASE @CultureNo
                   WHEN 1 THEN
                       b.Title
                   WHEN 2 THEN
                       b.Title2
               END AS BranchTitle,
               0,
               @User,
               @CurrentDate,
               @User,
               @CurrentDate,
               CASE
                   WHEN i.CurrencyID = -1 THEN
                       NULL
                   ELSE
                       atype.Value
               END,
               CASE
                   WHEN i.CurrencyID = -1 THEN
                       NULL
                   ELSE
                       ii.Price --* i.CurrencyRate
               END,
               CASE
                   WHEN i.CurrencyID = -1 THEN
                       NULL
                   ELSE
                       ii.Tax --* i.CurrencyRate
               END + CASE
                         WHEN i.CurrencyID = -1 THEN
                             NULL
                         ELSE
                             ii.Duty --* i.CurrencyRate
                     END,
               0,
               0,
               CASE
                   WHEN i.CurrencyID = -1 THEN
                       NULL
                   ELSE
                       ii.Discount --* i.CurrencyRate
               END,
               CASE
                   WHEN i.CurrencyID = -1 THEN
                       NULL
                   ELSE
                       i.CurrencyRate
               END,
               CASE
                   WHEN i.CurrencyID = -1 THEN
                       NULL
                   ELSE
                       i.CurrencyRate
               END,
               CASE
                   WHEN i.CurrencyID = -1 THEN
                       NULL
                   ELSE
                       i.CurrencyRate
               END,
               CASE
                   WHEN i.CurrencyID = -1 THEN
                       NULL
                   ELSE
                       i.CurrencyRate
               END,
               CASE
                   WHEN i.CurrencyID = -1 THEN
                       NULL
                   ELSE
                       i.CurrencyRate
               END,
               CASE
                   WHEN i.InvoiceNumber IS NULL
                        OR i.InvoiceDate IS NULL THEN
                       NULL
                   ELSE
                       i.InvoiceNumber
               END AS InvoiceNumber,
               CASE
                   WHEN i.InvoiceNumber IS NULL
                        OR i.InvoiceDate IS NULL
                        OR i.InvoiceDate < @fromDate THEN
                       NULL
                   ELSE
                       CFG.GetCLRSaturnDate(i.InvoiceDate, 'YYYY/MM/DD', 0, 0)
               END AS InvoiceDate,
               1,
               CASE
                   WHEN i.CurrencyID = -1 THEN
                       0
                   ELSE
                       1
               END,
               #KalaType.Value,
               @fromDate,
               @toDate,
               ISNULL(pt.IsRepresentative, 0),
               Nationality.Code, -- nationality
               @CompanyId
        FROM VND.PurchaseInvoice i
            JOIN VND.PurchaseInvoiceItem ii
                ON i.PurchaseInvoiceID = ii.PurchaseInvoiceID
            LEFT JOIN ACC.VWVoucherPrevoucher PIVoucher
                ON i.PreVoucherID = PIVoucher.PrevoucherID
                   AND PIVoucher.VoucherStatus = 'Survey'
            JOIN STF.VWStuff s
                ON s.StuffID = ii.StuffID
            JOIN STF.StuffDetail AS sd
                ON sd.StuffID = s.StuffID
            JOIN CFG.Party p
                ON p.DlID = i.DlID
            JOIN
            (
                SELECT ldi.LookupDataItemID,
                       ldi.Code,
                       CASE @CultureNo
                           WHEN 1 THEN
                               ldi.Title
                           WHEN 2 THEN
                               ldi.Title2
                       END Title
                FROM CFG.LookupData AS ld
                    JOIN CFG.LookupDataItem AS ldi
                        ON ldi.LookupDataID = ld.LookupDataID
                WHERE ld.SystemName = 'nationality'
            ) Nationality
                ON Nationality.LookupDataItemID = p.Nationality
            JOIN CFG.Branch b
                ON b.BranchID = i.BranchID
            join CFG.vwCompanyAccess as vwca 
                on vwca.CompanyID=b.CompanyID
            JOIN VND.PurchaseType AS pt
                ON pt.PurchaseTypeID = i.[Type]
            LEFT JOIN CFG.FULLAddressForAllParties() a
                ON p.PartyID = a.PartyID
                   AND a.IsMain = 1
            LEFT JOIN CFG.Phone ph
                ON ph.PartyID = p.PartyID
                   AND ph.IsMain = 1
            LEFT JOIN #HCForoushandeType1Code AS hc
                ON hc.EntityID = p.PartyID
            LEFT JOIN #ArzType AS atype
                ON atype.EntityID = i.CurrencyID
            LEFT JOIN #KalaType
                ON #KalaType.EntityID = ii.StuffID
        WHERE pt.[Type] = 0
              AND
              (
                  (
                      @DateInPurchaseDocuments <> 2
                      AND i.Date
              BETWEEN @fromDate AND @toDate
                  )
                  OR
                  (
                      @DateInPurchaseDocuments = 2
                      AND PIVoucher.[Date] IS NOT NULL
                      AND PIVoucher.[Date]
              BETWEEN @fromDate AND @toDate
                  )
              )
              AND i.FinancialPeriodID = @FinancialPeriod
              AND b.CompanyID=@CompanyId
              and vwca.UserID=@UserID;

        --- RETURNED PURCHASE ---
        INSERT INTO [CFG].[SeasonFile]
        (
            [FinancialPeriodID],
            [Season],
            [AutoGenerated],
            [DOCType],
            [DocName],
            [ID],
            [StuffTitle],
            [LessThanQuorum],
            [Amount],
            [Tax],
            [Duty],
            Discount,
            [ZipCode],
            [PreNumberOfCity],
            [Phone],
            [Address],
            [PartyFirstName],
            [PartyLastName],
            [EconomicCode],
            [NationalID],
            [HCType1Code],
            [provinceCode],
            [cityCode],
            [Type],
            [Number],
            [Date],
            [TradeType],
            [BranchCode],
            [BranchTitle],
            [Version],
            [Creator],
            [CreationDate],
            [LastEditor],
            [LastEditionDate],
            ArzType,
            Arz_Price,
            Arz_MaliatArzeshAfzoodeh,
            Arz_AvarezArzeshAfzoodeh,
            Arz_SayerAvarez,
            Arz_TakhfifPrice,
            ArzBarabari_Price,
            ArzBarabari_MaliatArzeshAfzoodeh,
            ArzBarabari_AvarezArzeshAfzoodeh,
            ArzBarabari_SayerAvarez,
            ArzBarabari_TakhfifPrice,
            FactorNo,
            FactorDate,
            SarFaslType,
            IsArzi,
            KalaType,
            StartDate,
            FinishDate,
            CompanyID
        )
        SELECT @FinancialPeriod,
               @Season,
               1,
               CAST(4 AS TINYINT) DOCType,
               'ReturnInvoice',
               CAST(i.ReturnInvoiceID AS BIGINT) ID,
               CASE @CultureNo
                   WHEN 1 THEN
                       s.Title
                   WHEN 2 THEN
                       s.Title2
               END AS StuffTitle,
               0,
               ISNULL(ROUND(ii.Price * i.CurrencyRate, @baseCurrenncyPercisionCount), 0) Amount,
               ISNULL(ROUND(ii.Tax * i.CurrencyRate, @baseCurrenncyPercisionCount), 0)
               + ISNULL(ROUND(ii.Duty * i.CurrencyRate, @baseCurrenncyPercisionCount), 0) Tax,
               0 Duty,
               ISNULL(ROUND(ii.Discount * i.CurrencyRate, @baseCurrenncyPercisionCount), 0) Discount,
               a.ZipCode,
               a.PreNumber PreNumberOfCity,
               ph.Phone,
               a.Address,
               CASE p.Type
                   WHEN 1 THEN
                       NULL
                   WHEN 0 THEN
                       CASE @CultureNo
                           WHEN 1 THEN
                               p.Title
                           WHEN 2 THEN
                               p.Title2
                       END
               END PartyFirstName,
               CASE p.Type
                   WHEN 1 THEN
                       CASE @CultureNo
                           WHEN 1 THEN
                               p.Title
                           WHEN 2 THEN
                               p.Title2
                       END
                   WHEN 2 THEN
                       CASE @CultureNo
                           WHEN 1 THEN
                               p.Title
                           WHEN 2 THEN
                               p.Title2
                       END
                   WHEN 0 THEN
                       CASE @CultureNo
                           WHEN 1 THEN
                               p.LastName
                           WHEN 2 THEN
                               p.LastName2
                       END
               END PartyLastName,
               p.EconomicCode,
               CASE
                   WHEN p.Type = 1 THEN
                       CAST(p.NationalID AS VARCHAR(MAX))
                   WHEN p.Type = 0 THEN
                       p.IdentificationCode
               END NationalID,
               hc.Value AS HcForoushandeType1Code,
               a.provinceMinistryCode provinceCode,
               a.cityMinistryCode cityCode,
               CAST(CASE
                        WHEN pt.[Type] = 0 THEN
                            1
                        ELSE
                            0
                    END AS BIT) [Type],
               NULL,
               NULL,
               CAST(CASE
                        WHEN p.Type = 0 THEN
                            1
                        ELSE
                            2
                    END AS TINYINT) AS TradeType,
               b.Code AS BranchCode,
               CASE @CultureNo
                   WHEN 1 THEN
                       b.Title
                   WHEN 2 THEN
                       b.Title2
               END AS BranchTitle,
               0,
               @User,
               @CurrentDate,
               @User,
               @CurrentDate,
               CASE
                   WHEN i.CurrencyID = -1 THEN
                       NULL
                   ELSE
                       atype.Value
               END,
               CASE
                   WHEN i.CurrencyID = -1 THEN
                       NULL
                   ELSE
                       ii.Price --* i.CurrencyRate
               END,
               CASE
                   WHEN i.CurrencyID = -1 THEN
                       NULL
                   ELSE
                       ii.Tax --* i.CurrencyRate
               END + CASE
                         WHEN i.CurrencyID = -1 THEN
                             NULL
                         ELSE
                             ii.Duty --* i.CurrencyRate
                     END,
               0,
               0,
               CASE
                   WHEN i.CurrencyID = -1 THEN
                       NULL
                   ELSE
                       ii.Discount --* i.CurrencyRate
               END,
               CASE
                   WHEN i.CurrencyID = -1 THEN
                       NULL
                   ELSE
                       i.CurrencyRate
               END,
               CASE
                   WHEN i.CurrencyID = -1 THEN
                       NULL
                   ELSE
                       i.CurrencyRate
               END,
               CASE
                   WHEN i.CurrencyID = -1 THEN
                       NULL
                   ELSE
                       i.CurrencyRate
               END,
               CASE
                   WHEN i.CurrencyID = -1 THEN
                       NULL
                   ELSE
                       i.CurrencyRate
               END,
               CASE
                   WHEN i.CurrencyID = -1 THEN
                       NULL
                   ELSE
                       i.CurrencyRate
               END,
               i.Number,
               CFG.GetCLRSaturnDate(i.[Date], 'YYYY/MM/DD', 0, 0),
              1,
               CASE
                   WHEN i.CurrencyID = -1 THEN
                       0
                   ELSE
                       1
               END,
               #KalaType.Value,
               @fromDate,
               @toDate,
               @CompanyId
        FROM VND.ReturnInvoice i
            JOIN VND.ReturnInvoiceItem ii
                ON i.ReturnInvoiceID = ii.ReturnInvoiceID
            LEFT JOIN ACC.VWVoucherPrevoucher PIVoucher
                ON i.PreVoucherID = PIVoucher.PrevoucherID
                   AND PIVoucher.VoucherStatus = 'Survey'
            JOIN STF.VWStuff s
                ON s.StuffID = ii.StuffID
            JOIN STF.StuffDetail AS sd
                ON sd.StuffID = s.StuffID
            JOIN CFG.Party p
                ON p.DlID = i.DlID
            JOIN CFG.Branch b
                ON b.BranchID = i.BranchID
            join CFG.vwCompanyAccess as vwca 
                on vwca.CompanyID=b.CompanyID
            JOIN VND.PurchaseType AS pt
                ON pt.PurchaseTypeID = i.[Type]
            LEFT JOIN CFG.FULLAddressForAllParties() a
                ON a.PartyID = p.PartyID
                   AND a.IsMain = 1
            LEFT JOIN CFG.Phone ph
                ON ph.PartyID = p.PartyID
                   AND ph.IsMain = 1
            LEFT JOIN #HCForoushandeType1Code AS hc
                ON hc.EntityID = p.PartyID
            LEFT JOIN #ArzType AS atype
                ON atype.EntityID = i.CurrencyID
            LEFT JOIN #KalaType
                ON #KalaType.EntityID = ii.StuffID
        WHERE pt.[Type] = 0
              AND
              (
                  (
                      @DateInPurchaseDocuments <> 2
                      AND i.Date
              BETWEEN @fromDate AND @toDate
                  )
                  OR
                  (
                      @DateInPurchaseDocuments = 2
                      AND PIVoucher.[Date] IS NOT NULL
                      AND PIVoucher.[Date]
              BETWEEN @fromDate AND @toDate
                  )
              )
              AND i.FinancialPeriodID = @FinancialPeriod
              AND b.CompanyID=@CompanyId
              and vwca.UserID=@UserID;

        --PaymentSubject

        INSERT INTO [CFG].[SeasonFile]
        (
            [FinancialPeriodID],
            [Season],
            [AutoGenerated],
            [DOCType],
            [DocName],
            [ID],
            [StuffTitle],
            [LessThanQuorum],
            [Amount],
            [Tax],
            [Duty],
            [Discount],
            [ZipCode],
            [PreNumberOfCity],
            [Phone],
            [Address],
            [PartyFirstName],
            [PartyLastName],
            [EconomicCode],
            [NationalID],
            [HCType1Code],
            [provinceCode],
            [cityCode],
            [Type],
            [Number],
            [Date],
            [TradeType],
            [BranchCode],
            [BranchTitle],
            [Version],
            [Creator],
            [CreationDate],
            [LastEditor],
            [LastEditionDate],
            ArzType,
            Arz_Price,
            Arz_MaliatArzeshAfzoodeh,
            Arz_AvarezArzeshAfzoodeh,
            Arz_SayerAvarez,
            Arz_TakhfifPrice,
            ArzBarabari_Price,
            ArzBarabari_MaliatArzeshAfzoodeh,
            ArzBarabari_AvarezArzeshAfzoodeh,
            ArzBarabari_SayerAvarez,
            ArzBarabari_TakhfifPrice,
            FactorNo,
            FactorDate,
            SarFaslType,
            IsArzi,
            KalaType,
            SaleTypeTitle,
            StartDate,
            FinishDate,
            CompanyID
        )
        SELECT @FinancialPeriod,
               @Season,
               1,
               3 DOCType,
               'PaymentSubject',
               CAST(pr.PaymentReceiptID AS BIGINT) ID,
               CASE @CultureNo
                   WHEN 1 THEN
                       FIN.PaymentType.Title
                   WHEN 2 THEN
                       FIN.PaymentType.Title2
               END AS StuffTitle,
               0,
               ISNULL((ps.Amount) * ps.CurrencyRate, 0) Amount,
               ISNULL(0, 0) Tax,
               ISNULL(0, 0) Duty,
               ISNULL(ps.Discount * ps.CurrencyRate, 0) Discount,
               a.ZipCode,
               a.PreNumber PreNumberOfCity,
               ph.Phone,
               a.[Address],
               CASE p.Type
                   WHEN 0 THEN
                       CASE @CultureNo
                           WHEN 1 THEN
                               p.Title
                           WHEN 2 THEN
                               p.Title2
                       END
               END PartyFirstName,
               CASE p.Type
                   WHEN 1 THEN
                       CASE @CultureNo
                           WHEN 1 THEN
                               p.Title
                           WHEN 2 THEN
                               p.Title2
                       END
                   WHEN 2 THEN
                       CASE @CultureNo
                           WHEN 1 THEN
                               p.Title
                           WHEN 2 THEN
                               p.Title2
                       END
                   WHEN 0 THEN
                       CASE @CultureNo
                           WHEN 1 THEN
                               p.LastName
                           WHEN 2 THEN
                               p.LastName2
                       END
               END PartyLastName,
               p.EconomicCode,
               CASE
                   WHEN p.Type = 1 THEN
                       CAST(p.NationalID AS VARCHAR(MAX))
                   WHEN p.Type = 0 THEN
                       p.IdentificationCode
               END NationalID,
               hc.Value AS HCKharidarType1Code,
               a.provinceMinistryCode provinceCode,
               a.cityMinistryCode cityCode,
               1,
               pr.Number,
               CFG.GetCLRSaturnDate(pr.[Date], 'YYYY/MM/DD', 0, 0),
               CAST(CASE
                        WHEN p.Type = 0 THEN
                            1
                        ELSE
                            2
                    END AS TINYINT) AS TradeType,
               b.Code AS BranchCode,
               CASE @CultureNo
                   WHEN 1 THEN
                       b.Title
                   WHEN 2 THEN
                       b.Title2
               END AS BranchTitle,
               0,
               @User,
               @CurrentDate,
               @User,
               @CurrentDate,
               CASE
                   WHEN ps.CurrencyID = -1 THEN
                       NULL
                   ELSE
                       atype.Value
               END,
               CASE
                   WHEN ps.CurrencyID = -1 THEN
                       NULL
                   ELSE
                       ISNULL(   (ps.Amount), --* i.CurrencyRate
                                 0
                             )
               END,
               CASE
                   WHEN ps.CurrencyID = -1 THEN
                       NULL
                   ELSE
                       0 --* i.CurrencyRate
               END,
               CASE
                   WHEN ps.CurrencyID = -1 THEN
                       NULL
                   ELSE
                       0 --* i.CurrencyRate
               END,
               0,
               CASE
                   WHEN ps.CurrencyID = -1 THEN
                       NULL
                   ELSE
                       ps.Discount --*i.CurrencyRate
               END,
               CASE
                   WHEN ps.CurrencyID = -1 THEN
                       NULL
                   ELSE
                       ps.CurrencyRate
               END,
               CASE
                   WHEN ps.CurrencyID = -1 THEN
                       NULL
                   ELSE
                       ps.CurrencyRate
               END,
               CASE
                   WHEN ps.CurrencyID = -1 THEN
                       NULL
                   ELSE
                       ps.CurrencyRate
               END,
               CASE
                   WHEN ps.CurrencyID = -1 THEN
                       NULL
                   ELSE
                       ps.CurrencyRate
               END,
               CASE
                   WHEN ps.CurrencyID = -1 THEN
                       NULL
                   ELSE
                       ps.CurrencyRate
               END,
               NULL, --pr.Number,
               NULL, --CFG.GetCLRSaturnDate(pr.[Date], 'YYYY/MM/DD', 0, 0),
               3,
               CASE
                   WHEN ps.CurrencyID = -1 THEN
                       0
                   ELSE
                       1
               END,
               12,
               N'خرید نقدی',
               @fromDate,
               @toDate,
               @CompanyId
        FROM FIN.PaymentSubject AS ps
            INNER JOIN FIN.PaymentReceipt AS pr
                ON pr.PaymentReceiptID = ps.PaymentReceiptID
            INNER JOIN FIN.PaymentType
                ON FIN.PaymentType.PaymentTypeID = ps.PaymentTypeID
            JOIN CFG.Party p
                ON p.PartyID = pr.PartyID
            JOIN CFG.Branch b
                ON b.BranchID = pr.BranchID
            join CFG.vwCompanyAccess as vwca 
                on vwca.CompanyID=b.CompanyID
            LEFT JOIN CFG.FULLAddressForAllParties() a
                ON a.PartyID = p.PartyID
                   AND a.IsMain = 1
            LEFT JOIN CFG.Phone ph
                ON ph.PartyID = p.PartyID
                   AND ph.IsMain = 1
            LEFT JOIN #HCForoushandeType1Code AS hc
                ON hc.EntityID = p.PartyID
            LEFT JOIN #ArzType AS atype
                ON atype.EntityID = ps.CurrencyID
            LEFT JOIN ACC.VWVoucherPrevoucher PIVoucher
                ON pr.PreVoucherID = PIVoucher.PrevoucherID
                   AND PIVoucher.VoucherStatus = 'Survey'
        WHERE pr.FinancialPeriodID = @FinancialPeriod
              AND b.CompanyID=@CompanyId
              AND AnnouncedInAdditionalValue = 1
              AND pr.Status <> 1
              AND
              (
                  (
                      @DateInPurchaseDocuments <> 2
                      AND pr.Date
              BETWEEN @fromDate AND @toDate
                  )
                  OR
                  (   @DateInPurchaseDocuments = 2
                      AND PIVoucher.[Date] IS NOT NULL
                      AND PIVoucher.[Date]
              BETWEEN @fromDate AND @toDate
                  )
              )
              and vwca.UserID=@UserID;

        --DebitCreditNote
        INSERT INTO [CFG].[SeasonFile]
        (
            [FinancialPeriodID],
            [Season],
            [AutoGenerated],
            [DOCType],
            [DocName],
            [ID],
            [StuffTitle],
            [LessThanQuorum],
            [Amount],
            [Tax],
            [Duty],
            [Discount],
            [ZipCode],
            [PreNumberOfCity],
            [Phone],
            [Address],
            [PartyFirstName],
            [PartyLastName],
            [EconomicCode],
            [NationalID],
            [HCType1Code],
            [provinceCode],
            [cityCode],
            [Type],
            [Number],
            [Date],
            [TradeType],
            [BranchCode],
            [BranchTitle],
            [Version],
            [Creator],
            [CreationDate],
            [LastEditor],
            [LastEditionDate],
            ArzType,
            Arz_Price,
            Arz_MaliatArzeshAfzoodeh,
            Arz_AvarezArzeshAfzoodeh,
            Arz_SayerAvarez,
            Arz_TakhfifPrice,
            ArzBarabari_Price,
            ArzBarabari_MaliatArzeshAfzoodeh,
            ArzBarabari_AvarezArzeshAfzoodeh,
            ArzBarabari_SayerAvarez,
            ArzBarabari_TakhfifPrice,
            FactorNo,
            FactorDate,
            SarFaslType,
            IsArzi,
            KalaType,
            SaleTypeTitle,
            StartDate,
            FinishDate,
            CompanyID
        )
        SELECT @FinancialPeriod,
               @Season,
               1,
               3 DOCType,
               'DebitCreditNote',
               CAST(pr.DebitCreditNoteID AS BIGINT) ID,
               CASE @CultureNo
                   WHEN 1 THEN
                       pt.Title
                   WHEN 2 THEN
                       pt.Title2
               END AS StuffTitle,
               0,
               ISNULL((ps.Amount) * ps.CurrencyRate, 0) Amount,
               ISNULL(0, 0) Tax,
               ISNULL(0, 0) Duty,
               ISNULL(ps.Discount * ps.CurrencyRate, 0) Discount,
               a.ZipCode,
               a.PreNumber PreNumberOfCity,
               ph.Phone,
               a.Address,
               CASE p.Type
                   WHEN 0 THEN
                       CASE @CultureNo
                           WHEN 1 THEN
                               p.Title
                           WHEN 2 THEN
                               p.Title2
                       END
                   ELSE
                       NULL
               END PartyFirstName,
               CASE p.Type
                   WHEN 1 THEN
                       CASE @CultureNo
                           WHEN 1 THEN
                               p.Title
                           WHEN 2 THEN
                               p.Title2
                       END
                   WHEN 2 THEN
                       CASE @CultureNo
                           WHEN 1 THEN
                               p.Title
                           WHEN 2 THEN
                               p.Title2
                       END
                   WHEN 0 THEN
                       CASE @CultureNo
                           WHEN 1 THEN
                               p.LastName
                           WHEN 2 THEN
                               p.LastName2
                       END
               END PartyLastName,
               p.EconomicCode,
               CASE
                   WHEN p.Type = 1 THEN
                       CAST(p.NationalID AS VARCHAR(MAX))
                   WHEN p.Type = 0 THEN
                       p.IdentificationCode
               END NationalID,
               hc.Value AS HCKharidarType1Code,
               a.provinceMinistryCode provinceCode,
               a.cityMinistryCode cityCode,
               1,
               pr.Number,
               CFG.GetCLRSaturnDate(pr.[Date], 'YYYY/MM/DD', 0, 0),
               CAST(CASE
                        WHEN p.Type = 0 THEN
                            1
                        ELSE
                            2
                    END AS TINYINT) AS TradeType,
               b.Code AS BranchCode,
               CASE @CultureNo
                   WHEN 1 THEN
                       b.Title
                   WHEN 2 THEN
                       b.Title2
               END AS BranchTitle,
               0,
               @User,
               @CurrentDate,
               @User,
               @CurrentDate,
               CASE
                   WHEN ps.CurrencyID = -1 THEN
                       NULL
                   ELSE
                       atype.Value
               END,
               CASE
                   WHEN ps.CurrencyID = -1 THEN
                       NULL
                   ELSE
                       ISNULL(   (ps.Amount), --* i.CurrencyRate
                                 0
                             )
               END,
               CASE
                   WHEN ps.CurrencyID = -1 THEN
                       NULL
                   ELSE
                       0 --* i.CurrencyRate
               END,
               CASE
                   WHEN ps.CurrencyID = -1 THEN
                       NULL
                   ELSE
                       0 --* i.CurrencyRate
               END,
               0,
               CASE
                   WHEN ps.CurrencyID = -1 THEN
                       NULL
                   ELSE
                       ps.Discount --*i.CurrencyRate
               END,
               CASE
                   WHEN ps.CurrencyID = -1 THEN
                       NULL
                   ELSE
                       ps.CurrencyRate
               END,
               CASE
                   WHEN ps.CurrencyID = -1 THEN
                       NULL
                   ELSE
                       ps.CurrencyRate
               END,
               CASE
                   WHEN ps.CurrencyID = -1 THEN
                       NULL
                   ELSE
                       ps.CurrencyRate
               END,
               CASE
                   WHEN ps.CurrencyID = -1 THEN
                       NULL
                   ELSE
                       ps.CurrencyRate
               END,
               CASE
                   WHEN ps.CurrencyID = -1 THEN
                       NULL
                   ELSE
                       ps.CurrencyRate
               END,
               NULL, --pr.Number,
               NULL, --CFG.GetCLRSaturnDate(pr.[Date], 'YYYY/MM/DD', 0, 0),
               3,
               CASE
                   WHEN ps.CurrencyID = -1 THEN
                       0
                   ELSE
                       1
               END,
               12,
               N'خرید نقدی',
               @fromDate,
               @toDate,
               @CompanyId
        FROM CFG.DebitCreditNoteItem AS ps
            INNER JOIN CFG.DebitCreditNote AS pr
                ON pr.DebitCreditNoteID = ps.DebitCreditNoteID
            INNER JOIN FIN.PaymentType pt
                ON pt.PaymentTypeID = ps.PaymentTypeID
            JOIN CFG.Party p
                ON p.PartyID = ps.PartyID
            JOIN CFG.Branch b
                ON b.BranchID = pr.BranchID
            join CFG.vwCompanyAccess as vwca 
                on vwca.CompanyID=b.CompanyID
            LEFT JOIN CFG.FULLAddressForAllParties() a
                ON a.PartyID = p.PartyID
                   AND a.IsMain = 1
            LEFT JOIN CFG.Phone ph
                ON ph.PartyID = p.PartyID
                   AND ph.IsMain = 1
            LEFT JOIN #HCForoushandeType1Code AS hc
                ON hc.EntityID = p.PartyID
            LEFT JOIN #ArzType AS atype
                ON atype.EntityID = ps.CurrencyID
            LEFT JOIN ACC.VWVoucherPrevoucher PIVoucher
                ON pr.PreVoucherID = PIVoucher.PrevoucherID
                   AND PIVoucher.VoucherStatus = 'Survey'
        WHERE pr.FinancialPeriodID = @FinancialPeriod
              AND b.CompanyID=@CompanyId
              AND pt.AnnouncedInAdditionalValue = 1
              AND
              (
                  (
                      @DateInPurchaseDocuments <> 2
                      AND pr.Date
              BETWEEN @fromDate AND @toDate
                  )
                  OR
                  (
                      @DateInPurchaseDocuments = 2
                      AND PIVoucher.[Date] IS NOT NULL
                      AND PIVoucher.[Date]
              BETWEEN @fromDate AND @toDate
                  )
              )
              and vwca.UserID=@UserID;


        --PettyCashCost
        INSERT INTO [CFG].[SeasonFile]
        (
            [FinancialPeriodID],
            [Season],
            [AutoGenerated],
            [DOCType],
            [DocName],
            [ID],
            [StuffTitle],
            [LessThanQuorum],
            [Amount],
            [Tax],
            [Duty],
            [Discount],
            [ZipCode],
            [PreNumberOfCity],
            [Phone],
            [Address],
            [PartyFirstName],
            [PartyLastName],
            [EconomicCode],
            [NationalID],
            [HCType1Code],
            [provinceCode],
            [cityCode],
            [Type],
            [Number],
            [Date],
            [TradeType],
            [BranchCode],
            [BranchTitle],
            [Version],
            [Creator],
            [CreationDate],
            [LastEditor],
            [LastEditionDate],
            ArzType,
            Arz_Price,
            Arz_MaliatArzeshAfzoodeh,
            Arz_AvarezArzeshAfzoodeh,
            Arz_SayerAvarez,
            Arz_TakhfifPrice,
            ArzBarabari_Price,
            ArzBarabari_MaliatArzeshAfzoodeh,
            ArzBarabari_AvarezArzeshAfzoodeh,
            ArzBarabari_SayerAvarez,
            ArzBarabari_TakhfifPrice,
            FactorNo,
            FactorDate,
            SarFaslType,
            IsArzi,
            KalaType,
            SaleTypeTitle,
            StartDate,
            FinishDate,
            CompanyID
        )
        SELECT @FinancialPeriod,
               @Season,
               1,
               3 DOCType,
               'PettyCashCost',
               CAST(pcc.PettyCashCostID AS BIGINT) ID,
               CASE @CultureNo
                   WHEN 1 THEN
                       pt.Title
                   WHEN 2 THEN
                       pt.Title2
               END AS StuffTitle,
               0,
               ISNULL((pcci.Amount) * pcc.CurrencyRate, 0) Amount,
               ISNULL(0, 0) Tax,
               ISNULL(0, 0) Duty,
               ISNULL(0, 0) Discount,
               a.ZipCode,
               a.PreNumber PreNumberOfCity,
               ph.Phone,
               a.Address,
               CASE p.Type
                   WHEN 0 THEN
                       CASE @CultureNo
                           WHEN 1 THEN
                               p.Title
                           WHEN 2 THEN
                               p.Title2
                       END
               END PartyFirstName,
               CASE p.Type
                   WHEN 1 THEN
                       CASE @CultureNo
                           WHEN 1 THEN
                               p.Title
                           WHEN 2 THEN
                               p.Title2
                       END
                   WHEN 2 THEN
                       CASE @CultureNo
                           WHEN 1 THEN
                               p.Title
                           WHEN 2 THEN
                               p.Title2
                       END
                   WHEN 0 THEN
                       CASE @CultureNo
                           WHEN 1 THEN
                               p.LastName
                           WHEN 2 THEN
                               p.LastName2
                       END
               END PartyLastName,
               p.EconomicCode,
               CASE
                   WHEN p.Type = 1 THEN
                       CAST(p.NationalID AS VARCHAR(MAX))
                   WHEN p.Type = 0 THEN
                       p.IdentificationCode
               END NationalID,
               hc.Value AS HCKharidarType1Code,
               a.provinceMinistryCode provinceCode,
               a.cityMinistryCode cityCode,
               1,
               pcc.Number,
               CFG.GetCLRSaturnDate(pcc.[Date], 'YYYY/MM/DD', 0, 0),
               CAST(CASE
                        WHEN p.Type = 0 THEN
                            1
                        ELSE
                            2
                    END AS TINYINT) AS TradeType,
               b.Code AS BranchCode,
               CASE @CultureNo
                   WHEN 1 THEN
                       b.Title
                   WHEN 2 THEN
                       b.Title2
               END AS BranchTitle,
               0,
               @User,
               @CurrentDate,
               @User,
               @CurrentDate,
               CASE
                   WHEN pc.CurrencyID = -1 THEN
                       NULL
                   ELSE
                       atype.Value
               END,
               CASE
                   WHEN pc.CurrencyID = -1 THEN
                       NULL
                   ELSE
                       ISNULL(   (pcci.Amount), --* i.CurrencyRate
                                 0
                             )
               END,
               CASE
                   WHEN pc.CurrencyID = -1 THEN
                       NULL
                   ELSE
                       0 --* i.CurrencyRate
               END,
               CASE
                   WHEN pc.CurrencyID = -1 THEN
                       NULL
                   ELSE
                       0 --* i.CurrencyRate
               END,
               0,
               CASE
                   WHEN pc.CurrencyID = -1 THEN
                       NULL
                   ELSE
                       0 --*i.CurrencyRate
               END,
               CASE
                   WHEN pc.CurrencyID = -1 THEN
                       NULL
                   ELSE
                       pcc.CurrencyRate
               END,
               CASE
                   WHEN pc.CurrencyID = -1 THEN
                       NULL
                   ELSE
                       pcc.CurrencyRate
               END,
               CASE
                   WHEN pc.CurrencyID = -1 THEN
                       NULL
                   ELSE
                       pcc.CurrencyRate
               END,
               CASE
                   WHEN pc.CurrencyID = -1 THEN
                       NULL
                   ELSE
                       pcc.CurrencyRate
               END,
               CASE
                   WHEN pc.CurrencyID = -1 THEN
                       NULL
                   ELSE
                       pcc.CurrencyRate
               END,
               NULL, --pcc.Number,
               NULL, --CFG.GetCLRSaturnDate(pcc.[Date], 'YYYY/MM/DD', 0, 0),
               3,
               CASE
                   WHEN pc.CurrencyID = -1 THEN
                       0
                   ELSE
                       1
               END,
               12,
               N'خرید نقدی',
               @fromDate,
               @toDate,
               @CompanyId
        FROM FIN.PettyCashCost AS pcc
            INNER JOIN FIN.PettyCashCostItem AS pcci
                ON pcci.PettyCashCostID = pcc.PettyCashCostID
            INNER JOIN FIN.PaymentType AS pt
                ON pt.PaymentTypeID = pcci.PaymentTypeID
            INNER JOIN FIN.PettyCash AS pc
                ON pc.PettyCashID = pcc.PettyCashID
            JOIN CFG.Party p
                ON p.PartyID = pcci.PartyID
            JOIN CFG.Branch b
                ON b.BranchID = pcc.BranchID
            join CFG.vwCompanyAccess as vwca 
                on vwca.CompanyID=b.CompanyID
            LEFT JOIN CFG.FULLAddressForAllParties() a
                ON a.PartyID = p.PartyID
                   AND a.IsMain = 1
            LEFT JOIN CFG.Phone ph
                ON ph.PartyID = p.PartyID
                   AND ph.IsMain = 1
            LEFT JOIN #HCForoushandeType1Code AS hc
                ON hc.EntityID = p.PartyID
            LEFT JOIN #ArzType AS atype
                ON atype.EntityID = pc.CurrencyID
            LEFT JOIN ACC.VWVoucherPrevoucher PIVoucher
                ON pcc.PreVoucherID = PIVoucher.PrevoucherID
                   AND PIVoucher.VoucherStatus = 'Survey'
        WHERE pcc.FinancialPeriodID = @FinancialPeriod
              AND pt.AnnouncedInAdditionalValue = 1
              AND b.CompanyID=@CompanyId
              AND
              (
                  (
                      @DateInPurchaseDocuments <> 2
                      AND pcc.Date
              BETWEEN @fromDate AND @toDate
                  )
                  OR
                  (
                      @DateInPurchaseDocuments = 2
                      AND PIVoucher.[Date] IS NOT NULL
                      AND PIVoucher.[Date]
              BETWEEN @fromDate AND @toDate
                  )
              )
              and vwca.UserID=@UserID;

        ----------------------واردات
        SELECT ci.Amount,
               ci.CurrencyRate,
               bi.PurchaseInvoiceItemID,
               c.CotajNumber,
               c.CotajDate,
               entrance.Code EntranceCustomsCode,
               assessment.Code AssessmentCustomsCode,
               lc.LetterCreditNumber,
               lc.OpeningCreditDate,
               customsCost.Tax,
               customsCost.Duty
        INTO #clearances
        FROM FOS.ClearanceItem ci
            JOIN FOS.BillOfLadingItem bi
                ON ci.BillOfLadingItemID = bi.BillOfLadingItemID
            JOIN VND.PurchaseInvoiceItem i
                ON i.PurchaseInvoiceItemID = bi.PurchaseInvoiceItemID
            JOIN FOS.Clearance c
                ON ci.ClearanceID = c.ClearanceID
            join CFG.Branch as b
                on b.BranchID=c.BranchID
            join CFG.vwCompanyAccess as vwca 
                on vwca.CompanyID=b.CompanyID
            JOIN CFG.Customs entrance
                ON c.EntranceCustomsID = entrance.CustomsID
            JOIN CFG.Customs assessment
                ON c.AssessmentCustomsID = assessment.CustomsID
            LEFT JOIN
            (
                SELECT ccc.ClearanceItemID,
                       SUM(   CASE
                                  WHEN sc.ValueAddedTax = 1 THEN
                                      ccc.Amount
                                  ELSE
                                      0
                              END
                          ) AS Tax,
                       SUM(   CASE
                                  WHEN sc.ValueAddedDuty = 1 THEN
                                      ccc.Amount
                                  ELSE
                                      0
                              END
                          ) AS Duty
                FROM FOS.ClearanceCustomsCost ccc
                    JOIN FOS.SpecialCost sc
                        ON ccc.SpecialCostID = sc.SpecialCostID
                GROUP BY ccc.ClearanceItemID
            ) customsCost
                ON ci.ClearanceItemID = customsCost.ClearanceItemID
            LEFT JOIN
            (
                SELECT sub.ProformaInvoiceID,
                       sub.LetterCreditNumber,
                       sub.OpeningCreditDate
                FROM
                (
                    SELECT ProformaInvoiceID,
                           LetterCreditNumber,
                           OpeningCreditDate,
                           ROW_NUMBER() OVER (PARTITION BY ProformaInvoiceID ORDER BY Date) AS rn
                    FROM FOS.LetterCredit
                ) sub
                WHERE sub.rn = 1
            ) lc
                ON i.ProformaInvoiceItemID = lc.ProformaInvoiceID
        WHERE SUBSTRING(
                           CFG.GetCLRSaturnDate(c.Date, 'YYYY/MM/DD', 1, 0),
                           CHARINDEX('/', CFG.GetCLRSaturnDate(c.Date, 'YYYY/MM/DD', 1, 0), 1) + 1,
                           2
                       )IN
              (
                  SELECT value FROM CFG.R_FnCommaStr2Table(@Month)
              )
              AND c.Date
              BETWEEN @fromDate AND @toDate
              and b.CompanyID=@CompanyId
              and vwca.UserID=@UserID;

        SELECT i.BaseType,
               ii.PurchaseInvoiceItemID,
               @FinancialPeriod FinancialPeriodID,
               @Season Season,
               1 AS AutoGenerated,
               'PurchaseInvoice' AS DocName,
               CAST(i.PurchaseInvoiceID AS BIGINT) ID,
               CASE @CultureNo
                   WHEN 1 THEN
                       s.Title
                   WHEN 2 THEN
                       s.Title2
               END AS StuffTitle,
               0 LessThanQuorum,
               ISNULL(ROUND(ii.Price * i.CurrencyRate, @baseCurrenncyPercisionCount), 0) Amount,
               ISNULL(ROUND(ii.Tax * i.CurrencyRate, @baseCurrenncyPercisionCount), 0)
               + ISNULL(ROUND(ii.Duty * i.CurrencyRate, @baseCurrenncyPercisionCount), 0) Tax,
               0 Duty,
               ISNULL(ROUND(ii.Discount * i.CurrencyRate, @baseCurrenncyPercisionCount), 0) Discount,
               a.ZipCode,
               a.PreNumber PreNumberOfCity,
               ph.Phone,
               a.Address,
               CASE p.Type
                   WHEN 0 THEN
                       CASE @CultureNo
                           WHEN 1 THEN
                               p.Title
                           WHEN 2 THEN
                               p.Title2
                       END
                   ELSE
                       NULL
               END PartyFirstName,
               CASE p.Type
                   WHEN 0 THEN
                       CASE
                           WHEN @CultureNo = 1 THEN
                               p.LastName
                           WHEN @CultureNo = 2 THEN
                               p.LastName2
                       END
                   ELSE
                       CASE
                           WHEN @CultureNo = 1 THEN
                               p.Title
                           WHEN @CultureNo = 2 THEN
                               p.Title2
                       END
               END PartyLastName,
               p.EconomicCode,
               CASE
                   WHEN p.Type = 1 THEN
                       CAST(p.NationalID AS VARCHAR(MAX))
                   WHEN p.Type = 0 THEN
                       p.IdentificationCode
               END NationalID,
               hc.Value AS HCType1Code,
               a.countyMinistryCode AS countryCode,
               a.provinceMinistryCode provinceCode,
               a.cityMinistryCode cityCode,
               CAST(CASE
                        WHEN pt.[Type] = 0 THEN
                            1
                        ELSE
                            0
                    END AS BIT) [Type],
               i.Number,
               i.Date MiladiDate,
               CFG.GetCLRSaturnDate(i.Date, 'YYYY/MM/DD', 0, 0) [Date],
               CAST(CASE
                        WHEN p.Type = 0 THEN
                            1
                        ELSE
                            2
                    END AS TINYINT) AS TradeType,
               b.Code AS BranchCode,
               CASE @CultureNo
                   WHEN 1 THEN
                       b.Title
                   WHEN 2 THEN
                       b.Title2
               END AS BranchTitle,
               0 Version,
               @User Creator,
               @CurrentDate CreationDate,
               @User LastEditor,
               @CurrentDate LastEditionDate,
               CASE
                   WHEN i.CurrencyID = -1 THEN
                       NULL
                   ELSE
                       atype.Value
               END AS ArzType,
               CASE
                   WHEN i.CurrencyID = -1 THEN
                       NULL
                   ELSE
                       ii.Price --* i.CurrencyRate
               END AS Arz_Price,
               CASE
                   WHEN i.CurrencyID = -1 THEN
                       NULL
                   ELSE
                       ii.Tax --* i.CurrencyRate
               END + CASE
                         WHEN i.CurrencyID = -1 THEN
                             NULL
                         ELSE
                             ii.Duty --* i.CurrencyRate
                     END Arz_MaliatArzeshAfzoodeh,
               0 Arz_AvarezArzeshAfzoodeh,
               0 Arz_SayerAvarez,
               CASE
                   WHEN i.CurrencyID = -1 THEN
                       NULL
                   ELSE
                       ii.Discount --* i.CurrencyRate
               END AS Arz_TakhfifPrice,
               CASE
                   WHEN i.CurrencyID = -1 THEN
                       NULL
                   ELSE
                       i.CurrencyRate
               END AS ArzBarabari_Price,
               CASE
                   WHEN i.CurrencyID = -1 THEN
                       NULL
                   ELSE
                       i.CurrencyRate
               END AS ArzBarabari_MaliatArzeshAfzoodeh,
               CASE
                   WHEN i.CurrencyID = -1 THEN
                       NULL
                   ELSE
                       i.CurrencyRate
               END AS ArzBarabari_AvarezArzeshAfzoodeh,
               CASE
                   WHEN i.CurrencyID = -1 THEN
                       NULL
                   ELSE
                       i.CurrencyRate
               END AS ArzBarabari_SayerAvarez,
               CASE
                   WHEN i.CurrencyID = -1 THEN
                       NULL
                   ELSE
                       i.CurrencyRate
               END AS ArzBarabari_TakhfifPrice,
               i.InvoiceNumber FactorNo,
               CFG.GetCLRSaturnDate(i.InvoiceDate, 'YYYY/MM/DD', 0, 0) FactorDate,
               1 AS SarFaslType,
               CASE
                   WHEN i.CurrencyID = -1 THEN
                       0
                   ELSE
                       1
               END AS IsArzi,
               #KalaType.Value KalaType,
               CASE
                   WHEN p.Type = 0 THEN
                       p.FidaCode
                   ELSE
                       p.FidaIdCode
               END AS FidaCode,
               i.CurrencyID,
               CASE @CultureNo
                   WHEN 1 THEN
                       cu.Title
                   WHEN 2 THEN
                       cu.Title2
               END AS Currency
        INTO #Importation
        FROM VND.PurchaseInvoice i
            JOIN VND.PurchaseInvoiceItem ii
                ON i.PurchaseInvoiceID = ii.PurchaseInvoiceID
            JOIN STF.VWStuff s
                ON s.StuffID = ii.StuffID
            JOIN STF.StuffDetail AS sd
                ON sd.StuffID = s.StuffID
            JOIN CFG.Party p
                ON p.DlID = i.DlID
            JOIN CFG.Branch b
                ON b.BranchID = i.BranchID
            join CFG.vwCompanyAccess as vwca 
                on vwca.CompanyID=b.CompanyID
            JOIN VND.PurchaseType AS pt
                ON pt.PurchaseTypeID = i.[Type]
            JOIN CFG.Currency cu
                ON i.CurrencyID = cu.CurrencyID
            LEFT JOIN CFG.FULLAddressForAllParties() a
                ON p.PartyID = a.PartyID
                   AND a.IsMain = 1
            LEFT JOIN CFG.Phone ph
                ON ph.PartyID = p.PartyID
                   AND ph.IsMain = 1
            LEFT JOIN #HCForoushandeType1Code AS hc
                ON hc.EntityID = p.PartyID
            LEFT JOIN #ArzType AS atype
                ON atype.EntityID = i.CurrencyID
            LEFT JOIN #KalaType
                ON #KalaType.EntityID = ii.StuffID
        WHERE pt.[Type] = 1
              AND i.FinancialPeriodID = @FinancialPeriod
              AND b.CompanyID=@CompanyId
              and vwca.UserID=@UserID;

        --خریدهائی که از طریق سفارشات خارجی انجام می شوند
        INSERT INTO [CFG].[SeasonFile]
        (
            [FinancialPeriodID],
            [Season],
            [AutoGenerated],
            [DOCType],
            [DocName],
            [ID],
            [StuffTitle],
            [LessThanQuorum],
            [Amount],
            [Tax],
            [Duty],
            Discount,
            [ZipCode],
            [PreNumberOfCity],
            [Phone],
            [Address],
            [PartyFirstName],
            [PartyLastName],
            [EconomicCode],
            [NationalID],
            [HCType1Code],
            [provinceCode],
            [cityCode],
            [Type],
            [Number],
            [Date],
            [TradeType],
            [BranchCode],
            [BranchTitle],
            [Version],
            [Creator],
            [CreationDate],
            [LastEditor],
            [LastEditionDate],
            ArzType,
            Arz_Price,
            Arz_MaliatArzeshAfzoodeh,
            Arz_AvarezArzeshAfzoodeh,
            Arz_SayerAvarez,
            Arz_TakhfifPrice,
            ArzBarabari_Price,
            ArzBarabari_MaliatArzeshAfzoodeh,
            ArzBarabari_AvarezArzeshAfzoodeh,
            ArzBarabari_SayerAvarez,
            ArzBarabari_TakhfifPrice,
            FactorNo,
            FactorDate,
            SarFaslType,
            IsArzi,
            KalaType,
            PurchaseType,
            FidaCode,
            AmountAccordingLicense,
            Currency,
            Arz_AmountAccordingLicense,
            ArzBarabari_AmountAccordingLicense,
            CotajNumber,
            CotajDate,
            EntranceCustomsCode,
            AssessmentCustomsCode,
            LetterCreditNumber,
            OpeningCreditDate,
            CountryCode,
            StartDate,
            FinishDate,
            CompanyID
        )
        SELECT imp.FinancialPeriodID,
               imp.Season,
               imp.AutoGenerated,
               7 DOCType,
               imp.DocName,
               imp.ID,
               imp.StuffTitle,
               imp.LessThanQuorum,
               imp.Amount,
               ISNULL(clr.Tax, 0) + ISNULL(clr.Duty, 0) Tax,
               0 Duty,
               imp.Discount,
               imp.ZipCode,
               imp.PreNumberOfCity,
               imp.Phone,
               imp.Address,
               imp.PartyFirstName,
               imp.PartyLastName,
               imp.EconomicCode,
               imp.NationalID,
               imp.HCType1Code,
               imp.provinceCode,
               imp.cityCode,
               imp.Type,
               imp.Number,
               imp.Date,
               imp.TradeType,
               imp.BranchCode,
               imp.BranchTitle,
               imp.Version,
               imp.Creator,
               imp.CreationDate,
               imp.LastEditor,
               imp.LastEditionDate,
               imp.ArzType,
               imp.Arz_Price,
               0 Arz_MaliatArzeshAfzoodeh,
               0 Arz_AvarezArzeshAfzoodeh,
               imp.Arz_SayerAvarez,
               imp.Arz_TakhfifPrice,
               imp.ArzBarabari_Price,
               imp.ArzBarabari_MaliatArzeshAfzoodeh,
               imp.ArzBarabari_AvarezArzeshAfzoodeh,
               imp.ArzBarabari_SayerAvarez,
               imp.ArzBarabari_TakhfifPrice,
               imp.FactorNo,
               imp.FactorDate,
               imp.SarFaslType,
               imp.IsArzi,
               ISNULL(imp.KalaType, 0),
               1 PurchaseType,
               imp.FidaCode,
               ISNULL(ROUND(clr.Amount * clr.CurrencyRate, @baseCurrenncyPercisionCount), 0) AmountAccordingLicense,
               imp.Currency,
               CASE
                   WHEN imp.CurrencyID = -1 THEN
                       NULL
                   ELSE
                       clr.Amount
               END AS Arz_AmountAccordingLicense,
               clr.CurrencyRate ArzBarabari_AmountAccordingLicense,
               clr.CotajNumber,
               CFG.GetCLRSaturnDate(clr.CotajDate, 'YYYY/MM/DD', 0, 0) CotajDate,
               clr.EntranceCustomsCode,
               clr.AssessmentCustomsCode,
               clr.LetterCreditNumber,
               CFG.GetCLRSaturnDate(clr.OpeningCreditDate, 'YYYY/MM/DD', 0, 0) OpeningCreditDate,
               imp.countryCode,
               @fromDate,
               @toDate,
               @CompanyId
        FROM #Importation imp
            JOIN #clearances clr
                ON imp.PurchaseInvoiceItemID = clr.PurchaseInvoiceItemID
        WHERE imp.BaseType = 9;

        --خریدهائی که وارداتی بوده ولی بر مبنای پروفرما نمی باشند
        INSERT INTO [CFG].[SeasonFile]
        (
            [FinancialPeriodID],
            [Season],
            [AutoGenerated],
            [DOCType],
            [DocName],
            [ID],
            [StuffTitle],
            [LessThanQuorum],
            [Amount],
            [Tax],
            [Duty],
            Discount,
            [ZipCode],
            [PreNumberOfCity],
            [Phone],
            [Address],
            [PartyFirstName],
            [PartyLastName],
            [EconomicCode],
            [NationalID],
            [HCType1Code],
            [provinceCode],
            [cityCode],
            [Type],
            [Number],
            [Date],
            [TradeType],
            [BranchCode],
            [BranchTitle],
            [Version],
            [Creator],
            [CreationDate],
            [LastEditor],
            [LastEditionDate],
            ArzType,
            Arz_Price,
            Arz_MaliatArzeshAfzoodeh,
            Arz_AvarezArzeshAfzoodeh,
            Arz_SayerAvarez,
            Arz_TakhfifPrice,
            ArzBarabari_Price,
            ArzBarabari_MaliatArzeshAfzoodeh,
            ArzBarabari_AvarezArzeshAfzoodeh,
            ArzBarabari_SayerAvarez,
            ArzBarabari_TakhfifPrice,
            FactorNo,
            FactorDate,
            SarFaslType,
            IsArzi,
            KalaType,
            PurchaseType,
            FidaCode,
            Currency,
            CountryCode,
            StartDate,
            FinishDate,
            CompanyID
        )
        SELECT imp.FinancialPeriodID,
               imp.Season,
               imp.AutoGenerated,
               8 DOCType,
               imp.DocName,
               imp.ID,
               imp.StuffTitle,
               imp.LessThanQuorum,
               imp.Amount,
               imp.Tax,
               imp.Duty,
               imp.Discount,
               imp.ZipCode,
               imp.PreNumberOfCity,
               imp.Phone,
               imp.Address,
               imp.PartyFirstName,
               imp.PartyLastName,
               imp.EconomicCode,
               imp.NationalID,
               imp.HCType1Code,
               imp.provinceCode,
               imp.cityCode,
               imp.Type,
               imp.Number,
               imp.Date,
               imp.TradeType,
               imp.BranchCode,
               imp.BranchTitle,
               imp.Version,
               imp.Creator,
               imp.CreationDate,
               imp.LastEditor,
               imp.LastEditionDate,
               imp.ArzType,
               imp.Arz_Price,
               imp.Arz_MaliatArzeshAfzoodeh,
               imp.Arz_AvarezArzeshAfzoodeh,
               imp.Arz_SayerAvarez,
               imp.Arz_TakhfifPrice,
               imp.ArzBarabari_Price,
               imp.ArzBarabari_MaliatArzeshAfzoodeh,
               imp.ArzBarabari_AvarezArzeshAfzoodeh,
               imp.ArzBarabari_SayerAvarez,
               imp.ArzBarabari_TakhfifPrice,
               imp.FactorNo,
               imp.FactorDate,
               imp.SarFaslType,
               imp.IsArzi,
               ISNULL(imp.KalaType, 0),
               2 PurchaseType,
               imp.FidaCode,
               imp.Currency,
               imp.countryCode,
               @fromDate,
               @toDate,
               @CompanyId
        FROM #Importation imp
        WHERE imp.BaseType <> 9
              AND imp.MiladiDate
              BETWEEN @fromDate AND @toDate;

        -----------------------مدیریت امور پیمان - پیمانکاران----------------------
        INSERT CFG.SeasonFile
        (
            FinancialPeriodID,
            Season,
            AutoGenerated,
            DOCType,
            DocName,
            ID,
            StuffTitle,
            LessThanQuorum,
            Amount,
            Tax,
            Duty,
            ZipCode,
            PreNumberOfCity,
            Phone,
            Address,
            PartyFirstName,
            PartyLastName,
            EconomicCode,
            NationalID,
            HCType1Code,
            provinceCode,
            cityCode,
            Type,
            Number,
            Date,
            TradeType,
            BranchCode,
            BranchTitle,
            Version,
            Creator,
            CreationDate,
            LastEditor,
            LastEditionDate,
            Discount,
            ArzType,
            Arz_Price,
            Arz_MaliatArzeshAfzoodeh,
            Arz_AvarezArzeshAfzoodeh,
            Arz_SayerAvarez,
            Arz_TakhfifPrice,
            ArzBarabari_Price,
            ArzBarabari_MaliatArzeshAfzoodeh,
            ArzBarabari_AvarezArzeshAfzoodeh,
            ArzBarabari_SayerAvarez,
            ArzBarabari_TakhfifPrice,
            FactorNo,
            FactorDate,
            SarFaslType,
            Sarjam,
            IsHagholAmalKari,
            IsArzi,
            KalaType,
            SaleTypeTitle,
            PurchaseType,
            FidaCode,
            AmountAccordingLicense,
            Currency,
            Arz_AmountAccordingLicense,
            ArzBarabari_AmountAccordingLicense,
            CotajNumber,
            CotajDate,
            EntranceCustomsCode,
            AssessmentCustomsCode,
            LetterCreditNumber,
            OpeningCreditDate,
            CountryCode,
            Nationality,
            PayDate,
            GrossPrice,
            NetPrice,
            TaxDeducted,
            ContractNumber,
            StartDate,
            FinishDate,
            CompanyID
        )
        SELECT @FinancialPeriod,
               @Season,
               1,
               9,
               N'ConfirmStatement',
               t.ID,
               SUBSTRING(t.GharardadSubject, 1, 50),
               0,
               NULL,
               NULL,
               NULL,
               t.P_PostCode,
               t.P_TellPishCode,
               t.P_Tell,
               t.P_Address,
               t.P_Name,
               t.P_LastNameSherkatName,
               t.P_EconomicNO,
               t.P_NationalCode,
               t.P_TypeCode,
               t.StateCode,
               t.CityCode,
               NULL,
               NULL,
               t.GharardadDate,
               NULL,
               t.BranchCode,
               t.BranchTitle,
               0,
               @User,
               @CurrentDate,
               @User,
               @CurrentDate,
               NULL,
               t.ArzType,
               t.TotalPrice,
               t.MaliatArzeshAfzoodeh,
               t.AvarezArzeshAfzoodeh,
               t.SayerAvarez,
               NULL,
               t.ArzBarabari_NaKhales,
               t.ArzBarabari_NaKhales,
               t.ArzBarabari_NaKhales,
               t.ArzBarabari_NaKhales,
               t.ArzBarabari_NaKhales,
               t.SuratVaziatNumber,
               t.SuratVaziatDate,
               NULL,
               0,
               0,
               CASE
                   WHEN t.CurrencyID = -1 THEN
                       0
                   ELSE
                       1
               END AS IsArzi,
               NULL,
               NULL,
               NULL,
               NULL,
               NULL,
               t.Currency,
               NULL,
               NULL,
               NULL,
               NULL,
               NULL,
               NULL,
               NULL,
               NULL,
               NULL,
               t.p_Tabeiat,
               t.PardakhtDate,
               t.Nakhales,
               t.KhalesPrice,
               t.MaliatMaksooreh,
               t.GharardadNumber,
               @fromDate,
               @toDate,
               @CompanyId
        FROM
        (
            SELECT cs.ConfirmStatementID ID,
                   CASE p.Type
                       WHEN 0 THEN
                           1
                       ELSE
                           2
                   END AS P_TypeCode,
                   CASE p.Type
                       WHEN 0 THEN
                           CASE @CultureNo
                               WHEN 1 THEN
                                   p.Title
                               WHEN 2 THEN
                                   p.Title2
                           END
                       ELSE
                           NULL
                   END AS P_Name,
                   CASE p.Type
                       WHEN 0 THEN
                           CASE @CultureNo
                               WHEN 1 THEN
                                   p.LastName
                               WHEN 2 THEN
                                   p.LastName2
                           END
                       ELSE
                           CASE @CultureNo
                               WHEN 1 THEN
                                   p.Title
                               WHEN 2 THEN
                                   p.Title2
                           END
                   END AS P_LastNameSherkatName,
                   CASE pt.Code
                       WHEN 1 THEN
                           1
                       ELSE
                           2
                   END p_Tabeiat,
                   CASE p.Type
                       WHEN 0 THEN
                           p.IdentificationCode
                       ELSE
                           p.NationalID
                   END AS P_NationalCode,
                   p.EconomicCode AS P_EconomicNO,
                   fp.ZipCode AS P_PostCode,
                   fp.PreNumber AS P_TellPishCode,
                   ph.Phone AS P_Tell,
                   fp.[Address] AS P_Address,
                   fp.provinceMinistryCode AS StateCode,
                   fp.cityMinistryCode AS CityCode,
                   CFG.GetCLRSaturnDate(ContractStatement.[Date], 'YYYY/MM/DD', 0, 0) AS GharardadDate,
                   ContractStatement.Number AS GharardadNumber,
                   ContractStatement.Title AS GharardadSubject,
                   sub.Amount AS TotalPrice,
                   ContractStatement.ContractStatementNumber AS SuratVaziatNumber,
                   CFG.GetCLRSaturnDate(ContractStatement.EndDate, 'YYYY/MM/DD', 0, 0) AS SuratVaziatDate,
                   CFG.GetCLRSaturnDate(   CASE
                                               WHEN cs.[Date] < @fromDate THEN
                                                   @fromDate
                                               ELSE
                                                   cs.[Date]
                                           END,
                                           'YYYY/MM/DD',
                                           0,
                                           0
                                       ) AS PardakhtDate,
                   ContractStatement.TotalAmount AS Nakhales,
                   ContractStatement.TotalAmount - ISNULL(cfi.DeductionAmount, 0) AS KhalesPrice,
                   ISNULL(cfi.DeductionAmount, 0) AS MaliatMaksooreh,
                   ISNULL(ContractStatement.TotalTax, 0) + ISNULL(ContractStatement.TotalDuty, 0) AS MaliatArzeshAfzoodeh,
                   0 AS AvarezArzeshAfzoodeh,
                   CASE
                       WHEN ContractStatement.CurrencyID = -1 THEN
                           0
                       ELSE
                           NULL
                   END AS SayerAvarez,
                   CASE
                       WHEN ContractStatement.CurrencyID <> -1 THEN
                           cur.Code
                       ELSE
                           NULL
                   END AS ArzType,
                   CASE
                       WHEN ContractStatement.CurrencyID <> -1 THEN
                           cs.CurrencyRate
                       ELSE
                           NULL
                   END AS ArzBarabari_NaKhales,
                   ContractStatement.CurrencyID,
                   CASE @CultureNo
                       WHEN 1 THEN
                           cu.Title
                       WHEN 2 THEN
                           cu.Title2
                   END AS Currency,
                   b2.Code AS BranchCode,
                   CASE
                       WHEN @CultureNo = 1 THEN
                           b2.Title
                       WHEN @CultureNo = 2 THEN
                           b2.Title2
                   END AS BranchTitle
            FROM CNT.ConfirmStatement AS cs
                LEFT JOIN
                (
                    SELECT csi2.ConfirmStatementID,
                           SUM(csi2.Deduction) AS DeductionAmount
                    FROM CNT.ConfirmStatementItem AS csi2
                        JOIN CNT.AdditionDeductionType adt
                            ON adt.AdditionDeductionTypeID = csi2.AdditionDeductionTypeID
                    WHERE adt.Criterion = 1
                    GROUP BY csi2.ConfirmStatementID
                ) AS cfi
                    ON cfi.ConfirmStatementID = cs.ConfirmStatementID
                JOIN
                (
                    SELECT s.ContractStatementID,
                           s.CurrencyID,
                           a.BranchID,
                           s.PartyID,
                           s.ContractID,
                           a.CompanyRoll,
                           a.Date,
                           a.Number,
                           CASE
                               WHEN @CultureNo = 1 THEN
                                   a.Title
                               WHEN @CultureNo = 2 THEN
                                   a.Title2
                           END AS Title,
                           s.ContractStatementNumber,
                           s.EndDate,
                           s.TotalAmount,
                           ISNULL(s.tax, 0) + ISNULL(s.duty, 0) AS TotalTax,
                           0 AS TotalDuty
                    FROM CNT.[Contract] a
                        JOIN
                        (
                            SELECT a.ContractID,
                                   a.ContractStatementID,
                                   a.EndDate,
                                   a.CurrencyID,
                                   a.PartyID,
                                   a.ContractStatementNumber,
                                   SUM(   CASE
                                              WHEN a.StatementDeliverySection = 1 THEN
                                                  a.Amount - ISNULL(o.Amount, 0)
                                              ELSE
                                                  a.Amount
                                          END
                                      ) AS TotalAmount,
                                   SUM(a.tax) + SUM(a.duty) tax,
                                   0 duty
                            FROM
                            (
                                SELECT a.ContractStatementID,
                                       b.EndDate,
                                       b.CurrencyID,
                                       b.PartyID,
                                       b.Number ContractStatementNumber,
                                       a.ContractSubjectID,
                                       a.Amount,
                                       a.Tax + a.Duty AS tax,
                                       0 AS duty,
                                       c.ContractID,
                                       c.StatementDeliverySection
                                FROM CNT.ContractStatementItem a
                                    JOIN CNT.ContractStatement b
                                        ON a.ContractStatementID = b.ContractStatementID
                                    JOIN CNT.[Contract] c
                                        ON c.ContractID = b.ContractID
                            ) a
                                OUTER APPLY
                            (
                                SELECT TOP 1
                                       csi.ContractSubjectID,
                                       csi.Amount
                                FROM CNT.ContractStatementItem AS csi
                                    JOIN CNT.ContractStatement AS cs2
                                        ON cs2.ContractStatementID = csi.ContractStatementID
                                WHERE cs2.Number < a.ContractStatementNumber
                                      AND csi.ContractSubjectID = a.ContractSubjectID
                                ORDER BY cs2.Number DESC
                            ) o
                            GROUP BY a.ContractID,
                                     a.ContractStatementID,
                                     a.EndDate,
                                     a.CurrencyID,
                                     a.PartyID,
                                     a.ContractStatementNumber
                        ) s
                            ON s.ContractID = a.ContractID
                ) ContractStatement
                    ON ContractStatement.ContractStatementID = cs.ContractStatementID
                JOIN CFG.Currency AS cu
                    ON cu.CurrencyID = ContractStatement.CurrencyID
                JOIN CFG.Branch AS b2
                    ON b2.BranchID = ContractStatement.BranchID
            join CFG.vwCompanyAccess as vwca 
                on vwca.CompanyID=b2.CompanyID
                LEFT JOIN
                (
                    SELECT ecfd.EntityID,
                           ldi.Code
                    FROM CFG.EntityCustomeField AS ecf
                        JOIN CFG.EntityCustomeFieldData AS ecfd
                            ON ecfd.EntityCustomeFieldID = ecf.EntityCustomeFieldID
                        JOIN CFG.LookupDataItem AS ldi
                            ON ldi.LookupDataItemID = ecfd.LookupDataItemID
                    WHERE ecf.FieldName = 'ArzType'
                          AND ecf.EntityName = 'Currency'
                ) AS cur
                    ON cur.EntityID = ContractStatement.CurrencyID
                LEFT JOIN
                (
                    SELECT cs3.ContractID,
                           SUM(cs3.Price) AS Amount
                    FROM CNT.VWContractSubject AS cs3
                    WHERE cs3.stuffid IS NULL
                    GROUP BY cs3.ContractID
                ) AS sub
                    ON sub.ContractID = ContractStatement.ContractID
                JOIN CFG.Party AS p
                    ON p.PartyID = ContractStatement.PartyID
                LEFT JOIN CFG.Phone ph
                    ON ph.PartyID = p.PartyID
                       AND ph.IsMain = 1
                LEFT JOIN CFG.FULLAddressForAllParties() AS fp
                    ON fp.PartyID = ContractStatement.PartyID
                       AND fp.IsMain = 1
                JOIN
                (
                    SELECT ldi.LookupDataItemID,
                           ldi.Code,
                           CASE @CultureNo
                               WHEN 1 THEN
                                   ldi.Title
                               WHEN 2 THEN
                                   ldi.Title2
                           END Title
                    FROM CFG.LookupData AS ld
                        JOIN CFG.LookupDataItem AS ldi
                            ON ldi.LookupDataID = ld.LookupDataID
                    WHERE ld.SystemName = 'nationality'
                ) pt
                    ON pt.LookupDataItemID = p.Nationality
                LEFT JOIN ACC.VWVoucherPrevoucher PIVoucher
                    ON cs.PreVoucherID = PIVoucher.PrevoucherID
                       AND PIVoucher.VoucherStatus = 'Survey'
            WHERE ContractStatement.CompanyRoll = 1
                  AND b2.CompanyID=@CompanyId
                  and vwca.UserID=@UserID
                  AND cs.FinancialPeriodID = @FinancialPeriod
                  AND
                  (
                      (
                          @DateInPurchaseDocuments <> 2
                          AND cs.Date
                  BETWEEN @fromDate AND @toDate
                      )
                      OR
                      (
                          @DateInPurchaseDocuments = 2
                          AND PIVoucher.[Date] IS NOT NULL
                          AND PIVoucher.[Date]
                  BETWEEN @fromDate AND @toDate
                      )
                  )
        ) AS t;

        --------مدیریت امور پیمان - کارفرمایان---------------
        INSERT CFG.SeasonFile
        (
            FinancialPeriodID,
            Season,
            AutoGenerated,
            DOCType,
            DocName,
            ID,
            StuffTitle,
            LessThanQuorum,
            Amount,
            Tax,
            Duty,
            ZipCode,
            PreNumberOfCity,
            Phone,
            Address,
            PartyFirstName,
            PartyLastName,
            EconomicCode,
            NationalID,
            HCType1Code,
            provinceCode,
            cityCode,
            Type,
            Number,
            Date,
            TradeType,
            BranchCode,
            BranchTitle,
            Version,
            Creator,
            CreationDate,
            LastEditor,
            LastEditionDate,
            Discount,
            ArzType,
            Arz_Price,
            Arz_MaliatArzeshAfzoodeh,
            Arz_AvarezArzeshAfzoodeh,
            Arz_SayerAvarez,
            Arz_TakhfifPrice,
            ArzBarabari_Price,
            ArzBarabari_MaliatArzeshAfzoodeh,
            ArzBarabari_AvarezArzeshAfzoodeh,
            ArzBarabari_SayerAvarez,
            ArzBarabari_TakhfifPrice,
            FactorNo,
            FactorDate,
            SarFaslType,
            Sarjam,
            IsHagholAmalKari,
            IsArzi,
            KalaType,
            SaleTypeTitle,
            PurchaseType,
            FidaCode,
            AmountAccordingLicense,
            Currency,
            Arz_AmountAccordingLicense,
            ArzBarabari_AmountAccordingLicense,
            CotajNumber,
            CotajDate,
            EntranceCustomsCode,
            AssessmentCustomsCode,
            LetterCreditNumber,
            OpeningCreditDate,
            CountryCode,
            Nationality,
            PayDate,
            GrossPrice,
            NetPrice,
            TaxDeducted,
            ContractNumber,
            StartDate,
            FinishDate,
            CompanyID
        )
        SELECT @FinancialPeriod,
               @Season,
               1,
               10,
               N'ConfirmStatement',
               t.ID,
               SUBSTRING(t.GharardadSubject, 1, 50),
               0,
               NULL,
               NULL,
               NULL,
               t.P_PostCode,
               t.P_TellPishCode,
               t.P_Tell,
               t.P_Address,
               t.P_Name,
               t.P_LastNameSherkatName,
               t.P_EconomicNO,
               t.P_NationalCode,
               t.P_TypeCode,
               t.StateCode,
               t.CityCode,
               NULL,
               NULL,
               t.GharardadDate,
               NULL,
               t.BranchCode,
               t.BranchTitle,
               0,
               @User,
               @CurrentDate,
               @User,
               @CurrentDate,
               NULL,
               -----------------------
               t.ArzType,
               t.TotalPrice,
               t.MaliatArzeshAfzoodeh,
               t.AvarezArzeshAfzoodeh,
               t.SayerAvarez,
               NULL,
               t.ArzBarabari_NaKhales,
               t.ArzBarabari_NaKhales,
               t.ArzBarabari_NaKhales,
               t.ArzBarabari_NaKhales,
               t.ArzBarabari_NaKhales,
               t.SuratVaziatNumber,
               t.SuratVaziatDate,
               NULL,
               0,
               0,
               CASE
                   WHEN t.CurrencyID = -1 THEN
                       0
                   ELSE
                       1
               END AS IsArzi,
               NULL,
               NULL,
               NULL,
               NULL,
               NULL,
               t.Currency,
               NULL,
               NULL,
               NULL,
               NULL,
               NULL,
               NULL,
               NULL,
               NULL,
               NULL,
               t.p_Tabeiat,
               t.PardakhtDate,
               t.Nakhales,
               t.KhalesPrice,
               t.MaliatMaksooreh,
               t.GharardadNumber,
               @fromDate,
               @toDate,
               @CompanyId
        FROM
        (
            SELECT cs.ConfirmStatementID ID,
                   CASE p.Type
                       WHEN 0 THEN
                           1
                       ELSE
                           2
                   END AS P_TypeCode,
                   CASE p.Type
                       WHEN 0 THEN
                           CASE
                               WHEN @CultureNo = 1 THEN
                                   p.Title
                               WHEN @CultureNo = 2 THEN
                                   p.Title2
                           END
                       ELSE
                           NULL
                   END AS P_Name,
                   CASE p.Type
                       WHEN 0 THEN
                           CASE
                               WHEN @CultureNo = 1 THEN
                                   p.LastName
                               WHEN @CultureNo = 2 THEN
                                   p.LastName2
                           END
                       ELSE
                           CASE
                               WHEN @CultureNo = 1 THEN
                                   p.Title
                               WHEN @CultureNo = 2 THEN
                                   p.Title2
                           END
                   END AS P_LastNameSherkatName,
                   CASE pt.Code
                       WHEN 1 THEN
                           1
                       ELSE
                           2
                   END p_Tabeiat,
                   CASE p.Type
                       WHEN 0 THEN
                           p.IdentificationCode
                       ELSE
                           p.NationalID
                   END AS P_NationalCode,
                   p.EconomicCode AS P_EconomicNO,
                   fp.ZipCode AS P_PostCode,
                   fp.PreNumber AS P_TellPishCode,
                   ph.Phone AS P_Tell,
                   fp.[Address] AS P_Address,
                   fp.provinceMinistryCode AS StateCode,
                   fp.cityMinistryCode AS CityCode,
                   CFG.GetCLRSaturnDate(ContractStatement.[Date], 'YYYY/MM/DD', 0, 0) AS GharardadDate,
                   ContractStatement.Number AS GharardadNumber,
                   ContractStatement.Title AS GharardadSubject,
                   sub.Amount AS TotalPrice,
                   ContractStatement.ContractStatementNumber AS SuratVaziatNumber,
                   CFG.GetCLRSaturnDate(ContractStatement.EndDate, 'YYYY/MM/DD', 0, 0) AS SuratVaziatDate,
                   CFG.GetCLRSaturnDate(cs.[Date], 'YYYY/MM/DD', 0, 0) AS PardakhtDate,
                   ContractStatement.TotalAmount AS Nakhales,
                   ContractStatement.TotalAmount - ISNULL(cfi.DeductionAmount, 0) AS KhalesPrice,
                   ISNULL(cfi.DeductionAmount, 0) AS MaliatMaksooreh,
                   ISNULL(ContractStatement.TotalTax, 0) + ISNULL(ContractStatement.TotalDuty, 0) AS MaliatArzeshAfzoodeh,
                   0 AS AvarezArzeshAfzoodeh,
                   CASE
                       WHEN ContractStatement.CurrencyID = -1 THEN
                           0
                       ELSE
                           NULL
                   END AS SayerAvarez,
                   CASE
                       WHEN ContractStatement.CurrencyID <> -1 THEN
                           cur.Code
                       ELSE
                           NULL
                   END AS ArzType,
                   CASE
                       WHEN ContractStatement.CurrencyID <> -1 THEN
                           cs.CurrencyRate
                       ELSE
                           NULL
                   END AS ArzBarabari_NaKhales,
                   ContractStatement.CurrencyID,
                   CASE @CultureNo
                       WHEN 1 THEN
                           cu.Title
                       WHEN 2 THEN
                           cu.Title2
                   END AS Currency,
                   b2.Code AS BranchCode,
                   CASE
                       WHEN @CultureNo = 1 THEN
                           b2.Title
                       WHEN @CultureNo = 2 THEN
                           b2.Title2
                   END AS BranchTitle
            FROM CNT.ConfirmStatement AS cs
                LEFT JOIN
                (
                    SELECT csi2.ConfirmStatementID,
                           SUM(csi2.Deduction) AS DeductionAmount
                    FROM CNT.ConfirmStatementItem AS csi2
                    GROUP BY csi2.ConfirmStatementID
                ) AS cfi
                    ON cfi.ConfirmStatementID = cs.ConfirmStatementID
                JOIN
                (
                    SELECT s.ContractStatementID,
                           cs.CurrencyID,
                           c.BranchID,
                           cs.PartyID,
                           c.ContractID,
                           c.CompanyRoll,
                           c.Date,
                           c.Number,
                           CASE
                               WHEN @CultureNo = 1 THEN
                                   c.Title
                               WHEN @CultureNo = 2 THEN
                                   c.Title2
                           END AS Title,
                           cs.Number ContractStatementNumber,
                           cs.EndDate,
                           CASE
                               WHEN c.StatementDeliverySection = 1 THEN
                                   s.Amount - ISNULL(o.Amount, 0)
                               ELSE
                                   s.Amount
                           END AS TotalAmount,
                           ISNULL(s.tax, 0) + ISNULL(s.duty, 0) AS TotalTax,
                           0 AS TotalDuty
                    FROM
                    (
                        SELECT ContractStatementID,
                               SUM(Amount) Amount,
                               SUM(Tax) + SUM(Duty) tax,
                               0 duty
                        FROM CNT.ContractStatementItem
                        GROUP BY ContractStatementID
                    ) AS s
                        JOIN CNT.ContractStatement AS cs
                            ON cs.ContractStatementID = s.ContractStatementID
                        JOIN CNT.[Contract] AS c
                            ON c.ContractID = cs.ContractID
                        OUTER APPLY
                    (
                        SELECT A.ContractID,
                               SUM(A.Amount) Amount
                        FROM
                        (
                            SELECT ROW_NUMBER() OVER (PARTITION BY cs2.ContractID ORDER BY cs2.EndDate DESC) Rno,
                                   cs2.ContractID,
                                   csi.Amount
                            FROM CNT.ContractStatementItem AS csi
                                JOIN CNT.ContractStatement AS cs2
                                    ON cs2.ContractStatementID = csi.ContractStatementID
                            WHERE cs2.EndDate < cs.EndDate
                                  AND cs2.ContractID = cs.ContractID
                        ) A
                        WHERE A.Rno = 1
                        GROUP BY A.ContractID
                    ) o
                ) ContractStatement
                    ON ContractStatement.ContractStatementID = cs.ContractStatementID
                JOIN CFG.Currency AS cu
                    ON cu.CurrencyID = ContractStatement.CurrencyID
                JOIN CFG.Branch AS b2
                    ON b2.BranchID = ContractStatement.BranchID
            join CFG.vwCompanyAccess as vwca 
                on vwca.CompanyID=b2.CompanyID
                LEFT JOIN
                (
                    SELECT ecfd.EntityID,
                           ldi.Code
                    FROM CFG.EntityCustomeField AS ecf
                        JOIN CFG.EntityCustomeFieldData AS ecfd
                            ON ecfd.EntityCustomeFieldID = ecf.EntityCustomeFieldID
                        JOIN CFG.LookupDataItem AS ldi
                            ON ldi.LookupDataItemID = ecfd.LookupDataItemID
                    WHERE ecf.FieldName = 'ArzType'
                          AND ecf.EntityName = 'Currency'
                ) AS cur
                    ON cur.EntityID = cu.CurrencyID
                LEFT JOIN
                (
                    SELECT cs3.ContractID,
                           SUM(cs3.Price) AS Amount
                    FROM CNT.ContractSubject AS cs3
                    WHERE cs3.StuffID IS NULL
                    GROUP BY cs3.ContractID
                ) AS sub
                    ON sub.ContractID = ContractStatement.ContractID
                JOIN CFG.Party AS p
                    ON p.PartyID = ContractStatement.PartyID
                LEFT JOIN CFG.Phone ph
                    ON ph.PartyID = p.PartyID
                       AND ph.IsMain = 1
                LEFT JOIN CFG.FULLAddressForAllParties() AS fp
                    ON fp.PartyID = ContractStatement.PartyID
                       AND fp.IsMain = 1
                JOIN
                (
                    SELECT ldi.LookupDataItemID,
                           ldi.Code,
                           CASE
                               WHEN @CultureNo = 1 THEN
                                   ldi.Title
                               WHEN @CultureNo = 2 THEN
                                   ldi.Title2
                           END AS Title
                    FROM CFG.LookupData AS ld
                        JOIN CFG.LookupDataItem AS ldi
                            ON ldi.LookupDataID = ld.LookupDataID
                    WHERE ld.SystemName = 'nationality'
                ) pt
                    ON pt.LookupDataItemID = p.Nationality
            WHERE ContractStatement.CompanyRoll = 2
                  AND cs.Date
                  BETWEEN @fromDate AND @toDate
                  AND b2.CompanyID=@CompanyId
                  and vwca.UserID=@UserID
        ) AS t;

        -------------------------------------------------	
        IF EXISTS
        (
            SELECT 1
            FROM CFG.SeasonFile
            WHERE FinancialPeriodID = @FinancialPeriod
                  AND Season = @Season
        )
        BEGIN
            SELECT 1;
        END;
        ELSE
        BEGIN
            SELECT 0;
        END;

    END TRY
    BEGIN CATCH
        DECLARE @ErrorSeverity INT,
                @ErrorMessage2 NVARCHAR(MAX),
                @ErrorState INT;

        SET @ErrorSeverity = ERROR_SEVERITY();
        SET @ErrorMessage2 = ERROR_MESSAGE();
        SET @ErrorState = ERROR_STATE();

        RAISERROR(   @ErrorMessage2, -- Message text.
                     @ErrorSeverity, -- Severity,
                     @ErrorState,    -- State,
                     NULL,           -- First argument.
                     NULL
                 ); -- Second argument.
    END CATCH;
END;
