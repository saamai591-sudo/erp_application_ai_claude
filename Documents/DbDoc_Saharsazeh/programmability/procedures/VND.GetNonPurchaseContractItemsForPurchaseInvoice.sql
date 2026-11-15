------------------------------------------
CREATE   PROCEDURE [VND].GetNonPurchaseContractItemsForPurchaseInvoice
(
    @branchId INT,
    @dlId INT,
    @type INT = NULL,
    @date DATE,
    @financialPeriodId INT,
    @ids NVARCHAR(MAX) = NULL,
    @currencyId INT = NULL
)

--WITH ENCRYPTION
AS
BEGIN

    DECLARE @UserID INT,
            @DateType TINYINT,
            @DateFormat VARCHAR(10),
            @Culture NVARCHAR(5),
            @CultureNo TINYINT;

    SET @Culture = cfg.GetuserCulture();

    SELECT @CultureNo = CultureNo
    FROM CFG.CultureInfo
    WHERE Culture = @Culture;

    IF (@ids = '')
        SET @ids = NULL;

    SET @UserID = CFG.GetuserID();

    SELECT @DateType = us.SettingValue
    FROM CFG.UserSetting us
    WHERE us.SettingKey = 'Date_Type'
          AND us.UserID = @UserID;

    IF @DateType IS NULL
        SET @DateType = CASE CFG.GetuserCulture()
                            WHEN 'fa' THEN 0
                            WHEN 'en' THEN 1
                            WHEN 'ar' THEN 2
                        END;

    SELECT @DateFormat = us.SettingValue
    FROM CFG.UserSetting us
    WHERE us.SettingKey = 'Date_Format'
          AND us.UserID = @UserID;

    IF @DateFormat IS NULL
        SET @DateFormat = 'YY/MM/DD';

		select * into #vwStuff
		from stf.VWStuff

    SELECT pii.PurchaseContractItemID,
           pii.PurchaseContractID,
           pii.RowIndex,
           pin.Number,
           CFG.GetCLRSaturnDate(pin.[Date], @DateFormat, 0, @DateType) DateString,
           pin.InvoiceNumber,
           CFG.GetCLRSaturnDate(pin.[InvoiceDate], @DateFormat, 0, @DateType) InvoiceDateString,
           pii.StuffID,
           s.Code StuffCode,
           CASE @CultureNo
               WHEN 1 THEN
                   s.Title
               WHEN 2 THEN
                   s.Title2
           END AS StuffTitle,
           pii.MainQuantity,
           pii.SubQuantity,
           pir.Non,
           pir.NonSub,
           pii.Fee,
           pii.Discount,
           pii.Description,
           pii.Description2
    FROM VND.PurchaseContractItem pii
        JOIN VND.PurchaseContract pin
            ON pin.PurchaseContractID = pii.PurchaseContractID
        JOIN VND.PurchaseContract_Remains pir
            ON pir.PurchaseContractItemID = pii.PurchaseContractItemID
        JOIN #vwStuff s
            ON s.StuffID = pii.StuffID
    WHERE pir.Non > 0
          AND pin.DlID = @dlId
          AND pin.BranchID = @branchId
          AND (@type IS NULL OR pin.[Type] = @type)
          AND pin.[Date] <= @date
          AND (@currencyId IS NULL OR pin.CurrencyID = @currencyId) 
	      AND pin.[Status] != 3;
END; 
