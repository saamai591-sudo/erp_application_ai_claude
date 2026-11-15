
------------------------------------- START #7743
CREATE   PROCEDURE FOS.GetClearanceNonReceipts (@dlId INT,
@date DATETIME,
@StockID INT = NULL)
AS
BEGIN

        DECLARE @dateFormat VARCHAR(10)
               ,@dateType TINYINT
               ,@culture VARCHAR(2)
               ,@userId INT
               ,@CultureNo TINYINT

        SET @userId = CFG.GetuserID();
        SET @culture = CFG.GetuserCulture();

        SELECT
                @CultureNo = CultureNo
        FROM CFG.CultureInfo
        WHERE Culture = @Culture

        SELECT
                @dateType = CFG.GetCurrentUserDateType();

        SELECT
                @dateFormat = CFG.GetCurrentUserDateFormat()

        SELECT
                * INTO #vwStuffStock_ForPursuiteGroup
        FROM STF.vwStuffStock_ForPursuiteGroup AS vssfpg
        WHERE ISNULL(vssfpg.StockID, @StockID) = @StockID

        SELECT
                ci.ClearanceItemID
               ,c.CotajNumber Number
               ,c.ClearanceID
               ,bi.RowIndex
               ,CFG.GetCLRSaturnDate(c.CotajDate, @dateFormat, 0, @dateType) DateString
               ,pii.StuffID
               ,s.code StuffCode
               ,CASE @CultureNo
                        WHEN 1 THEN s.Title
                        WHEN 2 THEN s.Title2
                END AS StuffTitle
               ,s.StuffDetailType
               ,pii.MainQuantity
               ,pii.SubQuantity
               ,vcnsr.Non
               ,vcnsr.NonSub
        FROM FOS.ClearanceItem AS ci
        JOIN FOS.Clearance AS c
                ON c.ClearanceID = ci.ClearanceID
        JOIN FOS.BillOfLadingItem bi
                ON ci.BillOfLadingItemID = bi.BillOfLadingItemID
        JOIN FOS.BillOfLading AS bil
                ON bi.BillOfLadingID = bil.BillOfLadingID
        JOIN VND.PurchaseInvoiceItem AS pii
                ON pii.PurchaseInvoiceItemID = bi.PurchaseInvoiceItemID
        JOIN VND.PurchaseInvoice AS pi
                ON pi.PurchaseInvoiceID = pii.PurchaseInvoiceID
        JOIN STF.VWStuff AS s
                ON s.StuffID = pii.StuffID
        JOIN #vwStuffStock_ForPursuiteGroup AS vssfpg
                ON vssfpg.StuffID = s.StuffID
        JOIN CFG.Party AS p
                ON pi.DlID = p.DlID
        JOIN FOS.vwClearance_Non_StockReceipt AS vcnsr
                ON vcnsr.ClearanceItemID = ci.ClearanceItemID
        WHERE p.DlID = @dlId
        AND vcnsr.Non > 0
        AND (vcnsr.NonSub IS NULL
        OR vcnsr.NonSub > 0)
        AND c.[Date] <= @date;

END;
