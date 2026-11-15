/************************************************************
 * Code formatted by SoftTree SQL Assistant © v9.1.261
 * Time: 7/18/2017 9:32:59 AM
 ************************************************************/

CREATE   PROCEDURE [POS].[rptDelivery]
    (
        @ID NVARCHAR(MAX)
    )
AS
    DECLARE @UserID INT ,
            @DateType TINYINT ,
            @DateFormat VARCHAR(10) ,
            @Culture VARCHAR(10);

    SET @Culture = CFG.GetuserCulture();



    SET @UserID = CFG.GetuserID();

    SELECT @DateType = us.SettingValue
    FROM   CFG.UserSetting us
    WHERE  us.SettingKey = 'Date_Type'
           AND us.UserID = @UserID;

    IF @DateType IS NULL
        SET @DateType = CASE @Culture
                             WHEN 'fa' THEN 0
                             WHEN 'en' THEN 1
                             WHEN 'ar' THEN 2
                        END;

    SELECT @DateFormat = us.SettingValue
    FROM   CFG.UserSetting us
    WHERE  us.SettingKey = 'Date_Format'
           AND us.UserID = @UserID;

    IF @DateFormat IS NULL
        SET @DateFormat = 'YY/MM/DD';


    SELECT T2.DeliveryID ,
           T2.Sale ,
           T2.CardReader ,
           T2.Cach ,
           T2.ShoppingCart ,
           T2.SubscribeCardCharge ,
           T2.Installment ,
           T2.Credit ,
		   T2.Discount,
           d.Number ,
           s.Title AS StationTitle ,
           ss.Title AS StationShiftTitle ,
           CFG.GetCLRSaturnDate(d.[Date], @DateFormat, 0, @DateType) AS DateStr ,
           u.Name Creator
    FROM   (   SELECT   d.DeliveryID ,
                        SUM(CASE WHEN T.itemType = 1 THEN amount
                                 ELSE 0
                            END) AS Sale ,
                        SUM(CASE WHEN T.itemType = 2 THEN T.Discount
                                 ELSE 0
                            END) AS Discount ,
                        SUM(CASE WHEN T.itemType = 2 THEN amount
                                 ELSE 0
                            END) AS CardReader ,
                        SUM(CASE WHEN T.itemType = 3 THEN amount
                                 ELSE 0
                            END) AS Cach ,
                        SUM(CASE WHEN T.itemType = 4 THEN amount
                                 ELSE 0
                            END) AS ShoppingCart ,
                        SUM(CASE WHEN T.itemType = 5 THEN amount
                                 ELSE 0
                            END) AS SubscribeCardCharge ,

                        SUM(T.Installment) AS Installment ,
                        SUM(T.Credit) AS Credit
               FROM     POS.Delivery AS d
                        INNER JOIN (   SELECT dpi.DeliveryID ,
                                              0 AS Discount ,
                                              CASE WHEN pi1.IsReturnInvoice = 1 THEN
                                                       -1
                                                   ELSE 1
                                              END * pi1.TotalNetPrice AS amount ,
                                              1 AS itemType ,
                                              CASE WHEN pi1.HasInstallment = 1 THEN
                                                       pi1.TotalNetPrice
                                                       - ISNULL(
                                                         (   SELECT SUM(pr.TotalAmount)
                                                             FROM   POS.PosReceipt AS pr
                                                             WHERE  pr.PosInvoiceID = pi1.PosInvoiceID ) ,
                                                         0)
                                                   ELSE 0
                                              END AS Installment ,
                                              CASE WHEN pi1.HasCredit = 1 THEN
                                                       pi1.TotalNetPrice
                                                       - ISNULL(
                                                         (   SELECT SUM(pr.TotalAmount)
                                                             FROM   POS.PosReceipt AS pr
                                                             WHERE  pr.PosInvoiceID = pi1.PosInvoiceID ) ,
                                                         0)
                                                   ELSE 0
                                              END AS Credit
                                       FROM   POS.DeliveryPosInvoice AS dpi
                                              INNER JOIN POS.PosInvoice AS pi1 ON pi1.PosInvoiceID = dpi.PosInvoiceID
                                       UNION ALL
                                       SELECT dpri.DeliveryID ,
                                              pr2.Discount AS Discount ,
                                              CASE WHEN pr2.IsPayed = 1 THEN -1
                                                   ELSE 1
                                              END * pri.Amount ,
                                              CASE WHEN pri.CardReaderID IS NOT NULL THEN
                                                       2
                                                   WHEN pri.CashID IS NOT NULL THEN
                                                       3
                                                   WHEN pri.ShoppingCartID IS NOT NULL THEN
                                                       4
                                                   WHEN pri.SubscribeCardChargeID IS NOT NULL THEN
                                                       5
                                              END ,
                                              0 ,
                                              0
                                       FROM   POS.DeliveryPosReceiptItem AS dpri
                                              INNER JOIN POS.PosReceiptItem AS pri ON pri.PosReceiptItemID = dpri.PosReceiptItemID
                                              INNER JOIN POS.PosReceipt AS pr2 ON pr2.PosReceiptID = pri.PosReceiptID ) T ON d.DeliveryID = T.DeliveryID
               WHERE    d.DeliveryID IN (   SELECT value
                                            FROM   CFG.R_FnCommaStr2Table(@ID) AS rfcst )
               GROUP BY d.DeliveryID ) T2
           INNER JOIN POS.Delivery AS d ON d.DeliveryID = T2.DeliveryID
           INNER JOIN POS.StationShift AS ss ON ss.StationShiftID = d.StationShiftID
           INNER JOIN POS.Station AS s ON s.StationID = ss.StationID
           INNER JOIN CFG.[User] u ON u.UserID = d.Creator;

