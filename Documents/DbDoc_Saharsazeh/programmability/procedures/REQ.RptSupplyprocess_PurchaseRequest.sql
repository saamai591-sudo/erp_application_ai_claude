CREATE   PROCEDURE [REQ].[RptSupplyprocess_PurchaseRequest]
(
    @FinancialPeriod INT,
    @FromDate DATE,
    @EndDate DATE,
    @StuffRequest VARCHAR(MAX) = NULL,
    @Outgoing VARCHAR(MAX) = NULL,
    @JustificationInput VARCHAR(MAX) = NULL,
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
        @CultureNo TINYINT,
        @confirmed NVARCHAR(255),
        @Submited NVARCHAR(255),
        @Rejected NVARCHAR(255),
        @Ended NVARCHAR(255),
        @WithOutbase NVARCHAR(255),
        @StuffRequestStr NVARCHAR(255);


SET @UserID = CFG.GetuserID();
SET @Culture = CFG.GetuserCulture();

SELECT @CultureNo = CultureNo
FROM CFG.CultureInfo
WHERE Culture = @Culture;

SELECT @confirmed = lev.Value
FROM CFG.LocalizeEnumValue AS lev
    JOIN CFG.LocalizeEnum AS le
        ON le.LocalizeEnumID = lev.LocalizeEnumID
WHERE le.Enum = 'RequestStates'
      AND le.Item = 'Confirmed'
      AND lev.Culture = @Culture;

SELECT @Submited = lev.Value
FROM CFG.LocalizeEnumValue AS lev
    JOIN CFG.LocalizeEnum AS le
        ON le.LocalizeEnumID = lev.LocalizeEnumID
WHERE le.Enum = 'RequestStates'
      AND le.Item = 'Submited'
      AND lev.Culture = @Culture;

SELECT @Rejected = lev.Value
FROM CFG.LocalizeEnumValue AS lev
    JOIN CFG.LocalizeEnum AS le
        ON le.LocalizeEnumID = lev.LocalizeEnumID
WHERE le.Enum = 'RequestStates'
      AND le.Item = 'Rejected'
      AND lev.Culture = @Culture;

SELECT @Ended = lev.Value
FROM CFG.LocalizeEnumValue AS lev
    JOIN CFG.LocalizeEnum AS le
        ON le.LocalizeEnumID = lev.LocalizeEnumID
WHERE le.Enum = 'RequestStates'
      AND le.Item = 'Ended'
      AND lev.Culture = @Culture;

SELECT @WithOutbase = lev.Value
FROM CFG.LocalizeEnumValue AS lev
    JOIN CFG.LocalizeEnum AS le
        ON le.LocalizeEnumID = lev.LocalizeEnumID
WHERE le.Enum = 'OutgoingBaseTypes'
      AND le.Item = 'WithOutbase'
      AND lev.Culture = @Culture;

SELECT @StuffRequestStr = lev.Value
FROM CFG.LocalizeEnumValue AS lev
    JOIN CFG.LocalizeEnum AS le
        ON le.LocalizeEnumID = lev.LocalizeEnumID
WHERE le.Enum = 'DocumentNumTypes'
      AND le.Item = 'StuffRequest'
      AND lev.Culture = @Culture;

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


SELECT sr.PurchaseRequestID,
       sr.PurchaseRequestNumber,
       sr.PurchaseRequestDate,
       CFG.GetCLRSaturnDate(sr.PurchaseRequestDate, @DateFormat, 0, @DateType) AS Date_PurchaseRequestDate,
       CASE
           WHEN @CultureNo = 1 THEN
               b.Title
           WHEN @CultureNo = 2 THEN
               b.Title2
       END AS BranchTitle,
       b.Code AS BranchCode,
       CASE
           WHEN @CultureNo = 1 THEN
               ou.Title
           WHEN @CultureNo = 2 THEN
               ou.Title2
       END AS StuffRequester,
       CASE sr.PurchaseRequestState
           WHEN 1 THEN
               @Submited
           WHEN 2 THEN
               @confirmed
           WHEN 3 THEN
               @Rejected
           ELSE
               @Ended
       END AS [Status],
       CASE
           WHEN sr.BaseDocument = 1 THEN
               @WithOutbase
           ELSE
               @StuffRequestStr
       END AS BaseDocument,
       CASE
           WHEN @CultureNo = 1 THEN
               ou.Title
           WHEN @CultureNo = 2 THEN
               ou.Title2
       END AS OrganizationUnitTitle
FROM REQ.PurchaseRequest AS sr
    INNER JOIN CFG.OrganizationUnit AS ou
        ON ou.OrganizationUnitID = sr.OrganizationUnitID
    LEFT JOIN CFG.Branch AS b
        ON b.BranchID = sr.BranchID
   INNER JOIN cfg.vwBranchAccess AS vba ON vba.BranchID = b.BranchID
WHERE @Outgoing IS NULL
      AND sr.FinancialPeriodID = @FinancialPeriod
      AND
      (
          @FromDate IS NULL
          OR sr.PurchaseRequestDate >= @FromDate
      )
      AND
      (
          @EndDate IS NULL
          OR sr.PurchaseRequestDate <= @EndDate
      )
      AND sr.PurchaseRequestID IN
          (
              SELECT main.PurchaseRequestID
              FROM REQ.PurchaseRequestItem AS main --------------
                  LEFT JOIN REQ.StuffRequest_PurchaseRequest AS vw1
                      ON vw1.PurchaseRequestItemID = main.PurchaseRequestItemID
                  LEFT JOIN REQ.StuffRequestItem AS pri
                      ON pri.StuffRequestItemID = vw1.StuffRequestItemID

                  --------------

                  ---------------------
                  LEFT JOIN REQ.PurchaseRequest_JustificationInput AS vw3
                      ON main.PurchaseRequestItemID = vw3.PurchaseRequestItemID
                  LEFT JOIN STC.JustificationInputItem AS jii
                      ON jii.JustificationInputItemID = vw3.JustificationInputItemID
                  --------------------
                  LEFT JOIN REQ.PurchaseRequest_Proposal AS vw4
                      ON vw4.PurchaseRequestItemID = main.PurchaseRequestItemID
                  LEFT JOIN VND.ProposalItem AS pi1
                      ON vw4.ProposalItemID = pi1.ProposalItemID

                  -----------------------------------
                  LEFT JOIN REQ.PurchaseRequest_TemporaryStockReceipt AS Vw5
                      ON Vw5.PurchaseRequestItemID = main.PurchaseRequestItemID
                  LEFT JOIN STC.TemporaryStockReceiptItem AS tsri
                      ON Vw5.TemporaryStockReceiptItemID = tsri.TemporaryStockReceiptItemID

                  ---------------------------------
                  LEFT JOIN REQ.PurchaseRequest_StockReceipt AS vw6
                      ON vw6.PurchaseRequestItemID = main.PurchaseRequestItemID
                  LEFT JOIN STC.StockReceiptItem AS sri
                      ON vw6.StockReceiptItemID = sri.StockReceiptItemID

                  ---------------------
                  LEFT JOIN REQ.PurchaseRequest_PurchaseInvoice AS vw7
                      ON vw7.PurchaseRequestItemID = main.PurchaseRequestItemID
                  LEFT JOIN VND.PurchaseInvoiceItem AS pii
                      ON pii.PurchaseInvoiceItemID = vw7.PurchaseInvoiceItemID

                  ----------------------
                  LEFT JOIN REQ.PurchaseRequest_ReturnedTemporaryStockReceipt AS vw8
                      ON vw8.PurchaseRequestItemID = main.PurchaseRequestItemID
                  LEFT JOIN STC.ReturnedTemporaryStockReceiptItem AS rtsri
                      ON rtsri.ReturnedTemporaryStockReceiptItemID = vw8.ReturnedTemporaryStockReceiptItemID

                  ------------
                  LEFT JOIN REQ.PurchaseRequest_ReturnRequest AS vw9
                      ON vw9.PurchaseRequestItemID = main.PurchaseRequestItemID
                  LEFT JOIN REQ.ReturnRequestItem AS rri
                      ON rri.ReturnRequestItemID = vw9.ReturnRequestItemID

                  ------------
                  LEFT JOIN REQ.PurchaseRequest_PurchaseContract AS vw10
                      ON vw9.PurchaseRequestItemID = main.PurchaseRequestItemID
                  LEFT JOIN VND.PurchaseContractItem AS pci
                      ON pci.PurchaseContractItemID = vw10.PurchaseContractItemID
              WHERE (
                        @StuffRequest IS NULL
                        OR pri.StuffRequestID IN
                           (
                               SELECT value FROM CFG.R_FnCommaStr2Table(@StuffRequest)
                           )
                    )
                    AND
                    (
                        @JustificationInput IS NULL
                        OR jii.JustificationInputID IN
                           (
                               SELECT value FROM CFG.R_FnCommaStr2Table(@JustificationInput)
                           )
                    )
                    AND
                    (
                        @Proposal IS NULL
                        OR pi1.ProposalID IN
                           (
                               SELECT value FROM CFG.R_FnCommaStr2Table(@Proposal)
                           )
                    )
                    AND
                    (
                        @TemporaryStockReceipt IS NULL
                        OR tsri.TemporaryStockReceiptID IN
                           (
                               SELECT value FROM CFG.R_FnCommaStr2Table(@TemporaryStockReceipt)
                           )
                    )
                    AND
                    (
                        @StockReceipt IS NULL
                        OR sri.StockReceiptID IN
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
                    AND
                    (
                        @ReturnedTemporaryStockReceipt IS NULL
                        OR rtsri.ReturnedTemporaryStockReceiptID IN
                           (
                               SELECT value FROM CFG.R_FnCommaStr2Table(@ReturnedTemporaryStockReceipt)
                           )
                    )
                    AND
                    (
                        @ReturnRequest IS NULL
                        OR rri.ReturnRequestID IN
                           (
                               SELECT value FROM CFG.R_FnCommaStr2Table(@ReturnRequest)
                           )
                    )
                    AND
                    (
                        @PurchaseContract IS NULL
                        OR pci.PurchaseContractID IN
                           (
                               SELECT value FROM CFG.R_FnCommaStr2Table(@PurchaseContract)
                           )
                    )
          );
