CREATE  PROCEDURE [CFG].[InstallmentPaymentReview_InstallmentItem]
(
    @Branch VARCHAR(MAX) = NULL,
    @Installment VARCHAR(MAX) = NULL,
    @InstallmentPayItem VARCHAR(MAX) = NULL,
    @Received BIT = 1,
    @Payment BIT = 1,
    @DoneSettlement BIT = 1,
    @NotDoneSettlement BIT = 1,
    @Expired BIT = 1,
    @NotExpired BIT = 1
)
AS
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


DECLARE @Payable NVARCHAR(100),
        @Recivable NVARCHAR(100),
        @Invoice NVARCHAR(100),
        @PurchaseInvoice NVARCHAR(100),
        @StoleSaleBalance NVARCHAR(100),
        @WithoutBase NVARCHAR(100);

SELECT @Payable = lev.[Value]
FROM CFG.LocalizeEnum le
    JOIN CFG.LocalizeEnumValue lev
        ON lev.LocalizeEnumID = le.LocalizeEnumID
WHERE le.Enum = 'InstallmentPaymentTypes'
      AND le.Item = 'Payment'
      AND lev.Culture = @Culture;

SELECT @Recivable = lev.[Value]
FROM CFG.LocalizeEnum le
    JOIN CFG.LocalizeEnumValue lev
        ON lev.LocalizeEnumID = le.LocalizeEnumID
WHERE le.Enum = 'InstallmentPaymentTypes'
      AND le.Item = 'Recive'
      AND lev.Culture = @Culture;

SELECT @Invoice = lev.[Value]
FROM CFG.LocalizeEnum le
    JOIN CFG.LocalizeEnumValue lev
        ON lev.LocalizeEnumID = le.LocalizeEnumID
WHERE le.Enum = 'InstallmentPaymentBaseTypes'
      AND le.Item = 'Invoice'
      AND lev.Culture = @Culture;

SELECT @PurchaseInvoice = lev.[Value]
FROM CFG.LocalizeEnum le
    JOIN CFG.LocalizeEnumValue lev
        ON lev.LocalizeEnumID = le.LocalizeEnumID
WHERE le.Enum = 'InstallmentPaymentBaseTypes'
      AND le.Item = 'PurchaseInvoice'
      AND lev.Culture = @Culture;

SELECT @StoleSaleBalance = lev.[Value]
FROM CFG.LocalizeEnum le
    JOIN CFG.LocalizeEnumValue lev
        ON lev.LocalizeEnumID = le.LocalizeEnumID
WHERE le.Enum = 'InstallmentPaymentBaseTypes'
      AND le.Item = 'StoleSaleBalance'
      AND lev.Culture = @Culture;

SELECT @WithoutBase = lev.[Value]
FROM CFG.LocalizeEnum le
    JOIN CFG.LocalizeEnumValue lev
        ON lev.LocalizeEnumID = le.LocalizeEnumID
WHERE le.Enum = 'InstallmentPaymentBaseTypes'
      AND le.Item = 'WithoutBase'
      AND lev.Culture = @Culture;

SELECT T.BranchId AS BranchID,
       T.InstallmentPaymentItemID,
       T.InstallmentPaymentID,
       T.Number,
       T.PartyId,
       T.Date,
       T.Date_Date,
       T.Date_ItemDate,
       T.InstallmentType,
       T.Type,
       T.Base,
       T.DocumentNumber,
       T.PartyTitle,
       T.TotalAmount,
       T.ItemNumber,
       T.ItemAmount,
       T.ItemDate,
       T.ItemAmountOk,
       T.PartyCode,
       T.ItemAmount - ItemAmountOk AS ItemAmountRemain,
       CAST(0 AS DECIMAL(18, 2)) AS InstallmentDelay,
       T.CurrencyID
INTO #T
FROM
(
    SELECT ip.BranchId,
           ipi0.InstallmentPaymentItemID,
           ip.InstallmentPaymentID,
           ip.Number,
           ip.PartyId,
           ipi0.[Date] AS ItemDate,
           ip.[Date],
           CFG.GetCLRSaturnDate(ip.[Date], @DateFormat, 0, @DateType) AS [Date_Date],
           ip.InstallmentType,
           CASE ip.InstallmentType
               WHEN 1 THEN
                   @Recivable
               ELSE
                   @Payable
           END AS [Type],
           CASE ip.BaseType
               WHEN 1 THEN
                   @WithoutBase
               WHEN 2 THEN
                   @Invoice
               WHEN 3 THEN
                   @StoleSaleBalance
               ELSE
                   @PurchaseInvoice
           END AS Base,
           CASE ip.BaseType
               WHEN 1 THEN
                   NULL
               WHEN 2 THEN
                   cast(i.Number as varchar(100))
               WHEN 3 THEN
                   cast(pi2.Number as varchar(100))
               WHEN 4 THEN
                   isnull(pi.InvoiceNumber,pi.Number)
           END AS DocumentNumber,
           CASE ip.BaseType
               WHEN 1 THEN
                   -1
               WHEN 3 THEN
                   -1
               WHEN 2 THEN
                   i.CurrencyID
               ELSE
                   pi.CurrencyID
           END AS CurrencyID,
           CASE
               WHEN @CultureNo = 1 THEN
                   p.Title + ' ' + ISNULL(p.LastName, '')
               WHEN @CultureNo = 2 THEN
                   p.Title2 + ' ' + ISNULL(p.LastName2, '')
           END AS PartyTitle,
           (
               SELECT SUM(Amount)
               FROM CFG.InstallmentPaymentItem AS ipi
               WHERE ipi.InstallmentPaymentID = ip.InstallmentPaymentID
           ) AS TotalAmount,
           ipi0.Number AS ItemNumber,
           ipi0.Amount AS ItemAmount,
           CFG.GetCLRSaturnDate(ipi0.[Date], @DateFormat, 0, @DateType) AS Date_ItemDate,
           remain.PaidAmount AS ItemAmountOk,
           d.Code AS PartyCode
    FROM CFG.InstallmentPayment AS ip
        INNER JOIN CFG.Party AS p
            ON p.PartyID = ip.PartyId
        INNER JOIN CFG.InstallmentPaymentItem AS ipi0
            ON ipi0.InstallmentPaymentID = ip.InstallmentPaymentID
        JOIN CFG.vwInstallmentPaymentRemain AS remain
            ON ipi0.InstallmentPaymentItemID = remain.InstallmentPaymentItemID
        LEFT JOIN SLE.Invoice AS i
            ON ip.DocumentID = i.InvoiceID
               AND ip.BaseType = 2
        LEFT JOIN VND.PurchaseInvoice AS pi
            ON ip.DocumentID = pi.PurchaseInvoiceID
               AND ip.BaseType = 4
        LEFT JOIN POS.PosInvoice AS pi2
            ON ip.DocumentID = pi2.PosInvoiceID
               AND ip.BaseType = 3
        JOIN ACC.DL AS d
            ON d.DLID = p.DlID
    WHERE (
              @Branch IS NULL
              OR ip.BranchId IN
                 (
                     SELECT value FROM CFG.R_FnCommaStr2Table(@Branch) AS rfcst
                 )
          )
          AND
          (
              @Installment IS NULL
              OR ip.InstallmentPaymentID IN
                 (
                     SELECT value FROM CFG.R_FnCommaStr2Table(@Installment) AS rfcst
                 )
          )
          AND
          (
              @InstallmentPayItem IS NULL
              OR EXISTS
    (
        SELECT 1
        FROM CFG.InstallmentPaymentItem AS ipi
            INNER JOIN FIN.PaymentSubject AS ps
                ON ps.InstallmentPaymentItemID = ipi.InstallmentPaymentItemID
            INNER JOIN CFG.R_FnCommaStr2Table(@InstallmentPayItem) AS rfcst
                ON (3 * 1000000) + (ps.PaymentSubjectID) = rfcst.[value]
        WHERE ipi.InstallmentPaymentItemID = ipi0.InstallmentPaymentItemID
    )
              OR EXISTS
    (
        SELECT 1
        FROM CFG.InstallmentPaymentItem AS ipi
            INNER JOIN FIN.ReceiveSubject AS rs
                ON rs.InstallmentPaymentItemID = ipi.InstallmentPaymentItemID
            INNER JOIN CFG.R_FnCommaStr2Table(@InstallmentPayItem) AS rfcst
                ON (2 * 1000000) + rs.ReceiveSubjectID = rfcst.[value]
        WHERE ipi.InstallmentPaymentItemID = ipi0.InstallmentPaymentItemID
    )
              OR EXISTS
    (
        SELECT 1
        FROM CFG.InstallmentPaymentItem AS ipi
            INNER JOIN CFG.ManualReceipt AS mr
                ON mr.InstallmentPaymentItemID = ipi.InstallmentPaymentItemID
            INNER JOIN CFG.R_FnCommaStr2Table(@InstallmentPayItem) AS rfcst
                ON (4 * 1000000) + mr.ManualReceiptID = rfcst.[value]
        WHERE ipi.InstallmentPaymentID = ip.InstallmentPaymentID
    )
          )
          AND
          (
              (
                  @Received = 1
                  AND @Payment = 1
              )
              OR
              (
                  @Received = 0
                  AND @Payment = 1
                  AND ip.InstallmentType = 2
              )
              OR
              (
                  @Received = 1
                  AND @Payment = 0
                  AND ip.InstallmentType = 1
              )
          )
          AND
          (
              (
                  @DoneSettlement = 1
                  AND @NotDoneSettlement = 1
              )
              OR
              (
                  @DoneSettlement = 0
                  AND @NotDoneSettlement = 1
                  AND remain.remain > 0
              )
              OR
              (
                  @DoneSettlement = 1
                  AND @NotDoneSettlement = 0
                  AND remain.remain = 0
              )
          )
          AND
          (
              (
                  @Expired = 1
                  AND @NotExpired = 1
              )
              OR
              (
                  @Expired = 0
                  AND @NotExpired = 1
                  AND ipi0.Date > GETDATE()
              )
              OR
              (
                  @Expired = 1
                  AND @NotExpired = 0
                  AND ipi0.Date <= GETDATE()
              )
          )
) T;


UPDATE #T
SET InstallmentDelay = ISNULL(   ((ISNULL(T.Val, 0) + CASE
                                                          WHEN #T.ItemDate <= GETDATE() THEN
                                 (DATEDIFF(d, #T.ItemDate, GETDATE()) * ItemAmountRemain)
                                                          ELSE
                                                              0
                                                      END
                                  ) / CASE
                                          WHEN #T.ItemAmount <> 0 THEN
                                              #T.ItemAmount
                                          ELSE
                                              1
                                      END
                                 ),
                                 0
                             )
FROM #T
    LEFT JOIN
    (
        SELECT v.InstallmentPaymentItemID,
               SUM((DATEDIFF(d, #T.ItemDate, v.[Date]) * v.Amount)) AS Val
        FROM CFG.vwInstallmentPayment v
            INNER JOIN #T
                ON v.InstallmentPaymentItemID = #T.InstallmentPaymentItemID
        GROUP BY v.InstallmentPaymentItemID
    ) t
        ON t.InstallmentPaymentItemID = #T.InstallmentPaymentItemID
WHERE #T.ItemDate <= GETDATE()
      OR ItemAmountOk <> 0;


SELECT t.BranchID,
       t.InstallmentPaymentItemID,
       t.InstallmentPaymentID,
       t.Number,
       t.PartyId,
       t.Date,
       t.Date_Date,
       t.Date_ItemDate,
       t.InstallmentType,
       t.Type,
       t.Base,
       t.DocumentNumber,
       t.PartyTitle,
       t.TotalAmount,
       t.ItemNumber,
       t.ItemAmount,
       t.ItemDate,
       t.ItemAmountOk,
       t.PartyCode,
       t.ItemAmountRemain,
       t.InstallmentDelay,
       CASE @CultureNo
           WHEN 2 THEN
               c.Title2
           ELSE
               c.Title
       END AS CurrencyTitle
FROM #T AS t
    JOIN CFG.Currency AS c
        ON c.CurrencyID = t.CurrencyID;
