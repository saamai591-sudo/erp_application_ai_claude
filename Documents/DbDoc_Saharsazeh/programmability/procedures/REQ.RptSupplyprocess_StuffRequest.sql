CREATE   PROCEDURE [REQ].[RptSupplyprocess_StuffRequest]
(
    @FinancialPeriod INT,
    @FromDate DATE,
    @EndDate DATE,
    @PurchaseRequest VARCHAR(MAX) = NULL,
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
        @Ended NVARCHAR(255);


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

SELECT sr.StuffRequestID,
       sr.StuffRequestNumber,
       sr.StuffRequestDate,
       CFG.GetCLRSaturnDate(sr.StuffRequestDate, @DateFormat, 0, @DateType) AS Date_StuffRequestDate,
       CASE
           WHEN @CultureNo = 1 THEN
               b.Title
           WHEN @CultureNo = 2 THEN
               b.Title2
       END AS BranchTitle,
       b.Code AS BranchCode,
       -- s.Title AS StockTitle ,
       -- s.Code AS StockCode ,
       CASE
           WHEN @CultureNo = 1 THEN
               ou.Title
           WHEN @CultureNo = 2 THEN
               ou.Title2
       END AS StuffRequester,
       CASE sr.StuffRequestState
           WHEN 1 THEN
               @Submited
           WHEN 2 THEN
               @confirmed
           WHEN 3 THEN
               @Rejected
           ELSE
               @Ended
       END AS [Status]
FROM REQ.StuffRequest AS sr
    INNER JOIN CFG.OrganizationUnit AS ou
        ON ou.OrganizationUnitID = sr.OrganizationUnitID
    LEFT JOIN CFG.Branch AS b
        ON b.BranchID = sr.BranchID
INNER JOIN cfg.vwBranchAccess AS vba ON vba.BranchID =  b.BranchID
-- LEFT JOIN STF.Stock AS s ON s.StockID = sr.StockID
WHERE sr.FinancialPeriodID = @FinancialPeriod
      AND
      (
          @FromDate IS NULL
          OR sr.StuffRequestDate >= @FromDate
      )
      AND
      (
          @EndDate IS NULL
          OR sr.StuffRequestDate <= @EndDate
      )
      AND sr.StuffRequestID IN
          (
              SELECT StuffRequestID
              FROM REQ.StuffRequestItem AS main --------------
                  LEFT JOIN REQ.StuffRequest_PurchaseRequest AS vw1
                      ON vw1.StuffRequestItemID = main.StuffRequestItemID
                  LEFT JOIN REQ.PurchaseRequestItem AS pri
                      ON pri.PurchaseRequestItemID = vw1.PurchaseRequestItemID

                  --------------
                  LEFT JOIN REQ.StuffRequest_Outgoing AS vw2
                      ON vw2.StuffRequestItemID = main.StuffRequestItemID
                  LEFT JOIN STC.OutgoingItem AS oi
                      ON vw2.OutgoingItemID = oi.OutgoingItemID

                  ---------------------
                  LEFT JOIN REQ.StuffRequest_JustificationInput AS vw3
                      ON main.StuffRequestItemID = vw3.StuffRequestItemID
                  LEFT JOIN STC.JustificationInputItem AS jii
                      ON jii.JustificationInputItemID = vw3.JustificationInputItemID
                  --------------------
                  LEFT JOIN REQ.StuffRequest_Proposal AS vw4
                      ON vw4.StuffRequestItemID = main.StuffRequestItemID
                  LEFT JOIN VND.ProposalItem AS pi1
                      ON vw4.ProposalItemID = pi1.ProposalItemID

                  -----------------------------------
                  LEFT JOIN REQ.StuffRequest_TemporaryStockReceipt AS Vw5
                      ON Vw5.StuffRequestItemID = main.StuffRequestItemID
                  LEFT JOIN STC.TemporaryStockReceiptItem AS tsri
                      ON Vw5.TemporaryStockReceiptItemID = tsri.TemporaryStockReceiptItemID

                  ---------------------------------
                  LEFT JOIN REQ.StuffRequest_StockReceipt AS vw6
                      ON vw6.StuffRequestItemID = main.StuffRequestItemID
                  LEFT JOIN STC.StockReceiptItem AS sri
                      ON vw6.StockReceiptItemID = sri.StockReceiptItemID

                  ---------------------
                  LEFT JOIN REQ.StuffRequest_PurchaseInvoice AS vw7
                      ON vw7.StuffRequestItemID = main.StuffRequestItemID
                  LEFT JOIN VND.PurchaseInvoiceItem AS pii
                      ON pii.PurchaseInvoiceItemID = vw7.PurchaseInvoiceItemID

                  ----------------------
                  LEFT JOIN REQ.StuffRequest_ReturnedTemporaryStockReceipt AS vw8
                      ON vw8.StuffRequestItemID = main.StuffRequestItemID
                  LEFT JOIN STC.ReturnedTemporaryStockReceiptItem AS rtsri
                      ON rtsri.ReturnedTemporaryStockReceiptItemID = vw8.ReturnedTemporaryStockReceiptItemID

                  ------------
                  LEFT JOIN REQ.StuffRequest_ReturnRequest AS vw9
                      ON vw9.StuffRequestItemID = main.StuffRequestItemID
                  LEFT JOIN REQ.ReturnRequestItem AS rri
                      ON rri.ReturnRequestItemID = vw9.ReturnRequestItemID

                  ------------
                  LEFT JOIN REQ.StuffRequest_PurchaseContract AS vw10
                      ON vw10.StuffRequestItemID = main.StuffRequestItemID
                  LEFT JOIN VND.PurchaseContractItem AS pci
                      ON vw10.PurchaseContractItemID = pci.PurchaseContractItemID
              WHERE (
                        @PurchaseRequest IS NULL
                        OR pri.PurchaseRequestID IN
                           (
                               SELECT value FROM CFG.R_FnCommaStr2Table(@PurchaseRequest)
                           )
                    )
                    AND
                    (
                        @Outgoing IS NULL
                        OR oi.OutgoingID IN
                           (
                               SELECT value FROM CFG.R_FnCommaStr2Table(@Outgoing)
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

