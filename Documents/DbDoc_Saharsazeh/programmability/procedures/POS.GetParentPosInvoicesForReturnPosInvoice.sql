
------------ STRAT #8192
CREATE    PROC [POS].GetParentPosInvoicesForReturnPosInvoice
(
    @FinancialPeriodID INT,
    @StationShiftId INT
)
--WITH ENCRYPTION
AS
BEGIN
    DECLARE @UserID INT,
            @DateType TINYINT,
            @DateFormat VARCHAR(10),
            @Culture VARCHAR(5),
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

    SELECT p.PosInvoiceID,
           p.FinancialPeriodID,
           p.StateShiftID,
           p.Number,
           CFG.GetCLRSaturnDate([p].[Date], @DateFormat, 0, @DateType) DateString,
           p.CustomerID AS CustomerId,
           p.StockID,
           d.Code CustomerCode,
           CASE @CultureNo
               WHEN 1 THEN
                   ISNULL(pa.Title, '') + ' ' + ISNULL(pa.LastName, '')
               WHEN 2 THEN
                   ISNULL(pa.Title2, '') + ' ' + ISNULL(pa.LastName2, '')
           END AS CustomerName,
           p.SaleAgentID AS SaleAgentId
    FROM POS.PosInvoice p
        JOIN
        (
            SELECT DISTINCT
                   h.PosInvoiceID
            FROM POS.PosInvoice h
                JOIN POS.PosInvoiceItem i
                    ON i.PosInvoiceID = h.PosInvoiceID
                LEFT JOIN POS.PosInvoiceItem ri
                    ON ri.ParentPosInvoiceItemID = i.PosInvoiceItemID
            WHERE h.IsReturnInvoice = 0
                  and h.[Date]>= DATEADD(DAY,-365,CAST(GETDATE() as DATE))
                  AND h.StateShiftID = @StationShiftId
                  AND (i.MainQuantity - ISNULL(ri.MainQuantity, 0)) > 0
        ) n
            ON n.PosInvoiceID = p.PosInvoiceID
        JOIN CFG.Party pa
            ON pa.PartyID = p.CustomerID
        JOIN ACC.DL d
            ON d.DLID = pa.DlID;
END;
