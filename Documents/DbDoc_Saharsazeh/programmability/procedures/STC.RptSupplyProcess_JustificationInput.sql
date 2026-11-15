
----------------------------------------------------------------------------------------------------------------------------------------
CREATE   PROCEDURE [STC].RptSupplyProcess_JustificationInput
(
    @FinancialPeriod INT,
    @FromDate DATE,
    @EndDate DATE,
    @StuffRequest VARCHAR(MAX) = NULL,
    @PurchaseRequest VARCHAR(MAX) = NULL,
    @Outgoing VARCHAR(MAX) = NULL,
    @Proposal VARCHAR(MAX) = NULL,
    @TemporaryStockReceipt VARCHAR(MAX) = NULL,
    @StockReceipt VARCHAR(MAX) = NULL,
    @PurchaseInvoice VARCHAR(MAX) = NULL,
    @ReturnedTemporaryStockReceipt VARCHAR(MAX) = NULL,
    @ReturnRequest VARCHAR(MAX) = NULL,
    @PurchaseContract NVARCHAR(MAX) = NULL
)
AS
DECLARE @UserID INT,
        @Culture VARCHAR(10),
        @DateType TINYINT,
        @DateFormat VARCHAR(10),
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



DECLARE @PurchaseRequestT NVARCHAR(100),
        @ProposalT NVARCHAR(100),
        @TempReceipt NVARCHAR(100),
        @WithoutBase NVARCHAR(100),
        @PurchaseContractBase NVARCHAR(100);


SELECT @WithoutBase = LV.Value
FROM CFG.LocalizeEnum L
    JOIN CFG.LocalizeEnumValue LV
        ON L.LocalizeEnumID = LV.LocalizeEnumID
WHERE L.Enum = 'TemporaryStockReceiptBaseType'
      AND L.Item = 'WithOutbase'
      AND LV.Culture = CFG.GetuserCulture();

SELECT @ProposalT = LV.Value
FROM CFG.LocalizeEnum L
    JOIN CFG.LocalizeEnumValue LV
        ON L.LocalizeEnumID = LV.LocalizeEnumID
WHERE L.Enum = 'TemporaryStockReceiptBaseType'
      AND L.Item = 'Proposal'
      AND LV.Culture = CFG.GetuserCulture();

SELECT @PurchaseRequestT = LV.Value
FROM CFG.LocalizeEnum L
    JOIN CFG.LocalizeEnumValue LV
        ON L.LocalizeEnumID = LV.LocalizeEnumID
WHERE L.Enum = 'TemporaryStockReceiptBaseType'
      AND L.Item = 'PurchaseRequest'
      AND LV.Culture = CFG.GetuserCulture();

SELECT @TempReceipt = LV.Value
FROM CFG.LocalizeEnum L
    JOIN CFG.LocalizeEnumValue LV
        ON L.LocalizeEnumID = LV.LocalizeEnumID
WHERE L.Enum = 'TemporaryStockReceiptBaseType'
      AND L.Item = 'TemporaryReceipt'
      AND LV.Culture = CFG.GetuserCulture();
SET @UserID = CFG.GetuserID();

SELECT @PurchaseContractBase = LV.Value
FROM CFG.LocalizeEnum L
    JOIN CFG.LocalizeEnumValue LV
        ON L.LocalizeEnumID = LV.LocalizeEnumID
WHERE L.Enum = 'PurchaseDocumentBases'
      AND L.Item = 'PurchaseContract'
      AND LV.Culture = CFG.GetuserCulture();
SET @UserID = CFG.GetuserID();

SELECT ji.JustificationInputID,
       ji.Number,
       ji.[Date],
       CFG.GetCLRSaturnDate(ji.[Date], @DateFormat, 0, @DateType) AS [Date_Date],
       CASE
           WHEN @CultureNo = 1 THEN
               s.Title
           WHEN @CultureNo = 2 THEN
               s.Title2
       END AS StockTitle,
       s.Code AS StockCode,
       CASE sdtb.BaseEntity
           WHEN 1 THEN
               @WithoutBase
           WHEN 2 THEN
               @PurchaseRequestT
           WHEN 3 THEN
               @ProposalT
           WHEN 4 THEN
               @TempReceipt
           WHEN 8 THEN
               @PurchaseContractBase
       END BaseEntityTitle,
       CASE
           WHEN @CultureNo = 1 THEN
               sdt.Title
           WHEN @CultureNo = 2 THEN
               sdt.Title2
       END AS DocumentType
FROM STC.JustificationInput AS ji
JOIN [STC].[StockDocumentTypeBaseEntity] sdtb
	ON ji.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
    INNER JOIN STC.StockDocumentType AS sdt
        ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
    LEFT JOIN STF.Stock AS s
        ON s.StockID = ji.StockID
INNER JOIN cfg.vwStockAccess AS vsa ON vsa.StockID = s.StockID
WHERE @Outgoing IS NULL
      AND @Proposal IS NULL
      AND @TemporaryStockReceipt IS NULL
      AND @ReturnedTemporaryStockReceipt IS NULL
      AND @ReturnRequest IS NULL
      AND @PurchaseContract IS NULL
      AND ji.FinancialPeriodID = @FinancialPeriod
      AND
      (
          @FromDate IS NULL
          OR ji.[Date] >= @FromDate
      )
      AND
      (
          @EndDate IS NULL
          OR ji.[Date] <= @EndDate
      )
      AND ji.JustificationInputID IN
          (
              SELECT main.JustificationInputItemID
              FROM STC.JustificationInputItem AS main

                  --------------

                  LEFT JOIN REQ.StuffRequest_JustificationInput AS vw1
                      ON vw1.JustificationInputItemID = main.JustificationInputItemID
                  LEFT JOIN REQ.StuffRequestItem AS sri
                      ON sri.StuffRequestItemID = vw1.StuffRequestItemID

                  --------------

                  LEFT JOIN REQ.PurchaseRequest_JustificationInput AS vw2
                      ON vw2.JustificationInputItemID = main.JustificationInputItemID
                  LEFT JOIN REQ.PurchaseRequestItem AS pri
                      ON pri.PurchaseRequestItemID = vw2.PurchaseRequestItemID

                  --------------

                  LEFT JOIN STC.JustificationInput_StockReceipt AS vw3
                      ON vw3.JustificationInputItemID = main.JustificationInputItemID
                  LEFT JOIN STC.StockReceiptItem AS sri2
                      ON sri2.StockReceiptItemID = vw3.StockReceiptItemID

                  --------------

                  LEFT JOIN STC.JustificationInput_PurchaseInvoice AS vw4
                      ON vw4.JustificationInputItemID = main.JustificationInputItemID
                  LEFT JOIN VND.PurchaseInvoiceItem AS pii
                      ON pii.PurchaseInvoiceItemID = vw4.PurchaseInvoiceItemID
              WHERE (
                        @StuffRequest IS NULL
                        OR sri.StuffRequestID IN
                           (
                               SELECT value FROM CFG.R_FnCommaStr2Table(@StuffRequest)
                           )
                    )
                    AND
                    (
                        @PurchaseRequest IS NULL
                        OR pri.PurchaseRequestID IN
                           (
                               SELECT value FROM CFG.R_FnCommaStr2Table(@PurchaseRequest)
                           )
                    )
                    AND
                    (
                        @StockReceipt IS NULL
                        OR sri2.StockReceiptID IN
                           (
                               SELECT value FROM CFG.R_FnCommaStr2Table(@StockReceipt)
                           )
                    )
                    AND
                    (
                        @PurchaseInvoice IS NULL
                        OR pii.PurchaseInvoiceID IN
                           (
                               SELECT value FROM CFG.R_FnCommaStr2Table(@PurchaseInvoice)
                           )
                    )
          );
