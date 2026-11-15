
-- #66033 Filter repair warehouse outgoings by the selected asset branch.
CREATE   PROCEDURE [AST].spGetRepairStuffCostBaseDocuments
(
    @Type TINYINT,
    @BranchID INT = NULL,
    @Date DATE = NULL,
    @FinancialPeriodID INT
)
--WITH ENCRYPTION
AS
BEGIN

    DECLARE @UserID INT,
            @DateType TINYINT,
            @DateFormat VARCHAR(10),
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


    IF (@Type = 1)
    BEGIN

        SELECT i.PurchaseInvoiceItemID AS DocumentID,
               N'فاکتور خرید' AS DocumentType,
               p.Number,
               CFG.GetCLRSaturnDate(p.Date, @DateFormat, 0, @DateType) AS Date,
               p.InvoiceNumber,
               CFG.GetCLRSaturnDate(p.InvoiceDate, @DateFormat, 0, @DateType) InvoiceDate,
               i.StuffID,
               s.code AS StuffCode,
               CASE @CultureNo
                   WHEN 2 THEN
                       s.Title2
                   ELSE
                       s.Title
               END AS StuffTitle,
               pir.Non AS MainQuantity,
               pir.NonSub AS SubQuantity,
               i.Fee
        FROM VND.PurchaseInvoiceItem i
            JOIN VND.PurchaseInvoice p
                ON i.PurchaseInvoiceID = p.PurchaseInvoiceID
            JOIN STF.VWStuff s
                ON i.StuffID = s.StuffID
            JOIN VND.PurchaseInvoice_Remains AS pir
                ON pir.PurchaseInvoiceItemID = i.PurchaseInvoiceItemID
            JOIN VND.PurchaseInvoice_PriceRemains AS pipr
                ON pipr.PurchaseInvoiceItemID = i.PurchaseInvoiceItemID
        WHERE s.[Type] = 0
              AND pir.Non > 0
              AND pipr.Non > 0
              AND p.BranchID = @BranchID
              AND p.Date <= @Date;

    END;

    ELSE IF (@Type = 2)
    BEGIN

        SELECT oi.OutgoingItemID AS DocumentID,
               N'حواله انبار' AS DocumentType,
               o.Number,
               CFG.GetCLRSaturnDate(o.Date, @DateFormat, 0, @DateType) AS Date,
               oi.StuffID,
               s.code StuffCode,
               CASE @CultureNo
                   WHEN 2 THEN
                       s.Title2
                   ELSE
                       s.Title
               END AS StuffTitle,
               orr.Non AS MainQuantity,
               orr.NonSub AS SubQuantity,
               orr.Non,
               oi.Fee
        FROM STC.OutgoingItem oi
            JOIN STC.Outgoing o
                ON o.OutgoingID = oi.OutgoingID
            JOIN STF.Stock st
                ON st.StockID = o.StockID
            JOIN STF.VWStuff s
                ON s.StuffID = oi.StuffID
            JOIN SLE.Outgoing_Remains AS orr
                ON orr.OutgoingItemID = oi.OutgoingItemID
        WHERE oi.Price > 0
              AND orr.Non > 0
              AND o.FinancialPeriodID = @FinancialPeriodID
              AND st.BranchID = @BranchID
              AND (@Date IS NULL OR o.Date <= @Date);

    END;

END;
